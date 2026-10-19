/* Part B pages: pipeline / spaces / documents / links / email.
   ONE render path: data = fixtureOn() ? REDESIGN_FIXTURE.page : live*State(). */
(function () {
  function P() { return window.__port || {}; }
  function fixtureOn() { return P().fixtureOn ? P().fixtureOn() : false; }
  function wrapOf(id) { return P().wrapOf ? P().wrapOf(id) : null; }
  function whenCss(fn) { if (P().whenCss) P().whenCss(fn); else fn(); }
  function markReady(id) { if (P().markReady) P().markReady(id); }
  function esc(s) { return P().esc ? P().esc(s) : String(s == null ? '' : s); }
  function asList(v) { return P().asList ? P().asList(v) : (Array.isArray(v) ? v : []); }
  function liveLog(page, extra) { if (P().liveLog) P().liveLog(page, extra); }
  function initials(name) { return P().initials ? P().initials(name) : '?'; }
  function ageLabel(ms) { return P().ageLabel ? P().ageLabel(ms) : ''; }

  var C6 = ['#2e6bf2', '#12a36a', '#c98408', '#6b4fd8', '#e0364f', '#0f9fb5'];
  var NA = { docs: ['na-docs', 'Add docs'], send: ['na-send', 'Send today'], ppl: ['na-ppl', 'Add people'] };
  var CAT_CLS = { General: 'c-gen', 'Venture Capital': 'c-vc', Business: 'c-bus', Regulators: 'c-reg' };
  var COL_META = {
    needs_now: { icon: '&#9888;&#65039;', name: 'Needs now', rule: 'Real people owed a reply, investors first' },
    investors: { icon: '&#128176;', name: 'Investors', rule: 'Rule: from bruce@, don@ · subject has "cheque"' },
    vcs: { icon: '&#128200;', name: 'VCs', rule: 'Rule: sender in the VC pipeline' },
    prospects: { icon: '&#127919;', name: 'Prospects', rule: 'Rule: domain matches Pipeline › Business' },
    design: { icon: '&#129309;', name: 'Design partners', rule: 'Rule: domain is a brokerage in Spaces' },
    team: { icon: '&#128101;', name: 'Team', rule: 'Rule: @4ormfinance.com, Speer' },
    quiet: { icon: '&#128263;', name: 'Quiet', rule: 'Bulk + notifications, auto-filed', quiet: true }
  };

  function F() { return window.REDESIGN_FIXTURE || {}; }

  function heat(n) {
    n = Number(n) || 0;
    if (n >= 100) return 'h3';
    if (n >= 20) return 'h2';
    if (n >= 1) return 'h1';
    return '';
  }
  function ring(n) {
    var c = 2 * Math.PI * 14, d = c * n / 5;
    return '<div class="ring"><svg viewBox="0 0 34 34"><circle cx="17" cy="17" r="14" fill="none" stroke="#eef1f6" stroke-width="4"/><circle cx="17" cy="17" r="14" fill="none" stroke="' + (n >= 4 ? '#12a36a' : '#c98408') + '" stroke-width="4" stroke-dasharray="' + d + ' ' + c + '" stroke-linecap="round" transform="rotate(-90 17 17)"/></svg><b>' + n + '/5</b></div>';
  }
  function daysAgo(raw) {
    if (!raw) return 99;
    var n = typeof raw === 'number' ? raw : Date.parse(raw);
    if (!Number.isFinite(n) || n <= 0) return 99;
    if (n < 1e12) n *= 1000;
    return Math.round((Date.now() - n) / 86400000);
  }
  function spaceLabel(raw) {
    var s = String(raw || '').toLowerCase();
    if (/vc|venture|angel|invest/.test(s)) return 'Venture Capital';
    if (/regulat|gov|fintrac|bcfsa|csa/.test(s)) return 'Regulators';
    if (/business|broker|design|partner/.test(s)) return 'Business';
    return 'General';
  }
  function nextActionOf(p) {
    var ready = Number(p.docCount || (p.docs || []).length) >= 2;
    var people = Number(p.recipientCount || (p.recipients || []).length);
    if (ready && /send|ready/i.test(String(p.stage || ''))) return 'send';
    if (!people) return 'ppl';
    if (!ready) return 'docs';
    return 'send';
  }
  function docKind(d) {
    var mime = String((d && d.mime) || '').toLowerCase();
    var name = String((d && d.name) || '').toLowerCase();
    if (mime.indexOf('image/') === 0 || /\.(png|jpe?g|gif|webp)$/.test(name)) return 'img';
    if (/presentation|powerpoint/.test(mime) || /\.(ppt|pptx)$/.test(name)) return 'ppt';
    if (/spreadsheet|excel/.test(mime) || /\.(xls|xlsx|csv)$/.test(name)) return 'xls';
    if (mime.indexOf('pdf') >= 0 || /\.pdf$/.test(name)) return 'pdf';
    return 'doc';
  }
  function hostOf(url) {
    try {
      var u = String(url || '');
      if (!/^https?:/i.test(u)) u = 'https://' + u.replace(/^\/\//, '');
      return new URL(u).hostname.replace(/^www\./, '');
    } catch (e) { return String(url || '').replace(/^https?:\/\//, '').split('/')[0]; }
  }
  function absUrl(url) {
    var u = String(url || '').trim();
    if (!u) return '#';
    if (/^https?:/i.test(u)) return u;
    return 'https://' + u.replace(/^\/\//, '');
  }
  function isDriveUrl(url) {
    return /drive\.google\.com|docs\.google\.com|\/api\/documents\/file/i.test(String(url || ''));
  }
  function investorMail(row) {
    var blob = ((row.email || '') + ' ' + (row.from || '') + ' ' + (row.subject || '')).toLowerCase();
    return /bruce@|don@|bruce fair|\bcheque\b|\bfriends.?and.?family\b/.test(blob);
  }
  function mailColor(i) { return C6[i % C6.length]; }

  function pipelineData() { return fixtureOn() ? (F().pipeline || {}) : livePipelineState(); }
  function spacesData() { return fixtureOn() ? (F().spaces || {}) : liveSpacesState(); }
  function documentsData() { return fixtureOn() ? (F().documents || {}) : liveDocumentsState(); }
  function linksData() { return fixtureOn() ? (F().links || {}) : liveLinksState(); }
  function emailData() { return fixtureOn() ? (F().email || {}) : liveEmailState(); }

  function normCat(raw) {
    var s = String(raw || 'Other').trim();
    if (!s) return 'Other';
    if (/^vc$/i.test(s) || /venture\s*capital/i.test(s)) return 'VC';
    if (/regulat/i.test(s)) return 'Regulatory';
    if (/^ff$|friends/i.test(s)) return 'Friends & family';
    return s.replace(/\w\S*/g, function (w) {
      if (/^vc$/i.test(w)) return 'VC';
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    });
  }
  function spaceReadiness(p) {
    var docs = Number(p.docCount || 0);
    if (!docs && Array.isArray(p.docs)) docs = p.docs.filter(function (d) { return d && d.kind !== 'link'; }).length;
    var links = Number(p.linkCount || 0);
    if (!links && Array.isArray(p.docs)) links = p.docs.filter(function (d) { return d && d.kind === 'link'; }).length;
    if (!links && Array.isArray(p.links)) links = p.links.length;
    var people = Number(p.recipientCount || 0);
    if (!people && Array.isArray(p.recipients)) people = p.recipients.length;
    if (!people && Array.isArray(p.people)) people = p.people.length;
    var note = !!(String(p.notes || p.description || '').trim());
    var sent = /ready|sent|send/i.test(String(p.stage || p.status || ''));
    var n = 0;
    if (docs) n += 1;
    if (links) n += 1;
    if (people) n += 1;
    if (note) n += 1;
    if (sent) n += 1;
    return { n: n, docs: docs, links: links };
  }
  function senderName(row) {
    var email = String(row.email || '').toLowerCase();
    var people = asList((window.STATE || {}).contacts).concat(asList((window.STATE || {}).people));
    var hit = people.filter(function (c) {
      return String(c.email || '').toLowerCase() === email && c.name;
    })[0];
    if (hit && hit.name) return hit.name;
    var from = String(row.from || row.name || '').trim();
    var m = from.match(/^"?([^"<@][^"<]*)"?\s*</);
    if (m && m[1].trim()) {
      var named = m[1].trim();
      if (named.indexOf(' ') >= 0 || /[A-Z]/.test(named)) return named;
    }
    if (from && from.indexOf('@') < 0 && from.indexOf(' ') >= 0) return from;
    if (from && from.indexOf('@') < 0 && from !== from.toLowerCase()) return from;
    var local = (email.split('@')[0] || from.split('@')[0] || from).replace(/[._+\-]+/g, ' ').trim();
    return local.replace(/\b\w/g, function (c) { return c.toUpperCase(); }) || 'Sender';
  }
  function livePipelineState() {
    var S = window.STATE || {};
    var pipes = asList(S.ghlPipes).map(function (p) {
      var n = (p.stages || []).reduce(function (a, s) { return a + (Number(s.count) || 0); }, 0);
      return { id: p.id, name: p.name || 'Pipeline', n: n, stages: p.stages || [] };
    }).sort(function (a, b) { return b.n - a.n; });
    var sel = pipes.filter(function (p) { return p.id === S.ghlPipe; })[0] || pipes[0] || null;
    var pills = pipes.slice(0, 5).map(function (p, i) {
      return { name: p.name, n: p.n, on: sel ? p.id === sel.id : i === 0, id: p.id };
    });
    var stages = sel ? sel.stages : asList(S.pipeline).map(function (s) { return { name: s.stage || s.name || s.s, count: s.count || s.v }; });
    var funnel = stages.map(function (s) { return [s.name || s.s || 'Stage', Number(s.count != null ? s.count : s.v) || 0]; });
    if (!funnel.length) funnel = [['Storage', 0]];
    var contacts = asList(S.contacts);
    var needs = contacts.filter(function (c) { return daysAgo(c.lastTouch || c.last_touch) >= 14; }).slice(0, 5).map(function (c, i) {
      return { name: c.name || 'Person', color: C6[i % 6], meta: (c.category || c.type || 'Contact') + ' · cold' + (c.lastTouch || c.last_touch ? '' : ', no touch on record') };
    });
    var cats = {};
    contacts.forEach(function (c) {
      var cat = normCat(c.category || c.type || 'Other');
      if (!cats[cat]) cats[cat] = [0, 0, 0, 0, 0];
      var st = String(c.stage || '').toLowerCase();
      var ix = /meet|done/.test(st) ? 4 : /contact|replied/.test(st) ? 2 : /reach|send|email/.test(st) ? 1 : 0;
      if (/meeting/.test(st) && !/done/.test(st)) ix = 3;
      cats[cat][ix] += 1;
    });
    var matrix = Object.keys(cats).slice(0, 6).map(function (cat) { return { cat: cat, cells: cats[cat] }; });
    var rows = contacts.slice(0, 8).map(function (c) {
      var days = daysAgo(c.lastTouch || c.last_touch);
      var stage = c.ghlStage || c.stage || 'Storage';
      var warm = days <= 3 ? 'hot' : days <= 10 ? 'warm' : days >= 14 ? 'cold' : '';
      return [c.name || 'Person', c.company || '', normCat(c.category || c.type || ''), stage, warm, (days >= 99 ? '—' : days + 'd'), c.nextAction || c.next_action || 'Follow up'];
    });
    liveLog('pipeline', { pipes: pipes.length, contacts: contacts.length, funnel: funnel.length, rows: rows.length });
    return {
      pills: pills, more: Math.max(0, pipes.length - 5),
      kpis: [
        { n: String(sel ? sel.n : contacts.length || '—'), label: 'opportunities', note: sel ? ('in ' + sel.name) : 'from GoHighLevel', tone: 'nt' },
        { n: '—', label: 'sent this week', note: 'tracking starts next send', tone: 'nt' },
        { n: '—', label: 'open rate', note: 'tracking starts next send', tone: 'nt' },
        { n: '—', label: 'replies', note: 'none yet this week', tone: 'nt' },
        { n: '—', label: 'average time in a stage', note: '', tone: 'nt' }
      ],
      funnel: funnel,
      funnelLabel: (sel ? sel.name : 'Pipeline') + ' · ' + funnel.length + ' stages · click a stage to filter the list',
      needs: needs,
      matrix: matrix,
      activity: contacts.slice(0, 5).map(function (c) {
        return { text: (c.name || 'Contact') + ' — ' + (c.nextAction || c.stage || 'updated'), when: (daysAgo(c.lastTouch || c.last_touch) >= 99 ? '—' : daysAgo(c.lastTouch || c.last_touch) + 'd'), tone: '' };
      }),
      storageHead: (sel ? sel.n : contacts.length) ? ((funnel[0] && funnel[0][1]) + ' of ' + (sel ? sel.n : contacts.length)) : '',
      tableFoot: 'Showing ' + rows.length + ' of ' + contacts.length,
      rows: rows
    };
  }

  function liveSpacesState() {
    var S = window.STATE || {};
    var rows = asList(S.packages).length ? asList(S.packages) : asList(S.spaces);
    var order = ['General', 'Venture Capital', 'Business', 'Regulators'];
    var groups = {};
    order.forEach(function (n) { groups[n] = []; });
    rows.forEach(function (p) {
      var g = spaceLabel(p.spaceCategory || p.category || p.kind);
      if (!groups[g]) { groups[g] = []; order.push(g); }
      groups[g].push(p);
    });
    var out = order.filter(function (n) { return groups[n] && (groups[n].length || n === 'General'); }).map(function (name) {
      var list = groups[name] || [];
      var cards = list.slice(0, 8).map(function (p) {
        var intel = p.notes || p.description || p.subjectLabel || p.company || '';
        var rd = spaceReadiness(p);
        return [p.name || 'Space', intel || 'Add a one-line note', rd.n, nextActionOf(p), p.id, rd.docs, rd.links];
      });
      return [name, CAT_CLS[name] || 'c-gen', list.length, cards];
    });
    var ready = rows.filter(function (p) { return /ready|send/i.test(String(p.stage || '')) || nextActionOf(p) === 'send'; }).length;
    liveLog('spaces', { spaces: rows.length, groups: out.length });
    return {
      stats: [
        { n: String(rows.length || '—'), label: 'spaces', cls: '' },
        { n: String(ready), label: 'ready to send', cls: 'blue' },
        { n: '0', label: 'sent this week', cls: '' },
        { n: '0', label: 'replies', cls: '' },
        { n: '0', label: 'meetings booked', cls: '' },
        { n: '0', label: 'committed', cls: '' }
      ],
      groups: out
    };
  }

  function liveDocumentsState() {
    var S = window.STATE || {};
    var docs = asList(S.staged).length ? asList(S.staged) : asList(S.docs);
    var keptDrive = {};
    var keptName = {};
    var uniq = [];
    docs.forEach(function (d) {
      var id = String(d.driveFileId || d.fileId || '').trim();
      if (!id) return;
      if (keptDrive[id]) return;
      keptDrive[id] = 1;
      var n = String(d.name || '').trim().toLowerCase();
      if (n) keptName[n] = 1;
      uniq.push(d);
    });
    docs.forEach(function (d) {
      var id = String(d.driveFileId || d.fileId || '').trim();
      if (id) return;
      var n = String(d.name || '').trim().toLowerCase();
      if (n && keptName[n]) return;
      if (n) keptName[n] = 1;
      uniq.push(d);
    });
    docs = uniq;
    var folders = asList(S.docFolders);
    if (!folders.length) folders = ['Angel', 'Banking', 'Design partners', 'Dev', 'Dev partners', 'Friends & family', 'Government', 'Regulators'];
    var counts = { 'All documents': docs.length };
    docs.forEach(function (d) {
      var cat = d.category || d.folder || 'Other';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    var folderRows = [['All documents', docs.length, true]].concat(folders.map(function (name) {
      return [name, counts[name] || 0];
    }));
    var files = docs.slice(0, 24).map(function (d) {
      var k = docKind(d);
      var loc = d.driveFileId ? 'ok' : 'loc';
      var bg = { img: '#dfe8ff', ppt: '#ffe6cf', pdf: '#fde9ec', xls: '#e4f6ee', doc: '#e1ecff' }[k] || '#e1ecff';
      var meta = (d.category || 'Library') + (d.mime ? ' · file' : '');
      return [k, d.name || 'File', meta, loc, bg, d.url || '', d.id || '', d.driveFileId || ''];
    });
    var spaces = asList(S.packages).slice(0, 5).map(function (p, i) {
      var n = (p.docs || []).length || p.docCount || 0;
      return { ini: initials(p.name), color: C6[i % 6], name: p.name || 'Space', meta: n + ' doc' + (n === 1 ? '' : 's') };
    });
    var recent = docs.slice(-4).reverse().map(function (d) {
      var k = docKind(d);
      var lab = { img: 'IMG', ppt: 'PPT', pdf: 'PDF', xls: 'XLS', doc: 'DOC' }[k] || 'DOC';
      return ['t-' + k, lab, d.name || 'File'];
    });
    liveLog('documents', { docs: docs.length, folders: folders.length });
    return { folders: folderRows, sets: [['Investor data room', 0], ['Regulator pack', 0], ['F&F bundle', 0]], files: files, drops: spaces, recent: recent };
  }

  function liveLinksState() {
    var S = window.STATE || {};
    var cats = asList(S.categories);
    var links = asList(S.links);
    var seenAll = {};
    var counts = {};
    links.forEach(function (l) {
      var key = l.cat || l.category || 'Uncategorized';
      var uk = String(l.url || '').replace(/\/$/, '').toLowerCase();
      if (seenAll[key + '|' + uk]) return;
      seenAll[key + '|' + uk] = 1;
      counts[key] = (counts[key] || 0) + 1;
    });
    var tree = cats.map(function (c, i) {
      var name = c.name || c.title || 'Category';
      return { name: name, n: counts[name] || 0, on: i === 0, car: i === 0 ? 'closed' : 'closed' };
    });
    if (!tree.length) tree = [{ name: 'Uncategorized', n: links.length, on: true, car: '', noHv: true }];
    var active = (tree.filter(function (t) { return t.on; })[0] || tree[0] || { name: '' }).name;
    var wallSrc = links.filter(function (l) { return !active || (l.cat || l.category || '') === active || active === 'Uncategorized'; });
    if (!wallSrc.length) wallSrc = links;
    var seen = {};
    var wall = wallSrc.slice(0, 24).map(function (l) {
      var url = l.url || '';
      var host = hostOf(url);
      var n = (seen[host + '|' + url] = (seen[host + '|' + url] || 0) + 1);
      return [l.title || l.name || host || 'Link', host || url, l.color || '#2e6bf2', l.note || '', n > 1 ? 2 : 1, absUrl(url)];
    });
    var dups = {};
    wall.forEach(function (w) { var k = String(w[5] || w[1]).replace(/\/$/, ''); dups[k] = (dups[k] || 0) + 1; });
    wall.forEach(function (w) { if (dups[String(w[5] || w[1]).replace(/\/$/, '')] > 1) w[4] = 2; });
    var seenUrl = {};
    wall = wall.filter(function (w) {
      var k = String(w[5] || w[1]).replace(/\/$/, '').toLowerCase();
      if (seenUrl[k]) return false;
      seenUrl[k] = 1;
      w[4] = 1;
      return true;
    });
    tree = tree.map(function (t) {
      if (t.on) return Object.assign({}, t, { n: wall.length });
      return t;
    });
    liveLog('links', { cats: cats.length, links: links.length, wall: wall.length });
    return { tree: tree, crumb: active, crumbN: wall.length, wall: wall };
  }

  function liveEmailState() {
    var S = window.STATE || {};
    var board = S.mailBoard || {};
    var messages = asList(board.messages).length ? asList(board.messages) : asList(S.mail);
    var columns = asList(board.columns);
    var rules = asList(board.rules);
    var order = ['needs_now', 'investors', 'vcs', 'prospects', 'design', 'team', 'quiet'];
    if (!columns.length) columns = order.map(function (k) { return { key: k, name: (COL_META[k] || {}).name || k }; });
    var counts = board.counts || {};
    function tagged(row) {
      var tags = asList(row.tags).map(function (t) {
        if (Array.isArray(t)) return t;
        var s = String(t);
        if (/reply/i.test(s)) return ['t-rep', s];
        if (/invest|vc/i.test(s)) return ['t-vc', s];
        if (/regulat|assoc/i.test(s)) return ['t-reg', s];
        if (/design|advisor|partner/i.test(s)) return ['t-dp', s];
        if (/wait/i.test(s)) return ['t-w', s];
        return ['t-biz', s];
      });
      var tagsOut = tags.slice();
      var col = investorMail(row) ? 'investors' : (row.column || 'prospects');
      tagsOut = tagsOut.map(function (t) {
        if (Array.isArray(t) && /vc/i.test(String(t[1])) && col === 'investors') return ['t-vc', 'Investor'];
        return t;
      });
      return {
        name: senderName(row),
        color: row.color || mailColor(0),
        age: row.age || ageLabel(row.at || row.date),
        subject: row.subject || '(no subject)',
        preview: row.snippet || row.preview || '',
        tags: tagsOut,
        unread: !!row.unread,
        column: col,
        needsNow: !!row.needsNow || (!row.bulk && !!row.unread),
        bulk: !!row.bulk
      };
    }
    var shaped = messages.map(tagged);
    var cols = order.map(function (key) {
      var meta = COL_META[key] || { icon: '', name: key, rule: '' };
      var WIN = { investors: 1, vcs: 1, prospects: 1 };
      var list = shaped.filter(function (m) {
        if (key === 'quiet') return m.bulk || m.column === 'quiet';
        if (m.bulk) return false;
        if (key === 'needs_now') return m.needsNow && !WIN[m.column];
        if (WIN[key]) return m.column === key;
        return m.column === key && !m.needsNow;
      });
      var col = columns.filter(function (c) { return c.key === key; })[0];
      var ruleHits = rules.filter(function (r) { return r.target === key; });
      var rule = meta.rule;
      if (ruleHits.length) rule = 'Rule: ' + ruleHits.slice(0, 2).map(function (r) { return r.matchType + ' ' + r.matchValue; }).join(' · ');
      return { icon: meta.icon, name: (col && col.name) || meta.name, count: list.length, rule: rule, quiet: !!meta.quiet, messages: list.slice(0, 6) };
    });
    var need = shaped.filter(function (m) { return m.needsNow && !m.bulk; }).length;
    var inv = shaped.filter(function (m) { return m.column === 'investors'; }).length;
    liveLog('email', { messages: messages.length, columns: cols.length, need: need, investors: inv });
    return {
      need: counts.needs != null ? counts.needs : need,
      investors: inv,
      unread: counts.unread != null ? counts.unread : shaped.filter(function (m) { return m.unread; }).length,
      rules: rules.length || 4,
      columns: cols
    };
  }

  function paintPipelineLive() {
    var wrap = wrapOf('pipeDesk');
    if (!wrap) return;
    var data = pipelineData();
    var ST = data.funnel || [];
    var mx = Math.log((ST.reduce(function (m, s) { return Math.max(m, Number(s[1]) || 0); }, 0) || 0) + 1);
    var funnel = ST.map(function (s, i) {
      var n = Number(s[1]) || 0;
      var h = n ? Math.max(10, Math.round(Math.log(n + 1) / Math.max(mx, 0.001) * 110)) : 6;
      var prev = i > 1 ? (Number(ST[i - 1][1]) || 0) : 0;
      var cv = i <= 1 ? '' : (prev ? Math.min(100, Math.round(n / prev * 100)) + '%' : '–');
      return '<div class="st' + (n ? '' : ' zero') + (i === 0 ? ' on' : '') + '"><div class="n">' + n + '</div><div class="bx" style="height:' + h + 'px"></div><div class="lb">' + esc(s[0]) + '</div><div class="cv">' + cv + '</div></div>';
    }).join('');
    var rows = (data.rows || []).map(function (r, i) {
      var ini = String(r[0] || '').split(' ').map(function (x) { return x[0]; }).join('').slice(0, 2);
      return '<tr><td><div class="who"><span class="av" style="background:' + C6[i % 6] + '">' + esc(ini) + '</span><div><b>' + esc(r[0]) + '</b><span>' + (r[1] ? esc(r[1]) : '&nbsp;') + '</span></div></div></td><td class="cat">' + esc(r[2]) + '</td><td><span class="stg ' + esc(r[4] || '') + '">' + esc(r[3]) + '</span></td><td class="tch">' + esc(r[5]) + (r[5] && r[5] !== '—' ? ' ago' : '') + '</td><td class="nxs">' + esc(r[6]) + '</td><td><div class="ra"><button class="act">Open</button></div></td></tr>';
    }).join('');
    wrap.innerHTML =
      '<div class="bar"><h1>Pipeline</h1><span class="sub">Your cockpit &mdash; GoHighLevel runs the pipeline and the automations</span>'
      + '<div class="r"><div class="seg"><span class="on">Dashboard</span><span>Board</span><span>Table</span></div><input class="search" placeholder="Search people or companies"></div></div>'
      + '<div class="picker">' + (data.pills || []).map(function (p) {
        return '<button class="pl' + (p.on ? ' on' : '') + '"' + (p.id ? ' data-pipe="' + esc(p.id) + '"' : '') + '>' + esc(p.name) + ' <b>' + esc(p.n) + '</b></button>';
      }).join('')
      + (data.more ? '<button class="pl more">+ ' + data.more + ' more &#9662;</button>' : '')
      + '<span class="div"></span><button class="pl">Category: All &#9662;</button>'
      + '<span class="ro">' + ((data.pills || []).length + (data.more || 0)) + ' pipelines from GoHighLevel &middot; read-only</span></div>'
      + '<div class="kpis">' + (data.kpis || []).map(function (k) {
        return '<div class="kpi"><b>' + esc(k.n) + '</b><span>' + esc(k.label) + '</span><small class="' + esc(k.tone) + '">' + esc(k.note) + '</small></div>';
      }).join('') + '</div>'
      + '<section class="card" style="margin-bottom:16px"><div class="ch"><h3>Funnel</h3><span class="s">' + esc(data.funnelLabel || '') + '</span></div>'
      + '<div class="funnel" id="funnel"' + (ST.length !== 13 ? ' style="grid-template-columns:repeat(' + ST.length + ',minmax(0,1fr))"' : '') + '>' + funnel + '</div>'
      + '<div class="cvn">Conversion shown under each stage = share of the previous stage that moved forward. Storage is the holding pen and is not counted.</div></section>'
      + '<div class="g2"><section class="card"><div class="ch"><h3>Needs you today</h3><span class="s">cold &gt; 14 days &middot; follow-ups due</span></div>'
      + ((data.needs || []).length ? (data.needs || []).map(function (n) {
        return '<div class="nd"><span class="av" style="background:' + n.color + '">' + esc(initials(n.name)) + '</span><div style="min-width:0"><b>' + esc(n.name) + '</b><span>' + esc(n.meta) + '</span></div><button class="act">Follow up</button></div>';
      }).join('') : '<div class="nd"><div style="min-width:0"><b>Nobody waiting</b><span>Cold follow-ups will land here.</span></div></div>')
      + '</section><section class="card"><div class="ch"><h3>Category &times; stage</h3><span class="s">where people sit</span></div>'
      + '<table class="mx"><tr><th></th><th>Cold</th><th>Reached</th><th>Contact</th><th>Meeting</th><th>Done</th></tr>'
      + (data.matrix || []).map(function (r) {
        return '<tr><td>' + esc(r.cat) + '</td>' + r.cells.map(function (n) { return '<td class="' + heat(n) + '">' + n + '</td>'; }).join('') + '</tr>';
      }).join('') + '</table></section>'
      + '<section class="card"><div class="ch"><h3>Recent activity</h3><span class="s">from GoHighLevel</span></div>'
      + ((data.activity || []).length ? (data.activity || []).map(function (a) {
        return '<div class="fe"><i' + (a.tone === 'g' ? ' style="background:var(--green)"' : '') + '></i><span>' + esc(a.text) + '</span><em>' + esc(a.when) + '</em></div>';
      }).join('') : '<div class="fe"><span>No recent pipeline moves.</span></div>')
      + '</section></div>'
      + '<section class="card"><div class="ch"><h3>Storage</h3><span class="s">' + esc(data.storageHead || (data.tableFoot || '').replace(/^Showing /, '') || '0') + ' &middot; sorted by needs attention</span></div>'
      + '<table class="tbl"><tr><th>Person / company</th><th>Category</th><th>Stage</th><th>Last touch</th><th>Next step</th><th></th></tr><tbody id="rows">' + rows + '</tbody></table>'
      + '<div class="foot">' + esc(data.tableFoot || '') + ' &middot; <span class="lnk">Show all</span></div></section>';
    wrap.querySelectorAll('[data-pipe]').forEach(function (btn) {
      btn.onclick = function () {
        if (window.STATE) window.STATE.ghlPipe = btn.getAttribute('data-pipe');
        paintPipelineLive();
      };
    });
    markReady('pipeDesk');
  }

  function paintSpacesLive() {
    var wrap = wrapOf('spacesDesk');
    if (!wrap) return;
    var data = spacesData();
    wrap.innerHTML =
      '<div class="bar"><h1>Spaces</h1><span class="sub">Every send-bundle, ready to go &mdash; grouped by who it\'s for</span>'
      + '<div class="r"><div class="seg"><span class="on">Groups</span><span>Board</span></div><input class="search" placeholder="Search spaces or people"><button class="btn">Filter: all</button><button class="btn pri">+ New space</button></div></div>'
      + '<div class="stats">' + (data.stats || []).map(function (s) {
        return '<div class="sx ' + esc(s.cls || '') + '"><b>' + esc(s.n) + '</b><span>' + esc(s.label) + '</span></div>';
      }).join('') + '</div>'
      + '<div id="groups">' + (data.groups || []).map(function (g) {
        var shown = (g[3] || []).length, rest = g[2] - shown;
        return '<div class="gh"><span class="car">&#9662;</span><b>' + esc(g[0]) + '</b><span class="c">' + g[2] + '</span><span class="ln"></span>' + (rest > 0 ? '<span class="lnk">Show all ' + g[2] + '</span>' : '') + '</div><div class="grid">'
          + (g[3] || []).map(function (s) {
            var na = NA[s[3]] || NA.docs;
            return '<div class="sp"><div class="top2"><span class="cat ' + g[1] + '">' + esc(g[0]) + '</span><span class="ms" title="More">&middot;&middot;&middot;</span></div><h4>' + esc(s[0]) + '</h4><p>' + esc(s[1]) + '</p><div class="rd">' + ring(s[2]) + '<span class="nxa ' + na[0] + '">' + na[1] + '</span><span class="cnt wrap">' + (Number(s[5]) || 0) + ' files &middot; ' + (Number(s[6]) || 0) + ' links</span></div><div class="ft"><button class="op"' + (s[4] ? ' data-space="' + esc(s[4]) + '"' : '') + '>Open</button><button class="dr">Move to Drive</button></div></div>';
          }).join('')
          + (g[0] === 'General' ? '<div class="addcard">+ New space</div>' : '') + '</div>';
      }).join('') + '</div>'
      + '<div class="menu" id="menu"><div class="lbl">Move to</div><div>General</div><div>Venture Capital</div><div>Business</div><div>Regulators</div><div>Rename</div><div class="del">Delete</div></div>';
    var m = wrap.querySelector('#menu');
    wrap.querySelectorAll('.ms').forEach(function (b) {
      b.onclick = function (e) {
        e.stopPropagation();
        if (!m) return;
        var r = b.getBoundingClientRect();
        m.style.left = (r.right - 200) + 'px';
        m.style.top = (r.bottom + 6) + 'px';
        m.style.display = 'block';
      };
    });
    wrap.querySelectorAll('[data-space]').forEach(function (btn) {
      btn.onclick = function (e) {
        e.stopPropagation();
        if (typeof window.openSpace === 'function') window.openSpace(btn.getAttribute('data-space'));
      };
    });
    document.addEventListener('click', function () { if (m) m.style.display = 'none'; });
    markReady('spacesDesk');
  }

  function paintDocumentsLive() {
    var wrap = wrapOf('docsDesk');
    if (!wrap) return;
    var data = documentsData();
    var L = { img: ['t-img', 'IMG'], ppt: ['t-ppt', 'PPT'], pdf: ['t-pdf', 'PDF'], doc: ['t-doc', 'DOC'], xls: ['t-xls', 'XLS'] };
    var files = (data.files || []).map(function (f) {
      var inner = (f[0] === 'ppt' || f[0] === 'img') ? '<div class="sl" style="background:linear-gradient(135deg,#1b2f66,#2e6bf2)">' + esc(String(f[1]).split('|')[0]) + '</div>' : '<div class="pg"><i class="h"></i><i></i><i></i><i style="width:80%"></i><i></i><i style="width:60%"></i></div>';
      var href = absUrl(f[5] || '');
      var drive = isDriveUrl(f[5] || '') || f[7];
      var open = drive ? '' : ' data-web="' + esc(href) + '"';
      return '<div class="fl"' + open + '><div class="th" style="background:' + f[4] + '">' + inner + '<span class="ty ' + L[f[0]][0] + '">' + L[f[0]][1] + '</span><span class="sync s-' + f[3] + '"></span></div><span class="sel"></span><div class="nm">' + esc(f[1]) + '</div><div class="mt">' + f[2] + '</div></div>';
    }).join('');
    wrap.innerHTML =
      '<div class="bar"><h1>Documents</h1><span class="sub">Your staging library &mdash; preview, select, and drop straight into a Space</span>'
      + '<div class="r"><input class="search" placeholder="Search by name, type or what\'s inside"><div class="seg"><span class="on">Grid</span><span>List</span></div><button class="btn">Pull from Drive</button><button class="btn pri">Upload</button></div></div>'
      + '<div class="lay"><section class="card"><div class="lh">Folders <span class="lnk">+ New</span></div>'
      + (data.folders || []).map(function (f) {
        return '<div class="fd' + (f[2] ? ' on' : '') + '"><svg viewBox="0 0 24 24"><path d="M3 7h6l2 2h10v10H3z"/></svg>' + esc(f[0]) + '<span class="n">' + f[1] + '</span></div>';
      }).join('')
      + '<div class="sepl"></div><div class="lh">Sets <span class="lnk">+ New</span></div><div class="sets">'
      + (data.sets || []).map(function (s) {
        return '<div class="fd"><svg viewBox="0 0 24 24"><path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.5 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/></svg>' + esc(s[0]) + '<span class="n">' + s[1] + '</span></div>';
      }).join('')
      + '</div><div class="sepl"></div><div class="lh">Type</div>'
      + '<div class="types"><button class="chip on">All</button><button class="chip">PDF</button><button class="chip">Slides</button><button class="chip">Docs</button><button class="chip">Sheets</button><button class="chip">Images</button><button class="chip">In a Space</button><button class="chip">From Drive</button></div></section>'
      + '<section class="card ctr"><div class="ch"><h3>All documents</h3><span class="s">' + (data.files || []).length + ' files &middot; hover a file to select it, then drop it on a Space</span></div>'
      + '<div class="files" id="files">' + (files || '<div class="drop">No files yet.</div>') + '</div>'
      + '<div class="drop">Drop files here, <span class="lnk">upload</span> or <span class="lnk">pull from Drive</span> &mdash; <b>first-page previews</b> appear automatically.</div></section>'
      + '<div class="rs"><section class="card"><div class="ch"><h3>Drop into a Space</h3><span class="s">drag a file here</span></div>'
      + ((data.drops || []).length ? (data.drops || []).map(function (d) {
        return '<div class="sr"><span class="av" style="background:' + d.color + '">' + esc(d.ini) + '</span><div style="min-width:0"><b>' + esc(d.name) + '</b><span>' + esc(d.meta) + '</span></div></div>';
      }).join('') : '<div class="sr"><div style="min-width:0"><b>No spaces yet</b><span>Create a Space to drop files into.</span></div></div>')
      + '<button class="build">+ Build a new Space from the selection</button></section>'
      + '<section class="card"><div class="ch"><h3>Recently added</h3></div>'
      + (data.recent || []).map(function (r) {
        return '<div class="ra"><span class="ty ' + r[0] + '">' + r[1] + '</span><span>' + esc(r[2]) + '</span></div>';
      }).join('')
      + '<div class="legend"><span><i style="background:var(--green)"></i>synced to Drive</span><span><i style="background:var(--amber)"></i>only here</span></div></section></div></div>';
    wrap.querySelectorAll('[data-web]').forEach(function (el) {
      el.onclick = function (e) {
        e.stopPropagation();
        window.open(el.getAttribute('data-web'), '_blank', 'noopener,noreferrer');
      };
    });
    markReady('docsDesk');
  }

  function paintLinksLive() {
    var wrap = wrapOf('linksDesk');
    if (!wrap) return;
    var data = linksData();
    wrap.innerHTML =
      '<div class="bar"><h1>Links</h1><span class="sub">Every bookmark, sorted &mdash; each opens the site in a new tab</span>'
      + '<div class="r"><input class="search" placeholder="Search links, notes or sites"></div></div>'
      + '<div class="lay"><section class="card tree"><div class="lh">Categories <span class="lnk">+ New</span></div>'
      + (data.tree || []).map(function (t) {
        var car = t.car === 'open' ? '&#9662;' : t.car === 'closed' ? '&#9656;' : '';
        var cls = 'cr' + (t.on ? ' on' : '') + (t.indent === 2 ? ' sub2' : '') + (t.indent === 3 ? ' sub3' : '');
        var hv = t.noHv ? '' : '<span class="hv">' + (t.noSub ? '' : '<span>+ sub</span>') + '<span>Rename</span><span class="x">&times;</span></span>';
        return '<div class="' + cls + '"><span class="car">' + car + '</span>' + esc(t.name) + '<span class="n">' + t.n + '</span>' + hv + '</div>';
      }).join('')
      + '<div class="exp">Expand all</div></section>'
      + '<section class="card"><div class="crumbs">Links &rsaquo; <b>' + esc(data.crumb || '') + '</b> &middot; ' + (data.crumbN || 0) + ' links</div>'
      + '<div class="add"><input placeholder="Title (optional - we\'ll read it from the site)"><input placeholder="Paste a link - https://"><button>Add link</button></div>'
      + '<div class="wall" id="wall">' + (data.wall || []).map(function (w) {
        var href = absUrl(w[5] || w[1]);
        var letter = esc(String(w[0] || '?')[0]);
        var hostName = hostOf(href);
        var ico = fixtureOn() ? '' : '<img class="ico" alt="" src="/api/favicon?d=' + encodeURIComponent(hostName) + '" onerror="this.parentNode.classList.remove(\'has-ico\');this.remove()">';
        return '<a class="tile" href="' + esc(href) + '" target="_blank" rel="noopener noreferrer">' + (w[4] == 2 ? '<span class="dup">Duplicate</span>' : '')
          + '<div class="lg' + (ico ? ' has-ico' : '') + '" style="background:' + w[2] + '14">' + ico + '<i style="background:' + w[2] + '">' + letter + '</i></div>'
          + '<div class="tm"><span title="Edit">&#9998;</span><span title="Move">&#8644;</span><span title="Delete">&times;</span></div>'
          + '<div class="nb"><b>' + esc(w[0]) + '<em>&#8599;</em></b><div class="dm">' + esc(w[1]) + '</div><div class="nt' + (w[3] ? '' : ' empty') + '">' + (w[3] ? esc(w[3]) : 'Add a note') + '</div></div></a>';
      }).join('') + '</div>'
      + '<div class="hint">Site icons load from each website. Hover a tile to edit, move or delete it.</div></section></div>';
    wrap.querySelectorAll('a.tile').forEach(function (a) {
      a.addEventListener('click', function (e) {
        if (e.target.closest && e.target.closest('.tm')) { e.preventDefault(); return; }
        e.stopPropagation();
      });
    });
    markReady('linksDesk');
  }

  function ml(m) {
    return '<div class="ml"><div class="mh">' + (m.unread ? '<span class="un"></span>' : '') + '<span class="av" style="background:' + m.color + '">' + esc(initials(m.name)) + '</span><b>' + esc(m.name) + '</b><em>' + esc(m.age) + '</em></div><div class="sj">' + esc(m.subject) + '</div><div class="pv">' + esc(m.preview) + '</div><div class="tg">' + (m.tags || []).map(function (x) { return '<span class="' + x[0] + '">' + esc(x[1]) + '</span>'; }).join('') + '</div></div>';
  }

  function composeHtml(open) {
    return '<aside class="compose' + (open ? ' open' : '') + '" id="compose">'
      + '<div class="cw"><div class="ctop"><h2>New email</h2><span style="font-size:12px;color:var(--ink3);font-weight:600">Draft saved 10:31</span><button class="btn x" id="cclose">Close &times;</button></div>'
      + '<div class="fr"><label>From</label><div class="val from">Chad Johnston &lt;chad@4ormfinance.com&gt;<small>sends from your Gmail &middot; bulk goes through GoHighLevel</small></div><span></span></div>'
      + '<div class="fr sugg"><label>To</label><div class="val"><span class="pchip"><span class="av" style="background:#e0364f">JC</span>Joe Canavan <em>&middot; VC</em></span><input value="neil"></div><span class="sm">Cc &nbsp; Bcc</span>'
      + '<div class="dd"><div class="o"><span class="av" style="background:#e0364f;width:28px;height:28px">NM</span><div><b>Neil Mitchell</b><span>neil@&hellip; &middot; VC Space &middot; last touch 12d ago</span></div><em>Cold</em></div><div class="o"><span class="av" style="background:#12a36a;width:28px;height:28px">NC</span><div><b>Neil (CLHIA)</b><span>Contacts &middot; Association</span></div><span></span></div></div></div>'
      + '<div class="fr subj"><label>Subject</label><div class="val"><input value="Evidence standard for Canadian fintech &mdash; 15 minutes?"></div><span></span></div>'
      + '<div class="tbar"><span>B</span><span><i>I</i></span><span>&#8226;</span><span>1.</span><span class="sep"></span><span>&#128279;</span><span>&#128206;</span><span class="sep"></span><span title="Insert first name">{ }</span></div>'
      + '<div class="body" contenteditable="true">Hi Joe,<br><br>Most of your angel book is Canadian fintech &mdash; Wealthsimple, Borrowell, CapIntel, Homewise. All of them now have to prove a recommendation was suitable and understood, not just disclosed.<br><br>That record is what 4orm builds. We\'re closing a $250K friends-and-family round by Oct 30 and opening 4ormIQ to brokers on Oct 23.<br><br><span class="ghost">Would 15 minutes Thursday or Friday work? Here\'s my calendar: book.4ormfinance.com/chad</span><br><br>Chad</div>'
      + '<div style="padding:0 18px 8px;font-size:12px;color:var(--ink3)">Grey text is a suggestion &mdash; press Tab to accept it.</div>'
      + '<div class="atts"><span class="att"><span class="ty" style="background:#e0364f">PDF</span>4orm VC and Design Partner Resources.pdf<span class="x2">&times;</span></span><span class="att"><span class="ty" style="background:#e2702b">PPT</span>Business Overview | 2026<span class="x2">&times;</span></span></div>'
      + '<div class="cfoot"><button class="send">Send</button><button class="send2">Schedule &#9662;</button><span class="tog"><span class="sw"></span>Nudge in 3 days</span><span class="tog"><span class="sw"></span>Log to Pipeline</span></div></div>'
      + '<div class="side2"><div class="box ai2"><h4>&#10022; 4orm Intelligence</h4><p>Joe cares about the evidence standard. Lead with CapIntel and Homewise, keep the tech light, ask for one specific time.</p>'
      + '<div class="tones"><span class="on">Warm</span><span>Direct</span><span>Shorter</span><span>More formal</span></div>'
      + '<div class="ask"><input placeholder="Tell me what to write&hellip;"><button>Write</button></div></div>'
      + '<div class="box"><h4>Joe Canavan</h4><div class="kv2"><span>Space</span><b>Venture Capital &rsaquo; Joe</b></div><div class="kv2"><span>Stage</span><b>Investors &rsaquo; Contact made</b></div><div class="kv2"><span>Last touch</span><b>12 days ago</b></div><div class="kv2"><span>Opened last email</span><b>Yes, twice</b></div></div>'
      + '<div class="box"><h4>Attach from his Space</h4><div class="doc"><span class="ty" style="background:#e0364f">PDF</span>VC and Design Partner Resources<span class="ad">&#10003;</span></div><div class="doc"><span class="ty" style="background:#e2702b">PPT</span>Business Overview | 2026<span class="ad">&#10003;</span></div><div class="doc"><span class="ty" style="background:#12a36a">XLS</span>Raise tracker &mdash; F&amp;F<span class="ad">+</span></div></div>'
      + '<div class="box"><h4>Before you send</h4><div class="chk"><i>&#10003;</i>Name and company spelled right</div><div class="chk"><i>&#10003;</i>One clear ask with a time</div><div class="chk"><i>&#10003;</i>Attachments under 10 MB</div></div></div></aside>';
  }

  function paintEmailLive() {
    var wrap = wrapOf('mailDesk');
    if (!wrap) return;
    var data = emailData();
    var openCompose = /(?:^|[?&])compose=1(?:&|$)/.test(String(location.search || ''));
    wrap.innerHTML =
      '<div class="bar"><h1>Email</h1><div class="cnt"><span><b>' + esc(data.need) + '</b> need a reply</span><span><b>' + esc(data.investors) + '</b> investors waiting</span><span><b>' + esc(data.unread) + '</b> unread</span></div>'
      + '<div class="r"><input class="search" placeholder="Search mail &mdash; try &quot;waiting on&quot; or &quot;needs reply&quot;"><button class="btn">Filters (' + esc(data.rules) + ')</button><button class="btn pri" id="composeBtn">Compose</button></div></div>'
      + '<div class="rules"><span class="on"></span><b>Auto-filing on</b> &middot; ' + esc(data.rules) + ' rules keep new mail sorted &middot; drag any email onto a column to make a rule that sticks<span class="lnk">+ New rule</span></div>'
      + '<div class="board" id="board">' + (data.columns || []).map(function (c) {
        return '<div class="col' + (c.messages && c.messages.length ? '' : ' slim') + (c.quiet || c.name === 'Quiet' ? ' quiet' : '') + '"><div class="colh"><i>' + c.icon + '</i><b>' + esc(c.name) + '</b><span class="c">' + esc(c.count) + '</span><span class="m">&middot;&middot;&middot;</span></div><div class="rb">' + esc(c.rule) + '</div>'
          + (c.messages && c.messages.length ? '<div class="list">' + c.messages.map(ml).join('') + '</div>' : '<div class="emptyc">Nothing here yet.<br>Drag an email in to teach the rule.</div>') + '</div>';
      }).join('') + '<div class="newcol">+ New column</div></div>'
      + '<div class="scrim" id="scrim"></div>'
      + '<aside class="reader" id="reader"><span class="grab"></span>'
      + '<div class="rh"><span class="av" style="background:#c98408;width:36px;height:36px">BF</span><div><h2>Deck &mdash; notes</h2></div><button class="btn x" id="close">Close &times;</button></div>'
      + '<div class="rmeta">Bruce Fair &lt;bruce@4ormfinance.com&gt; &middot; 3 days ago &middot; to you</div>'
      + '<div class="links"><span>&#128100; Bruce Fair &middot; Advisor</span><span>&#128193; Space: Friends &amp; family</span><span>Pipeline: Investors &rsaquo; Contact made</span></div>'
      + '<div class="acts"><button class="p">Reply</button><button>Add to Space</button><button>Create task</button><button>Snooze</button><button>Move column</button><button>Mark done</button></div>'
      + '<div class="ai"><b>&#10022; 4orm Intelligence</b><p>Bruce wants tighter messaging on "What is it that 4orm is providing?" before the deck goes out. He\'s asking for one plain sentence on slide 2 and the counselling angle cut.</p>'
      + '<div class="draft">Thanks Bruce &mdash; agreed. New slide 2 line: "4orm gives every financial recommendation a record the client understood and a regulator can check." I\'ll send the revised deck by Wednesday. Chad</div></div>'
      + '<div class="bd">Need to tighten messaging with respect to What is it that 4orm is providing? Counselling…\n\nI think the first page should say it in one sentence. Then show the proof.\n\nB</div></aside>'
      + composeHtml(openCompose);
    var root = wrap.getRootNode();
    var r = root.getElementById && root.getElementById('reader');
    var sc = root.getElementById && root.getElementById('scrim');
    var cp = root.getElementById && root.getElementById('compose');
    function show(v) { if (r) r.classList.toggle('open', v); if (sc) sc.classList.toggle('open', v); }
    function showC(v) { if (cp) cp.classList.toggle('open', v); if (sc) sc.classList.toggle('open', !!v || (r && r.classList.contains('open'))); }
    var btn = root.getElementById && root.getElementById('composeBtn');
    var cclose = root.getElementById && root.getElementById('cclose');
    var close = root.getElementById && root.getElementById('close');
    if (btn) btn.onclick = function () { showC(true); };
    if (cclose) cclose.onclick = function () { showC(false); };
    if (close) close.onclick = function () { show(false); };
    wrap.querySelectorAll('.ml').forEach(function (m) { m.onclick = function () { show(true); }; });
    if (sc) sc.onclick = function () { show(false); showC(false); };
    if (openCompose) {
      if (cp) cp.classList.add('open');
      if (sc) sc.classList.add('open');
    }
    markReady('mailDesk');
  }

  window.paintRedesignPipeline = function () { whenCss(paintPipelineLive); };
  window.paintRedesignSpaces = function () { whenCss(paintSpacesLive); };
  window.paintRedesignDocuments = function () { whenCss(paintDocumentsLive); };
  window.paintRedesignLinks = function () { whenCss(paintLinksLive); };
  window.paintRedesignEmail = function () { whenCss(paintEmailLive); };

  function hook(name, paint, onlyWhen) {
    if (typeof window[name] !== 'function' || window[name].__redesignB) return;
    var prev = window[name];
    window[name] = function () {
      if (onlyWhen && !onlyWhen()) return prev.apply(this, arguments);
      paint();
      if (typeof window.paintShellNav === 'function') window.paintShellNav();
    };
    window[name].__redesignB = true;
    window[name].__prev = prev;
  }
  function deskIs(name) {
    return function () { return (window.STATE || {}).desk === name; };
  }
  function hookAll() {
    hook('renderContacts', window.paintRedesignPipeline);
    hook('renderPackages', window.paintRedesignSpaces);
    hook('renderLibrary', window.paintRedesignDocuments);
    hook('renderDocs', window.paintRedesignDocuments, deskIs('docs'));
    hook('renderLinks', window.paintRedesignLinks);
    hook('renderCats', window.paintRedesignLinks);
    if (typeof window.loadMailBoard === 'function' && !window.loadMailBoard.__redesignB) {
      var prior = window.loadMailBoard;
      window.loadMailBoard = function (refresh) {
        window.paintRedesignEmail();
        return prior.apply(this, arguments);
      };
      window.loadMailBoard.__redesignB = true;
    }
  }
  setInterval(hookAll, 400);
  hookAll();

  function loadLiveFeeds(desk) {
    if (fixtureOn() || typeof authFetch !== 'function') return;
    function go(url, key) {
      authFetch(url, { credentials: 'include', quiet: true }).then(function (r) { return r.json(); }).then(function (d) {
        if (!window.STATE) return;
        if (key === 'pipe' && d && d.pipelines) window.STATE.ghlPipes = d.pipelines;
        if (key === 'spaces') window.STATE.packages = (d && (d.packages || d.spaces)) || window.STATE.packages;
        if (key === 'docs') { window.STATE.staged = (d && d.docs) || []; window.STATE.docFolders = (d && (d.folders || d.categories)) || window.STATE.docFolders; }
        if (key === 'mail') window.STATE.mailBoard = d;
        if (desk === 'contacts' && key === 'pipe') paintPipelineLive();
        if (desk === 'work' && key === 'spaces') paintSpacesLive();
        if (desk === 'docs' && key === 'docs') paintDocumentsLive();
        if (desk === 'mail' && key === 'mail') paintEmailLive();
        if (desk === 'links') paintLinksLive();
        console.info('[live-map] ' + url, d && typeof d === 'object' ? Object.keys(d) : typeof d);
      }).catch(function () {});
    }
    if (desk === 'contacts') go('/api/pipeline', 'pipe');
    if (desk === 'work') go('/api/spaces', 'spaces');
    if (desk === 'docs') go('/api/documents', 'docs');
    if (desk === 'mail') go('/api/mail/board', 'mail');
    if (desk === 'links') liveLog('links', { links: asList((window.STATE || {}).links).length });
  }
  window.__portLoadB = loadLiveFeeds;

  whenCss(function () {
    var path = String(location.pathname || '');
    var q = String(location.search || '');
    var map = [
      [/\/pipeline\/?$/.test(path) || /view=contacts/.test(q), 'pipeDesk', paintPipelineLive, 'contacts'],
      [/\/spaces\/?$/.test(path) || /view=work/.test(q), 'spacesDesk', paintSpacesLive, 'work'],
      [/\/documents\/?$/.test(path) || /view=docs/.test(q), 'docsDesk', paintDocumentsLive, 'docs'],
      [/\/links\/?$/.test(path) || /view=links/.test(q), 'linksDesk', paintLinksLive, 'links'],
      [/\/email\/?$/.test(path) || /\/email-board\/?$/.test(path) || /view=mail/.test(q), 'mailDesk', paintEmailLive, 'mail']
    ];
    map.forEach(function (row) {
      if (!row[0]) return;
      var host = document.getElementById(row[1]);
      var view = host && host.closest && host.closest('.view');
      if (view) view.hidden = false;
      row[2]();
      loadLiveFeeds(row[3]);
    });
  });
})();
