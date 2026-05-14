/**
 * main.js
 */

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
  console.log('calfire fields: ' + Object.keys(sample).join(', '));

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

  console.log(`calfire: ${all.length} fires, ${byCounty.size} counties`);
  if (byCounty.size === 0) console.warn('calfire: county field not matched — check field names above');

  const topFires = [...all].sort((a,b)=>b.acres-a.acres).slice(0,8);
  return { byMonth, byCounty, topFires, isFRP: false };
}

// ── Process fires.csv (monthly totals only, synchronous) ───────

let _spatialJob = null;

function processCsvData(rows, countiesGeo) {
  const byMonth  = new Map();
  const byCounty = new Map();

  const cols = Object.keys(rows[0] || {});
  console.log('fires.csv cols: ' + cols.join(', '));

  rows.forEach(r => {
    const date = r.acq_date || r.ACQ_DATE || '';
    const mo   = date.slice(0, 7);
    if (mo.length < 7) return;
    const frp = parseFloat(r.frp || r.FRP || 0) || 1;
    byMonth.set(mo, (byMonth.get(mo) || 0) + frp);
  });

  console.log(`fires.csv: ${rows.length} rows, ${byMonth.size} months`);
  console.log('months: ' + [...byMonth.keys()].sort().join(', '));

  _spatialJob = { rows, countiesGeo, byCounty };
  return { byMonth, byCounty, topFires: [], isFRP: true };
}

// ── Deferred spatial join (non-blocking, batched) ─────────────

function _runSpatialJoin() {
  if (!_spatialJob) return;
  const { rows, countiesGeo, byCounty } = _spatialJob;
  _spatialJob = null;
  console.log('spatial join starting…');

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
      console.log(`spatial join done: ${byCounty.size} counties`);
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
    console.log('loaded: ' + path);
    return r;
  } catch (e) {
    console.warn('failed: ' + path + ' (' + e.message + ')');
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

  console.log('fetching data files…');

  try {
    const [counties, geoFire, csvFire] = await Promise.all([
      tryLoad(d3.json, 'data/ca-counties.geojson'),
      tryLoad(d3.json, 'data/calfire.geojson'),
      tryLoad(d3.csv,  'data/fires.csv'),
    ]);

    if (!counties) throw new Error('ca-counties.geojson missing from data/');

    console.log('counties: ' + (counties.features?.length || 0) + ' features');

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
      console.log('no fire data — map only');
    }

    // Remove loading BEFORE any slow operations
    loadingEl.remove();
    console.log('init modules…');

    Layers.initButtons();
    Slider.init();
    MapViz.init();
    Sidebar.init(fireData);
    MapViz.loadCounties(counties);

    Slider.onChange(date  => MapViz.setDate(date));
    Layers.onChange(layer => MapViz.setLayer(layer));

    MapViz.setDate(Slider.getCurrentDate());
    MapViz.setLayer(Layers.getLayer());

    // Load hotspots AFTER setDate so _date is already set when dots render
    if (csvFire?.length) MapViz.loadHotspots(csvFire);

    console.log('ready!');

    if (_spatialJob) _runSpatialJoin();

  } catch (err) {
    console.warn('FATAL: ' + err.message);
    loadingEl.innerHTML = `
      <div class="loading-text" style="color:#f66;text-align:center;padding:20px;line-height:2">
        ⚠ ERROR: ${err.message}
      </div>`;
  }
}

document.addEventListener('DOMContentLoaded', main);