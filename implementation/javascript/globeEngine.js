import * as THREE from 'three';
import { SmoothCamera } from './camera.js';
import { createAtmosphere } from './atmosphere.js';
import { SatelliteManager } from './satelliteManager.js';
import { latLonToVector3 } from './coords.js';

export class GlobeEngine {
    constructor(container) {
        this.container = container;
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        container.appendChild(this.renderer.domElement);

        this.cameraController = new SmoothCamera(this.camera, this.renderer.domElement);
        this.rotationSpeed = 0.0008;

        this.createEarth();
        this.createAtmosphere();
        this.addLight();

        this.createMarker(0, 0);

        this.satelliteManager = new SatelliteManager(this.earth);
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.selectedSatellite = null;
        this.isFollowing = false;

        window.addEventListener('resize', () => this.onWindowResize());
        this.renderer.domElement.addEventListener('click', (e) => this.onClick(e));
        this.animate();
    }

    createEarth() {
        const geometry = new THREE.SphereGeometry(1, 64, 64);

        const textureLoader = new THREE.TextureLoader();
        const earthTexture = textureLoader.load(
            'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_atmos_2048.jpg'
        );

        const material = new THREE.MeshPhongMaterial({
            map: earthTexture,
            shininess: 15
        });

        this.earth = new THREE.Mesh(geometry, material);
        this.earth.rotation.y = Math.PI;

        this.scene.add(this.earth);
    }

    createMarker(lat, lon) {
        const marker = new THREE.Mesh(
            new THREE.SphereGeometry(0.015, 16, 16),
            new THREE.MeshBasicMaterial({ color: 0xff0000 })
        );
        marker.position.copy(latLonToVector3(lat, lon, 50));
        this.earth.add(marker);
    }

    createAtmosphere() {
        this.atmosphereMesh = createAtmosphere(1.02);
        this.scene.add(this.atmosphereMesh);
    }

    addLight() {
        this.scene.add(new THREE.AmbientLight(0xffffff, 0.4));
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(5, 3, 5);
        this.scene.add(dirLight);
    }

    loadSatellites(satellitesData) {
        this.satelliteManager.load(satellitesData);
    }

    onClick(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const sprites = this.satelliteManager.satellites
            .filter(s => s?.sprite && s.sprite.visible)
            .map(s => s.sprite);
        const intersections = this.raycaster.intersectObjects(sprites);

        if (intersections.length === 0) return;
        this.selectSatellite(intersections[0].object.userData.satellite);
    }

    selectSatellite(satellite) {
        this.selectedSatellite = satellite;
        this.updateInfoPanel();
    }

    updateInfoPanel() {
        if (!this.selectedSatellite) return;
        const content = document.getElementById('infoContent');
        if (content) {
            content.innerHTML = `
                <p><strong>Name:</strong> ${this.selectedSatellite.data.name}</p>
                <p><strong>Type:</strong> ${this.selectedSatellite.data.type.toUpperCase()}</p>
                <p><strong>NORAD ID:</strong> ${this.selectedSatellite.data.noradId}</p>
                <p><strong>Latitude:</strong> ${this.selectedSatellite.position.latitude.toFixed(2)}°</p>
                <p><strong>Longitude:</strong> ${this.selectedSatellite.position.longitude.toFixed(2)}°</p>
                <p><strong>Altitude:</strong> ${this.selectedSatellite.position.altitude.toFixed(0)} km</p>
            `;
        }
    }

    toggleFollow() {
        if (!this.selectedSatellite) return;
        this.isFollowing = !this.isFollowing;
        const btn = document.getElementById('followBtn');
        if (btn) {
            btn.textContent = this.isFollowing ? 'Unfollow Satellite' : 'Follow Selected Satellite';
        }
        if (!this.isFollowing) this.cameraController.target.set(0, 0, 0);
    }

    goToPosition(lat, lon) {
        const phi = (90 - lat) * (Math.PI / 180);
        const theta = (lon) * (Math.PI / 180);

        if (this.isFollowing) this.toggleFollow();

        this.cameraController.rotationX = phi - Math.PI / 2;
        this.cameraController.rotationY = -theta;
    }

    onWindowResize() {
        this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        this.earth.rotation.y += this.rotationSpeed;
        this.satelliteManager.update(this.earth.rotation.y);

        if (this.selectedSatellite) {
            this.updateInfoPanel();

            if (this.isFollowing && this.selectedSatellite.mesh) {
                const worldPosition = new THREE.Vector3();
                this.selectedSatellite.mesh.getWorldPosition(worldPosition);
                this.cameraController.target.copy(worldPosition);
            }
        }

        this.cameraController.update();
        this.renderer.render(this.scene, this.camera);
    }
}