/* Living plan documents, opened from the Playbook ("30-day plan"). Read it, press Edit to change any line, Save keeps the old copy. */
(function () {
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function inline(t) { return esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>'); }
  /* Light markdown: # headings, - bullets, | tables |, blank-line paragraphs. */
  function render(md) {
    var out = [], lines = String(md || '').split('\n'), i = 0;
    while (i < lines.length) {
      var l = lines[i];
      if (/^\s*\|/.test(l)) {
        var rows = [];
        while (i < lines.length && /^\s*\|/.test(lines[i])) { if (!/^\s*\|[\s|:-]+\|\s*$/.test(lines[i])) rows.push(lines[i]); i++; }
        out.push('<table>' + rows.map(function (r, ix) {
          var cells = r.trim().replace(/^\||\|$/g, '').split('|');
          return '<tr>' + cells.map(function (c) { return ix === 0 ? '<th>' + inline(c.trim()) + '</th>' : '<td>' + inline(c.trim()) + '</td>'; }).join('') + '</tr>';
        }).join('') + '</table>');
        continue;
      }
      if (/^###\s/.test(l)) out.push('<h4>' + inline(l.slice(4)) + '</h4>');
      else if (/^##\s/.test(l)) out.push('<h3>' + inline(l.slice(3)) + '</h3>');
      else if (/^#\s/.test(l)) out.push('<h2>' + inline(l.slice(2)) + '</h2>');
      else if (/^\s*[-*]\s/.test(l)) {
        var items = [];
        while (i < lines.length && /^\s*[-*]\s/.test(lines[i])) { items.push('<li>' + inline(lines[i].replace(/^\s*[-*]\s/, '')) + '</li>'); i++; }
        out.push('<ul>' + items.join('') + '</ul>');
        continue;
      } else if (l.trim()) out.push('<p>' + inline(l) + '</p>');
      i++;
    }
    return out.join('');
  }
  var CSS = '#pdOv{position:fixed;inset:0;z-index:9000;background:rgba(3,6,18,.6);display:flex;justify-content:center;align-items:flex-start;padding:40px 16px;overflow:auto}'
    + '#pdBox{width:min(980px,100%);background:#fff;color:#0b1020;border-radius:18px;padding:26px 30px;font:14px/1.6 Inter,system-ui,sans-serif;box-shadow:0 30px 80px rgba(0,0,0,.45)}'
    + '#pdBox .pdh{display:flex;align-items:center;gap:10px;margin-bottom:6px}#pdBox .pdh b{font-size:20px;font-weight:850;flex:1}'
    + '#pdBox .pdh small{color:#46556e;font-weight:650}'
    + '#pdBox button{border:1px solid #ccd6e4;background:#fff;color:#142036;border-radius:999px;padding:6px 14px;font:750 13px Inter,system-ui,sans-serif;cursor:pointer}#pdBox button.p{background:#2e6bf2;border-color:#2e6bf2;color:#fff}'
    + '#pdBody h2{font-size:22px;margin:18px 0 6px;letter-spacing:-.02em}#pdBody h3{font-size:17px;margin:16px 0 4px;color:#1b4abe}#pdBody h4{font-size:15px;margin:12px 0 4px}'
    + '#pdBody p{margin:6px 0}#pdBody ul{margin:6px 0 6px 18px;padding:0}#pdBody li{margin:2px 0}'
    + '#pdBody table{width:100%;border-collapse:collapse;margin:8px 0 12px;font-size:13px}#pdBody th{text-align:left;background:#eef3fb;padding:7px 9px;font-weight:800}#pdBody td{border-top:1px solid #e6ebf3;padding:7px 9px;vertical-align:top}'
    + '#pdEdit{width:100%;min-height:62vh;border:1px solid #ccd6e4;border-radius:12px;padding:12px;font:13px/1.55 ui-monospace,Menlo,monospace;color:#0b1020}';
  function el(id) { return document.getElementById(id); }
  window.openPlanDoc = function (key) {
    if (!el('pdCss')) { var st = document.createElement('style'); st.id = 'pdCss'; st.textContent = CSS; document.head.appendChild(st); }
    var ov = el('pdOv');
    if (!ov) {
      ov = document.createElement('div'); ov.id = 'pdOv';
      ov.innerHTML = '<div id="pdBox"><div class="pdh"><b id="pdTitle">30-day plan</b><small id="pdWhen"></small><button type="button" id="pdEditBtn">Edit</button><button type="button" class="p" id="pdSave" hidden>Save</button><button type="button" id="pdClose">Close</button></div><div id="pdBody">Loading</div></div>';
      document.body.appendChild(ov);
      ov.addEventListener('click', function (e) { if (e.target === ov) ov.hidden = true; });
      el('pdClose').onclick = function () { ov.hidden = true; };
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && ov && !ov.hidden) ov.hidden = true; });
    }
    ov.hidden = false;
    var fn = window.authFetch || fetch, doc = { body: '' };
    function show() {
      el('pdBody').innerHTML = doc.body ? render(doc.body) : '<p>Nothing written yet. Press Edit to start.</p>';
      el('pdTitle').textContent = doc.title || '30-day plan';
      el('pdWhen').textContent = doc.updated_at ? 'updated ' + new Date(doc.updated_at).toLocaleString('en-CA', { timeZone: 'America/Vancouver', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : '';
      el('pdSave').hidden = true; el('pdEditBtn').hidden = false;
    }
    el('pdEditBtn').onclick = function () {
      el('pdBody').innerHTML = '<textarea id="pdEdit"></textarea>';
      el('pdEdit').value = doc.body || '';
      el('pdSave').hidden = false; el('pdEditBtn').hidden = true;
    };
    el('pdSave').onclick = function () {
      var body = el('pdEdit').value;
      fn('/api/plan-doc', { method: 'PUT', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key: key, title: doc.title || '30-day plan', body: body }) })
        .then(function (r) { if (!r.ok) throw new Error('save'); doc.body = body; doc.updated_at = new Date().toISOString(); show(); })
        .catch(function () { el('pdSave').textContent = 'Could not save, try again'; });
    };
    fn('/api/plan-doc?key=' + encodeURIComponent(key), { credentials: 'same-origin' }).then(function (r) { return r.json(); })
      .then(function (d) { doc = d || {}; show(); }).catch(function () { el('pdBody').textContent = 'Could not load the plan.'; });
  };
  document.addEventListener('click', function (e) {
    var p = e.composedPath ? e.composedPath() : [];
    for (var i = 0; i < p.length; i++) { if (p[i] && p[i].id === 'plan30Btn') { window.openPlanDoc('30day'); return; } }
  });
})();
