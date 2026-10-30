/* Process builder, 29 Oct 2026.
   Every GoHighLevel pipeline, stage by stage. Click a stage to build its package (email, documents, follow-up, task).
   When a contact is moved onto a stage that has a package, window.stageGate shows exactly what goes out and asks first.
   Also: jump buttons between the 15-minute sprint and the Pipeline. */
(function () {
  if (window.openProcessBuilder) return;
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function api(url, method, body) {
    var fn = typeof window.authFetch === 'function' ? window.authFetch : fetch;
    return fn(url, { method: method || 'GET', credentials: 'same-origin', headers: body ? { 'content-type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || 'Could not reach the server'); return j; }); });
  }
  function hhmm(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    return d.toLocaleDateString('en-CA', { timeZone: 'America/Vancouver', month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString('en-GB', { timeZone: 'America/Vancouver', hour: '2-digit', minute: '2-digit', hour12: false });
  }

  var CSS = ''
    + '.pbx *{box-sizing:border-box;letter-spacing:normal}'
    + '.pbx{position:fixed;inset:0;z-index:2147481500;background:#07080b;color:#fff;font:500 12.5px/1.45 Inter,-apple-system,system-ui,sans-serif;display:none;flex-direction:column}'
    + '.pbx.open{display:flex}'
    + '.pbx .x-top{display:flex;align-items:center;gap:14px;padding:16px 24px;border-bottom:1px solid #1d1f26}'
    + '.pbx h1{font-size:22px;font-weight:850;margin:0;color:#fff!important;white-space:nowrap}.pbx .x-top button{white-space:nowrap}.pbx .x-sub{color:#aeb6c8}.pbx .x-sp{flex:1}'
    + '.pbx button{font:inherit;font-size:12px;font-weight:800;padding:8px 12px;border-radius:9px;border:1px solid #2a2c35;background:#18191f;color:#fff;cursor:pointer}'
    + '.pbx button:hover{border-color:#4272f9}.pbx button.pri{background:#00dc86;border-color:#00dc86;color:#03170d}.pbx button.warn{color:#ff8a9c}'
    + '.pbx button[disabled]{opacity:.5;cursor:default}'
    + '.pbx .x-pipes{display:flex;gap:6px;flex-wrap:wrap;padding:12px 24px;border-bottom:1px solid #1d1f26}'
    + '.pbx .pl{display:inline-flex;gap:8px;align-items:center;border-radius:999px;padding:7px 12px;background:#111216}'
    + '.pbx .pl.on{background:#4272f9;border-color:#4272f9}.pbx .pl small{color:#7d859a;font-weight:700}.pbx .pl.on small{color:#dfe6ff}'
    + '.pbx .x-body{flex:1;display:grid;grid-template-columns:minmax(0,1fr) 460px;min-height:0}'
    + '.pbx .x-map{padding:18px 24px 40px;overflow:auto}.pbx .x-ed{border-left:1px solid #1d1f26;padding:16px 18px;overflow:auto;background:#0d0e12}'
    + '.pbx .k{font-size:10.5px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#7d859a;margin:4px 0 8px}'
    + '.pbx .sum{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:16px}.pbx .sum h2{margin:0 12px 0 0;font-size:18px;font-weight:850}'
    + '.pbx .chip{border-radius:999px;padding:5px 10px;background:#18191f;color:#c8d1ea;font-size:11.5px;font-weight:700}.pbx .chip.g{background:rgba(0,220,134,.12);color:#5ff0b4}'
    + '.pbx .only{display:flex;align-items:center;gap:6px;margin-left:auto;color:#aeb6c8;font-size:12px;cursor:pointer}.pbx .only input{width:auto}'
    + '.pbx .heads{display:grid;grid-template-columns:40px minmax(150px,230px) 34px minmax(0,1fr);padding:0 0 6px}.pbx .heads span{font-size:10.5px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#7d859a}'
    + '.pbx .grp{font-size:10.5px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#7d859a;margin:22px 0 6px 40px}'
    + '.pbx .r{position:relative;display:grid;grid-template-columns:40px minmax(150px,230px) 34px minmax(0,1fr);align-items:stretch;width:100%;padding:0;border:0;background:none;text-align:left;border-radius:0;min-height:64px}'
    + '.pbx .r:hover{border:0}'
    + '.pbx .r .sp{position:relative}.pbx .r .sp::before{content:"";position:absolute;left:19px;top:0;bottom:0;width:2px;background:#23252e}'
    + '.pbx .r.first .sp::before{top:50%}.pbx .r.last .sp::before{bottom:50%}.pbx .r.solo .sp::before{display:none}'
    + '.pbx .r .dot{position:absolute;left:8px;top:50%;transform:translateY(-50%);width:24px;height:24px;border-radius:50%;background:#07080b;border:2px solid #3a3d48;color:#aeb6c8;font-size:10.5px;font-weight:850;display:flex;align-items:center;justify-content:center}'
    + '.pbx .r.has .dot{background:#00dc86;border-color:#00dc86;color:#03170d}.pbx .r.off .dot{border-color:#ffa946;color:#ffc98a}'
    + '.pbx .r .sb{margin:5px 0;background:#111216;border:1px solid #2a2c35;border-radius:10px;padding:9px 12px;display:flex;flex-direction:column;justify-content:center;gap:2px}'
    + '.pbx .r .sb b{font-size:13.5px;line-height:1.25}.pbx .r .sb span{font-size:11.5px;color:#7d859a}.pbx .r .sb span.live{color:#9fb8ff;font-weight:700}'
    + '.pbx .r .ln{position:relative}.pbx .r .ln::before{content:"";position:absolute;left:0;right:0;top:50%;height:2px;background:#23252e}.pbx .r.has .ln::before{background:#00dc86}.pbx .r.off .ln::before{background:#ffa946;opacity:.6}'
    + '.pbx .r .em{margin:5px 0;border-radius:10px;padding:9px 12px;display:flex;flex-direction:column;justify-content:center;gap:4px;min-width:0}'
    + '.pbx .r.has .em{background:rgba(0,220,134,.06);border:1px solid rgba(0,220,134,.35)}.pbx .r.off .em{background:rgba(255,169,70,.06);border:1px solid rgba(255,169,70,.35)}'
    + '.pbx .r.none .em{border:1px dashed #2f323c;color:#7d859a;font-size:12px}'
    + '.pbx .r .em .sj{font-size:13px;font-weight:800;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pbx .r .em .sj small{font-weight:800;font-size:10px;letter-spacing:.08em;text-transform:uppercase;margin-right:8px;color:#5ff0b4}.pbx .r.off .em .sj small{color:#ffc98a}'
    + '.pbx .r .em .pv{font-size:11.5px;color:#aeb6c8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    + '.pbx .r .em .tg{display:flex;gap:5px;flex-wrap:wrap}.pbx .r .em .tg i{font-style:normal;font-size:10.5px;font-weight:700;border-radius:999px;padding:2px 8px;background:#18191f;color:#c8d1ea}'
    + '.pbx .r:hover .sb,.pbx .r:hover .em{border-color:#4272f9}'
    + '.pbx .r.on .sb{border-color:#4272f9;box-shadow:0 0 0 2px rgba(66,114,249,.35)}.pbx .r.on .em{border-color:#4272f9}'
    + '.pbx .r.ex{min-height:52px}.pbx .r.ex .dot{width:14px;height:14px;left:13px;font-size:0}'
    + '.pbx label{display:block;font-size:10.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#7d859a;margin:12px 0 5px}'
    + '.pbx input,.pbx textarea,.pbx select{width:100%;background:#18191f;border:1px solid #2a2c35;border-radius:9px;color:#fff;font:inherit;padding:8px 10px}'
    + '.pbx textarea{min-height:260px;resize:vertical;line-height:1.5}'
    + '.pbx .row{display:flex;gap:8px;align-items:center}.pbx .row>*{flex:1}.pbx .row>.fit{flex:0 0 auto}'
    + '.pbx .doc{display:grid;grid-template-columns:1fr 1.4fr auto;gap:6px;margin-bottom:6px}'
    + '.pbx .hint{color:#7d859a;font-size:11.5px;margin-top:4px}.pbx .acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}'
    + '.pbx .starters button{display:block;width:100%;text-align:left;margin-bottom:6px;background:#111216}'
    + '.pbx .log div{border-left:2px solid #2a2c35;padding:2px 0 6px 10px;color:#c8d1ea}.pbx .log small{color:#7d859a;display:block}'
    + '.pbx .empty{color:#7d859a;padding:30px 0}.pbx .tog{display:flex;align-items:center;gap:8px;margin-top:12px;color:#c8d1ea}.pbx .tog input{width:auto}'
    + '.pbx .toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#20222a;border:1px solid #2a2c35;border-radius:10px;padding:10px 14px;display:none;gap:12px;align-items:center;z-index:5}'
    + '.pbx .toast.on{display:flex}'
    + '@media(max-width:1100px){.pbx .x-body{display:block;overflow:auto}.pbx .x-map{overflow:visible;padding:14px 14px 30px}.pbx .x-ed{overflow:visible;border:1px solid #4272f9;border-radius:12px;margin:4px 0 12px 40px}.pbx .x-top{flex-wrap:wrap}.pbx .x-pipes{padding:10px 14px}.pbx .heads,.pbx .r{grid-template-columns:40px minmax(110px,170px) 18px minmax(0,1fr)}}'
    /* the confirm card */
    + '.sgx{position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.65);display:flex;align-items:flex-start;justify-content:center;padding:40px 16px;overflow:auto;font:500 12.5px/1.45 Inter,-apple-system,system-ui,sans-serif;color:#fff}'
    + '.sgx *{box-sizing:border-box;letter-spacing:normal}.sgx .bx{width:min(640px,100%);background:#111216;border:1px solid #2a2c35;border-radius:16px;box-shadow:0 30px 80px rgba(0,0,0,.6)}'
    + '.sgx .hd{padding:16px 20px;border-bottom:1px solid #23252e}.sgx h3{margin:0;font-size:17px;font-weight:850}.sgx .sub{color:#aeb6c8;margin-top:3px}'
    + '.sgx .bd{padding:14px 20px}.sgx .k{font-size:10.5px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#7d859a;margin:10px 0 4px}'
    + '.sgx pre{white-space:pre-wrap;font:inherit;background:#18191f;border-radius:10px;padding:10px 12px;margin:0;max-height:260px;overflow:auto;color:#e6eaf2}'
    + '.sgx ul{margin:0;padding-left:16px}.sgx li{color:#e6eaf2}.sgx .why{background:rgba(255,72,102,.12);color:#ff8a9c;border-radius:9px;padding:8px 10px;margin-top:10px}'
    + '.sgx .ft{display:flex;gap:8px;justify-content:flex-end;padding:12px 20px;border-top:1px solid #23252e}'
    + '.sgx button{font:inherit;font-size:12px;font-weight:800;padding:8px 12px;border-radius:9px;border:1px solid #2a2c35;background:#18191f;color:#fff;cursor:pointer}.sgx button:hover{border-color:#4272f9}.sgx button.pri{background:#00dc86;border-color:#00dc86;color:#03170d}';
  var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);

  var STARTERS = [
    { name: 'Investor: material requested', subject: '4ormIQ: the material you asked for', body: "Hi {{first_name}},\n\nThanks for taking the time. As promised, here is a short overview of 4ormIQ, with the deck and data room attached.\n\nThe problem:\n\nCanada's anti-money-laundering rules now reach well beyond the banks, and the cost of getting them wrong has jumped.\n\n- Since March 26, 2026, FINTRAC can fine a company up to C$20M for a single very serious violation. That is 40 times the old C$500,000 limit. Breaking a compliance order can now cost the greater of C$30M or 3% of worldwide gross revenue.\n\n- Since October 11, 2024, mortgage brokers, lenders and administrators carry full federal anti-money-laundering duties: a compliance program, client identity checks, record-keeping and reporting.\n\n- Compliance already costs a lot. For 24 Canadian property and casualty insurers, it rose 81% in two years, from C$416M in 2022 to C$753M in 2024.\n\nWho it affects:\n\nMortgage brokers, lenders and administrators; banks and credit unions; life insurers and their agents; securities dealers; real estate brokers and developers; money services businesses; accountants; BC notaries; dealers in precious metals and stones; and title insurers and factoring businesses.\n\nWhat we are building:\n\n4ormIQ is a set of AI tools that puts client counselling at the centre and plugs into the apps and compliance systems a business already uses.\n\n- Before any recommendation, the client privately works through their goals, circumstances and risk profile. They can model and compare outcomes and see the short- and long-term risks.\n\n- The client then chooses what to share with the professional. That shared brief gives the firm better context for a sound recommendation.\n\n- Every step is recorded as it happens, so the firm has an auditable record of the whole suitability and decision process.\n\nThe round:\n\nWe are raising C$500,000 in a pre-seed round at C$0.50 per share.\n\nWould next week be a challenge to get together?\n\nWith Gratitude,\n\nChad R Johnston\nFounder & CEO\n4orm Finance\n778-363-2423", follow: 4, task: 'Follow up on material sent to {{name}}' },
    { name: 'Design partner: material requested', subject: '4ormIQ for {{company}}: what a pilot looks like', body: 'Hi {{first_name}},\n\nThanks for the conversation. Here is what we talked about, with the short overview linked below.\n\nWhat 4ormIQ does for {{company}}\n- Your client works through their goals, situation and risk privately first, then chooses what to share with you.\n- You get a clear brief before the first meeting, so less time rebuilding the file by hand.\n- Each step is recorded as it happens, which gives you a clean record for suitability and anti-money-laundering reviews.\n\nWhat a design partnership involves\n- One redacted client journey reviewed together, about an hour.\n- A short pilot on a small number of real files, with your team setting the measures.\n- No change to the systems you already use.\n\nCould we find 30 minutes next week to map one client journey together?\n\nWith Gratitude,\nChad R Johnston\nFounder & CEO\n4orm Finance\n778-363-2423', follow: 3, task: 'Follow up on pilot outline with {{name}}' },
    { name: 'Regulator: material requested', subject: '4orm Finance: background for your review', body: 'Hello {{first_name}},\n\nThank you for your time. As requested, here is background on 4ormIQ, with our research linked below.\n\nIn brief\n- 4ormIQ helps consumers understand their own financial situation before they receive a recommendation.\n- The consumer decides what to share with the professional. Nothing is shared without their consent.\n- The process creates a time-stamped record of what the consumer understood and agreed to, which can support suitability and anti-money-laundering obligations.\n\nWe would welcome your view on how this fits current guidance, and we are glad to answer questions or walk through it at a time that suits you.\n\nWith Gratitude,\nChad R Johnston\nFounder & CEO\n4orm Finance\n778-363-2423', follow: 7, task: 'Check in with {{name}} on regulator material' },
    { name: 'Blank', subject: '', body: 'Hi {{first_name}},\n\n\n\nWith Gratitude,\nChad R Johnston\nFounder & CEO\n4orm Finance\n778-363-2423', follow: 0, task: '' }
  ];

  var S = { data: null, pipe: '', stage: '', draft: null, undo: null, only: false };
  var box = null;
  function el(sel) { return box.querySelector(sel); }
  function toast(msg, undo) {
    var t = el('.toast');
    t.innerHTML = '<span>' + esc(msg) + '</span>' + (undo ? '<button type="button" data-undo>Undo</button>' : '');
    t.classList.add('on');
    if (undo) t.querySelector('[data-undo]').onclick = function () { t.classList.remove('on'); undo(); };
    clearTimeout(toast.t); toast.t = setTimeout(function () { t.classList.remove('on'); }, 7000);
  }
  function pkgFor(stageId) { return ((S.data && S.data.packages) || []).filter(function (p) { return p.stageId === stageId; })[0] || null; }
  function curPipe() { return ((S.data && S.data.pipelines) || []).filter(function (p) { return p.id === S.pipe; })[0] || null; }

  function build() {
    box = document.createElement('div'); box.className = 'pbx';
    box.innerHTML = '<div class="x-top"><h1>Stage emails</h1><span class="x-sub">Each GoHighLevel stage can send its own package. Move a contact onto that stage and you confirm before it goes out.</span><span class="x-sp"></span>'
      + '<button type="button" data-go="sprint">15-min sprint</button><button type="button" data-go="pipeline">Pipeline</button><button type="button" data-close>Close</button></div>'
      + '<div class="x-pipes"></div><div class="x-body"><div class="x-map"></div><div class="x-ed"></div></div><div class="toast"></div>';
    document.body.appendChild(box);
    box.querySelector('[data-close]').onclick = close;
    box.querySelectorAll('[data-go]').forEach(function (b) { b.onclick = function () { close(); jump(b.getAttribute('data-go')); }; });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && box.classList.contains('open') && !document.querySelector('.sgx')) close(); });
  }
  function close() {
    box.classList.remove('open');
    try { var u = new URL(location.href); if (u.searchParams.get('builder')) { u.searchParams.delete('builder'); history.replaceState({}, '', u.pathname + u.search); } } catch (e) {}
  }

  function load() {
    el('.x-map').innerHTML = '<div class="empty">Loading pipelines from GoHighLevel…</div>';
    return api('/api/processes').then(function (d) {
      S.data = d;
      if (!S.pipe || !curPipe()) S.pipe = (d.pipelines[0] && d.pipelines[0].id) || '';
      paint();
    }).catch(function (e) { el('.x-map').innerHTML = '<div class="empty">' + esc(e.message) + '</div>'; });
  }

  var EXIT = /not now|not interested|parked|cancel|no response|not a fit|nurture|next round|3rd (reach|attempt)/i;
  function narrow() { return window.innerWidth <= 1100; }
  function paint() {
    var d = S.data || { pipelines: [], packages: [], stats: {} };
    var ed = el('.x-ed'), body = el('.x-body');
    if (ed.parentNode !== body) body.appendChild(ed);
    var counts = {};
    (d.packages || []).forEach(function (p) { counts[p.pipelineId] = (counts[p.pipelineId] || 0) + 1; });
    el('.x-pipes').innerHTML = d.pipelines.length ? d.pipelines.map(function (p) {
      return '<button type="button" class="pl' + (p.id === S.pipe ? ' on' : '') + '" data-pipe="' + esc(p.id) + '"><span>' + esc(p.name) + '</span><small>' + (counts[p.id] || 0) + ' of ' + p.stages.length + '</small></button>';
    }).join('') : '<div class="empty">' + (d.connected ? 'No pipelines in GoHighLevel yet.' : 'GoHighLevel is not connected.') + '</div>';
    el('.x-pipes').querySelectorAll('[data-pipe]').forEach(function (b) { b.onclick = function () { S.pipe = b.getAttribute('data-pipe'); S.stage = ''; S.draft = null; paint(); }; });
    var pipe = curPipe();
    if (!pipe) { el('.x-map').innerHTML = ''; paintEditor(); return; }
    var main = [], exits = [];
    pipe.stages.forEach(function (s, i) { (EXIT.test(s.name) ? exits : main).push({ s: s, i: i }); });
    var withEmail = pipe.stages.filter(function (s) { return pkgFor(s.id); }).length;
    function row(x, k, list, ex) {
      var s = x.s, p = pkgFor(s.id), m = (d.stats || {})[s.id];
      if (S.only && !p && s.id !== S.stage) return '';
      var cls = p ? (p.active ? 'has' : 'off') : 'none';
      var pos = list.length === 1 ? ' solo' : k === 0 ? ' first' : k === list.length - 1 ? ' last' : '';
      var em;
      if (p) {
        var first = String(p.body || '').split('\n').map(function (l) { return l.trim(); }).filter(function (l) { return l && !/^(hi|hello|dear)\b/i.test(l); })[0] || '';
        var tags = [];
        (p.docs || []).forEach(function (dc) { if (dc && dc.name) tags.push(dc.name); });
        if (p.spaceId) tags.push('Space documents');
        if (p.followDays) tags.push('Follow up in ' + p.followDays + (p.followDays === 1 ? ' day' : ' days'));
        if (p.task) tags.push('Task');
        if (m && m.sent) tags.push('Sent ' + m.sent + (m.sent30 ? ', ' + m.sent30 + ' this month' : ''));
        em = '<span class="sj"><small>' + (p.active ? 'Sends' : 'Paused') + '</small>' + esc(p.subject || 'No subject yet') + '</span>'
          + (first ? '<span class="pv">' + esc(first) + '</span>' : '')
          + (tags.length ? '<span class="tg">' + tags.map(function (t) { return '<i>' + esc(t) + '</i>'; }).join('') + '</span>' : '');
      } else em = 'No email. Click to write one.';
      return '<button type="button" class="r ' + cls + pos + (ex ? ' ex' : '') + (s.id === S.stage ? ' on' : '') + '" data-st="' + esc(s.id) + '">'
        + '<span class="sp"><span class="dot">' + (x.i + 1) + '</span></span>'
        + '<span class="sb"><b>' + esc(s.name) + '</b><span' + (s.count ? ' class="live"' : '') + '>' + (s.count ? s.count + ' here now' : 'Empty') + '</span></span>'
        + '<span class="ln"></span><span class="em">' + em + '</span></button>';
    }
    el('.x-map').innerHTML = '<div class="sum"><h2>' + esc(pipe.name) + '</h2><span class="chip">' + pipe.stages.length + ' stages</span><span class="chip">' + pipe.total + ' open</span><span class="chip g">' + withEmail + ' send an email</span>'
      + '<label class="only"><input type="checkbox" id="pbOnly"' + (S.only ? ' checked' : '') + '>Only stages with an email</label></div>'
      + '<div class="heads"><span></span><span>Stage</span><span></span><span>Email that goes out when you move someone here</span></div>'
      + '<div class="grp" style="margin-top:4px">The path</div>' + main.map(function (x, k) { return row(x, k, main, false); }).join('')
      + (exits.length ? '<div class="grp">Off the path</div>' + exits.map(function (x, k) { return row(x, k, exits, true); }).join('') : '');
    el('#pbOnly').onchange = function () { S.only = this.checked; paint(); };
    el('.x-map').querySelectorAll('[data-st]').forEach(function (b) {
      b.onclick = function () {
        var id = b.getAttribute('data-st');
        if (S.stage === id && narrow()) { S.stage = ''; S.draft = null; paint(); return; }
        S.stage = id; S.draft = null; paint();
      };
    });
    if (narrow() && S.stage) { var on = el('.x-map .r.on'); if (on) on.after(ed); }
    paintEditor();
  }

  function paintEditor() {
    var ed = el('.x-ed'), pipe = curPipe();
    var stg = pipe && pipe.stages.filter(function (x) { return x.id === S.stage; })[0];
    if (!stg) {
      ed.innerHTML = '<div class="k">Package</div><div class="empty">Pick a stage on the map to build what it sends.</div>'
        + '<div class="k">How it works</div><div class="hint" style="color:#c8d1ea">1. Click a stage and write the email. Use {{first_name}}, {{company}} and {{name}}; they fill in per contact.<br>2. Add document links, or attach a Space so its documents go too.<br>3. Set a follow-up and a GoHighLevel task if you want one.<br>4. On Lists or any contact card, move someone with Stages. If that stage has a package, you see exactly what goes out and confirm.</div>';
      return;
    }
    var p = pkgFor(stg.id);
    var dr = S.draft || (S.draft = p ? JSON.parse(JSON.stringify(p)) : { subject: '', body: '', docs: [], spaceId: '', followDays: 0, task: '', active: true, fresh: true });
    var spaces = (S.data && S.data.spaces) || [];
    ed.innerHTML = '<div class="k">' + esc(pipe.name) + ' · stage</div><div style="font-size:18px;font-weight:850">' + esc(stg.name) + '</div>'
      + (dr.fresh ? '<label>Start from</label><div class="starters">' + STARTERS.map(function (s, i) { return '<button type="button" data-start="' + i + '">' + esc(s.name) + '</button>'; }).join('') + '</div>' : '')
      + '<label for="pbSub">Subject</label><input id="pbSub" value="' + esc(dr.subject) + '" maxlength="200">'
      + '<label for="pbBody">Email</label><textarea id="pbBody">' + esc(dr.body) + '</textarea><div class="hint">{{first_name}}, {{company}} and {{name}} fill in per contact. Document links are added under the email.</div>'
      + '<label for="pbDesign">Design</label><select id="pbDesign">' + (((S.data && S.data.designs) || [{ id: '', name: 'Plain email' }]).map(function (d) { return '<option value="' + esc(d.id) + '"' + (d.id === (dr.design || '') ? ' selected' : '') + '>' + esc(d.name) + '</option>'; }).join('')) + '</select><div class="hint">An info pack puts your note on top and a one-minute brief with the numbers underneath, ready to forward. PDF links also go as attachments.</div>'
      + '<label>Documents</label><div id="pbDocs">' + (dr.docs || []).map(function (d, i) {
        return '<div class="doc"><input data-dn="' + i + '" value="' + esc(d.name) + '" placeholder="Name"><input data-du="' + i + '" value="' + esc(d.url) + '" placeholder="https://drive.google.com/..."><button type="button" class="fit warn" data-dx="' + i + '">Remove</button></div>';
      }).join('') + '</div><button type="button" data-adddoc>Add a document link</button>'
      + '<label for="pbSpace">Also send a Space\'s documents</label><select id="pbSpace"><option value="">None</option>' + spaces.map(function (s) { return '<option value="' + esc(s.id) + '"' + (s.id === dr.spaceId ? ' selected' : '') + '>' + esc(s.name) + ' (' + s.docs + ')</option>'; }).join('') + '</select>'
      + '<div class="row"><div><label for="pbFu">Follow up after (days)</label><input id="pbFu" type="number" min="0" max="90" value="' + (dr.followDays || 0) + '"></div><div><label for="pbTask">GoHighLevel task</label><input id="pbTask" value="' + esc(dr.task) + '" placeholder="Optional"></div></div>'
      + '<div class="tog"><input type="checkbox" id="pbOn"' + (dr.active ? ' checked' : '') + '><label for="pbOn" style="margin:0;text-transform:none;letter-spacing:0;font-size:12.5px;color:#c8d1ea">Send when a contact lands here (you always confirm first)</label></div>'
      + '<div class="acts"><button type="button" class="pri" data-save>Save package</button>' + (p ? '<button type="button" data-view>Preview saved email</button><button type="button" data-test>Send me a test</button><button type="button" class="warn" data-rm>Remove package</button>' : '') + '</div>'
      + '<div class="k" style="margin-top:20px">Sent from this stage</div><div class="log" id="pbLog"><span class="hint">Loading…</span></div>';
    function grab() {
      dr.subject = el('#pbSub').value; dr.body = el('#pbBody').value; dr.spaceId = el('#pbSpace').value; dr.design = el('#pbDesign').value;
      dr.followDays = Number(el('#pbFu').value) || 0; dr.task = el('#pbTask').value; dr.active = el('#pbOn').checked;
      ed.querySelectorAll('[data-dn]').forEach(function (x) { dr.docs[+x.getAttribute('data-dn')].name = x.value; });
      ed.querySelectorAll('[data-du]').forEach(function (x) { dr.docs[+x.getAttribute('data-du')].url = x.value; });
    }
    ed.querySelectorAll('[data-start]').forEach(function (b) {
      b.onclick = function () { var s = STARTERS[+b.getAttribute('data-start')]; grab(); dr.subject = s.subject; dr.body = s.body; dr.followDays = s.follow; dr.task = s.task; paintEditor(); };
    });
    ed.querySelector('[data-adddoc]').onclick = function () { grab(); dr.docs = dr.docs || []; dr.docs.push({ name: '', url: '' }); paintEditor(); };
    ed.querySelectorAll('[data-dx]').forEach(function (b) { b.onclick = function () { grab(); dr.docs.splice(+b.getAttribute('data-dx'), 1); paintEditor(); }; });
    ed.querySelector('[data-save]').onclick = function () {
      grab();
      var bad = (dr.docs || []).filter(function (d) { return (d.name || d.url) && !(d.name && /^https:\/\//i.test(d.url)); });
      if (bad.length) { toast('Each document needs a name and a link starting with https://'); return; }
      var b = this; b.disabled = true; b.textContent = 'Saving…';
      api('/api/processes', 'POST', { action: 'save', pipelineId: pipe.id, pipelineName: pipe.name, stageId: stg.id, stageName: stg.name, subject: dr.subject, body: dr.body, docs: dr.docs, spaceId: dr.spaceId, followDays: dr.followDays, task: dr.task, active: dr.active, design: dr.design || '' })
        .then(function (j) {
          S.data.packages = S.data.packages.filter(function (x) { return x.stageId !== stg.id; }).concat([j.package]);
          S.draft = null; paint(); toast('Saved: ' + stg.name);
        }).catch(function (e) { b.disabled = false; b.textContent = 'Save package'; toast(e.message); });
    };
    var vb = ed.querySelector('[data-view]');
    if (vb) vb.onclick = function () { window.open('/api/processes?render=1&stage=' + encodeURIComponent(stg.id), '_blank', 'noopener'); };
    var tb = ed.querySelector('[data-test]');
    if (tb) tb.onclick = function () {
      var to = (S.data && S.data.testTo) || 'your inbox';
      tb.disabled = true; tb.textContent = 'Sending test…';
      api('/api/processes', 'POST', { action: 'test', stageId: stg.id }).then(function (j) { toast('Test sent to ' + j.to); loadLog(); })
        .catch(function (e) { toast(e.message); }).then(function () { tb.disabled = false; tb.textContent = 'Send me a test'; });
    };
    var rb = ed.querySelector('[data-rm]');
    if (rb) rb.onclick = function () {
      api('/api/processes', 'POST', { action: 'remove', stageId: stg.id }).then(function () {
        var gone = p;
        S.data.packages = S.data.packages.filter(function (x) { return x.stageId !== stg.id; }); S.draft = null; paint();
        toast('Package removed from ' + stg.name, function () {
          api('/api/processes', 'POST', { action: 'restore', stageId: stg.id }).then(function () { S.data.packages.push(gone); S.draft = null; paint(); });
        });
      }).catch(function (e) { toast(e.message); });
    };
    function loadLog() {
      api('/api/processes?sends=1&stage=' + encodeURIComponent(stg.id)).then(function (j) {
        var L = el('#pbLog'); if (!L) return;
        L.innerHTML = (j.sends || []).length ? j.sends.map(function (r) {
          return '<div><b>' + esc(r.contact_name || r.email) + '</b> · ' + esc(r.status) + (r.test ? ' (test)' : '') + '<small>' + esc(hhmm(r.at)) + ' · ' + esc(r.email) + (r.note ? ' · ' + esc(r.note) : '') + '</small></div>';
        }).join('') : '<span class="hint">Nothing sent from this stage yet.</span>';
      }).catch(function () {});
    }
    loadLog();
  }

  window.openProcessBuilder = function () {
    if (!box) build();
    box.classList.add('open');
    load();
  };

  /* Confirm before a stage package goes out. Resolves { send: true|false } to move, or null to cancel. */
  window.stageGate = function (recordId, stage, gopts) {
    var only = !!(gopts && gopts.sendOnly);
    return api('/api/processes?preview=1&record=' + encodeURIComponent(recordId) + '&stage=' + encodeURIComponent(stage.id))
      .then(function (j) { return j.preview; }).catch(function () { return null; })
      .then(function (pv) {
        if (!pv) return only ? null : { send: false };
        return new Promise(function (resolve) {
          var m = document.createElement('div'); m.className = 'sgx';
          m.innerHTML = '<div class="bx"><div class="hd"><h3>' + (only ? 'Send the ' + esc(stage.name) + ' package' : 'Move to ' + esc(stage.name)) + '</h3><div class="sub">' + (only ? 'Here is exactly what goes out.' : 'This stage has a package. Here is exactly what goes out.') + '</div></div><div class="bd">'
            + '<div class="k">To</div><div>' + esc(pv.toName) + (pv.to ? ' &lt;' + esc(pv.to) + '&gt;' : '') + '</div>'
            + '<div class="k">Subject</div><div><b>' + esc(pv.subject) + '</b></div>'
            + '<div class="k">Email</div><pre>' + esc(pv.body) + '</pre>'
            + (pv.docs.length ? '<div class="k">Documents</div><ul>' + pv.docs.map(function (d) { return '<li>' + esc(d.name) + '</li>'; }).join('') + '</ul>' : '')
            + ((pv.followDays || pv.task) ? '<div class="k">Then</div><div>' + (pv.followDays ? 'Follow up in ' + pv.followDays + ' days. ' : '') + (pv.task ? 'GoHighLevel task: ' + esc(pv.task) : '') + '</div>' : '')
            + (pv.ready ? '' : '<div class="why">Cannot send: ' + esc(pv.why) + (only ? '.' : '. You can still move the stage.') + '</div>')
            + '</div><div class="ft"><button type="button" data-c>Cancel</button>' + (pv.to ? '<button type="button" data-e>' + (only ? 'Edit in email' : 'Move, then edit in email') + '</button>' : '') + (only ? (pv.ready ? '<button type="button" class="pri" data-s>Send</button>' : '') : '<button type="button" data-o>Move only</button>' + (pv.ready ? '<button type="button" class="pri" data-s>Move and send</button>' : '')) + '</div></div>';
          document.body.appendChild(m);
          function done(v) { m.remove(); resolve(v); }
          m.querySelector('[data-c]').onclick = function () { done(null); };
          var ob = m.querySelector('[data-o]'); if (ob) ob.onclick = function () { done({ send: false }); };
          var sb = m.querySelector('[data-s]'); if (sb) sb.onclick = function () { done({ send: true }); };
          /* Edit before it goes: opens Email with the stage email filled in and its documents attached. Send from there. */
          var eb = m.querySelector('[data-e]'); if (eb) eb.onclick = function () {
            done(only ? null : { send: false });
            if (typeof window.openComposeDraft === 'function') {
              if (typeof window.switchView === 'function') window.switchView('mail');
              window.openComposeDraft({ to: [{ email: pv.to, name: pv.toName || '' }], subject: pv.subject, body: pv.body, attachments: (pv.docs || []).filter(function (d) { return d && d.url; }).map(function (d) { return { name: d.name, url: d.url }; }) });
            }
          };
          m.onclick = function (e) { if (e.target === m) done(null); };
        });
      });
  };

  /* Sprint <-> Pipeline <-> builder. */
  function jump(where) {
    if (where === 'pipeline') {
      if (typeof window.switchView === 'function') window.switchView('contacts');
      try { history.replaceState({}, '', '/pipeline'); } catch (e) {}
    } else if (where === 'sprint') {
      ['focusday', 'compact', 'lanes', 'blocks'].forEach(function (m) { document.body.classList.remove(m); });
      document.body.classList.add('sprint');
      if (typeof window.switchView === 'function') window.switchView('playbook');
      try { history.replaceState({}, '', '/playbook'); } catch (e) {}
      setTimeout(function () {
        var hosts = document.querySelectorAll('*');
        for (var i = 0; i < hosts.length; i++) {
          var sr = hosts[i].shadowRoot; if (!sr) continue;
          var b = sr.querySelector('#ctr button[data-m="sprint"]');
          if (b && !b.classList.contains('on')) { b.click(); break; }
        }
      }, 400);
    } else if (where === 'builder') window.openProcessBuilder();
  }
  window.jumpTo = jump;
  document.addEventListener('click', function (e) {
    var p = e.composedPath ? e.composedPath() : [];
    for (var i = 0; i < p.length; i++) {
      var id = p[i] && p[i].id;
      if (id === 'pipeGoBtn') { jump('pipeline'); return; }
      if (id === 'sprintGoBtn') { jump('sprint'); return; }
      if (id === 'procGoBtn') { jump('builder'); return; }
    }
  });
  try { if (new URLSearchParams(location.search).get('builder')) setTimeout(window.openProcessBuilder, 600); } catch (e) {}
})();
