/*
 * guard.js - route guard. Runs synchronously in <head>, before the page paints,
 * so signed-out visitors never see protected content. Classic script (not a module).
 * NOTE: this is a client-side simulation. Real apps must enforce auth on a server.
 */
(function () {
  "use strict";
  var ok = false;
  try {
    var s = JSON.parse(localStorage.getItem("northwind:session") || "null");
    ok = !!(s && typeof s.userId === "string" && s.expires > Date.now());
  } catch (e) { /* treat as signed out */ }
  if (!ok) {
    var page = location.pathname.split("/").pop() || "index.html";
    location.replace("login.html?next=" + encodeURIComponent(page));
  }
})();
