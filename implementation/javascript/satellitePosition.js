import * as satellite from 'satellite.js';

export function calculatePosition(tle1, tle2) {
    try {
        const satrec = satellite.twoline2satrec(tle1, tle2);
        const now = new Date();

        const state = satellite.propagate(satrec, now);
        if (!state || !state.position) return null;

        const gmst = satellite.gstime(now);
        const geodetic = satellite.eciToGeodetic(state.position, gmst);

        return {
            latitude: satellite.degreesLat(geodetic.latitude),
            longitude: satellite.degreesLong(geodetic.longitude),
            altitude: geodetic.height
        };

    } catch (e) {
        console.error("Satellite position error:", e);
        return null;
    }
}