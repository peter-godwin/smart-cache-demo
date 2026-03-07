import { CacheEntry } from './CacheEntry.js';
import { CacheMetrics } from './CacheMetrics.js';

export class SmartCache {
  constructor(options = {}) {
    this.maxSize = options.maxSize || 100;
    this.defaultTTL = options.defaultTTL || 3600000;
    this.logger = options.logger || (() => {});

    this.cache = new Map();
    this.tagIndex = new Map();
    this.events = new Map();
    this.metrics = new CacheMetrics();

    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  async set(key, value, options = {}) {
    const ttl = options.ttl || this.defaultTTL;
    const tags = options.tags || [];

    try {
      if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
        this.evictLRU();
      }

      const entry = new CacheEntry(value, ttl, tags);
      this.cache.set(key, entry);

      for (const tag of tags) {
        if (!this.tagIndex.has(tag)) {
          this.tagIndex.set(tag, new Set());
        }
        this.tagIndex.get(tag).add(key);
      }

      this.emit('set', { key, tags });
      return true;
    } catch (err) {
      this.metrics.recordError();
      this.logger('Cache set error:', err.message);
      return false;
    }
  }

  async get(key, fallback = null, options = {}) {
    const entry = this.cache.get(key);

    if (!entry) {
      this.metrics.recordMiss();
      this.emit('miss', { key });

      if (fallback) {
        const value = await fallback();
        if (value !== undefined) {
          await this.set(key, value, options);
        }
        return value;
      }
      return null;
    }

    if (entry.isExpired()) {
      await this.delete(key);
      this.metrics.recordMiss();
      this.emit('expired', { key });

      if (fallback) {
        const value = await fallback();
        if (value !== undefined) {
          await this.set(key, value, options);
        }
        return value;
      }
      return null;
    }

    entry.touch();
    this.metrics.recordHit();
    this.emit('hit', { key });
    return entry.value;
  }

  async delete(key) {
    const entry = this.cache.get(key);
    if (!entry) return false;

    for (const tag of entry.tags) {
      const set = this.tagIndex.get(tag);
      if (set) {
        set.delete(key);
        if (set.size === 0) this.tagIndex.delete(tag);
      }
    }

    this.cache.delete(key);
    this.emit('delete', { key });
    return true;
  }

  async invalidateByTag(tag) {
    const keys = this.tagIndex.get(tag);
    if (!keys) return 0;

    let count = 0;
    for (const key of keys) {
      if (await this.delete(key)) count++;
    }

    this.tagIndex.delete(tag);
    this.emit('invalidate', { tag, count });
    return count;
  }

  async invalidateByPattern(pattern) {
    const keys = [...this.cache.keys()].filter(k => pattern.test(k));
    let count = 0;
    for (const key of keys) {
      if (await this.delete(key)) count++;
    }
    return count;
  }

  async invalidateByDependency(dependencyKey) {
    return this.invalidateByPattern(new RegExp(`^dep:${dependencyKey}:`));
  }

  evictLRU() {
    let lruKey = null;
    let oldest = Infinity;

    for (const [key, entry] of this.cache) {
      if (entry.lastAccessedAt < oldest) {
        oldest = entry.lastAccessedAt;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.delete(lruKey);
      this.metrics.recordEviction();
    }
  }

  cleanup() {
    let cleaned = 0;
    for (const [key, entry] of this.cache) {
      if (entry.isExpired()) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    if (cleaned) this.emit('cleanup', { cleaned });
  }

  on(event, callback) {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    this.events.get(event).add(callback);
  }

  off(event, callback) {
    this.events.get(event)?.delete(callback);
  }

  emit(event, data) {
    const callbacks = this.events.get(event);
    if (callbacks) {
      for (const cb of callbacks) {
        try { cb(data); } catch (err) {
          this.logger('Event handler error:', err.message);
        }
      }
    }
  }

  getMetrics() {
    return this.metrics.toJSON();
  }

  getStats() {
    const entries = [...this.cache.values()];
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      tags: this.tagIndex.size,
      ...this.getMetrics(),
    };
  }

  async clear() {
    this.cache.clear();
    this.tagIndex.clear();
    this.metrics.reset();
  }

  has(key) {
    const entry = this.cache.get(key);
    return entry ? !entry.isExpired() : false;
  }

  destroy() {
    clearInterval(this.cleanupInterval);
    this.cache.clear();
    this.tagIndex.clear();
    this.events.clear();
  }
}
