function initSlider(dates) {
  const slider = document.getElementById("dateSlider");
  const label = document.getElementById("dateLabel");

  slider.min = 0;
  slider.max = dates.length - 1;
  slider.value = 0;

  label.innerText = dates[0];

  slider.addEventListener("input", () => {
    const date = dates[slider.value];
    label.innerText = date;
    drawFires(date);
  });
}