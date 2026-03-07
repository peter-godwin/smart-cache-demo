export class CacheMetrics {
  constructor() {
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
    this.errors = 0;
    this.total = 0;
  }

  recordHit() {
    this.hits++;
    this.total++;
  }

  recordMiss() {
    this.misses++;
    this.total++;
  }

  recordEviction() {
    this.evictions++;
  }

  recordError() {
    this.errors++;
  }

  get hitRate() {
    return this.total > 0 ? (this.hits / this.total * 100).toFixed(2) : 0;
  }

  toJSON() {
    return {
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      errors: this.errors,
      hitRate: `${this.hitRate}%`,
    };
  }

  reset() {
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
    this.errors = 0;
    this.total = 0;
  }
}
