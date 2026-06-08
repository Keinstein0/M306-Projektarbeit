import { Satellite } from './satellite.js';

export class SatelliteManager {
    constructor(earthMesh) {
        this.earthMesh = earthMesh;
        this.satellites = [];
        this.searchQuery = '';
        this.activeFilter = 'all';
    }

    load(data) {
        if (!data || !Array.isArray(data)) {
            console.error("Satellite data is invalid or missing.");
            return;
        }
        this.clear();
        data.forEach(item => {
            const satellite = new Satellite(item);
            if (this.earthMesh) {
                this.earthMesh.add(satellite.mesh);
                this.earthMesh.add(satellite.trail);
                this.satellites.push(satellite);
            }
        });
        this.applyFilters();
    }

    clear() {
        this.satellites.forEach(satellite => {
            this.earthMesh.remove(satellite.mesh);
            this.earthMesh.remove(satellite.trail);
        });
        this.satellites = [];
    }

    setSearchQuery(query) {
        this.searchQuery = query.toLowerCase();
        this.applyFilters();
    }

    setFilter(type) {
        this.activeFilter = type;
        this.applyFilters();
    }

    applyFilters() {
        this.satellites.forEach(satellite => {
            const matchesSearch = satellite.data.name.toLowerCase().includes(this.searchQuery);
            const matchesFilter = this.activeFilter === 'all' || satellite.data.type === this.activeFilter;
            const visible = matchesSearch && matchesFilter;

            satellite.mesh.visible = visible;
            satellite.trail.visible = visible;
        });
    }

    update() {
        this.satellites.forEach(satellite => {
            if (satellite.mesh && satellite.mesh.visible) {
                satellite.updatePosition();
            }
        });
    }

    getVisibleCount() {
        return this.satellites.filter(satellite => satellite.mesh.visible).length;
    }
}