import * as THREE from 'three';

export function createAtmosphere(radius = 1.02) {
    const geometry = new THREE.SphereGeometry(radius, 64, 64);

    const material = new THREE.ShaderMaterial({
        transparent: true,
        side: THREE.BackSide,
        uniforms: {},
        vertexShader: `
            varying vec3 vNormal;
            void main() {
                vNormal = normalize(normalMatrix * normal);
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            varying vec3 vNormal;
            void main() {
                float intensity = pow(0.6 - dot(vNormal, vec3(0, 0, 1.0)), 2.0);
                gl_FragColor = vec4(0.4, 0.7, 1.0, 1.0) * intensity;
            }
        `
    });

    return new THREE.Mesh(geometry, material);
}