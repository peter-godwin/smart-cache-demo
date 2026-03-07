import { SmartCache } from './SmartCache.js';

export function memoize(fn, options = {}) {
  const cache = new SmartCache(options);

  return async function(...args) {
    const key = JSON.stringify(args);
    return cache.get(key, () => fn(...args));
  };
}
