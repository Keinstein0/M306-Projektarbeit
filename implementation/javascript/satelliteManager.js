import { Satellite } from './satellite.js';

export class SatelliteManager {
    constructor(earthMesh) {
        this.earthMesh = earthMesh;
        this.satellites = [];
        this.searchQuery = '';
        this.activeFilter = 'all';
    }

    load(data) {
        if (!Array.isArray(data)) {
            console.error("Satellite data is invalid or missing.");
            return;
        }

        this.clear();

        data.forEach(item => {
            if (!item?.tle1 || !item?.tle2) return;

            let satellite;
            try {
                satellite = new Satellite(item);
            } catch (err) {
                console.warn("Satellite creation failed:", item, err);
                return;
            }

            if (!satellite?.sprite || !satellite?.trailLine) return;

            this.earthMesh.add(satellite.sprite);
            this.earthMesh.add(satellite.trailLine);
            this.satellites.push(satellite);
        });

        this.applyFilters();
    }

    clear() {
        this.satellites.forEach(satellite => {
            if (satellite.sprite) {
                this.earthMesh.remove(satellite.sprite);
                satellite.sprite.material?.map?.dispose?.();
                satellite.sprite.material?.dispose?.();
            }
            if (satellite.trailLine) {
                this.earthMesh.remove(satellite.trailLine);
                satellite.trailLine.geometry?.dispose?.();
                satellite.trailLine.material?.dispose?.();
            }
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
            const matchesSearch =
                satellite.data.name.toLowerCase().includes(this.searchQuery);

            const matchesFilter =
                this.activeFilter === 'all' ||
                satellite.data.type === this.activeFilter;

            const visible = matchesSearch && matchesFilter;

            satellite.sprite.visible = visible;
            satellite.trailLine.visible = visible;
        });
    }

    update() {
        this.satellites.forEach(satellite => {
            // Decoupled update tracking so positions are initialized background-wide
            satellite.updatePosition();
        });
    }

    getVisibleCount() {
        return this.satellites.filter(s => s.sprite?.visible).length;
    }
}