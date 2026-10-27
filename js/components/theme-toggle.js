/** Light/dark theme toggle. Remembers the choice; falls back to the OS setting. */
(function () {
  "use strict";
  var root = document.documentElement;
  var button = document.getElementById("theme-toggle");
  if (!button) { return; }

  function systemIsDark() { return window.matchMedia("(prefers-color-scheme: dark)").matches; }
  function current() { return root.getAttribute("data-theme") || (systemIsDark() ? "dark" : "light"); }

  function render() {
    var dark = current() === "dark";
    button.setAttribute("aria-pressed", String(dark));
    button.textContent = dark ? "Dark theme: on" : "Dark theme: off";
  }

  try {
    var saved = localStorage.getItem("theme");
    if (saved === "dark" || saved === "light") { root.setAttribute("data-theme", saved); }
  } catch (e) { /* storage unavailable: use OS setting */ }

  button.addEventListener("click", function () {
    var next = current() === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try { localStorage.setItem("theme", next); } catch (e) { /* ignore */ }
    render();
  });
  render();
})();
