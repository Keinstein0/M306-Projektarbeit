function fetchWithTimeout(url, options = {}, timeout = 25000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    return fetch(url, {
        ...options,
        signal: controller.signal
    })
        .then(res => {
            clearTimeout(timer);
            return res;
        })
        .catch(err => {
            clearTimeout(timer);
            throw err;
        });
}

const headers = {
    "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "text/plain",
    "Referer": "https://celestrak.org/"
};

async function fetchGroup(source) {
    const url = `https://celestrak.org/NORAD/elements/gp.php?GROUP=${source.group}&FORMAT=tle`;

    const response = await fetchWithTimeout(url, { headers }, 25000);

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    return response.text();
}

async function runWithConcurrency(items, limit, worker) {
    const results = [];
    const executing = new Set();

    for (const item of items) {
        const p = Promise.resolve().then(() => worker(item));
        results.push(p);
        executing.add(p);

        const cleanup = () => executing.delete(p);
        p.then(cleanup).catch(cleanup);

        if (executing.size >= limit) {
            await Promise.race(executing);
        }
    }

    return Promise.allSettled(results);
}

export async function fetchActiveSatellites() {
    const groups = [
        { group: "stations", type: "station" },
        { group: "starlink", type: "communication" },
        { group: "oneweb", type: "communication" },
        { group: "iridium", type: "communication" },
        { group: "gps-ops", type: "navigation" },
        { group: "glo-ops", type: "navigation" },
        { group: "galileo", type: "navigation" },
        { group: "weather", type: "weather" },
        { group: "resource", type: "observation" },
        { group: "planet", type: "observation" },
        { group: "science", type: "science" }
    ];

    const satellites = [];
    const seenIds = new Set();
    const results = await runWithConcurrency(groups, 3, fetchGroup);

    results.forEach((result, index) => {
        const source = groups[index];

        if (result.status !== "fulfilled") {
            if (result.reason?.name === "AbortError") {
                console.warn(`⏱ Timeout group: ${source.group}`);
            } else {
                console.error(`❌ Failed group: ${source.group}`, result.reason);
            }
            return;
        }

        const text = result.value;

        const lines = text
            .split(/\r?\n/)
            .map(l => l.trim())
            .filter(Boolean);

        for (let i = 0; i < lines.length; i += 3) {
            if (i + 2 >= lines.length) break;

            const name = lines[i];
            const tle1 = lines[i + 1];
            const tle2 = lines[i + 2];

            const noradId = tle1?.slice(2, 7)?.trim();

            if (!noradId || seenIds.has(noradId)) continue;

            satellites.push({
                name,
                noradId,
                tle1,
                tle2,
                type: /USA-|COSMOS|NROL|OFEQ|MIGAL|YAOGAN/i.test(name)
                    ? "military"
                    : source.type ?? "observation"
            });

            seenIds.add(noradId);
        }
    });

    return satellites;
}