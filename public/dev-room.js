/* Development (31 Oct 2026): projects run through the CTO brain's stages, frame to ship.
   Opens from the left menu or /development, over the page area (the left menu stays).
   Projects, gates with pass or fail, deliverables by layer with stage, check, evidence and owner, a board by stage,
   and the log of every change. Plans come in as the JSON file the planning chat writes (Import plan).
   No icons, no emoji. Dates in America/Vancouver. Every field saves. */
(function () {
  if (window.__devRoom) return;
  window.__devRoom = 1;
  var TZ = 'America/Vancouver';
  var STAGES = ['not started', 'frame', 'design', 'slice', 'build', 'verify', 'ship', 'done'];
  var S = { data: null, project: '', tab: 'projects', open: '' };
  var box = null;

  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function today() { return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
  function utc(d) { var p = String(d).split('-').map(Number); return Date.UTC(p[0], p[1] - 1, p[2]); }
  function daysTo(d) { return d ? Math.round((utc(d) - utc(today())) / 86400000) : null; }
  function dl(d) { var p = String(d || '').split('-').map(Number); if (p.length < 3 || !p[0]) return ''; return new Date(Date.UTC(p[0], p[1] - 1, p[2], 12)).toLocaleDateString('en-CA', { day: 'numeric', month: 'short', timeZone: 'UTC' }); }
  function span(a, b) { return a && b && a !== b ? dl(a) + ' to ' + dl(b) : dl(b || a); }
  function stamp(t) { var d = new Date(t); return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, day: 'numeric', month: 'short' }).format(d) + ' ' + new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d); }
  function call(method, body) {
    var o = { method: method, credentials: 'same-origin', headers: {} };
    if (body) { o.headers['content-type'] = 'application/json'; o.body = JSON.stringify(body); }
    var fn = typeof window.authFetch === 'function' ? window.authFetch : fetch;
    return fn('/api/dev', o).then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error(d.error || 'Could not reach Development'); return d; }); });
  }

  var CSS = ''
    + '.dvx{position:fixed;top:0;right:0;bottom:0;z-index:2147481400;background:#f4f6fa;color:#101a33;font:500 13px/1.45 Inter,-apple-system,"Segoe UI",system-ui,sans-serif;overflow:auto;display:none}'
    + '.dvx.on{display:block}.dvx *{box-sizing:border-box}.dvx .in{padding:20px 26px 60px;max-width:1500px}'
    + '.dvx .top{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px}.dvx h1{margin:0;font-size:24px;font-weight:850}'
    + '.dvx .tabs{display:flex;gap:6px}.dvx .tabs button,.dvx .btn{font:inherit;font-weight:750;font-size:12.5px;border:1px solid #dfe4ee;background:#fff;color:#101a33;border-radius:999px;padding:5px 13px;cursor:pointer}'
    + '.dvx .tabs button.on{background:#101a33;color:#fff;border-color:#101a33}.dvx .btn.pri{background:#2e6bf2;border-color:#2e6bf2;color:#fff}.dvx .sp{flex:1}'
    + '.dvx .projs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}.dvx .pj{background:#fff;border:1px solid #dfe4ee;border-radius:10px;padding:7px 12px;font-weight:750;cursor:pointer;text-align:left;font:inherit;color:#101a33}'
    + '.dvx .pj small{display:block;color:#7a86a0;font-weight:600;font-size:11.5px}.dvx .pj.on{border-color:#2e6bf2;box-shadow:0 0 0 2px rgba(46,107,242,.2)}'
    + '.dvx .card{background:#fff;border-radius:14px;box-shadow:0 4px 18px rgba(3,10,30,.07);padding:16px 18px;margin-bottom:14px}'
    + '.dvx .hd{display:flex;gap:18px;align-items:center;flex-wrap:wrap}.dvx .big{font-size:38px;font-weight:900;color:#2e6bf2;line-height:1}.dvx .big small{display:block;font-size:11.5px;color:#7a86a0;font-weight:750;margin-top:4px}'
    + '.dvx .hd h2{margin:0;font-size:17px}.dvx .hd p{margin:3px 0 0;color:#4a5672}.dvx .nx{margin-left:auto;text-align:right}.dvx .nx b{display:block;font-size:14px}.dvx .nx span{color:#c98408;font-weight:800}'
    + '.dvx .gates{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:10px}'
    + '.dvx .gt{border:1px solid #e8ecf3;border-radius:12px;padding:10px 12px;cursor:pointer}.dvx .gt.pass{background:#f3fbf7;border-color:#bfe8d4}.dvx .gt.fail{background:#fff6f7;border-color:#f5b8c2}'
    + '.dvx .gt .r{display:flex;gap:8px;align-items:baseline}.dvx .gt b{font-size:13.5px}.dvx .gt .d{margin-left:auto;font-weight:800;font-size:12px;color:#4a5672;white-space:nowrap}'
    + '.dvx .gt p{margin:5px 0 8px;color:#4a5672;font-size:12px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}'
    + '.dvx .seg{display:inline-flex;border:1px solid #dfe4ee;border-radius:8px;overflow:hidden}.dvx .seg button{font:inherit;font-size:11.5px;font-weight:750;border:0;background:#fff;color:#4a5672;padding:3px 9px;cursor:pointer}'
    + '.dvx .seg button+button{border-left:1px solid #dfe4ee}.dvx .seg button.pass.on{background:#12a36a;color:#fff}.dvx .seg button.fail.on{background:#e0364f;color:#fff}.dvx .seg button.pending.on{background:#101a33;color:#fff}'
    + '.dvx h3{margin:4px 0 8px;font-size:11.5px;font-weight:850;letter-spacing:.06em;text-transform:uppercase;color:#7a86a0}'
    + '.dvx table{width:100%;border-collapse:collapse}.dvx th{text-align:left;font-size:11px;color:#7a86a0;font-weight:800;text-transform:uppercase;letter-spacing:.04em;padding:6px 8px;border-bottom:1px solid #e8ecf3}'
    + '.dvx td{padding:8px;border-bottom:1px solid #f0f2f7;vertical-align:middle}.dvx tr.it{cursor:pointer}.dvx tr.it:hover td{background:#f8faff}'
    + '.dvx td.c{font-weight:800;color:#4a5672;white-space:nowrap}.dvx td b{display:block;font-weight:750}.dvx td small{color:#7a86a0}.dvx tr.ly td{background:#f6f8fc;font-weight:850;font-size:12px;color:#4a5672;padding:6px 8px}'
    + '.dvx .crit{font-size:10.5px;font-weight:850;color:#c0233c;margin-left:6px;white-space:nowrap}.dvx .late{color:#e0364f;font-weight:800}'
    + '.dvx select{font:inherit;font-size:12px;font-weight:750;border:1px solid #dfe4ee;border-radius:999px;padding:3px 8px;background:#fff;color:#101a33}'
    + '.dvx select.s-verify,.dvx select.s-ship,.dvx select.s-done{background:#e4f6ee;border-color:#bfe8d4;color:#0d7a4e}.dvx select.s-build,.dvx select.s-slice{background:#fff4e0;border-color:#f3dcae;color:#8a5a00}'
    + '.dvx select.s-frame,.dvx select.s-design{background:#eaf1fe;border-color:#cddcfb;color:#2e6bf2}'
    + '.dvx .ev{font-size:11.5px;color:#4a5672;word-break:break-all}.dvx .ev.ok{color:#0d7a4e;font-weight:750}'
    + '.dvx .board{display:grid;grid-template-columns:repeat(8,minmax(150px,1fr));gap:8px;overflow-x:auto}.dvx .col{background:#eef1f6;border-radius:12px;padding:8px;min-height:120px}'
    + '.dvx .col h4{margin:2px 4px 8px;font-size:11.5px;text-transform:uppercase;letter-spacing:.05em;color:#4a5672;display:flex}.dvx .col h4 span{margin-left:auto;color:#7a86a0}'
    + '.dvx .bc{background:#fff;border-radius:9px;padding:8px 9px;margin-bottom:6px;cursor:pointer;box-shadow:0 1px 3px rgba(3,10,30,.06)}.dvx .bc b{display:block;font-size:12.5px}.dvx .bc small{color:#7a86a0;font-size:11.5px}'
    + '.dvx .lg div{padding:7px 0;border-bottom:1px solid #f0f2f7}.dvx .lg em{font-style:normal;color:#7a86a0;font-weight:750;margin-right:8px}'
    + '.dvx .empty{padding:40px;text-align:center;color:#4a5672}.dvx .empty b{display:block;font-size:16px;color:#101a33;margin-bottom:6px}'
    + '.dvx .dr{position:fixed;top:0;right:0;bottom:0;width:min(520px,96vw);background:#fff;box-shadow:-20px 0 60px rgba(3,10,30,.25);z-index:2;padding:18px 20px 30px;overflow:auto;transform:translateX(105%);transition:transform .18s ease}'
    + '.dvx .dr.on{transform:none}.dvx .dr h2{margin:0 0 4px;font-size:17px}.dvx .dr .x{float:right;font:inherit;font-weight:750;border:0;background:none;color:#4a5672;cursor:pointer}'
    + '.dvx .dr dl{display:grid;grid-template-columns:110px 1fr;gap:8px 12px;margin:14px 0}.dvx .dr dt{color:#7a86a0;font-weight:750;font-size:12px}.dvx .dr dd{margin:0}'
    + '.dvx .dr textarea{width:100%;min-height:90px;font:inherit;border:1px solid #dfe4ee;border-radius:9px;padding:8px;resize:vertical}'
    + '.dvx .why{margin:0 0 12px;color:#26324d;line-height:1.55}.dvx ol.steps{margin:0 0 14px;padding:0;list-style:none;counter-reset:st}'
    + '.dvx ol.steps li{counter-increment:st;border:1px solid #e8ecf3;border-radius:10px;padding:9px 10px;margin-bottom:6px}.dvx ol.steps li.ok{background:#f3fbf7;border-color:#cfeedd}'
    + '.dvx ol.steps label{display:flex;gap:10px;cursor:pointer}.dvx ol.steps input{width:17px;height:17px;margin:2px 0 0;accent-color:#12a36a;flex:none}'
    + '.dvx ol.steps b{display:block;font-weight:750}.dvx ol.steps b:before{content:counter(st) ". ";color:#7a86a0}.dvx ol.steps li.ok b{text-decoration:line-through;color:#4a5672}'
    + '.dvx ol.steps em{display:block;font-style:normal;color:#4a5672;font-size:12.5px;margin-top:2px;line-height:1.5}.dvx .share{display:flex;gap:8px;margin:4px 0 16px;flex-wrap:wrap}'
    + '.dvx .toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#101a33;color:#fff;border-radius:10px;padding:9px 14px;display:none;z-index:3;font-weight:650}.dvx .toast.on{display:block}'
    + '.dvx .paste{display:none;margin-bottom:14px}.dvx .paste.on{display:block}.dvx .paste textarea{width:100%;min-height:140px;font:12px/1.4 ui-monospace,Menlo,monospace;border:1px solid #dfe4ee;border-radius:9px;padding:8px}';

  function toast(m) { var t = box.querySelector('.toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(function () { t.classList.remove('on'); }, 4000); }
  function proj() { var ps = (S.data && S.data.projects) || []; return ps.filter(function (p) { return p.id === S.project; })[0] || ps[0] || null; }
  function itemsOf(p) { return ((S.data && S.data.items) || []).filter(function (i) { return p && i.project_id === p.id; }); }
  function byId(id) { return ((S.data && S.data.items) || []).filter(function (i) { return i.id === id; })[0] || null; }
  function vanDate(ts) { return ts ? new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ts)) : ''; }

  function stepsOf(it) { return Array.isArray(it.steps) ? it.steps : []; }
  function stepsDone(it) { var d = it.step_done || {}; return stepsOf(it).filter(function (x, i) { return d[String(i)]; }).length; }
  function stepCount(it) { var n = stepsOf(it).length; return n ? stepsDone(it) + ' of ' + n + ' steps' : ''; }
  function gateName(code) { var g = ((S.data && S.data.items) || []).filter(function (i) { return i.kind === 'gate' && i.code === code && i.project_id === (proj() || {}).id; })[0]; return g ? g.code + ' ' + g.title + (g.due_date ? ', ' + dl(g.due_date) : '') : code; }
  /* A plain brief anyone can read: what, why, the steps in order, what done looks like, what to keep. */
  function brief(it) {
    var p = proj() || {}, d = it.step_done || {}, L = [];
    L.push(it.code + '  ' + it.title);
    L.push('Project: ' + (p.name || ''));
    if (it.kind !== 'gate' && it.gate) L.push('Feeds gate: ' + gateName(it.gate));
    L.push('Owner: ' + (it.owner_name || 'unassigned') + '   Dates: ' + span(it.start_date, it.due_date));
    if ((it.depends_on || []).length) L.push('Starts after: ' + it.depends_on.join(', '));
    if (it.why) { L.push(''); L.push('Why this matters'); L.push(it.why); }
    if (stepsOf(it).length) {
      L.push(''); L.push('Steps');
      stepsOf(it).forEach(function (x, i) { L.push((i + 1) + '. ' + (d[String(i)] ? '[done] ' : '') + x.t); if (x.how) L.push('   ' + x.how); });
    }
    L.push(''); L.push(it.kind === 'gate' ? 'This gate passes when' : 'Done when'); L.push(it.done_check || '');
    if (it.kind === 'gate' && it.plan_note) { L.push(''); L.push('If it fails'); L.push(it.plan_note); }
    if (it.evidence) { L.push(''); L.push('Keep this as the proof'); L.push(it.evidence); }
    if (it.kind !== 'gate' && it.plan_note) { L.push(''); L.push('Note'); L.push(it.plan_note); }
    return L.join('\n');
  }
  function copyText(t, msg) {
    var done = function () { toast(msg); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, function () { fallbackCopy(t); done(); });
    else { fallbackCopy(t); done(); }
  }
  function fallbackCopy(t) { var a = document.createElement('textarea'); a.value = t; a.style.position = 'fixed'; a.style.opacity = '0'; document.body.appendChild(a); a.select(); try { document.execCommand('copy'); } catch (e) {} a.remove(); }
  function printText(title, t) {
    var w = window.open('', '_blank'); if (!w) { toast('Allow pop-ups to print'); return; }
    w.document.write('<!doctype html><title>' + esc(title) + '</title><body style="font:15px/1.6 Arial,Helvetica,sans-serif;color:#101a33;max-width:760px;margin:32px auto;padding:0 20px"><pre style="white-space:pre-wrap;font:inherit">' + esc(t) + '</pre></body>');
    w.document.close(); w.focus(); setTimeout(function () { w.print(); }, 300);
  }
  function stageSel(it) {
    return '<select data-stage="' + esc(it.id) + '" class="s-' + esc(it.stage.split(' ')[0]) + '" aria-label="Stage for ' + esc(it.code) + '">'
      + STAGES.map(function (s) { return '<option value="' + s + '"' + (s === it.stage ? ' selected' : '') + '>' + s.charAt(0).toUpperCase() + s.slice(1) + '</option>'; }).join('') + '</select>';
  }
  function checkSeg(it) {
    return '<span class="seg">' + ['pending', 'pass', 'fail'].map(function (c) {
      return '<button type="button" class="' + c + (it.check_state === c ? ' on' : '') + '" data-check="' + esc(it.id) + '" data-v="' + c + '">' + (c === 'pending' ? 'Open' : c === 'pass' ? 'Pass' : 'Fail') + '</button>';
    }).join('') + '</span>';
  }

  function projectsHtml(p) {
    var all = itemsOf(p), gates = all.filter(function (i) { return i.kind === 'gate'; }), work = all.filter(function (i) { return i.kind !== 'gate'; });
    var closeDay = p.close_at ? vanDate(p.close_at) : '', left = daysTo(closeDay);
    var passed = work.filter(function (i) { return i.check_state === 'pass'; }).length;
    var next = gates.filter(function (g) { return g.check_state !== 'pass'; }).sort(function (a, b) { return String(a.due_date) < String(b.due_date) ? -1 : 1; })[0];
    var h = '<div class="card"><div class="hd">' + (left != null ? '<div class="big">' + Math.max(0, left) + '<small>days to close</small></div>' : '')
      + '<div><h2>' + esc(p.name) + '</h2><p>' + (p.target ? 'Target ' + esc(dl(p.target)) + ' · ' : '') + (closeDay ? 'closes ' + esc(dl(closeDay)) + ' · ' : '') + passed + ' of ' + work.length + ' deliverables passed their check</p></div>'
      + (next ? '<div class="nx"><small>Next gate</small><b>' + esc(next.code + ' ' + next.title) + '</b><span>' + esc(dl(next.due_date)) + ' · ' + (daysTo(next.due_date) < 0 ? 'overdue' : daysTo(next.due_date) + ' days') + '</span></div>' : '') + '</div></div>';
    if (gates.length) {
      h += '<div class="card"><h3>Gates</h3><div class="gates">' + gates.map(function (g) {
        return '<div class="gt ' + esc(g.check_state) + '" data-open="' + esc(g.id) + '"><div class="r"><b>' + esc(g.code + ' ' + g.title) + '</b><span class="d">' + esc(dl(g.due_date)) + '</span></div><p>' + esc(g.done_check) + '</p>' + checkSeg(g) + '</div>';
      }).join('') + '</div></div>';
    }
    var layers = [], seen = {};
    work.forEach(function (i) { if (!seen[i.layer]) { seen[i.layer] = 1; layers.push(i.layer); } });
    h += '<div class="card"><h3>Deliverables</h3><table><thead><tr><th>Code</th><th>Deliverable</th><th>Dates</th><th>Owner</th><th>Stage</th><th>Check</th><th>Evidence</th></tr></thead><tbody>';
    layers.forEach(function (L) {
      h += '<tr class="ly"><td colspan="7">' + esc(L || 'Other') + '</td></tr>';
      work.filter(function (i) { return i.layer === L; }).forEach(function (i) {
        var dd = daysTo(i.due_date), late = dd != null && dd < 0 && i.check_state !== 'pass';
        h += '<tr class="it" data-open="' + esc(i.id) + '"><td class="c">' + esc(i.code) + '</td><td><b>' + esc(i.title) + (i.critical ? '<span class="crit">critical path</span>' : '') + '</b><small>' + (stepCount(i) ? esc(stepCount(i)) + ' · ' : '') + esc(i.done_check).slice(0, 140) + '</small></td>'
          + '<td' + (late ? ' class="late"' : '') + ' style="white-space:nowrap">' + esc(span(i.start_date, i.due_date)) + '</td><td>' + esc(i.owner_name) + '</td><td>' + stageSel(i) + '</td><td>' + checkSeg(i) + '</td>'
          + '<td class="ev' + (i.check_state === 'pass' ? ' ok' : '') + '">' + esc(i.evidence) + '</td></tr>';
      });
    });
    return h + '</tbody></table></div>';
  }
  function boardHtml(p) {
    var work = itemsOf(p).filter(function (i) { return i.kind !== 'gate'; });
    return '<div class="board">' + STAGES.map(function (s) {
      var list = work.filter(function (i) { return i.stage === s; });
      return '<div class="col"><h4>' + esc(s) + '<span>' + list.length + '</span></h4>' + list.map(function (i) {
        return '<div class="bc" data-open="' + esc(i.id) + '"><b>' + esc(i.code + ' ' + i.title) + '</b><small>' + esc(i.owner_name) + (i.due_date ? ' · ' + esc(dl(i.due_date)) : '') + (stepCount(i) ? ' · ' + esc(stepCount(i)) : '') + '</small></div>';
      }).join('') + '</div>';
    }).join('') + '</div>';
  }
  function logHtml() {
    var rows = (S.data && S.data.log) || [];
    if (!rows.length) return '<div class="card">Nothing logged yet.</div>';
    return '<div class="card lg">' + rows.map(function (r) {
      var d = r.detail || {}, t = r.action === 'import' ? 'Plan imported: ' + (d.name || '') + ' (' + (d.gates || 0) + ' gates, ' + (d.deliverables || 0) + ' deliverables)'
        : r.action === 'add' ? r.code + ' added: ' + (d.title || '')
        : r.code + ': ' + [d.stage ? 'stage ' + d.stage[0] + ' to ' + d.stage[1] : '', d.check ? 'check ' + d.check[0] + ' to ' + d.check[1] : '', d.note ? 'note edited' : '', d.archived != null ? (d.archived ? 'removed' : 'restored') : '', d.step ? 'step ' + d.step[0] + (d.step[1] ? ' done' : ' reopened') : ''].filter(Boolean).join(', ');
      return '<div><em>' + esc(stamp(r.at)) + '</em>' + esc(t) + '</div>';
    }).join('') + '</div>';
  }
  function drawer() {
    var d = box.querySelector('.dr'), it = byId(S.open);
    if (!it) { d.classList.remove('on'); return; }
    d.innerHTML = '<button type="button" class="x" data-close>Close</button><h2>' + esc(it.code + ' ' + it.title) + '</h2><small>' + esc(it.layer) + '</small>'
      + '<dl><dt>Stage</dt><dd>' + stageSel(it) + '</dd><dt>Check</dt><dd>' + checkSeg(it) + '</dd>'
      + '<dt>' + (it.kind === 'gate' ? 'Passes when' : 'Done when') + '</dt><dd>' + esc(it.done_check) + '</dd>'
      + (it.kind === 'gate' && it.plan_note ? '<dt>If it fails</dt><dd>' + esc(it.plan_note) + '</dd>' : '')
      + (it.evidence ? '<dt>Evidence</dt><dd class="ev">' + esc(it.evidence) + '</dd>' : '')
      + '<dt>Dates</dt><dd>' + esc(span(it.start_date, it.due_date)) + '</dd><dt>Owner</dt><dd>' + esc(it.owner_name) + '</dd>'
      + (it.gate && it.kind !== 'gate' ? '<dt>Feeds gate</dt><dd>' + esc(it.gate) + '</dd>' : '')
      + ((it.depends_on || []).length ? '<dt>Waits on</dt><dd>' + esc(it.depends_on.join(', ')) + '</dd>' : '')
      + (it.kind !== 'gate' && it.plan_note ? '<dt>Plan note</dt><dd>' + esc(it.plan_note) + '</dd>' : '')
      + '</dl>'
      + (it.why ? '<h3>Why this matters</h3><p class="why">' + esc(it.why) + '</p>' : '')
      + (stepsOf(it).length ? '<h3>Steps · ' + esc(stepCount(it)) + '</h3><ol class="steps">' + stepsOf(it).map(function (x, i) {
          var on = (it.step_done || {})[String(i)];
          return '<li class="' + (on ? 'ok' : '') + '"><label><input type="checkbox" data-step="' + esc(it.id) + '" data-ix="' + i + '"' + (on ? ' checked' : '') + '><span><b>' + esc(x.t) + '</b>' + (x.how ? '<em>' + esc(x.how) + '</em>' : '') + '</span></label></li>';
        }).join('') + '</ol>' : '')
      + '<div class="share"><button type="button" class="btn pri" data-copy="' + esc(it.id) + '">Copy brief</button><button type="button" class="btn" data-print="' + esc(it.id) + '">Print or save as PDF</button></div>'
      + '<h3>Your notes</h3><textarea data-note="' + esc(it.id) + '" placeholder="Notes, links, what happened">' + esc(it.note) + '</textarea>';
    d.classList.add('on');
  }
  function paint() {
    if (!box) return;
    var main = box.querySelector('.main'), ps = (S.data && S.data.projects) || [], p = proj();
    box.querySelectorAll('.tabs button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-tab') === S.tab); });
    if (!S.data) { main.innerHTML = '<div class="card">Loading…</div>'; return; }
    if (!ps.length) { main.innerHTML = '<div class="card empty"><b>No projects yet</b>Import the plan file from the planning chat to start.</div>'; return; }
    if (p) S.project = p.id;
    var h = '<div class="projs">' + ps.map(function (x) {
      var n = itemsOf(x).filter(function (i) { return i.kind !== 'gate'; }), ok = n.filter(function (i) { return i.check_state === 'pass'; }).length;
      return '<button type="button" class="pj' + (x.id === S.project ? ' on' : '') + '" data-proj="' + esc(x.id) + '">' + esc(x.name) + '<small>' + ok + ' of ' + n.length + ' passed' + (x.target ? ' · target ' + esc(dl(x.target)) : '') + '</small></button>';
    }).join('') + '</div>';
    h += S.tab === 'board' ? boardHtml(p) : S.tab === 'log' ? logHtml() : projectsHtml(p);
    if (main.__h !== h) { var y = box.scrollTop; main.innerHTML = h; main.__h = h; box.scrollTop = y; }
    drawer();
  }
  function adopt(d) { if (d && d.projects) { S.data = d; paint(); } }
  function load() { call('GET').then(adopt).catch(function (e) { box.querySelector('.main').innerHTML = '<div class="card">' + esc(e.message) + '</div>'; }); }
  function patch(id, body, msg) { call('PATCH', Object.assign({ id: id }, body)).then(function (d) { adopt(d); if (msg) toast(msg); }).catch(function (e) { toast(e.message); }); }

  function parsePlan(text) {
    var t = String(text || '').trim(), m = t.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (m) t = m[1].trim();
    var tries = [t, '{' + t + '}', '{' + t.replace(/,\s*$/, '') + '}'];
    for (var i = 0; i < tries.length; i++) { try { var o = JSON.parse(tries[i]); if (o && typeof o === 'object') return o; } catch (e) {} }
    throw new Error('That file is not a plan the page can read.');
  }
  function importText(text) {
    var plan;
    try { plan = parsePlan(text); } catch (e) { toast(e.message); return; }
    toast('Importing…');
    call('POST', { action: 'import', plan: plan }).then(function (d) { S.project = d.projectId || S.project; adopt(d); toast('Plan imported: ' + d.count + ' gates and deliverables'); box.querySelector('.paste').classList.remove('on'); })
      .catch(function (e) { toast(e.message); });
  }

  function build() {
    /* Its own shadow root, so the app's page styles (tabs, buttons, cards) cannot reach in. */
    var host = document.createElement('div'); host.id = 'devRoomHost';
    document.body.appendChild(host);
    var root = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;
    var st = document.createElement('style'); st.textContent = ':host{all:initial}' + CSS; root.appendChild(st);
    box = document.createElement('div'); box.className = 'dvx'; box.setAttribute('role', 'region'); box.setAttribute('aria-label', 'Development');
    box.innerHTML = '<div class="in"><div class="top"><h1>Development</h1><div class="tabs"><button type="button" data-tab="projects">Projects</button><button type="button" data-tab="board">Board</button><button type="button" data-tab="log">Log</button></div><span class="sp"></span>'
      + '<button type="button" class="btn" data-copyall>Copy plan for the team</button><button type="button" class="btn" data-printall>Print plan</button><button type="button" class="btn" data-paste>Paste plan</button><button type="button" class="btn pri" data-import>Import plan</button><input type="file" accept=".json,.txt,.md,application/json,text/plain" hidden data-file></div>'
      + '<div class="paste"><textarea placeholder="Paste the plan JSON from the planning chat"></textarea><div style="margin-top:8px;display:flex;gap:8px"><button type="button" class="btn pri" data-go>Import</button><button type="button" class="btn" data-paste>Cancel</button></div></div>'
      + '<div class="main"></div></div><aside class="dr" aria-label="Details"></aside><div class="toast" role="status"></div>';
    root.appendChild(box);
    box.addEventListener('click', function (e) {
      var t = e.target;
      var tab = t.closest('[data-tab]'); if (tab) { S.tab = tab.getAttribute('data-tab'); paint(); return; }
      var pj = t.closest('[data-proj]'); if (pj) { S.project = pj.getAttribute('data-proj'); S.open = ''; paint(); return; }
      var ck = t.closest('[data-check]'); if (ck) { var it = byId(ck.getAttribute('data-check')), v = ck.getAttribute('data-v'); if (it && it.check_state !== v) patch(it.id, { check: v }, it.code + (v === 'pass' ? ' passed' : v === 'fail' ? ' failed' : ' reopened')); return; }
      if (t.closest('select')) return;
      if (t.closest('[data-close]')) { S.open = ''; drawer(); return; }
      var cp = t.closest('[data-copy]'); if (cp) { var ci = byId(cp.getAttribute('data-copy')); if (ci) copyText(brief(ci), 'Brief copied. Paste it into an email or message.'); return; }
      var pr = t.closest('[data-print]'); if (pr) { var pi = byId(pr.getAttribute('data-print')); if (pi) printText(pi.code + ' ' + pi.title, brief(pi)); return; }
      if (t.closest('[data-copyall]')) { var pp = proj(); if (pp) copyText(itemsOf(pp).map(brief).join('\n\n' + '-'.repeat(40) + '\n\n'), 'Whole plan copied for the team'); return; }
      if (t.closest('[data-printall]')) { var p2 = proj(); if (p2) printText(p2.name, itemsOf(p2).map(brief).join('\n\n' + '-'.repeat(40) + '\n\n')); return; }
      if (t.closest('[data-import]')) { box.querySelector('[data-file]').click(); return; }
      if (t.closest('[data-paste]')) { box.querySelector('.paste').classList.toggle('on'); return; }
      if (t.closest('[data-go]')) { importText(box.querySelector('.paste textarea').value); return; }
      var op = t.closest('[data-open]'); if (op) { S.open = op.getAttribute('data-open'); drawer(); }
    });
    box.addEventListener('change', function (e) {
      var t = e.target;
      if (t.matches('[data-stage]')) { var it = byId(t.getAttribute('data-stage')); if (it) patch(it.id, { stage: t.value }, it.code + ' moved to ' + t.value); }
      if (t.matches('[data-step]')) { patch(t.getAttribute('data-step'), { step: Number(t.getAttribute('data-ix')), stepDone: t.checked }, t.checked ? 'Step done' : 'Step reopened'); return; }
      if (t.matches('[data-note]')) patch(t.getAttribute('data-note'), { note: t.value }, 'Note saved');
      if (t.matches('[data-file]') && t.files && t.files[0]) { var f = t.files[0]; f.text().then(importText); t.value = ''; }
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && box.classList.contains('on') && S.open) { S.open = ''; drawer(); } });
  }
  function place() { var side = document.getElementById('side'), r = side ? side.getBoundingClientRect() : null; box.style.left = (r && r.width > 0 && r.right > 0 ? Math.round(r.right) : 0) + 'px'; }
  function open(push) {
    if (!box) build();
    place(); box.classList.add('on'); load();
    if (push && location.pathname !== '/development') { try { history.pushState({}, '', '/development'); } catch (e) {} }
    try { document.title = 'Development - 4orm Finance'; var c = document.getElementById('pageCrumb'); if (c) c.textContent = 'Development'; } catch (e) {}
    document.querySelectorAll('#side .nav').forEach(function (n) { n.classList.toggle('on', n.getAttribute('data-name') === 'Development'); });
  }
  function close() { if (box) { box.classList.remove('on'); S.open = ''; } }
  window.openDevelopment = function () { open(true); };
  window.addEventListener('resize', function () { if (box && box.classList.contains('on')) place(); });
  window.addEventListener('click', function (e) {
    var p = e.composedPath ? e.composedPath() : [];
    for (var i = 0; i < p.length; i++) {
      var n = p[i];
      if (n && n.classList && n.classList.contains('nav') && n.getAttribute && n.getAttribute('data-name')) {
        if (n.getAttribute('data-name') === 'Development') { e.preventDefault(); e.stopPropagation(); open(true); }
        else close();
        return;
      }
    }
  }, true);
  window.addEventListener('popstate', function () { if (location.pathname === '/development') open(false); else close(); });
  if (location.pathname === '/development') setTimeout(function () { open(false); }, 300);
})();
