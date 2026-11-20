/* BloodFerry shared progressive-enhancement handlers.
 *
 * Loaded on every page (public and admin) with `defer`. Replaces what used to
 * be inline HTML event-handler attributes (onclick/onsubmit/onchange/onerror),
 * which the Content Security Policy forbids (script-src-attr 'none'). Every
 * behaviour here is a delegated listener, so dynamically inserted rows and
 * components work without per-element wiring.
 *
 * No inline code, no eval, no new dependencies.
 */
(function () {
  "use strict";

  // ---- Image fallbacks ----------------------------------------------------
  // `error` does not bubble; listen in the capture phase instead.
  //   data-img-fallback="hide"        → collapse the image (display:none)
  //   data-img-fallback="dim"         → fade it out (opacity, default 0.25)
  //   data-img-fallback="placeholder" → swap for a local generated SVG box
  //     (data-placeholder-size="56" sets the edge length in px)
  function placeholder(size) {
    var parsed = parseInt(size, 10);
    var s = Math.max(16, Math.min(Number.isFinite(parsed) ? parsed : 64, 512));
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="' + s + '" height="' + s + '" viewBox="0 0 ' + s + ' ' + s + '">' +
      '<rect width="100%" height="100%" fill="#e2e8f0"/>' +
      '<text x="50%" y="50%" font-family="system-ui,sans-serif" font-size="' + Math.round(s / 4) + '" fill="#64748b" text-anchor="middle" dominant-baseline="central">' + s + '</text>' +
      '</svg>';
    return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
  }
  function applyFallback(img) {
    var mode = img.getAttribute("data-img-fallback");
    if (!mode || img.dataset.fallbackApplied === "1") return;
    img.dataset.fallbackApplied = "1";
    if (mode === "hide") {
      img.style.display = "none";
    } else if (mode === "dim") {
      var opacity = parseFloat(img.getAttribute("data-fallback-opacity") || "0.25");
      img.style.opacity = Number.isFinite(opacity) ? String(opacity) : "0.25";
    } else if (mode === "placeholder") {
      img.src = placeholder(img.getAttribute("data-placeholder-size"));
    }
  }
  document.addEventListener(
    "error",
    function (event) {
      var t = event.target;
      if (!t || t.tagName !== "IMG") return;
      applyFallback(t);
    },
    true
  );
  // bo.js is deferred, so an image may have failed before this listener was
  // registered — sweep already-broken images once the DOM is interactive.
  (function sweep() {
    var imgs = document.querySelectorAll("img[data-img-fallback]");
    for (var i = 0; i < imgs.length; i++) {
      var img = imgs[i];
      if (img.complete && img.naturalWidth === 0) applyFallback(img);
    }
  })();

  // ---- Confirmation forms ---------------------------------------------------
  // <form data-confirm="Delete this?"> — ask before the POST is issued.
  document.addEventListener(
    "submit",
    function (event) {
      var form = event.target;
      if (!form || form.tagName !== "FORM") return;
      var message = form.getAttribute("data-confirm");
      if (message && !window.confirm(message)) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
    true
  );

  // ---- Auto-submit selects --------------------------------------------------
  // <select class="js-autosubmit"> — submit the owning form on change.
  document.addEventListener(
    "change",
    function (event) {
      var select = event.target;
      if (!select || select.tagName !== "SELECT") return;
      if (!select.classList.contains("js-autosubmit")) return;
      var form = select.form || select.closest("form");
      if (form) form.submit();
    },
    true
  );

  // ---- Delegated clicks -------------------------------------------------------
  document.addEventListener("click", function (event) {
    var reload = event.target.closest(".js-reload");
    if (reload) {
      event.preventDefault();
      window.location.reload();
      return;
    }
    var openAi = event.target.closest(".js-open-ai");
    if (openAi) {
      event.preventDefault();
      var fab = document.getElementById("bo-ai-fab");
      if (fab) fab.click();
      return;
    }
  });
})();
