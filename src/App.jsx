import { useState, useEffect, useRef } from 'react';

class MiniCache {
  constructor(opts = {}) {
    this.max = opts.maxSize || 10;
    this.ttl = opts.defaultTTL || 5000;
    this.store = new Map();
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
    this.cb = {};
  }
  on(e, fn) { this.cb[e] = fn; }
  emit(e, d) { this.cb[e]?.(d); }
  set(k, v) {
    if (this.store.size >= this.max) {
      let old = null, oldest = Date.now();
      for (let [key, val] of this.store) {
        if (val.at < oldest) { oldest = val.at; old = key; }
      }
      if (old) { this.store.delete(old); this.evictions++; }
    }
    this.store.set(k, { v, at: Date.now(), exp: Date.now() + this.ttl });
    this.emit('set', k);
  }
  get(k, fn) {
    const item = this.store.get(k);
    if (!item) { this.misses++; this.emit('miss', k); return fn ? fn() : null; }
    if (Date.now() > item.exp) { this.store.delete(k); this.misses++; this.emit('exp', k); return fn ? fn() : null; }
    item.at = Date.now();
    this.hits++;
    this.emit('hit', k);
    return item.v;
  }
  async invalidate(p) {
    let n = 0;
    for (let k of this.store.keys()) {
      if (p.test(k)) { this.store.delete(k); n++; }
    }
    return n;
  }
  stats() {
    const total = this.hits + this.misses;
    const rate = total ? (this.hits / total * 100).toFixed(1) : 0;
    return { hits: this.hits, misses: this.misses, evictions: this.evictions, rate, size: this.store.size };
  }
}

function App() {
  const [stats, setStats] = useState({ hits: 0, misses: 0, evictions: 0, rate: 0, size: 0 });
  const [logs, setLogs] = useState([]);
  const cache = useRef(null);

  useEffect(() => {
    cache.current = new MiniCache({ maxSize: 10, defaultTTL: 5000 });
    cache.current.on('hit', k => log('hit', k));
    cache.current.on('miss', k => log('miss', k));
    cache.current.on('set', k => log('set', k));

    const t = setInterval(() => setStats(cache.current.stats()), 200);
    return () => clearInterval(t);
  }, []);

  const log = (type, key) => {
    setLogs(l => [{ type, key, time: new Date().toLocaleTimeString() }, ...l].slice(0, 10));
  };

  const onGet = () => {
    const k = 'user:' + Math.floor(Math.random() * 50);
    cache.current.get(k, () => 'fetched');
    setStats(cache.current.stats());
  };

  const onSet = () => {
    const k = 'user:' + Date.now();
    cache.current.set(k, { data: 'test' });
    setStats(cache.current.stats());
  };

  const onClear = () => {
    cache.current.invalidate(/^user:/);
    setStats(cache.current.stats());
  };

  return (
    <div className="app">
      <h1>Cache Dashboard</h1>
      <div className="stats">
        <div className="stat"><div className="stat-label">HITS</div><div className="stat-value" style={{color:'#4ade80'}}>{stats.hits}</div></div>
        <div className="stat"><div className="stat-label">MISSES</div><div className="stat-value" style={{color:'#f87171'}}>{stats.misses}</div></div>
        <div className="stat"><div className="stat-label">RATE</div><div className="stat-value" style={{color:'#60a5fa'}}>{stats.rate}%</div></div>
        <div className="stat"><div className="stat-label">SIZE</div><div className="stat-value">{stats.size}</div></div>
      </div>
      <div className="controls">
        <button onClick={onGet}>GET random</button>
        <button onClick={onSet}>SET random</button>
        <button onClick={onClear}>Clear user:*</button>
      </div>
      <div className="logs">
        {logs.map((l, i) => (
          <div key={i} className="log">
            <span className={l.type}>{l.type.toUpperCase()}</span> {l.key} <span style={{color:'#666'}}>{l.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
