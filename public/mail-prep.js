/* Email > Prep (30 Oct 2026). Outreach lined up as cards, grouped by category, zoom 2 to 9 across like Spaces.
   A card opens a side panel with the two best ways in, the reason to write, the draft and one button for the channel:
   email opens compose filled in (Send or Schedule from there), LinkedIn and forms open the page and copy the words,
   phone dials and shows the script. Nothing sends from here. */
(function () {
  var CATS = [
    ['vc25', 'First 25 VCs', '#2e6bf2'],
    ['newfund', 'New funds', '#7a4df2'],
    ['regulator', 'Regulators', '#0f8a8a'],
    ['angel_li', 'Angels on LinkedIn', '#0a66c2'],
    ['angel_em', 'Angels by email and form', '#e08a1e'],
    ['angel_ph', 'Angels by phone', '#1f9d55'],
    ['task', 'Tasks', '#5b6678']
  ];
  var CH = { email: 'Email', linkedin: 'LinkedIn', form: 'Form', phone: 'Call', task: 'Task', intro: 'Warm intro' };
  var DAYS = [['', 'All days'], ['2026-10-30', 'Friday 30'], ['2026-10-31', 'Saturday 31'], ['2026-11-02', 'Monday 2'], ['2026-11-03', 'Tuesday 3'], ['later', 'Later']];
  function S() { return window.STATE || (window.STATE = {}); }
  function P() { var s = S(); return s.prep || (s.prep = { items: null, day: '', show: 'ready', min: {}, open: '' }); }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function call(url, opts) {
    opts = opts || {};
    var o = { method: opts.method || 'GET', credentials: 'same-origin', headers: {} };
    if (opts.body) { o.body = JSON.stringify(opts.body); o.headers['content-type'] = 'application/json'; }
    var fn = typeof window.authFetch === 'function' ? window.authFetch : fetch;
    return fn(url, o).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
  }
  function catOf(k) { return CATS.filter(function (c) { return c[0] === k; })[0] || ['other', 'Other', '#5b6678']; }
  function dayLabel(d) {
    if (!d) return 'Any day';
    var t = new Date(d + 'T12:00:00');
    if (isNaN(t)) return d;
    return t.toLocaleDateString('en-CA', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'America/Vancouver' });
  }
  function inDay(it, day) {
    if (!day) return true;
    if (day === 'later') return !it.day || it.day > '2026-11-03';
    return it.day === day;
  }
  function inShow(it, show) {
    if (show === 'all') return true;
    if (show === 'done') return it.status === 'done' || it.status === 'skipped';
    return it.status === 'ready' || it.status === 'waiting';
  }
  function ini(n) { return String(n || '?').replace(/[^A-Za-z ]/g, ' ').trim().split(/\s+/).map(function (x) { return x[0] || ''; }).join('').slice(0, 2).toUpperCase() || '?'; }
  function primaryLabel(it) {
    if (it.channel === 'email') return 'Open in compose';
    if (it.channel === 'linkedin') return 'Copy and open LinkedIn';
    if (it.channel === 'form') return 'Copy and open the form';
    if (it.channel === 'phone') return it.phone ? 'Call ' + it.phone : 'Copy the agenda';
    if (it.channel === 'intro') return 'Copy the intro ask';
    return 'Mark done';
  }

  var CSS = ''
    + '.pp{color:#dbe4fb}'
    + '.pp .tool{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:4px 0 14px}'
    + '.pp .chips{display:flex;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:2px}'
    + '.pp .chips span{font-size:12.5px;font-weight:750;padding:6px 12px;border-radius:8px;color:#b9c6e6;cursor:pointer;white-space:nowrap}'
    + '.pp .chips span.on{background:#fff;color:#101a33}'
    + '.pp .zm{display:flex;align-items:center;gap:6px;margin-left:auto}'
    + '.pp .zm button{height:32px;min-width:34px;border-radius:9px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.08);color:#fff;font-size:16px;font-weight:800;cursor:pointer}'
    + '.pp .zm em{font-style:normal;font-size:12px;font-weight:700;color:#9fb0d0;min-width:64px;text-align:center}'
    + '.pp .kp{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}'
    + '.pp .kp span{font-size:12.5px;font-weight:700;color:#dbe4fb;background:rgba(255,255,255,.07);border-radius:999px;padding:5px 12px}.pp .kp b{color:#fff}'
    + '.pp .cat{margin-bottom:18px}'
    + '.pp .ch{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:12px;background:rgba(255,255,255,.05);cursor:pointer;user-select:none}'
    + '.pp .ch i{width:10px;height:10px;border-radius:3px;flex:none}'
    + '.pp .ch h2{margin:0;font-size:16px;font-weight:850;color:#fff}'
    + '.pp .ch .n{font-size:12px;font-weight:800;color:#b9c6e6;background:rgba(255,255,255,.1);border-radius:999px;padding:1px 9px}'
    + '.pp .ch .sum{font-size:12px;color:#8fa0c8;font-weight:600}'
    + '.pp .ch .tg{margin-left:auto;font-size:12.5px;font-weight:750;color:#9db9ff}'
    + '.pp .cat.min .grid{display:none}'
    + '.pp .grid{display:grid;grid-template-columns:repeat(var(--cols,4),minmax(0,1fr));gap:12px;padding-top:12px}'
    + '.pp .cd{background:#fff;color:#101a33;border-radius:14px;box-shadow:0 10px 26px rgba(3,10,30,.28);cursor:pointer;display:flex;flex-direction:column;min-width:0;border-left:5px solid var(--c);transition:transform .15s}'
    + '.pp .cd:hover{transform:translateY(-2px)}'
    + '.pp .cd.done{opacity:.55}'
    + '.pp .cd .hd{display:flex;align-items:center;gap:10px;padding:12px 14px 6px}'
    + '.pp .av{width:36px;height:36px;border-radius:10px;display:grid;place-items:center;color:#fff;font-size:13px;font-weight:850;flex:none;background:var(--c)}'
    + '.pp .cd h4{margin:0;color:#101a33;text-shadow:none;-webkit-text-stroke:0;font-size:14.5px;font-weight:850;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    + '.pp .cd .org{font-size:12px;color:#5b6678;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    + '.pp .cd .tt{min-width:0;flex:1}'
    + '.pp .st{font-size:11px;font-weight:800;border-radius:999px;padding:2px 8px;background:#eef2f9;color:#5b6678;white-space:nowrap}'
    + '.pp .st.done{background:#e3f6ea;color:#1f7a45}.pp .st.skipped{background:#f3e9e9;color:#9a3b3b}.pp .st.waiting{background:#fff3dd;color:#9a6a12}'
    + '.pp .cd .mt{display:flex;gap:6px;flex-wrap:wrap;padding:0 14px 6px}'
    + '.pp .cd .mt span{font-size:11.5px;font-weight:750;color:#344055;background:#f1f4f9;border-radius:6px;padding:2px 7px}'
    + '.pp .cd .hk{margin:0 14px 12px;max-height:5.2em;font-size:12.5px;line-height:1.4;color:#344055;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}'
    + '.pp .grid[data-cols="6"] .cd .hk,.pp .grid[data-cols="7"] .cd .hk,.pp .grid[data-cols="8"] .cd .hk,.pp .grid[data-cols="9"] .cd .hk{display:none}'
    + '.pp .grid[data-cols="7"] .cd .mt,.pp .grid[data-cols="8"] .cd .mt,.pp .grid[data-cols="9"] .cd .mt,.pp .grid[data-cols="7"] .av,.pp .grid[data-cols="8"] .av,.pp .grid[data-cols="9"] .av{display:none}'
    + '.pp .grid[data-cols="8"] .cd .st,.pp .grid[data-cols="9"] .cd .st{display:none}'
    + '.pp .empty{padding:30px;text-align:center;color:#9fb0d0;font-size:14px}'
    + '.pp-scrim{position:fixed;inset:0;background:rgba(3,8,22,.45);z-index:80}'
    + '.pp-dr{position:fixed;top:0;right:0;bottom:0;width:min(620px,100vw);background:#fff;color:#101a33;z-index:81;display:flex;flex-direction:column;box-shadow:-20px 0 50px rgba(0,0,0,.35)}'
    + '.pp-dr .dh{padding:18px 22px 12px;border-bottom:1px solid #e6ebf3;border-left:6px solid var(--c)}'
    + '.pp-dr .dh h3{margin:0;color:#101a33;text-shadow:none;font-size:20px;font-weight:850}.pp-dr .dh p{margin:3px 0 0;color:#5b6678;font-size:13px}'
    + '.pp-dr .db{flex:1;overflow:auto;padding:14px 22px 20px}'
    + '.pp-dr h5{text-shadow:none;margin:16px 0 6px;font-size:11.5px;letter-spacing:.06em;text-transform:uppercase;color:#5b6678}'
    + '.pp-dr .rt{display:flex;gap:10px;padding:8px 10px;border:1px solid #e6ebf3;border-radius:10px;margin-bottom:6px;font-size:13.5px;line-height:1.4}'
    + '.pp-dr .rt b.n{flex:none;width:22px;height:22px;border-radius:6px;background:#101a33;color:#fff;display:grid;place-items:center;font-size:12px}'
    + '.pp-dr .rt small{display:block;color:#5b6678;font-size:12px}'
    + '.pp-dr a{color:#2e6bf2;font-weight:700;text-decoration:none;word-break:break-all}'
    + '.pp-dr .hk{font-size:13.5px;line-height:1.5;background:#f6f8fc;border-radius:10px;padding:10px 12px}'
    + '.pp-dr .wo{font-size:13px;color:#9a6a12;background:#fff7e8;border-radius:10px;padding:8px 12px;margin-top:8px}'
    + '.pp-dr label{display:block;font-size:12px;font-weight:750;color:#5b6678;margin:10px 0 4px}'
    + '.pp-dr input,.pp-dr textarea{width:100%;box-sizing:border-box;border:1px solid #d6deea;border-radius:10px;padding:9px 11px;font:inherit;font-size:14px;color:#101a33;background:#fff}'
    + '.pp-dr textarea{min-height:220px;line-height:1.5;resize:vertical}'
    + '.pp-dr textarea.sm{min-height:110px}'
    + '.pp-dr .cnt{font-size:11.5px;color:#5b6678;text-align:right;margin-top:3px}.pp-dr .cnt.over{color:#c0263b;font-weight:800}'
    + '.pp-dr .df{display:flex;gap:8px;flex-wrap:wrap;padding:12px 22px;border-top:1px solid #e6ebf3}'
    + '.pp-dr .b{height:38px;border-radius:10px;border:1px solid #d6deea;background:#fff;color:#101a33;font-size:13.5px;font-weight:750;padding:0 14px;cursor:pointer}'
    + '.pp-dr .b.pri{background:#2e6bf2;border-color:#2e6bf2;color:#fff}'
    + '.pp-dr .b.r{margin-left:auto}';

  function counts(items) {
    var c = { ready: 0, done: 0, today: 0, sat: 0 };
    items.forEach(function (it) {
      if (it.status === 'done') c.done += 1; else if (it.status !== 'skipped') c.ready += 1;
      if (it.day === '2026-10-30' && it.status !== 'done' && it.status !== 'skipped') c.today += 1;
      if (it.day === '2026-10-31' && it.status !== 'done' && it.status !== 'skipped') c.sat += 1;
    });
    return c;
  }
  function cardHtml(it) {
    var c = catOf(it.cat);
    var meta = [CH[it.channel] || it.channel];
    if (it.day) meta.push(dayLabel(it.day).replace(/,.*$/, '') + (it.slot ? ' ' + it.slot : ''));
    var st = it.status === 'ready' ? '' : '<span class="st ' + esc(it.status) + '">' + esc({ done: 'Done', skipped: 'Skipped', waiting: 'Waiting' }[it.status] || it.status) + '</span>';
    return '<div class="cd' + (it.status === 'done' || it.status === 'skipped' ? ' done' : '') + '" style="--c:' + c[2] + '" data-action="prep-open" data-id="' + esc(it.id) + '">'
      + '<div class="hd"><div class="av">' + esc(ini(it.name)) + '</div><div class="tt"><h4>' + esc(it.name) + '</h4><div class="org">' + esc(it.org || it.title || '') + '</div></div>' + st + '</div>'
      + '<div class="mt">' + meta.map(function (m) { return '<span>' + esc(m) + '</span>'; }).join('') + '</div>'
      + (it.hook ? '<div class="hk">' + esc(it.hook) + '</div>' : '')
      + '</div>';
  }
  function pageHtml() {
    var p = P();
    var items = p.items || [];
    var c = counts(items);
    var list = items.filter(function (it) { return inDay(it, p.day) && inShow(it, p.show); });
    var html = '<div class="pp"><div class="tool">'
      + '<div class="chips">' + DAYS.map(function (d) { return '<span class="' + (p.day === d[0] ? 'on' : '') + '" data-action="prep-day" data-day="' + d[0] + '">' + d[1] + '</span>'; }).join('') + '</div>'
      + '<div class="chips">' + [['ready', 'To do'], ['done', 'Done'], ['all', 'Everything']].map(function (d) { return '<span class="' + (p.show === d[0] ? 'on' : '') + '" data-action="prep-show" data-show="' + d[0] + '">' + d[1] + '</span>'; }).join('') + '</div>'
      + '<div class="zm"><button type="button" data-action="prep-zoom" data-dir="-1" aria-label="Fewer across">&minus;</button><em id="ppCols"></em><button type="button" data-action="prep-zoom" data-dir="1" aria-label="More across">+</button></div>'
      + '</div>'
      + '<div class="kp"><span><b>' + c.today + '</b> lined up for Friday</span><span><b>' + c.sat + '</b> for Saturday</span><span><b>' + c.ready + '</b> to do</span><span><b>' + c.done + '</b> done</span><span>Nothing sends from here. You send each one.</span></div>';
    if (p.items == null) return html + '<div class="empty">Loading Prep&hellip;</div></div>';
    if (p.err) return html + '<div class="empty">' + esc(p.err) + ' <a href="#" data-action="prep-reload" style="color:#9db9ff">Try again</a></div></div>';
    var any = false;
    CATS.forEach(function (cat) {
      var rows = list.filter(function (it) { return it.cat === cat[0]; });
      rows.sort(function (a, b) { var x = (a.day || '9') + ' ' + (a.slot || '') , y = (b.day || '9') + ' ' + (b.slot || ''); return x < y ? -1 : x > y ? 1 : (a.sort - b.sort); });
      if (!rows.length) return;
      any = true;
      var all = items.filter(function (it) { return it.cat === cat[0]; });
      var dn = all.filter(function (it) { return it.status === 'done'; }).length;
      html += '<div class="cat' + (p.min[cat[0]] ? ' min' : '') + '"><div class="ch" data-action="prep-min" data-cat="' + cat[0] + '"><i style="background:' + cat[2] + '"></i><h2>' + esc(cat[1]) + '</h2><span class="n">' + rows.length + '</span><span class="sum">' + dn + ' of ' + all.length + ' done</span><span class="tg">' + (p.min[cat[0]] ? 'Show' : 'Hide') + '</span></div>'
        + '<div class="grid" data-zoom-key="prep">' + rows.map(cardHtml).join('') + '</div></div>';
    });
    if (!any) html += '<div class="empty">' + (items.length ? 'Nothing here for this day. Pick another day or Everything.' : 'Nothing prepared yet.') + '</div>';
    return html + '</div>';
  }
  function fitCols(host) {
    var n = window.gridCols ? window.gridCols('prep', 4) : 4;
    var w = host.clientWidth || 1200;
    var min = n >= 7 ? 130 : n >= 5 ? 165 : 230;
    var max = Math.max(2, Math.floor((w + 12) / (min + 12)));
    var eff = Math.min(n, max);
    host.querySelectorAll('.grid').forEach(function (g) { g.style.setProperty('--cols', String(eff)); g.setAttribute('data-cols', String(eff)); });
    var em = host.querySelector('#ppCols');
    if (em) em.textContent = eff + ' across';
  }
  function hostOf(root) { return root && root.querySelector ? root.querySelector('#prepHost') : null; }
  function repaint(root) {
    var host = hostOf(root || P().root);
    if (!host) return;
    host.innerHTML = pageHtml();
    fitCols(host);
    host.querySelectorAll('.grid').forEach(function (g) { if (window.bindGridZoom) window.bindGridZoom(root, g, 'prep', 4); });
    fitCols(host);
  }
  function load(root) {
    var p = P();
    p.err = '';
    return call('/api/prep').then(function (d) { p.items = d.items || []; repaint(root); })
      .catch(function () { p.items = p.items || []; p.err = 'Could not load Prep.'; repaint(root); });
  }
  window.paintMailPrep = function (wrap, barHtml) {
    var root = wrap.getRootNode ? wrap.getRootNode() : document;
    var p = P();
    p.root = root;
    if (!root.getElementById || !root.getElementById('ppCss')) {
      var st = document.createElement('style');
      st.id = 'ppCss';
      st.textContent = CSS;
      (root.nodeType === 11 ? root : document.head).appendChild(st);
    }
    wrap.innerHTML = barHtml + '<div id="prepHost"></div>';
    repaint(root);
    if (p.items == null || Date.now() - (p.at || 0) > 60000) { p.at = Date.now(); load(root); }
    if (!p.rz) { p.rz = 1; window.addEventListener('resize', function () { var h = hostOf(P().root); if (h) fitCols(h); }); }
    if (P().open && !(root.getElementById && root.getElementById('ppDr'))) openDrawer(root, P().open);
  };
  window.onGridZoom = (function (prior) {
    return function (key, n) {
      if (typeof prior === 'function') { try { prior(key, n); } catch (e) {} }
      if (key === 'prep') { var h = hostOf(P().root); if (h) fitCols(h); }
    };
  })(window.onGridZoom);

  function item(id) { return (P().items || []).filter(function (x) { return x.id === id; })[0] || null; }
  function closeDrawer(root) {
    ['ppDr', 'ppScrim'].forEach(function (id) { var n = root.getElementById ? root.getElementById(id) : document.getElementById(id); if (n) n.remove(); });
    P().open = '';
  }
  function routeHtml(r, i) {
    if (!r) return '';
    var url = r.url ? '<br><a href="' + esc(/^https?:|^mailto:|^tel:/.test(r.url) ? r.url : 'https://' + r.url) + '" target="_blank" rel="noopener">' + esc(r.url.replace(/^https?:\/\//, '')) + '</a>' : '';
    return '<div class="rt"><b class="n">' + (i + 1) + '</b><div><b>' + esc(r.how || '') + '</b>' + (r.detail ? ' ' + esc(r.detail) : '') + url + (r.why ? '<small>' + esc(r.why) + '</small>' : '') + '</div></div>';
  }
  function limitFor(it) { return it.channel === 'linkedin' ? 300 : 0; }
  function openDrawer(root, id) {
    var it = item(id);
    if (!it) return;
    closeDrawer(root);
    P().open = id;
    var c = catOf(it.cat);
    var scrim = document.createElement('div');
    scrim.id = 'ppScrim'; scrim.className = 'pp-scrim'; scrim.setAttribute('data-action', 'prep-close');
    var dr = document.createElement('aside');
    dr.id = 'ppDr'; dr.className = 'pp-dr'; dr.style.setProperty('--c', c[2]);
    var routes = Array.isArray(it.routes) ? it.routes : [];
    var contact = [];
    if (it.to_email) contact.push('<a href="mailto:' + esc(it.to_email) + '">' + esc(it.to_email) + '</a>');
    if (it.phone) contact.push('<a href="tel:' + esc(String(it.phone).replace(/[^+\d]/g, '')) + '">' + esc(it.phone) + '</a>');
    if (it.linkedin) contact.push('<a href="' + esc(/^https?:/.test(it.linkedin) ? it.linkedin : 'https://' + it.linkedin) + '" target="_blank" rel="noopener">LinkedIn</a>');
    if (it.url) contact.push('<a href="' + esc(/^https?:/.test(it.url) ? it.url : 'https://' + it.url) + '" target="_blank" rel="noopener">' + esc(it.channel === 'form' ? 'Pitch form' : 'Website') + '</a>');
    var lim = limitFor(it);
    var bodyLabel = it.channel === 'linkedin' ? 'Connection note (300 characters at most)' : it.channel === 'phone' ? 'Call script' : it.channel === 'form' ? 'What to paste into the form' : 'Email';
    var fuLabel = it.channel === 'linkedin' ? 'Message once they accept' : it.channel === 'phone' ? 'Voicemail, then the follow-up email' : 'Follow-up if no reply';
    dr.innerHTML = '<div class="dh"><h3>' + esc(it.name) + '</h3><p>' + esc([it.title, it.org].filter(Boolean).join(', ')) + ' &middot; ' + esc(c[1]) + ' &middot; ' + esc(CH[it.channel] || '') + ' &middot; ' + esc(dayLabel(it.day)) + (it.slot ? ' ' + esc(it.slot) + ' Vancouver' : '') + '</p>'
      + (contact.length ? '<p>' + contact.join(' &middot; ') + '</p>' : '') + '</div>'
      + '<div class="db">'
      + (routes.length ? '<h5>The two best ways in</h5>' + routes.map(routeHtml).join('') : '')
      + (it.hook ? '<h5>Why them</h5><div class="hk">' + esc(it.hook) + (it.hook_url ? '<br><a href="' + esc(it.hook_url) + '" target="_blank" rel="noopener">Source</a>' : '') + '</div>' : '')
      + (it.watch ? '<div class="wo">' + esc(it.watch) + '</div>' : '')
      + (it.channel === 'email' || it.channel === 'form' ? '<label>Subject</label><input id="ppSubj" data-action="prep-field" value="' + esc(it.subject) + '">' : '')
      + '<label>' + bodyLabel + '</label><textarea id="ppBody" data-action="prep-field"' + (lim ? ' class="sm"' : '') + '>' + esc(it.body) + '</textarea>'
      + (lim ? '<div class="cnt" id="ppCnt"></div>' : '')
      + (it.followup ? '<label>' + fuLabel + '</label><textarea id="ppFu" readonly>' + esc(it.followup) + '</textarea>' : '')
      + (it.note ? '<h5>Note</h5><div class="hk">' + esc(it.note) + '</div>' : '')
      + '</div>'
      + '<div class="df"><button class="b pri" type="button" data-action="prep-go" data-id="' + esc(id) + '">' + esc(primaryLabel(it)) + '</button>'
      + '<button class="b" type="button" data-action="prep-copy" data-id="' + esc(id) + '">Copy words</button>'
      + (it.followup ? '<button class="b" type="button" data-action="prep-copy-fu" data-id="' + esc(id) + '">Copy follow-up</button>' : '')
      + (it.status === 'ready' || it.status === 'waiting'
        ? '<button class="b r" type="button" data-action="prep-status" data-st="done" data-id="' + esc(id) + '">Mark done</button><button class="b" type="button" data-action="prep-status" data-st="skipped" data-id="' + esc(id) + '">Skip</button>'
        : '<button class="b r" type="button" data-action="prep-status" data-st="ready" data-id="' + esc(id) + '">Back to to do</button>')
      + '<button class="b" type="button" data-action="prep-close">Close</button></div>';
    var host = root.nodeType === 11 ? root : document.body;
    host.appendChild(scrim);
    host.appendChild(dr);
    var ta = dr.querySelector('#ppBody');
    function cnt() { var n = dr.querySelector('#ppCnt'); if (n && ta) { n.textContent = ta.value.length + ' of ' + lim; n.classList.toggle('over', ta.value.length > lim); } }
    cnt();
    function save() {
      var subj = dr.querySelector('#ppSubj');
      var patch = { body: ta ? ta.value : it.body };
      if (subj) patch.subject = subj.value;
      if (patch.body === it.body && (!subj || patch.subject === it.subject)) return;
      it.body = patch.body; if (subj) it.subject = patch.subject;
      call('/api/prep', { method: 'POST', body: { action: 'patch', id: id, patch: patch } }).catch(function () { toast(root, 'Could not save the edit.'); });
    }
    if (ta) { ta.addEventListener('input', cnt); ta.addEventListener('blur', save); }
    var sj = dr.querySelector('#ppSubj'); if (sj) sj.addEventListener('blur', save);
    dr._save = save;
  }
  function toast(root, msg) {
    var n = document.getElementById('actNote');
    if (n) { n.hidden = false; n.textContent = msg; clearTimeout(toast.t); toast.t = setTimeout(function () { n.hidden = true; }, 3500); }
  }
  function copy(text) {
    try { if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text); } catch (e) {}
    var t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select();
    try { document.execCommand('copy'); } catch (e) {}
    t.remove();
    return Promise.resolve();
  }
  function setStatus(root, id, st) {
    var it = item(id);
    if (!it) return;
    var before = it.status;
    it.status = st;
    closeDrawer(root);
    repaint(root);
    var label = st === 'done' ? 'Marked done: ' + it.name : st === 'skipped' ? 'Skipped: ' + it.name : 'Back to to do: ' + it.name;
    function commit() { return call('/api/prep', { method: 'POST', body: { action: 'patch', id: id, patch: { status: st } } }).catch(function () { it.status = before; repaint(root); toast(root, 'Could not save that.'); }); }
    function undo() { it.status = before; repaint(root); }
    if (typeof window.__undoLater === 'function') window.__undoLater(label, commit, undo, 10000);
    else commit();
  }
  function words(it) { return (it.channel === 'email' || it.channel === 'form') && it.subject ? 'Subject: ' + it.subject + '\n\n' + it.body : it.body; }

  var actions = {
    'prep-open': function (el, root) { openDrawer(root, el.getAttribute('data-id')); },
    'prep-close': function (el, root) { var d = root.getElementById && root.getElementById('ppDr'); if (d && d._save) d._save(); closeDrawer(root); },
    'prep-field': function () {},
    'prep-reload': function (el, root) { P().items = null; repaint(root); load(root); },
    'prep-day': function (el, root) { P().day = el.getAttribute('data-day') || ''; repaint(root); },
    'prep-show': function (el, root) { P().show = el.getAttribute('data-show') || 'ready'; repaint(root); },
    'prep-min': function (el, root) { var k = el.getAttribute('data-cat'); P().min[k] = !P().min[k]; repaint(root); },
    'prep-zoom': function (el, root) {
      var g = Array.prototype.slice.call(root.querySelectorAll('#prepHost .grid'));
      if (window.gridZoomStep) window.gridZoomStep('prep', Number(el.getAttribute('data-dir')) || 1, 4, g);
      var h = hostOf(root); if (h) fitCols(h);
    },
    'prep-copy': function (el, root) {
      var d = root.getElementById && root.getElementById('ppDr'); if (d && d._save) d._save();
      var it = item(el.getAttribute('data-id')); if (!it) return;
      copy(words(it)).then(function () { toast(root, 'Copied.'); });
    },
    'prep-copy-fu': function (el, root) {
      var it = item(el.getAttribute('data-id')); if (!it) return;
      copy(it.followup).then(function () { toast(root, 'Follow-up copied.'); });
    },
    'prep-status': function (el, root) { setStatus(root, el.getAttribute('data-id'), el.getAttribute('data-st')); },
    'prep-go': function (el, root) {
      var d = root.getElementById && root.getElementById('ppDr'); if (d && d._save) d._save();
      var it = item(el.getAttribute('data-id')); if (!it) return;
      if (it.channel === 'email') {
        if (!it.to_email) { toast(root, 'No email address on this one. Use route 2.'); return; }
        closeDrawer(root);
        S().mailView = 'inbox';
        if (typeof window.openComposeDraft === 'function') window.openComposeDraft({ to: [{ email: it.to_email, name: it.name }], subject: it.subject, body: it.body });
        else copy(words(it));
        return;
      }
      if (it.channel === 'phone' && it.phone) { window.location.href = 'tel:' + String(it.phone || '').replace(/[^+\d]/g, ''); return; }
      var url = it.channel === 'linkedin' ? it.linkedin : it.url;
      copy(words(it)).then(function () { toast(root, 'Words copied. Paste them in.'); });
      if (url) window.open(/^https?:/.test(url) ? url : 'https://' + url, '_blank', 'noopener');
    }
  };
  function register() {
    var A = window.deskActions;
    if (!A) return false;
    Object.assign(A, actions);
    window.__deskInputExt = window.__deskInputExt || {};
    window.__deskInputExt['prep-field'] = function () {};
    return true;
  }
  if (!register()) {
    var tries = 0;
    var t = setInterval(function () { tries += 1; if (register() || tries > 80) clearInterval(t); }, 50);
  }
})();
