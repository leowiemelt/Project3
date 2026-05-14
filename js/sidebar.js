const Sidebar = (() => {
  let _fd = null;

  function _renderBarChart() {
    const svgEl = document.getElementById('bar-chart');
    const W = Math.max(svgEl.parentElement.clientWidth - 20, 180);
    const H = 150;
    const m = { top: 8, right: 6, bottom: 30, left: 46 };
    const iW = W - m.left - m.right;
    const iH = H - m.top  - m.bottom;

    const svg = d3.select('#bar-chart')
      .attr('viewBox', `0 0 ${W} ${H}`)
      .attr('width', W).attr('height', H);
    svg.selectAll('*').remove();

    const keys = Array.from(_fd.byMonth.keys()).sort();
    if (!keys.length) return;
    const vals = keys.map(k => _fd.byMonth.get(k) || 0);

    const xSc = d3.scaleBand().domain(keys).range([0, iW]).padding(0.15);
    const ySc = d3.scaleLinear().domain([0, d3.max(vals)]).nice().range([iH, 0]);

    const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);

    const monthAbbr = {'01':'J','02':'F','03':'M','04':'A','05':'M','06':'J',
                       '07':'J','08':'A','09':'S','10':'O','11':'N','12':'D'};
    g.append('g').attr('class','axis')
      .attr('transform', `translate(0,${iH})`)
      .call(d3.axisBottom(xSc).tickFormat(k => monthAbbr[k.slice(5)] || k).tickSize(3))
      .call(ax => ax.select('.domain').remove());

    const fmt = v => v >= 1e6 ? `${(v/1e6).toFixed(1)}M`
                   : v >= 1e3 ? `${(v/1e3).toFixed(0)}K` : Math.round(v);

    g.append('g').attr('class','axis')
      .call(d3.axisLeft(ySc).ticks(4).tickFormat(fmt).tickSize(-iW))
      .call(ax => {
        ax.select('.domain').remove();
        ax.selectAll('.tick line').attr('stroke','#242424');
      });

    g.selectAll('.bar').data(keys).join('rect')
      .attr('class','bar')
      .attr('data-month', d => d)
      .attr('x', d => xSc(d))
      .attr('y', d => ySc(_fd.byMonth.get(d) || 0))
      .attr('width', xSc.bandwidth())
      .attr('height', d => iH - ySc(_fd.byMonth.get(d) || 0))
      .on('click', (_, k) => Slider.jumpToYear(k.slice(0, 4)))
      .on('mouseover', function(ev, k) {
        const v = _fd.byMonth.get(k) || 0;
        const label = _fd.isFRP
          ? `${k}: ${d3.format(',.0f')(v)} MW FRP`
          : `${k}: ${d3.format(',.0f')(v)} acres`;
        _tip(ev, label);
      })
      .on('mouseout', _hideTip);
  }

  function _tip(ev, text) {
    const t = document.getElementById('map-tooltip');
    if (!t) return;
    t.innerHTML = text;
    t.classList.remove('hidden');
    t.style.position = 'fixed';
    t.style.left = `${ev.clientX + 10}px`;
    t.style.top  = `${ev.clientY - 28}px`;
  }
  function _hideTip() { document.getElementById('map-tooltip')?.classList.add('hidden'); }

  function _renderTopFires() {
    const list = document.getElementById('top-fires-list');
    list.innerHTML = '';
    const fires = _fd.topFires || [];
    if (!fires.length) {
      list.innerHTML = '<li style="color:#555;font-family:var(--mono);font-size:.62rem;padding:8px 0;list-style:none">No named records in dataset</li>';
      return;
    }
    fires.slice(0, 8).forEach(f => {
      const li = document.createElement('li');
      li.innerHTML = `
        <span class="fire-name" title="${f.name}">${f.name}</span>
        <span class="fire-acres">${d3.format(',.0f')(f.acres)} ac</span>
        <span class="fire-year">${f.year}</span>`;
      list.appendChild(li);
    });
  }

  function selectCounty(countyName) {
    document.getElementById('county-name').textContent = countyName;
    const key = countyName.toLowerCase().replace(/\s*county\s*$/i,'').trim();
    const stats = _fd.byCounty.get(key);
    const el = document.getElementById('county-stats');
    if (!stats) { el.style.display = 'none'; return; }
    el.style.display = 'block';

    if (_fd.isFRP) {
      document.getElementById('lbl-fires').textContent   = 'Hotspot detections';
      document.getElementById('lbl-acres').textContent   = 'Total FRP (MW)';
      document.getElementById('lbl-largest').textContent = 'Largest named fire';
      document.getElementById('lbl-worst').textContent   = 'Year';
      document.getElementById('stat-fires').textContent  = d3.format(',')(stats.hotspots);
      document.getElementById('stat-acres').textContent  = d3.format(',.0f')(stats.totalFRP);
      document.getElementById('stat-largest').textContent = stats.largest || '—';
      document.getElementById('stat-worst-year').textContent = '2020';
    } else {
      document.getElementById('lbl-fires').textContent   = 'Fires on record';
      document.getElementById('lbl-acres').textContent   = 'Total acres burned';
      document.getElementById('lbl-largest').textContent = 'Largest fire';
      document.getElementById('lbl-worst').textContent   = 'Worst year';
      document.getElementById('stat-fires').textContent  = d3.format(',')(stats.fires);
      document.getElementById('stat-acres').textContent  = d3.format(',.0f')(stats.acres) + ' ac';
      document.getElementById('stat-largest').textContent = stats.largest || '—';
      document.getElementById('stat-worst-year').textContent = stats.worstYear || '—';
    }
  }

  function init(fireData) {
    _fd = fireData;
    const lbl = document.getElementById('chart-label');
    if (lbl) lbl.textContent = _fd.isFRP
      ? 'MONTHLY FIRE RADIATIVE POWER — 2020 (MW)'
      : 'ACRES BURNED BY YEAR';
    _renderBarChart();
    _renderTopFires();
  }

  return { init, selectCounty };
})();