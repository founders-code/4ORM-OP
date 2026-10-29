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
    + '.pbx h1{font-size:22px;font-weight:850;margin:0}.pbx .x-sub{color:#aeb6c8}.pbx .x-sp{flex:1}'
    + '.pbx button{font:inherit;font-size:12px;font-weight:800;padding:8px 12px;border-radius:9px;border:1px solid #2a2c35;background:#18191f;color:#fff;cursor:pointer}'
    + '.pbx button:hover{border-color:#4272f9}.pbx button.pri{background:#00dc86;border-color:#00dc86;color:#03170d}.pbx button.warn{color:#ff8a9c}'
    + '.pbx button[disabled]{opacity:.5;cursor:default}'
    + '.pbx .x-body{flex:1;display:grid;grid-template-columns:250px minmax(0,1fr) 440px;min-height:0}'
    + '.pbx .x-left{border-right:1px solid #1d1f26;padding:16px;overflow:auto}.pbx .x-map{padding:18px 22px;overflow:auto}.pbx .x-ed{border-left:1px solid #1d1f26;padding:16px 18px;overflow:auto;background:#0d0e12}'
    + '.pbx .k{font-size:10.5px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#7d859a;margin:4px 0 8px}'
    + '.pbx .pl{display:flex;justify-content:space-between;align-items:center;width:100%;text-align:left;margin-bottom:6px;background:#111216}'
    + '.pbx .pl.on{background:#20222a;border-color:#4272f9}.pbx .pl small{color:#7d859a;font-weight:700}'
    + '.pbx .flow{display:flex;flex-wrap:wrap;gap:26px 30px;align-items:stretch}'
    + '.pbx .st{position:relative;width:200px;min-height:132px;background:#111216;border:1px solid #2a2c35;border-radius:12px;padding:11px 12px;cursor:pointer;text-align:left;display:flex;flex-direction:column;gap:4px}'
    + '.pbx .st:hover{border-color:#4272f9}.pbx .st.on{border-color:#4272f9;box-shadow:0 0 0 2px rgba(66,114,249,.35)}'
    + '.pbx .st:not(:last-child)::after{content:"";position:absolute;right:-31px;top:50%;width:30px;height:2px;background:#2a2c35}'
    + '.pbx .st .n{font-size:10px;font-weight:800;letter-spacing:.1em;color:#7d859a}.pbx .st b{font-size:13.5px}'
    + '.pbx .st .cnt{color:#aeb6c8;font-size:11.5px}'
    + '.pbx .st .pk{margin-top:auto;border-radius:8px;padding:6px 8px;font-size:11.5px;font-weight:700}'
    + '.pbx .st .pk.has{background:rgba(0,220,134,.12);color:#5ff0b4}.pbx .st .pk.off{background:rgba(255,169,70,.12);color:#ffc98a}.pbx .st .pk.none{border:1px dashed #2f323c;color:#7d859a}'
    + '.pbx .st .ms{font-size:11px;color:#7d859a}'
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
    + '@media(max-width:1100px){.pbx .x-body{grid-template-columns:1fr}.pbx .x-left,.pbx .x-ed{border:0}}'
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

  var S = { data: null, pipe: '', stage: '', draft: null, undo: null };
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
    box.innerHTML = '<div class="x-top"><h1>Process builder</h1><span class="x-sub">Each GoHighLevel stage can send its own package. Move a contact onto that stage and you confirm before it goes out.</span><span class="x-sp"></span>'
      + '<button type="button" data-go="sprint">15-min sprint</button><button type="button" data-go="pipeline">Pipeline</button><button type="button" data-close>Close</button></div>'
      + '<div class="x-body"><div class="x-left"></div><div class="x-map"></div><div class="x-ed"></div></div><div class="toast"></div>';
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

  function paint() {
    var d = S.data || { pipelines: [], packages: [], stats: {} };
    var counts = {};
    (d.packages || []).forEach(function (p) { counts[p.pipelineId] = (counts[p.pipelineId] || 0) + 1; });
    el('.x-left').innerHTML = '<div class="k">Pipelines</div>' + (d.pipelines.length ? d.pipelines.map(function (p) {
      return '<button type="button" class="pl' + (p.id === S.pipe ? ' on' : '') + '" data-pipe="' + esc(p.id) + '"><span>' + esc(p.name) + '</span><small>' + (counts[p.id] || 0) + ' / ' + p.stages.length + '</small></button>';
    }).join('') : '<div class="empty">' + (d.connected ? 'No pipelines in GoHighLevel yet.' : 'GoHighLevel is not connected.') + '</div>')
      + '<div class="hint">The number is stages with a package, out of all stages.</div>';
    el('.x-left').querySelectorAll('[data-pipe]').forEach(function (b) { b.onclick = function () { S.pipe = b.getAttribute('data-pipe'); S.stage = ''; S.draft = null; paint(); }; });
    var pipe = curPipe();
    if (!pipe) { el('.x-map').innerHTML = ''; paintEditor(); return; }
    el('.x-map').innerHTML = '<div class="k">' + esc(pipe.name) + ' · ' + pipe.stages.length + ' stages · ' + pipe.total + ' open</div><div class="flow">' + pipe.stages.map(function (s, i) {
      var p = pkgFor(s.id), m = (d.stats || {})[s.id];
      var pk = p ? '<div class="pk ' + (p.active ? 'has' : 'off') + '">' + (p.active ? 'Sends: ' : 'Paused: ') + esc(p.subject || 'no subject yet') + '</div>' : '<div class="pk none">No package. Click to build one.</div>';
      return '<button type="button" class="st' + (s.id === S.stage ? ' on' : '') + '" data-st="' + esc(s.id) + '"><span class="n">STAGE ' + (i + 1) + '</span><b>' + esc(s.name) + '</b><span class="cnt">' + s.count + ' here now</span>'
        + (m ? '<span class="ms">Sent ' + m.sent30 + ' in 30 days · ' + m.sent + ' all time' + (m.failed ? ' · ' + m.failed + ' did not go' : '') + '</span>' : '') + pk + '</button>';
    }).join('') + '</div>';
    el('.x-map').querySelectorAll('[data-st]').forEach(function (b) { b.onclick = function () { S.stage = b.getAttribute('data-st'); S.draft = null; paint(); }; });
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
      + '<label>Documents</label><div id="pbDocs">' + (dr.docs || []).map(function (d, i) {
        return '<div class="doc"><input data-dn="' + i + '" value="' + esc(d.name) + '" placeholder="Name"><input data-du="' + i + '" value="' + esc(d.url) + '" placeholder="https://drive.google.com/..."><button type="button" class="fit warn" data-dx="' + i + '">Remove</button></div>';
      }).join('') + '</div><button type="button" data-adddoc>Add a document link</button>'
      + '<label for="pbSpace">Also send a Space\'s documents</label><select id="pbSpace"><option value="">None</option>' + spaces.map(function (s) { return '<option value="' + esc(s.id) + '"' + (s.id === dr.spaceId ? ' selected' : '') + '>' + esc(s.name) + ' (' + s.docs + ')</option>'; }).join('') + '</select>'
      + '<div class="row"><div><label for="pbFu">Follow up after (days)</label><input id="pbFu" type="number" min="0" max="90" value="' + (dr.followDays || 0) + '"></div><div><label for="pbTask">GoHighLevel task</label><input id="pbTask" value="' + esc(dr.task) + '" placeholder="Optional"></div></div>'
      + '<div class="tog"><input type="checkbox" id="pbOn"' + (dr.active ? ' checked' : '') + '><label for="pbOn" style="margin:0;text-transform:none;letter-spacing:0;font-size:12.5px;color:#c8d1ea">Send when a contact lands here (you always confirm first)</label></div>'
      + '<div class="acts"><button type="button" class="pri" data-save>Save package</button>' + (p ? '<button type="button" data-test>Send me a test</button><button type="button" class="warn" data-rm>Remove package</button>' : '') + '</div>'
      + '<div class="k" style="margin-top:20px">Sent from this stage</div><div class="log" id="pbLog"><span class="hint">Loading…</span></div>';
    function grab() {
      dr.subject = el('#pbSub').value; dr.body = el('#pbBody').value; dr.spaceId = el('#pbSpace').value;
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
      api('/api/processes', 'POST', { action: 'save', pipelineId: pipe.id, pipelineName: pipe.name, stageId: stg.id, stageName: stg.name, subject: dr.subject, body: dr.body, docs: dr.docs, spaceId: dr.spaceId, followDays: dr.followDays, task: dr.task, active: dr.active })
        .then(function (j) {
          S.data.packages = S.data.packages.filter(function (x) { return x.stageId !== stg.id; }).concat([j.package]);
          S.draft = null; paint(); toast('Saved: ' + stg.name);
        }).catch(function (e) { b.disabled = false; b.textContent = 'Save package'; toast(e.message); });
    };
    var tb = ed.querySelector('[data-test]');
    if (tb) tb.onclick = function () {
      var to = (S.data && S.data.testTo) || 'your inbox';
      if (!window.confirm('Send a test of the saved package to ' + to + ' only?')) return;
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
  window.stageGate = function (recordId, stage) {
    return api('/api/processes?preview=1&record=' + encodeURIComponent(recordId) + '&stage=' + encodeURIComponent(stage.id))
      .then(function (j) { return j.preview; }).catch(function () { return null; })
      .then(function (pv) {
        if (!pv) return { send: false };
        return new Promise(function (resolve) {
          var m = document.createElement('div'); m.className = 'sgx';
          m.innerHTML = '<div class="bx"><div class="hd"><h3>Move to ' + esc(stage.name) + '</h3><div class="sub">This stage has a package. Here is exactly what goes out.</div></div><div class="bd">'
            + '<div class="k">To</div><div>' + esc(pv.toName) + (pv.to ? ' &lt;' + esc(pv.to) + '&gt;' : '') + '</div>'
            + '<div class="k">Subject</div><div><b>' + esc(pv.subject) + '</b></div>'
            + '<div class="k">Email</div><pre>' + esc(pv.body) + '</pre>'
            + (pv.docs.length ? '<div class="k">Documents</div><ul>' + pv.docs.map(function (d) { return '<li>' + esc(d.name) + '</li>'; }).join('') + '</ul>' : '')
            + ((pv.followDays || pv.task) ? '<div class="k">Then</div><div>' + (pv.followDays ? 'Follow up in ' + pv.followDays + ' days. ' : '') + (pv.task ? 'GoHighLevel task: ' + esc(pv.task) : '') + '</div>' : '')
            + (pv.ready ? '' : '<div class="why">Cannot send: ' + esc(pv.why) + '. You can still move the stage.</div>')
            + '</div><div class="ft"><button type="button" data-c>Cancel</button><button type="button" data-o>Move only</button>' + (pv.ready ? '<button type="button" class="pri" data-s>Move and send</button>' : '') + '</div></div>';
          document.body.appendChild(m);
          function done(v) { m.remove(); resolve(v); }
          m.querySelector('[data-c]').onclick = function () { done(null); };
          m.querySelector('[data-o]').onclick = function () { done({ send: false }); };
          var sb = m.querySelector('[data-s]'); if (sb) sb.onclick = function () { done({ send: true }); };
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
