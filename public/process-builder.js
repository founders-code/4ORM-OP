/* Process builder, 29 Oct 2026.
   Every GoHighLevel pipeline, stage by stage. Click a stage to build its package (email, documents, follow-up, task).
   When a contact is moved onto a stage that has a package, window.stageGate shows exactly what goes out and asks first.
   Also: jump buttons between the 15-minute sprint and the Pipeline. */
(function () {
  if ((window.__pbVer || 0) >= 9) return;
  window.__pbVer = 9;
  (function () { var o = document.querySelector('.pbx'); if (o) o.remove(); })();
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
    + '.pbx{position:fixed;inset:0;z-index:2147481500;background:#f3f5f9;color:#101a33;font:500 13px/1.45 Inter,-apple-system,system-ui,sans-serif;display:none;flex-direction:column}'
    + '.pbx.open{display:flex}'
    + '.pbx .x-top{display:flex;align-items:flex-end;gap:14px;padding:18px 24px 10px}'
    + '.pbx h1{font-size:28px;font-weight:850;margin:0;color:#101a33!important;white-space:nowrap;letter-spacing:-.01em}.pbx .x-sub{color:#5b6678;font-size:13px;margin-top:4px}.pbx .x-sp{flex:1}'
    + '.pbx button{font:inherit;font-size:13px;font-weight:700;padding:9px 14px;border-radius:10px;border:1px solid #d9dfea;background:#fff;color:#101a33;cursor:pointer;white-space:nowrap}'
    + '.pbx button:hover{border-color:#2e6bf2}.pbx button.pri{background:#2e6bf2;border-color:#2e6bf2;color:#fff}.pbx button.warn{color:#c8283f}'
    + '.pbx button[disabled]{opacity:.5;cursor:default}'
    + '.pbx .x-pipes{display:flex;gap:6px;flex-wrap:wrap;padding:4px 24px 14px}'
    + '.pbx .pl{display:inline-flex;gap:8px;align-items:center;border-radius:999px;padding:6px 12px;font-size:12px}'
    + '.pbx .pl.on{background:#101a33;border-color:#101a33;color:#fff}.pbx .pl small{color:#7a86a0;font-weight:700}.pbx .pl.on small{color:#c8d1ea}'
    + '.pbx .x-body{flex:1;display:grid;grid-template-columns:260px minmax(0,1fr);gap:20px;padding:0 24px 20px;min-height:0}'
    + '.pbx .x-lib{background:#fff;border-radius:16px;padding:18px 16px;overflow:auto}'
    + '.pbx .x-lib h3{margin:0;font-size:16px;font-weight:800;color:#101a33!important}.pbx .x-lib p{color:#5b6678;font-size:12.5px;margin:6px 0 4px}'
    + '.pbx .lk{font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#5b6678;margin:18px 0 8px}'
    + '.pbx .li{display:flex;align-items:center;gap:10px;width:100%;text-align:left;margin-bottom:8px;padding:11px 12px;border-radius:10px;font-weight:700;cursor:grab}'
    + '.pbx .li i{width:10px;height:10px;border-radius:3px;flex:0 0 10px}.pbx .li span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis}.pbx .li small{color:#7a86a0;font-weight:600;font-size:11.5px}'
    + '.pbx .li.arm{border-color:#2e6bf2;box-shadow:0 0 0 3px rgba(46,107,242,.18)}'
    + '.pbx .c-stage{background:#2e6bf2}.pbx .c-email{background:#7c4dff}.pbx .c-doc{background:#0f8a6a}.pbx .c-wait{background:#5b6678}.pbx .c-task{background:#b5651d}.pbx .c-book{background:#0a95b5}'
    + '.pbx .x-can{background:#fff;border-radius:16px;display:flex;flex-direction:column;min-width:0;min-height:0;overflow:hidden}'
    + '.pbx .cv-bar{display:flex;align-items:center;gap:16px;flex-wrap:wrap;padding:14px 18px 8px}'
    + '.pbx .lg{display:flex;align-items:center;gap:6px;font-weight:700;font-size:12.5px}.pbx .lg i{width:10px;height:10px;border-radius:3px}'
    + '.pbx .hintb{margin-left:auto;color:#2e6bf2;font-weight:700;font-size:12.5px}'
    + '.pbx .zm{display:flex;align-items:center;gap:4px}.pbx .zm button{padding:5px 10px;font-size:12px}.pbx .zm b{min-width:44px;text-align:center;font-size:12px;color:#5b6678}'
    + '.pbx .cv{flex:1;overflow:auto;position:relative;cursor:default}.pbx .cv.pan{cursor:grabbing}'
    + '.pbx .gw{position:relative}.pbx .grid{position:absolute;left:0;top:0;transform-origin:0 0;background-image:radial-gradient(#cfd6e4 1.1px,transparent 1.2px);background-size:18px 18px}'
    + '.pbx .grid svg{position:absolute;left:0;top:0;pointer-events:none;overflow:visible}'
    + '.pbx .ph{position:absolute;font:800 11.5px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.1em;text-transform:uppercase;color:#2e6bf2;white-space:nowrap}.pbx .ph.ex{color:#7a86a0}'
    + '.pbx .b{position:absolute;width:158px;height:92px;background:#fff;border:1px solid #d9dfea;border-radius:12px;padding:10px 11px;display:flex;flex-direction:column;gap:3px;text-align:left;cursor:pointer;box-shadow:0 1px 2px rgba(16,26,51,.04)}'
    + '.pbx .b:hover{border-color:#2e6bf2}'
    + '.pbx .b .kk{font:800 10px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase}'
    + '.pbx .b.stage .kk{color:#2e6bf2}.pbx .b.email .kk{color:#7c4dff}.pbx .b.dc .kk{color:#0f8a6a}.pbx .b.wait .kk{color:#5b6678}.pbx .b.task .kk{color:#b5651d}.pbx .b.book .kk{color:#0a95b5}'
    + '.pbx .b .tt{font-size:12.5px;font-weight:800;line-height:1.25;color:#101a33;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}'
    + '.pbx .b .cp{margin-top:auto;display:flex;gap:4px;flex-wrap:wrap}.pbx .b .cp em{font:700 10px/1 ui-monospace,SFMono-Regular,Menlo,monospace;font-style:normal;background:#eef2f9;color:#344055;border-radius:4px;padding:3px 5px;white-space:nowrap;max-width:132px;overflow:hidden;text-overflow:ellipsis}'
    + '.pbx .b .cp em.live{background:#e6eeff;color:#1f4fc4}.pbx .b .cp em.ns{background:#fff4e0;color:#9a6a12}.pbx .b .cp em.off{background:#fff4e0;color:#9a6a12}'
    + '.pbx .b.ex{opacity:.75}'
    + '.pbx .b.sel{border:2px solid #2e6bf2;box-shadow:0 0 0 4px rgba(46,107,242,.18)}'
    + '.pbx .b.draft{border-style:dashed}'
    + '.pbx .b.drop{border:1.5px dashed #2e6bf2;background:#f5f8ff}'
    + '.pbx .b.drop::after{content:"Drop here";position:absolute;right:8px;top:8px;font-size:10.5px;font-weight:800;color:#2e6bf2}'
    + '.pbx .b.over{background:#e6eeff}'
    + '.pbx .x-ed{position:fixed;top:0;right:0;bottom:0;width:min(480px,100%);background:#fff;border-left:1px solid #d9dfea;box-shadow:-20px 0 60px rgba(16,26,51,.12);padding:18px 20px 30px;overflow:auto;transform:translateX(105%);transition:transform .18s ease;z-index:3}'
    + '.pbx .x-ed.on{transform:none}.pbx .x-ed .edx{position:absolute;right:16px;top:14px;padding:6px 10px;font-size:12px}'
    + '.pbx .k{font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#5b6678;margin:4px 0 8px}'
    + '.pbx label{display:block;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#5b6678;margin:14px 0 5px}'
    + '.pbx input,.pbx textarea,.pbx select{width:100%;background:#fff;border:1px solid #d9dfea;border-radius:9px;color:#101a33;font:inherit;padding:8px 10px}'
    + '.pbx input:focus,.pbx textarea:focus,.pbx select:focus{outline:none;border-color:#2e6bf2;box-shadow:0 0 0 3px rgba(46,107,242,.15)}'
    + '.pbx textarea{min-height:260px;resize:vertical;line-height:1.5}'
    + '.pbx .row{display:flex;gap:8px;align-items:center}.pbx .row>*{flex:1}.pbx .row>.fit{flex:0 0 auto}'
    + '.pbx .doc{display:grid;grid-template-columns:1fr 1.4fr auto;gap:6px;margin-bottom:6px}'
    + '.pbx .hint{color:#7a86a0;font-size:12px;margin-top:4px}.pbx .acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}'
    + '.pbx .starters button{display:block;width:100%;text-align:left;margin-bottom:6px}'
    + '.pbx .log div{border-left:2px solid #d9dfea;padding:2px 0 6px 10px;color:#344055}.pbx .log small{color:#7a86a0;display:block}'
    + '.pbx .empty{color:#7a86a0;padding:30px}.pbx .tog{display:flex;align-items:center;gap:8px;margin-top:12px;color:#344055}.pbx .tog input{width:auto}'
    + '.pbx .toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#101a33;color:#fff;border-radius:10px;padding:10px 14px;display:none;gap:12px;align-items:center;z-index:5}'
    + '.pbx .toast.on{display:flex}'
    + '@media(max-width:1100px){.pbx .x-body{grid-template-columns:1fr;padding:0 12px 12px;gap:10px}.pbx .x-lib{max-height:none;display:flex;gap:8px;overflow-x:auto;padding:10px;align-items:center}.pbx .x-lib h3,.pbx .x-lib p,.pbx .x-lib .lk{display:none}.pbx .li{width:auto;margin:0;flex:0 0 auto}.pbx .x-top{flex-wrap:wrap;padding:14px 12px 8px}.pbx .x-pipes{padding:4px 12px 10px}.pbx .x-can{min-height:70vh}.pbx .hintb{display:none}}'
    /* the confirm card */
    + '.sgx{position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.65);display:flex;align-items:flex-start;justify-content:center;padding:40px 16px;overflow:auto;font:500 12.5px/1.45 Inter,-apple-system,system-ui,sans-serif;color:#fff}'
    + '.sgx *{box-sizing:border-box;letter-spacing:normal}.sgx .bx{width:min(640px,100%);background:#111216;border:1px solid #2a2c35;border-radius:16px;box-shadow:0 30px 80px rgba(0,0,0,.6)}'
    + '.sgx .hd{padding:16px 20px;border-bottom:1px solid #23252e}.sgx h3{margin:0;font-size:17px;font-weight:850}.sgx .sub{color:#aeb6c8;margin-top:3px}'
    + '.sgx .bd{padding:14px 20px}.sgx .k{font-size:10.5px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#7d859a;margin:10px 0 4px}'
    + '.sgx pre{white-space:pre-wrap;font:inherit;background:#18191f;border-radius:10px;padding:10px 12px;margin:0;max-height:260px;overflow:auto;color:#e6eaf2}'
    + '.sgx ul{margin:0;padding-left:16px}.sgx li{color:#e6eaf2}.sgx .why{background:rgba(255,72,102,.12);color:#ff8a9c;border-radius:9px;padding:8px 10px;margin-top:10px}'
    + '.sgx .ft{display:flex;gap:8px;justify-content:flex-end;padding:12px 20px;border-top:1px solid #23252e}'
    + '.sgx button{font:inherit;font-size:12px;font-weight:800;padding:8px 12px;border-radius:9px;border:1px solid #2a2c35;background:#18191f;color:#fff;cursor:pointer}.sgx button:hover{border-color:#4272f9}.sgx button.pri{background:#00dc86;border-color:#00dc86;color:#03170d}';
  var st = document.createElement('style'); st.id = 'pbCss'; st.textContent = CSS; (function () { var o = document.getElementById('pbCss'); if (o) o.remove(); })(); document.head.appendChild(st);

  var STARTERS = [
    { name: 'Investor: material requested', subject: '4ormIQ: the material you asked for', body: "Hi {{first_name}},\n\nThanks for taking the time. As promised, here is a short overview of 4ormIQ, with the deck and data room attached.\n\nThe problem:\n\nCanada's anti-money-laundering rules now reach well beyond the banks, and the cost of getting them wrong has jumped.\n\n- Since March 26, 2026, FINTRAC can fine a company up to C$20M for a single very serious violation. That is 40 times the old C$500,000 limit. Breaking a compliance order can now cost the greater of C$30M or 3% of worldwide gross revenue.\n\n- Since October 11, 2024, mortgage brokers, lenders and administrators carry full federal anti-money-laundering duties: a compliance program, client identity checks, record-keeping and reporting.\n\n- Compliance already costs a lot. For 24 Canadian property and casualty insurers, it rose 81% in two years, from C$416M in 2022 to C$753M in 2024.\n\nWho it affects:\n\nMortgage brokers, lenders and administrators; banks and credit unions; life insurers and their agents; securities dealers; real estate brokers and developers; money services businesses; accountants; BC notaries; dealers in precious metals and stones; and title insurers and factoring businesses.\n\nWhat we are building:\n\n4ormIQ is a set of AI tools that puts client counselling at the centre and plugs into the apps and compliance systems a business already uses.\n\n- Before any recommendation, the client privately works through their goals, circumstances and risk profile. They can model and compare outcomes and see the short- and long-term risks.\n\n- The client then chooses what to share with the professional. That shared brief gives the firm better context for a sound recommendation.\n\n- Every step is recorded as it happens, so the firm has an auditable record of the whole suitability and decision process.\n\nThe round:\n\nWe are raising C$500,000 in a pre-seed round at C$0.50 per share.\n\nWould next week be a challenge to get together?\n\nWith Gratitude,\n\nChad R Johnston\nFounder & CEO\n4orm Finance\n778-363-2423", follow: 4, task: 'Follow up on material sent to {{name}}' },
    { name: 'Design partner: material requested', subject: '4ormIQ for {{company}}: what a pilot looks like', body: 'Hi {{first_name}},\n\nThanks for the conversation. Here is what we talked about, with the short overview linked below.\n\nWhat 4ormIQ does for {{company}}\n- Your client works through their goals, situation and risk privately first, then chooses what to share with you.\n- You get a clear brief before the first meeting, so less time rebuilding the file by hand.\n- Each step is recorded as it happens, which gives you a clean record for suitability and anti-money-laundering reviews.\n\nWhat a design partnership involves\n- One redacted client journey reviewed together, about an hour.\n- A short pilot on a small number of real files, with your team setting the measures.\n- No change to the systems you already use.\n\nCould we find 30 minutes next week to map one client journey together?\n\nWith Gratitude,\nChad R Johnston\nFounder & CEO\n4orm Finance\n778-363-2423', follow: 3, task: 'Follow up on pilot outline with {{name}}' },
    { name: 'Regulator: material requested', subject: '4orm Finance: background for your review', body: 'Hello {{first_name}},\n\nThank you for your time. As requested, here is background on 4ormIQ, with our research linked below.\n\nIn brief\n- 4ormIQ helps consumers understand their own financial situation before they receive a recommendation.\n- The consumer decides what to share with the professional. Nothing is shared without their consent.\n- The process creates a time-stamped record of what the consumer understood and agreed to, which can support suitability and anti-money-laundering obligations.\n\nWe would welcome your view on how this fits current guidance, and we are glad to answer questions or walk through it at a time that suits you.\n\nWith Gratitude,\nChad R Johnston\nFounder & CEO\n4orm Finance\n778-363-2423', follow: 7, task: 'Check in with {{name}} on regulator material' },
    { name: 'Blank', subject: '', body: 'Hi {{first_name}},\n\n\n\nWith Gratitude,\nChad R Johnston\nFounder & CEO\n4orm Finance\n778-363-2423', follow: 0, task: '' }
  ];

  var S = { data: null, pipe: '', stage: '', draft: null, undo: null, arm: null, zoom: (function () { try { return +localStorage.getItem('pbZoom') || 0.9; } catch (e) { return 0.9; } })() };
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
    box.innerHTML = '<div class="x-top"><div><h1>Stage emails</h1><div class="x-sub">What goes out at each stage. Move a contact onto a stage and you confirm before anything is sent.</div></div><span class="x-sp"></span>'
      + '<button type="button" data-go="sprint">15-min sprint</button><button type="button" data-go="pipeline">Pipeline</button><button type="button" data-close>Close</button></div>'
      + '<div class="x-pipes"></div>'
      + '<div class="x-body"><div class="x-lib"></div><div class="x-can"><div class="cv-bar">'
      + '<span class="lg"><i class="c-stage"></i>Stage</span><span class="lg"><i class="c-email"></i>Email</span><span class="lg"><i class="c-doc"></i>Document</span><span class="lg"><i class="c-wait"></i>Follow-up</span><span class="lg"><i class="c-task"></i>Task</span><span class="lg"><i class="c-book"></i>Booking</span>'
      + '<span class="hintb">Drag a block onto a stage. Click any block to edit it.</span>'
      + '<span class="zm"><button type="button" data-z="-1">Zoom out</button><b class="zp"></b><button type="button" data-z="1">Zoom in</button><button type="button" data-z="0">Fit</button></span></div>'
      + '<div class="cv"><div class="gw"><div class="grid"></div></div></div></div></div>'
      + '<div class="x-ed"></div><div class="toast"></div>';
    document.body.appendChild(box);
    box.querySelector('[data-close]').onclick = close;
    box.querySelectorAll('[data-go]').forEach(function (b) { b.onclick = function () { close(); jump(b.getAttribute('data-go')); }; });
    box.querySelectorAll('[data-z]').forEach(function (b) { b.onclick = function () { var z = +b.getAttribute('data-z'); setZoom(z === 0 ? fitZoom() : S.zoom + z * 0.1); }; });
    var cv = el('.cv');
    cv.addEventListener('wheel', function (e) { if (!(e.ctrlKey || e.metaKey)) return; e.preventDefault(); setZoom(S.zoom + (e.deltaY < 0 ? 0.08 : -0.08)); }, { passive: false });
    /* drag the empty grid to move around */
    var pan = null;
    cv.addEventListener('mousedown', function (e) { if (e.button !== 0 || e.target.closest('.b')) return; pan = { x: e.clientX, y: e.clientY, l: cv.scrollLeft, t: cv.scrollTop }; cv.classList.add('pan'); });
    window.addEventListener('mousemove', function (e) { if (!pan) return; cv.scrollLeft = pan.l - (e.clientX - pan.x); cv.scrollTop = pan.t - (e.clientY - pan.y); });
    window.addEventListener('mouseup', function () { pan = null; cv.classList.remove('pan'); });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || !box.classList.contains('open') || document.querySelector('.sgx')) return;
      if (S.arm) { S.arm = null; paintLib(); return; }
      if (S.stage) { closeEd(); return; }
      close();
    });
  }
  function close() {
    box.classList.remove('open');
    try { var u = new URL(location.href); if (u.searchParams.get('builder')) { u.searchParams.delete('builder'); history.replaceState({}, '', u.pathname + u.search); } } catch (e) {}
  }

  function load() {
    el('.grid').innerHTML = '<div class="empty">Loading pipelines from GoHighLevel…</div>';
    return api('/api/processes').then(function (d) {
      S.data = d;
      if (!S.pipe || !curPipe()) S.pipe = (d.pipelines[0] && d.pipelines[0].id) || '';
      paint();
    }).catch(function (e) { el('.grid').innerHTML = '<div class="empty">' + esc(e.message) + '</div>'; });
  }

  var EXIT = /not now|not interested|parked|cancel|no response|not a fit|nurture|next round/i;
  var PHASES = [
    { n: 'Reach out', re: /storage|cold|reach|attempt|contacted|found|invited|discovery|evaluate|intro sent|intro \/|account created|^open$/i },
    { n: 'Connect', re: /contact made|send email|check back|call back|acknowledged|signed up|used|profile|target|outreach|proposal|^next$/i },
    { n: 'Meet and send', re: /meet|met$|info pack|package|material|notes|summary|follow up|rebooked|feedback|review|lane|terms|scoped|strategy|applied|conversation|documents/i },
    { n: 'Close and keep', re: /./ }
  ];
  var BOOK_URL = 'https://www.4ormop.com/book';
  var BOOK_RE = /4ormop\.com\/book\b/i;
  var BOOK_LINE = 'If it is easier, pick a time that suits you here and the Zoom link comes with the invite: ' + BOOK_URL;
  function addBooking(body) {
    if (BOOK_RE.test(body)) return body;
    var i = body.search(/\n\s*With Gratitude/i);
    return i >= 0 ? body.slice(0, i).replace(/\s+$/, '') + '\n\n' + BOOK_LINE + '\n' + body.slice(i) : body.replace(/\s+$/, '') + '\n\n' + BOOK_LINE;
  }
  var W = 158, H = 92, GX = 30, PITCH = H + 70;
  function phaseOf(name) { if (EXIT.test(name)) return -1; for (var i = 0; i < PHASES.length; i++) if (PHASES[i].re.test(name)) return i; return 3; }
  function fill(t) { return String(t || '').replace(/\{\{\s*name\s*\}\}/g, 'them').replace(/\{\{\s*first_name\s*\}\}/g, 'them').replace(/\{\{\s*company\s*\}\}/g, 'their firm'); }
  function shownPkg(stageId) {
    if (S.stage === stageId && S.draft && S.dirty) return { p: S.draft, draft: true };
    var p = pkgFor(stageId); return p ? { p: p, draft: false } : null;
  }
  /* The blocks a stage turns into: the stage, then its email, documents, follow-up and task. */
  function chain(s, ex) {
    var out = [{ t: 'stage', s: s, kk: 'Stage', tt: s.name, cp: [{ v: s.count ? s.count + ' here' : 'Empty', c: s.count ? 'live' : '' }], ex: ex }];
    var sp = shownPkg(s.id); if (!sp) return out;
    var p = sp.p, tag = sp.draft ? [{ v: 'Not saved', c: 'ns' }] : (p.active ? [] : [{ v: 'Paused', c: 'off' }]);
    out.push({ t: 'email', s: s, kk: 'Email', tt: p.subject || 'No subject yet', cp: tag.concat(p.design ? [{ v: 'Info pack' }] : []), draft: sp.draft, ex: ex });
    if (BOOK_RE.test(p.body || '')) out.push({ t: 'book', s: s, kk: 'Booking link', tt: 'Pick a time, Zoom included', cp: [{ v: '4ormop.com/book' }], draft: sp.draft, ex: ex });
    (p.docs || []).forEach(function (d) { if (d && (d.name || d.url)) out.push({ t: 'dc', s: s, kk: 'Document', tt: d.name || 'Unnamed link', cp: [{ v: /\.pdf(\?|$)/i.test(d.url || '') ? 'PDF' : 'Link' }], draft: sp.draft, ex: ex }); });
    if (p.spaceId) { var sx = ((S.data && S.data.spaces) || []).filter(function (x) { return x.id === p.spaceId; })[0]; out.push({ t: 'dc', s: s, kk: 'Document', tt: 'Space: ' + (sx ? sx.name : 'documents'), cp: [{ v: (sx ? sx.docs : 0) + ' files' }], draft: sp.draft, ex: ex }); }
    if (p.followDays) out.push({ t: 'wait', s: s, kk: 'Follow-up', tt: 'Follow up in ' + p.followDays + (p.followDays === 1 ? ' day' : ' days'), cp: [], draft: sp.draft, ex: ex });
    if (p.task) out.push({ t: 'task', s: s, kk: 'Task', tt: fill(p.task), cp: [{ v: 'GoHighLevel' }], draft: sp.draft, ex: ex });
    return out;
  }
  function fitZoom() {
    var cv = el('.cv'), g = el('.grid'); if (!g.__w) return 1;
    return Math.max(0.35, Math.min(1.2, Math.min((cv.clientWidth - 20) / g.__w, (cv.clientHeight - 20) / g.__h)));
  }
  function setZoom(z) {
    S.zoom = Math.round(Math.max(0.35, Math.min(1.5, z)) * 100) / 100;
    try { localStorage.setItem('pbZoom', S.zoom); } catch (e) {}
    var g = el('.grid'), gw = el('.gw');
    g.style.transform = 'scale(' + S.zoom + ')';
    gw.style.width = Math.ceil((g.__w || 0) * S.zoom) + 'px'; gw.style.height = Math.ceil((g.__h || 0) * S.zoom) + 'px';
    el('.zp').textContent = Math.round(S.zoom * 100) + '%';
  }

  function libItems() {
    var docs = {}, list = [];
    ((S.data && S.data.packages) || []).forEach(function (p) { (p.docs || []).forEach(function (d) { if (d && d.url && !docs[d.url]) { docs[d.url] = 1; list.push(d); } }); });
    S.libDocs = list;
    return list;
  }
  function paintLib() {
    var docs = libItems();
    function it(key, cls, name, small) { return '<button type="button" class="li' + (S.arm === key ? ' arm' : '') + '" draggable="true" data-li="' + esc(key) + '"><i class="' + cls + '"></i><span>' + esc(name) + '</span>' + (small ? '<small>' + esc(small) + '</small>' : '') + '</button>'; }
    el('.x-lib').innerHTML = '<h3>Library</h3><p>Drag onto a stage, or tap one then tap a stage. Nothing is saved until you press Save.</p>'
      + '<div class="lk">Blocks</div>' + it('email', 'c-email', 'Email') + it('doclink', 'c-doc', 'Document link') + it('wait', 'c-wait', 'Follow-up wait', '3 days') + it('task', 'c-task', 'Task', 'GoHighLevel') + it('book', 'c-book', 'Booking link', '4ormop.com/book')
      + '<div class="lk">Emails to start from</div>' + STARTERS.map(function (x, i) { return x.name === 'Blank' ? '' : it('starter:' + i, 'c-email', x.name.replace(': material requested', '')); }).join('')
      + '<div class="lk">Documents</div>' + (docs.length ? docs.map(function (d, i) { return it('doc:' + i, 'c-doc', d.name || d.url); }).join('') : '<p>Documents you add to a stage show here.</p>');
    el('.x-lib').querySelectorAll('[data-li]').forEach(function (b) {
      var key = b.getAttribute('data-li');
      b.onclick = function () { S.arm = S.arm === key ? null : key; paintLib(); markDrop(!!S.arm); };
      b.ondragstart = function (e) { e.dataTransfer.setData('text/plain', key); e.dataTransfer.effectAllowed = 'copy'; S.drag = key; markDrop(true); };
      b.ondragend = function () { S.drag = null; if (!S.arm) markDrop(false); };
    });
  }
  function markDrop(on) { el('.grid').querySelectorAll('.b.stage').forEach(function (b) { b.classList.toggle('drop', on); }); }

  /* Put a library block onto a stage: it goes into the draft and the editor opens. Save makes it real. */
  function apply(stageId, key) {
    if (S.grab && S.stage === stageId && S.draft) S.grab();
    var p = pkgFor(stageId);
    var dr = (S.stage === stageId && S.draft) ? S.draft : (p ? JSON.parse(JSON.stringify(p)) : { subject: '', body: '', docs: [], spaceId: '', followDays: 0, task: '', active: true, fresh: true });
    dr.docs = dr.docs || [];
    var blank = STARTERS[STARTERS.length - 1];
    function ensureEmail() { if (!dr.subject && !dr.body) { dr.subject = '4orm Helps'; dr.body = blank.body; } }
    if (key === 'email') ensureEmail();
    else if (key.indexOf('starter:') === 0) { var st = STARTERS[+key.split(':')[1]]; dr.subject = '4orm Helps'; dr.body = st.body; dr.bodyHtml = ''; dr.followDays = st.follow; dr.task = st.task; }
    else if (key === 'doclink') { ensureEmail(); dr.docs.push({ name: '', url: '' }); }
    else if (key.indexOf('doc:') === 0) { ensureEmail(); var d = (S.libDocs || [])[+key.split(':')[1]]; if (d && !dr.docs.some(function (x) { return x.url === d.url; })) dr.docs.push({ name: d.name, url: d.url }); }
    else if (key === 'wait') { ensureEmail(); dr.followDays = dr.followDays || 3; }
    else if (key === 'book') { ensureEmail(); if (dr.bodyHtml && !BOOK_RE.test(dr.bodyHtml)) { var hi = dr.bodyHtml.search(/With Gratitude/i); var line = esc(BOOK_LINE).replace(BOOK_URL, '<a href="' + BOOK_URL + '">' + BOOK_URL + '</a>') + '<br><br>'; dr.bodyHtml = hi >= 0 ? dr.bodyHtml.slice(0, hi) + line + dr.bodyHtml.slice(hi) : dr.bodyHtml + '<br><br>' + line; } dr.body = addBooking(dr.body); }
    else if (key === 'task') { ensureEmail(); dr.task = dr.task || 'Follow up with {{name}}'; }
    dr.fresh = false;
    S.stage = stageId; S.draft = dr; S.dirty = true; S.arm = null;
    paint();
  }

  function paint() {
    if (S.grab && S.stage && S.draft) S.grab();
    S.grab = null;
    var d = S.data || { pipelines: [], packages: [], stats: {} };
    var counts = {};
    (d.packages || []).forEach(function (p) { counts[p.pipelineId] = (counts[p.pipelineId] || 0) + 1; });
    el('.x-pipes').innerHTML = d.pipelines.length ? d.pipelines.map(function (p) {
      return '<button type="button" class="pl' + (p.id === S.pipe ? ' on' : '') + '" data-pipe="' + esc(p.id) + '"><span>' + esc(p.name) + '</span><small>' + (counts[p.id] || 0) + ' of ' + p.stages.length + '</small></button>';
    }).join('') : '<div class="empty">' + (d.connected ? 'No pipelines in GoHighLevel yet.' : 'GoHighLevel is not connected.') + '</div>';
    el('.x-pipes').querySelectorAll('[data-pipe]').forEach(function (b) { b.onclick = function () { if (S.dirty && !confirmLeave()) return; S.pipe = b.getAttribute('data-pipe'); S.stage = ''; S.draft = null; S.dirty = false; paint(); }; });
    paintLib();
    var pipe = curPipe(), g = el('.grid');
    if (!pipe) { g.innerHTML = ''; paintEditor(); return; }

    /* group stages into phases, keep GoHighLevel order inside each */
    var groups = PHASES.map(function (ph) { return { n: ph.n, st: [] }; }), exits = [];
    pipe.stages.forEach(function (s) { var k = phaseOf(s.name); (k < 0 ? exits : groups[k].st).push(s); });
    groups = groups.filter(function (x) { return x.st.length; });

    var html = '', lines = [], maxX = 0, y = 34, x0 = 0, prevLast = null, MAXW = 2400;
    groups.forEach(function (gr, gi) {
      var blocks = []; gr.st.forEach(function (s) { blocks = blocks.concat(chain(s, false)); });
      var rowW = blocks.length * (W + GX) - GX;
      if (x0 + rowW > MAXW) x0 = 0;
      html += '<div class="ph" style="left:' + x0 + 'px;top:' + (y - 22) + 'px">' + String(gi + 1).padStart(2, '0') + ' ' + esc(gr.n.toUpperCase()) + '</div>';
      if (prevLast) lines.push({ x1: prevLast.x + W / 2, y1: prevLast.y + H, x2: x0 + W / 2, y2: y, v: true });
      blocks.forEach(function (b, i) {
        var x = x0 + i * (W + GX);
        html += blockHtml(b, x, y);
        if (i) lines.push({ x1: x - GX, y1: y + H / 2, x2: x, y2: y + H / 2 });
        prevLast = { x: x, y: y };
        maxX = Math.max(maxX, x + W);
      });
      x0 = prevLast.x; y += PITCH;
    });
    if (exits.length) {
      y += 10;
      html += '<div class="ph ex" style="left:0;top:' + (y - 22) + 'px">OFF THE PATH</div>';
      var ex = 0;
      exits.forEach(function (s) { chain(s, true).forEach(function (b, i) { var x = ex * (W + GX); html += blockHtml(b, x, y); if (i) lines.push({ x1: x - GX, y1: y + H / 2, x2: x, y2: y + H / 2 }); maxX = Math.max(maxX, x + W); ex++; }); });
      y += PITCH;
    }
    var gw = maxX + 60, gh = y - 20;
    var svg = '<svg width="' + gw + '" height="' + gh + '"><defs><marker id="pbA" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#9fb3d9"/></marker></defs>'
      + lines.map(function (l) {
        var dd = l.v ? 'M' + l.x1 + ',' + l.y1 + ' L' + l.x1 + ',' + (l.y1 + 26) + ' L' + l.x2 + ',' + (l.y1 + 26) + ' L' + l.x2 + ',' + (l.y2 - 26) : 'M' + l.x1 + ',' + l.y1 + ' L' + (l.x2 - 2) + ',' + l.y2;
        return '<path d="' + dd + '" fill="none" stroke="#9fb3d9" stroke-width="1.5"' + (l.v ? '' : ' marker-end="url(#pbA)"') + '/>';
      }).join('') + '</svg>';
    g.style.width = gw + 'px'; g.style.height = gh + 'px'; g.__w = gw; g.__h = gh;
    g.innerHTML = svg + html;
    setZoom(S.zoom);
    g.querySelectorAll('.b').forEach(function (b) {
      var id = b.getAttribute('data-st');
      b.onclick = function () {
        if (S.arm) { apply(id, S.arm); return; }
        if (S.stage !== id && S.dirty && !confirmLeave()) return;
        if (S.stage !== id) { S.draft = null; S.dirty = false; }
        S.stage = id; S.focus = b.getAttribute('data-t'); paint();
      };
      if (b.classList.contains('stage')) {
        b.ondragover = function (e) { e.preventDefault(); b.classList.add('over'); };
        b.ondragleave = function () { b.classList.remove('over'); };
        b.ondrop = function (e) { e.preventDefault(); var k = e.dataTransfer.getData('text/plain') || S.drag; S.drag = null; if (k) apply(id, k); };
      }
    });
    if (S.arm) markDrop(true);
    paintEditor();
  }
  function blockHtml(b, x, y) {
    var sel = S.stage === b.s.id && (b.t === 'stage' || b.t === (S.focus || 'stage'));
    return '<button type="button" class="b ' + b.t + (b.ex ? ' ex' : '') + (b.draft ? ' draft' : '') + (sel ? ' sel' : '') + '" data-st="' + esc(b.s.id) + '" data-t="' + b.t + '" style="left:' + x + 'px;top:' + y + 'px">'
      + '<span class="kk">' + esc(String(b.kk).toUpperCase()) + '</span><span class="tt">' + esc(b.tt) + '</span>'
      + (b.cp && b.cp.length ? '<span class="cp">' + b.cp.map(function (c) { return '<em class="' + (c.c || '') + '">' + esc(c.v) + '</em>'; }).join('') + '</span>' : '') + '</button>';
  }
  function confirmLeave() { return window.confirm('You have changes on this stage that are not saved. Leave them?'); }
  function closeEd() { if (S.dirty && !confirmLeave()) return; S.stage = ''; S.draft = null; S.dirty = false; paint(); }

  function paintEditor() {
    var ed = el('.x-ed'), pipe = curPipe();
    var stg = pipe && pipe.stages.filter(function (x) { return x.id === S.stage; })[0];
    ed.classList.toggle('on', !!stg);
    if (!stg) {
      ed.innerHTML = '<div class="k">Package</div><div class="empty">Pick a stage on the map to build what it sends.</div>'
        + '<div class="k">How it works</div><div class="hint" style="color:#c8d1ea">1. Click a stage and write the email. Use {{first_name}}, {{company}} and {{name}}; they fill in per contact.<br>2. Add document links, or attach a Space so its documents go too.<br>3. Set a follow-up and a GoHighLevel task if you want one.<br>4. On Lists or any contact card, move someone with Stages. If that stage has a package, you see exactly what goes out and confirm.</div>';
      return;
    }
    var p = pkgFor(stg.id);
    var dr = S.draft || (S.draft = p ? JSON.parse(JSON.stringify(p)) : { subject: '', body: '', docs: [], spaceId: '', followDays: 0, task: '', active: true, fresh: true });
    var spaces = (S.data && S.data.spaces) || [];
    ed.innerHTML = '<button type="button" class="edx" data-edx>Close</button><div class="k">' + esc(pipe.name) + ' · stage</div><div style="font-size:20px;font-weight:850;padding-right:70px">' + esc(stg.name) + '</div>'
      + (dr.fresh ? '<label>Start from</label><div class="starters">' + STARTERS.map(function (s, i) { return '<button type="button" data-start="' + i + '">' + esc(s.name) + '</button>'; }).join('') + '</div>' : '')
      + '<label for="pbSub">Subject</label><input id="pbSub" value="' + esc(dr.subject) + '" maxlength="200">'
      + '<label>Email</label>' + (window.richBar ? window.richBar.html() + '<div id="pbBody" class="rte" contenteditable="true">' + (dr.bodyHtml || window.richBar.textToHtml(dr.body)) + '</div>' : '<textarea id="pbBody">' + esc(dr.body) + '</textarea>') + '<div class="hint">{{first_name}}, {{company}} and {{name}} fill in per contact. Document links are added under the email.</div>'
      + '<label for="pbDesign">Design</label><select id="pbDesign">' + (((S.data && S.data.designs) || [{ id: '', name: 'Plain email' }]).map(function (d) { return '<option value="' + esc(d.id) + '"' + (d.id === (dr.design || '') ? ' selected' : '') + '>' + esc(d.name) + '</option>'; }).join('')) + '</select><div class="hint">An info pack puts your note on top and a one-minute brief with the numbers underneath, ready to forward. PDF links also go as attachments.</div>'
      + '<label>Documents</label><div id="pbDocs">' + (dr.docs || []).map(function (d, i) {
        return '<div class="doc"><input data-dn="' + i + '" value="' + esc(d.name) + '" placeholder="Name"><input data-du="' + i + '" value="' + esc(d.url) + '" placeholder="https://drive.google.com/..."><button type="button" class="fit warn" data-dx="' + i + '">Remove</button></div>';
      }).join('') + '</div><button type="button" data-adddoc>Add a document link</button>'
      + '<label for="pbSpace">Also send a Space\'s documents</label><select id="pbSpace"><option value="">None</option>' + spaces.map(function (s) { return '<option value="' + esc(s.id) + '"' + (s.id === dr.spaceId ? ' selected' : '') + '>' + esc(s.name) + ' (' + s.docs + ')</option>'; }).join('') + '</select>'
      + '<div class="row"><div><label for="pbFu">Follow up after (days)</label><input id="pbFu" type="number" min="0" max="90" value="' + (dr.followDays || 0) + '"></div><div><label for="pbTask">GoHighLevel task</label><input id="pbTask" value="' + esc(dr.task) + '" placeholder="Optional"></div></div>'
      + '<div class="tog"><input type="checkbox" id="pbOn"' + (dr.active ? ' checked' : '') + '><label for="pbOn" style="margin:0;text-transform:none;letter-spacing:0;font-size:12.5px;color:#c8d1ea">Send when a contact lands here (you always confirm first)</label></div>'
      + '<div class="acts"><button type="button" class="pri" data-save>Save package</button>' + (p ? '<button type="button" data-view>Preview saved email</button><button type="button" data-test>Send me a test</button><button type="button" class="warn" data-rm>Remove package</button>' : '') + '</div>'
      + '<div class="k" style="margin-top:20px">Sent from this stage</div><div class="log" id="pbLog"><span class="hint">Loading…</span></div>';
    ed.querySelector('[data-edx]').onclick = closeEd;
    ed.oninput = ed.onchange = function () { S.dirty = true; };
    S.grab = function () { try { grab(); } catch (e) {} };
    function grab() {
      dr.subject = el('#pbSub').value;
      var bx = el('#pbBody');
      if (bx.tagName === 'TEXTAREA') dr.body = bx.value; else { dr.body = window.richBar.toText(bx); dr.bodyHtml = bx.innerHTML; } dr.spaceId = el('#pbSpace').value; dr.design = el('#pbDesign').value;
      dr.followDays = Number(el('#pbFu').value) || 0; dr.task = el('#pbTask').value; dr.active = el('#pbOn').checked;
      ed.querySelectorAll('[data-dn]').forEach(function (x) { dr.docs[+x.getAttribute('data-dn')].name = x.value; });
      ed.querySelectorAll('[data-du]').forEach(function (x) { dr.docs[+x.getAttribute('data-du')].url = x.value; });
    }
    ed.querySelectorAll('[data-start]').forEach(function (b) {
      b.onclick = function () { var s = STARTERS[+b.getAttribute('data-start')]; grab(); dr.subject = s.subject; dr.body = s.body; dr.bodyHtml = ''; dr.followDays = s.follow; dr.task = s.task; paintEditor(); };
    });
    ed.querySelector('[data-adddoc]').onclick = function () { grab(); dr.docs = dr.docs || []; dr.docs.push({ name: '', url: '' }); paintEditor(); };
    ed.querySelectorAll('[data-dx]').forEach(function (b) { b.onclick = function () { grab(); dr.docs.splice(+b.getAttribute('data-dx'), 1); paintEditor(); }; });
    ed.querySelector('[data-save]').onclick = function () {
      grab();
      var bad = (dr.docs || []).filter(function (d) { return (d.name || d.url) && !(d.name && /^https:\/\//i.test(d.url)); });
      if (bad.length) { toast('Each document needs a name and a link starting with https://'); return; }
      var b = this; b.disabled = true; b.textContent = 'Saving…';
      api('/api/processes', 'POST', { action: 'save', pipelineId: pipe.id, pipelineName: pipe.name, stageId: stg.id, stageName: stg.name, subject: dr.subject, body: dr.body, bodyHtml: dr.bodyHtml || '', docs: dr.docs, spaceId: dr.spaceId, followDays: dr.followDays, task: dr.task, active: dr.active, design: dr.design || '' })
        .then(function (j) {
          S.data.packages = S.data.packages.filter(function (x) { return x.stageId !== stg.id; }).concat([j.package]);
          S.draft = null; S.dirty = false; paint(); toast('Saved: ' + stg.name);
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
        S.data.packages = S.data.packages.filter(function (x) { return x.stageId !== stg.id; }); S.draft = null; S.dirty = false; paint();
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
  /* Left menu: Stage emails opens the builder over the page you are on. */
  window.addEventListener('click', function (e) {
    var p = e.composedPath ? e.composedPath() : [];
    for (var i = 0; i < p.length; i++) {
      if (p[i] && p[i].getAttribute && p[i].getAttribute('data-name') === 'Stage emails' && p[i].classList.contains('nav')) {
        e.preventDefault(); e.stopPropagation(); window.openProcessBuilder(); return;
      }
    }
  }, true);
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
