import { map } from "./map.js";

let nasaLayer;
let fireLayer;
let countyLayer;

export function updateNasaLayer(date) {

  if (nasaLayer) {
    map.removeLayer(nasaLayer);
  }

  nasaLayer = L.tileLayer(
    `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/${date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`,
    {
      tileSize: 256,
      attribution: "NASA GIBS"
    }
  );

  nasaLayer.addTo(map);
}


export async function loadCountyLayer() {

  const counties = await d3.json("../data/ca-counties.geojson");

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

  const fireData = await d3.json("../data/calfire.geojson");

  const filtered = {
    type: "FeatureCollection",
    features: fireData.features.filter(f => {

      // if no date field, keep it
      if (!f.properties) return false;

      const fireDate =
        f.properties.date ||
        f.properties.Date ||
        f.properties.ALARM_DATE ||
        f.properties.Updated;

      if (!fireDate) return true;

      return fireDate <= date;
    })
  };

  document.getElementById("fire-count").innerText = filtered.features.length;

  console.log("Filtered fires:", filtered.features.length);

  fireLayer = L.geoJSON(filtered, {
    style: (feature) => {

      const acres =
        feature.properties?.AcresBurned ||
        feature.properties?.GIS_ACRES ||
        1000;

      let color = "yellow";

      if (acres > 10000) color = "red";
      else if (acres > 3000) color = "orange";

      return {
        color,
        fillColor: color,
        weight: 1,
        fillOpacity: 0.5
      };
    },

    onEachFeature: (feature, layer) => {

      layer.bindTooltip(`
        <div class="fire-tooltip">
          <strong>${feature.properties?.name || feature.properties?.FIRE_NAME || "Fire"}</strong><br/>
          Acres: ${feature.properties?.AcresBurned || feature.properties?.GIS_ACRES || "Unknown"}<br/>
          County: ${feature.properties?.County || feature.properties?.COUNTY || "Unknown"}
        </div>
      `);
    }

  }).addTo(map);
}