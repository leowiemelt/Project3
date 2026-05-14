const MapViz = (() => {

  const WEST  = -124.48;
  const SOUTH =   32.53;
  const EAST  = -114.13;
  const NORTH =   42.01;

  const WMS_PX = 800;

  // GIBS WMS base URL
  const WMS_BASE = 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi';

  const LAYER_FORMAT = {
    'MODIS_Terra_Thermal_Anomalies_Day':   'image/png',
    'MODIS_Terra_Thermal_Anomalies_Night': 'image/png',
    'MODIS_Terra_CorrectedReflectance_TrueColor': 'image/jpeg',
  };

  let _date = null;
  let _layer = null;
  let _opacity = 0.85;
  let _proj = null;
  let _path = null;
  let _geo = null;
  let _W = 0,  _H = 0;

  // Canvas, SVG refs
  let _canvas, _ctx, _mapSvg, _countyG, _tooltip;

  const _imgCache = new Map();

  function _buildProj() {
    const el = document.getElementById('map-container');
    _W = el.clientWidth  || 800;
    _H = el.clientHeight || 520;

    _canvas.width  = _W;
    _canvas.height = _H;

    _mapSvg
      .attr('width',  _W)
      .attr('height', _H);

    const caFeature = {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [WEST,  SOUTH],
          [EAST,  SOUTH],
          [EAST,  NORTH],
          [WEST,  NORTH],
          [WEST,  SOUTH],
        ]]
      }
    };

    _proj = d3.geoEquirectangular()
      .fitExtent([[0, 0], [_W, _H]], caFeature);

    _path = d3.geoPath(_proj);
  }

  function _wmsUrl(layer, date) {
    const fmt = LAYER_FORMAT[layer] || 'image/png';
    const params = new URLSearchParams({
      SERVICE:     'WMS',
      REQUEST:     'GetMap',
      VERSION:     '1.1.1',
      LAYERS:      layer,
      SRS:         'EPSG:4326',
      BBOX:        `${WEST},${SOUTH},${EAST},${NORTH}`,
      WIDTH:       WMS_PX,
      HEIGHT:      WMS_PX,
      FORMAT:      fmt,
      TIME:        date,
      TRANSPARENT: 'true',
      STYLES:      '',
    });
    return `${WMS_BASE}?${params.toString()}`;
  }

  function _loadImage(url) {
    if (_imgCache.has(url)) {
      return Promise.resolve(_imgCache.get(url));
    }
    return new Promise(resolve => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload  = () => { _imgCache.set(url, img); resolve(img); };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }


  async function _draw() {
    if (!_date || !_layer) return;
    _ctx.clearRect(0, 0, _W, _H);

    const baseUrl = _wmsUrl('MODIS_Terra_CorrectedReflectance_TrueColor', _date);
    const baseImg = await _loadImage(baseUrl);
    if (baseImg) {
      _ctx.globalAlpha = 1.0;
      _ctx.drawImage(baseImg, 0, 0, _W, _H);
    }

    if (_layer !== 'MODIS_Terra_CorrectedReflectance_TrueColor') {
      const fireUrl = _wmsUrl(_layer, _date);
      const fireImg = await _loadImage(fireUrl);
      if (fireImg) {
        _ctx.globalAlpha = _opacity;
        _ctx.drawImage(fireImg, 0, 0, _W, _H);
        _ctx.globalAlpha = 1.0;
      }
    }
  }

  function loadCounties(geojson) {
    _geo = geojson;

    _mapSvg.selectAll('g.county-layer').remove();
    _countyG = _mapSvg.append('g').attr('class', 'county-layer');

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

    // Click on SVG background → deselect
    _mapSvg.on('click', function() {
      _countyG.selectAll('.county-path').classed('selected', false);
      document.getElementById('county-name').textContent = 'Click a county';
      document.getElementById('county-stats').style.display = 'none';
    });

    // Set up zoom AFTER counties are drawn
    _setupZoom();
  }

  function _setupZoom() {
    const zoom = d3.zoom()
      .scaleExtent([1, 12])
      .on('zoom', ev => {
        _countyG.attr('transform', ev.transform);
      });

    _mapSvg.call(zoom);

    // Fit California to fill the viewport on load (no extra zoom needed)
    _mapSvg.call(zoom.transform, d3.zoomIdentity);
  }


  function _showTip(ev, html) {
    _tooltip.innerHTML = html;
    _tooltip.classList.remove('hidden');
    const r = _canvas.getBoundingClientRect();
    let tx = ev.clientX - r.left + 12;
    let ty = ev.clientY - r.top  - 8;
    if (tx + 200 > _W) tx = tx - 200 - 24;
    if (ty < 0) ty = 4;
    _tooltip.style.left = `${tx}px`;
    _tooltip.style.top  = `${ty}px`;
  }

  function _hideTip() {
    _tooltip.classList.add('hidden');
  }

  function setDate(date) {
    _date = date;
    _draw();
  }

  function setLayer(layer) {
    _layer = layer;
    _draw();
  }

  function setOpacity(v) {
    _opacity = parseFloat(v);
    _draw();
  }

  function init() {
    _canvas = document.getElementById('tile-canvas');
    _ctx = _canvas.getContext('2d');
    _mapSvg = d3.select('#map-svg');
    _tooltip = document.getElementById('map-tooltip');

    _buildProj();
    _layer = Layers.getLayer();

    // Opacity slider
    document.getElementById('opacity-slider')
      ?.addEventListener('input', e => setOpacity(e.target.value));

    // Redraw on resize
    window.addEventListener('resize', () => {
      _buildProj();
      // Redraw county paths with new projection
      if (_geo) {
        _countyG.selectAll('.county-path').attr('d', _path);
        _countyG.select('.state-outline').attr('d', _path);
      }
      _draw();
    });
  }

  return { init, setDate, setLayer, setOpacity, loadCounties };
})();