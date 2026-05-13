export let map;

export function initMap() {

  map = L.map("map", {
    zoomControl: true
  }).setView([37.5, -119], 6);

}