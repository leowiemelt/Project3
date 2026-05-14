const Layers = (() => {

  const LAYER_DEFS = {
    'MODIS_Terra_Thermal_Anomalies_Day': {
      id:        'MODIS_Terra_Thermal_Anomalies_Day',
      matrixSet: '1km',
      ext:       'png',
      isOverlay: true,
    },
    'MODIS_Terra_Thermal_Anomalies_Night': {
      id:        'MODIS_Terra_Thermal_Anomalies_Night',
      matrixSet: '1km',
      ext:       'png',
      isOverlay: true,
    },
    'MODIS_Terra_CorrectedReflectance_TrueColor': {
      id:        'MODIS_Terra_CorrectedReflectance_TrueColor',
      matrixSet: '250m',
      ext:       'jpg',
      isOverlay: false,
    },
  };

  const BASEMAP_DEF = LAYER_DEFS['MODIS_Terra_CorrectedReflectance_TrueColor'];

  let _activeLayerId = 'MODIS_Terra_Thermal_Anomalies_Day';
  const _listeners   = [];

  // ── URL builder ────────────────────────────────────────────

  function tileUrl(layerId, date, z, y, x) {
    const def = LAYER_DEFS[layerId];
    if (!def) return '';
    return `https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/${def.id}/default/${date}/${def.matrixSet}/${z}/${y}/${x}.${def.ext}`;
  }

  // ── Render stack ───────────────────────────────────────────
  // Returns layers in draw order: basemap first, overlays on top.

  function getRenderStack() {
    const active = LAYER_DEFS[_activeLayerId];
    if (!active.isOverlay) return [active];          // TrueColor only
    return [BASEMAP_DEF, active];                    // TrueColor + fire overlay
  }

  // ── Accessors ──────────────────────────────────────────────

  function getLayer()    { return _activeLayerId; }
  function getLayerDef() { return LAYER_DEFS[_activeLayerId]; }

  // ── Mutation ───────────────────────────────────────────────

  function setLayer(layerId) {
    if (layerId === _activeLayerId || !LAYER_DEFS[layerId]) return;
    _activeLayerId = layerId;
    _listeners.forEach(fn => fn(_activeLayerId));
  }

  function onChange(fn) { _listeners.push(fn); }

  // ── DOM button wiring ──────────────────────────────────────

  function initButtons() {
    document.querySelectorAll('.layer-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.layer-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        setLayer(btn.dataset.layer);
      });
    });
  }

  return { tileUrl, getLayer, getLayerDef, getRenderStack, setLayer, onChange, initButtons, LAYER_DEFS };
})();