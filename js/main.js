let map;
let fireLayer;
let allFires = [];
let uniqueDates = [];

document.addEventListener("DOMContentLoaded", async () => {
  map = initMap();

  fireLayer = L.layerGroup().addTo(map);

  const data = await d3.csv("../data/fires.csv", d3.autoType);

  // Filter to California bounding box
  allFires = data.filter(d =>
    d.latitude >= 32 &&
    d.latitude <= 42 &&
    d.longitude >= -125 &&
    d.longitude <= -114
  );

  // Get unique dates
  uniqueDates = [...new Set(allFires.map(d => d.acq_date))].sort();

  initSlider(uniqueDates);

  drawFires(uniqueDates[0]);
});