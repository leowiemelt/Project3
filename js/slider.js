import { updateNasaLayer, loadFireLayer } from "./layers.js";

const slider = document.getElementById("date-slider");
const dateLabel = document.getElementById("current-date");
const playButton = document.getElementById("play-button");

const startDate = new Date("2020-08-01");

let interval = null;

function sliderValueToDate(value) {

  const d = new Date(startDate);

  d.setDate(d.getDate() + Number(value));

  return d.toISOString().split("T")[0];
}

export async function initializeSlider() {

  const initialDate = sliderValueToDate(slider.value);

  dateLabel.innerText = initialDate;

  updateNasaLayer(initialDate);

  await loadFireLayer(initialDate);

  slider.addEventListener("input", async () => {

    const date = sliderValueToDate(slider.value);

    dateLabel.innerText = date;

    updateNasaLayer(date);

    await loadFireLayer(date);
  });

  playButton.addEventListener("click", () => {

    if (interval) {

      clearInterval(interval);
      interval = null;

      playButton.innerText = "▶ Play";

      return;
    }

    playButton.innerText = "⏸ Pause";

    interval = setInterval(async () => {

      let val = Number(slider.value);

      val++;

      if (val > Number(slider.max)) {
        val = 0;
      }

      slider.value = val;

      const date = sliderValueToDate(val);

      dateLabel.innerText = date;

      updateNasaLayer(date);

      await loadFireLayer(date);

    }, 700);

  });

}