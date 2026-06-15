import * as THREE from 'three';

export class SmoothCamera {
    constructor(camera, dom) {
        this.camera = camera;
        this.dom    = dom;

        this.target    = new THREE.Vector3(0, 0, 0);
        this._smoothTarget = new THREE.Vector3(0, 0, 0);

        this.radius    = 2.5;
        this.rotationX = 0;
        this.rotationY = 0;

        this.isDragging = false;
        this._prev = { x: 0, y: 0 };

        this._velX = 0;
        this._velY = 0;
        this._friction = 0.88;

        this._init();
    }

    _init() {
        // Mouse drag
        this.dom.addEventListener('mousedown', e => {
            this.isDragging = true;
            this._prev = { x: e.clientX, y: e.clientY };
            this._velX = 0;
            this._velY = 0;
        });

        window.addEventListener('mouseup',    () => this.isDragging = false);
        window.addEventListener('mouseleave', () => this.isDragging = false);

        window.addEventListener('mousemove', e => {
            if (!this.isDragging) return;

            const dx = e.clientX - this._prev.x;
            const dy = e.clientY - this._prev.y;

            this._velY = -dx * 0.005;
            this._velX =  dy * 0.005;

            this.rotationY += this._velY;
            this.rotationX += this._velX;
            this.rotationX = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.rotationX));

            this._prev = { x: e.clientX, y: e.clientY };
        });

        // Touch drag
        this.dom.addEventListener('touchstart', e => {
            if (e.touches.length !== 1) return;
            this.isDragging = true;
            this._prev = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            this._velX = 0;
            this._velY = 0;
        }, { passive: true });

        window.addEventListener('touchend', () => this.isDragging = false, { passive: true });

        window.addEventListener('touchmove', e => {
            if (!this.isDragging || e.touches.length !== 1) return;
            const dx = e.touches[0].clientX - this._prev.x;
            const dy = e.touches[0].clientY - this._prev.y;

            this._velY = -dx * 0.005;
            this._velX =  dy * 0.005;

            this.rotationY += this._velY;
            this.rotationX += this._velX;
            this.rotationX = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.rotationX));

            this._prev = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }, { passive: true });

        // Zoom
        this.dom.addEventListener('wheel', e => {
            this.radius += e.deltaY * 0.001;
            this.radius = Math.max(1.15, Math.min(8.0, this.radius));
        }, { passive: true });
    }

    update() {
        if (!this.isDragging) {
            this.rotationY += this._velY;
            this.rotationX += this._velX;
            this.rotationX = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.rotationX));
            this._velX *= this._friction;
            this._velY *= this._friction;
        }

        this._smoothTarget.lerp(this.target, 0.1);

        const x = this._smoothTarget.x + this.radius * Math.cos(this.rotationX) * Math.sin(this.rotationY);
        const y = this._smoothTarget.y + this.radius * Math.sin(this.rotationX);
        const z = this._smoothTarget.z + this.radius * Math.cos(this.rotationX) * Math.cos(this.rotationY);

        this.camera.position.set(x, y, z);
        this.camera.lookAt(this._smoothTarget);
    }
}
