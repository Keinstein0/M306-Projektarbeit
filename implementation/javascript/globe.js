import { GlobeEngine } from './globeEngine.js';
import { fetchActiveSatellites } from './satelliteService.js';

const container = document.getElementById('app');
const engine = new GlobeEngine(container);

function updateSatelliteCount() {
    const manager = engine.satelliteManager;
    const countEl = document.getElementById('satelliteCount');
    if (countEl) {
        countEl.textContent = `Satellites Loaded: ${manager.getVisibleCount()} / ${manager.satellites.length}`;
    }
}

async function init() {
    try {
        const satellites = await fetchActiveSatellites();
        engine.loadSatellites(satellites);
        updateSatelliteCount();
    } catch (error) {
        console.error('Satellite loading failed', error);
        const countEl = document.getElementById('satelliteCount');
        if (countEl) countEl.textContent = 'Failed to load satellites';
    }
}

init();

document.getElementById('satelliteSearch').oninput = (e) => {
    engine.satelliteManager.setSearchQuery(e.target.value);
    updateSatelliteCount();
};

document.getElementById('satelliteFilter').onchange = (e) => {
    engine.satelliteManager.setFilter(e.target.value);
    updateSatelliteCount();
};

document.getElementById('followBtn').onclick = () => {
    engine.toggleFollow();
};

window.toggleRotation = () => {
    engine.rotationSpeed = engine.rotationSpeed === 0 ? 0.0008 : 0;
};

window.resetView = () => {
    engine.cameraController.rotationX = 0;
    engine.cameraController.rotationY = 0;
    engine.cameraController.radius = 2.5;
    if (engine.isFollowing) engine.toggleFollow();
};

document.getElementById('goBtn').onclick = () => {
    const lat = parseFloat(document.getElementById('lat').value);
    const lon = parseFloat(document.getElementById('lon').value);

    if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
        engine.goToPosition(lat, lon);
    }
};