/**
 * sidebar.js
 * Renders the statewide acres-burned bar chart and the county detail card.
 * Reads from the CAL FIRE FRAP GeoJSON loaded by main.js.
 *
 * Expected data shape passed into init():
 *   fireData = {
 *     byYear:   Map<string, number>   year → total acres
 *     byCounty: Map<string, { fires, acres, largest, worstYear }>
 *     topFires: Array<{ name, acres, year, county }>  (sorted desc)
 *   }
 */

const Sidebar = (() => {
  let _fireData = null;

  // ── Bar chart ───────────────────────────────────────────────

  function _renderBarChart() {
    const svg = d3.select('#bar-chart');
    const containerWidth = document.getElementById('bar-chart').parentElement.clientWidth - 32;
    const W = containerWidth > 0 ? containerWidth : 270;
    const H = 160;
    const margin = { top: 8, right: 4, bottom: 24, left: 38 };
    const innerW = W - margin.left - margin.right;
    const innerH = H - margin.top - margin.bottom;

    svg.attr('viewBox', `0 0 ${W} ${H}`).attr('width', W).attr('height', H);
    svg.selectAll('*').remove();

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const years = Array.from(_fireData.byYear.keys()).sort();
    const acres = years.map(y => _fireData.byYear.get(y));

    const x = d3.scaleBand().domain(years).range([0, innerW]).padding(0.12);
    const y = d3.scaleLinear().domain([0, d3.max(acres)]).nice().range([innerH, 0]);

    // Axes
    g.append('g')
      .attr('class', 'axis')
      .attr('transform', `translate(0,${innerH})`)
      .call(
        d3.axisBottom(x)
          .tickValues(years.filter((_, i) => i % 4 === 0))
          .tickSize(0)
      )
      .call(ax => ax.select('.domain').remove());

    g.append('g')
      .attr('class', 'axis')
      .call(
        d3.axisLeft(y)
          .ticks(4)
          .tickFormat(d => d >= 1e6 ? `${(d/1e6).toFixed(1)}M` : d >= 1e3 ? `${(d/1e3).toFixed(0)}K` : d)
          .tickSize(-innerW)
      )
      .call(ax => {
        ax.select('.domain').remove();
        ax.selectAll('.tick line').attr('stroke', '#252525');
      });

    // Bars
    g.selectAll('.bar')
      .data(years)
      .join('rect')
        .attr('class', 'bar')
        .attr('data-year', d => d)
        .attr('x', d => x(d))
        .attr('y', d => y(_fireData.byYear.get(d) || 0))
        .attr('width', x.bandwidth())
        .attr('height', d => innerH - y(_fireData.byYear.get(d) || 0))
        .on('click', (event, year) => {
          Slider.jumpToYear(year);
        })
        .on('mouseover', function(event, year) {
          const acresVal = _fireData.byYear.get(year) || 0;
          showTooltipNear(event, `${year}: ${d3.format(',')(Math.round(acresVal))} acres`);
        })
        .on('mouseout', hideTooltip);
  }

  // Simple inline tooltip for bar chart (uses map tooltip element)
  function showTooltipNear(event, text) {
    const tip = document.getElementById('map-tooltip');
    if (!tip) return;
    tip.innerHTML = text;
    tip.classList.remove('hidden');
    tip.style.left = `${event.pageX + 10}px`;
    tip.style.top  = `${event.pageY - 28}px`;
    tip.style.position = 'fixed';
  }

  function hideTooltip() {
    const tip = document.getElementById('map-tooltip');
    if (tip) tip.classList.add('hidden');
  }

  // ── Top fires list ──────────────────────────────────────────

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

  // ── County detail card ──────────────────────────────────────

  /**
   * Update the county detail card when a county is clicked on the map.
   * @param {string} countyName
   */
  function selectCounty(countyName) {
    document.getElementById('county-name').textContent = countyName;
    const stats = _fireData.byCounty.get(countyName.toUpperCase());

    const statsEl = document.getElementById('county-stats');
    if (!stats) {
      statsEl.style.display = 'none';
      return;
    }
    statsEl.style.display = 'block';
    document.getElementById('stat-fires').textContent    = d3.format(',')(stats.fires);
    document.getElementById('stat-acres').textContent    = d3.format(',.0f')(stats.acres);
    document.getElementById('stat-largest').textContent  = stats.largest || '—';
    document.getElementById('stat-worst-year').textContent = stats.worstYear || '—';
  }

  // ── Public API ──────────────────────────────────────────────

  /**
   * Initialize sidebar with processed fire data.
   * @param {object} fireData  - { byYear, byCounty, topFires }
   */
  function init(fireData) {
    _fireData = fireData;
    _renderBarChart();
    _renderTopFires();
  }

  return { init, selectCounty };
})();