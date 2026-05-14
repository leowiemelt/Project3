const Slider = (() => {
  let _dates       = [];
  let _currentIdx  = 0;
  let _playing     = false;
  let _intervalId  = null;
  let _speed       = 900;

  const _listeners = [];

  let _sliderEl, _playBtn, _dateDisplay, _speedSelect, _yearTicksEl;

  // ── Date list ──────────────────────────────────────────────

  function _generateDates() {
    const dates = [];
    for (let year = 2000; year <= 2024; year++) {
      for (let month = 1; month <= 12; month++) {
        dates.push(`${year}-${String(month).padStart(2,'0')}-01`);
      }
    }
    return dates;
  }

  function _formatDisplay(d) {
    const [year, month] = d.split('-');
    const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    return `${months[parseInt(month)-1]} ${year}`;
  }

  // ── Core update ────────────────────────────────────────────

  function _setIndex(idx) {
    _currentIdx = Math.max(0, Math.min(idx, _dates.length - 1));
    _sliderEl.value = _currentIdx;
    _dateDisplay.textContent = _formatDisplay(_dates[_currentIdx]);

    // Highlight matching bar in chart
    const yr = _dates[_currentIdx].slice(0, 4);
    document.querySelectorAll('.bar').forEach(b => {
      b.classList.toggle('active-year', b.dataset.year === yr);
    });

    _listeners.forEach(fn => fn(_dates[_currentIdx]));
  }

  // ── Playback ───────────────────────────────────────────────

  function _start() {
    if (_currentIdx >= _dates.length - 1) _setIndex(0);
    _playing = true;
    _playBtn.textContent = '⏸';
    _intervalId = setInterval(() => {
      if (_currentIdx >= _dates.length - 1) { _stop(); return; }
      _setIndex(_currentIdx + 1);
    }, _speed);
  }

  function _stop() {
    _playing = false;
    _playBtn.textContent = '▶';
    clearInterval(_intervalId);
    _intervalId = null;
  }


  function jumpToYear(year) {
    const idx = _dates.findIndex(d => d.startsWith(String(year)));
    if (idx !== -1) _setIndex(idx);
  }

  function onChange(fn)      { _listeners.push(fn); }
  function getCurrentDate()  { return _dates[_currentIdx]; }

  function _buildTicks() {
    const years = [...new Set(_dates.map(d => d.slice(0,4)))];
    years.forEach((yr, i) => {
      if (i % 4 !== 0) return;
      const span = document.createElement('span');
      span.className = 'year-tick';
      span.textContent = yr;
      _yearTicksEl.appendChild(span);
    });
  }

  function init() {
    _dates        = _generateDates();
    _sliderEl     = document.getElementById('date-slider');
    _playBtn      = document.getElementById('play-btn');
    _dateDisplay  = document.getElementById('date-display');
    _speedSelect  = document.getElementById('speed-select');
    _yearTicksEl  = document.getElementById('year-ticks');

    _sliderEl.min = 0;
    _sliderEl.max = _dates.length - 1;

    // Default: peak fire season 2020
    const def = _dates.findIndex(d => d === '2020-08-01');
    _setIndex(def !== -1 ? def : 0);

    _sliderEl.addEventListener('input', () => {
      if (_playing) _stop();
      _setIndex(parseInt(_sliderEl.value));
    });

    _playBtn.addEventListener('click', () => _playing ? _stop() : _start());

    _speedSelect.addEventListener('change', () => {
      _speed = parseInt(_speedSelect.value);
      if (_playing) { _stop(); _start(); }
    });

    _buildTicks();
  }

  return { init, onChange, jumpToYear, getCurrentDate };
})();