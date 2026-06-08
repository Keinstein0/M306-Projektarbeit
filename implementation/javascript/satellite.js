import * as THREE from 'three';
import * as satellitePkg from 'satellite.js';
import { latLonToVector3 } from './coords.js';
import { TYPE_ICONS, TYPE_COLORS } from './satelliteTypes.js';

const textureLoader = new THREE.TextureLoader();

export class Satellite {
    constructor(data) {
        this.data = data;
        const iconTexture = TYPE_ICONS[data.type] ?? TYPE_ICONS.station;

        const spriteTexture = textureLoader.load(iconTexture);

        const spriteMaterial = new THREE.SpriteMaterial({
            map: spriteTexture,
            transparent: true,
            depthTest: true,
            depthWrite: false
        });

        this.sprite = new THREE.Sprite(spriteMaterial);
        this.sprite.scale.set(0.04, 0.04, 1);
        this.sprite.userData.satellite = this;

        const trailColor = TYPE_COLORS[data.type] ?? 0x00ffff;

        const trailMaterial = new THREE.LineBasicMaterial({
            color: trailColor,
            transparent: true,
            opacity: 0.35,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.trailGeometry = new THREE.BufferGeometry();
        this.trailLine = new THREE.Line(this.trailGeometry, trailMaterial);

        this.satrec = satellitePkg.twoline2satrec(
            this.data.tle1,
            this.data.tle2
        );

        this.updatePosition();
        this.generateTrail();
    }

    updatePosition() {
        const now = new Date();

        const state = satellitePkg.propagate(this.satrec, now);
        if (!state.position) return;

        const gmst = satellitePkg.gstime(now);

        const geodetic = satellitePkg.eciToGeodetic(state.position, gmst);

        const latitude = satellitePkg.degreesLat(geodetic.latitude);
        const longitude = satellitePkg.degreesLong(geodetic.longitude);
        const altitude = geodetic.height;

        const worldPos = latLonToVector3(latitude, longitude, altitude);

        this.sprite.position.copy(worldPos);
    }

    generateTrail() {
        try {
            const now = new Date();

            const trailPoints = [];

            const trailDurationMinutes = 10;
            const trailSegments = 25;

            for (let i = 0; i <= trailSegments; i++) {

                const pastTime = new Date(
                    now.getTime() -
                    (i * (trailDurationMinutes / trailSegments)) * 60000
                );

                const state = satellitePkg.propagate(this.satrec, pastTime);
                if (!state.position) continue;

                const gmst = satellitePkg.gstime(pastTime);

                const geodetic = satellitePkg.eciToGeodetic(state.position, gmst);

                const latitude = satellitePkg.degreesLat(geodetic.latitude);
                const longitude = satellitePkg.degreesLong(geodetic.longitude);
                const altitude = geodetic.height;

                trailPoints.push(
                    latLonToVector3(latitude, longitude, altitude)
                );
            }

            trailPoints.reverse();

            this.trailGeometry.dispose();
            this.trailGeometry = new THREE.BufferGeometry();
            this.trailGeometry.setFromPoints(trailPoints);

            this.trailLine.geometry = this.trailGeometry;

        } catch (err) {
            console.error("Trail generation error:", err);
        }
    }
}