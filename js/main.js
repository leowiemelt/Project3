
async function tryFetch(loader, path) {
  try { return await loader(path); } catch { return null; }
}


function buildCountyStats(rows, countiesGeo) {
  const byCounty = new Map();

  // Precompute normalized county names
  const features = countiesGeo.features.map(f => ({
    feature: f,
    key: (f.properties.name || '').toLowerCase().trim(),
  }));

  rows.forEach(r => {
    const lon = parseFloat(r.longitude);
    const lat = parseFloat(r.latitude);
    const frp = parseFloat(r.frp) || 1;
    const brightness = parseFloat(r.brightness) || 0;
    if (isNaN(lon) || isNaN(lat)) return;

    for (const { feature, key } of features) {
      if (d3.geoContains(feature, [lon, lat])) {
        if (!byCounty.has(key)) {
          byCounty.set(key, { hotspots: 0, totalFRP: 0, maxFRP: 0 });
        }
        const c = byCounty.get(key);
        c.hotspots++;
        c.totalFRP += frp;
        if (frp > c.maxFRP) c.maxFRP = frp;
        break;
      }
    }
  });

  return byCounty;
}

function buildByMonth(rows) {
  const byMonth = new Map();
  rows.forEach(r => {
    const date = r.acq_date || '';
    const month = date.slice(0, 7); // "2020-08"
    if (!month) return;
    const frp = parseFloat(r.frp) || 1;
    byMonth.set(month, (byMonth.get(month) || 0) + frp);
  });
  return byMonth;
}


async function main() {
  const container = document.getElementById('map-container');
  const loading = Object.assign(document.createElement('div'), {
    className: 'loading-overlay',
    innerHTML: '<div class="loading-text">LOADING DATA…</div>',
  });
  container.appendChild(loading);

  try {
    const [counties, csvFire, geoFire] = await Promise.all([
      d3.json('data/ca-counties.geojson'),
      tryFetch(d3.csv,  'data/fires.csv'),
      tryFetch(d3.json, 'data/calfire.geojson'),
    ]);

    if (!counties) throw new Error('ca-counties.geojson missing from data/');

    const rows = csvFire || [];

    // Build stats from CSV spatial join
    const byCounty = rows.length
      ? buildCountyStats(rows, counties)
      : new Map();

    // Bar chart: monthly FRP totals
    const byYear = buildByMonth(rows);

    // Top fires from calfire.geojson if available
    let topFires = [];
    if (geoFire?.features?.length) {
      const FIELD_ACRES = ['GIS_ACRES','AcresBurned','ACRES','acres'];
      const FIELD_NAME  = ['FIRE_NAME','FIRENAME','name','Name'];
      const pick = (p, ks) => { for (const k of ks) if (p[k]) return String(p[k]).trim(); return null; };
      topFires = geoFire.features
        .map(f => ({
          name:  pick(f.properties, FIELD_NAME)  || 'Unknown',
          acres: parseFloat(pick(f.properties, FIELD_ACRES)) || 0,
          year:  String(f.properties.YEAR_ || f.properties.YEAR || '').slice(0,4),
        }))
        .filter(f => f.acres > 0)
        .sort((a,b) => b.acres - a.acres)
        .slice(0, 8);
    }

    loading.remove();

    const fireData = { byYear, byCounty, topFires, isFRP: true };

    Layers.initButtons();
    Slider.init();
    MapViz.init();
    Sidebar.init(fireData);
    MapViz.loadCounties(counties);
    MapViz.loadFires(rows);  

    Slider.onChange(date  => MapViz.setDate(date));
    Layers.onChange(layer => MapViz.setLayer(layer));

    // First render
    MapViz.setDate(Slider.getCurrentDate());
    MapViz.setLayer(Layers.getLayer());

  } catch (err) {
    loading.innerHTML = `
      <div class="loading-text" style="color:#f55;text-align:center;padding:20px;line-height:1.9">
        ⚠ LOAD ERROR<br>
        <span style="font-size:.55rem;color:#999">
          Required: <code>data/ca-counties.geojson</code><br>
          Optional: <code>data/fires.csv</code> · <code>data/calfire.geojson</code>
        </span>
      </div>`;
    console.error(err);
  }
}

document.addEventListener('DOMContentLoaded', main);