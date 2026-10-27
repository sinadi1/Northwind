/** Live character counter for textareas with data-count-target. */
(function () {
  "use strict";
  document.querySelectorAll("textarea[data-count-target]").forEach(function (area) {
    var target = document.getElementById(area.getAttribute("data-count-target"));
    if (!target) { return; }
    function update() { target.textContent = area.value.length + " of " + area.maxLength + " characters used"; }
    area.addEventListener("input", update);
    update();
  });
})();
