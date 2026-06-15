import { GlobeEngine } from './globeEngine.js';
import { SatelliteService } from './SatelliteService.js';
import { SATELLITE_GROUPS } from './satelliteGroups.js';
import { FALLBACK_DATA } from './fallbackSatellites.js'; 

const container = document.getElementById('app');
const engine = new GlobeEngine(container);
const infoContentEl = document.getElementById('infoContent');

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
        startTelemetryLoop();

    } catch (criticalError) {
        console.error('❌ Critical error setting up scene layout engine context:', criticalError);
        const countEl = document.getElementById('satelliteCount');
        if (countEl) countEl.textContent = 'Fatal error initializing engine';
    }
}

function startTelemetryLoop() {
    function update() {
        requestAnimationFrame(update);
    
        const selected = engine.selectedSatellite || engine.satelliteManager?.selectedSatellite;
        
        if (selected && infoContentEl) {
            infoContentEl.innerHTML = `
                <p>${selected.data.name || 'Unknown Object'}</p>
                <p><strong>NORAD ID</strong> <span>#${selected.data.noradId || 'N/A'}</span></p>
                <p><strong>Latitude</strong> <span>${selected.position.latitude.toFixed(4)}°</span></p>
                <p><strong>Longitude</strong> <span>${selected.position.longitude.toFixed(4)}°</span></p>
                <p><strong>Altitude</strong> <span>${selected.position.altitude.toFixed(1)} km</span></p>
                <p><strong>Velocity</strong> <span>${Math.round(selected.speedKmh).toLocaleString()} km/h</span></p>
                <p><strong>Operator</strong> <span>${selected.countryName || 'International'}</span></p>
                <p><strong>Propulsion</strong> <span>${selected.propulsion || 'Standard'}</span></p>
            `;
        } else if (infoContentEl && !infoContentEl.querySelector('.placeholder-text')) {
            infoContentEl.innerHTML = `<p class="placeholder-text">Select an active orbital track to acquire localized subsystem telemetry.</p>`;
        }
    }
    update();
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

document.getElementById('satelliteCountry').onchange = (e) => {
    if (typeof engine.satelliteManager.setCountryFilter === 'function') {
        engine.satelliteManager.setCountryFilter(e.target.value);
    } else if (typeof engine.satelliteManager.setCountry === 'function') {
        engine.satelliteManager.setCountry(e.target.value);
    }
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