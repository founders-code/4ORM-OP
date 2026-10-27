(function () {
  function fixtureOn() {
    try { return /(?:^|[?&])fixture=mockup(?:&|$)/.test(String(location.search || '')); } catch (e) { return false; }
  }
  window.fixtureMockup = fixtureOn();
  if (window.fixtureMockup) document.documentElement.classList.add('fixture-mockup');
  document.documentElement.classList.add('port-shadow');

  window.attachPort = function (hostId, cssHref) {
    var host = document.getElementById(hostId);
    if (!host) return null;
    if (host.shadowRoot) return host.shadowRoot;
    var kids = [];
    while (host.firstChild) kids.push(host.removeChild(host.firstChild));
    var root = host.attachShadow({ mode: 'open' });
    if (cssHref) {
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = cssHref;
      root.appendChild(link);
    }
    var wrap = document.createElement('div');
    wrap.className = 'port-body';
    kids.forEach(function (n) { wrap.appendChild(n); });
    root.appendChild(wrap);
    return root;
  };

  window.portRoot = function (hostId) {
    var host = document.getElementById(hostId);
    return (host && host.shadowRoot) || host || document;
  };

  window.portEl = function (hostId, id) {
    var root = window.portRoot(hostId);
    if (root.getElementById) return root.getElementById(id);
    return document.getElementById(id);
  };

  window.portClickTarget = function (e) {
    var path = e.composedPath ? e.composedPath() : [];
    return path[0] || e.target;
  };

  window.bootPorts = function () {
    window.attachPort('v-news', '/port-css/news.css?v=7');
  };
  window.paintMockupFixture = function (hostId, html, cssHref) {
    var host = document.getElementById(hostId);
    if (!host) return;
    host.hidden = false;
    if (!host.shadowRoot) window.attachPort(hostId, cssHref || '/port-css/playbook.css');
    var root = host.shadowRoot || host;
    var wrap = (root.querySelector && root.querySelector('.port-body')) || host;
    wrap.innerHTML = html;
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', window.bootPorts);
  else window.bootPorts();
})();
