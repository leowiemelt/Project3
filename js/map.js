function _countyKey(raw) {
  return (raw || '').toLowerCase().replace(/\s*county\s*$/i, '').trim();
}

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

  console.log('[calfire] feature count:', geojson.features.length);
  if (geojson.features.length > 0) {
    console.log('[calfire] sample properties:', geojson.features[0].properties);
  }

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

  console.log(`[calfire] processed: ${all.length} fires, ${byMonth.size} year-months, ${byCounty.size} counties`);
  if (byCounty.size > 0) {
    console.log('[calfire] sample county keys:', [...byCounty.keys()].slice(0,6));
  }

  const topFires = [...all].sort((a,b)=>b.acres-a.acres).slice(0,8);
  return { byMonth, byCounty, topFires, isFRP: false };
}

// ── Process fires.csv ─────────────────────────────────────────
// Only computes monthly totals synchronously.
// County spatial join runs deferred (non-blocking) after render.

let _spatialJob = null; // holds { rows, countiesGeo, byCounty } for deferred join

function processCsvData(rows, countiesGeo) {
  const byMonth  = new Map();
  const byCounty = new Map(); // filled in by _runSpatialJoin later

  console.log(`[fires.csv] ${rows.length} rows. Column names:`, Object.keys(rows[0] || {}));

  rows.forEach(r => {
    const date = r.acq_date || r.ACQ_DATE || '';
    const mo   = date.slice(0, 7);
    if (mo.length < 7) return;
    const frp = parseFloat(r.frp || r.FRP || 0) || 1;
    byMonth.set(mo, (byMonth.get(mo) || 0) + frp);
  });

  console.log('[fires.csv] months found:', [...byMonth.keys()].sort());

  // Store job for after render
  _spatialJob = { rows, countiesGeo, byCounty };

  return { byMonth, byCounty, topFires: [], isFRP: true };
}

// ── Deferred spatial join ─────────────────────────────────────
// Runs in 200-row batches so it doesn't freeze the page.

function _runSpatialJoin() {
  if (!_spatialJob) return;
  const { rows, countiesGeo, byCounty } = _spatialJob;
  _spatialJob = null;

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
          if (!byCounty.has(key)) {
            byCounty.set(key, { hotspots:0, totalFRP:0, largest:'—' });
          }
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
      console.log(`[spatial join] complete — ${byCounty.size} counties matched`);
    }
  }

  setTimeout(step, 100); // start after first paint
}

// ── Merge calfire stats into CSV data ─────────────────────────

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
    const result = await fn(path);
    console.log(`[load] ✓ ${path}`);
    return result;
  } catch (e) {
    console.warn(`[load] ✗ ${path}:`, e.message);
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

  try {
    console.log('[main] fetching data files…');

    const [counties, geoFire, csvFire] = await Promise.all([
      tryLoad(d3.json, 'data/ca-counties.geojson'),
      tryLoad(d3.json, 'data/calfire.geojson'),
      tryLoad(d3.csv,  'data/fires.csv'),
    ]);

    if (!counties) {
      throw new Error('ca-counties.geojson failed to load — check it exists in data/');
    }

    console.log('[main] counties loaded:', counties.features?.length, 'features');

    // Pick best data source
    let fireData;
    let geoData = null;

    if (geoFire?.features?.length) {
      geoData = processGeoData(geoFire);
    }

    if (csvFire?.length) {
      fireData = processCsvData(csvFire, counties);
      if (geoData) _mergeCalfire(fireData, geoData);
      console.log('[main] using fires.csv' + (geoData ? ' + calfire merged' : ''));
    } else if (geoData) {
      fireData = geoData;
      console.log('[main] using calfire.geojson only');
    } else {
      fireData = { byMonth: new Map(), byCounty: new Map(), topFires: [], isFRP: false };
      console.warn('[main] no fire data found — map will show satellite imagery only');
    }

    // Remove loading indicator NOW — before anything slow
    loadingEl.remove();
    console.log('[main] initializing modules…');

    Layers.initButtons();
    Slider.init();
    MapViz.init();
    Sidebar.init(fireData);
    MapViz.loadCounties(counties);

    Slider.onChange(date  => MapViz.setDate(date));
    Layers.onChange(layer => MapViz.setLayer(layer));

    MapViz.setDate(Slider.getCurrentDate());
    MapViz.setLayer(Layers.getLayer());

    console.log('[main] ready.');

    // Start spatial join in background (non-blocking)
    if (_spatialJob) _runSpatialJoin();

  } catch (err) {
    console.error('[main] fatal error:', err);
    loadingEl.innerHTML = `
      <div class="loading-text" style="color:#f66;text-align:center;padding:20px;line-height:2">
        ⚠ LOAD ERROR<br>
        <span style="font-size:.58rem;color:#999;display:block;margin-top:8px">
          ${err.message}<br><br>
          Required: <code>data/ca-counties.geojson</code><br>
          Optional: <code>data/fires.csv</code> · <code>data/calfire.geojson</code><br>
          Open DevTools → Console for details.
        </span>
      </div>`;
  }
}

document.addEventListener('DOMContentLoaded', main);