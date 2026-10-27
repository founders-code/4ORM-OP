/* Ramp D (Muted) from 22-ops tab 6. Empty is silence, not a dark cell. */
(function () {
  var D = {
    0: 'rgba(255,255,255,.04)',
    1: 'rgb(31,103,93)',
    2: 'rgb(103,126,74)',
    3: 'rgb(158,114,58)',
    4: 'rgb(170,84,60)',
    5: 'rgb(170,60,80)'
  };
  window.heatRampD = function (n) {
    var v = Number(n);
    if (!v || v < 1) return { bg: D[0], text: '', n: 0 };
    var k = Math.min(5, Math.round(v));
    return { bg: D[k], text: String(n), n: k };
  };
  window.heatRampDStops = D;
})();
