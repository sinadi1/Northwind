/** Shows the signed-in user's name in the header and wires up Log out. */
(function () {
  "use strict";
  var nameEl = document.getElementById("user-name");
  var logout = document.getElementById("logout-button");
  try {
    var s = JSON.parse(localStorage.getItem("northwind:session") || "null");
    if (s && nameEl) { nameEl.textContent = s.name; }
  } catch (e) { /* ignore */ }

  if (logout) {
    logout.addEventListener("click", function () {
      try { localStorage.removeItem("northwind:session"); } catch (e) { /* ignore */ }
      location.replace("login.html");
    });
  }
})();
