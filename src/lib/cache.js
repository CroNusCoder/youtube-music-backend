'use strict';

/**
 * Lightweight in-memory cache with per-key TTL.
 * Suitable for caching stream URLs that expire in ~6 hours.
 * Runs a passive cleanup on every get() to avoid stale reads,
 * plus a periodic sweep to reclaim memory.
 */
class MemoryCache {
  constructor() {
    /** @type {Map<string, { value: any, expiresAt: number }>} */
    this._store = new Map();

    // Sweep expired entries every 5 minutes
    this._sweepInterval = setInterval(() => this._sweep(), 5 * 60 * 1000);
    this._sweepInterval.unref(); // Don't block process exit
  }

  /**
   * Store a value with a TTL.
   * @param {string} key
   * @param {*} value
   * @param {number} ttlSeconds — time-to-live in seconds
   */
  set(key, value, ttlSeconds) {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this._store.set(key, { value, expiresAt });
  }

  /**
   * Retrieve a cached value. Returns `undefined` if missing or expired.
   * @param {string} key
   * @returns {*|undefined}
   */
  get(key) {
    const entry = this._store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this._store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  /**
   * Check if a non-expired entry exists.
   * @param {string} key
   * @returns {boolean}
   */
  has(key) {
    return this.get(key) !== undefined;
  }

  /**
   * Delete a specific key.
   * @param {string} key
   */
  delete(key) {
    this._store.delete(key);
  }

  /** Remove all entries. */
  clear() {
    this._store.clear();
  }

  /** @returns {number} Number of live (non-expired) entries */
  get size() {
    this._sweep();
    return this._store.size;
  }

  /** Internal: remove all expired entries */
  _sweep() {
    const now = Date.now();
    for (const [key, entry] of this._store) {
      if (now > entry.expiresAt) {
        this._store.delete(key);
      }
    }
  }

  /** Stop the background sweep timer (for graceful shutdown). */
  destroy() {
    clearInterval(this._sweepInterval);
    this._store.clear();
  }
}

// Export a singleton instance
module.exports = new MemoryCache();
