const MapViz = (() => {

  // California bounding box — same values used in WMS BBOX param
  const W = -124.48, S = 32.53, E = -114.13, N = 42.01;

  const WMS = 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi';

  let _date    = null;
  let _layer   = 'MODIS_Terra_Thermal_Anomalies_Day';
  let _opacity = 0.85;
  let _W = 0, _H = 0;
  let _drawId  = 0;  // cancel stale async draws

  let _canvas, _ctx, _svg, _tooltip, _countyG, _path;

  const _cache = new Map(); // url → Promise<HTMLImageElement|null>


  function _buildProj() {
    const el = document.getElementById('map-container');
    _W = el.clientWidth  || 800;
    _H = el.clientHeight || 520;
    _canvas.width  = _W;
    _canvas.height = _H;
    _svg.attr('width', _W).attr('height', _H);

    const kx = _W / (E - W); // px per degree longitude
    const ky = _H / (N - S); // px per degree latitude

    const proj = d3.geoTransform({
      point(lon, lat) {
        this.stream.point(
          (lon - W) * kx,
          (N - lat) * ky
        );
      }
    });
    _path = d3.geoPath(proj);
  }

  // ── WMS URL ────────────────────────────────────────────────

  function _url(layer, date) {
    const fmt = layer === 'MODIS_Terra_CorrectedReflectance_TrueColor'
      ? 'image/jpeg' : 'image/png';
    return `${WMS}?SERVICE=WMS&REQUEST=GetMap&VERSION=1.1.1` +
      `&LAYERS=${encodeURIComponent(layer)}&SRS=EPSG:4326` +
      `&BBOX=${W},${S},${E},${N}&WIDTH=800&HEIGHT=800` +
      `&FORMAT=${encodeURIComponent(fmt)}&TIME=${date}` +
      `&TRANSPARENT=true&STYLES=`;
  }

  // ── Image cache ────────────────────────────────────────────

  function _load(url) {
    if (_cache.has(url)) return _cache.get(url);
    const p = new Promise(resolve => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload  = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    });
    _cache.set(url, p);
    return p;
  }

  // ── Draw ───────────────────────────────────────────────────

  function _draw() {
    if (!_date || !_layer) return;
    const id = ++_drawId;

    const baseUrl = _url('MODIS_Terra_CorrectedReflectance_TrueColor', _date);
    const fireUrl = _layer !== 'MODIS_Terra_CorrectedReflectance_TrueColor'
      ? _url(_layer, _date) : null;

    Promise.all([_load(baseUrl), fireUrl ? _load(fireUrl) : Promise.resolve(null)])
      .then(([baseImg, fireImg]) => {
        if (id !== _drawId) return; // superseded
        _ctx.clearRect(0, 0, _W, _H);
        if (baseImg) {
          _ctx.globalAlpha = 1.0;
          _ctx.drawImage(baseImg, 0, 0, _W, _H);
        }
        if (fireImg) {
          _ctx.globalAlpha = _opacity;
          _ctx.drawImage(fireImg, 0, 0, _W, _H);
          _ctx.globalAlpha = 1.0;
        }
      });
  }

  // ── Counties ───────────────────────────────────────────────

  function loadCounties(geojson) {
    _svg.selectAll('g.county-layer').remove();
    _countyG = _svg.append('g').attr('class', 'county-layer');

    _countyG.append('path')
      .datum({ type: 'FeatureCollection', features: geojson.features })
      .attr('class', 'state-outline')
      .attr('d', _path);

    _countyG.selectAll('.county-path')
      .data(geojson.features)
      .join('path')
        .attr('class', 'county-path')
        .attr('d', _path)
        .on('mouseover', function(ev, d) {
          const name = d.properties.name || d.properties.NAME || '';
          document.getElementById('county-hover-label').textContent = name;
          _showTip(ev, `<div class="tooltip-title">${name} County</div>Click for stats`);
        })
        .on('mousemove', function(ev, d) {
          const name = d.properties.name || d.properties.NAME || '';
          _showTip(ev, `<div class="tooltip-title">${name} County</div>Click for stats`);
        })
        .on('mouseout', () => {
          document.getElementById('county-hover-label').textContent = '—';
          _hideTip();
        })
        .on('click', function(ev, d) {
          ev.stopPropagation();
          _countyG.selectAll('.county-path').classed('selected', false);
          d3.select(this).classed('selected', true);
          Sidebar.selectCounty(d.properties.name || d.properties.NAME || '');
        });

    // Deselect on background click
    _svg.on('click', () => {
      _countyG.selectAll('.county-path').classed('selected', false);
      document.getElementById('county-name').textContent = 'Click a county';
      document.getElementById('county-stats').style.display = 'none';
    });
  }

  // ── Tooltip ────────────────────────────────────────────────

  function _showTip(ev, html) {
    _tooltip.innerHTML = html;
    _tooltip.classList.remove('hidden');
    const r = _canvas.getBoundingClientRect();
    let tx = ev.clientX - r.left + 12;
    let ty = ev.clientY - r.top  - 8;
    if (tx + 200 > _W) tx -= 212;
    if (ty < 0) ty = 4;
    _tooltip.style.left = `${tx}px`;
    _tooltip.style.top  = `${ty}px`;
  }

  function _hideTip() { _tooltip.classList.add('hidden'); }

  // ── Public API ─────────────────────────────────────────────

  function setDate(date)   { _date    = date;          _draw(); }
  function setLayer(layer) { _layer   = layer;         _draw(); }
  function setOpacity(v)   { _opacity = parseFloat(v); _draw(); }

  function init() {
    _canvas  = document.getElementById('tile-canvas');
    _ctx     = _canvas.getContext('2d');
    _svg     = d3.select('#map-svg');
    _tooltip = document.getElementById('map-tooltip');

    _buildProj();
    _layer = Layers.getLayer();

    document.getElementById('opacity-slider')
      ?.addEventListener('input', e => setOpacity(e.target.value));

    window.addEventListener('resize', () => {
      _buildProj();
      if (_countyG) {
        _countyG.selectAll('.county-path').attr('d', _path);
        _countyG.select('.state-outline').attr('d', _path);
      }
      _draw();
    });
  }

  return { init, setDate, setLayer, setOpacity, loadCounties };
})();