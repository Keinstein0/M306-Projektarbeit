import { GlobeEngine } from './globeEngine.js';

const container = document.getElementById('app');

const engine = new GlobeEngine(container);

window.toggleRotation = () => {
    engine.earth.rotationSpeed = engine.earth.rotationSpeed ? 0 : 0.0008;
};

window.resetView = () => {
    engine.cameraController.rotationX = 0;
    engine.cameraController.rotationY = 0;
    engine.cameraController.radius = 2.5;
};

document.getElementById('goBtn').onclick = () => {
    const lat = parseFloat(document.getElementById('lat').value);
    const lon = parseFloat(document.getElementById('lon').value);

    if (isNaN(lat) || isNaN(lon)) return;

    const phi = (90 - lat) * Math.PI / 180;
    const theta = (lon + 180) * Math.PI / 180;

    engine.cameraController.rotationY = theta;
    engine.cameraController.rotationX = (Math.PI / 2 - phi);
};