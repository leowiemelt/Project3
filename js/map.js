function initMap() {
  const map = L.map("map").setView([37.5, -119.5], 6);

  L.tileLayer(
    "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/" +
    "MODIS_Terra_CorrectedReflectance_TrueColor/default/" +
    "2020-09-10/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg",
    {
      attribution: "NASA GIBS",
      tileSize: 256
    }
  ).addTo(map);

  return map;
}

function drawFires(date) {
  fireLayer.clearLayers();

  const firesToday = allFires.filter(d => d.acq_date === date);

  firesToday.forEach(fire => {
    const brightness = fire.brightness;

    L.circleMarker([fire.latitude, fire.longitude], {
      radius: Math.max(3, brightness / 100),
      color: getColor(brightness),
      fillOpacity: 0.6,
      weight: 0
    })
    .bindTooltip(`
      <strong>${fire.acq_date}</strong><br>
      Brightness: ${brightness}
    `)
    .addTo(fireLayer);
  });
}

function getColor(brightness) {
  if (brightness > 400) return "#ff0000";
  if (brightness > 350) return "#ff6600";
  if (brightness > 320) return "#ffcc00";
  return "#ffff99";
}