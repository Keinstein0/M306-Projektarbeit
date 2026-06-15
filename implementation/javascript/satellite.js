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

const TRAIL_MINUTES = 10;
const TRAIL_SEGMENTS = 20;
const TRAIL_UPDATE_INTERVAL = 5000;

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
        this._lastTrailUpdate = 0;

        const iconUrl = TYPE_ICONS[data.type] ?? TYPE_ICONS.station;
        const spriteTexture = getCachedTexture(iconUrl);

        this.sprite = new THREE.Sprite(
            new THREE.SpriteMaterial({
                map: spriteTexture,
                transparent: true,
                depthTest: true,
                depthWrite: false,
                sizeAttenuation: true,
            })
        );
        this.sprite.scale.set(0.04, 0.04, 1);
        this.sprite.userData.satellite = this;
        this.mesh = this.sprite;

        const trailColor = TYPE_COLORS[data.type] ?? 0x00ffff;
        this.trailGeometry = new THREE.BufferGeometry();
        this.trailLine = new THREE.Line(
            this.trailGeometry,
            new THREE.LineBasicMaterial({
                color: trailColor,
                transparent: true,
                opacity: 0.35,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
            })
        );
        
        this.propagateTLE(true);
        this.updateGeometryPosition();
    }

    propagateTLE(forceTrail = false) {
        const now = new Date();
        const nowMs = now.getTime();

        try {
            const state = satellitePkg.propagate(this.satrec, now);
            if (!state?.position) return;

            const gmst = satellitePkg.gstime(now);
            const geo = satellitePkg.eciToGeodetic(state.position, gmst);

            this.position.latitude  = satellitePkg.degreesLat(geo.latitude);
            this.position.longitude = satellitePkg.degreesLong(geo.longitude);
            this.position.altitude  = geo.height;
        } catch (err) {
            console.error('Position propagation error:', err);
            return;
        }

        if (!forceTrail && nowMs - this._lastTrailUpdate < TRAIL_UPDATE_INTERVAL) return;
        this._lastTrailUpdate = nowMs;
        this._rebuildTrail(now);
    }

    updateGeometryPosition() {
        const worldPos = latLonToVector3(
            this.position.latitude,
            this.position.longitude,
            this.position.altitude
        );

        if (worldPos && isFinite(worldPos.x) && isFinite(worldPos.y) && isFinite(worldPos.z)) {
            this.sprite.position.copy(worldPos);
        }
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
            this.trailGeometry.setFromPoints(points);
        }
    }

    dispose() {
        this.trailGeometry.dispose();
        this.trailLine.material.dispose();
    }
}