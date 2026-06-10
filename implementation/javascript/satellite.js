import * as THREE from 'three';
import * as satellitePkg from 'satellite.js';
import { latLonToVector3 } from './coords.js';
import { TYPE_ICONS, TYPE_COLORS } from './satelliteTypes.js';

const textureLoader = new THREE.TextureLoader();

export class Satellite {
    constructor(data) {
        this.data = data;

        if (!data?.tle1 || !data?.tle2) {
            throw new Error("Invalid TLE data");
        }

        // Initialize the satellite record structure using the satellite.js package
        try {
            this.satrec = satellitePkg.twoline2satrec(data.tle1, data.tle2);
        } catch (e) {
            console.error("Failed to parse TLE strings into satrec:", e);
            throw e;
        }

        // Initialize an empty coordinate object so the info panel never reads 'undefined'
        this.position = {
            latitude: 0,
            longitude: 0,
            altitude: 0
        };

        const iconTexture = TYPE_ICONS[data.type] ?? TYPE_ICONS.station;
        const spriteTexture = textureLoader.load(iconTexture);

        this.sprite = new THREE.Sprite(
            new THREE.SpriteMaterial({
                map: spriteTexture,
                transparent: true,
                depthTest: true,
                depthWrite: false
            })
        );

        this.sprite.scale.set(0.04, 0.04, 1);
        this.sprite.userData.satellite = this;

        // Also create an empty tracking mesh reference if globeEngine expects it for raycasting/position tracking
        this.mesh = this.sprite; 

        const trailColor = TYPE_COLORS[data.type] ?? 0x00ffff;

        this.trailGeometry = new THREE.BufferGeometry();
        this.trailLine = new THREE.Line(
            this.trailGeometry,
            new THREE.LineBasicMaterial({
                color: trailColor,
                transparent: true,
                opacity: 0.35,
                blending: THREE.AdditiveBlending
            })
        );

        // Compute the initial positional frames immediately upon creation
        this.updatePosition();
    }

    updatePosition() {
        const now = new Date();

        try {
            const state = satellitePkg.propagate(this.satrec, now);
            if (!state?.position) return;

            const gmst = satellitePkg.gstime(now);
            const geo = satellitePkg.eciToGeodetic(state.position, gmst);

            // Compute exact degrees
            this.position.latitude = satellitePkg.degreesLat(geo.latitude);
            this.position.longitude = satellitePkg.degreesLong(geo.longitude);
            this.position.altitude = geo.height; // in km

            // Translate geographic space coordinates to Three.js world spaces vector coordinates
            const worldPos = latLonToVector3(this.position.latitude, this.position.longitude, this.position.altitude);
            
            if (worldPos && isFinite(worldPos.x) && isFinite(worldPos.y) && isFinite(worldPos.z)) {
                this.sprite.position.copy(worldPos);
            }

            // Dynamically rebuild trail path geometries
            const points = [];
            const duration = 10; // minutes
            const segments = 25;

            for (let i = 0; i <= segments; i++) {
                const t = new Date(now.getTime() - (i * (duration / segments)) * 60000);
                const historicState = satellitePkg.propagate(this.satrec, t);
                if (!historicState?.position) continue;

                const historicGmst = satellitePkg.gstime(t);
                const historicGeo = satellitePkg.eciToGeodetic(historicState.position, historicGmst);

                const lat = satellitePkg.degreesLat(historicGeo.latitude);
                const lon = satellitePkg.degreesLong(historicGeo.longitude);
                const alt = historicGeo.height;

                if (Number.isFinite(lat) && Number.isFinite(lon) && Number.isFinite(alt)) {
                    const p = latLonToVector3(lat, lon, alt);
                    if (p && isFinite(p.x) && isFinite(p.y) && isFinite(p.z)) {
                        points.push(p);
                    }
                }
            }

            points.reverse();

            if (points.length > 0) {
                this.trailGeometry.setFromPoints(points);
            }

        } catch (err) {
            console.error("Error computing position runtime vectors:", err);
        }
    }
}