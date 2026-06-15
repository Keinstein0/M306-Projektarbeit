import * as THREE from 'three';
import * as satellitePkg from 'satellite.js';
import { latLonToVector3 } from './coords.js';
import { TYPE_ICONS, TYPE_COLORS } from './satelliteTypes.js';

const textureCache = new Map();
const textureLoader = new THREE.TextureLoader();

function getCachedTexture(url) {
    if (!textureCache.has(url)) {
        textureCache.set(url, textureLoader.load(url));
    }
    return textureCache.get(url);
}

const TRAIL_MINUTES = 15;
const TRAIL_SEGMENTS = 30;
const TRAIL_UPDATE_INTERVAL = 4000;

function getSatelliteMetadata(name, type) {
    const upperName = name.toUpperCase();
    let countryCode = "OTHER";
    let countryName = "International / Other";
    let propulsion = "Chemical Monopropellant";

    if (upperName.includes("STARLINK") || upperName.includes("GPS") || upperName.includes("NOAA") || upperName.includes("GOES")) {
        countryCode = "US";
        countryName = "United States";
        propulsion = upperName.includes("STARLINK") ? "Hall-Effect Ion Thruster (Argon/Krypton)" : "Hydrazine Thruster";
    } else if (upperName.includes("GLONASS") || upperName.includes("COSMOS") || upperName.includes("SOYUZ")) {
        countryCode = "RU";
        countryName = "Russia";
        propulsion = "Liquid Hydrazine Rocket Engine";
    } else if (upperName.includes("GALILEO") || upperName.includes("SENTINEL") || upperName.includes("METOP") || upperName.includes("ERS")) {
        countryCode = "EU";
        countryName = "Europe (ESA)";
        propulsion = "Hydrazine / Nitrogen Cold Gas";
    } else if (upperName.includes("BEIDOU") || upperName.includes("TIANGONG") || upperName.includes("YAOGAN") || upperName.includes("SHIYAN")) {
        countryCode = "CN";
        countryName = "China (CNSA)";
        propulsion = "High-Efficiency Ion Drive / Hydrazine";
    } else if (upperName.includes("INSAT") || upperName.includes("GSAT") || upperName.includes("CARTOSAT") || upperName.includes("IRNSS")) {
        countryCode = "IN";
        countryName = "India (ISRO)";
        propulsion = "Bipropellant Unified Liquid Engine";
    } else if (upperName.includes("ISS") || upperName.includes("ZARYA")) {
        countryCode = "all";
        countryName = "International Space Station";
        propulsion = "Integrated Progress/Zvezda Liquid Control Systems";
    }

    return { countryCode, countryName, propulsion };
}

export class Satellite {
    constructor(data) {
        this.data = data;

        if (!data?.tle1 || !data?.tle2) {
            throw new Error('Invalid TLE data');
        }

        try {
            this.satrec = satellitePkg.twoline2satrec(data.tle1, data.tle2);
        } catch (e) {
            console.error('Failed to parse TLE:', e);
            throw e;
        }

        this.position = { latitude: 0, longitude: 0, altitude: 0 };
        this.speedKmh = 0;
        this._lastTrailUpdate = 0;

        const meta = getSatelliteMetadata(this.data.name || '', this.data.type || '');
        this.countryCode = meta.countryCode;
        this.countryName = meta.countryName;
        this.propulsion = meta.propulsion;

        const iconUrl = TYPE_ICONS[data.type] ?? TYPE_ICONS.station;
        const spriteTexture = getCachedTexture(iconUrl);

        this.sprite = new THREE.Sprite(
            new THREE.SpriteMaterial({
                map: spriteTexture,
                transparent: true,
                depthWrite: false
            })
        );
        this.sprite.scale.set(0.025, 0.025, 1);
        this.sprite.userData = { satellite: this };
        this.mesh = this.sprite;

        // Orbit-Schweif (Trail)
        const trailColor = TYPE_COLORS[data.type] ?? 0x38bdf8;
        const trailMaterial = new THREE.LineBasicMaterial({
            color: trailColor,
            transparent: true,
            opacity: 0.5,
            blending: THREE.AdditiveBlending
        });
        const trailGeometry = new THREE.BufferGeometry();
        this.trailLine = new THREE.Line(trailGeometry, trailMaterial);

        this.updatePosition(true);
    }

    updatePosition(forceTrail = false) {
        const now = new Date();
        const nowMs = performance.now();

        try {
            const state = satellitePkg.propagate(this.satrec, now);
            if (!state || !state.position || !state.velocity) return;

            const gmst = satellitePkg.gstime(now);
            const geo = satellitePkg.eciToGeodetic(state.position, gmst);

            this.position.latitude = satellitePkg.degreesLat(geo.latitude);
            this.position.longitude = satellitePkg.degreesLong(geo.longitude);
            this.position.altitude = geo.height; 

            const vx = state.velocity.x;
            const vy = state.velocity.y;
            const vz = state.velocity.z;
            const speedKms = Math.sqrt(vx * vx + vy * vy + vz * vz);
            this.speedKmh = speedKms * 3600;

            const vec = latLonToVector3(this.position.latitude, this.position.longitude, this.position.altitude);
            if (vec && isFinite(vec.x) && isFinite(vec.y) && isFinite(vec.z)) {
                this.sprite.position.copy(vec);
            }

        } catch (err) {
            return;
        }

        if (!forceTrail && nowMs - this._lastTrailUpdate < TRAIL_UPDATE_INTERVAL) return;
        this._lastTrailUpdate = nowMs;
        this._rebuildTrail(now);
    }

    _rebuildTrail(now) {
        const nowMs = now.getTime();
        const points = [];

        for (let i = 0; i <= TRAIL_SEGMENTS; i++) {
            const t = new Date(nowMs - (i * (TRAIL_MINUTES / TRAIL_SEGMENTS)) * 60000);
            try {
                const s = satellitePkg.propagate(this.satrec, t);
                if (!s?.position) continue;

                const gmst = satellitePkg.gstime(t);
                const geo = satellitePkg.eciToGeodetic(s.position, gmst);

                const lat = satellitePkg.degreesLat(geo.latitude);
                const lon = satellitePkg.degreesLong(geo.longitude);
                const alt = geo.height;

                if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(alt)) continue;

                const p = latLonToVector3(lat, lon, alt);
                if (p && isFinite(p.x) && isFinite(p.y) && isFinite(p.z)) {
                    points.push(p);
                }
            } catch {}
        }

        points.reverse();

        if (points.length > 1) {
            this.trailLine.geometry.setFromPoints(points);
            this.trailLine.geometry.attributes.position.needsUpdate = true;
        }
    }

    dispose() {
        if (this.trailLine) {
            this.trailLine.geometry.dispose();
            if (Array.isArray(this.trailLine.material)) {
                this.trailLine.material.forEach(m => m.dispose());
            } else {
                this.trailLine.material.dispose();
            }
        }
    }
}