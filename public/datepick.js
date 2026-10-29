/* One calendar picker for every date field on 4ormop (28 Oct 2026).
   Any <input type="date">, or any input with data-datepick, opens this calendar on click, even inside port shadow roots.
   Picking a day writes YYYY-MM-DD and fires input and change, so each page saves exactly as if the date were typed. */
(function () {
  if (window.__dpk4) return;
  window.__dpk4 = true;
  var MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var css = '#dpk4{position:fixed;z-index:2147483000;width:280px;background:#111216;border:1px solid #333643;border-radius:14px;box-shadow:0 20px 60px rgba(0,0,0,.6);padding:12px;display:none;font:600 13px Inter,-apple-system,system-ui,sans-serif;color:#fff}' +
    '#dpk4.on{display:block}#dpk4 .h{display:flex;align-items:center;gap:6px;margin-bottom:8px}#dpk4 .h b{flex:1;text-align:center;font-weight:800;color:#fff}' +
    '#dpk4 button{font:inherit;cursor:pointer}#dpk4 .h button,#dpk4 .f button{border:1px solid #333643;background:#18191f;border-radius:8px;height:28px;padding:0 10px;font-size:12px;font-weight:750;color:#fff}' +
    '#dpk4 .h button:hover,#dpk4 .f button:hover{border-color:#4d7cff}' +
    '#dpk4 .g{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;text-align:center}#dpk4 .g span{font-size:11px;font-weight:750;color:#c8d1ea;padding:4px 0}' +
    '#dpk4 .g button{height:32px;border:0;background:none;border-radius:8px;font-size:13px;color:#fff;font-variant-numeric:tabular-nums}' +
    '#dpk4 .g button:hover{background:#23252e}#dpk4 .g button.out{color:#6f7690}#dpk4 .g button.tdy{box-shadow:inset 0 0 0 1.5px #4d7cff}' +
    '#dpk4 .g button.sel{background:#2e6bf2;color:#fff}#dpk4 .f{display:flex;justify-content:space-between;margin-top:8px}';
  var st = document.createElement('style');
  st.textContent = css;
  document.head.appendChild(st);
  var box = document.createElement('div');
  box.id = 'dpk4';
  box.innerHTML = '<div class="h"><button type="button" data-k="prev">Prev</button><b></b><button type="button" data-k="next">Next</button></div><div class="g"></div><div class="f"><button type="button" data-k="today">Today</button><button type="button" data-k="clear">Clear</button></div>';
  function mount() { if (!box.isConnected) document.body.appendChild(box); }
  var field = null, vy = 0, vm = 0;
  function pad(n) { return String(n).padStart(2, '0'); }
  function iso(y, m, d) { return y + '-' + pad(m + 1) + '-' + pad(d); }
  function todayIso() {
    var p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Vancouver', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    return p;
  }
  function draw() {
    box.querySelector('.h b').textContent = MON[vm] + ' ' + vy;
    var first = new Date(Date.UTC(vy, vm, 1));
    var lead = (first.getUTCDay() + 6) % 7;
    var sel = field ? String(field.value || '') : '';
    var t = todayIso();
    var h = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(function (d) { return '<span>' + d + '</span>'; }).join('');
    for (var k = 0; k < 42; k++) {
      var d = new Date(Date.UTC(vy, vm, 1 - lead + k));
      var v = iso(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
      h += '<button type="button" data-day="' + v + '" class="' + (d.getUTCMonth() !== vm ? 'out ' : '') + (v === t ? 'tdy ' : '') + (v === sel ? 'sel' : '') + '">' + d.getUTCDate() + '</button>';
    }
    box.querySelector('.g').innerHTML = h;
  }
  function open(f) {
    mount();
    field = f;
    var v = /^\d{4}-\d{2}-\d{2}$/.test(f.value || '') ? f.value : todayIso();
    vy = +v.slice(0, 4); vm = +v.slice(5, 7) - 1;
    draw();
    box.classList.add('on');
    var r = f.getBoundingClientRect(), w = box.offsetWidth, hh = box.offsetHeight;
    var left = Math.min(r.left, window.innerWidth - w - 12), top = r.bottom + 6;
    if (top + hh > window.innerHeight - 8) top = Math.max(8, r.top - hh - 6);
    box.style.left = Math.max(8, left) + 'px';
    box.style.top = top + 'px';
  }
  function close() { box.classList.remove('on'); field = null; }
  function commit(v) {
    var f = field;
    close();
    if (!f) return;
    var setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(f, v);
    f.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    f.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  }
  function target(e) {
    var path = e.composedPath ? e.composedPath() : [e.target];
    for (var i = 0; i < path.length; i++) {
      var el = path[i];
      if (el && el.tagName === 'INPUT' && !el.disabled && !el.readOnly && (el.type === 'date' || el.hasAttribute('data-datepick'))) return el;
      if (el === box) return box;
    }
    return null;
  }
  document.addEventListener('click', function (e) {
    var t = target(e);
    if (t === box) {
      var b = e.target.closest && e.target.closest('button');
      if (!b) return;
      if (b.dataset.day) { commit(b.dataset.day); return; }
      var k = b.dataset.k;
      if (k === 'prev') { vm--; if (vm < 0) { vm = 11; vy--; } }
      if (k === 'next') { vm++; if (vm > 11) { vm = 0; vy++; } }
      if (k === 'today') { commit(todayIso()); return; }
      if (k === 'clear') { commit(''); return; }
      draw();
      return;
    }
    if (t) { e.preventDefault(); open(t); return; }
    if (field) close();
  }, true);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && field) close(); });
  window.addEventListener('resize', function () { if (field) close(); });
  document.addEventListener('scroll', function () { if (field) close(); }, true);
})();
