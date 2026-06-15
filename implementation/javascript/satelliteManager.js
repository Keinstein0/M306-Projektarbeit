import { Satellite } from './satellite.js';

const BATCH_SIZE = 25; 

export class SatelliteManager {
    constructor(earthMesh) {
        this.earthMesh = earthMesh;
        this.satellites = [];
        this.searchQuery = '';
        this.activeFilter = 'all';
        this._cursor = 0;
    }

    load(data) {
        if (!Array.isArray(data)) {
            console.error('Satellite data is invalid or missing.');
            return;
        }

        this.clear();

        for (const item of data) {
            if (!item?.tle1 || !item?.tle2) continue;

            let sat;
            try {
                sat = new Satellite(item);
            } catch {
                continue;
            }

            if (!sat?.sprite || !sat?.trailLine) continue;

            this.earthMesh.add(sat.sprite);
            this.earthMesh.add(sat.trailLine);
            this.satellites.push(sat);
        }

        this._cursor = 0;
        this.applyFilters();
    }

    clear() {
        for (const sat of this.satellites) {
            if (sat.sprite)    this.earthMesh.remove(sat.sprite);
            if (sat.trailLine) this.earthMesh.remove(sat.trailLine);
            sat.dispose?.();
        }
        this.satellites = [];
        this._cursor = 0;
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
        for (const sat of this.satellites) {
            const matchesSearch = sat.data.name.toLowerCase().includes(this.searchQuery);
            const matchesFilter = this.activeFilter === 'all' || sat.data.type === this.activeFilter;
            const visible = matchesSearch && matchesFilter;

            sat.sprite.visible    = visible;
            sat.trailLine.visible = visible;
        }
    }

    update() {
        const total = this.satellites.length;
        if (total === 0) return;

        const end = Math.min(this._cursor + BATCH_SIZE, total);
        for (let i = this._cursor; i < end; i++) {
            const sat = this.satellites[i];
            if (sat.sprite.visible) {
                sat.propagateTLE();
            }
        }
        this._cursor = end >= total ? 0 : end;

        for (let i = 0; i < total; i++) {
            const sat = this.satellites[i];
            if (sat.sprite.visible) {
                sat.updateGeometryPosition();
            }
        }
    }

    getVisibleCount() {
        return this.satellites.filter(s => s.sprite?.visible).length;
    }
}