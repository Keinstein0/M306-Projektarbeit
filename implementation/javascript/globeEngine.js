import * as THREE from 'three';
import { SmoothCamera } from './camera.js';
import { createAtmosphere } from './atmosphere.js';
import { SatelliteManager } from './satelliteManager.js';
import { latLonToVector3 } from './coords.js';

const INFO_PANEL_INTERVAL = 500;

export class GlobeEngine {
    constructor(container) {
        this.container = container;

        this.scene    = new THREE.Scene();
        this.camera   = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        container.appendChild(this.renderer.domElement);

        this.cameraController = new SmoothCamera(this.camera, this.renderer.domElement);
        this.rotationSpeed = 0.0008;

        this.createEarth();
        this.createAtmosphere();
        this.addLight();
        
        this._marker = this._buildMarker();
        this.earth.add(this._marker);
        this._marker.visible = false;

        this.satelliteManager = new SatelliteManager(this.earth);
        this.raycaster  = new THREE.Raycaster();
        this.mouse      = new THREE.Vector2();
        this.selectedSatellite = null;
        this.isFollowing = false;

        this._lastInfoUpdate = 0;

        window.addEventListener('resize', () => this._onWindowResize());
        this.renderer.domElement.addEventListener('click', (e) => this._onClick(e));

        this._animate();
    }

    createEarth() {
        const geometry = new THREE.SphereGeometry(1, 64, 64);
        const loader   = new THREE.TextureLoader();
        const texture  = loader.load(
            'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_atmos_2048.jpg'
        );

        this.earth = new THREE.Mesh(geometry, new THREE.MeshPhongMaterial({
            map: texture,
            shininess: 15,
        }));
        this.scene.add(this.earth);
    }

    createAtmosphere() {
        this.atmosphereMesh = createAtmosphere(1.02);
        this.scene.add(this.atmosphereMesh);
    }

    addLight() {
        this.scene.add(new THREE.AmbientLight(0xffffff, 0.4));
        const dir = new THREE.DirectionalLight(0xffffff, 0.8);
        dir.position.set(5, 3, 5);
        this.scene.add(dir);
    }

    _buildMarker() {
        const group = new THREE.Group();
        
        const ringGeo = new THREE.TorusGeometry(0.022, 0.004, 8, 32);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0x00ffaa, transparent: true, opacity: 0.9 });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2;
        group.add(ring);

        const dotGeo = new THREE.SphereGeometry(0.007, 12, 12);
        const dotMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        group.add(new THREE.Mesh(dotGeo, dotMat));

        const spikeGeo = new THREE.CylinderGeometry(0.002, 0.000, 0.06, 6);
        const spikeMat = new THREE.MeshBasicMaterial({ color: 0x00ffaa, transparent: true, opacity: 0.7 });
        const spike    = new THREE.Mesh(spikeGeo, spikeMat);
        spike.position.y = 0.03;
        group.add(spike);

        const haloGeo = new THREE.SphereGeometry(0.045, 12, 12);
        const haloMat = new THREE.MeshBasicMaterial({
            color: 0x00ffaa,
            transparent: true,
            opacity: 0.08,
            depthWrite: false,
        });
        this._markerHalo = new THREE.Mesh(haloGeo, haloMat);
        group.add(this._markerHalo);

        return group;
    }

    _placeMarker(lat, lon) {
        const pos = latLonToVector3(lat, lon, 0);
        this._marker.position.copy(pos);
        
        const normal = pos.clone().normalize();
        this._marker.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
        this._marker.visible = true;
    }

    goToPosition(lat, lon) {
        if (this.isFollowing) this.toggleFollow();

        const targetWorldPos = latLonToVector3(lat, lon, 0);
        targetWorldPos.applyMatrix4(this.earth.matrixWorld);

        const localTarget = targetWorldPos.clone().normalize();
        
        this.cameraController.rotationX = Math.asin(localTarget.y);
        this.cameraController.rotationY = Math.atan2(localTarget.x, localTarget.z);

        this._placeMarker(lat, lon);
    }

    _onClick(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left)  / rect.width)  * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);

        const sprites = this.satelliteManager.satellites
            .filter(s => s?.sprite?.visible)
            .map(s => s.sprite);

        const hits = this.raycaster.intersectObjects(sprites);
        if (hits.length === 0) return;

        this.selectSatellite(hits[0].object.userData.satellite);
    }

    selectSatellite(satellite) {
        this.selectedSatellite = satellite;
        this._lastInfoUpdate = 0;
        this._updateInfoPanel();
    }

    _updateInfoPanel() {
        if (!this.selectedSatellite) return;

        const content = document.getElementById('infoContent');
        if (!content) return;

        const { name, type, noradId } = this.selectedSatellite.data;
        const { latitude, longitude, altitude } = this.selectedSatellite.position;

        content.innerHTML = `
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Type:</strong> ${type.toUpperCase()}</p>
            <p><strong>NORAD ID:</strong> ${noradId}</p>
            <p><strong>Latitude:</strong> ${latitude.toFixed(2)}°</p>
            <p><strong>Longitude:</strong> ${longitude.toFixed(2)}°</p>
            <p><strong>Altitude:</strong> ${altitude.toFixed(0)} km</p>
        `;
    }

    toggleFollow() {
        if (!this.selectedSatellite) return;
        this.isFollowing = !this.isFollowing;

        const btn = document.getElementById('followBtn');
        if (btn) btn.textContent = this.isFollowing ? 'Unfollow Satellite' : 'Follow Selected Satellite';

        if (!this.isFollowing) this.cameraController.target.set(0, 0, 0);
    }

    _onWindowResize() {
        this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    }

    _animate() {
        requestAnimationFrame(() => this._animate());

        const nowMs = performance.now();

        this.earth.rotation.y += this.rotationSpeed;

        this.satelliteManager.update(this.earth.rotation.y);

        if (this.isFollowing && this.selectedSatellite?.mesh) {
            const wp = new THREE.Vector3();
            this.selectedSatellite.mesh.getWorldPosition(wp);
            this.cameraController.target.copy(wp);
        }

        if (this._markerHalo && this._marker.visible) {
            const pulse = 0.5 + 0.5 * Math.sin(nowMs * 0.003);
            this._markerHalo.material.opacity = pulse * 0.15;
            const s = 1 + pulse * 0.3;
            this._markerHalo.scale.setScalar(s);
        }

        if (this.selectedSatellite && nowMs - this._lastInfoUpdate > INFO_PANEL_INTERVAL) {
            this._updateInfoPanel();
            this._lastInfoUpdate = nowMs;
        }

        this.cameraController.update();
        this.renderer.render(this.scene, this.camera);
    }
}