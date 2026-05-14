const MapViz = (() => {

  const CA_BOUNDS  = [-124.48, 32.53, -114.13, 42.01];
  const PAD = 1.0;                               
  const Z_FIRE = 5;
  const Z_TRUECOLOR = 7;

  let _date = null;
  let _layer = null;
  let _opacity = 0.85;
  let _transform = d3.zoomIdentity;
  let _proj = null;
  let _path = null;
  let _geo = null;

  let _canvas, _ctx, _svg, _tooltip;
  let _W, _H;

  const _cache = new Map();


  function _setupProj() {
    const el = document.getElementById('map-container');
    _W = el.clientWidth;
    _H = el.clientHeight;
    _canvas.width = _W;
    _canvas.height = _H;
    _svg.attr('width', _W).attr('height', _H);

    _proj = d3.geoEquirectangular()
      .fitExtent([[28, 28], [_W - 28, _H - 28]], {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [CA_BOUNDS[0], CA_BOUNDS[1]],
            [CA_BOUNDS[2], CA_BOUNDS[1]],
            [CA_BOUNDS[2], CA_BOUNDS[3]],
            [CA_BOUNDS[0], CA_BOUNDS[3]],
            [CA_BOUNDS[0], CA_BOUNDS[1]],
          ]]
        }
      });

    _path = d3.geoPath(_proj);
  }

  function _lonLatToTile(lon, lat, z) {
    const nX = Math.pow(2, z + 1);
    const nY = Math.pow(2, z);
    return {
      x: Math.floor((lon + 180) / 360 * nX),
      y: Math.floor((90  - lat) / 180 * nY),
    };
  }

  function _tileOrigin(tx, ty, z) {
    const nX = Math.pow(2, z + 1);
    const nY = Math.pow(2, z);
    return {
      lon: tx / nX * 360 - 180,
      lat: 90 - ty / nY * 180,
    };
  }

  function _zoom(layerDef) {
    const base = layerDef.matrixSet === '250m' ? Z_TRUECOLOR : Z_FIRE;
    return Math.min(base, base + Math.floor(Math.log2(_transform.k)));
  }


  function _loadTile(layerId, date, z, ty, tx) {
    const key = `${layerId}/${date}/${z}/${ty}/${tx}`;
    if (_cache.has(key)) return _cache.get(key);
    const url = Layers.tileUrl(layerId, date, z, ty, tx);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const p = new Promise(res => {
      img.onload = () => res(img);
      img.onerror = () => res(null);
      img.src = url;
    });
    _cache.set(key, p);
    return p;
  }


  function _applyZoom(pt) {
    if (!pt) return null;
    return [_transform.x + pt[0] * _transform.k, _transform.y + pt[1] * _transform.k];
  }

  async function _renderLayer(layerDef, date, alpha) {
    const z = _zoom(layerDef);
    const tl = _lonLatToTile(CA_BOUNDS[0] - PAD, CA_BOUNDS[3] + PAD, z);
    const br = _lonLatToTile(CA_BOUNDS[2] + PAD, CA_BOUNDS[1] - PAD, z);
    const ps = [];

    for (let ty = tl.y; ty <= br.y; ty++) {
      for (let tx = tl.x; tx <= br.x; tx++) {
        ps.push(
          _loadTile(layerDef.id, date, z, ty, tx).then(img => {
            if (!img) return;
            const { lon: l0, lat: a0 } = _tileOrigin(tx,     ty,     z);
            const { lon: l1, lat: a1 } = _tileOrigin(tx + 1, ty + 1, z);
            const p0 = _applyZoom(_proj([l0, a0]));
            const p1 = _applyZoom(_proj([l1, a1]));
            if (!p0 || !p1) return;
            const [px, py, pw, ph] = [p0[0], p0[1], p1[0] - p0[0], p1[1] - p0[1]];
            if (px + pw < 0 || px > _W || py + ph < 0 || py > _H) return;
            _ctx.globalAlpha = alpha;
            _ctx.drawImage(img, px, py, pw, ph);
          })
        );
      }
    }
    await Promise.all(ps);
  }

  async function _renderTiles() {
    if (!_date || !_layer) return;
    _ctx.clearRect(0, 0, _W, _H);
    for (const layerDef of Layers.getRenderStack()) {
      await _renderLayer(layerDef, _date, layerDef.isOverlay ? _opacity : 1.0);
    }
    _ctx.globalAlpha = 1.0;
  }

  function _renderCounties() {
    if (!_geo) return;
    const g = _svg.select('g.county-layer');
    const zp = d3.geoTransform({
      point(lon, lat) {
        const [px, py] = _proj([lon, lat]);
        this.stream.point(
          _transform.x + px * _transform.k,
          _transform.y + py * _transform.k
        );
      }
    });
    const pf = d3.geoPath(zp);
    g.selectAll('.county-path').attr('d', d => pf(d));
    g.select('.state-outline').attr('d', pf({ type: 'FeatureCollection', features: _geo.features }));
  }

  function _setupZoom() {
    _svg.call(
      d3.zoom()
        .scaleExtent([0.8, 25])
        .on('zoom', e => {
          _transform = e.transform;
          _renderCounties();
          _renderTiles();
        })
    );
  }


  function _tip(ev, html) {
    _tooltip.innerHTML = html;
    _tooltip.classList.remove('hidden');
    const r  = document.getElementById('map-container').getBoundingClientRect();
    let tx = ev.clientX - r.left + 14;
    let ty = ev.clientY - r.top  - 10;
    if (tx + 190 > _W) tx -= 218;
    if (ty + 60  > _H) ty  = _H - 70;
    _tooltip.style.left = `${tx}px`;
    _tooltip.style.top  = `${ty}px`;
  }

  function _hideTip() { _tooltip.classList.add('hidden'); }


  function loadCounties(geojson) {
    _geo = geojson;
    const g = _svg.append('g').attr('class', 'county-layer');

    g.append('path')
      .datum({ type: 'FeatureCollection', features: geojson.features })
      .attr('class', 'state-outline')
      .attr('d', _path);

    g.selectAll('.county-path')
      .data(geojson.features)
      .join('path')
        .attr('class', 'county-path')
        .attr('d', d => _path(d))
        .on('mouseover', function(ev, d) {
          const name = d.properties.name || d.properties.NAME || 'Unknown';
          _tip(ev, `<div class="tooltip-title">${name} County</div>Click for fire stats`);
          document.getElementById('county-hover-label').textContent = name;
        })
        .on('mousemove', function(ev, d) {
          const name = d.properties.name || d.properties.NAME || 'Unknown';
          _tip(ev, `<div class="tooltip-title">${name} County</div>Click for fire stats`);
        })
        .on('mouseout', () => {
          _hideTip();
          document.getElementById('county-hover-label').textContent = '—';
        })
        .on('click', function(ev, d) {
          _svg.selectAll('.county-path').classed('selected', false);
          d3.select(this).classed('selected', true);
          const name = d.properties.name || d.properties.NAME || 'Unknown';
          Sidebar.selectCounty(name);
          ev.stopPropagation();
        });

    _svg.on('click', () => {
      _svg.selectAll('.county-path').classed('selected', false);
      document.getElementById('county-name').textContent = 'Click a county';
      document.getElementById('county-stats').style.display = 'none';
      document.getElementById('county-hover-label').textContent = '—';
    });
  }


  function setDate(date)    { _date    = date;            _renderTiles(); }
  function setLayer(layer)  { _layer   = layer;           _renderTiles(); }
  function setOpacity(v)    { _opacity = parseFloat(v);   _renderTiles(); }

  function init() {
    _canvas  = document.getElementById('tile-canvas');
    _ctx = _canvas.getContext('2d');
    _svg = d3.select('#map-svg');
    _tooltip = document.getElementById('map-tooltip');

    _setupProj();
    _setupZoom();
    _layer = Layers.getLayer();

    document.getElementById('opacity-slider')
      ?.addEventListener('input', e => setOpacity(e.target.value));

    window.addEventListener('resize', () => {
      _setupProj();
      _renderCounties();
      _renderTiles();
    });
  }

  return { init, setDate, setLayer, setOpacity, loadCounties };
})();