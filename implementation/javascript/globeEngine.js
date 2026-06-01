import * as THREE from 'three';
import { SmoothCamera } from './camera.js';
import { createAtmosphere } from './atmosphere.js';

export class GlobeEngine {
    constructor(container) {
        if (!container) throw new Error("Globe container missing");

        this.container = container;

        this.scene = new THREE.Scene();

        this.camera = new THREE.PerspectiveCamera(
            45,
            container.clientWidth / container.clientHeight,
            0.1,
            100
        );

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        container.appendChild(this.renderer.domElement);

        this.cameraController = new SmoothCamera(this.camera, this.renderer.domElement);

        this.createEarth();
        this.createAtmosphere();
        this.addLight();

        window.addEventListener('resize', () => this.onResize());

        this.animate();
    }

    createEarth() {
        const geo = new THREE.SphereGeometry(1, 64, 64);

        const tex = new THREE.TextureLoader().load('../textures/earth.jpg');

        const mat = new THREE.MeshStandardMaterial({
            map: tex
        });

        this.earth = new THREE.Mesh(geo, mat);
        this.scene.add(this.earth);
    }

    createAtmosphere() {
        const atm = createAtmosphere();
        this.scene.add(atm);
    }

    addLight() {
        const light = new THREE.AmbientLight(0xffffff, 1);
        this.scene.add(light);
    }

    onResize() {
        this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        this.earth.rotation.y += 0.0008;

        this.cameraController.update();

        this.renderer.render(this.scene, this.camera);
    }
}