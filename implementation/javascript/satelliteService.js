export class SatelliteService {
    constructor({
        ttlMinutes = 30,
        concurrency = 1
    } = {}) {
        this.CACHE_TTL = ttlMinutes * 60 * 1000;
        this.concurrency = concurrency;
    }

    getCacheKey(group) {
        return `sat_cache_${group}`;
    }

    loadFromCache(group) {
        try {
            const raw = localStorage.getItem(this.getCacheKey(group));
            if (!raw) return null;

            const cached = JSON.parse(raw);
            const expired = Date.now() - cached.timestamp > this.CACHE_TTL;

            if (expired) {
                // Return expired cache marked as true so fetchGroup can use it as emergency fallback
                return { data: cached.data, expired: true };
            }

            return { data: cached.data, expired: false };
        } catch {
            return null;
        }
    }

    saveToCache(group, data) {
        try {
            localStorage.setItem(
                this.getCacheKey(group),
                JSON.stringify({
                    timestamp: Date.now(),
                    data
                })
            );
        } catch {
            console.warn("Cache storage full, skipping:", group);
        }
    }

    async fetchWithTimeout(url, timeout = 25000) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);

        try {
            const res = await fetch(url, {
                signal: controller.signal
            });
            return res;
        } finally {
            clearTimeout(timer);
        }
    }

    async fetchGroup(source) {
        const cacheResult = this.loadFromCache(source.group);
        if (cacheResult && !cacheResult.expired) {
            console.log(`📦 Cache hit: ${source.group}`);
            return cacheResult.data;
        }

        const url = `/api/celestrak/NORAD/elements/gp.php?GROUP=${source.group}&FORMAT=tle`;

        try {
            const response = await this.fetchWithTimeout(url);
            const text = await response.text();

            if (response.status === 403) {
                console.warn(`⏱ CelesTrak blocked ${source.group}`);
                if (cacheResult?.data) return cacheResult.data; // Serve expired cache rather than crashing
                throw new Error(`403 (no cache): ${source.group}`);
            }

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${text}`);
            }

            const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
            const parsedData = [];

            // Parse standard 3-line chunks (Line 0: Name, Line 1: TLE1, Line 2: TLE2)
            for (let i = 0; i < lines.length; i += 3) {
                if (lines[i] && lines[i + 1] && lines[i + 2]) {
                    parsedData.push({
                        OBJECT_NAME: lines[i],
                        NORAD_CAT_ID: lines[i + 1].substring(2, 7).trim(),
                        TLE_LINE1: lines[i + 1],
                        TLE_LINE2: lines[i + 2]
                    });
                }
            }

            this.saveToCache(source.group, parsedData);
            return parsedData;

        } catch (error) {
            console.warn(`⚠️ Network fetch failing for group "${source.group}". Searching emergency cache fallback...`, error);
            
            // If network failed (e.g., 502 Bad Gateway) but we have an old cache block, use it!
            if (cacheResult?.data) {
                console.log(`♻️ Recovered expired cached payload for group: ${source.group}`);
                return cacheResult.data;
            }
            
            // No cache available whatsoever, propagate the rejection up
            throw error;
        }
    }

    async runWithConcurrency(items, worker) {
        const results = [];
        const executing = new Set();
        for (const item of items) {
            const p = Promise.resolve().then(() => worker(item));
            results.push(p);
            executing.add(p);
            const cleanup = () => executing.delete(p);
            p.then(cleanup).catch(cleanup);
            if (executing.size >= this.concurrency) {
                await Promise.race(executing);
            }
        }
        return Promise.allSettled(results);
    }

    async fetchActiveSatellites(groups) {
        const satellites = [];
        const seenIds = new Set();
        let rejectedCount = 0;

        const results = await this.runWithConcurrency(groups, async (source) => {
            const data = await this.fetchGroup(source);
            return { source, data };
        });

        results.forEach(result => {
            if (result.status !== "fulfilled") {
                console.warn("❌ Failed group tracking parse:", result.reason);
                rejectedCount++;
                return;
            }

            const { source, data } = result.value;
            if (!Array.isArray(data)) return;

            data.forEach(sat => {
                const noradId = sat.NORAD_CAT_ID ? String(sat.NORAD_CAT_ID) : null;
                if (!noradId || seenIds.has(noradId)) return;

                satellites.push({
                    name: sat.OBJECT_NAME,
                    noradId,
                    tle1: sat.TLE_LINE1,
                    tle2: sat.TLE_LINE2,
                    type: source.type
                });

                seenIds.add(noradId);
            });
        });

        // 🚀 CRITICAL RECOVERY TRAP: If zero satellites successfully compiled and group exceptions occurred,
        // explicitly throw an Error so globe.js jumps into its catch() block to trigger the static FALLBACK_DATA array.
        if (satellites.length === 0 && rejectedCount > 0) {
            throw new Error(`Satellite initialization failed entirely. All ${rejectedCount} network groups rejected.`);
        }

        return satellites;
    }

    cleanupCache() {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key?.startsWith("sat_cache_")) continue;

            try {
                const item = JSON.parse(localStorage.getItem(key));
                if (!item?.timestamp || Date.now() - item.timestamp > this.CACHE_TTL * 2) {
                    localStorage.removeItem(key);
                }
            } catch {
                localStorage.removeItem(key);
            }
        }
    }
}