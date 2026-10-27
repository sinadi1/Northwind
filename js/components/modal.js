/**
 * Accessible modal dialogs built on the native <dialog> element.
 * showModal() gives us, for free: focus trapping, Escape to close,
 * an inert background, and a ::backdrop.
 * We add: focus return to the opener, and close buttons.
 */
(function () {
  "use strict";

  document.querySelectorAll("[data-open-dialog]").forEach(function (opener) {
    opener.addEventListener("click", function () {
      var dialog = document.getElementById(opener.getAttribute("data-open-dialog"));
      if (!dialog) { return; }
      dialog.returnFocusTo = opener;
      dialog.showModal();
    });
  });

  document.querySelectorAll("dialog").forEach(function (dialog) {
    dialog.querySelectorAll("[data-close-dialog]").forEach(function (btn) {
      btn.addEventListener("click", function () { dialog.close(); });
    });

    // Clicking the backdrop (the dialog element itself) closes it.
    dialog.addEventListener("click", function (event) {
      if (event.target === dialog) { dialog.close(); }
    });

    dialog.addEventListener("close", function () {
      if (dialog.returnFocusTo) { dialog.returnFocusTo.focus(); }
    });
  });
})();
