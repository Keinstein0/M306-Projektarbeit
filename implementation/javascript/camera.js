import * as THREE from 'three';

export class SmoothCamera {
    constructor(camera, dom) {
        this.camera = camera;
        this.dom = dom;

        this.target = new THREE.Vector3(0, 0, 0);
        this.radius = 2.5;

        this.rotationX = 0;
        this.rotationY = 0;

        this.isDragging = false;
        this.prev = { x: 0, y: 0 };

        this.init();
    }

    init() {
        this.dom.addEventListener('mousedown', e => {
            this.isDragging = true;
            this.prev = { x: e.clientX, y: e.clientY };
        });

        window.addEventListener('mouseup', () => this.isDragging = false);

        window.addEventListener('mousemove', e => {
            if (!this.isDragging) return;

            this.rotationY += (e.clientX - this.prev.x) * 0.005;
            this.rotationX += (e.clientY - this.prev.y) * 0.005;

            this.rotationX = Math.max(-1.5, Math.min(1.5, this.rotationX));

            this.prev = { x: e.clientX, y: e.clientY };
        });

        this.dom.addEventListener('wheel', e => {
            this.radius += e.deltaY * 0.001;
            this.radius = Math.max(1.5, Math.min(5, this.radius));
        });
    }

    update() {
        const x = this.radius * Math.cos(this.rotationX) * Math.sin(this.rotationY);
        const y = this.radius * Math.sin(this.rotationX);
        const z = this.radius * Math.cos(this.rotationX) * Math.cos(this.rotationY);

        this.camera.position.set(x, y, z);
        this.camera.lookAt(this.target);
    }
}