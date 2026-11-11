const root = document.getElementById('dash-root');
  root.style.setProperty('--b1', dash.colors[0]);
  root.style.setProperty('--b2', dash.colors[1]);
  root.style.setProperty('--b3', dash.colors[2]);

  dash.calc('wide', {
    title: 'Tabel harian per brand',
    description: 'Satu baris per tanggal dengan kolom tiap brand seperti di Excel: spend, spend + PPN 11%, pesanan, biaya per pesanan, GMV, ROI dan CAC %.',
    inputs: ['ads'],
    fn: (ads) => {
      const P = { Snuru: 's', Vablo: 'v', Sleepe: 'l' };
      const DAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
      const days = new Map();
      for (const r of ads) {
        const p = P[r.brand]; if (!p) continue;
        const d = String(r.date).slice(0, 10);
        if (!days.has(d)) days.set(d, {});
        days.get(d)[p] = { spend: Number(r.spend), orders: Number(r.orders), gmv: Number(r.gmv) };
      }
      return [...days.keys()].sort().map((d) => {
        const row = { date: d, label: d.slice(8, 10), day: DAYS[new Date(d + 'T00:00:00Z').getUTCDay()] };
        for (const p of ['s', 'v', 'l']) {
          const x = days.get(d)[p];
          row[p + '_spend'] = x ? x.spend : null;
          row[p + '_ppn'] = x ? x.spend * 1.11 : null;
          row[p + '_orders'] = x ? x.orders : null;
          row[p + '_cpo'] = x && x.orders ? x.spend / x.orders : null;
          row[p + '_gmv'] = x ? x.gmv : null;
          row[p + '_roi'] = x && x.spend ? x.gmv / x.spend : null;
          row[p + '_cac'] = x && x.gmv ? x.spend / x.gmv * 100 : null;
        }
        return row;
      });
    }
  });

  dash.calc('monthly', {
    title: 'Rekap bulanan per brand',
    description: 'Total spend, pesanan dan GMV tiap bulan per brand dan gabungan. ROAS = GMV ÷ spend.',
    inputs: ['wide'],
    fn: (wide) => {
      const months = new Map();
      for (const r of wide) {
        const k = r.date.slice(0, 7);
        if (!months.has(k)) months.set(k, { month: k, days: 0, s_spend: 0, s_orders: 0, s_gmv: 0, v_spend: 0, v_orders: 0, v_gmv: 0, l_spend: 0, l_orders: 0, l_gmv: 0 });
        const o = months.get(k); o.days += 1;
        for (const p of ['s', 'v', 'l']) for (const m of ['spend', 'orders', 'gmv']) o[p + '_' + m] += r[p + '_' + m] || 0;
      }
      return [...months.values()].sort((a, b) => (a.month < b.month ? -1 : 1)).map((o) => {
        for (const p of ['s', 'v', 'l']) o[p + '_roi'] = o[p + '_spend'] ? o[p + '_gmv'] / o[p + '_spend'] : null;
        o.t_spend = o.s_spend + o.v_spend + o.l_spend;
        o.t_gmv = o.s_gmv + o.v_gmv + o.l_gmv;
        o.t_roi = o.t_spend ? o.t_gmv / o.t_spend : null;
        return o;
      });
    }
  });

  dash.calc('weekday', {
    title: 'Pola per hari dalam seminggu',
    description: 'Dari 56 hari terakhir: per hari dalam seminggu dan per brand, ROAS (total GMV ÷ total spend) serta rata-rata pesanan dan GMV per hari.',
    inputs: ['wide'],
    fn: (wide) => {
      if (!wide.length) return [];
      const last = wide[wide.length - 1].date;
      const from = new Date(Date.parse(last + 'T00:00:00Z') - 55 * 864e5).toISOString().slice(0, 10);
      const rows = wide.filter((r) => r.date >= from);
      return ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((day) => {
        const d = rows.filter((r) => r.day === day);
        const o = { day, n: d.length };
        for (const p of ['s', 'v', 'l']) {
          const has = d.filter((r) => r[p + '_spend'] != null);
          const sp = has.reduce((a, r) => a + r[p + '_spend'], 0), gm = has.reduce((a, r) => a + r[p + '_gmv'], 0), od = has.reduce((a, r) => a + r[p + '_orders'], 0);
          o[p + '_roi'] = sp ? gm / sp : null;
          o[p + '_orders'] = has.length ? od / has.length : null;
          o[p + '_gmv'] = has.length ? gm / has.length : null;
        }
        return o;
      });
    }
  });

  const idr = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });
  const dec = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const one = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 });
  const MON = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  const dLabel = (d) => Number(d.slice(8, 10)) + ' ' + MON[Number(d.slice(5, 7)) - 1] + ' ' + d.slice(0, 4);
  const fmt = (k, v, kind) => {
    if (v == null || Number.isNaN(v)) return '';
    if (k === 'roi') return dec.format(v);
    if (k === 'cac') return dec.format(v) + '%';
    if (k === 'orders') return kind === 'avg' ? one.format(v) : idr.format(v);
    return 'Rp' + idr.format(v);
  };
  const iso = (dt) => dt.toISOString().slice(0, 10);
  const addDays = (d, n) => iso(new Date(Date.parse(d + 'T00:00:00Z') + n * 864e5));
  const lastDate = () => {
    const a = dash.data('ads');
    if (a.status !== 'ok' || !a.data.length) return null;
    return a.data.map((r) => String(r.date).slice(0, 10)).sort().pop();
  };
  const presetRange = (p, last) => {
    if (p === 'last') return [last, last];
    if (p === '7') return [addDays(last, -6), last];
    if (p === 'mtd') return [last.slice(0, 8) + '01', last];
    if (p === 'prev') { const f = new Date(Date.UTC(+last.slice(0, 4), +last.slice(5, 7) - 2, 1)); const e = new Date(Date.UTC(+last.slice(0, 4), +last.slice(5, 7) - 1, 0)); return [iso(f), iso(e)]; }
    return null;
  };
  const range = () => {
    const last = lastDate(); if (!last) return null;
    const p = dash.params();
    let s = p.start, e = p.end;
    if (!s || !e) [s, e] = presetRange(p.preset || 'mtd', last);
    if (s > e) [s, e] = [e, s];
    return [s, e];
  };
  const inRange = () => {
    const w = dash.data('wide'); const r = range();
    if (w.status !== 'ok' || !r) return null;
    return w.data.filter((x) => x.date >= r[0] && x.date <= r[1]);
  };
  const totals = (rows) => {
    const t = { n: rows.length };
    for (const p of ['s', 'v', 'l']) {
      const has = rows.filter((r) => r[p + '_spend'] != null);
      if (!has.length) { t[p] = null; continue; }
      const sp = d3.sum(has, (r) => r[p + '_spend']), od = d3.sum(has, (r) => r[p + '_orders']), gm = d3.sum(has, (r) => r[p + '_gmv']);
      t[p] = { spend: sp, ppn: sp * 1.11, orders: od, gmv: gm, cpo: od ? sp / od : null, roi: sp ? gm / sp : null, cac: gm ? sp / gm * 100 : null };
    }
    const parts = ['s', 'v', 'l'].map((p) => t[p]).filter(Boolean);
    if (parts.length) {
      const sp = d3.sum(parts, (x) => x.spend), od = d3.sum(parts, (x) => x.orders), gm = d3.sum(parts, (x) => x.gmv);
      t.t = { spend: sp, ppn: sp * 1.11, orders: od, gmv: gm, cpo: od ? sp / od : null, roi: sp ? gm / sp : null, cac: gm ? sp / gm * 100 : null };
    } else t.t = null;
    return t;
  };
  const BR = [['s', 'Snuru'], ['v', 'Vablo'], ['l', 'Sleepe']];
  const prevRows = () => {
    const w = dash.data('wide'); const r = range();
    if (w.status !== 'ok' || !r) return null;
    const n = Math.round((Date.parse(r[1] + 'T00:00:00Z') - Date.parse(r[0] + 'T00:00:00Z')) / 864e5) + 1;
    const a = addDays(r[0], -n), b = addDays(r[0], -1);
    return w.data.filter((x) => x.date >= a && x.date <= b);
  };
  const pct = (a, b) => (a == null || !b ? null : (a - b) / b * 100);
  const signed = (ch) => (ch >= 0 ? '+' : '−') + one.format(Math.abs(ch)) + '%';

  // Controls: satu pemilih periode. Klik tanggal awal, lalu klik tanggal akhir.
  const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  const calState = { view: null, picking: null };
  const shiftMonth = (v, n) => new Date(Date.UTC(+v.slice(0, 4), +v.slice(5, 7) - 1 + n, 1)).toISOString().slice(0, 7);
  const closeCal = () => {
    calState.picking = null;
    document.querySelectorAll('.ah-cal').forEach((c) => { c.hidden = true; });
    document.querySelectorAll('.ah-pick').forEach((b) => b.setAttribute('aria-expanded', 'false'));
  };
  const showRange = () => {
    const p = dash.params();
    document.querySelectorAll('.ah-pre').forEach((b) => b.setAttribute('aria-pressed', String(!p.start && (p.preset || 'mtd') === b.dataset.pre)));
  };
  document.querySelectorAll('.ah-pick').forEach((btn) => btn.addEventListener('click', () => {
    const cals = document.querySelectorAll('.ah-cal');
    if ([...cals].some((c) => !c.hidden)) { closeCal(); return; }
    const last = lastDate(); if (!last) return;
    const r = range();
    calState.view = (r ? r[1] : last).slice(0, 7);
    calState.picking = null;
    cals.forEach((c) => { c.hidden = false; });
    btn.setAttribute('aria-expanded', 'true');
    dash.draw('cal');
  }));
  document.addEventListener('click', (e) => { if (!e.composedPath().some((n) => n.classList && n.classList.contains('ah-filter'))) closeCal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeCal(); });
  document.querySelectorAll('.ah-pre').forEach((b) => b.addEventListener('click', () => { closeCal(); dash.setParams({ preset: b.dataset.pre, start: null, end: null }); }));
  dash.onData(showRange);

  dash.draw('pick-label', (el) => {
    const r = range();
    el.textContent = r ? (r[0] === r[1] ? dLabel(r[0]) : dLabel(r[0]) + ' – ' + dLabel(r[1])) : '—';
  });

  const renderCal = (el) => {
    const last = lastDate();
    if (!last) { el.textContent = '—'; return; }
    if (!calState.view) calState.view = last.slice(0, 7);
    const view = calState.view;
    const r = range();
    const yy = +view.slice(0, 4), mm = +view.slice(5, 7);
    const lead = new Date(Date.UTC(yy, mm - 1, 1)).getUTCDay();
    const nDays = new Date(Date.UTC(yy, mm, 0)).getUTCDate();
    const head = document.createElement('div'); head.className = 'ah-cal-head';
    const prev = document.createElement('button'); prev.type = 'button'; prev.className = 'ah-cal-nav'; prev.textContent = '‹'; prev.setAttribute('aria-label', 'Bulan sebelumnya');
    prev.addEventListener('click', () => { calState.view = shiftMonth(calState.view, -1); renderCal(el); });
    const next = document.createElement('button'); next.type = 'button'; next.className = 'ah-cal-nav'; next.textContent = '›'; next.setAttribute('aria-label', 'Bulan berikutnya');
    next.disabled = view >= last.slice(0, 7);
    next.addEventListener('click', () => { calState.view = shiftMonth(calState.view, 1); renderCal(el); });
    const title = document.createElement('span'); title.textContent = MONTHS[mm - 1] + ' ' + yy;
    head.append(prev, title, next);
    const grid = document.createElement('div'); grid.className = 'ah-cal-grid';
    ['Min','Sen','Sel','Rab','Kam','Jum','Sab'].forEach((n) => { const s = document.createElement('span'); s.className = 'ah-cal-dow'; s.textContent = n; grid.append(s); });
    for (let i = 0; i < lead; i++) grid.append(document.createElement('span'));
    for (let d = 1; d <= nDays; d++) {
      const day = view + '-' + String(d).padStart(2, '0');
      const b = document.createElement('button'); b.type = 'button'; b.className = 'ah-cal-day'; b.textContent = d;
      b.setAttribute('aria-label', dLabel(day));
      b.disabled = day > last;
      if (calState.picking) { if (day === calState.picking) b.classList.add('edge'); }
      else if (r) { if (day >= r[0] && day <= r[1]) b.classList.add('in'); if (day === r[0] || day === r[1]) b.classList.add('edge'); }
      b.addEventListener('click', () => {
        if (!calState.picking) { calState.picking = day; renderCal(el); return; }
        const a = calState.picking;
        const s = a < day ? a : day, e = a < day ? day : a;
        closeCal();
        dash.setParams({ start: s, end: e, preset: null });
      });
      grid.append(b);
    }
    el.replaceChildren(head, grid);
  };
  dash.draw('cal', renderCal);

  dash.draw('last', (el) => { const l = lastDate(); el.textContent = l ? dLabel(l) : '—'; });
  dash.draw('period', (el) => {
    const r = range(); const rows = inRange();
    if (!r || !rows) { el.textContent = '—'; return; }
    el.textContent = (r[0] === r[1] ? dLabel(r[0]) : dLabel(r[0]) + ' – ' + dLabel(r[1])) + ' (' + rows.length + ' hari ada data)';
  });

  dash.draw('card', (el) => {
    const rows = inRange();
    if (!rows) { el.textContent = '—'; return; }
    const t = totals(rows)[el.dataset.brand];
    const k = el.dataset.metric; const v = t ? t[k] : null;
    el.textContent = v == null ? '—' : fmt(k, v, 'sum');
  });

  dash.draw('delta', (el) => {
    el.className = 'ah-delta';
    const rows = inRange(), prev = prevRows();
    const k = el.dataset.metric, p = el.dataset.brand;
    const a = rows && rows.length ? totals(rows)[p] : null, b = prev && prev.length ? totals(prev)[p] : null;
    const ch = a && b ? pct(a[k], b[k]) : null;
    if (ch == null) { el.textContent = '—'; return; }
    el.textContent = signed(ch);
    el.classList.add(ch >= 0 ? 'up' : 'down');
  });

  dash.draw('leader', (el) => {
    const rows = inRange();
    if (!rows || !rows.length) { el.textContent = '—'; return; }
    const t = totals(rows);
    const best = d3.greatest(BR.filter(([p]) => t[p] && t[p].roi != null), ([p]) => t[p].roi);
    el.textContent = best ? best[1] + ' (' + dec.format(t[best[0]].roi) + ')' : '—';
  });

  dash.draw('insights', (ul) => {
    const rows = inRange(), prev = prevRows();
    if (!rows || !rows.length) { ul.replaceChildren(); return; }
    const t = totals(rows), pt = prev && prev.length ? totals(prev) : null;
    const items = [];
    for (const [p, n] of BR) {
      const a = t[p]; if (!a) continue;
      const mine = rows.filter((r) => r[p + '_spend'] != null);
      if (a.roi != null) {
        let s = n + ': ROAS ' + dec.format(a.roi) + (a.roi >= 10 ? ' (sehat)' : a.roi < 5 ? ' (lemah)' : ' (sedang)');
        const ch = pt && pt[p] ? pct(a.roi, pt[p].roi) : null;
        if (ch != null) s += ', ' + (ch >= 0 ? 'naik ' : 'turun ') + one.format(Math.abs(ch)) + '% dari ' + dec.format(pt[p].roi) + ' di periode sebelumnya';
        const cg = pt && pt[p] ? pct(a.gmv, pt[p].gmv) : null;
        if (cg != null) s += '; GMV ' + signed(cg);
        items.push([a.roi >= 10 ? 'ok' : a.roi < 5 ? 'bad' : 'mid', s + '.']);
      }
      const zero = mine.filter((r) => r[p + '_spend'] > 0 && !r[p + '_orders']);
      if (zero.length) items.push(['bad', n + ': ' + zero.length + ' dari ' + mine.length + ' hari ada spend tanpa pesanan (Rp' + idr.format(d3.sum(zero, (r) => r[p + '_spend'])) + ' terpakai).']);
      const weak = mine.filter((r) => r[p + '_orders'] > 0 && r[p + '_roi'] != null && r[p + '_roi'] < 5);
      if (weak.length) items.push(['mid', n + ': ' + weak.length + ' hari ROAS di bawah 5 walau ada pesanan.']);
      if (mine.length > 1) {
        const best = d3.greatest(mine, (r) => r[p + '_gmv']);
        if (best && best[p + '_gmv'] > 0) items.push(['', n + ': GMV tertinggi ' + best.day + ', ' + dLabel(best.date) + ' (Rp' + idr.format(best[p + '_gmv']) + ', ROAS ' + (best[p + '_roi'] == null ? '—' : dec.format(best[p + '_roi'])) + ').']);
      }
      if (t.t && t.t.spend && t.t.gmv) {
        const ss = a.spend / t.t.spend * 100, gs = a.gmv / t.t.gmv * 100;
        if (ss - gs >= 3) items.push(['mid', n + ': memakai ' + one.format(ss) + '% spend gabungan tapi menyumbang ' + one.format(gs) + '% GMV.']);
      }
    }
    const sv = dash.data('saldo_view');
    if (sv.status === 'ok') for (const r of sv.data) {
      if (r.days_left != null && r.days_left < 3) items.push(['bad', r.brand + ': saldo tersedia Rp' + idr.format(r.cash) + ' cukup sekitar ' + one.format(r.days_left) + ' hari dengan rata-rata spend 7 hari terakhir.']);
    }
    if (!items.length) items.push(['', 'Tidak ada catatan untuk periode ini.']);
    ul.replaceChildren(...items.map(([cls, s]) => { const li = document.createElement('li'); if (cls) li.className = cls; li.textContent = s; return li; }));
  });

  dash.draw('share', (el) => {
    const rows = inRange();
    const t = rows && rows.length ? totals(rows) : null;
    const k = el.dataset.metric;
    if (!t || !t.t || !t.t[k]) { el.textContent = '—'; return; }
    const bar = document.createElement('div'); bar.className = 'ah-bar';
    const leg = document.createElement('div'); leg.className = 'ah-pct';
    BR.forEach(([p], i) => {
      const share = t[p] ? t[p][k] / t.t[k] * 100 : 0;
      const seg = document.createElement('i'); seg.style.width = share + '%'; seg.style.background = dash.colors[i]; bar.append(seg);
      const s = document.createElement('span'); const dot = document.createElement('span'); dot.className = 'ah-dot'; dot.style.background = dash.colors[i];
      s.append(dot, one.format(share) + '%'); leg.append(s);
    });
    el.replaceChildren(bar, leg);
  });

  const monLabel = (m) => MON[Number(m.slice(5, 7)) - 1] + ' ' + m.slice(0, 4);
  const cell = (tr, txt, cls) => { const td = document.createElement('td'); if (cls) td.className = cls; td.textContent = txt; tr.append(td); return td; };
  const roiCls = (v) => (v == null ? '' : v < 5 ? 'bad' : v >= 10 ? 'ok' : '');
  dash.draw('monthly', (tb) => {
    const m = dash.data('monthly');
    if (m.status !== 'ok') { tb.replaceChildren(); return; }
    const rows = m.data.slice(-12).reverse();
    tb.replaceChildren(...rows.map((r) => {
      const tr = document.createElement('tr'); tr.dataset.key = r.month;
      cell(tr, monLabel(r.month), 'l'); cell(tr, String(r.days));
      for (const p of ['s', 'v', 'l']) {
        cell(tr, fmt('spend', r[p + '_spend']), 'grp'); cell(tr, fmt('orders', r[p + '_orders'])); cell(tr, fmt('gmv', r[p + '_gmv']));
        cell(tr, fmt('roi', r[p + '_roi']), roiCls(r[p + '_roi']));
      }
      cell(tr, fmt('spend', r.t_spend), 'grp'); cell(tr, fmt('gmv', r.t_gmv)); cell(tr, fmt('roi', r.t_roi), roiCls(r.t_roi));
      return tr;
    }));
  });

  dash.draw('weekday', (tb) => {
    const w = dash.data('weekday');
    if (w.status !== 'ok') { tb.replaceChildren(); return; }
    const top = {};
    for (const p of ['s', 'v', 'l']) top[p] = d3.max(w.data, (r) => r[p + '_roi']);
    tb.replaceChildren(...w.data.map((r) => {
      const tr = document.createElement('tr'); tr.dataset.key = r.day;
      cell(tr, r.day, 'l'); cell(tr, String(r.n));
      for (const p of ['s', 'v', 'l']) {
        cell(tr, fmt('roi', r[p + '_roi']), 'grp' + (r[p + '_roi'] != null && r[p + '_roi'] === top[p] ? ' best' : ''));
        cell(tr, fmt('orders', r[p + '_orders'], 'avg')); cell(tr, fmt('gmv', r[p + '_gmv']));
      }
      return tr;
    }));
  });

  const COLS = ['spend', 'ppn', 'orders', 'cpo', 'gmv', 'roi', 'cac'];
  const fillRow = (tr, get, kind) => {
    for (const p of ['s', 'v', 'l']) COLS.forEach((k, i) => {
      const td = document.createElement('td');
      if (i === 0) td.className = 'grp';
      const v = get(p, k);
      td.textContent = fmt(k, v, kind);
      if (k === 'roi' && v != null) td.classList.add(v < 5 ? 'bad' : v >= 10 ? 'ok' : 'mid');
      tr.append(td);
    });
  };

  dash.draw('table', (tb) => {
    const rows = inRange();
    if (!rows) { tb.replaceChildren(); return; }
    const multiMonth = new Set(rows.map((r) => r.date.slice(0, 7))).size > 1;
    tb.replaceChildren(...rows.map((r) => {
      const tr = document.createElement('tr');
      tr.dataset.key = r.date;
      if (r.day === 'Sen') tr.className = 'wk';
      const c0 = document.createElement('td'); c0.className = 'l';
      c0.textContent = multiMonth ? Number(r.label) + ' ' + MON[Number(r.date.slice(5, 7)) - 1] : r.label; tr.append(c0);
      const c1 = document.createElement('td'); c1.className = 'l'; c1.textContent = r.day; tr.append(c1);
      fillRow(tr, (p, k) => r[p + '_' + k], 'day');
      return tr;
    }));
  });

  dash.draw('totals', (tf) => {
    const rows = inRange();
    if (!rows || !rows.length) { tf.replaceChildren(); return; }
    const t = totals(rows);
    const mk = (label, sub, kind, get) => {
      const tr = document.createElement('tr'); tr.className = 'tot';
      const c0 = document.createElement('td'); c0.className = 'l'; c0.textContent = label; tr.append(c0);
      const c1 = document.createElement('td'); c1.className = 'l'; c1.textContent = sub; tr.append(c1);
      fillRow(tr, get, kind); return tr;
    };
    const sum = mk('SUM', '', 'sum', (p, k) => t[p] ? t[p][k] : null);
    const avg = mk('AVG', t.n + ' hari', 'avg', (p, k) => {
      if (!t[p]) return null;
      return ['spend', 'ppn', 'orders', 'gmv'].includes(k) ? t[p][k] / t.n : t[p][k];
    });
    tf.replaceChildren(sum, avg);
  });

  const MET = { roi: 'ROAS', spend: 'Spend', gmv: 'GMV', orders: 'Pesanan', cpo: 'Biaya per pesanan' };
  const chart = { metric: 'roi', hidden: new Set() };
  const short = (v) => (v >= 1e9 ? one.format(v / 1e9) + ' M' : v >= 1e6 ? one.format(v / 1e6) + ' jt' : v >= 1e3 ? one.format(v / 1e3) + ' rb' : one.format(v));
  document.querySelectorAll('.ah-tog').forEach((b) => b.addEventListener('click', () => {
    chart.metric = b.dataset.met;
    document.querySelectorAll('.ah-tog').forEach((o) => o.setAttribute('aria-pressed', String(o === b)));
    dash.draw('roas');
  }));
  document.querySelectorAll('.ah-leg').forEach((b) => b.addEventListener('click', () => {
    const p = b.dataset.brand;
    if (chart.hidden.has(p)) chart.hidden.delete(p); else chart.hidden.add(p);
    b.setAttribute('aria-pressed', String(!chart.hidden.has(p)));
    dash.draw('roas');
  }));

  dash.draw('roas', (el) => {
    el.replaceChildren();
    const rows = inRange(); const r = range();
    const m = chart.metric, isRoi = m === 'roi', money = m === 'spend' || m === 'gmv' || m === 'cpo';
    if (!rows || !rows.length) return;
    const W = Math.max(280, el.clientWidth), H = 240;
    const series = [['s', 'Snuru', dash.colors[0]], ['v', 'Vablo', dash.colors[1]], ['l', 'Sleepe', dash.colors[2]]].filter(([p]) => !chart.hidden.has(p));
    const pts = series.map(([p, n, c]) => ({ n, c, v: rows.filter((q) => q[p + '_' + m] != null && (!isRoi || q[p + '_spend'] > 0)).map((q) => ({ d: new Date(q.date + 'T00:00:00Z'), y: q[p + '_' + m] })) }));
    const all = pts.flatMap((s) => s.v.map((q) => q.y));
    const maxY = isRoi ? Math.max(12, Math.min(d3.max(all) || 12, 60)) : (d3.max(all) || 1);
    let x0 = new Date(r[0] + 'T00:00:00Z'), x1 = new Date(r[1] + 'T00:00:00Z');
    if (+x0 === +x1) { x0 = d3.utcDay.offset(x0, -1); x1 = d3.utcDay.offset(x1, 1); }
    const svg = d3.select(el).append('svg').attr('role', 'img').attr('aria-label', MET[m] + ' harian per brand di periode yang dipilih').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).style('display', 'block').style('overflow', 'visible');
    const y = d3.scaleLinear([0, maxY], [H - 24, 8]).nice();
    const gy = svg.append('g');
    const ticks = y.ticks(5);
    const labs = gy.selectAll('text').data(ticks).join('text').attr('x', 0).attr('y', (t) => y(t)).attr('dy', '0.32em').attr('fill', 'var(--color-fg-muted)').style('font-size', 'var(--cds-font-size-caption)').text((t) => (money ? short(t) : one.format(t)));
    let lw = 0; labs.each(function () { lw = Math.max(lw, this.getComputedTextLength()); });
    const L = lw + 8, R = 24;
    const x = d3.scaleUtc([x0, x1], [L + 8, W - R]);
    gy.selectAll('line').data(ticks).join('line').attr('x1', L).attr('x2', W - R).attr('y1', (t) => y(t)).attr('y2', (t) => y(t)).attr('stroke', 'var(--cds-chart-grid)');
    if (isRoi) svg.append('line').attr('x1', L).attr('x2', W - R).attr('y1', y(10)).attr('y2', y(10)).attr('stroke', 'var(--cds-chart-reference)').attr('stroke-dasharray', '4 4');
    const span = d3.utcDay.count(x0, x1);
    const xt = x.ticks(Math.max(2, Math.min(span, Math.floor((W - L) / 70)))).filter((t) => +d3.utcDay.floor(t) === +t);
    svg.append('g').selectAll('text').data(xt).join('text').attr('x', (t) => x(t)).attr('y', H - 4).attr('text-anchor', 'middle').attr('fill', 'var(--color-fg-muted)').style('font-size', 'var(--cds-font-size-caption)').text((t) => t.getUTCDate() + ' ' + MON[t.getUTCMonth()]);
    const cy = (v) => y(Math.min(v, y.domain()[1]));
    const line = d3.line().x((q) => x(q.d)).y((q) => cy(q.y));
    for (const s of pts) {
      svg.append('path').datum(s.v).attr('fill', 'none').attr('stroke', s.c).attr('stroke-width', 2).attr('stroke-linecap', 'round').attr('stroke-linejoin', 'round').attr('d', line);
      svg.append('g').selectAll('circle').data(s.v).join('circle').attr('cx', (q) => x(q.d)).attr('cy', (q) => cy(q.y)).attr('r', s.v.length < 3 ? 4 : 2.5).attr('fill', s.c);
    }
    const tip = document.createElement('div'); tip.className = 'ah-tip'; tip.hidden = true; el.append(tip);
    const rule = svg.append('line').attr('y1', 8).attr('y2', H - 24).attr('stroke', 'var(--cds-chart-axis)').style('display', 'none');
    svg.append('rect').attr('x', L).attr('y', 0).attr('width', W - L - R).attr('height', H - 24).attr('fill', 'transparent')
      .on('mousemove', (ev) => {
        const [mx] = d3.pointer(ev);
        const d = d3.utcDay.round(x.invert(mx));
        const row = rows.find((q) => q.date === iso(d));
        if (!row) { tip.hidden = true; rule.style('display', 'none'); return; }
        rule.attr('x1', x(d)).attr('x2', x(d)).style('display', null);
        tip.replaceChildren();
        const h = document.createElement('div'); h.className = 'd'; h.textContent = row.day + ', ' + dLabel(row.date); tip.append(h);
        for (const [p, n, c] of series) {
          const ln = document.createElement('div');
          const sw = document.createElement('span'); sw.className = 'ah-dot'; sw.style.background = c; sw.style.marginRight = '6px';
          const second = isRoi ? 'gmv' : 'roi';
          ln.append(sw, n + ': ' + MET[m] + ' ' + (row[p + '_' + m] == null ? '—' : fmt(m, row[p + '_' + m], 'sum')) + ' · ' + MET[second] + ' ' + (row[p + '_' + second] == null ? '—' : fmt(second, row[p + '_' + second], 'sum')));
          tip.append(ln);
        }
        tip.hidden = false;
        const px = x(d) / W * el.clientWidth;
        tip.style.left = Math.max(0, Math.min(el.clientWidth - tip.offsetWidth, px + 12)) + 'px';
        tip.style.top = '8px';
      })
      .on('mouseleave', () => { tip.hidden = true; rule.style('display', 'none'); });
  });

  dash.calc('saldo_view', {
    title: 'Saldo dan perkiraan cukup berapa hari',
    description: 'Saldo akun iklan tiap brand, rata-rata spend 7 hari terakhir dari data harian, dan saldo tersedia dibagi rata-rata itu.',
    inputs: ['saldo', 'ads'],
    fn: (saldo, ads) => {
      const last = ads.map((r) => String(r.date).slice(0, 10)).sort().pop();
      const from = new Date(Date.parse(last + 'T00:00:00Z') - 6 * 864e5).toISOString().slice(0, 10);
      return saldo.map((s) => {
        const rows = ads.filter((r) => r.brand === s.brand && String(r.date).slice(0, 10) >= from && String(r.date).slice(0, 10) <= last);
        const avg7 = rows.length ? rows.reduce((a, r) => a + Number(r.spend), 0) / 7 : null;
        const cash = Number(s.cash);
        return {
          brand: s.brand, cash, total: Number(s.total), credit: Number(s.credit),
          avg7, days_left: s.payment.startsWith('GMV Pay') ? null : (avg7 ? cash / avg7 : null),
          cycle_spend: s.cycle_spend == null ? null : Number(s.cycle_spend),
          threshold: s.threshold == null ? null : Number(s.threshold),
          payment: s.payment,
          last_tx: s.last_tx_status + ' · ' + s.last_tx_type + ' Rp' + Number(s.last_tx_amount).toLocaleString('id-ID') + ' · ' + s.last_tx_time,
          checked_at: s.checked_at
        };
      });
    }
  });

  dash.draw('saldo-at', (el) => {
    const v = dash.data('saldo');
    if (v.status !== 'ok' || !v.data.length) { el.textContent = '—'; return; }
    const t = String(v.data[0].checked_at);
    el.textContent = Number(t.slice(8, 10)) + ' ' + MON[Number(t.slice(5, 7)) - 1] + ' ' + t.slice(0, 4) + ' ' + t.slice(11, 16);
  });

  dash.draw('saldo', (tb) => {
    const v = dash.data('saldo_view');
    if (v.status !== 'ok') { tb.replaceChildren(); return; }
    const money = (x) => x == null ? '' : 'Rp' + idr.format(x);
    tb.replaceChildren(...v.data.map((r) => {
      const tr = document.createElement('tr'); tr.dataset.key = r.brand;
      const cells = [
        [r.brand, 'l'], [money(r.cash)], [money(r.total)], [money(r.credit)], [money(r.avg7)],
        [r.days_left == null ? 'Dibayar GMV Pay' : one.format(r.days_left) + ' hari', r.days_left != null && r.days_left < 3 ? 'warn' : ''],
        [money(r.cycle_spend)], [money(r.threshold)], [r.payment, 'l'], [r.last_tx, 'l']
      ];
      for (const [txt, cls] of cells) { const td = document.createElement('td'); if (cls) td.className = cls; td.textContent = txt; tr.append(td); }
      return tr;
    }));
  });
