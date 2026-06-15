import { Satellite } from './satellite.js';

const BATCH_SIZE = 15;

export class SatelliteManager {
    constructor(earthMesh) {
        this.earthMesh = earthMesh;
        this.satellites = [];
        this.searchQuery = '';
        this.activeFilter = 'all';
        this.activeCountryFilter = 'all';
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
            } catch (err) {
                console.error('Failed to parse satellite item:', err);
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
            if (sat && sat.sprite)    this.earthMesh.remove(sat.sprite);
            if (sat && sat.trailLine) this.earthMesh.remove(sat.trailLine);
            sat?.dispose?.();
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

    setCountryFilter(country) {
        this.activeCountryFilter = country;
        this.applyFilters();
    }

    applyFilters() {
        for (const sat of this.satellites) {
            if (!sat || !sat.data) continue;
            
            const matchesSearch = sat.data.name.toLowerCase().includes(this.searchQuery);
            const matchesFilter = this.activeFilter === 'all' || sat.data.type === this.activeFilter;
            const matchesCountry = this.activeCountryFilter === 'all' || sat.data.country === this.activeCountryFilter;
            
            const visible = matchesSearch && matchesFilter && matchesCountry;

            if (sat.sprite) sat.sprite.visible = visible;
            if (sat.trailLine) sat.trailLine.visible = visible;
        }
    }

    update() {
        const total = this.satellites.length;
        if (total === 0) return;

        const end = Math.min(this._cursor + BATCH_SIZE, total);

        for (let i = this._cursor; i < end; i++) {
            const sat = this.satellites[i];
            
            if (sat && typeof sat.updatePosition === 'function') {
                if (sat.sprite && sat.sprite.visible) {
                    sat.updatePosition();
                }
            } else if (sat) {
                console.warn('⚠️ Ungültiges Satelliten-Objekt im Array entdeckt:', sat);
            }
        }

        this._cursor = end >= total ? 0 : end;
    }

    getVisibleCount() {
        return this.satellites.filter(s => s?.sprite?.visible).length;
    }
}