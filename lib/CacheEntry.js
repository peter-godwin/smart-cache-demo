export class CacheEntry {
  constructor(value, ttl, tags = []) {
    this.value = value;
    this.expiresAt = ttl ? Date.now() + ttl : null;
    this.tags = new Set(tags);
    this.createdAt = Date.now();
    this.lastAccessedAt = this.createdAt;
    this.accessCount = 0;
  }

  isExpired() {
    return this.expiresAt && Date.now() > this.expiresAt;
  }

  touch() {
    this.lastAccessedAt = Date.now();
    this.accessCount++;
  }
}
