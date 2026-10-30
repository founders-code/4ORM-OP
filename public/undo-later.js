/* One 10-second Undo for actions that used to ask "Are you sure?".
   window.__undoLater(label, commit, onUndo, ms): the action runs after ms (default 10000) unless Undo is pressed.
   Several can be pending at once; each has its own row. Leaving the page while one is pending commits it first. */
(function () {
  if (window.__undoLater) return;
  var pending = [];
  var host = null;
  function bar() {
    if (host && document.body.contains(host)) return host;
    host = document.createElement('div');
    host.id = 'undoLater';
    host.setAttribute('role', 'status');
    host.style.cssText = 'position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:2147483000;display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none;font:500 14px/1.3 Inter,system-ui,sans-serif';
    document.body.appendChild(host);
    return host;
  }
  function row(item) {
    var el = document.createElement('div');
    el.style.cssText = 'pointer-events:auto;display:flex;align-items:center;gap:14px;background:#0B1B3A;color:#fff;border-radius:10px;padding:10px 12px 10px 16px;box-shadow:0 8px 28px rgba(11,27,58,.28);min-width:280px';
    var t = document.createElement('span');
    t.style.flex = '1';
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = 'Undo';
    b.style.cssText = 'background:#2E6BF2;color:#fff;border:0;border-radius:7px;padding:7px 14px;font:600 13px Inter,system-ui,sans-serif;cursor:pointer';
    b.addEventListener('click', function () { cancel(item); });
    el.appendChild(t);
    el.appendChild(b);
    item.el = el;
    item.text = t;
    bar().appendChild(el);
    tick(item);
  }
  function tick(item) {
    if (item.done) return;
    var left = Math.max(0, Math.ceil((item.at - Date.now()) / 1000));
    item.text.textContent = item.label + ' · ' + left + 's';
    if (left > 0) item.tickTimer = setTimeout(function () { tick(item); }, 250);
  }
  function remove(item) {
    item.done = true;
    clearTimeout(item.timer);
    clearTimeout(item.tickTimer);
    pending = pending.filter(function (p) { return p !== item; });
    if (item.el && item.el.parentNode) item.el.parentNode.removeChild(item.el);
  }
  function commit(item) {
    if (item.done) return;
    remove(item);
    try { item.commit(); } catch (e) {}
  }
  function cancel(item) {
    if (item.done) return;
    remove(item);
    try { if (item.undo) item.undo(); } catch (e) {}
  }
  window.__undoLater = function (label, commitFn, undoFn, ms) {
    var wait = Number(ms) || 10000;
    var item = { label: String(label || 'Done'), commit: commitFn || function () {}, undo: undoFn, at: Date.now() + wait };
    pending.push(item);
    item.timer = setTimeout(function () { commit(item); }, wait);
    row(item);
    return function () { cancel(item); };
  };
  window.__undoLaterFlush = function () { pending.slice().forEach(commit); };
  window.addEventListener('pagehide', function () { window.__undoLaterFlush(); });
  window.addEventListener('beforeunload', function (e) {
    if (!pending.length) return;
    e.preventDefault();
    e.returnValue = '';
  });
})();
