const Sidebar = (() => {
  let _fireData = null;


  function _renderBarChart() {
    const svgEl = document.getElementById('bar-chart');
    const W = svgEl.parentElement.clientWidth - 32;
    const H = 155;
    const m = { top: 6, right: 4, bottom: 22, left: 36 };
    const iW = W - m.left - m.right;
    const iH = H - m.top  - m.bottom;

    const svg = d3.select('#bar-chart')
      .attr('viewBox', `0 0 ${W} ${H}`)
      .attr('width', W)
      .attr('height', H);

    svg.selectAll('*').remove();

    const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);

    const years = Array.from(_fireData.byYear.keys()).sort();
    const vals  = years.map(y => _fireData.byYear.get(y) || 0);

    const xScale = d3.scaleBand().domain(years).range([0, iW]).padding(0.1);
    const yScale = d3.scaleLinear().domain([0, d3.max(vals)]).nice().range([iH, 0]);

    // X axis — tick every 4 years
    g.append('g')
      .attr('class', 'axis')
      .attr('transform', `translate(0,${iH})`)
      .call(
        d3.axisBottom(xScale)
          .tickValues(years.filter((_, i) => i % 4 === 0))
          .tickSize(0)
      )
      .call(ax => ax.select('.domain').remove());

    // Y axis with grid lines
    g.append('g')
      .attr('class', 'axis')
      .call(
        d3.axisLeft(yScale)
          .ticks(4)
          .tickFormat(v => v >= 1e6 ? `${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `${(v/1e3).toFixed(0)}K` : v)
          .tickSize(-iW)
      )
      .call(ax => {
        ax.select('.domain').remove();
        ax.selectAll('.tick line').attr('stroke', '#242424');
      });

    // Bars
    g.selectAll('.bar')
      .data(years)
      .join('rect')
        .attr('class', 'bar')
        .attr('data-year', d => d)
        .attr('x', d => xScale(d))
        .attr('y', d => yScale(_fireData.byYear.get(d) || 0))
        .attr('width', xScale.bandwidth())
        .attr('height', d => iH - yScale(_fireData.byYear.get(d) || 0))
        .on('click', (_, year) => Slider.jumpToYear(year))
        .on('mouseover', function(event, year) {
          const v = _fireData.byYear.get(year) || 0;
          _showBarTip(event, `${year}: ${d3.format(',')(Math.round(v))} acres`);
        })
        .on('mouseout', _hideBarTip);
  }

  function _showBarTip(event, text) {
    const tip = document.getElementById('map-tooltip');
    if (!tip) return;
    tip.innerHTML = text;
    tip.classList.remove('hidden');
    tip.style.position = 'fixed';
    tip.style.left = `${event.clientX + 10}px`;
    tip.style.top  = `${event.clientY - 28}px`;
  }

  function _hideBarTip() {
    document.getElementById('map-tooltip')?.classList.add('hidden');
  }


  function _renderTopFires() {
    const list = document.getElementById('top-fires-list');
    list.innerHTML = '';
    (_fireData.topFires || []).slice(0, 8).forEach(fire => {
      const li = document.createElement('li');
      li.innerHTML = `
        <span class="fire-name" title="${fire.name}">${fire.name}</span>
        <span class="fire-acres">${d3.format(',.0f')(fire.acres)}</span>
        <span class="fire-year">${fire.year}</span>
      `;
      list.appendChild(li);
    });
  }

  function selectCounty(countyName) {
    document.getElementById('county-name').textContent = countyName;
    document.getElementById('county-hover-label').textContent = countyName;

    // Try matching by county name (normalized)
    const key = countyName.toUpperCase().replace(' COUNTY', '').trim();
    // Look up by various possible keys
    let stats = _fireData.byCounty.get(key)
             || _fireData.byCounty.get(countyName.toUpperCase())
             || _fireData.byCounty.get(countyName.toUpperCase() + ' COUNTY');

    const statsEl = document.getElementById('county-stats');
    if (!stats) {
      statsEl.style.display = 'none';
      return;
    }

    statsEl.style.display = 'block';
    document.getElementById('stat-fires').textContent = d3.format(',')(stats.fires);
    document.getElementById('stat-acres').textContent = d3.format(',.0f')(stats.acres);
    document.getElementById('stat-largest').textContent = stats.largest  || '—';
    document.getElementById('stat-worst-year').textContent = stats.worstYear || '—';
  }


  function init(fireData) {
    _fireData = fireData;
    _renderBarChart();
    _renderTopFires();
  }

  return { init, selectCounty };
})();