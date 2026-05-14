/**
 * main.js — with on-page debug log (no DevTools needed)
 *
 * A small log panel appears in the top-right corner showing exactly
 * what loaded and what failed. Remove the _log() calls once working.
 */

// ── On-page debug log ─────────────────────────────────────────

const _debugEl = (() => {
  const el = document.createElement('div');
  el.style.cssText = [
    'position:fixed', 'top:8px', 'right:8px', 'z-index:9999',
    'background:rgba(0,0,0,0.88)', 'color:#0f0', 'font:11px monospace',
    'padding:10px 14px', 'border-radius:4px', 'max-width:340px',
    'max-height:260px', 'overflow-y:auto', 'line-height:1.6',
    'border:1px solid #333', 'pointer-events:none',
  ].join(';');
  document.addEventListener('DOMContentLoaded', () => document.body.appendChild(el));
  return el;
})();

function _log(msg, color) {
  const line = document.createElement('div');
  line.style.color = color || '#0f0';
  line.textContent = msg;
  _debugEl.appendChild(line);
  _debugEl.scrollTop = _debugEl.scrollHeight;
}

function _err(msg) { _log('✗ ' + msg, '#f66'); }
function _ok(msg)  { _log('✓ ' + msg, '#0f0'); }
function _info(msg){ _log('· ' + msg, '#aaa'); }

// ── County key normalizer ─────────────────────────────────────
function _countyKey(raw) {
  return (raw || '').toLowerCase().replace(/\s*county\s*$/i, '').trim();
}

// ── CAL FIRE field candidates ─────────────────────────────────
const F_YEAR   = ['YEAR_','YEAR','FIRE_YEAR','year'];
const F_ACRES  = ['GIS_ACRES','AcresBurned','ACRES','acres'];
const F_NAME   = ['FIRE_NAME','FIRENAME','name','Name','FIRE_NAM'];
const F_COUNTY = ['COUNTY','County','county','COUNTY_NAME'];

function _pick(p, keys) {
  for (const k of keys) {
    const v = p[k];
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  return null;
}

// ── Process calfire.geojson ───────────────────────────────────

function processGeoData(geojson) {
  const byMonth  = new Map();
  const byCounty = new Map();
  const all      = [];

  const sample = geojson.features[0]?.properties || {};
  _info('calfire fields: ' + Object.keys(sample).join(', '));

  geojson.features.forEach(f => {
    const p    = f.properties || {};
    const rawY = _pick(p, F_YEAR);
    const rawA = _pick(p, F_ACRES);
    const rawN = _pick(p, F_NAME);
    const rawC = _pick(p, F_COUNTY);

    const year  = rawY ? String(rawY).slice(0,4) : null;
    const acres = parseFloat(rawA) || 0;
    const name  = rawN || 'Unknown';
    const ckey  = rawC ? _countyKey(rawC) : null;

    if (!year || +year < 1980 || +year > 2024 || acres <= 0) return;

    const moKey = year + '-01';
    byMonth.set(moKey, (byMonth.get(moKey) || 0) + acres);

    if (ckey) {
      if (!byCounty.has(ckey)) {
        byCounty.set(ckey, {
          fires:0, acres:0, largest:'—', largestAcres:0,
          worstYear:year, worstAcres:0,
        });
      }
      const c = byCounty.get(ckey);
      c.fires++;
      c.acres += acres;
      if (acres > c.largestAcres) {
        c.largestAcres = acres;
        c.largest = `${name} (${d3.format(',.0f')(acres)} ac)`;
      }
      if (acres > c.worstAcres) { c.worstAcres = acres; c.worstYear = year; }
    }
    all.push({ name, acres, year });
  });

  _ok(`calfire: ${all.length} fires, ${byCounty.size} counties`);
  if (byCounty.size === 0) _err('calfire: county field not matched — check field names above');

  const topFires = [...all].sort((a,b)=>b.acres-a.acres).slice(0,8);
  return { byMonth, byCounty, topFires, isFRP: false };
}

// ── Process fires.csv (monthly totals only, synchronous) ───────

let _spatialJob = null;

function processCsvData(rows, countiesGeo) {
  const byMonth  = new Map();
  const byCounty = new Map();

  const cols = Object.keys(rows[0] || {});
  _info('fires.csv cols: ' + cols.join(', '));

  rows.forEach(r => {
    const date = r.acq_date || r.ACQ_DATE || '';
    const mo   = date.slice(0, 7);
    if (mo.length < 7) return;
    const frp = parseFloat(r.frp || r.FRP || 0) || 1;
    byMonth.set(mo, (byMonth.get(mo) || 0) + frp);
  });

  _ok(`fires.csv: ${rows.length} rows, ${byMonth.size} months`);
  _info('months: ' + [...byMonth.keys()].sort().join(', '));

  _spatialJob = { rows, countiesGeo, byCounty };
  return { byMonth, byCounty, topFires: [], isFRP: true };
}

// ── Deferred spatial join (non-blocking, batched) ─────────────

function _runSpatialJoin() {
  if (!_spatialJob) return;
  const { rows, countiesGeo, byCounty } = _spatialJob;
  _spatialJob = null;
  _info('spatial join starting…');

  const features = countiesGeo.features.map(f => ({
    feature: f,
    key: _countyKey(f.properties.name || f.properties.NAME || ''),
  }));

  const BATCH = 250;
  let i = 0;

  function step() {
    const end = Math.min(i + BATCH, rows.length);
    for (; i < end; i++) {
      const r   = rows[i];
      const lon = parseFloat(r.longitude || r.LONGITUDE);
      const lat = parseFloat(r.latitude  || r.LATITUDE);
      if (isNaN(lon) || isNaN(lat)) continue;
      for (const { feature, key } of features) {
        if (d3.geoContains(feature, [lon, lat])) {
          if (!byCounty.has(key)) byCounty.set(key, { hotspots:0, totalFRP:0, largest:'—' });
          const c = byCounty.get(key);
          c.hotspots++;
          c.totalFRP += (parseFloat(r.frp || r.FRP || 0) || 1);
          break;
        }
      }
    }
    if (i < rows.length) {
      setTimeout(step, 0);
    } else {
      _ok(`spatial join done: ${byCounty.size} counties`);
    }
  }
  setTimeout(step, 100);
}

// ── Merge calfire into CSV data ───────────────────────────────

function _mergeCalfire(csvData, geoData) {
  geoData.byCounty.forEach((gs, key) => {
    const c = csvData.byCounty.get(key);
    if (c) { c.largest = gs.largest; c.worstYear = gs.worstYear; }
  });
  csvData.topFires = geoData.topFires;
}

// ── Safe load ─────────────────────────────────────────────────

async function tryLoad(fn, path) {
  try {
    const r = await fn(path);
    _ok('loaded: ' + path);
    return r;
  } catch (e) {
    _err('failed: ' + path + ' (' + e.message + ')');
    return null;
  }
}

// ── Bootstrap ─────────────────────────────────────────────────

async function main() {
  const container = document.getElementById('map-container');
  const loadingEl = Object.assign(document.createElement('div'), {
    className: 'loading-overlay',
    innerHTML: '<div class="loading-text">LOADING DATA…</div>',
  });
  container.appendChild(loadingEl);

  _info('fetching data files…');

  try {
    const [counties, geoFire, csvFire] = await Promise.all([
      tryLoad(d3.json, 'data/ca-counties.geojson'),
      tryLoad(d3.json, 'data/calfire.geojson'),
      tryLoad(d3.csv,  'data/fires.csv'),
    ]);

    if (!counties) throw new Error('ca-counties.geojson missing from data/');

    _ok('counties: ' + (counties.features?.length || 0) + ' features');

    let fireData, geoData = null;

    if (geoFire?.features?.length) {
      geoData = processGeoData(geoFire);
    }

    if (csvFire?.length) {
      fireData = processCsvData(csvFire, counties);
      if (geoData) _mergeCalfire(fireData, geoData);
    } else if (geoData) {
      fireData = geoData;
    } else {
      fireData = { byMonth: new Map(), byCounty: new Map(), topFires: [], isFRP: false };
      _info('no fire data — map only');
    }

    // Remove loading BEFORE any slow operations
    loadingEl.remove();
    _info('init modules…');

    Layers.initButtons();
    Slider.init();
    MapViz.init();
    Sidebar.init(fireData);
    MapViz.loadCounties(counties);

    // Pass raw CSV rows to map for SVG dot rendering
    if (csvFire?.length) MapViz.loadHotspots(csvFire);

    Slider.onChange(date  => MapViz.setDate(date));
    Layers.onChange(layer => MapViz.setLayer(layer));

    MapViz.setDate(Slider.getCurrentDate());
    MapViz.setLayer(Layers.getLayer());

    _ok('ready!');

    if (_spatialJob) _runSpatialJoin();

  } catch (err) {
    _err('FATAL: ' + err.message);
    loadingEl.innerHTML = `
      <div class="loading-text" style="color:#f66;text-align:center;padding:20px;line-height:2">
        ⚠ ERROR: ${err.message}<br>
        <span style="font-size:.6rem;color:#999">See debug panel (top-right)</span>
      </div>`;
  }
}

document.addEventListener('DOMContentLoaded', main);