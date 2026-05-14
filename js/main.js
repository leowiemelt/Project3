
function processCsvData(rows) {
  const byYear   = new Map();
  const byCounty = new Map(); 
  const topFires = [];  

  rows.forEach(r => {
    const date = r.acq_date || r.ACQ_DATE || '';
    const year = date.slice(0, 4);
    if (!year || year < '2000' || year > '2024') return;

    const frp = parseFloat(r.frp || r.FRP || 0);

    byYear.set(year, (byYear.get(year) || 0) + Math.max(frp, 1));
  });

  return { byYear, byCounty, topFires, isFRP: true };
}

const FIELD_YEAR = ['YEAR_', 'YEAR', 'FIRE_YEAR', 'year'];
const FIELD_ACRES = ['GIS_ACRES', 'AcresBurned', 'ACRES', 'acres', 'Shape_Area'];
const FIELD_NAME = ['FIRE_NAME', 'FIRENAME', 'name', 'Name', 'FIRE_NAM'];
const FIELD_COUNTY = ['COUNTY', 'County', 'county', 'UNIT_ID', 'COUNTY'];

function _pick(props, candidates) {
  for (const c of candidates) {
    if (props[c] !== undefined && props[c] !== null && String(props[c]).trim() !== '') {
      return props[c];
    }
  }
  return null;
}

function processGeoJsonData(geojson) {
  const byYear = new Map();
  const byCounty = new Map();
  const allFires = [];

  geojson.features.forEach(f => {
    const p     = f.properties || {};
    const year  = _pick(p, FIELD_YEAR)  ? String(_pick(p, FIELD_YEAR)).slice(0, 4) : null;
    const acres = parseFloat(_pick(p, FIELD_ACRES)) || 0;
    const name  = String(_pick(p, FIELD_NAME) || 'Unknown').trim();
    const cty   = String(_pick(p, FIELD_COUNTY) || 'UNKNOWN').trim().toUpperCase();

    if (!year || +year < 2000 || +year > 2024 || acres <= 0) return;

    byYear.set(year, (byYear.get(year) || 0) + acres);

    if (!byCounty.has(cty)) {
      byCounty.set(cty, { fires: 0, acres: 0, largest: '', largestAcres: 0, worstYear: year, worstAcres: 0 });
    }
    const c = byCounty.get(cty);
    c.fires++;
    c.acres += acres;
    if (acres > c.largestAcres) {
      c.largestAcres = acres;
      c.largest = `${name} (${d3.format(',.0f')(acres)} ac)`;
    }
    if (acres > c.worstAcres) { c.worstAcres = acres; c.worstYear = year; }

    allFires.push({ name, acres, year, county: cty });
  });

  if (allFires.length === 0) {
    console.warn('[calfire.geojson] No records matched. First feature props:',
      geojson.features[0]?.properties);
  } else {
    console.log(`[calfire.geojson] ${allFires.length} fires, ${byYear.size} years`);
  }

  const topFires = [...allFires].sort((a, b) => b.acres - a.acres).slice(0, 8);
  return { byYear, byCounty, topFires, isFRP: false };
}

// ── Try loading a file, return null on 404 ───────────────────
async function tryLoad(loader, path) {
  try {
    return await loader(path);
  } catch {
    return null;
  }
}

// ── Main bootstrap ───────────────────────────────────────────
async function main() {
  const mapContainer = document.getElementById('map-container');
  const loadingEl = document.createElement('div');
  loadingEl.className = 'loading-overlay';
  loadingEl.innerHTML = '<div class="loading-text">LOADING FIRE DATA…</div>';
  mapContainer.appendChild(loadingEl);

  try {
    // Load all three files; calfire.geojson is optional
    const [countiesGeo, fireGeo, fireCsv] = await Promise.all([
      d3.json('data/ca-counties.geojson'),          // required
      tryLoad(d3.json, 'data/calfire.geojson'),      // optional
      tryLoad(d3.csv,  'data/fires.csv'),            // optional
    ]);

    if (!countiesGeo) throw new Error('ca-counties.geojson not found in data/');

    // Pick the best available data source for statistics
    let fireData;
    if (fireGeo && fireGeo.features?.length > 0) {
      console.log('Using calfire.geojson for statistics');
      fireData = processGeoJsonData(fireGeo);
    } else if (fireCsv && fireCsv.length > 0) {
      console.log('calfire.geojson not found — using fires.csv (FRP) for statistics');
      fireData = processCsvData(fireCsv);
    } else {
      // No fire stats data at all — still show the map, just empty sidebar
      console.warn('No fire data found. Map will still show GIBS tiles.');
      fireData = { byYear: new Map(), byCounty: new Map(), topFires: [], isFRP: false };
    }

    loadingEl.remove();

    // Update bar chart label if we're using FRP instead of acres
    if (fireData.isFRP) {
      document.querySelector('.chart-card .card-label').innerHTML =
        'FIRE RADIATIVE POWER PER YEAR (MW) <span class="card-sublabel">· click bar to jump</span>';
    }

    // Initialize all modules
    Layers.initButtons();
    Slider.init();
    MapViz.init();
    Sidebar.init(fireData);
    MapViz.loadCounties(countiesGeo);

    // Wire cross-module events
    Slider.onChange(date  => MapViz.setDate(date));
    Layers.onChange(layer => MapViz.setLayer(layer));

    // Trigger initial render
    MapViz.setDate(Slider.getCurrentDate());
    MapViz.setLayer(Layers.getLayer());

  } catch (err) {
    loadingEl.innerHTML = `
      <div class="loading-text" style="color:#ff4444;text-align:center;padding:24px;max-width:360px;line-height:1.8">
        ⚠ ERROR LOADING DATA<br>
        <span style="font-size:0.55rem;color:#999;display:block;margin-top:10px">
          <strong style="color:#bbb">Required:</strong> data/ca-counties.geojson<br>
          <strong style="color:#bbb">Optional:</strong> data/fires.csv · data/calfire.geojson<br><br>
          See README.md for download links.<br>
          Open DevTools → Console for details.
        </span>
      </div>
    `;
    console.error('Bootstrap error:', err);
  }
}

document.addEventListener('DOMContentLoaded', main);