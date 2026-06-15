import * as THREE from 'three';

const EARTH_RADIUS_KM = 6371;
const EARTH_RENDER_RADIUS = 1;

export function latLonToVector3(lat, lon, altitudeKm = 0) {
    const radius = EARTH_RENDER_RADIUS + (altitudeKm / EARTH_RADIUS_KM);
    const phi = THREE.MathUtils.degToRad(90 - lat);
    const theta = THREE.MathUtils.degToRad(lon + 180);
    const x = -radius * Math.sin(phi) * Math.cos(theta);
    const y =  radius * Math.cos(phi);
    const z =  radius * Math.sin(phi) * Math.sin(theta);

    return new THREE.Vector3(x, y, z);
}