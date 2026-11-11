// Pengganti kecil untuk runtime dashboard: memuat data/ lalu menjalankan gambar di halaman.
(() => {
  const DATA = {}, calcs = {}, draws = {}, listeners = [];
  let params = { preset: 'mtd', start: null, end: null };
  let ready = false, failed = false;
  const cache = new Map();
  const dash = {
    colors: ['var(--b1c)', 'var(--b2c)', 'var(--b3c)'],
    data(id) {
      if (failed) return { status: 'error', data: calcs[id] ? null : [] };
      if (!ready) return { status: 'loading', data: calcs[id] ? null : [] };
      if (DATA[id]) return { status: 'ok', data: DATA[id] };
      if (calcs[id]) {
        if (!cache.has(id)) {
          try { cache.set(id, calcs[id].fn(...calcs[id].inputs.map((i) => dash.data(i).data))); }
          catch (e) { console.error('calc ' + id, e); return { status: 'error', data: null }; }
        }
        return { status: 'ok', data: cache.get(id) };
      }
      return { status: 'missing', data: [] };
    },
    calc(id, o) { calcs[id] = o; },
    loader() {},
    draw(name, fn) { if (fn) draws[name] = fn; else run(name); },
    onData(fn) { listeners.push(fn); },
    params() { return params; },
    setParams(p) { params = Object.assign({}, params, p); runAll(); },
    resetParams() { params = { preset: 'mtd', start: null, end: null }; runAll(); },
    setLink() {}, refresh() {}
  };
  function run(name) {
    document.querySelectorAll('[data-draw="' + name + '"]').forEach((el) => {
      try { draws[name](el); } catch (e) { console.error('draw ' + name, e); }
    });
  }
  function runAll() { listeners.forEach((f) => { try { f(); } catch (e) { console.error(e); } }); Object.keys(draws).forEach(run); }
  window.dash = dash;
  const parseCsv = (text) => {
    const lines = text.trim().split(/\r?\n/); const head = lines.shift().split(',');
    return lines.map((l) => { const c = l.split(','); const o = {}; head.forEach((h, i) => { o[h] = c[i]; }); return o; });
  };
  const bust = '?t=' + Date.now();
  window.addEventListener('DOMContentLoaded', () => {
    Promise.all([
      fetch('data/daily_ads.csv' + bust).then((r) => { if (!r.ok) throw new Error(r.status); return r.text(); }),
      fetch('data/saldo.json' + bust).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    ]).then(([csv, saldo]) => { DATA.ads = parseCsv(csv); DATA.saldo = saldo; ready = true; })
      .catch((e) => { console.error(e); failed = true; document.getElementById('load-error').hidden = false; })
      .finally(runAll);
    let w = window.innerWidth, timer;
    window.addEventListener('resize', () => { if (window.innerWidth === w) return; w = window.innerWidth; clearTimeout(timer); timer = setTimeout(runAll, 150); });
  });
})();
