const Slider = (() => {
  const START = '2020-01-01';
  const END   = '2020-12-31';

  let _dates = [], _idx = 0, _playing = false, _timer = null, _speed = 600;
  const _listeners = [];
  let _sliderEl, _playBtn, _dateDisplay, _speedSelect, _ticksEl;

  function _generateDates() {
    const out = [];
    const d = new Date(START + 'T00:00:00Z');
    const e = new Date(END   + 'T00:00:00Z');
    while (d <= e) {
      out.push(d.toISOString().slice(0, 10));
      d.setUTCDate(d.getUTCDate() + 1);
    }
    return out;
  }

  function _fmt(d) {
    const [y, m, day] = d.split('-');
    const mo = ['JAN','FEB','MAR','APR','MAY','JUN',
                'JUL','AUG','SEP','OCT','NOV','DEC'];
    return `${mo[+m - 1]} ${+day}, ${y}`;
  }

  function _setIdx(i) {
    _idx = Math.max(0, Math.min(i, _dates.length - 1));
    _sliderEl.value = _idx;
    _dateDisplay.textContent = _fmt(_dates[_idx]);
    const mo = _dates[_idx].slice(0, 7);
    document.querySelectorAll('.bar').forEach(b =>
      b.classList.toggle('active-year', b.dataset.month === mo));
    _listeners.forEach(fn => fn(_dates[_idx]));
  }

  function _start() {
    if (_idx >= _dates.length - 1) _setIdx(0);
    _playing = true;
    _playBtn.textContent = '⏸';
    _timer = setInterval(() => {
      if (_idx >= _dates.length - 1) { _stop(); return; }
      _setIdx(_idx + 1);
    }, _speed);
  }

  function _stop() {
    _playing = false;
    _playBtn.textContent = '▶';
    clearInterval(_timer);
    _timer = null;
  }

  function onChange(fn)     { _listeners.push(fn); }
  function getCurrentDate() { return _dates[_idx]; }

  function jumpToYear(year) {
    const i = _dates.findIndex(d => d.startsWith(String(year)));
    if (i !== -1) _setIdx(i);
  }

  function init() {
    _dates       = _generateDates();
    _sliderEl    = document.getElementById('date-slider');
    _playBtn     = document.getElementById('play-btn');
    _dateDisplay = document.getElementById('date-display');
    _speedSelect = document.getElementById('speed-select');
    _ticksEl     = document.getElementById('year-ticks');

    _sliderEl.min = 0;
    _sliderEl.max = _dates.length - 1;

    const def = _dates.findIndex(d => d === '2020-08-15');
    _setIdx(def !== -1 ? def : 226);

    _sliderEl.addEventListener('input', () => {
      if (_playing) _stop();
      _setIdx(+_sliderEl.value);
    });
    _playBtn.addEventListener('click', () => _playing ? _stop() : _start());
    _speedSelect.addEventListener('change', () => {
      _speed = +_speedSelect.value;
      if (_playing) { _stop(); _start(); }
    });

    ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
      .forEach(m => {
        const s = document.createElement('span');
        s.className = 'year-tick';
        s.textContent = m;
        _ticksEl.appendChild(s);
      });
  }

  return { init, onChange, getCurrentDate, jumpToYear };
})();