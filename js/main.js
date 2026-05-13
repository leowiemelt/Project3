import { initMap } from "./map.js";

import {
  loadCountyLayer
} from "./layers.js";

import { initializeSlider } from "./slider.js";

import { initializeSidebar } from "./sidebar.js";

async function initializeApp() {

  initMap();

  await loadCountyLayer();

  await initializeSlider();

  initializeSidebar();

}

initializeApp();