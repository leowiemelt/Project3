const FIELD_YEAR  = ['YEAR_', 'YEAR', 'FIRE_YEAR', 'year'];
const FIELD_ACRES = ['GIS_ACRES', 'AcresBurned', 'ACRES', 'acres'];
const FIELD_NAME  = ['FIRE_NAME', 'name', 'Name', 'FIRENAME'];
const FIELD_COUNTY = ['COUNTY', 'County', 'county', 'UNIT_ID'];

function _pick(props, candidates) {
  for (const c of candidates) {
    if (props[c] !== undefined && props[c] !== null && props[c] !== '') {
      return props[c];
    }
  }
  return null;
}

function processFireData(geojson) {
  const byYear = new Map();
  const byCounty = new Map();
  const allFires = [];

  geojson.features.forEach(f => {
    const p = f.properties || {};

    const rawYear  = _pick(p, FIELD_YEAR);
    const rawAcres = _pick(p, FIELD_ACRES);
    const rawName  = _pick(p, FIELD_NAME);
    const rawCounty = _pick(p, FIELD_COUNTY);

    const year  = rawYear  ? String(rawYear).slice(0, 4) : null;
    const acres = rawAcres ? parseFloat(rawAcres) : 0;
    const name  = rawName  ? String(rawName).trim() : 'Unknown Fire';
    const county = rawCounty ? String(rawCounty).trim().toUpperCase() : 'UNKNOWN';

    if (!year || isNaN(parseInt(year)) || parseInt(year) < 2000 || parseInt(year) > 2024) return;
    if (acres <= 0) return;

    // Aggregate by year
    byYear.set(year, (byYear.get(year) || 0) + acres);

    // Aggregate by county
    if (!byCounty.has(county)) {
      byCounty.set(county, {
        fires: 0, acres: 0,
        largest: '', largestAcres: 0,
        worstYear: year, worstAcres: 0,
      });
    }
    const c = byCounty.get(county);
    c.fires++;
    c.acres += acres;
    if (acres > c.largestAcres) {
      c.largestAcres = acres;
      c.largest = `${name} (${d3.format(',.0f')(acres)} ac)`;
    }
    if (acres > c.worstAcres) {
      c.worstAcres = acres;
      c.worstYear = year;
    }

    allFires.push({ name, acres, year, county });
  });

  const topFires = allFires
    .sort((a, b) => b.acres - a.acres)
    .slice(0, 8);

  if (allFires.length === 0) {
    console.warn(
      'processFireData: No fire records found after filtering.\n' +
      'Check that your calfire.geojson has the expected fields.\n' +
      'Expected year field (one of):', FIELD_YEAR, '\n' +
      'Expected acres field (one of):', FIELD_ACRES
    );
    if (geojson.features.length > 0) {
      console.log('First feature properties:', geojson.features[0].properties);
    }
  } else {
    console.log(`processFireData: ${allFires.length} fires processed across ${byYear.size} years`);
    console.log('Sample years:', Array.from(byYear.keys()).sort().slice(0, 5));
  }

  return { byYear, byCounty, topFires };
}


async function main() {
  const mapContainer = document.getElementById('map-container');
  const loadingEl = document.createElement('div');
  loadingEl.className = 'loading-overlay';
  loadingEl.innerHTML = '<div class="loading-text">LOADING FIRE DATA…</div>';
  mapContainer.appendChild(loadingEl);

  try {
    const [countiesGeo, fireGeo] = await Promise.all([
      d3.json('data/ca-counties.geojson'),
      d3.json('data/calfire.geojson'),
    ]);

    loadingEl.remove();

    // Process fire statistics
    const fireData = processFireData(fireGeo);

    // Initialize all modules
    Layers.initButtons();
    Slider.init();
    MapViz.init();
    Sidebar.init(fireData);

    // Load county boundaries onto the map
    MapViz.loadCounties(countiesGeo);

    Slider.onChange(date => MapViz.setDate(date));
    Layers.onChange(layer => MapViz.setLayer(layer));

    MapViz.setDate(Slider.getCurrentDate());
    MapViz.setLayer(Layers.getLayer());

  } catch (err) {
    loadingEl.innerHTML = `
      <div class="loading-text" style="color:#ff4444;text-align:center;padding:24px;max-width:340px">
        ⚠ ERROR LOADING DATA<br>
        <span style="font-size:0.55rem;color:#888;display:block;margin-top:10px;line-height:1.6">
          Make sure these files exist in your /data/ folder:<br>
          <code style="color:#aaa">ca-counties.geojson</code><br>
          <code style="color:#aaa">calfire.geojson</code><br><br>
          See README.md for download instructions.<br>
          Check the browser console for details.
        </span>
      </div>
    `;
    console.error('Failed to load data:', err);
  }
}

document.addEventListener('DOMContentLoaded', main);