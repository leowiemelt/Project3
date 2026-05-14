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

function _countyKey(raw) {
  return raw.toLowerCase().replace(/\s*county\s*$/i, '').trim();
}

// Optional data calfire.json, fires.csv is backup data
function processGeoData(geojson) {
  const byMonth  = new Map(); 
  const byCounty = new Map(); 
  const all = [];

  if (geojson.features.length) {
    console.log('[calfire] Sample properties:', geojson.features[0].properties);
  }

  geojson.features.forEach(f => {
    const p = f.properties || {};
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
          fires: 0, acres: 0,
          largest: '—', largestAcres: 0,
          worstYear: year, worstAcres: 0,
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

  console.log(`[calfire] ${all.length} fires, ${byCounty.size} counties. Sample keys:`,
    [...byCounty.keys()].slice(0,6));

  const topFires = [...all].sort((a,b) => b.acres - a.acres).slice(0,8);
  return { byMonth, byCounty, topFires, isFRP: false };
}

function processCsvData(rows, countiesGeo) {
  const byMonth  = new Map(); 
  const byCounty = new Map(); 

  const countyFeatures = countiesGeo.features.map(f => ({
    feature: f,
    key: _countyKey(f.properties.name || f.properties.NAME || ''),
  }));


  let matched = 0;
  rows.forEach(r => {
    const date = r.acq_date || r.ACQ_DATE || '';
    const mo   = date.slice(0, 7); 
    if (!mo) return;

    const frp = parseFloat(r.frp || r.FRP || 0) || 1;
    byMonth.set(mo, (byMonth.get(mo) || 0) + frp);

    const lon = parseFloat(r.longitude || r.LONGITUDE);
    const lat = parseFloat(r.latitude  || r.LATITUDE);
    if (isNaN(lon) || isNaN(lat)) return;

    for (const { feature, key } of countyFeatures) {
      if (d3.geoContains(feature, [lon, lat])) {
        if (!byCounty.has(key)) byCounty.set(key, { hotspots:0, totalFRP:0, largest:'—' });
        const c = byCounty.get(key);
        c.hotspots++;
        c.totalFRP += frp;
        matched++;
        break;
      }
    }
  });

  console.log(`[fires.csv] ${rows.length} rows, ${matched} matched to counties, ${byCounty.size} counties`);
  return { byMonth, byCounty, topFires: [], isFRP: true };
}

function mergeCalfire(csvData, geoData) {
  geoData.byCounty.forEach((gStats, key) => {
    if (csvData.byCounty.has(key)) {
      const c = csvData.byCounty.get(key);
      c.largest   = gStats.largest;
      c.worstYear = gStats.worstYear;
    }
  });
  csvData.topFires = geoData.topFires;
}


async function tryLoad(fn, path) {
  try { return await fn(path); } catch { return null; }
}


async function main() {
  const container = document.getElementById('map-container');
  const loading = Object.assign(document.createElement('div'), {
    className: 'loading-overlay',
    innerHTML: '<div class="loading-text">LOADING DATA…</div>',
  });
  container.appendChild(loading);

  try {
    const [counties, geoFire, csvFire] = await Promise.all([
      d3.json('data/ca-counties.geojson'),
      tryLoad(d3.json, 'data/calfire.geojson'),
      tryLoad(d3.csv,  'data/fires.csv'),
    ]);

    if (!counties) throw new Error('ca-counties.geojson not found in data/');

    let fireData;
    let geoData = null;

    if (geoFire?.features?.length) {
      geoData = processGeoData(geoFire);
    }

    if (csvFire?.length) {
      fireData = processCsvData(csvFire, counties);
      if (geoData) mergeCalfire(fireData, geoData);
      console.log('Primary: fires.csv' + (geoData ? ' + calfire.geojson merged' : ''));
    } else if (geoData) {
      fireData = geoData;
      console.log('Primary: calfire.geojson only');
    } else {
      fireData = { byMonth: new Map(), byCounty: new Map(), topFires: [], isFRP: false };
      console.warn('No fire data found');
    }

    loading.remove();

    Layers.initButtons();
    Slider.init();
    MapViz.init();
    Sidebar.init(fireData);
    MapViz.loadCounties(counties);

    Slider.onChange(date  => MapViz.setDate(date));
    Layers.onChange(layer => MapViz.setLayer(layer));

    MapViz.setDate(Slider.getCurrentDate());
    MapViz.setLayer(Layers.getLayer());

  } catch (err) {
    loading.innerHTML = `
      <div class="loading-text" style="color:#f55;text-align:center;padding:20px;line-height:2">
        ⚠ LOAD ERROR<br>
        <span style="font-size:.55rem;color:#999">
          Required: <code>data/ca-counties.geojson</code><br>
          Optional: <code>data/fires.csv</code> · <code>data/calfire.geojson</code><br>
          Check console for details.
        </span>
      </div>`;
    console.error(err);
  }
}

document.addEventListener('DOMContentLoaded', main);