/* Contact card, 28 Oct 2026 (Option B). Any contact from any list opens here: Playbook views, Lists, Calls.
   Point-form notes from the research on the record: why we reach out, pain, why they fit, what they have backed, intel.
   Outcomes log a touch (Undo), set the follow-up date and move the stage. With a queue, the next contact loads after each save. */
(function () {
  if (window.openDossier) return;
  var CSS = '#dsr *{box-sizing:border-box;letter-spacing:normal}#dsr h2{color:#fff!important;opacity:1!important;display:block}#dsr .d-sec{display:block!important;margin-top:14px}#dsr .d-k{display:block!important;width:auto!important}#dsr ul{display:block}#dsr li{display:list-item;list-style:disc}#dsr .d-chip,#dsr .d-stgb{opacity:1!important;filter:none!important}'
    + '#dsr{position:fixed;inset:0;z-index:2147482000;background:rgba(0,0,0,.6);display:none;align-items:flex-start;justify-content:center;overflow:auto;padding:28px 16px}'
    + '#dsr.open{display:flex}#dsr .d-bx{width:min(1080px,100%);background:#111216;border:1px solid #2a2c35;border-radius:16px;color:#fff;font:500 12.5px/1.45 Inter,-apple-system,system-ui,sans-serif;box-shadow:0 30px 80px rgba(0,0,0,.6)}'
    + '#dsr .d-top{display:flex;gap:10px;align-items:center;justify-content:space-between;padding:14px 20px;border-bottom:1px solid #23252e}'
    + '#dsr .d-chip{display:inline-block;font-size:10.5px;font-weight:800;padding:2px 8px;border-radius:6px;background:#18191f;color:#aeb6c8;margin-right:6px}'
    + '#dsr .d-chip.c{background:rgba(0,220,134,.14);color:#00dc86}#dsr .d-chip.l{background:rgba(66,114,249,.16);color:#9db9ff}#dsr .d-chip.e{background:rgba(151,113,249,.16);color:#c3adff}'
    + '#dsr .d-mid{display:grid;grid-template-columns:1.35fr 1fr;gap:0}#dsr .d-lft{padding:18px 20px;border-right:1px solid #23252e}#dsr .d-rgt{padding:18px 20px}'
    + '#dsr h2{font-size:22px;font-weight:850;margin:0}#dsr .d-who{color:#aeb6c8;font-size:13px;margin-top:2px}'
    + '#dsr .d-tel{font-size:30px;font-weight:850;margin:12px 0 6px;font-variant-numeric:tabular-nums}#dsr .d-tel a{color:#fff;text-decoration:none}'
    + '#dsr .d-links a{color:#9db9ff;font-weight:700;margin-right:14px;text-decoration:none}#dsr .d-links a:hover{text-decoration:underline}'
    + '#dsr .d-sec{margin-top:14px}#dsr .d-k{font-size:10.5px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#7d859a;margin-bottom:5px}'
    + '#dsr ul{margin:0;padding-left:16px}#dsr li{margin:2px 0;color:#e6eaf2}#dsr li b{color:#fff}'
    + '#dsr .d-pain{display:inline-flex;gap:3px;vertical-align:middle;margin-right:8px}#dsr .d-pain i{width:10px;height:10px;border-radius:2px;background:#2a2c35}#dsr .d-pain i.on{background:#ff4866}'
    + '#dsr .d-open{color:#e6eaf2;background:#18191f;border-radius:10px;padding:10px 12px}'
    + '#dsr .d-outs{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}#dsr button{font:inherit;font-size:12px;font-weight:800;padding:7px 11px;border-radius:9px;border:1px solid #2a2c35;background:#18191f;color:#fff;cursor:pointer}'
    + '#dsr button:hover{border-color:#4272f9}#dsr button.on{background:#4272f9;border-color:#4272f9}#dsr button.pri{background:#00dc86;border-color:#00dc86;color:#03170d}'
    + '#dsr textarea{width:100%;min-height:84px;background:#18191f;border:1px solid #2a2c35;border-radius:10px;color:#fff;font:inherit;padding:9px 10px;resize:vertical}'
    + '#dsr input[type=date]{background:#18191f;border:1px solid #2a2c35;border-radius:8px;color:#fff;font:inherit;padding:6px 8px}'
    + '#dsr .d-hist div{border-left:2px solid #2a2c35;padding:2px 0 6px 10px;color:#c8d1ea}#dsr .d-hist small{color:#7d859a;display:block}'
    + '#dsr .d-muted{color:#7d859a}#dsr .d-acts{display:flex;gap:8px;justify-content:flex-end;padding:12px 20px;border-top:1px solid #23252e}'
    + '#dsr .d-q{color:#aeb6c8;font-size:12px}#dsr .d-stg{position:relative;display:inline-block}#dsr .d-stgb{background:rgba(255,169,70,.14);border-color:rgba(255,169,70,.45);color:#ffc98a;padding:3px 10px;font-size:11px}'
    + '#dsr .d-stgp{position:absolute;top:30px;left:0;z-index:5;background:#18191f;border:1px solid #2a2c35;border-radius:12px;padding:10px;width:300px;box-shadow:0 18px 40px rgba(0,0,0,.55)}#dsr .d-stgp .d-sl{display:flex;flex-direction:column;gap:5px;margin-top:6px}'
    + '#dsr .d-stgp .d-sl button{text-align:left}#dsr .d-stgp select{width:100%;background:#111216;color:#fff;border:1px solid #2a2c35;border-radius:8px;padding:5px;font:inherit}@media(max-width:820px){#dsr .d-mid{grid-template-columns:1fr}#dsr .d-lft{border-right:0}}';
  var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  var wrap = document.createElement('div'); wrap.id = 'dsr';
  function mount() { if (!wrap.isConnected) document.body.appendChild(wrap); }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function api(url, method, body) {
    var fn = typeof window.authFetch === 'function' ? window.authFetch : fetch;
    return fn(url, { method: method || 'GET', credentials: 'same-origin', headers: body ? { 'content-type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  }
  var LISTS = { design: ['Design partners', 'Call'], clients: ['Client targets', 'Call'], prospects: ['Prospects', 'Email'], channels: ['Distribution channels', 'Email'],
    angels: ['Angels (people)', 'LinkedIn'], firms_now: ['Firms and funds: reach now', 'Form'], new_funds: ['New funds 2024-26', 'Email'], firms_later: ['Firms and funds: later', 'Email'],
    programs: ['Grants and programs', 'Form'], regulators: ['Regulators', 'Email'], index: ['Wider contact index', 'Email'] };
  var OUTS = {
    Call: ['No answer', 'Left voicemail', 'Spoke', 'Interested', 'Call back', 'Meeting booked', 'Not interested', 'Wrong number'],
    LinkedIn: ['Sent in GoHighLevel', 'Connected', 'Replied', 'Interested', 'Meeting booked', 'Not interested'],
    Email: ['Sent', 'Replied', 'Interested', 'Meeting booked', 'Bounced', 'Not interested'],
    Form: ['Form sent', 'Replied', 'Interested', 'Meeting booked', 'Not a fit']
  };

  /* Research rows from every source sheet, merged: one value per field, repeats dropped. */
  function merged(rec) {
    var d = rec.data || {}, out = {};
    function add(k, v) {
      if (v == null || v === '' || typeof v === 'object') return;
      var s = String(v).trim(); if (!s) return;
      var key = String(k).replace(/^4orm\s+/i, '').trim();
      out[key] = out[key] || [];
      if (out[key].map(function (x) { return x.toLowerCase(); }).indexOf(s.toLowerCase()) < 0) out[key].push(s);
    }
    (d.research || []).forEach(function (row) { Object.keys(row || {}).forEach(function (k) { add(k, row[k]); }); });
    ['vc25', 'newfund', 'directory', 'leaders'].forEach(function (k) {
      var v = d[k]; if (!v) return;
      (Array.isArray(v) ? v : [v]).forEach(function (row) { if (row && typeof row === 'object') Object.keys(row).forEach(function (kk) { add(kk, row[kk]); }); else add(k, row); });
    });
    if (d.brief) String(d.brief).split(/\s*\|\s*/).forEach(function (part) { var m = part.match(/^([^:]{2,40}):\s*(.+)$/); if (m) add(m[1], m[2]); else add('Notes', part); });
    return out;
  }
  function take(M, keys, used) {
    var r = [];
    keys.forEach(function (k) {
      Object.keys(M).forEach(function (mk) {
        if (used[mk]) return;
        if (mk.toLowerCase() === k.toLowerCase()) { used[mk] = 1; M[mk].forEach(function (v) { r.push([mk, v]); }); }
      });
    });
    return r;
  }
  function bullets(rows, withLabel) {
    if (!rows.length) return '';
    return '<ul>' + rows.map(function (x) { return '<li>' + (withLabel && x[0] ? '<b>' + esc(x[0]) + ':</b> ' : '') + esc(x[1]) + '</li>'; }).join('') + '</ul>';
  }
  function sec(title, body) { return body ? '<div class="d-sec"><div class="d-k">' + esc(title) + '</div>' + body + '</div>' : ''; }
  function tel(v) { return String(v || '').split(/\s*(?:;|\/|,|\bor\b)\s*/)[0].replace(/[^\d+]/g, ''); }
  function url(v) { v = String(v || '').trim(); if (!v) return ''; return /^https?:/i.test(v) ? v : (/^[\w.-]+\.[a-z]{2,}/i.test(v) ? 'https://' + v : ''); }
  function painScore(M) {
    var raw = (M['Pain Score'] || M['Pain score'] || [])[0];
    var n = Number(raw);
    return isFinite(n) && raw !== undefined ? n : null;
  }

  function render(rec, opts) {
    var M = merged(rec), used = {};
    var meta = LISTS[rec.list] || [rec.list, 'Email'];
    var ch = (opts && opts.channel) || meta[1];
    var parts = String(rec.contact || '').split(/\s*\|\s*/);
    var person = rec.list === 'angels' ? rec.name : (parts[0] && !/@|^\+?\d/.test(parts[0]) ? parts[0] : '');
    var role = rec.title || (rec.list === 'angels' ? parts.slice(1).join(' ') : parts[1] || '');
    var place = [rec.city, rec.prov].filter(Boolean).join(', ');
    var industry = (M['Industry'] || [])[0] || rec.type || '';
    used.Industry = 1;
    var pain = painScore(M);
    var phone = tel(rec.phone), li = url(rec.linkedin), web = url(rec.website), form = url(rec.route);

    var why = [];
    if (rec.why) why.push(['', rec.why]);
    take(M, ['Specific reason to call', "Why they're worth a message", 'Why 4orm', 'Why this one', 'Key Call Point / Notes'], used).forEach(function (x) { why.push(x); });
    if (rec.next_action) why.push(['Next step', rec.next_action]);

    var painRows = take(M, ['Pain Drivers', 'High Pain', 'Pain Rank', 'Pain hypothesis — NOT verified', 'Pressure / Why Now', 'What Happened / Why Now', 'Industry timing source'], used);
    used['Pain Score'] = 1;
    var fit = take(M, ['Design Fit', 'Why they fit', 'Can invest in us now', 'What blocks it', 'Sector fit', 'Sectors', 'Stages they invest', 'Stage', 'Cheque fit', 'Cheque low', 'Cheque high', 'Pre-revenue OK', 'Needs a lead first', 'Leads rounds', 'Revenue or traction bar', 'Geography rule', 'Design Partner Score', 'Revised Design Score', 'Quality Score', 'Prospect Score'], used);
    var backed = take(M, ['Who they have backed', 'Backed', 'Portfolio', 'Notable investments'], used);
    var opener = take(M, ['Personalized positive opener (not a claim of pain)'], used);
    ['Call order', 'Name', 'Type', 'City', 'Prov', 'Website', 'Email', 'Phone', 'Pitch or apply link'].forEach(function (k) { used[k] = 1; });
    var intel = take(M, ['Notes'], used);
    Object.keys(M).forEach(function (k) { if (!used[k]) M[k].forEach(function (v) { intel.push([k, v]); }); });
    if (rec.constraint_note) intel.push(['Caution', rec.constraint_note]);
    if (rec.evidence) intel.push(['Checked', rec.evidence]);
    var people = (rec.data && rec.data.people) || [];
    var peopleRows = (Array.isArray(people) ? people : []).slice(0, 6).map(function (p) {
      if (p && typeof p === 'object') return ['', [p.name || p.Name, p.title || p.Title || p.role, p.email || p.Email, p.phone || p.Phone].filter(Boolean).join(' · ')];
      return ['', String(p)];
    }).filter(function (x) { return x[1]; });

    var touches = rec.touches || [];
    var stage = rec.stage || 'Cold', ghl = (rec.data && rec.data.ghl && rec.data.ghl.stage) || '';
    var q = opts && opts.queue ? opts.queue : null, qi = q ? q.indexOf(rec.id) : -1;
    var chipCls = ch === 'Call' ? 'c' : ch === 'LinkedIn' ? 'l' : 'e';

    var h = '<div class="d-bx"><div class="d-top"><div><span class="d-chip ' + chipCls + '">' + esc(ch === 'LinkedIn' ? 'LinkedIn in GoHighLevel' : ch) + (q ? ' · ' + (qi + 1) + ' of ' + q.length : '') + '</span>'
      + '<span class="d-chip">' + esc(meta[0]) + '</span>' + (rec.priority ? '<span class="d-chip">' + esc(rec.priority) + (rec.score ? ' · score ' + esc(rec.score) : '') + '</span>' : '')
      + '<span class="d-stg"><button type="button" class="d-stgb" data-a="stages">Stages: ' + esc(ghl || stage) + '</button></span></div>'
      + '<span class="d-q">' + (rec.last_touch ? 'Last touch ' + esc(new Date(rec.last_touch).toLocaleDateString('en-CA', { timeZone: 'America/Vancouver' })) : 'Never touched') + '</span></div>'
      + '<div class="d-mid"><div class="d-lft">'
      + '<h2>' + esc(rec.name) + '</h2><div class="d-who">' + esc([person && person !== rec.name ? person : '', role, place, industry].filter(Boolean).join(' · ')) + '</div>'
      + (phone ? '<div class="d-tel"><a href="tel:' + esc(phone) + '">' + esc(String(rec.phone).split(/\s*[;/]\s*/)[0]) + '</a></div>' : '<div style="height:10px"></div>')
      + '<div class="d-links">' + (li ? '<a href="' + esc(li) + '" target="_blank" rel="noopener">LinkedIn</a>' : '') + (rec.email ? '<a href="mailto:' + esc(rec.email) + '">' + esc(rec.email) + '</a>' : '')
      + (form ? '<a href="' + esc(form) + '" target="_blank" rel="noopener">Contact form</a>' : '') + (web ? '<a href="' + esc(web) + '" target="_blank" rel="noopener">Website</a>' : '') + '</div>'
      + sec("Why we're reaching out", bullets(why, true))
      + sec('Pain', (pain != null ? '<div style="margin-bottom:4px"><span class="d-pain">' + [1, 2, 3, 4, 5].map(function (i) { return '<i' + (pain >= i * 20 - 10 ? ' class="on"' : '') + '></i>'; }).join('') + '</span><b>' + esc(pain) + ' / 100</b></div>' : '') + bullets(painRows, true))
      + sec('Why they fit', bullets(fit, true))
      + sec('What they have invested in', bullets(backed, false))
      + sec('Opening line', opener.length ? '<div class="d-open">' + esc(opener[0][1]) + '</div>' : '')
      + sec('People', bullets(peopleRows, false))
      + sec('Intel', bullets(intel, true))
      + '</div><div class="d-rgt">'
      + '<div class="d-k">Outcome</div><div class="d-outs">' + (OUTS[ch] || OUTS.Email).map(function (o) { return '<button type="button" data-o="' + esc(o) + '">' + esc(o) + '</button>'; }).join('') + '</div>'
      + '<div class="d-k" style="margin-top:10px">Notes</div><textarea id="dsrNote" placeholder="Type while you talk"></textarea>'
      + '<div style="display:flex;gap:10px;align-items:center;margin-top:8px"><span class="d-k" style="margin:0">Follow up</span><input type="date" id="dsrFu"></div>'
      + (rec.notes ? sec('Earlier notes', '<div class="d-muted" style="white-space:pre-wrap">' + esc(String(rec.notes).slice(0, 1600)) + '</div>') : '')
      + sec('History', touches.length ? '<div class="d-hist">' + touches.slice(0, 8).map(function (t) {
        return '<div><small>' + esc(new Date(t.at).toLocaleString('en-CA', { timeZone: 'America/Vancouver', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })) + ' · ' + esc(t.channel || '') + '</small>' + esc([t.outcome, t.note].filter(Boolean).join(' · ')) + '</div>';
      }).join('') + '</div>' : '<div class="d-muted">No touches yet.</div>')
      + '</div></div>'
      + '<div class="d-acts">' + (q && qi > 0 ? '<button data-a="prev">Previous</button>' : '') + (q && qi < q.length - 1 ? '<button data-a="skip">Skip</button>' : '')
      + '<button data-a="del" style="margin-right:auto;color:#ff8a98;border-color:rgba(255,72,102,.45)">Delete</button><button data-a="lists">Open in Lists</button><button data-a="close">Close</button><button class="pri" data-a="save">' + (q && qi < q.length - 1 ? 'Save and next' : 'Save') + '</button></div></div>';
    return h;
  }

  function toast(msg, undo) {
    var t = document.getElementById('dsrToast');
    if (!t) { t = document.createElement('div'); t.id = 'dsrToast'; t.style.cssText = 'position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:2147483001;background:#111216;color:#fff;border:1px solid #2a2c35;border-radius:10px;padding:9px 14px;font:600 13px Inter,system-ui,sans-serif;display:flex;gap:12px;align-items:center;box-shadow:0 12px 30px rgba(0,0,0,.5)'; document.body.appendChild(t); }
    t.innerHTML = '<span></span>' + (undo ? '<button type="button" style="font:inherit;font-weight:800;color:#9db9ff;background:none;border:0;cursor:pointer">Undo</button>' : '');
    t.firstChild.textContent = msg; t.style.display = 'flex';
    if (undo) t.lastChild.onclick = function () { t.style.display = 'none'; undo(); };
    clearTimeout(t._h); t._h = setTimeout(function () { t.style.display = 'none'; }, 6000);
  }

  function open(id, opts) {
    opts = opts || {};
    mount();
    wrap.innerHTML = '<div class="d-bx" style="padding:30px;color:#aeb6c8">Loading the card…</div>';
    wrap.classList.add('open');
    api('/api/growth?id=' + encodeURIComponent(id)).then(function (r) { return r && r.ok ? r.json() : null; }).then(function (rec) {
      if (!rec || !rec.id) { wrap.innerHTML = '<div class="d-bx" style="padding:30px">Could not load this contact. <button data-a="close">Close</button></div>'; bindClose(); return; }
      wrap.innerHTML = render(rec, opts);
      bind(rec, opts);
    }).catch(function () { wrap.innerHTML = '<div class="d-bx" style="padding:30px">Could not load this contact. <button data-a="close">Close</button></div>'; bindClose(); });
  }
  function close() { wrap.classList.remove('open'); wrap.innerHTML = ''; }
  function bindClose() { wrap.querySelectorAll('[data-a="close"]').forEach(function (b) { b.onclick = close; }); }
  wrap.addEventListener('click', function (e) { if (e.target === wrap) close(); var p = wrap.querySelector('.d-stgp'); if (p && !p.contains(e.target)) p.remove(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && wrap.classList.contains('open')) close(); });

  function bind(rec, opts) {
    var chosen = '';
    var meta = LISTS[rec.list] || [rec.list, 'Email'];
    var ch = opts.channel || meta[1];
    bindClose();
    wrap.querySelectorAll('[data-o]').forEach(function (b) {
      b.onclick = function () {
        chosen = chosen === b.getAttribute('data-o') ? '' : b.getAttribute('data-o');
        wrap.querySelectorAll('[data-o]').forEach(function (x) { x.classList.toggle('on', x.getAttribute('data-o') === chosen); });
        var fu = wrap.querySelector('#dsrFu');
        if (/Call back|Connected|Sent|Form sent|Left voicemail/.test(chosen) && fu && !fu.value) {
          var days = /Call back/.test(chosen) ? 1 : 3;
          fu.value = new Date(Date.now() + days * 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Vancouver' });
        }
      };
    });
    var q = opts.queue, qi = q ? q.indexOf(rec.id) : -1;
    function go(step) { if (q && q[qi + step]) open(q[qi + step], opts); else close(); }
    var pv = wrap.querySelector('[data-a="prev"]'); if (pv) pv.onclick = function () { go(-1); };
    var sk = wrap.querySelector('[data-a="skip"]'); if (sk) sk.onclick = function () { go(1); };
    var sb = wrap.querySelector('[data-a="stages"]');
    if (sb) sb.onclick = function (e) {
      e.stopPropagation();
      var holder = sb.parentNode, old = holder.querySelector('.d-stgp');
      if (old) { old.remove(); return; }
      var pop = document.createElement('div'); pop.className = 'd-stgp'; pop.innerHTML = '<span class="d-muted">Loading GoHighLevel stages…</span>';
      holder.appendChild(pop);
      pop.onclick = function (ev) { ev.stopPropagation(); };
      api('/api/growth?ghl=' + encodeURIComponent(rec.id)).then(function (r) { return r && r.ok ? r.json() : null; }).then(function (g) {
        if (!g || !g.connected) { pop.innerHTML = '<span class="d-muted">GoHighLevel is not connected.</span>'; return; }
        var opp = (g.opps || [])[0] || null, pipes = g.pipelines || [];
        function draw(pipeId) {
          var pipe = pipes.filter(function (x) { return x.id === pipeId; })[0] || pipes[0];
          if (!pipe) { pop.innerHTML = '<span class="d-muted">No pipelines in GoHighLevel yet.</span>'; return; }
          pop.innerHTML = '<div class="d-k" style="margin:0">' + (opp ? esc(opp.pipeline || pipe.name) + ' · now at ' + esc(opp.stage || '?') : 'Not in a pipeline yet. Pick a stage to add them.') + '</div>'
            + (!opp && pipes.length > 1 ? '<select>' + pipes.map(function (x) { return '<option value="' + esc(x.id) + '"' + (x.id === pipe.id ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('') + '</select>' : '')
            + '<div class="d-sl">' + (pipe.stages || []).map(function (st) { return '<button type="button" data-sid="' + esc(st.id) + '" class="' + (opp && opp.stageId === st.id ? 'on' : '') + '">' + esc(st.name) + '</button>'; }).join('') + '</div>';
          var sel = pop.querySelector('select'); if (sel) sel.onchange = function () { draw(sel.value); };
          pop.querySelectorAll('[data-sid]').forEach(function (b) {
            b.onclick = function () {
              var st = (pipe.stages || []).filter(function (x) { return x.id === b.getAttribute('data-sid'); })[0];
              b.textContent = 'Moving…';
              api('/api/growth', 'POST', { action: 'ghl-move', id: rec.id, pipelineId: pipe.id, stageId: st.id, stageName: st.name, opportunityId: opp ? opp.id : '' })
                .then(function (x) { return x.json().then(function (j) { if (!x.ok) throw new Error(j.error || 'GoHighLevel did not move it'); return j; }); })
                .then(function () { sb.textContent = 'Stages: ' + st.name; pop.remove(); toast('Moved in GoHighLevel: ' + st.name); if (opts.onSaved) opts.onSaved(rec, ''); })
                .catch(function (err) { b.textContent = st.name; toast(String(err && err.message || 'Could not move it in GoHighLevel')); });
            };
          });
        }
        draw(opp ? opp.pipelineId : (pipes[0] && pipes[0].id));
      }).catch(function () { pop.innerHTML = '<span class="d-muted">Could not reach GoHighLevel.</span>'; });
    };
    wrap.querySelector('[data-a="del"]').onclick = function () {
      api('/api/growth', 'PATCH', { id: rec.id, deleted: true }).then(function (x) {
        if (!x || !x.ok) throw 0;
        if (q) { q.splice(qi, 1); qi -= 1; }
        if (opts.onSaved) opts.onSaved(rec, 'deleted');
        toast('Deleted: ' + rec.name, function () { api('/api/growth', 'PATCH', { id: rec.id, deleted: false }).then(function () { if (opts.onSaved) opts.onSaved(); }); });
        go(1);
      }).catch(function () { toast('Could not delete that. Try again.'); });
    };
    wrap.querySelector('[data-a="lists"]').onclick = function () {
      close();
      try { window.STATE.peopleTab = 'lists'; } catch (e) {}
      if (typeof window.switchView === 'function') window.switchView('people');
      try { history.replaceState({}, '', '/lists'); } catch (e) {}
    };
    wrap.querySelector('[data-a="save"]').onclick = function () {
      var note = String(wrap.querySelector('#dsrNote').value || '').trim();
      var fu = wrap.querySelector('#dsrFu').value || '';
      if (!chosen && !note) { toast('Pick an outcome or write a note'); return; }
      var outcome = chosen;
      api('/api/growth', 'POST', { action: 'touch', id: rec.id, channel: ch === 'LinkedIn' ? 'LinkedIn' : ch, outcome: outcome, note: note, next_date: fu })
        .then(function (x) { if (!x || !x.ok) throw 0; return x.json(); })
        .then(function (res) {
          var tid = res && res.touch && res.touch.id;
          var stage = /Meeting booked/.test(outcome) ? 'Meeting booked' : /Interested|Replied|Spoke|Connected/.test(outcome) ? 'Engaged' : (/Not interested|Not a fit|Wrong number/.test(outcome) ? 'Not a fit' : ((!rec.stage || rec.stage === 'Cold') ? 'Contacted' : ''));
          if (stage) api('/api/growth', 'PATCH', { id: rec.id, stage: stage });
          toast('Saved: ' + rec.name + (outcome ? ' · ' + outcome : ''), function () { if (tid) api('/api/growth', 'POST', { action: 'undo-touch', touchId: tid }).then(function () { if (opts.onSaved) opts.onSaved(); }); });
          if (opts.onSaved) opts.onSaved(rec, outcome);
          go(1);
        })
        .catch(function () { toast('Could not save that. Try again.'); });
    };
  }
  window.openDossier = open;
})();
