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
            const parsedData = cached.data.map(item => ({
                OBJECT_NAME: item[0],
                NORAD_CAT_ID: item[1],
                TLE_LINE1: item[2],
                TLE_LINE2: item[3]
            }));

            if (expired) {
                return { data: parsedData, expired: true };
            }

            return { data: parsedData, expired: false };
        } catch {
            return null;
        }
    }

    saveToCache(group, data) {
        try {
            const minimized = data.map(s => [
                s.OBJECT_NAME, 
                s.NORAD_CAT_ID, 
                s.TLE_LINE1, 
                s.TLE_LINE2
            ]);

            localStorage.setItem(
                this.getCacheKey(group),
                JSON.stringify({ timestamp: Date.now(), data: minimized })
            );
        } catch {
            console.warn("⚠️ Cache storage full, skipping:", group);
        }
    }

    async fetchWithTimeout(url, timeout = 25000) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);
        try {
            const res = await fetch(url, { signal: controller.signal });
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
            let response = await this.fetchWithTimeout(url);
            
            if (!response.ok || response.status === 502 || response.status === 504) {
                try {
                    const directUrl = `https://celestrak.org/NORAD/elements/gp.php?GROUP=${source.group}&FORMAT=tle`;
                    const directResponse = await this.fetchWithTimeout(directUrl);
                    if (directResponse.ok) {
                        response = directResponse;
                    }
                } catch (directErr) {
                    console.warn("Direct CelesTrak fallback route failed:", directErr);
                }
            }

            if (response.status === 403) {
                console.warn(`⏱ CelesTrak rate-limited ${source.group}. Trying cache fallback...`);
                if (cacheResult?.data) return cacheResult.data;
                throw new Error(`403 (no cache): ${source.group}`);
            }

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errText}`);
            }

            const text = await response.text();
            const bulkText = text.trim();
            const parsedData = [];
            const tleRegex = /^([^\r\n]+)\r?\n(1\s[\s\S]{68})\r?\n(2\s[\s\S]{68})/gm;
            let match;

            while ((match = tleRegex.exec(bulkText)) !== null) {
                const objectName = match[1].trim();
                const line1 = match[2].trim();
                const line2 = match[3].trim();
                const noradCatId = line1.substring(2, 7).trim();

                parsedData.push({
                    OBJECT_NAME: objectName,
                    NORAD_CAT_ID: noradCatId,
                    TLE_LINE1: line1,
                    TLE_LINE2: line2
                });
            }

            this.saveToCache(source.group, parsedData);
            return parsedData;

        } catch (error) {
            console.warn(`⚠️ Network fetch failed for "${source.group}". Checking cache fallback...`, error);
            if (cacheResult?.data) {
                console.log(`♻️ Recovered expired cache for: ${source.group}`);
                return cacheResult.data;
            }
            throw error;
        }
    }

    classifyByName(name, groupType) {
        const n = name.toUpperCase();

        if (/\bDEB\b/.test(n) || /\bFRAGMENT\b/.test(n) || /\bDEBRIS\b/.test(n) || 
            /\bR\/B\b/.test(n) || /\bRKT\b/.test(n) || /\bBOOSTER\b/.test(n)) {
            return 'debris';
        }
        if (/\bPLATFORM\b/.test(n) && groupType === 'station') return 'debris';
        if (/^OBJECT [A-Z0-9]+$/.test(n)) return 'debris';

        if (/^ISS\s*\(/.test(n) && !/^ISS\s*\(ZARYA\)/.test(n)) {
            if (/OBJECT|DEB|FRAG|ADAPTER|MOUNT|BRACKET/.test(n)) return 'debris';
        }

        if (/\bISS\b/.test(n) && !/DEB|FRAG|OBJECT/.test(n)) return 'station';
        if (/TIANGONG/.test(n) || /CSS\b/.test(n) || /TIANHE/.test(n)) return 'station';
        if (/MIR\b/.test(n) && !/DEB/.test(n)) return 'station';

        if (/^STARLINK/.test(n) || /^ONEWEB/.test(n) || /^IRIDIUM/.test(n) || 
            /^INTELSAT/.test(n) || /^SES-/.test(n) || /^TELESAT/.test(n)) {
            return 'communication';
        }

        if (/^GPS/.test(n) || /^GLONASS/.test(n) || /^GALILEO/.test(n) || 
            /^BEIDOU/.test(n) || /^NAVSTAR/.test(n)) {
            return 'navigation';
        }

        return groupType;
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
            if (result.status !== 'fulfilled') {
                console.warn('❌ Failed group:', result.reason);
                rejectedCount++;
                return;
            }

            const { source, data } = result.value;
            if (!Array.isArray(data)) return;

            data.forEach(sat => {
                const noradId = sat.NORAD_CAT_ID ? String(sat.NORAD_CAT_ID) : null;
                if (!noradId || seenIds.has(noradId)) return;
                const type = this.classifyByName(sat.OBJECT_NAME, source.type);

                satellites.push({
                    name: sat.OBJECT_NAME,
                    noradId,
                    tle1: sat.TLE_LINE1,
                    tle2: sat.TLE_LINE2,
                    type,
                });

                seenIds.add(noradId);
            });
        });

        if (satellites.length === 0 && rejectedCount > 0) {
            throw new Error(`All ${rejectedCount} network groups rejected.`);
        }

        return satellites;
    }

    cleanupCache() {
        const keysToRemove = [];

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key?.startsWith('sat_cache_')) continue;
            
            try {
                const item = JSON.parse(localStorage.getItem(key));
                if (!item?.timestamp || Date.now() - item.timestamp > this.CACHE_TTL * 2) {
                    keysToRemove.push(key);
                }
            } catch {
                keysToRemove.push(key);
            }
        }

        keysToRemove.forEach(key => localStorage.removeItem(key));
    }
}