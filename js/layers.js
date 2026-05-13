import { map } from "./map.js";

let nasaLayer;
let fireLayer;
let countyLayer;

export function updateNasaLayer(date) {

  if (nasaLayer) {
    map.removeLayer(nasaLayer);
  }

  nasaLayer = L.tileLayer(
    `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/
MODIS_Terra_CorrectedReflectance_TrueColor/default/
${date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`,
    {
      tileSize: 256,
      attribution: "NASA GIBS"
    }
  );

  nasaLayer.addTo(map);
}

export async function loadCountyLayer() {

  const counties = await d3.json("data/ca-counties.geojson");

  countyLayer = L.geoJSON(counties, {

    style: {
      color: "#888",
      weight: 1,
      fillOpacity: 0
    },

    onEachFeature: (feature, layer) => {

    layer.on("mouseover", () => {

        layer.setStyle({
        color: "white",
        weight: 2
        });

        document.getElementById("county-name").innerText =
        feature.properties.name || "Unknown";
    });

    layer.on("mouseout", () => {

        countyLayer.resetStyle(layer);

        document.getElementById("county-name").innerText = "None";
    });

    }

  }).addTo(map);

}

export async function loadFireLayer(date) {

  if (fireLayer) {
    map.removeLayer(fireLayer);
  }

  const fireData = await d3.json("data/calfire.geojson");

  const filtered = {
    type: "FeatureCollection",
    features: fireData.features.filter(d => {

      if (!d.properties.date) return true;

      return d.properties.date <= date;
    })
  };

  document.getElementById("fire-count").innerText =
    filtered.features.length;

  fireLayer = L.geoJSON(filtered, {

    pointToLayer: (feature, latlng) => {

      const acres = feature.properties.AcresBurned || 1000;

      let color = "yellow";

      if (acres > 10000) color = "red";
      else if (acres > 3000) color = "orange";

      return L.circleMarker(latlng, {
        radius: Math.sqrt(acres) / 20,
        fillColor: color,
        color: color,
        fillOpacity: 0.7
      });
    },

    onEachFeature: (feature, layer) => {

      layer.bindTooltip(`
        <div class="fire-tooltip">
          <strong>${feature.properties.name || "Fire"}</strong><br/>
          Acres: ${feature.properties.AcresBurned || "Unknown"}<br/>
          County: ${feature.properties.County || "Unknown"}
        </div>
      `);

    }

  }).addTo(map);
}