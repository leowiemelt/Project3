const Sidebar = (() => {
  let _fireData = null;

  function _renderBarChart() {
    const svgEl = document.getElementById('bar-chart');
    const W = Math.max(svgEl.parentElement.clientWidth - 24, 180);
    const H = 150;
    const m = { top: 8, right: 6, bottom: 32, left: 44 };
    const iW = W - m.left - m.right;
    const iH = H - m.top  - m.bottom;

    const svg = d3.select('#bar-chart')
      .attr('viewBox', `0 0 ${W} ${H}`)
      .attr('width',  W)
      .attr('height', H);
    svg.selectAll('*').remove();

    const keys = Array.from(_fireData.byYear.keys()).sort();
    if (!keys.length) return;

    const vals = keys.map(k => _fireData.byYear.get(k) || 0);

    // Label months as Jan–Dec on the x-axis
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun',
                        'Jul','Aug','Sep','Oct','Nov','Dec'];
    const xLabels = keys.map(k => {
      const m = parseInt(k.slice(5, 7), 10);
      return monthNames[m - 1] || k;
    });

    const xScale = d3.scaleBand().domain(keys).range([0, iW]).padding(0.15);
    const yScale = d3.scaleLinear().domain([0, d3.max(vals)]).nice().range([iH, 0]);

    const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);

    g.append('g')
      .attr('class', 'axis')
      .attr('transform', `translate(0,${iH})`)
      .call(
        d3.axisBottom(xScale)
          .tickValues(keys)
          .tickFormat((k, i) => xLabels[i])
          .tickSize(3)
      )
      .call(ax => {
        ax.select('.domain').remove();
        ax.selectAll('text')
          .style('font-size', '0.48rem')
          .attr('dy', '1em');
      });

    // Y axis
    g.append('g')
      .attr('class', 'axis')
      .call(
        d3.axisLeft(yScale)
          .ticks(4)
          .tickFormat(v => v >= 1e3 ? `${(v/1e3).toFixed(0)}K` : Math.round(v))
          .tickSize(-iW)
      )
      .call(ax => {
        ax.select('.domain').remove();
        ax.selectAll('.tick line').attr('stroke', '#242424');
      });

    // Bars
    g.selectAll('.bar')
      .data(keys)
      .join('rect')
        .attr('class', 'bar')
        .attr('data-year', d => d.slice(0,4))
        .attr('x',      d => xScale(d))
        .attr('y',      d => yScale(_fireData.byYear.get(d) || 0))
        .attr('width',  xScale.bandwidth())
        .attr('height', d => iH - yScale(_fireData.byYear.get(d) || 0))
        .on('click', (_, k) => Slider.jumpToYear(k.slice(0,4)))
        .on('mouseover', function(ev, k) {
          const v = _fireData.byYear.get(k) || 0;
          const mo = monthNames[parseInt(k.slice(5,7),10) - 1];
          _showTip(ev, `${mo} 2020: ${d3.format(',.0f')(v)} MW FRP`);
        })
        .on('mouseout', _hideTip);
  }

  function _showTip(ev, text) {
    const tip = document.getElementById('map-tooltip');
    if (!tip) return;
    tip.innerHTML = text;
    tip.classList.remove('hidden');
    tip.style.position = 'fixed';
    tip.style.left = `${ev.clientX + 10}px`;
    tip.style.top  = `${ev.clientY - 28}px`;
  }

  function _hideTip() {
    document.getElementById('map-tooltip')?.classList.add('hidden');
  }

  // ── Top fires list ─────────────────────────────────────────

  function _renderTopFires() {
    const list = document.getElementById('top-fires-list');
    list.innerHTML = '';
    const fires = _fireData.topFires || [];
    if (!fires.length) {
      list.innerHTML = '<li style="color:#555;font-family:var(--font-mono);font-size:.6rem;padding:8px 0;list-style:none">No named fire data available</li>';
      return;
    }
    fires.forEach(fire => {
      const li = document.createElement('li');
      li.innerHTML = `
        <span class="fire-name" title="${fire.name}">${fire.name}</span>
        <span class="fire-acres">${d3.format(',.0f')(fire.acres)} ac</span>
        <span class="fire-year">${fire.year}</span>
      `;
      list.appendChild(li);
    });
  }


  function selectCounty(countyName) {
    document.getElementById('county-name').textContent = countyName;

    const key = countyName.toLowerCase().replace(/\s*county\s*$/i, '').trim();
    const stats = _fireData.byCounty.get(key);

    const statsEl = document.getElementById('county-stats');
    if (!stats) {
      statsEl.style.display = 'block';
      document.getElementById('stat-fires').textContent      = '0 detections';
      document.getElementById('stat-acres').textContent      = '0 MW';
      document.getElementById('stat-largest').textContent    = '—';
      document.getElementById('stat-worst-year').textContent = '2020';
      return;
    }

    statsEl.style.display = 'block';
    document.getElementById('stat-fires').textContent      = d3.format(',')(stats.hotspots) + ' detections';
    document.getElementById('stat-acres').textContent      = d3.format(',.1f')(stats.totalFRP) + ' MW total';
    document.getElementById('stat-largest').textContent    = d3.format(',.1f')(stats.maxFRP) + ' MW peak';
    document.getElementById('stat-worst-year').textContent = '2020';
  }

  // ── Update stat row labels for FRP mode ───────────────────

  function _setStatLabels() {
    const labels = document.querySelectorAll('#county-stats .stat-label');
    if (labels[0]) labels[0].textContent = 'Hotspot detections';
    if (labels[1]) labels[1].textContent = 'Total FRP (MW)';
    if (labels[2]) labels[2].textContent = 'Peak single FRP';
    if (labels[3]) labels[3].textContent = 'Year';
  }

  // ── Public ─────────────────────────────────────────────────

  function init(fireData) {
    _fireData = fireData;

    // Update bar chart label
    const label = document.querySelector('.chart-card .card-label');
    if (label) label.textContent = 'FIRE RADIATIVE POWER BY MONTH — 2020';

    _setStatLabels();
    _renderBarChart();
    _renderTopFires();
  }

  return { init, selectCounty };
})();