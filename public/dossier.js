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
    + '#dsr .d-stgp .d-sl button{text-align:left}#dsr .d-stgp select{width:100%;background:#111216;color:#fff;border:1px solid #2a2c35;border-radius:8px;padding:5px;font:inherit}#dsr .d-pipe{background:#18191f;border:1px solid #2a2c35;border-radius:12px;padding:10px 12px;margin-bottom:14px;transition:box-shadow .3s}#dsr .d-pipe.flash{box-shadow:0 0 0 2px #ffa946}'
    + '#dsr .d-prow{display:flex;gap:8px;align-items:center;margin-bottom:8px}#dsr .d-prow select{flex:1;min-width:0;background:#111216!important;color:#fff!important;border:1px solid #2a2c35!important;border-radius:8px;padding:6px 8px;font:inherit;color-scheme:dark}'
    + '#dsr .d-now{font-size:12px;color:#c8d1ea;white-space:nowrap}#dsr .d-now b{color:#ffc98a}'
    + '#dsr .d-sl2{display:flex;flex-wrap:wrap;gap:6px}#dsr .d-sl2 button{font-size:11.5px;padding:5px 9px}#dsr .d-sl2 button.on{background:rgba(255,169,70,.18);border-color:#ffa946;color:#ffc98a}'
    + '#dsr .d-sl2 em{font-style:normal;font-size:10.5px;font-weight:800;margin-left:6px;color:#5ef0a8}#dsr .d-sendpk{margin-top:10px;width:100%;background:#00dc86!important;border-color:#00dc86!important;color:#03170d!important}'
    + '#dsr .d-nav{display:flex;align-items:center;gap:10px;padding:10px 16px;background:#0c0d11;border-bottom:1px solid #23252e;border-radius:16px 16px 0 0}#dsr .d-nav .d-pos{font-weight:800;color:#c8d1ea;white-space:nowrap}#dsr .d-nav .d-pos b{color:#fff}'
    + '#dsr .d-prog{flex:1;height:6px;border-radius:9px;background:#23252e;overflow:hidden}#dsr .d-prog i{display:block;height:100%;background:#00dc86;border-radius:9px}'
    + '#dsr .d-nav button{border-radius:999px;padding:7px 14px}#dsr .d-nav button.nx{background:#4272f9;border-color:#4272f9;max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
    + '#dsr .d-hl{color:#fff;font-weight:800;background:rgba(66,114,249,.24);border-radius:4px;padding:0 4px}#dsr .d-hg{color:#7ff0c2;font-weight:800}'
    + '#dsr li{font-size:13px;line-height:1.5}#dsr .d-chips{display:flex;flex-wrap:wrap;gap:5px;margin:4px 0 6px}#dsr .d-chips span{padding:4px 9px;border-radius:999px;font-size:11.5px;font-weight:800;background:rgba(255,72,102,.14);color:#ff8fa3}'
    + '#dsr .d-pills{display:flex;flex-wrap:wrap;gap:6px}#dsr .d-pills button{border-radius:999px}#dsr .d-sl2 button.pick{background:rgba(66,114,249,.22);border-color:#4272f9;color:#fff}'
    + '#dsr .d-scb{margin-left:6px;padding:3px 12px;font-size:11px;border-radius:999px;background:#4272f9!important;border-color:#4272f9!important;color:#fff}'
    + '#dsrScript{position:fixed;top:0;right:0;bottom:0;width:min(560px,100vw);z-index:2147482500;background:#0c0d11;border-left:1px solid #2a2c35;box-shadow:-20px 0 60px rgba(0,0,0,.55);overflow:auto;color:#e6eaf2;font:500 13.5px/1.55 Inter,-apple-system,system-ui,sans-serif;padding:0 0 30px}'
    + '#dsrScript .s-hd{position:sticky;top:0;display:flex;align-items:center;justify-content:space-between;padding:14px 20px;background:#0c0d11;border-bottom:1px solid #23252e}#dsrScript .s-hd b{font-size:16px;font-weight:900;color:#fff}'
    + '#dsrScript .s-hd button{font:inherit;font-size:12px;font-weight:800;padding:6px 14px;border-radius:999px;border:1px solid #2a2c35;background:#18191f;color:#fff;cursor:pointer}'
    + '#dsrScript .s-b{padding:4px 20px}#dsrScript h4{margin:18px 0 8px;font-size:10.5px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#7d859a}'
    + '#dsrScript .s-line{background:#15161c;border:1px solid #23252e;border-radius:12px;padding:11px 14px;margin:0 0 8px;font-size:15px;line-height:1.5;color:#fff}#dsrScript .s-line.q{border-color:rgba(66,114,249,.55);background:rgba(66,114,249,.1)}'
    + '#dsrScript .s-line small{display:block;font-size:10.5px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#9db9ff;margin-bottom:3px}'
    + '#dsrScript ul{margin:0;padding-left:16px}#dsrScript li{margin:4px 0;list-style:disc}#dsrScript li b{color:#fff}#dsrScript .s-n{color:#7ff0c2;font-weight:900}#dsrScript .s-src{color:#7d859a;font-size:11.5px}'
    + '#dsrScript .s-bn{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:0 0 6px}#dsrScript .s-bn div{background:#15161c;border:1px solid #23252e;border-radius:10px;padding:8px 10px;font-size:12.5px}#dsrScript .s-bn div i{display:block;font-style:normal;font-size:10px;font-weight:800;letter-spacing:.1em;color:#7d859a}#dsrScript .s-bn div.n{border-color:rgba(255,72,102,.45)}#dsrScript .s-bn div.n i{color:#ff8fa3}'
    + '#dsr a.d-src{color:#9db9ff;font-weight:800;font-size:11px;text-decoration:none;border:1px solid rgba(66,114,249,.4);border-radius:999px;padding:0 7px;margin-left:4px;white-space:nowrap}#dsr a.d-src:hover{background:rgba(66,114,249,.2)}'
    + '#dsr .d-tm{display:flex;align-items:center;justify-content:space-between;gap:10px;background:#18191f;border:1px solid #2a2c35;border-radius:10px;padding:7px 10px;margin-bottom:6px}#dsr .d-tm b{display:block;font-size:13px}#dsr .d-tm small{display:block;color:#aeb6c8;font-size:11.5px}'
    + '#dsr .d-tm a{color:#fff;background:#0a66c2;border-radius:999px;padding:4px 12px;font-weight:800;font-size:11.5px;text-decoration:none;white-space:nowrap}'
    + '#dsr .d-ed{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:6px 0 4px}#dsr .d-ed label{display:block;font-size:10.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#7d859a}'
    + '#dsr .d-ed input{width:100%;background:#18191f;border:1px solid #2a2c35;border-radius:8px;color:#fff;font:inherit;font-size:13px;padding:7px 9px;margin-top:3px}#dsr .d-ed .w{grid-column:span 2}'
    + '#dsr .d-intel{display:grid;grid-template-columns:1fr;gap:4px}#dsr .d-intel div{display:grid;grid-template-columns:118px 1fr;gap:8px;font-size:12.5px;align-items:baseline}#dsr .d-intel i{font-style:normal;color:#7d859a;font-weight:800;font-size:11px;text-transform:uppercase;letter-spacing:.06em}#dsr .d-intel span{color:#fff}#dsr .d-intel span.warn{color:#ff8fa3;font-weight:800}'
    + '@media(max-width:820px){#dsr .d-mid{grid-template-columns:1fr}#dsr .d-lft{border-right:0}}';
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
  /* Point form: long research text split into short bullets, filler labels dropped, key words highlighted. Nothing is cut. */
  var HL = /(FINTRAC|BCFSA|FSRA|CIRO|OSFI|FCAC|BC MSA|\bMSA\b|PIPA|transaction record|evidence layer|(?:manual |file )?reconstruction|trust accounts?|design partner|pilot|redacted [a-z]+ journey|workflow assessment|warm introduction|\$[\d.,]+\s?[KMB]?\+?|\d+(?:\.\d+)?%|\b\d+\/\d+\b|(?<!&)#\d+)/gi;
  function hl(text) { return esc(text).replace(HL, '<span class="d-hl">$1</span>'); }
  function points(v) {
    var t = String(v == null ? '' : v).trim();
    var label = '';
    var m = t.match(/^(?:hypothesis \(not verified\)|unverified hypothesis)\s*:\s*(?:unverified hypothesis\s*:\s*)?/i);
    if (m) { label = 'Unverified'; t = t.slice(m[0].length); }
    t = t.replace(/^first-call judgement\s*:\s*/i, '')
      .replace(/Oct;\s*13\s*B\.C;\s*MSA/g, 'Oct 13 B.C. MSA')
      .replace(/existing relationship or local workflow access takes priority/gi, 'priority: existing relationship or local access')
      .replace(/They appear to have enough operating structure to feel the pain but /gi, 'Big enough to feel the pain, but ')
      .replace(/\bcurrently notes\b/gi, 'notes');
    function tidy(x) {
      return x.replace(/^Use the public signal as the reason for the call:\s*/i, 'Signal: ')
        .replace(/^Connect (.+?) into one transaction record/i, 'One transaction record: $1')
        .replace(/^Explore whether 4orm can add (.+?) without replacing existing ([a-z ]+?) tools/i, 'Add $1, keeping their $2 tools')
        .replace(/^Workflow fit (\d)/i, 'Workflow $1');
    }
    return t.split(/;\s+|\.\s+(?=[A-Z0-9])/).map(function (x) { return tidy(x.replace(/[\s.;]+$/, '').trim()); }).filter(Boolean)
      .map(function (x, i) { return [i === 0 ? label : '', x.charAt(0).toUpperCase() + x.slice(1)]; });
  }
  var SRC = {};
  function norm(t) { return String(t || '').toLowerCase().replace(/[^a-z0-9$%]+/g, ' ').trim(); }
  function srcFor(x) {
    var full = norm((x[0] ? x[0] + ': ' : '') + x[1]), bare = norm(x[1]);
    return SRC[full] || SRC[bare] || null;
  }
  function srcLink(src) { return src ? ' <a class="d-src" href="' + esc(src.url) + '" target="_blank" rel="noopener" title="' + esc(src.title || src.url) + '">Source</a>' : ''; }
  function bullets(rows, withLabel) {
    if (!rows.length) return '';
    var li = [];
    rows.forEach(function (x) {
      var src = srcFor(x), n0 = li.length;
      var lab = withLabel ? String(x[0] || '') : '';
      if (/driver/i.test(lab)) { li.push('<li style="list-style:none;margin-left:-16px"><div class="d-chips">' + String(x[1]).split(/\s*,\s*/).filter(Boolean).map(function (d) { return '<span>' + esc(d) + '</span>'; }).join('') + '</div></li>'); return; }
      var pts = points(x[1]), score = [];
      function flush() { if (score.length) { li.push('<li><b>Fit:</b> ' + score.map(hl).join(' · ') + '</li>'); score = []; } }
      pts.forEach(function (pt, i) {
        var v = pt[1];
        if (/^[A-Za-z][\w ]{0,28} \d+\/\d+(?: weighted \d+%)?$/.test(v)) { score.push(v.charAt(0).toLowerCase() + v.slice(1)); return; }
        flush();
        var l2 = i === 0 ? (lab || pt[0]) : pt[0];
        var m2 = !l2 && v.match(/^([A-Z][\w /'-]{1,26}):\s+(.+)$/);
        if (m2) { l2 = m2[1]; v = m2[2].charAt(0).toUpperCase() + m2[2].slice(1); }
        li.push('<li>' + (l2 ? '<b' + (/next step|ask|signal/i.test(l2) ? ' class="d-hg"' : '') + '>' + esc(l2) + ':</b> ' : '') + hl(v) + '</li>');
      });
      flush();
      if (src && li.length > n0) li[li.length - 1] = li[li.length - 1].replace(/<\/li>$/, srcLink(src) + '</li>');
    });
    return '<ul>' + li.join('') + '</ul>';
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
    var EN = (rec.data && rec.data.enrich) || null;
    SRC = {};
    ((EN && EN.sources) || []).forEach(function (x) { if (x && x.text && x.url) SRC[norm(x.text)] = x; });
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

    /* The summarised intel from every source list (data.intel) wins when it is there. */
    var I = rec.data && rec.data.intel;
    var questions = [];
    if (I && typeof I === 'object') {
      var two = function (a) { return (a || []).map(function (x) { var m = String(x).match(/^([^:]{1,32}):\s+(.+)$/); return m ? [m[1], m[2]] : ['', String(x)]; }); };
      if (I.location) place = I.location;
      if (I.industry) industry = I.industry;
      if (I.pain_score != null) pain = Number(I.pain_score);
      if ((I.why || []).length) why = two(I.why);
      painRows = two(I.pain);
      if ((I.fit || []).length) fit = two(I.fit);
      if ((I.backed || []).length) backed = two(I.backed);
      opener = I.opener ? [['', I.opener]] : opener;
      if ((I.people || []).length) peopleRows = two(I.people);
      intel = two(I.intel);
      questions = two(I.questions);
    }
    var touches = rec.touches || [];
    var stage = rec.stage || 'Cold', ghl = (rec.data && rec.data.ghl && rec.data.ghl.stage) || '';
    var q = opts && opts.queue ? opts.queue : null, qi = q ? q.indexOf(rec.id) : -1;
    var chipCls = ch === 'Call' ? 'c' : ch === 'LinkedIn' ? 'l' : 'e';

    var nav = '';
    if (q && q.length > 1) {
      var nextName = opts.names && q[qi + 1] ? opts.names[q[qi + 1]] : '';
      nav = '<div class="d-nav"><button type="button" data-a="prev"' + (qi > 0 ? '' : ' disabled style="opacity:.4"') + '>Back</button><span class="d-pos"><b>' + (qi + 1) + ' of ' + q.length + '</b>' + (opts.group ? ' · ' + esc(opts.group) : '') + '</span>'
        + '<span class="d-prog"><i style="width:' + Math.round((qi + 1) / q.length * 100) + '%"></i></span>'
        + (qi < q.length - 1 ? '<button type="button" class="nx" data-a="skip">Next' + (nextName ? ': ' + esc(nextName) : '') + '</button>' : '<button type="button" disabled style="opacity:.5">Last one</button>')
        + '<button type="button" data-a="close">Close</button></div>';
    }
    var h = '<div class="d-bx">' + nav + '<div class="d-top"><div><span class="d-chip ' + chipCls + '">' + esc(ch === 'LinkedIn' ? 'LinkedIn in GoHighLevel' : ch) + '</span>'
      + '<span class="d-chip">' + esc(meta[0]) + '</span>' + (rec.priority ? '<span class="d-chip">' + esc(rec.priority) + (rec.score ? ' · score ' + esc(rec.score) : '') + '</span>' : '')
      + '<span class="d-stg"><button type="button" class="d-stgb" data-a="stages">Stages: ' + esc(ghl || stage) + '</button></span>'
      + (ch === 'Call' ? '<button type="button" class="d-scb" data-a="script">Script</button>' : '') + '</div>'
      + '<span class="d-q">' + (rec.last_touch ? 'Last touch ' + esc(new Date(rec.last_touch).toLocaleDateString('en-CA', { timeZone: 'America/Vancouver' })) : 'Never touched') + '</span></div>'
      + '<div class="d-mid"><div class="d-lft">'
      + '<div id="dsrHead">'
      + '<div style="display:flex;align-items:center;gap:10px"><h2>' + esc(rec.name) + '</h2><button type="button" data-a="edit" style="padding:3px 12px;font-size:11px;border-radius:999px">Edit</button></div><div class="d-who">' + esc([person && person !== rec.name ? person : '', role, place, industry].filter(Boolean).join(' · ')) + '</div>'
      + (phone ? '<div class="d-tel"><a href="tel:' + esc(phone) + '">' + esc(String(rec.phone).split(/\s*[;/]\s*/)[0]) + '</a></div>' : '<div style="height:10px"></div>')
      + '<div class="d-links">' + (li ? '<a href="' + esc(li) + '" target="_blank" rel="noopener">LinkedIn</a>' : '') + (rec.email ? '<a href="mailto:' + esc(rec.email) + '">' + esc(rec.email) + '</a>' : '')
      + (form ? '<a href="' + esc(form) + '" target="_blank" rel="noopener">Contact form</a>' : '') + (web ? '<a href="' + esc(web) + '" target="_blank" rel="noopener">Website</a>' : '') + '</div></div>'
      + sec("Why we're reaching out", bullets(why, true))
      + sec('Pain', (pain != null ? '<div style="margin-bottom:4px"><span class="d-pain">' + [1, 2, 3, 4, 5].map(function (i) { return '<i' + (pain >= i * 20 - 10 ? ' class="on"' : '') + '></i>'; }).join('') + '</span><b>' + esc(pain) + ' / 100</b></div>' : '') + bullets(painRows, true))
      + sec('Why they fit', bullets(fit, true))
      + sec('What they have invested in', bullets(backed, false))
      + sec('Opening line', opener.length ? '<div class="d-open">' + esc(opener[0][1]) + '</div>' : '')
      + sec('Questions to ask', bullets(questions, false))
      + sec('People', bullets(peopleRows, false))
      + sec('Intel', bullets(intel, true))
      + sec(ch === 'Call' ? 'Log the call' : 'Outcome', '<div class="d-outs">' + (OUTS[ch] || OUTS.Email).map(function (o) { return '<button type="button" data-o="' + esc(o) + '">' + esc(o === 'Spoke' ? 'Talked' : o) + '</button>'; }).join('') + '</div>')
      + '</div><div class="d-rgt">'
      + '<div class="d-pipe" id="dsrPipe"><div class="d-k">Pipeline stage</div><div class="d-muted">Loading GoHighLevel…</div></div>'
      + '<div class="d-k" style="margin-top:10px">Notes</div><textarea id="dsrNote" placeholder="Type while you talk"></textarea>'
      + sec('Next touch', '<div class="d-pills" data-nt>' + [['Today', 0], ['Tomorrow', 1], ['This week', 3], ['Next week', 7]].map(function (x) { return '<button type="button" data-days="' + x[1] + '">' + x[0] + '</button>'; }).join('') + '<input type="date" id="dsrFu" style="margin-left:4px"></div>')
      + sec('Open', '<div class="d-pills">' + (rec.email ? '<button type="button" data-a="email">Email</button>' : '') + (li ? '<button type="button" data-a="li">LinkedIn</button>' : '') + '<button type="button" data-a="space">Space</button>'
        + (rec.data && rec.data.contactId ? '<button type="button" disabled style="opacity:.6">In Contacts</button>' : '<button type="button" data-a="addc">Add to Contacts</button>') + '</div>')
      + sec('Company intel', (EN && ((EN.intel && Object.keys(EN.intel).length) || (EN.notes || []).length)) ? (function () {
          var LBL = [['penalties', 'Past penalties'], ['president', 'President'], ['ceo', 'CEO'], ['coo', 'COO'], ['cto', 'CTO'], ['cco', 'CCO'], ['founded', 'Founded'], ['years', 'Years in business'], ['agents', 'Agents'], ['size', 'Size'], ['licence', 'Licence']];
          return '<div class="d-intel">' + LBL.filter(function (k) { return EN.intel && EN.intel[k[0]]; }).map(function (k) {
            var v = EN.intel[k[0]];
            return '<div><i>' + esc(k[1]) + '</i><span' + (k[0] === 'penalties' && !/^(none|no )/i.test(v.value) ? ' class="warn"' : '') + '>' + esc(v.value) + (v.url ? ' <a class="d-src" href="' + esc(v.url) + '" target="_blank" rel="noopener">Source</a>' : '') + '</span></div>';
          }).join('') + '</div>'
            + ((EN.notes || []).length ? '<ul style="margin-top:6px">' + EN.notes.map(function (n) { return '<li>' + hl(n.text) + (n.url ? ' <a class="d-src" href="' + esc(n.url) + '" target="_blank" rel="noopener">Source</a>' : '') + '</li>'; }).join('') + '</ul>' : '');
        })() : '<div class="d-muted">Not researched yet.</div>')
      + sec('Leadership', (EN && (EN.website || (EN.team || []).length)) ? ((EN.website || web) ? '<div style="margin-bottom:6px"><a class="d-src" style="font-size:12.5px" href="' + esc(EN.website || web) + '" target="_blank" rel="noopener">' + esc(String(EN.website || web).replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')) + '</a></div>' : '')
          + (EN.team || []).map(function (p) { return '<div class="d-tm"><div><b>' + esc(p.name) + '</b><small>' + esc(p.title || '') + '</small></div>' + (p.linkedin ? '<a href="' + esc(p.linkedin) + '" target="_blank" rel="noopener">LinkedIn</a>' : '<span class="d-muted">No LinkedIn found</span>') + '</div>'; }).join('')
          + '<div class="d-muted" style="font-size:11px;margin-top:4px">Checked ' + esc(EN.checked || '') + '</div>'
        : '<div class="d-muted">Not researched yet.' + (web ? ' <a class="d-src" href="' + esc(web) + '" target="_blank" rel="noopener">Website</a>' : '') + '</div>')
      + (rec.notes ? sec('Earlier notes', '<div class="d-muted" style="white-space:pre-wrap">' + esc(String(rec.notes).slice(0, 1600)) + '</div>') : '')
      + sec('History', touches.length ? '<div class="d-hist">' + touches.slice(0, 8).map(function (t) {
        return '<div><small>' + esc(new Date(t.at).toLocaleString('en-CA', { timeZone: 'America/Vancouver', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })) + ' · ' + esc(t.channel || '') + '</small>' + esc([t.outcome, t.note].filter(Boolean).join(' · ')) + '</div>';
      }).join('') + '</div>' : '<div class="d-muted">No touches yet.</div>')
      + '</div></div>'
      + '<div class="d-acts">'
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

  /* Speed: the card, its GoHighLevel stage and the package list load at the same time, are kept for a
     couple of minutes, and the next two cards in the list load in the background, so Next is instant. */
  var C = { rec: {}, ghl: {}, pk: null, pkAt: 0 };
  function json(r) { return r && r.ok ? r.json() : null; }
  function getRec(id) { var c = C.rec[id]; if (!c || Date.now() - c.at > 120000) c = C.rec[id] = { at: Date.now(), p: api('/api/growth?id=' + encodeURIComponent(id)).then(json).catch(function () { delete C.rec[id]; return null; }) }; return c.p; }
  function getGhl(id) { var c = C.ghl[id]; if (!c || Date.now() - c.at > 120000) c = C.ghl[id] = { at: Date.now(), p: api('/api/growth?ghl=' + encodeURIComponent(id)).then(json).catch(function () { delete C.ghl[id]; return null; }) }; return c.p; }
  function getPk() { if (!C.pk || Date.now() - C.pkAt > 300000) { C.pkAt = Date.now(); C.pk = api('/api/processes?packages=1').then(json).catch(function () { C.pk = null; return null; }); } return C.pk; }
  function forget(id) { delete C.rec[id]; delete C.ghl[id]; }
  function prefetch(opts, id) {
    var q = opts && opts.queue; if (!q) return;
    var i = q.indexOf(id);
    [q[i + 1], q[i + 2], q[i - 1]].forEach(function (n) { if (n) { getRec(n); getGhl(n); } });
  }
  /* Script, on every call card: the opener and questions on top, then what changed, the pressure and what
     better workflows delivered (from the Business Pain and Value one-pager, reviewed 25 Sep 2026). */
  function scriptHtml(rec) {
    var L = function (lab, t, q) { return '<div class="s-line' + (q ? ' q' : '') + '">' + (lab ? '<small>' + esc(lab) + '</small>' : '') + esc(t) + '</div>'; };
    var BN = function (k, was, now) { return '<div style="font-weight:800;color:#fff;margin:8px 0 4px">' + esc(k) + '</div><div class="s-bn"><div><i>BEFORE</i>' + esc(was) + '</div><div class="n"><i>NOW</i>' + esc(now) + '</div></div>'; };
    return '<div class="s-hd"><b>Script · ' + esc(rec.name || '') + '</b><button type="button" data-sx>Close</button></div><div class="s-b">'
      + '<h4>Open</h4>'
      + L('', 'Would you reward me for my honesty about this being a cold call?', true)
      + L('', "My name's Chad, I am with 4orm Finance. This is not a sales call. We are currently developing 4ormIQ to help financial business clients show and understand suitability while helping protect the business from increased fines and work load to stay compliant.")
      + L('', "As you know, the risk and liability of new suitability mandates falls on the business. We are asking, agents have more documents, more administrative work, but how can a business show suitability when they can't show what their client's understanding about suitability is?")
      + L('', 'We have a unique approach leveraging counselling styled AI to help clients better understand their decisions. Our greatest asset will be in building it alongside specific experts in the space. We are only looking to partner with 2-3 firms for design advisory.')
      + '<h4>Ask</h4>'
      + L('', 'Would there be anything holding you back from exploring this further with you and your firm?', true)
      + L('', 'Would you say intake or post admin work is more challenging now?', true)
      + L('', 'How do you recreate the evidence needed in the event of an audit?', true)
      + '<h4>What changed</h4>'
      + BN('Mortgage AML duties', 'Mortgage brokers, lenders and administrators were not FINTRAC reporting entities', 'Since Oct 11, 2024: compliance program, training, records and reporting, even when the lender does it too')
      + BN('FINTRAC penalties', 'Up to C$500K per very serious violation', 'Up to C$20M per very serious violation, 40x higher')
      + BN('B.C. mortgage rules', 'Mortgage Brokers Act', 'Mortgage Services Act from Oct 13, 2026: brokerage penalties up to C$500K (C$250K for individuals)')
      + BN('Suitability files (Ontario)', '85% of private mortgage files lacked a documented suitability assessment', '100% lacked one')
      + '<h4>The pressure on firms</h4><ul>'
      + '<li><span class="s-n">94%</span> of Canadian firms say compliance got <b>more complex</b> in 3 years <span class="s-src">PwC 2025</span></li>'
      + '<li>Compliance costs <span class="s-n">+81%</span>: C$416M to C$753M, 2022 to 2024, 24 P&amp;C insurers <span class="s-src">IBC</span></li>'
      + '<li><span class="s-n">+26%</span> more <b>full-time compliance staff</b> needed, same insurers <span class="s-src">IBC</span></li>'
      + '<li><span class="s-n">47%</span> of 1,637 mortgage respondents: yes/no income checks <b>not enough</b>, they want verified documents <span class="s-src">CRA</span></li>'
      + '<li>Most common dealer gap: policies <b>not detailed or business-specific</b> enough <span class="s-src">CIRO, client-focused reforms</span></li>'
      + '</ul><h4>What better workflows delivered</h4><ul>'
      + '<li><b>Key Group</b> (UK): quality reviews <span class="s-n">90 to 15 min</span> a case, 100% coverage, no extra staff <span class="s-src">Aveni</span></li>'
      + '<li><b>Connective</b> (AU mortgage network): audit <span class="s-n">4-5 months to 5 weeks</span>, lender answers 2.5-3 hours to ~30 seconds <span class="s-src">Drata</span></li>'
      + '<li><b>Attivo</b> (UK planning): file-checking costs <span class="s-n">-40%</span> in a year, planner capacity <span class="s-n">+30%</span> <span class="s-src">Recordsure</span></li>'
      + '<li><b>KBH</b> (Canada): <span class="s-n">1 hour</span> a day back per employee, 30,000 pages not printed <span class="s-src">Docusign</span></li>'
      + '<li><b>Desjardins</b> (Canada): costs <span class="s-n">-10%+</span> over 4 years, recommendation score <span class="s-n">+11</span>, online sales 25% to ~40% <span class="s-src">Bain</span></li>'
      + '</ul><div class="s-src" style="margin-top:12px">Case studies are supplier or consultant reported, not 4orm results or guaranteed savings. Surveys cover their stated respondents. Reviewed 25 Sep 2026.</div>'
      + '</div>';
  }
  function openScript(rec) {
    var el = document.getElementById('dsrScript');
    if (el) { el.remove(); return; }
    el = document.createElement('div'); el.id = 'dsrScript';
    el.innerHTML = scriptHtml(rec);
    document.body.appendChild(el);
    el.querySelector('[data-sx]').onclick = function () { el.remove(); };
  }
  window.dossierPrefetch = function (id) { if (id) { getRec(id); getGhl(id); getPk(); } };
  function open(id, opts) {
    opts = opts || {};
    mount();
    wrap.innerHTML = '<div class="d-bx" style="padding:30px;color:#aeb6c8">Loading the card…</div>';
    wrap.classList.add('open');
    getGhl(id); getPk();
    getRec(id).then(function (rec) {
      if (!rec || !rec.id) { wrap.innerHTML = '<div class="d-bx" style="padding:30px">Could not load this contact. <button data-a="close">Close</button></div>'; bindClose(); return; }
      wrap.innerHTML = render(rec, opts);
      bind(rec, opts);
      prefetch(opts, rec.id);
    }).catch(function () { wrap.innerHTML = '<div class="d-bx" style="padding:30px">Could not load this contact. <button data-a="close">Close</button></div>'; bindClose(); });
  }
  function close() { wrap.classList.remove('open'); wrap.innerHTML = ''; var sc = document.getElementById('dsrScript'); if (sc) sc.remove(); }
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
    var pbox = wrap.querySelector('#dsrPipe');
    if (sb) sb.onclick = function (e) {
      e.stopPropagation();
      if (pbox) { pbox.scrollIntoView({ behavior: 'smooth', block: 'center' }); pbox.classList.add('flash'); setTimeout(function () { pbox.classList.remove('flash'); }, 900); }
    };
    /* Pipeline stage, on every card: where they sit in GoHighLevel, every stage of that pipeline, which stages carry a package.
       Moving onto a package stage asks first and shows exactly what goes out; the current stage's package can be sent again. */
    var PK = {}, picked = '';
    function paintPipe() {
      if (!pbox) return;
      Promise.all([
        getGhl(rec.id),
        getPk()
      ]).then(function (res) {
        var g = res[0]; PK = {};
        ((res[1] && res[1].packages) || []).forEach(function (p) { if (p.active) PK[p.stageId] = p; });
        if (!g || !g.connected) { pbox.innerHTML = '<div class="d-k">Pipeline stage</div><div class="d-muted">GoHighLevel is not connected.</div>'; return; }
        var opp = (g.opps || [])[0] || null, pipes = g.pipelines || [];
        function draw(pipeId) {
          var pipe = pipes.filter(function (x) { return x.id === pipeId; })[0] || pipes[0];
          if (!pipe) { pbox.innerHTML = '<div class="d-k">Pipeline stage</div><div class="d-muted">No pipelines in GoHighLevel yet.</div>'; return; }
          var cur = opp && opp.pipelineId === pipe.id ? opp.stageId : '';
          var curPk = cur && PK[cur];
          pbox.innerHTML = '<div class="d-k">Pipeline stage</div>'
            + '<div class="d-prow"><select data-pp>' + pipes.map(function (x) { return '<option value="' + esc(x.id) + '"' + (x.id === pipe.id ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('') + '</select>'
            + '<span class="d-now">' + (cur ? 'Now: <b>' + esc(opp.stage || '') + '</b>' : (opp ? 'In ' + esc(opp.pipeline || 'another pipeline') + ' at ' + esc(opp.stage || '?') : 'Not in a pipeline yet')) + '</span></div>'
            + '<div class="d-sl2">' + (pipe.stages || []).map(function (st) {
              return '<button type="button" data-sid="' + esc(st.id) + '" class="' + (cur === st.id ? 'on' : '') + (picked === st.id ? ' pick' : '') + '">' + esc(st.name) + (PK[st.id] ? '<em>pack</em>' : '') + '</button>';
            }).join('') + '</div>'
            + '<button type="button" class="d-sendpk" data-sendpk>' + esc(moveLabel()) + '</button>'
            + '<div class="d-muted" style="margin-top:6px;font-size:11.5px">Pick a stage, then move. Stages marked pack send their email after you confirm.</div>';
          function moveLabel() {
            var ps = picked && (pipe.stages || []).filter(function (x) { return x.id === picked; })[0];
            if (ps) return 'Move to ' + ps.name + (PK[ps.id] ? ' and send pack' : '');
            if (curPk) return 'Send the ' + (opp.stage || 'stage') + ' pack';
            return 'Move and send pack';
          }
          pbox.querySelector('[data-pp]').onchange = function () { picked = ''; draw(this.value); };
          pbox.querySelectorAll('[data-sid]').forEach(function (b) {
            b.onclick = function () {
              var sid = b.getAttribute('data-sid');
              picked = (picked === sid || cur === sid) ? '' : sid;
              draw(pipe.id);
            };
          });
          function doMove(b) {
            var st = (pipe.stages || []).filter(function (x) { return x.id === picked; })[0];
            if (!st) return;
            var label = b.textContent; b.textContent = 'Checking…';
            (window.stageGate ? window.stageGate(rec.id, st) : Promise.resolve({ send: false })).then(function (g8) {
              if (!g8) { b.textContent = label; return; }
              b.textContent = g8.send ? 'Moving and sending…' : 'Moving…';
              return api('/api/growth', 'POST', { action: 'ghl-move', id: rec.id, pipelineId: pipe.id, stageId: st.id, stageName: st.name, opportunityId: opp && opp.pipelineId === pipe.id ? opp.id : (opp ? opp.id : ''), send: !!g8.send })
                .then(function (x) { return x.json().then(function (j) { if (!x.ok) throw new Error(j.error || 'GoHighLevel did not move it'); return j; }); })
                .then(function (j) {
                  if (sb) sb.textContent = 'Stages: ' + st.name;
                  var s8 = j && j.sent;
                  toast('Moved in GoHighLevel: ' + st.name + (s8 ? (s8.ok ? '. Sent to ' + s8.to : '. Not sent: ' + (s8.note || 'GoHighLevel refused')) : ''));
                  opp = { id: j.opportunityId || (opp && opp.id) || '', pipelineId: pipe.id, pipeline: pipe.name, stageId: st.id, stage: st.name };
                  picked = '';
                  forget(rec.id);
                  draw(pipe.id);
                  if (opts.onSaved) opts.onSaved(rec, '');
                });
            }).catch(function (err) { b.textContent = label; toast(String(err && err.message || 'Could not move it in GoHighLevel')); });
          }
          var spb = pbox.querySelector('[data-sendpk]');
          if (spb) spb.onclick = function () {
            if (picked) { doMove(spb); return; }
            if (!curPk) { toast('Pick a stage first'); return; }
            var st = { id: cur, name: opp.stage || '' };
            (window.stageGate ? window.stageGate(rec.id, st, { sendOnly: true }) : Promise.resolve(null)).then(function (g8) {
              if (!g8 || !g8.send) return;
              spb.disabled = true; spb.textContent = 'Sending…';
              return api('/api/growth', 'POST', { action: 'send-package', id: rec.id, stageId: cur })
                .then(function (x) { return x.json().then(function (j) { if (!x.ok) throw new Error(j.error || 'Not sent'); return j; }); })
                .then(function (j) { toast('Sent to ' + (j.to || 'them') + ': ' + (j.subject || '')); spb.textContent = 'Sent'; if (opts.onSaved) opts.onSaved(rec, ''); });
            }).catch(function (err) { spb.disabled = false; spb.textContent = 'Send the ' + (opp.stage || 'stage') + ' pack'; toast(String(err && err.message || 'Not sent')); });
          };
        }
        draw(opp ? opp.pipelineId : (pipes[0] && pipes[0].id));
      }).catch(function () { pbox.innerHTML = '<div class="d-k">Pipeline stage</div><div class="d-muted">Could not reach GoHighLevel.</div>'; });
    }
    paintPipe();
    /* Edit the basics on the card: name, contact person and role, phone, email, website, LinkedIn, city. Saved fields are kept through re-imports. */
    var edb = wrap.querySelector('[data-a="edit"]');
    if (edb) edb.onclick = function () {
      var head = wrap.querySelector('#dsrHead');
      var parts = String(rec.contact || '').split(/\s*\|\s*/);
      var F = [['name', 'Name', rec.name, 1], ['person', 'Contact person', /@|^\+?\d/.test(parts[0] || '') ? '' : (parts[0] || '')], ['role', 'Role', rec.title || parts[1] || ''],
        ['phone', 'Phone', rec.phone], ['email', 'Email', rec.email], ['website', 'Website', rec.website], ['linkedin', 'LinkedIn', rec.linkedin], ['city', 'City', rec.city], ['prov', 'Province', rec.prov]];
      head.innerHTML = '<div class="d-ed">' + F.map(function (f) { return '<div' + (f[3] ? ' class="w"' : '') + '><label>' + esc(f[1]) + '<input data-f="' + f[0] + '" value="' + esc(f[2] || '') + '"></label></div>'; }).join('') + '</div>'
        + '<div style="display:flex;gap:8px;justify-content:flex-end;margin-bottom:6px"><button type="button" data-ex="cancel">Cancel</button><button type="button" class="pri" data-ex="save">Save details</button></div>';
      head.querySelector('[data-ex="cancel"]').onclick = function () { open(rec.id, opts); };
      head.querySelector('[data-ex="save"]').onclick = function () {
        var v = {}; head.querySelectorAll('[data-f]').forEach(function (i) { v[i.getAttribute('data-f')] = i.value.trim(); });
        if (!v.name) { toast('The name cannot be empty'); return; }
        var rest = parts.slice(2).filter(function (x) { return x && x !== v.phone && x !== v.email; });
        var body = { id: rec.id, name: v.name, title: v.role, phone: v.phone, email: v.email, website: v.website, linkedin: v.linkedin, city: v.city, prov: v.prov,
          contact: [v.person, v.role].concat(rest).filter(Boolean).join(' | ') };
        this.disabled = true; this.textContent = 'Saving…';
        api('/api/growth', 'PATCH', body).then(function (x) { if (!x || !x.ok) throw 0; forget(rec.id); toast('Saved: ' + v.name); if (opts.onSaved) opts.onSaved(rec, ''); open(rec.id, opts); })
          .catch(function () { toast('Could not save those details. Try again.'); open(rec.id, opts); });
      };
      var first = head.querySelector('[data-f="phone"]'); if (first) first.focus();
    };
    var scb = wrap.querySelector('[data-a="script"]');
    if (scb) scb.onclick = function (e) { e.stopPropagation(); openScript(rec); };
    var oldS = document.getElementById('dsrScript'); if (oldS) { oldS.innerHTML = scriptHtml(rec); oldS.querySelector('[data-sx]').onclick = function () { oldS.remove(); }; }
    wrap.querySelectorAll('[data-days]').forEach(function (b) {
      b.onclick = function () {
        var fu = wrap.querySelector('#dsrFu');
        fu.value = new Date(Date.now() + Number(b.getAttribute('data-days')) * 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Vancouver' });
        wrap.querySelectorAll('[data-days]').forEach(function (x) { x.classList.toggle('on', x === b); });
      };
    });
    var em = wrap.querySelector('[data-a="email"]');
    if (em) em.onclick = function () {
      var person = String(rec.contact || '').split(/\s*\|\s*/)[0];
      if (typeof window.openComposeTo === 'function') { close(); window.openComposeTo(rec.email, /@|^\+?\d/.test(person) ? rec.name : person); }
      else location.href = 'mailto:' + encodeURIComponent(rec.email);
    };
    var lk = wrap.querySelector('[data-a="li"]');
    if (lk) lk.onclick = function () { window.open(url(rec.linkedin), '_blank', 'noopener'); };
    var spc = wrap.querySelector('[data-a="space"]');
    if (spc) spc.onclick = function () {
      spc.textContent = 'Finding…';
      api('/api/spaces').then(function (r) { return r && r.ok ? r.json() : null; }).then(function (j) {
        var nm = String(rec.name || '').toLowerCase();
        var person = String(rec.contact || '').split(/\s*\|\s*/)[0].toLowerCase();
        var hit = ((j && j.spaces) || []).filter(function (x) { var n = String(x.name || '').toLowerCase(); return n && (n === nm || n === person || (nm.length > 4 && n.indexOf(nm) >= 0)); })[0];
        spc.textContent = 'Space';
        if (!hit) { toast('No Space for ' + rec.name + ' yet'); return; }
        close();
        if (typeof window.switchView === 'function') window.switchView('work');
        try { history.replaceState({}, '', '/spaces'); } catch (e) {}
        var act = window.deskActions && window.deskActions['space-open'];
        if (act) { var tag = document.createElement('span'); tag.setAttribute('data-id', hit.id); act(tag, document); }
      }).catch(function () { spc.textContent = 'Space'; toast('Could not reach Spaces'); });
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
    var addc = wrap.querySelector('[data-a="addc"]');
    if (addc) addc.onclick = function () {
      addc.disabled = true; addc.textContent = 'Adding…';
      window.addToContacts(rec.id, rec.name, function (ok) {
        if (ok) { rec.data = rec.data || {}; rec.data.contactId = ok; var sp = document.createElement('span'); sp.className = 'd-muted'; sp.style.cssText = 'align-self:center;font-size:12px'; sp.textContent = 'In Contacts'; addc.replaceWith(sp); }
        else { addc.disabled = false; addc.textContent = 'Add to Contacts'; }
      }, toast);
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
          forget(rec.id);
          var stage = /Meeting booked/.test(outcome) ? 'Meeting booked' : /Interested|Replied|Spoke|Connected/.test(outcome) ? 'Engaged' : (/Not interested|Not a fit|Wrong number/.test(outcome) ? 'Not a fit' : ((!rec.stage || rec.stage === 'Cold') ? 'Contacted' : ''));
          if (stage) api('/api/growth', 'PATCH', { id: rec.id, stage: stage });
          toast('Saved: ' + rec.name + (outcome ? ' · ' + outcome : ''), function () { if (tid) api('/api/growth', 'POST', { action: 'undo-touch', touchId: tid }).then(function () { if (opts.onSaved) opts.onSaved(); }); });
          if (opts.onSaved) opts.onSaved(rec, outcome);
          if (/Spoke|Interested|Meeting booked|Replied/.test(outcome) && !(rec.data && rec.data.contactId)) window.offerAddToContacts(rec.id, rec.name);
          go(1);
        })
        .catch(function () { toast('Could not save that. Try again.'); });
    };
  }
  window.openDossier = open;

  /* Add to Contacts: a list record becomes a real contact once there is a conversation. Undo removes the contact it made. */
  window.addToContacts = function (id, name, done, say) {
    var t = say || toast;
    api('/api/growth', 'POST', { action: 'add-contact', id: id })
      .then(function (x) { return x.json().then(function (j) { if (!x.ok || !j.ok) throw 0; return j; }); })
      .then(function (j) {
        try { window.__listsContactsCache = null; } catch (e) {}
        if (j.created) t('Added to Contacts: ' + (name || ''), function () {
          api('/api/growth', 'POST', { action: 'undo-add-contact', id: id, contactId: j.contactId }).then(function () { t('Removed from Contacts'); });
        });
        else t((name || 'This person') + ' is already in Contacts');
        if (done) done(j.contactId);
      })
      .catch(function () { t('Could not add to Contacts. Try again.'); if (done) done(''); });
  };
  /* After a real conversation, offer it once in a toast. */
  window.offerAddToContacts = function (id, name) {
    var o = document.getElementById('dsrOffer');
    if (!o) { o = document.createElement('div'); o.id = 'dsrOffer'; o.style.cssText = 'position:fixed;left:50%;bottom:72px;transform:translateX(-50%);z-index:2147483001;background:#111216;color:#fff;border:1px solid #2a2c35;border-radius:10px;padding:9px 14px;font:600 13px Inter,system-ui,sans-serif;display:none;gap:12px;align-items:center;box-shadow:0 12px 30px rgba(0,0,0,.5)'; document.body.appendChild(o); }
    o.innerHTML = '<span></span><button type="button" style="font:inherit;font-weight:800;color:#00dc86;background:none;border:0;cursor:pointer">Add to Contacts</button><button type="button" style="font:inherit;font-weight:700;color:#aeb6c8;background:none;border:0;cursor:pointer">Not now</button>';
    o.firstChild.textContent = 'You had a conversation with ' + (name || 'them') + '.';
    o.style.display = 'flex';
    var b = o.querySelectorAll('button');
    b[0].onclick = function () { o.style.display = 'none'; window.addToContacts(id, name); };
    b[1].onclick = function () { o.style.display = 'none'; };
    clearTimeout(o._h); o._h = setTimeout(function () { o.style.display = 'none'; }, 12000);
  };
})();
