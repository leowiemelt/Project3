const MapViz = (() => {

  // California bounding box — must be identical in WMS request and D3 projection
  const WEST  = -124.48;
  const SOUTH =   32.53;
  const EAST  = -114.13;
  const NORTH =   42.01;

  const WMS = 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi';

  let _date    = null;
  let _layer   = 'MODIS_Terra_Thermal_Anomalies_Day';
  let _opacity = 0.85;
  let _W = 0, _H = 0;

  let _canvas, _ctx, _svg, _tooltip, _countyG, _path;

  // Image cache keyed by URL
  const _cache = new Map();

  function _url(layer, date) {
    const fmt = layer === 'MODIS_Terra_CorrectedReflectance_TrueColor'
      ? 'image/jpeg' : 'image/png';
    return `${WMS}?SERVICE=WMS&REQUEST=GetMap&VERSION=1.1.1` +
      `&LAYERS=${layer}` +
      `&SRS=EPSG:4326` +
      `&BBOX=${WEST},${SOUTH},${EAST},${NORTH}` +
      `&WIDTH=800&HEIGHT=800` +
      `&FORMAT=${fmt}` +
      `&TIME=${date}` +
      `&TRANSPARENT=true&STYLES=`;
  }

  function _load(url) {
    if (_cache.has(url)) return Promise.resolve(_cache.get(url));
    return new Promise(resolve => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload  = () => { _cache.set(url, img); resolve(img); };
      img.onerror = () => { resolve(null); };
      img.src = url;
    });
  }

  async function _draw() {
    if (!_date || !_layer) return;
    _ctx.clearRect(0, 0, _W, _H);

    // Always draw TrueColor basemap first
    const baseImg = await _load(_url('MODIS_Terra_CorrectedReflectance_TrueColor', _date));
    if (baseImg) {
      _ctx.globalAlpha = 1.0;
      _ctx.drawImage(baseImg, 0, 0, _W, _H);
    }

    // If a fire layer is selected, draw it on top with opacity
    if (_layer !== 'MODIS_Terra_CorrectedReflectance_TrueColor') {
      const fireImg = await _load(_url(_layer, _date));
      if (fireImg) {
        _ctx.globalAlpha = _opacity;
        _ctx.drawImage(fireImg, 0, 0, _W, _H);
        _ctx.globalAlpha = 1.0;
      }
    }
  }

  function _buildProj() {
    const el = document.getElementById('map-container');
    _W = el.clientWidth;
    _H = el.clientHeight;

    _canvas.width  = _W;
    _canvas.height = _H;
    _svg.attr('width', _W).attr('height', _H);

    // The bounding box as a GeoJSON polygon
    const bboxFeature = {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [WEST, SOUTH], [EAST, SOUTH],
          [EAST, NORTH], [WEST, NORTH],
          [WEST, SOUTH],
        ]]
      }
    };

    // fitExtent with [[0,0],[W,H]] — no margins — matches the WMS image exactly
    const proj = d3.geoEquirectangular()
      .fitExtent([[0, 0], [_W, _H]], bboxFeature);

    _path = d3.geoPath(proj);
  }

  // ── Counties ───────────────────────────────────────────────

  function loadCounties(geojson) {
    _svg.selectAll('g.county-layer').remove();
    _countyG = _svg.append('g').attr('class', 'county-layer');

    // State outline
    _countyG.append('path')
      .datum({ type: 'FeatureCollection', features: geojson.features })
      .attr('class', 'state-outline')
      .attr('d', _path);

    // County paths
    _countyG.selectAll('.county-path')
      .data(geojson.features)
      .join('path')
        .attr('class', 'county-path')
        .attr('d', _path)
        .on('mouseover', function(ev, d) {
          const name = d.properties.name || d.properties.NAME || 'Unknown';
          _showTip(ev, `<div class="tooltip-title">${name} County</div>Click for fire stats`);
        })
        .on('mousemove', function(ev, d) {
          const name = d.properties.name || d.properties.NAME || 'Unknown';
          _showTip(ev, `<div class="tooltip-title">${name} County</div>Click for fire stats`);
        })
        .on('mouseout', () => _hideTip())
        .on('click', function(ev, d) {
          ev.stopPropagation();
          _countyG.selectAll('.county-path').classed('selected', false);
          d3.select(this).classed('selected', true);
          const name = d.properties.name || d.properties.NAME || 'Unknown';
          Sidebar.selectCounty(name);
        });

    // Click SVG background → deselect
    _svg.on('click', () => {
      _countyG.selectAll('.county-path').classed('selected', false);
      document.getElementById('county-name').textContent = 'Click a county';
      document.getElementById('county-stats').style.display = 'none';
    });
  }


  function _showTip(ev, html) {
    _tooltip.innerHTML = html;
    _tooltip.classList.remove('hidden');
    const r = _canvas.getBoundingClientRect();
    let tx = ev.clientX - r.left + 12;
    let ty = ev.clientY - r.top  -  8;
    if (tx + 200 > _W) tx -= 212;
    if (ty < 0) ty = 4;
    _tooltip.style.left = `${tx}px`;
    _tooltip.style.top  = `${ty}px`;
  }

  function _hideTip() { _tooltip.classList.add('hidden'); }


  function setDate(date)   { _date    = date;          _draw(); }
  function setLayer(layer) { _layer   = layer;         _draw(); }
  function setOpacity(v)   { _opacity = parseFloat(v); _draw(); }

  function init() {
    _canvas  = document.getElementById('tile-canvas');
    _ctx = _canvas.getContext('2d');
    _svg = d3.select('#map-svg');
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