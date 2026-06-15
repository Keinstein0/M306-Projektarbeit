import { GlobeEngine } from './globeEngine.js';
import { SatelliteService } from './SatelliteService.js';
import { SATELLITE_GROUPS } from './satelliteGroups.js';
import { FALLBACK_DATA } from './fallbackSatellites.js'; 

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
        const service = new SatelliteService({
            ttlMinutes: 30,
            concurrency: 1
        });

        service.cleanupCache();

        let satellites = [];
        
        try {
            console.log("📡 Attempting live satellite sync with CelesTrak API proxy...");
            satellites = await service.fetchActiveSatellites(SATELLITE_GROUPS);
        } catch (apiError) {
            console.warn(
                "⚠️ CelesTrak API connection dropped or timed out. Initiating local emergency fallback configuration.", 
                apiError
            );
            
            satellites = FALLBACK_DATA.map(sat => ({
                name: sat.OBJECT_NAME,
                noradId: sat.NORAD_CAT_ID,
                tle1: sat.TLE_LINE1,
                tle2: sat.TLE_LINE2,
                type: sat.type ?? "station" 
            }));
        }

        engine.satelliteManager.load(satellites);
        updateSatelliteCount();

    } catch (criticalError) {
        console.error('❌ Critical error setting up scene layout engine context:', criticalError);

        const countEl = document.getElementById('satelliteCount');
        if (countEl) countEl.textContent = 'Fatal error initializing engine';
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