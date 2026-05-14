const Layers = (() => {

  const VALID_LAYERS = new Set([
    'MODIS_Terra_Thermal_Anomalies_Day',
    'MODIS_Terra_Thermal_Anomalies_Night',
    'MODIS_Terra_CorrectedReflectance_TrueColor',
  ]);

  let _active    = 'MODIS_Terra_Thermal_Anomalies_Day';
  const _listeners = [];

  function getLayer() { return _active; }

  function setLayer(id) {
    if (!VALID_LAYERS.has(id) || id === _active) return;
    _active = id;
    _listeners.forEach(fn => fn(_active));
  }

  function onChange(fn) { _listeners.push(fn); }

  function initButtons() {
    document.querySelectorAll('.layer-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.layer-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        setLayer(btn.dataset.layer);
      });
    });
  }

  function tileUrl() { return ''; }
  function getRenderStack() { return []; }

  return { getLayer, setLayer, onChange, initButtons, tileUrl, getRenderStack };
})();