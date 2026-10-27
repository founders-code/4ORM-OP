/* Part B pages: pipeline / spaces / documents / links / email.
   ONE render path: data = fixtureOn() ? REDESIGN_FIXTURE.page : live*State(). */
(function () {
  function P() { return window.__port || {}; }
  function fixtureOn() { return P().fixtureOn ? P().fixtureOn() : false; }
  function wrapOf(id) { return P().wrapOf ? P().wrapOf(id) : null; }
  function whenCss(fn) { if (P().whenCss) P().whenCss(fn); else fn(); }
  function markReady(id) { if (P().markReady) P().markReady(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function asList(v) { return P().asList ? P().asList(v) : (Array.isArray(v) ? v : []); }
  function liveLog(page, extra) { if (P().liveLog) P().liveLog(page, extra); }
  function initials(name) { return P().initials ? P().initials(name) : '?'; }
  function ageLabel(ms) { return P().ageLabel ? P().ageLabel(ms) : ''; }

  var C6 = ['#2e6bf2', '#12a36a', '#c98408', '#6b4fd8', '#e0364f', '#0f9fb5'];
  function pipeTitle(s) {
    return String(s || '').toLowerCase().replace(/(^|[\s\-/&])([a-z])/g, function (_, a, b) { return a + b.toUpperCase(); });
  }
  var NA = { docs: ['na-docs', 'Add docs'], send: ['na-send', 'Send today'], ppl: ['na-ppl', 'Add people'] };
  var CAT_CLS = { General: 'c-gen', 'Venture Capital': 'c-vc', Business: 'c-bus', Regulators: 'c-reg' };
  /* Built-in classifier keys the server seeds. They are never shown as user columns. */
  var SEEDED_COLS = /^(needs_now|investors|vcs|prospects|design|team|quiet)$/;
  var INVISIBLE_RE = /[­͏؜ᅟᅠ឴឵᠎​-‏‪-‮⁠-⁤⁪-⁯ㅤ﻿ﾠ]/g;

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
  function mailColor(i) { return C6[i % C6.length]; }
  function colorFor(key) {
    var s = String(key || ''), h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return C6[Math.abs(h) % C6.length];
  }

  function pipelineData() { return fixtureOn() ? (F().pipeline || {}) : livePipelineState(); }
  function spacesData() { return fixtureOn() ? (F().spaces || {}) : liveSpacesState(); }
  function documentsData() { return fixtureOn() ? (F().documents || {}) : liveDocumentsState(); }
  function linksData() {
    if (!fixtureOn()) return liveLinksState();
    var data = F().links || {};
    var S = window.STATE || {};
    var openKeys = S.linkOpen;
    var cat = S.cat || S.linkCat || '';
    var src = data.tree || [];
    var allN = src.filter(function (t) { return !t.indent; }).reduce(function (a, t) { return a + (Number(t.n) || 0); }, 0) || (data.wall || []).length;
    /* Same rules as the live tree: collapsed until opened, a caret only where subfolders exist. */
    var opened = Array.isArray(openKeys) ? openKeys : [];
    var hideBelow = 0;
    var rows = [];
    src.forEach(function (t, i) {
      var lvl = t.indent || 1;
      var nxt = src[i + 1];
      var kids = !!(nxt && (nxt.indent || 1) > lvl);
      if (hideBelow && lvl > hideBelow) return;
      hideBelow = 0;
      var next = Object.assign({}, t);
      next.on = !!cat && t.name === cat;
      next.car = kids ? (opened.indexOf(t.name) >= 0 ? 'open' : 'closed') : '';
      if (kids && next.car !== 'open') hideBelow = lvl;
      rows.push(next);
    });
    var tree = [{ name: 'All links', n: allN, on: !cat, kind: 'all', noHv: true, noSub: true, car: '' }].concat(rows);
    return Object.assign({}, data, { tree: tree, crumb: cat || 'All links', crumbN: cat ? data.crumbN : (data.wall || []).length });
  }
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
      return { id: p.id, name: pipeTitle(p.name || 'Pipeline'), n: n, stages: p.stages || [], rawName: p.name || 'Pipeline' };
    }).sort(function (a, b) { return b.n - a.n; });
    var sel = pipes.filter(function (p) { return p.id === S.ghlPipe; })[0] || pipes[0] || null;
    var allPills = pipes.map(function (p, i) {
      return { name: p.name, n: p.n, on: sel ? p.id === sel.id : i === 0, id: p.id };
    });
    var pills = S.pipeShowAll ? allPills : allPills.slice(0, 5);
    var stages = sel ? sel.stages : asList(S.pipeline).map(function (s) { return { name: s.stage || s.name || s.s, count: s.count || s.v }; });
    var funnel = stages.map(function (s) { return [s.name || s.s || 'Stage', Number(s.count != null ? s.count : s.v) || 0]; });
    if (!funnel.length) funnel = [['Storage', 0]];
    var contacts = asList(S.contacts);
    var needs = buildNeeds(S, contacts, sel);
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
    var inPipe = {};
    var rowsSrc = [];
    asList(sel && sel.stages).forEach(function (st) {
      asList(st.opps).forEach(function (o) {
        var email = String(o.email || '').toLowerCase();
        if (email) inPipe[email] = 1;
        var c = contacts.filter(function (x) { return email && String(x.email || '').toLowerCase() === email; })[0] || {};
        rowsSrc.push({
          name: o.contact || o.name || c.name || 'Person',
          company: o.company || c.company || '',
          category: c.category || c.type || '',
          stage: st.name || o.stage || 'Storage',
          lastTouch: o.updatedAt || c.lastTouch || c.last_touch,
          nextAction: c.nextAction || c.next_action || '',
          id: o.id || c.id || '',
          email: o.email || c.email || ''
        });
      });
    });
    if (S.ghlStage) {
      rowsSrc = rowsSrc.filter(function (c) { return String(c.stage || '') === String(S.ghlStage); });
    }
    if (S.pipeType && S.pipeType !== 'all') {
      rowsSrc = rowsSrc.filter(function (c) { return normCat(c.category || '') === S.pipeType; });
    }
    if (S.pipeMatrix && S.pipeMatrix.cat) {
      rowsSrc = rowsSrc.filter(function (c) { return normCat(c.category || '') === S.pipeMatrix.cat; });
    }
    var pq = String(S.pipeQ || '').trim().toLowerCase();
    if (pq) {
      rowsSrc = rowsSrc.filter(function (c) { return ((c.name || '') + ' ' + (c.company || '') + ' ' + (c.email || '')).toLowerCase().indexOf(pq) >= 0; });
    }
    var rows = (S.pipeAllRows ? rowsSrc : rowsSrc.slice(0, 8)).map(function (c) {
      var days = daysAgo(c.lastTouch);
      var stage = pipeTitle(c.stage || 'Storage');
      var warm = days <= 3 ? 'hot' : days <= 10 ? 'warm' : days >= 14 ? 'cold' : '';
      return [c.name || 'Person', c.company || '', normCat(c.category || ''), stage, warm, (days >= 99 ? '—' : days + 'd'), c.nextAction || 'Follow up', c.id || '', c.email || ''];
    });
    liveLog('pipeline', { pipes: pipes.length, contacts: contacts.length, funnel: funnel.length, rows: rows.length });
    return {
      pills: pills, more: S.pipeShowAll ? 0 : Math.max(0, pipes.length - 5),
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
      tableFoot: 'Showing ' + rows.length + ' of ' + rowsSrc.length,
      rows: rows,
      board: boardStages(sel, pq)
    };
  }
  /* Board columns come from the cached GHL opportunities, so a drag moves THAT opportunity. */
  function boardStages(sel, q) {
    if (!sel) return [];
    return asList(sel.stages).map(function (st) {
      var opps = asList(st.opps).filter(function (o) {
        return !q || ((o.contact || '') + ' ' + (o.name || '') + ' ' + (o.company || '') + ' ' + (o.email || '')).toLowerCase().indexOf(q) >= 0;
      });
      return { id: st.id || '', name: pipeTitle(st.name || 'Stage'), count: q ? opps.length : (Number(st.count) || opps.length), pipe: sel.id, opps: opps };
    });
  }
  /* Fixture (design mock) only: stage columns from the mock rows. Live always uses GHL opportunities. */
  function fixtureBoard(funnel, rows) {
    return funnel.map(function (f, i) {
      var opps = rows.filter(function (r) { return String(r[3] || '') === String(f[0]) || (i === 0 && !r[3]); }).map(function (r) {
        return { id: r[7] || r[0], contact: r[0], company: r[1] || r[2], email: r[8] || '' };
      });
      return { id: 'fx' + i, name: f[0], count: Number(f[1]) || opps.length, pipe: '', opps: opps };
    });
  }
  function endOfToday() {
    var d = new Date();
    d.setHours(23, 59, 59, 999);
    return d.getTime();
  }
  function toMs(raw) {
    if (!raw) return 0;
    var n = typeof raw === 'number' ? raw : Date.parse(raw);
    if (!Number.isFinite(n)) return 0;
    return n < 1e12 ? n * 1000 : n;
  }
  /* Needs you today: follow-ups due, then going cold, then open reach-outs. One merged list. */
  function buildNeeds(S, contacts, sel) {
    var done = S.pipeNeedDone || {};
    var seen = {};
    var out = [];
    function push(row) {
      var key = row.kind + ':' + (row.id || row.name);
      var who = row.contactId || row.id || row.name;
      if (seen[who] || done[key]) return;
      seen[who] = 1;
      row.key = key;
      out.push(row);
    }
    var inSel = null;
    if (sel && sel.id) {
      inSel = {};
      asList(sel.stages).forEach(function (st) {
        asList(st.opps).forEach(function (o) {
          var e = String(o.email || '').toLowerCase();
          var n = String(o.contact || o.name || '').toLowerCase();
          if (e) inSel[e] = 1;
          if (n) inSel['n:' + n] = 1;
        });
      });
    }
    function inPipe(c, o) {
      if (!inSel) return true;
      var e = String((c && c.email) || (o && o.email) || '').toLowerCase();
      var n = String((c && c.name) || (o && (o.contact || o.name)) || '').toLowerCase();
      return !!(e && inSel[e]) || !!(n && inSel['n:' + n]);
    }
    var eod = endOfToday();
    contacts.forEach(function (c) {
      if (!inPipe(c)) return;
      var due = toMs(c.nextDate || c.next_date);
      if (!due || due > eod) return;
      var late = Math.max(0, Math.round((Date.now() - due) / 86400000));
      push({ kind: 'follow', why: 'Follow up' + (late ? ' · ' + late + 'd' : ''), act: c.email ? 'Reply' : 'Follow up', id: c.id || '', name: c.name || 'Person', email: c.email || '', meta: [normCat(c.category || c.type || 'Contact'), c.nextAction || c.next_action || ''].filter(Boolean).join(' · ') });
    });
    /* GoHighLevel: people sitting in a follow-up stage (sent / follow / check back / call back / info pack /
       package / proposal / waiting) with no stage change or touch for N days (default 3; per stage via
       STATE.pipeFollowDays[stageName] or localStorage cr_pipe_follow_days = {"Stage name": days}). */
    /* \bsent\b so "Presentation" does not count as "sent". */
    var FOLLOW_STAGE = /\bsent\b|follow|check back|call back|info pack|package|proposal|waiting/i;
    var perStage = S.pipeFollowDays || null;
    if (!perStage) { try { perStage = JSON.parse(localStorage.getItem('cr_pipe_follow_days') || 'null'); } catch (e) { perStage = null; } }
    perStage = perStage && typeof perStage === 'object' ? perStage : {};
    var byEmail = {};
    contacts.forEach(function (c) { var e = String(c.email || '').toLowerCase(); if (e) byEmail[e] = c; });
    var oppDone = {};
    try { oppDone = JSON.parse(localStorage.getItem('cr_pipe_opp_done') || '{}') || {}; } catch (e) { oppDone = {}; }
    var oppRows = [];
    asList(sel ? [sel] : S.ghlPipes).forEach(function (pipe) {
      asList(pipe.stages).forEach(function (st) {
        var stName = String(st.name || '');
        if (!FOLLOW_STAGE.test(stName)) return;
        var limit = Number(perStage[stName]);
        if (!(limit >= 0)) limit = 3;
        asList(st.opps).forEach(function (o) {
          if (!o || /^(won|lost|abandon)/i.test(String(o.status || ''))) return;
          var email = String(o.email || '').toLowerCase();
          var c = email ? byEmail[email] : null;
          var last = Math.max(toMs(o.stageChangedAt || o.updatedAt), c ? toMs(c.lastTouch || c.last_touch) : 0, Number(oppDone[o.id]) || 0);
          if (!last) return;
          var days = Math.floor((Date.now() - last) / 86400000);
          if (days < limit) return;
          oppRows.push({ days: days, row: {
            kind: 'follow', why: 'Follow up · ' + days + 'd', act: 'Follow up', opp: 1,
            id: c && c.id ? String(c.id) : 'opp:' + String(o.id || ''), contactId: c && c.id ? String(c.id) : '', ghlContactId: o.contactId || '', oppId: o.id || '',
            name: o.contact || o.name || 'Person', email: o.email || (c && c.email) || '',
            meta: [pipeTitle(stName), pipeTitle(pipe.name || pipe.rawName || ''), o.company || ''].filter(Boolean).join(' · ')
          } });
        });
      });
    });
    oppRows.sort(function (a, b) { return b.days - a.days; }).forEach(function (x) { push(x.row); });
    contacts.forEach(function (c) {
      if (!inPipe(c)) return;
      var d = daysAgo(c.lastTouch || c.last_touch);
      if (d < 14) return;
      push({ kind: 'cold', why: 'Going cold' + (d < 99 ? ' · ' + d + 'd' : ''), act: c.email ? 'Email' : 'Nudge', id: c.id || '', name: c.name || 'Person', email: c.email || '', meta: [normCat(c.category || c.type || 'Contact'), d < 99 ? '' : 'no touch on record'].filter(Boolean).join(' · ') });
    });
    asList(S.reachOut).filter(function (r) { return !r.done; }).forEach(function (r) {
      var c = contacts.filter(function (x) { return r.contactId && String(x.id) === String(r.contactId); })[0] || {};
      if (!inPipe(c, { email: c.email, name: r.name || c.name })) return;
      push({ kind: 'reach', why: 'Reach out', act: c.email ? 'Email' : 'Reach out', id: r.id || '', reachId: r.id || '', contactId: r.contactId || '', name: r.name || c.name || 'Person', email: c.email || '', meta: [r.company || c.company || '', r.nextAction || ''].filter(Boolean).join(' · ') });
    });
    return out.map(function (n, i) { n.color = C6[i % 6]; return n; });
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
      var cards = list.slice(0, S.spaceShowAll ? list.length : 8).map(function (p) {
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
    var driveOn = S.docSource === 'drive';
    var docs = asList(S.staged).length ? asList(S.staged) : asList(S.docs);
    if (driveOn) {
      docs = [];
      function walkDrive(nodes, folder) {
        asList(nodes).forEach(function (n) {
          if (n && n.files) walkDrive(n.files, n.name || folder);
          else if (n && n.children) walkDrive(n.children, n.name || folder);
          if (n && (n.mimeType || n.mime) && !n.files) {
            docs.push({
              id: n.id || n.fileId,
              name: n.name,
              mime: n.mimeType || n.mime,
              driveFileId: n.id || n.fileId,
              folder: folder || 'Drive',
              category: folder || 'Drive',
              url: n.webViewLink || n.url,
              thumbUrl: n.thumbnailLink ? '/api/documents/thumb?id=' + encodeURIComponent(n.id || n.fileId || '') : '',
              stored: true
            });
          }
        });
      }
      walkDrive(S.drives || S.drive || []);
    }
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
    /* Real folders only: what the server returned. No design names in live. */
    var folders = asList(S.docFolders);
    var counts = { 'All documents': docs.length };
    docs.forEach(function (d) {
      var cat = d.category || d.folder || 'Other';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    var folderRows = [['All documents', docs.length, !S.docFolder || S.docFolder === 'All documents']].concat(folders.map(function (name) {
      return [name, counts[name] || 0];
    }));
    var live = {};
    docs.forEach(function (d) { if (d.id) live[String(d.id)] = 1; });
    var setList = asList(S.docSets);
    var setOn = setList.filter(function (s) { return s && s.id === S.docSet; })[0] || null;
    var setRows = setList.map(function (s) {
      var n = asList(s.docIds).filter(function (id) { return live[String(id)]; }).length;
      return [s.name || 'Set', n, s.id, !!(setOn && setOn.id === s.id)];
    });
    /* Folder, set and type filters are applied here, at render time, so counts and the grid agree. */
    var folderOn = String(S.docFolder || '');
    if (folderOn === 'All documents') folderOn = '';
    var typeOn = String(S.docType || 'all').toLowerCase();
    var inSpace = {};
    asList(S.packages).forEach(function (p) {
      asList(p.docs).forEach(function (sd) {
        [sd.driveFileId, sd.id, sd.name].forEach(function (k) { if (k) inSpace[String(k)] = 1; });
      });
    });
    var shown = docs.filter(function (d) {
      var cat = String(d.category || d.folder || 'Other');
      if (folderOn && cat !== folderOn) return false;
      if (setOn && asList(setOn.docIds).indexOf(String(d.id || '')) < 0) return false;
      if (typeOn === 'all' || !typeOn) return true;
      if (typeOn === 'drive') return !!(d.driveFileId || d.fileId);
      if (typeOn === 'space') return !!(inSpace[String(d.driveFileId || '')] || inSpace[String(d.id || '')] || inSpace[String(d.name || '')]);
      return docKind(d) === typeOn;
    });
    var files = shown.map(function (d) {
      var k = docKind(d);
      var drive = String(d.driveFileId || d.fileId || '');
      var loc = drive ? 'ok' : 'loc';
      var bg = { img: '#dfe8ff', ppt: '#ffe6cf', pdf: '#fde9ec', xls: '#e4f6ee', doc: '#e1ecff' }[k] || '#e1ecff';
      var meta = (d.category || 'Library') + ' · ' + (drive ? 'in Drive' : (d.stored ? 'stored here' : 'link only'));
      var uuid = /^[0-9a-f-]{36}$/i.test(String(d.id || '')) ? String(d.id) : '';
      /* First-page preview: Drive renders PDFs, Office and Google files; stored images show as themselves;
         a stored PDF that is not in Drive renders its first page in a small frame. */
      var thumb = d.thumbUrl || (drive ? '/api/documents/thumb?id=' + encodeURIComponent(drive) : (k === 'img' && d.stored && uuid ? '/api/documents/thumb?id=' + uuid : ''));
      var pdfFrame = !drive && k === 'pdf' && d.stored && uuid ? '/api/documents/file?id=' + uuid : '';
      return [k, d.name || 'File', meta, loc, bg, d.url || '', d.id || '', drive, String(d.category || d.folder || 'Other'), String(d.mime || ''), thumb, pdfFrame];
    });
    var spaces = asList(S.packages).slice(0, 5).map(function (p, i) {
      var n = (p.docs || []).length || p.docCount || 0;
      return { ini: initials(p.name), color: C6[i % 6], name: p.name || 'Space', meta: n + ' doc' + (n === 1 ? '' : 's'), id: p.id || '' };
    });
    var recent = docs.slice().sort(function (a, b) { return String(b.createdAt || '').localeCompare(String(a.createdAt || '')); }).slice(0, 4).map(function (d) {
      var k = docKind(d);
      var lab = { img: 'IMG', ppt: 'PPT', pdf: 'PDF', xls: 'XLS', doc: 'DOC' }[k] || 'DOC';
      return ['t-' + k, lab, d.name || 'File'];
    });
    var pick = S.docPick || {};
    var picked = Object.keys(pick).filter(function (id) { return pick[id] && live[id]; }).length;
    liveLog('documents', { docs: docs.length, folders: folders.length, sets: setList.length });
    return {
      folders: folderRows, sets: setRows, files: files, drops: spaces, recent: recent, picked: picked,
      title: setOn ? setOn.name : (folderOn || 'All documents'),
      loading: !S.docsLoaded && !S.docsError, error: !!S.docsError
    };
  }

  function liveLinksState() {
    var S = window.STATE || {};
    var cats = asList(S.categories);
    /* Archived links (soft-deleted, or the legacy note sentinel) never count and never show. */
    var links = asList(S.links).filter(function (l) {
      return l && !l.archived && !l.deleted_at && !l.deletedAt && String(l.note || '') !== '__archived__';
    });
    var seenAll = {};
    var counts = {};
    links.forEach(function (l) {
      var key = l.cat || l.category || 'Uncategorized';
      var uk = String(l.url || '').replace(/\/$/, '').toLowerCase();
      if (seenAll[key + '|' + uk]) return;
      seenAll[key + '|' + uk] = 1;
      counts[key] = (counts[key] || 0) + 1;
    });
    var openKeys = [];
    if (typeof window.linkOpenSet === 'function') openKeys = window.linkOpenSet();
    else {
      try { openKeys = JSON.parse(localStorage.getItem('cr_link_open') || '[]'); } catch (e) { openKeys = []; }
    }
    if (Array.isArray(S.linkOpen) && S.linkOpen.length) openKeys = S.linkOpen;
    var activeCat = S.cat || S.linkCat || '';
    var activeSub = S.sub || '';
    var activeLeaf = S.leaf || '';
    var tree = [];
    tree.push({
      name: 'All links', n: links.length, on: !activeCat,
      car: '', kind: 'all', key: 'all', noSub: true, noHv: true
    });
    cats.forEach(function (c) {
      var name = c.name || c.title || 'Category';
      var key = name;
      var expanded = openKeys.indexOf(key) >= 0;
      var subs = Array.isArray(c.subs) ? c.subs : [];
      var nest = c.nest && typeof c.nest === 'object' ? c.nest : {};
      tree.push({
        name: name, n: counts[name] || 0,
        on: !activeSub && !activeLeaf && name === activeCat,
        car: subs.length ? (expanded ? 'open' : 'closed') : '',
        kind: 'cat', key: key, id: c.id ? String(c.id) : '', noSub: !subs.length, noHv: name === 'Uncategorized'
      });
      if (expanded) {
        subs.forEach(function (sub) {
          var skey = name + '\u001f' + sub;
          var sOpen = openKeys.indexOf(skey) >= 0;
          var kids = Array.isArray(nest[sub]) ? nest[sub] : [];
          var sn = 0;
          links.forEach(function (l) {
            if ((l.cat || l.category) === name && (l.sub || '') === sub) sn += 1;
          });
          tree.push({
            name: sub, n: sn, on: !activeLeaf && name === activeCat && sub === activeSub,
            car: kids.length ? (sOpen ? 'open' : 'closed') : '',
            kind: 'sub', parent: name, key: skey, indent: 2, noSub: true
          });
          if (sOpen) {
            kids.forEach(function (leaf) {
              var ln = 0;
              links.forEach(function (l) {
                if ((l.cat || l.category) === name && (l.sub || '') === sub && (l.leaf || '') === leaf) ln += 1;
              });
              tree.push({
                name: leaf, n: ln, on: name === activeCat && sub === activeSub && leaf === activeLeaf,
                car: '', kind: 'leaf', parent: name, sub: sub, key: skey + '\u001f' + leaf, indent: 3, noSub: true, noHv: true
              });
            });
          }
        });
      }
    });
    if (tree.length <= 1) tree.push({ name: 'Uncategorized', n: links.length, on: !activeCat, car: '', noHv: true, kind: 'cat' });
    var active = activeLeaf || activeSub || activeCat || 'All links';
    var wallSrc = links.filter(function (l) {
      var cat = l.cat || l.category || 'Uncategorized';
      if (activeLeaf) return cat === activeCat && (l.sub || '') === activeSub && (l.leaf || '') === activeLeaf;
      if (activeSub) return cat === activeCat && (l.sub || '') === activeSub;
      if (activeCat && activeCat !== 'Uncategorized') return cat === activeCat;
      return true;
    });
    /* An empty category shows as empty; it no longer falls back to every link. */
    if (!wallSrc.length && !activeCat) wallSrc = links;
    var seen = {};
    var wall = wallSrc.map(function (l) {
      var url = l.url || '';
      var host = hostOf(url);
      var n = (seen[host + '|' + url] = (seen[host + '|' + url] || 0) + 1);
      return [l.title || l.name || host || 'Link', host || url, l.color || '#2e6bf2', l.note || '', n > 1 ? 2 : 1, absUrl(url), l.id || '', l.thumb_url || l.thumbUrl || ''];
    });
    var dups = {};
    wall.forEach(function (w) { var k = String(w[5] || w[1]).replace(/\/$/, ''); dups[k] = (dups[k] || 0) + 1; });
    wall.forEach(function (w) { if (dups[String(w[5] || w[1]).replace(/\/$/, '')] > 1) w[4] = 2; });
    var seenUrl = {};
    wall = wall.filter(function (w) {
      var k = String(w[5] || w[1]).replace(/\/$/, '').toLowerCase();
      if (seenUrl[k]) return false;
      seenUrl[k] = 1;
      return true;
    });
    tree = tree.map(function (t) {
      if (t.on) return Object.assign({}, t, { n: wall.length });
      return t;
    });
    liveLog('links', { cats: cats.length, links: links.length, wall: wall.length });
    return { tree: tree, crumb: active, crumbN: wall.length, wall: wall };
  }

  /* Feed source: the board feed, plus anything live-updates pushed into STATE.mail since. */
  function mailRows(S) {
    var board = asList((S.mailBoard || {}).messages);
    var live = asList(S.mail);
    if (!board.length) return live;
    var seen = {};
    board.forEach(function (m) { seen[String(m.id || m.messageId || '')] = 1; });
    var fresh = live.filter(function (m) {
      var id = String(m.id || m.messageId || '');
      return id && !seen[id] && (m.at || m.date);
    });
    if (!fresh.length) return board;
    return fresh.concat(board).sort(function (a, b) { return toMs(b.at || b.date) - toMs(a.at || a.date); });
  }
  function cleanText(raw) {
    return String(raw == null ? '' : raw)
      .replace(/&nbsp;|&zwnj;|&#8204;|&#847;/g, ' ')
      .replace(INVISIBLE_RE, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
  function attNames(row) {
    return asList(row.attachments || row.att).map(function (a) { return typeof a === 'string' ? a : (a && (a.name || a.filename)) || 'File'; });
  }
  function previewOf(row) {
    var pv = cleanText(row.snippet || row.preview || row.pv || '');
    if (pv) return pv;
    var n = attNames(row).length;
    if (n) return '(no text — ' + n + ' attachment' + (n === 1 ? '' : 's') + ')';
    return '(no preview text)';
  }
  function dayOf(raw) {
    var t = toMs(raw);
    if (!t) return 'Earlier';
    var d = new Date(t).toDateString();
    var now = new Date();
    if (d === now.toDateString()) return 'Today';
    if (d === new Date(now.getTime() - 86400000).toDateString()) return 'Yesterday';
    return 'Earlier';
  }
  function tagLabel(t) {
    if (Array.isArray(t)) return String(t[1] || '');
    return String(t || '');
  }
  /* User columns: server email_columns minus the seeded classifier keys. Ids are server keys. */
  function userColumnsFrom(board, rows) {
    var rules = asList(board.rules);
    return asList(board.columns).filter(function (c) { return c && c.key && !SEEDED_COLS.test(c.key); }).map(function (c, i) {
      var mine = rules.filter(function (r) { return r.target === c.key; });
      return {
        id: c.key, n: c.name || c.key, c: c.color || mailColor(i),
        from: mine.map(function (r) { return r.matchValue; }),
        ruleIds: mine.map(function (r) { return r.id; }),
        ids: rows.filter(function (m) { return m.column === c.key; }).map(function (m) { return String(m.id); })
      };
    });
  }
  window.__mailUserColumns = function () {
    var S = window.STATE || {};
    return userColumnsFrom(S.mailBoard || {}, mailRows(S));
  };
  /* Junk: same order as the server (lib/mail-board isJunk): a 'notjunk' sender rule wins, then 'junk', then the automatic call. */
  function junkRuleHit(r, row) {
    var v = String(r.matchValue || '').toLowerCase().trim();
    var e = String(row.email || '').toLowerCase();
    if (!v || !e) return false;
    if (r.matchType === 'domain') {
      var h = e.split('@')[1] || '';
      v = v.replace(/^@/, '');
      return h === v || h.slice(-(v.length + 1)) === '.' + v;
    }
    if (r.matchType !== 'sender') return false;
    if (e === v) return true;
    if (v.slice(-1) === '@') return e.indexOf(v) === 0;
    return e.indexOf(v) >= 0;
  }
  function junkOf(row, rules) {
    var mine = asList(rules).filter(function (r) { return r && (r.target === 'junk' || r.target === 'notjunk'); });
    if (mine.some(function (r) { return r.target === 'notjunk' && junkRuleHit(r, row); })) return false;
    if (mine.some(function (r) { return r.target === 'junk' && junkRuleHit(r, row); })) return true;
    if (row.junkAuto != null) return !!row.junkAuto;
    if (row.junk != null) return !!row.junk;
    return !!row.bulk && !row.outbound;
  }
  window.__mailJunkOf = junkOf;
  function liveEmailState() {
    var S = window.STATE || {};
    var board = S.mailBoard || {};
    var rows = mailRows(S);
    var counts = board.counts || {};
    var shaped = rows.map(function (row) {
      return {
        id: String(row.id || row.messageId || ''),
        threadId: row.threadId || '',
        messageId: row.messageId || '',
        f: senderName(row),
        e: row.email || '',
        c: row.color || colorFor(row.email || row.from),
        sj: cleanText(row.subject) || '(no subject)',
        pv: previewOf(row),
        t: row.age || ageLabel(toMs(row.at || row.date)),
        at: toMs(row.at || row.date),
        day: dayOf(row.at || row.date),
        un: row.unread ? 1 : 0,
        bulk: !!row.bulk,
        out: !!row.outbound,
        att: attNames(row),
        tag: tagLabel(asList(row.tags)[0]),
        needsNow: !!row.needsNow,
        junk: junkOf(row, board.rules)
      };
    });
    var need = shaped.filter(function (m) { return m.needsNow && !m.bulk; }).length;
    var userCols = userColumnsFrom(board, rows);
    liveLog('email', { messages: rows.length, columns: userCols.length, need: need });
    return {
      need: counts.needs != null ? counts.needs : need,
      unread: counts.unread != null ? counts.unread : shaped.filter(function (m) { return m.un; }).length,
      colN: userCols.length,
      rules: asList(board.rules).length,
      messages: shaped,
      cols: userCols
    };
  }

  function paintPipelineLive() {
    var wrap = wrapOf('pipeDesk');
    if (!wrap) return;
    var S = window.STATE || {};
    /* Board is the default; the legacy STATE.pipeView 'dash' (old Dashboard tab) is not a view here. */
    var view = S.pipeView === 'table' || S.pipeView === 'funnel' ? S.pipeView : 'board';
    var data = pipelineData();
    var catLabel = (!S.pipeType || S.pipeType === 'all') ? 'All' : S.pipeType;
    var ST = data.funnel || [];
    var mx = Math.log((ST.reduce(function (m, s) { return Math.max(m, Number(s[1]) || 0); }, 0) || 0) + 1);
    var funnel = ST.map(function (s, i) {
      var n = Number(s[1]) || 0;
      var h = n ? Math.max(10, Math.round(Math.log(n + 1) / Math.max(mx, 0.001) * 110)) : 6;
      var prev = i > 1 ? (Number(ST[i - 1][1]) || 0) : 0;
      var cv = i <= 1 ? '' : (prev ? Math.min(100, Math.round(n / prev * 100)) + '%' : '–');
      var on = S.ghlStage ? String(S.ghlStage) === String(s[0]) : i === 0;
      return '<div class="st' + (n ? '' : ' zero') + (on ? ' on' : '') + '" data-action="pipe-funnel" data-stage="' + esc(s[0]) + '"><div class="n">' + n + '</div><div class="bx" style="height:' + h + 'px"></div><div class="lb">' + esc(s[0]) + '</div><div class="cv">' + cv + '</div></div>';
    }).join('');
    var rows = (data.rows || []).map(function (r, i) {
      var ini = String(r[0] || '').split(' ').map(function (x) { return x[0]; }).join('').slice(0, 2);
      var id = esc(r[7] || '');
      return '<tr data-action="pipe-open" data-id="' + id + '"><td><div class="who"><span class="av" style="background:' + C6[i % 6] + '">' + esc(ini) + '</span><div><b>' + esc(r[0]) + '</b><span>' + (r[1] ? esc(r[1]) : '&nbsp;') + '</span></div></div></td><td class="cat">' + esc(r[2]) + '</td><td><span class="stg ' + esc(r[4] || '') + '">' + esc(r[3]) + '</span></td><td class="tch">' + esc(r[5]) + (r[5] && r[5] !== '—' ? ' ago' : '') + '</td><td class="nxs">' + esc(r[6]) + '</td><td><div class="ra"><button class="act" data-action="pipe-open" data-id="' + id + '">Open</button></div></td></tr>';
    }).join('');
    var bar =
      '<div class="bar"><h1>Pipeline</h1><span class="sub">GoHighLevel runs it &middot; this is where you work it</span>'
      + '<div class="r"><div class="seg"><span' + (view === 'board' ? ' class="on"' : '') + ' data-action="pipe-view" data-view="board">Board</span><span' + (view === 'table' ? ' class="on"' : '') + ' data-action="pipe-view" data-view="list">List</span><span' + (view === 'funnel' ? ' class="on"' : '') + ' data-action="pipe-view" data-view="funnel">Funnel</span></div><input class="search" data-action="pipe-search" placeholder="Search people or companies" value="' + esc(S.pipeQ || '') + '"></div></div>'
      + '<div class="picker">' + (data.pills || []).map(function (p) {
        return '<button class="pl' + (p.on ? ' on' : '') + '" data-action="pipe-pill"' + (p.id ? ' data-pipe="' + esc(p.id) + '"' : '') + '>' + esc(p.name) + ' <b>' + esc(p.n) + '</b></button>';
      }).join('')
      + (data.more ? '<button class="pl more" data-action="pipe-more">+ ' + data.more + ' more</button>' : '')
      + '<span class="div"></span><button class="pl" data-action="pipe-cat">Category: ' + esc(catLabel) + '</button>'
      + '<span class="ro">' + (data.ro ? esc(data.ro) : ((data.pills || []).length + (data.more || 0)) + ' pipelines from GoHighLevel &middot; read-only') + '</span></div>';
    var tableCard =
      '<section class="card"><div class="ch"><h3>Storage</h3><span class="s">' + esc(data.storageHead || (data.tableFoot || '').replace(/^Showing /, '') || '0') + ' &middot; sorted by needs attention</span></div>'
      + '<table class="tbl"><tr><th>Person / company</th><th>Category</th><th>Stage</th><th>Last touch</th><th>Next step</th><th></th></tr><tbody id="rows">' + rows + '</tbody></table>'
      + '<div class="foot">' + esc(data.tableFoot || '') + ' &middot; <span class="lnk" data-action="pipe-show-all">Show all</span></div></section>';
    var needChip = S.pipeNeedChip || 'all';
    var needsAll = data.needs || [];
    var needsFiltered = needsAll.filter(function (n) { return needChip === 'all' || n.kind === needChip; });
    var needCap = S.pipeNeedAll ? needsFiltered.length : Math.min(9, needsFiltered.length);
    var needsShown = needsFiltered.slice(0, needCap);
    function chipCount(k) { return needsAll.filter(function (n) { return n.kind === k; }).length; }
    var needHtml =
      '<section class="card" style="margin-bottom:14px"><div class="ch"><h3>Needs you today</h3><span class="s">one list &middot; follow-ups due, going cold, and your reach-outs</span><span class="chips2">'
      + [['all', 'All ' + needsAll.length], ['follow', 'Follow up ' + chipCount('follow')], ['cold', 'Going cold ' + chipCount('cold')], ['reach', 'Reach out ' + chipCount('reach')]].map(function (c) {
        return '<span class="c2' + (needChip === c[0] ? ' on' : '') + '" data-action="pipe-need-chip" data-chip="' + c[0] + '">' + esc(c[1]) + '</span>';
      }).join('') + '</span><span class="lnk" style="margin-left:auto" data-action="pipe-add">+ Add a person</span></div><div class="ndg">'
      + (needsShown.length ? needsShown.map(function (n, i) {
        var whyCls = n.kind === 'cold' ? ' amb' : n.kind === 'reach' ? '' : ' red';
        var rowAttrs = ' data-id="' + esc(n.id || '') + '" data-kind="' + esc(n.kind) + '" data-key="' + esc(n.key || '') + '" data-contact="' + esc(n.contactId || '') + '" data-name="' + esc(n.name) + '" data-email="' + esc(n.email || '') + '"'
          + (n.opp ? ' data-opp="' + esc(n.oppId || '') + '" data-ghl-contact="' + esc(n.ghlContactId || '') + '"' : '');
        return '<div class="nd"' + rowAttrs + '><span class="cb" data-action="pipe-need-tick"' + rowAttrs + ' title="Mark handled"></span><span class="av" style="background:' + (n.color || C6[i % 6]) + '">' + esc(initials(n.name)) + '</span><div style="min-width:0"><b>' + esc(n.name) + '</b><span>' + esc(n.meta || '') + '</span></div><span class="why2' + whyCls + '">' + esc(n.why || 'Follow up') + '</span><button class="act" data-action="' + (n.opp ? 'pipe-opp-follow' : 'pipe-follow') + '"' + rowAttrs + '>' + esc(n.act || 'Follow up') + '</button></div>';
      }).join('') : '<div class="nd"><div style="min-width:0"><b>Nobody waiting</b><span>Follow-ups due, people going cold and your reach-outs land here.</span></div></div>')
      + '</div>'
      + (needsFiltered.length > 9 ? '<div class="foot"><span class="lnk" data-action="pipe-need-more">' + (S.pipeNeedAll ? 'Show fewer' : ('Show all ' + needsFiltered.length)) + '</span></div>' : '')
      + '</section>';
    if (view === 'board') {
      var stages = asList(data.board).length || !fixtureOn() ? asList(data.board) : fixtureBoard(ST, data.rows || []);
      var filled = stages.filter(function (s) { return s.opps.length; });
      var empty = stages.filter(function (s) { return !s.opps.length; });
      var colAll = S.pipeColAll || {};
      function cardHtml(o, st) {
        var age = daysAgo(o.updatedAt);
        var sub = o.sub != null ? String(o.sub) : [o.company || '', o.email || '', age < 99 ? age + 'd' : ''].filter(Boolean).join(' · ');
        var hot = o.hot != null ? !!o.hot : age <= 3;
        return '<div class="bcard' + (hot ? ' hot' : '') + '" draggable="true" data-action="contact-drag" data-kind="opp" data-id="' + esc(o.id) + '" data-opp="' + esc(o.id) + '" data-pipe="' + esc(st.pipe) + '" data-stage-id="' + esc(st.id) + '" data-stage="' + esc(st.name) + '" data-contact="' + esc(o.contactId || '') + '" data-email="' + esc(o.email || '') + '" data-name="' + esc(o.contact || o.name || '') + '"><b>' + esc(o.contact || o.name || 'Opportunity') + '</b><span>' + esc(sub || o.name || '') + '</span></div>';
      }
      function colHtml(st, ghost) {
        var all = !!colAll[st.id];
        var shown = all ? st.opps : st.opps.slice(0, 4);
        var more = Math.max(0, st.count - shown.length);
        return '<div class="bcol' + (ghost ? ' ghost' : '') + '" data-action="stage-drop" data-stage="' + esc(st.name) + '" data-stage-id="' + esc(st.id) + '" data-pipe="' + esc(st.pipe) + '"><div class="bch"><b>' + esc(ghost ? ('+ ' + empty.length + ' empty') : st.name) + '</b><span class="c">' + (ghost ? 0 : st.count) + '</span></div>'
          + (ghost
            ? '<div class="emptyb">' + empty.map(function (e) { return esc(e.name); }).join(', ') + '</div>'
            : shown.map(function (o) { return cardHtml(o, st); }).join('')
              + (more && st.opps.length > shown.length ? '<div class="more3" data-action="pipe-col-more" data-stage-id="' + esc(st.id) + '">+ ' + more + ' more</div>' : '')
              + (more && st.opps.length <= shown.length ? '<div class="more3">+ ' + more + ' more</div>' : ''))
          + '</div>';
      }
      var boardCols = filled.map(function (c) { return colHtml(c, false); }).join('')
        + (empty.length ? (S.pipeShowEmpty
          ? empty.map(function (c) { return colHtml(c, false); }).join('')
          : colHtml({ id: '', name: 'empty', pipe: '', count: 0, opps: [] }, true)) : '');
      if (!stages.length) boardCols = '<div class="emptyb">No GoHighLevel pipeline loaded yet.</div>';
      var pipeName = ((data.pills || []).filter(function (p) { return p.on; })[0] || { name: 'Pipeline' }).name;
        wrap.innerHTML = bar + needHtml
        + '<section class="card board pipe-board" id="boardCard"><div class="ch"><h3>' + esc(pipeName) + ' &middot; Board</h3><span class="s">drag a card to move it &middot; writes the stage to GoHighLevel</span>'
        + (empty.length ? '<span class="lnk" style="margin-left:auto" data-action="pipe-empty">' + (S.pipeShowEmpty ? 'Hide empty stages' : '+ ' + empty.length + ' empty stages') + '</span>' : '')
        + '</div><div class="bcols" id="bcols">' + boardCols + '</div></section>';
    } else if (view === 'table') {
      wrap.innerHTML = bar + needHtml + tableCard;
    } else {
      wrap.innerHTML = bar
        + '<section class="card" style="margin-bottom:16px"><div class="ch"><h3>Funnel</h3><span class="s">' + esc(data.funnelLabel || '') + '</span></div>'
        + '<div class="funnel" id="funnel"' + (ST.length !== 13 ? ' style="grid-template-columns:repeat(' + ST.length + ',minmax(0,1fr))"' : '') + '>' + funnel + '</div>'
        + '<div class="cvn">Conversion shown under each stage = share of the previous stage that moved forward. Storage is the holding pen and is not counted.</div></section>';
    }
    wrap.innerHTML += '<div class="pick-ov" id="contactOv" hidden data-action="pipe-close"><div class="pick-box" data-action="note-keep"><h3 id="contactHd">Contact</h3><div id="contactBody"></div><div class="pick-acts"><button class="pri" id="contactFollow" data-action="pipe-follow">Follow up</button><button data-action="pipe-close">Close</button></div></div></div>';
    if (P().finishPaint) P().finishPaint(wrap);
    else if (typeof window.stampDeskControls === 'function') window.stampDeskControls(wrap.getRootNode());
    markReady('pipeDesk');
  }

  /* Hero description: names that have a link (whoLinks, or a hero link whose label appears in the text) are underlined links. */
  function whoHtml(d) {
    var html = esc(d.who || '');
    var pairs = asList(d.whoLinks).length ? asList(d.whoLinks) : asList(d.heroLinks).map(function (l) { return [l.label, l.url]; });
    pairs.forEach(function (p) {
      var name = esc(p[0] || '');
      if (!name || html.indexOf(name) < 0) return;
      html = html.replace(name, '<a class="xl" href="' + esc(p[1] || '#') + '" target="_blank" rel="noopener">' + name + '</a>');
    });
    return html;
  }
  function spaceOpenWanted() {
    var S = window.STATE || {};
    try {
      var q = new URLSearchParams(String(location.search || ''));
      if (q.get('space') === '1' || q.get('open') === '1') return true;
    } catch (e) {}
    return !!(S.pkg && S.pkg.id);
  }
  function spaceOpenData() {
    var S = window.STATE || {};
    if (fixtureOn()) {
      var open = (F().spaces && F().spaces.open) || {};
      if (S.pkg && S.pkg.id && String(S.pkg.id) !== String(open.id) && S.pkg.name && S.pkg.name !== open.name) {
        return liveSpaceOpenFromPkg(S.pkg);
      }
      return open;
    }
    return liveSpaceOpenFromPkg(S.pkg || {});
  }
  /* The angle is its own field (spaces.angle on the server). Notes stay untouched. An angle typed before the
     server stored it may still sit in this browser; it shows only while the server copy is empty, and is
     removed the next time the angle saves. */
  function spaceAngle(p) {
    if (p.angle) return String(p.angle);
    try { return localStorage.getItem('cr_space_angle_' + (p.id || '')) || ''; } catch (e) { return ''; }
  }
  /* First-page preview: stored thumb, a local preview from this session's drop, or the same-origin Drive image. */
  function fileTile(d) {
    var driveId = d.driveFileId || d.drive_file_id || '';
    var kind = docKind(d);
    var local = ((window.STATE || {}).spaceLocalThumbs || {})[d.name || ''];
    /* First-page preview: a stored image thumb first, else Drive's own thumbnail (PDF, Office, Google files, images). */
    var thumb = d.thumbUrl || d.thumb_url || local || (/^[\w-]{8,}$/.test(String(driveId)) ? '/api/documents/thumb?id=' + encodeURIComponent(driveId) : '');
    var colors = { pdf: '#e0364f', ppt: '#e2702b', xls: '#12a36a', img: '#6b4fd8', doc: '#2e6bf2' };
    return { sug: false, bg: '#e1ecff', kind: kind === 'img' ? 'IMG' : kind.toUpperCase(), color: colors[kind] || 'var(--blue)', name: d.name || 'File', sub: driveId ? 'in Drive' : '', inner: thumb ? 'img' : 'pg', thumb: thumb };
  }
  function liveSpaceOpenFromPkg(p) {
    p = p || {};
    var people = asList(p.recipients || p.people);
    var docs = asList(p.docs || p.items).filter(function (d) { return d && d.kind !== 'link' && d.kind !== 'note'; });
    var links = asList(p.docs || p.items).filter(function (d) { return d && d.kind === 'link'; });
    var readyN = 0;
    if (people.length) readyN += 1;
    if (String(p.notes || p.description || '').trim()) readyN += 1;
    if (docs.length) readyN += 1;
    if (links.length) readyN += 1;
    if (/ready|sent|send/i.test(String(p.stage || p.status || ''))) readyN += 1;
    return {
      id: p.id || 'space',
      name: p.name || 'Space',
      group: p.group || p.category || 'General',
      ini: initials(p.name || 'Space'),
      who: p.notes || p.description || p.intel || '',
      tags: [[p.group ? 'vc' : '', p.group || p.category || 'Space']],
      ready: readyN + '/5',
      readyDash: String(Math.round((readyN / 5) * 251.3) + ' 251.3'),
      steps: [
        [people.length ? 'd' : '', 'Person'],
        [String(p.notes || '').trim() ? 'd' : '', 'Notes'],
        [docs.length ? 'd' : '', 'Docs attached'],
        [links.length ? 'd' : '', 'Link added'],
        [/ready|sent|send/i.test(String(p.stage || '')) ? 'd' : '', 'Intro written']
      ],
      angle: spaceAngle(p),
      /* Hooks come from 4orm Intelligence (POST /api/spaces/:id/angle, run by Rewrite); kept for this session. */
      hooks: asList(((window.STATE || {}).spaceHooks || {})[p.id || ''] || p.hooks),
      to: people[0] ? (people[0].name || people[0].email || '') : 'Add a person first',
      subject: p.emailSubject || (p.email && p.email.subject) || p.subject || '',
      intro: p.emailBody || (p.email && p.email.body) || p.intro || '',
      files: docs.map(fileTile),
      heroLinks: (links || []).slice(0, 6).map(function (l) {
        return { label: l.name || l.label || hostOf(l.url || ''), url: l.url || '#' };
      }),
      link: links[0] ? { host: hostOf(links[0].url || links[0].name || ''), label: links[0].name || links[0].url || '' } : null,
      people: people.map(function (r) { return { ini: initials(r.name || r.email || 'P'), name: r.name || r.email || 'Person', meta: r.email || r.company || '', role: r.role || 'Lead' }; }),
      facts: [[p.lastContact || '\u2014', 'last contact'], [String(p.emails || 0), 'emails'], [p.stage || p.status || '\u2014', 'pipeline stage']],
      /* Next steps are saved on the Space (spaces.steps). A list ticked before that shipped may still sit in
         this browser; it shows only while the server copy is empty, and is removed the next time steps save. */
      todos: (function () {
        if (Array.isArray(p.steps) && p.steps.length) return p.steps;
        try { return JSON.parse(localStorage.getItem('cr_space_steps_' + (p.id || '')) || '[]'); } catch (e) { return []; }
      }()),
      notes: p.notes || p.description || '',
      saved: 'Saved',
      /* History from the server (GET /api/spaces/:id): files, links, notes, people, sends, meetings, mail. */
      history: asList(p.history).map(function (h) {
        var lab = { file: ['f', 'F'], link: ['f', 'L'], sent: ['f', 'S'], note: ['n', 'N'], created: ['n', 'C'], person: ['p', 'P'], meeting: ['p', 'M'], email: ['p', 'E'] }[h.kind] || ['n', 'N'];
        var when = '';
        try {
          var at = new Date(h.at);
          if (Number.isFinite(at.getTime())) when = at.toLocaleString('en-CA', { timeZone: 'America/Vancouver', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
        } catch (e) {}
        return { ic: lab[0], label: lab[1], t: h.text || '', when: when, kind: h.kind };
      })
    };
  }
  function paintSpaceOpen(wrap) {
    var S = window.STATE || {};
    if (!S.pkg || !S.pkg.id) {
      if (!fixtureOn()) return;
      var open = (F().spaces && F().spaces.open) || {};
      S.pkg = { id: open.id || 'fixture', name: open.name || 'Space', notes: open.notes || '', docs: [], recipients: [] };
    }
    var d = spaceOpenData();
    var files = asList(d.files).map(function (f) {
      var inner = f.thumb
        ? '<img data-thumb="1" alt="" loading="lazy" src="' + esc(f.thumb) + '">'
        : (f.inner === 'sl' ? '<div class="sl">' + esc(f.sl || f.name) + '</div>' : '<div class="pg"><i></i><i></i><i></i><i></i></div>');
      return '<div class="ft' + (f.sug ? ' sug' : '') + '"><div class="th" style="background:' + esc(f.bg) + '">' + inner + '</div><span class="ty" style="background:' + esc(f.color) + '">' + esc(f.kind) + '</span>' + (f.sug ? '<span class="add">+ Add</span>' : '') + '<div class="nm">' + esc(f.name) + (f.sub ? '<small>' + esc(f.sub) + '</small>' : '') + '</div></div>';
    }).join('');
    var people = asList(d.people).map(function (p) {
      return '<div class="pp"><span class="av" style="background:linear-gradient(140deg,#ffb86b,#e0364f)">' + esc(p.ini) + '</span><div><b>' + esc(p.name) + '</b><span>' + esc(p.meta) + '</span></div><span class="role">' + esc(p.role || 'Lead') + '</span></div>';
    }).join('');
    var todos = asList(d.todos).map(function (t) {
      return '<div class="td' + (t.d ? ' d' : '') + '" data-action="space-todo-toggle" data-id="' + esc(d.id) + '"><i>' + (t.d ? '&#10003;' : '') + '</i><span>' + esc(t.t) + '</span>' + (t.em ? '<em>' + esc(t.em) + '</em>' : '') + '</div>';
    }).join('');
    var hist = asList(d.history).map(function (h) {
      return '<div class="ev"><span class="ic ' + esc(h.ic) + '">' + esc(h.label || (h.ic === 'n' ? 'N' : 'F')) + '</span><span>' + esc(h.t) + '</span><small>' + esc(h.when) + '</small></div>';
    }).join('');
    var touched = asList(d.history).some(function (h) { return h.kind === 'email' || h.kind === 'meeting' || h.kind === 'sent'; });
    var facts = asList(d.facts).map(function (f) {
      return '<div><b>' + esc(f[0]) + '</b><span>' + esc(f[1]) + '</span></div>';
    }).join('');
    var doneN = asList(d.todos).filter(function (t) { return t.d; }).length;
    if (!asList(d.todos).length) {
      todos = asList(d.steps).map(function (s) {
        return '<div class="td' + (s[0] === 'd' ? ' d' : '') + '" data-action="space-todo-toggle" data-id="' + esc(d.id) + '"><i>' + (s[0] === 'd' ? '&#10003;' : '') + '</i><span>' + esc(s[1]) + '</span></div>';
      }).join('');
      doneN = asList(d.steps).filter(function (s) { return s[0] === 'd'; }).length;
    }
    var first = String((asList(d.people)[0] || {}).name || '').split(/[\s@]/)[0] || 'them';
    var gated = !fixtureOn();
    try {
      var sentMap = JSON.parse(localStorage.getItem('cr_space_test') || '{}');
      if (sentMap && sentMap[d.id]) gated = false;
      if (fixtureOn()) gated = false;
    } catch (e) { gated = !fixtureOn(); }
    var readyN = String(d.ready || '0/5').split('/')[0] || '0';
    wrap.insertAdjacentHTML('beforeend',
      '<aside class="spanel space-detail" data-id="' + esc(d.id) + '">'
      + '<div class="crumbs"><a data-action="space-back">&larr; All spaces</a><span>/</span><span>' + esc(d.group) + '</span><span>/</span><span style="color:#fff">' + esc(d.name) + '</span>'
      + '<div class="r"><button class="ghost" data-action="space-prev">&lsaquo; Prev</button><button class="ghost" data-action="space-next">Next &rsaquo;</button><button class="ghost" data-action="space-menu" data-id="' + esc(d.id) + '">&middot;&middot;&middot;</button><button class="ghost close" data-action="space-back" title="Close (Esc)">Close</button></div></div>'
      + '<section class="hero"><div class="bav">' + esc(d.ini) + '</div>'
      + '<div style="position:relative;z-index:1;min-width:0"><div class="tags">' + asList(d.tags).map(function (t) {
        return '<span' + (t[0] === 'vc' ? ' class="vc"' : '') + '>' + esc(t[1]) + '</span>';
      }).join('') + '</div>'
      + '<h1 contenteditable="true" spellcheck="false" data-action="space-card-name" data-id="' + esc(d.id) + '">' + esc(d.name) + '</h1><div class="who" contenteditable="true" spellcheck="false" data-action="space-card-desc" data-id="' + esc(d.id) + '">' + whoHtml(d) + '</div>'
      + '<div class="facts2">' + asList(d.heroLinks).map(function (l) {
        return '<a href="' + esc(l.url) + '" target="_blank" rel="noopener">' + esc(l.label) + '</a>';
      }).join('') + '<span class="src">' + (d.source ? esc('Source: ' + d.source) + ' &middot; ' : '') + '<u data-action="space-hero-link" data-id="' + esc(d.id) + '">+ Add a link or article</u></span></div></div>'
      + '<div class="ready"><div class="rring"><svg viewBox="0 0 96 96" width="96" height="96"><circle cx="48" cy="48" r="40" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="9"/><circle id="rg" cx="48" cy="48" r="40" fill="none" stroke="#2fe08b" stroke-width="9" stroke-linecap="round" stroke-dasharray="' + esc(d.readyDash || '100.5 251.3') + '" transform="rotate(-90 48 48)"/></svg><b id="rn">' + esc(d.ready) + '</b></div>'
      + '<div class="lbl">ready to send</div><div class="steps" id="steps">' + asList(d.steps).map(function (s) {
        return '<span class="' + esc(s[0]) + '"><i>' + (s[0] === 'd' ? '&#10003;' : '') + '</i>' + esc(s[1]) + '</span>';
      }).join('') + '</div></div></section>'
      + '<div class="cols"><div>'
      + '<section class="card"><div class="ch"><h3>The angle</h3><span class="ai">4orm Intelligence</span><span class="lnk" data-action="space-rewrite" data-id="' + esc(d.id) + '" title="Rewrite the angle and suggest hooks with 4orm Intelligence">Rewrite</span><span class="lnk" style="margin-left:10px" data-action="space-research" data-id="' + esc(d.id) + '" title="Research this angle with Perplexity, with sources">Research</span></div>'
      + '<div class="angle" contenteditable="true" data-action="space-angle" data-id="' + esc(d.id) + '" data-placeholder="Add the angle for this send.">' + (fixtureOn() ? (d.angle || '') : esc(d.angle || '')) + '</div>'
      + '<div class="hooks">' + asList(d.hooks).map(function (h) { return '<span data-action="space-hook" data-id="' + esc(d.id) + '" title="Put this hook at the top of the intro">' + esc(h) + '</span>'; }).join('') + '</div></section>'
      + '<section class="card"><div class="ch"><h3>Notes</h3><span class="s">saves as you type</span></div>'
      + '<div class="sticky" contenteditable="true" id="note" data-action="space-notes" data-id="' + esc(d.id) + '">' + esc(d.notes) + '<span class="saved" contenteditable="false">' + esc(d.saved || 'Saved') + '</span></div></section></div>'
      + '<div><section class="card"><div class="ch"><h3>People</h3><span class="s">who this is for</span></div>' + people
      + '<div class="pp addp" data-action="space-people" data-id="' + esc(d.id) + '"><i>+</i>Add people from Contacts or Pipeline</div>'
      + '<div class="facts">' + facts + '</div></section>'
      + '<section class="card"><div class="ch"><h3>Next steps</h3><span class="s" id="tdc">' + doneN + ' of ' + Math.max(asList(d.todos).length, asList(d.steps).length) + ' done</span></div><div class="todo" id="todo">' + todos + '</div></section>'
      + '<section class="card"><div class="ch"><h3>History</h3><span class="s">emails, meetings, files</span></div>'
      + (touched ? '' : '<div class="firsttouch">No contact yet. This bundle will be the first touch.</div>')
      + '<div class="tl">' + hist + '</div></section></div></div>'
      + '<div class="pact"><span class="pst"><b id="pactN">' + esc(d.ready || (readyN + '/5')) + '</b> ready to send &middot; attach the docs and the link, approve the intro</span><div class="r">'
      + '<button class="hb" data-action="space-drive" data-id="' + esc(d.id) + '">Move to Drive</button>'
      + '<button class="hb" data-action="space-book" data-id="' + esc(d.id) + '">Book 20 min</button>'
      + '<button class="hb" data-action="space-email" data-id="' + esc(d.id) + '">Email ' + esc(first) + '</button>'
      + '<button class="hb pri" data-action="space-send" data-id="' + esc(d.id) + '"' + (gated ? ' disabled' : '') + '>Send bundle</button></div></div>'
      + '<section class="bundle"><div class="ch"><h3>The bundle</h3><span class="s">what ' + esc(first) + ' receives &middot; builds as you add</span><span class="lnk" data-action="space-compose" data-id="' + esc(d.id) + '">Open full composer</span></div>'
      + '<div class="bgrid"><div class="bl"><div class="mail"><div class="row"><label>To</label><b>' + esc(d.to) + '</b></div><div class="row"><label>Subject</label><b contenteditable="true" data-action="space-subject" data-id="' + esc(d.id) + '">' + esc(d.subject) + '</b></div>'
      + '<div class="bodyt" contenteditable="true" id="intro" data-action="space-intro" data-id="' + esc(d.id) + '">' + esc(d.intro) + '</div></div></div><div class="br">'
      + '<div class="files" id="files">' + files + '</div>'
      + (d.link ? '<div class="lk"><span class="fv" style="background:#0b1430">4</span><div><b>' + esc(d.link.host) + '</b><span>' + esc(d.link.label) + '</span></div><em class="lkadd" style="color:var(--blue);cursor:pointer" data-action="space-link" data-id="' + esc(d.id) + '">+ Add a saved link</em></div>'
        : '<div class="lk"><em class="lkadd" style="color:var(--blue);cursor:pointer" data-action="space-link" data-id="' + esc(d.id) + '">+ Add a saved link</em></div>')
      + '<div class="drop" data-action="space-docs" data-id="' + esc(d.id) + '">Drop files here, or pick from <b>Documents</b> / <b>Drive</b> &middot; every file shows a first-page preview</div>'
      + '</div></div><div class="sendbar"><span class="via">Sends through <b>GoHighLevel</b> &middot; test copy to chad@4ormfinance.com first</span><div class="r"><button class="btn" data-action="space-send-test" data-id="' + esc(d.id) + '">Send me a test</button><button class="btn pri" data-action="space-send" data-id="' + esc(d.id) + '"' + (gated ? ' disabled' : '') + '>Send to ' + esc(first) + '</button></div></div></section></aside>');
  }
  function paintSpacesLive() {
    var spaceQ = '';
    try { spaceQ = new URLSearchParams(location.search || '').get('space') || ''; } catch (e) {}
    var cardsOn = false;
    try { cardsOn = new URLSearchParams(location.search || '').get('cards') === '1'; } catch (e) {}
    var panelWanted = spaceOpenWanted();
    if (typeof window.paintSpacesCardsPage === 'function' && (spaceQ === 'open' || cardsOn || (!fixtureOn() && !panelWanted))) {
      window.paintSpacesCardsPage(spaceQ === 'open');
      return;
    }
    var arrangeOn = (typeof window.paintSpacesArrangePage === 'function') && (!fixtureOn() || (function () { try { return new URLSearchParams(location.search || '').get('arrange') === '1'; } catch (e) { return false; } })());
    if (arrangeOn && !panelWanted) { window.paintSpacesArrangePage(); return; }
    var wrap = wrapOf('spacesDesk');
    if (!wrap) return;
    var S = window.STATE || {};
    var panelOn = spaceOpenWanted();
    if (panelOn && (!S.pkg || !S.pkg.id)) {
      if (fixtureOn()) {
        var seed = (F().spaces && F().spaces.open) || {};
        S.pkg = { id: seed.id || 'fixture', name: seed.name || 'Space', notes: seed.notes || '', docs: [], recipients: [] };
      } else panelOn = false;
    }
    if (P().applyPageCss) P().applyPageCss(wrap, panelOn ? 'work+spaceOpen' : 'work');
    wrap.classList.toggle('withpanel', !!panelOn);
    var view = S.spaceView || 'groups';
    var data = spacesData();
    var filterLabel = (!S.spaceFilter || S.spaceFilter === 'all') ? 'all' : S.spaceFilter;
    var bar =
      '<div class="bar"><h1>Spaces</h1><span class="sub">Every send-bundle, ready to go &mdash; grouped by who it\'s for</span>'
      + '<div class="r"><div class="seg"><span' + (view === 'groups' ? ' class="on"' : '') + ' data-action="spaces-view" data-view="groups">Groups</span><span' + (view === 'board' ? ' class="on"' : '') + ' data-action="spaces-view" data-view="board">Board</span></div><input class="search" data-action="spaces-search" placeholder="Search spaces or people"><button class="btn" data-action="spaces-filter">Filter: ' + esc(filterLabel) + '</button><button class="btn pri" data-action="spaces-new">+ New space</button></div></div>'
      + '<div class="stats">' + (data.stats || []).map(function (s) {
        return '<div class="sx ' + esc(s.cls || '') + '"><b>' + esc(s.n) + '</b><span>' + esc(s.label) + '</span></div>';
      }).join('') + '</div>';
    var menu = '<div class="menu" id="menu"><div class="lbl">Move to</div><div data-action="space-move-group" data-group="General">General</div><div data-action="space-move-group" data-group="Venture Capital">Venture Capital</div><div data-action="space-move-group" data-group="Business">Business</div><div data-action="space-move-group" data-group="Regulators">Regulators</div><div data-action="space-rename">Rename</div><div class="del" data-action="space-archive">Delete</div></div>';
    function cardHtml(g, s) {
      var na = NA[s[3]] || NA.docs;
      var id = esc(s[4] || ('fx-' + String(s[0] || 'space').replace(/\s+/g, '-')));
      var naAct = s[3] === 'ppl' ? 'space-people' : s[3] === 'send' ? 'space-send' : 'space-docs';
      var openId = (S.pkg && S.pkg.id) || '';
      var cur = !!openId && (String(s[4] || '') === String(openId) || (!s[4] && String((S.pkg && S.pkg.name) || '') === String(s[0] || '')));
      return '<div class="sp' + (cur ? ' cur' : '') + '"' + (panelOn ? ' data-action="space-open" data-space="' + id + '"' : '') + ' data-id="' + id + '"><div class="top2"><span class="cat ' + g[1] + '">' + esc(g[0]) + '</span><span class="ms" title="More" data-action="space-menu" data-id="' + id + '">&middot;&middot;&middot;</span></div><h4 contenteditable="true" spellcheck="false" data-action="space-card-name" data-id="' + id + '">' + esc(s[0]) + '</h4><p contenteditable="true" spellcheck="false" data-action="space-card-desc" data-id="' + id + '">' + esc(s[1]) + '</p><div class="rd">' + ring(s[2]) + '<span class="nxa ' + na[0] + '" data-action="' + naAct + '" data-id="' + id + '">' + na[1] + '</span><span class="cnt wrap">' + (Number(s[5]) || 0) + ' files &middot; ' + (Number(s[6]) || 0) + ' links</span></div><div class="ft"><button class="op" data-action="space-open" data-id="' + id + '"' + (s[4] ? ' data-space="' + id + '"' : '') + '>Open</button><button class="dr" data-action="space-drive" data-id="' + id + '">Move to Drive</button></div></div>';
    }
    var groups = data.groups || [];
    if (S.spaceFilter && S.spaceFilter !== 'all') {
      groups = groups.filter(function (g) { return String(g[0]).toLowerCase() === String(S.spaceFilter).toLowerCase(); });
    }
    if (view === 'board') {
      wrap.innerHTML = bar + '<div class="pipe-board spaces-board">' + groups.map(function (g) {
        return '<div class="pipe-col"><div class="colh"><b>' + esc(g[0]) + '</b><span class="c">' + g[2] + '</span></div>'
          + (g[3] || []).map(function (s) { return cardHtml(g, s); }).join('') + '</div>';
      }).join('') + '</div>' + menu;
    } else {
      wrap.innerHTML = bar
        + '<div id="groups">' + groups.map(function (g) {
          var shown = (g[3] || []).length, rest = g[2] - shown;
          return '<div class="gh" data-action="' + (panelOn ? 'space-back' : 'space-collapse') + '"><span class="car" data-action="space-collapse">&#9662;</span><b>' + esc(g[0]) + '</b><span class="c">' + g[2] + '</span><span class="ln"></span>' + (rest > 0 ? '<span class="lnk" data-action="space-show-all">Show all ' + g[2] + '</span>' : '') + '</div><div class="grid">'
            + (g[3] || []).map(function (s) { return cardHtml(g, s); }).join('')
            + (g[0] === 'General' ? '<div class="addcard" data-action="spaces-new">+ New space</div>' : '') + '</div>';
        }).join('') + '</div>'
        + menu;
    }
    if (panelOn) paintSpaceOpen(wrap);
    if (!window.__spaceEscBound) {
      window.__spaceEscBound = true;
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && window.STATE && window.STATE.pkg) {
          window.STATE.pkg = null;
          if (typeof window.paintRedesignSpaces === 'function') window.paintRedesignSpaces();
        }
      });
    }
    if (S.spaceFocusId) {
      var focusEl = wrap.querySelector('[data-action="space-card-name"][data-id="' + S.spaceFocusId + '"]');
      if (focusEl) {
        focusEl.focus();
        try { document.execCommand('selectAll', false, null); } catch (e) {}
      }
      S.spaceFocusId = '';
    }
    wrap.querySelectorAll('[data-action="space-card-name"], [data-action="space-card-desc"]').forEach(function (node) {
      node.setAttribute('data-orig', node.textContent || '');
    });
    armThumbs(wrap);
    if (P().finishPaint) P().finishPaint(wrap);
    else if (typeof window.stampDeskControls === 'function') window.stampDeskControls(wrap.getRootNode());
    markReady('spacesDesk');
  }

  /* Thumbnail images fall back to the page placeholder when the server has no preview (404). */
  function armThumbs(scope) {
    if (!scope || !scope.querySelectorAll) return;
    scope.querySelectorAll('img[data-thumb]').forEach(function (img) {
      if (img.__armed) return;
      img.__armed = true;
      img.onerror = function () {
        var ph = document.createElement('div');
        ph.className = 'pg';
        ph.innerHTML = '<i class="h"></i><i></i><i></i><i style="width:80%"></i><i></i><i style="width:60%"></i>';
        if (img.parentNode) img.parentNode.replaceChild(ph, img);
      };
    });
  }
  function docTypeLabel(kind, mime) {
    var m = String(mime || '');
    if (/google-apps\.document/.test(m)) return 'Google Doc';
    if (/google-apps\.spreadsheet/.test(m)) return 'Google Sheet';
    if (/google-apps\.presentation/.test(m)) return 'Google Slides';
    return { pdf: 'PDF', ppt: 'PowerPoint', xls: 'Spreadsheet', img: 'Image', doc: 'Document' }[kind] || 'File';
  }
  function when24(iso) {
    var t = Date.parse(String(iso || ''));
    if (!Number.isFinite(t)) return '';
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Vancouver', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(t)).replace(',', '');
    } catch (e) { return new Date(t).toISOString().slice(0, 16).replace('T', ' '); }
  }

  function paintDocumentsLive() {
    var wrap = wrapOf('docsDesk');
    if (!wrap) return;
    var S = window.STATE || {};
    var view = S.docsView || 'grid';
    var source = S.docSource === 'drive' ? 'drive' : 'local';
    var typeOn = S.docType || 'all';
    var data = documentsData();
    var pick = S.docPick || {};
    var L = { img: ['t-img', 'IMG'], ppt: ['t-ppt', 'PPT'], pdf: ['t-pdf', 'PDF'], doc: ['t-doc', 'DOC'], xls: ['t-xls', 'XLS'] };
    var TYPE_CHIPS = [['all', 'All'], ['pdf', 'PDF'], ['ppt', 'Slides'], ['doc', 'Docs'], ['xls', 'Sheets'], ['img', 'Images'], ['space', 'In a Space'], ['drive', 'From Drive']];
    var files = (data.files || []).map(function (f) {
      var inner = (f[0] === 'ppt' || f[0] === 'img') ? '<div class="sl" style="background:linear-gradient(135deg,#1b2f66,#2e6bf2)">' + esc(String(f[1]).split('|')[0]) + '</div>' : '<div class="pg"><i class="h"></i><i></i><i></i><i style="width:80%"></i><i></i><i style="width:60%"></i></div>';
      if (f[10]) inner = '<img data-thumb="1" alt="" loading="lazy" src="' + esc(f[10]) + '" style="width:100%;height:100%;object-fit:cover;object-position:top;display:block">';
      else if (f[11]) inner = '<iframe src="' + esc(f[11]) + '#page=1&toolbar=0&navpanes=0&view=FitH" loading="lazy" tabindex="-1" title="" aria-hidden="true" style="width:100%;height:100%;border:0;pointer-events:none;background:#fff;display:block"></iframe>';
      var href = absUrl(f[5] || '');
      var rawId = String(f[6] || '');
      var id = esc(rawId);
      var on = !!pick[rawId];
      return '<div class="fl' + (on ? ' picked' : '') + '" draggable="true" data-action="doc-open" data-kind="doc" data-id="' + id + '" data-url="' + esc(href) + '" data-web="' + esc(href) + '" data-drive="' + esc(f[7] || '') + '" data-name="' + esc(f[1] || '') + '" data-type="' + esc(f[0] || '') + '" data-folder="' + esc(f[8] || '') + '" data-mime="' + esc(f[9] || '') + '"' + (on ? ' style="box-shadow:0 0 0 2px var(--blue)"' : '') + '><div class="th" style="background:' + f[4] + '">' + inner + '<span class="ty ' + L[f[0]][0] + '">' + L[f[0]][1] + '</span><span class="sync s-' + f[3] + '"></span></div><span class="sel' + (on ? ' on' : '') + '" data-action="doc-pick" data-id="' + id + '" title="Select"></span><div class="nm">' + esc(f[1]) + '</div><div class="mt">' + esc(f[2]) + '</div></div>';
    }).join('');
    var empty = data.error
      ? '<div class="drop">Couldn\'t load - <span class="lnk" data-action="docs-retry">Retry</span></div>'
      : (data.loading ? '<div class="drop">Loading&hellip;</div>' : '<div class="drop">No files here yet.</div>');
    var picked = Number(data.picked) || 0;
    var bulk = picked
      ? '<div class="bulk" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:0 16px 4px;padding:8px 12px;border-radius:10px;background:#eef3ff;font-size:13px"><b>' + picked + ' selected</b><span style="flex:1"></span><button class="btn" data-action="docs-bulk-space">Add to a Space</button><button class="btn" data-action="docs-build-space">Build a new Space</button><button class="btn" data-action="docs-bulk-set">Add to a set</button><button class="btn" data-action="docs-bulk-clear">Clear</button></div>'
      : '';
    var folderRows = data.folders || [];
    wrap.innerHTML =
      '<div class="bar"><h1>Documents</h1><span class="sub">Your staging library &mdash; preview, select, and drop straight into a Space</span>'
      + '<div class="r"><input class="search" data-action="docs-search" placeholder="Search by name, type or what\'s inside"><div class="seg"><span' + (view === 'grid' ? ' class="on"' : '') + ' data-action="docs-view" data-view="grid">Grid</span><span' + (view === 'list' ? ' class="on"' : '') + ' data-action="docs-view" data-view="list">List</span></div><div class="seg"><span' + (source === 'local' ? ' class="on"' : '') + ' data-action="docs-source" data-source="local">Local</span><span' + (source === 'drive' ? ' class="on"' : '') + ' data-action="docs-source" data-source="drive">Drive</span></div><button class="btn" data-action="docs-drive">Pull from Drive</button><button class="btn pri" data-action="docs-upload">Upload</button></div></div>'
      + '<div class="lay"><section class="card"><div class="lh">Folders <span class="lnk" data-action="docs-new-folder">+ New</span></div>'
      + folderRows.map(function (f) {
        var on = S.docSet ? false : (S.docFolder ? String(S.docFolder) === String(f[0]) : !!f[2]);
        return '<div class="fd' + (on ? ' on' : '') + '" data-action="docs-folder" data-folder="' + esc(f[0]) + '">' + esc(f[0]) + '<span class="n">' + f[1] + '</span></div>';
      }).join('')
      + (folderRows.length <= 1 && !fixtureOn() && !data.loading ? '<div style="padding:6px 10px;font-size:12.5px;opacity:.7">No folders yet</div>' : '')
      + '<div class="sepl"></div><div class="lh">Sets <span class="lnk" data-action="docs-new-set">+ New</span></div><div class="sets">'
      + ((data.sets || []).length ? (data.sets || []).map(function (s) {
        return '<div class="fd' + (s[3] ? ' on' : '') + '" data-action="docs-set" data-id="' + esc(s[2] || '') + '">' + esc(s[0]) + '<span class="n">' + s[1] + '</span>'
          + (s[2] && s[3] ? '<span class="lnk" data-action="docs-set-remove" data-id="' + esc(s[2]) + '" data-name="' + esc(s[0]) + '" title="Remove set" style="margin-left:6px">&times;</span>' : '') + '</div>';
      }).join('') : '<div style="padding:6px 10px;font-size:12.5px;opacity:.7">No sets yet. Tick files, then + New.</div>')
      + '</div><div class="sepl"></div><div class="lh">Type</div>'
      + '<div class="types">' + TYPE_CHIPS.map(function (c) {
        return '<button class="chip' + (typeOn === c[0] ? ' on' : '') + '" data-action="docs-type" data-type="' + c[0] + '">' + c[1] + '</button>';
      }).join('') + '</div></section>'
      + '<section class="card ctr"><div class="ch"><h3>' + esc(data.title || 'All documents') + '</h3><span class="s">' + (data.files || []).length + ' files &middot; hover a file to select it, then drop it on a Space</span></div>'
      + bulk
      + '<div class="files' + (view === 'list' ? ' list' : '') + '" id="files">' + (files || empty) + '</div>'
      + '<div class="drop">Drop files here, <span class="lnk" data-action="docs-upload">upload</span> or <span class="lnk" data-action="docs-drive">pull from Drive</span> &mdash; <b>first-page previews</b> appear automatically.</div></section>'
      + '<div class="rs"><section class="card"><div class="ch"><h3>Drop into a Space</h3><span class="s">drag a file here</span></div>'
      + ((data.drops || []).length ? (data.drops || []).map(function (d) {
        return '<div class="sr" data-action="space-drop" data-id="' + esc(d.id || '') + '"><span class="av" style="background:' + d.color + '">' + esc(d.ini) + '</span><div style="min-width:0"><b>' + esc(d.name) + '</b><span>' + esc(d.meta) + '</span></div></div>';
      }).join('') : '<div style="padding:8px 4px;font-size:12.5px"><b>No spaces yet</b><span style="display:block;opacity:.7">Create a Space to drop files into.</span></div>')
      + '<button class="build" data-action="docs-build-space">+ Build a new Space from the selection</button></section>'
      + '<section class="card"><div class="ch"><h3>Recently added</h3></div>'
      + (data.recent || []).map(function (r) {
        return '<div class="ra"><span class="ty ' + r[0] + '">' + r[1] + '</span><span>' + esc(r[2]) + '</span></div>';
      }).join('')
      + '<div class="legend"><span><i style="background:var(--green)"></i>synced to Drive</span><span><i style="background:var(--amber)"></i>only here</span></div></section></div></div>';
    var wantDoc = !!(S.docOpen);
    try {
      var qd = new URLSearchParams(String(location.search || ''));
      if (qd.get('doc') === '1') wantDoc = true;
    } catch (e) {}
    if (wantDoc) {
      var od = S.docOpen || {};
      var meta = od.meta || {};
      var row = asList(S.staged).filter(function (d) { return String(d.id) === String(od.id || ''); })[0] || {};
      var kindOpen = docKind({ name: od.name, mime: od.mime || row.mime });
      var spacesIn = [];
      asList(S.packages).forEach(function (p) {
        var hit = asList(p.docs).some(function (sd) {
          return (od.drive && String(sd.driveFileId || '') === String(od.drive)) || (od.name && String(sd.name || '') === String(od.name));
        });
        if (hit && spacesIn.indexOf(p.name || 'Space') < 0) spacesIn.push(p.name || 'Space');
      });
      var pending = !meta.folder && !meta.failed && !meta.added && !meta.modified;
      var pages = Number(meta.pages) || 0;
      var page = Math.max(1, Math.min(pages || 1, Number(od.page) || 1));
      var stagedPdf = !od.drive && kindOpen === 'pdf' && /^[0-9a-f-]{36}$/i.test(String(od.id || ''));
      /* Fixture viewer sample lives in redesign-fixture-c.js (loaded only with ?fixture=mockup). */
      var dv = fixtureOn() ? Object.assign({ type: 'DOC', name: 'Document', sub: '', folder: '', kind: 'File', modified: '', owner: '', drive: '', spaces: [], note: '', kicker: '', title: 'Document', body: '', page: 1, pages: 1, thumbs: 1 }, (window.REDESIGN_FIXTURE_C || {}).DOC_VIEW || {}) : {
        type: String(od.type || od.kind || 'DOC').toUpperCase(),
        name: od.name || 'Document',
        sub: (meta.folder || od.folder || row.category || '') + (pages > 1 ? ' · ' + pages + ' pages' : ''),
        folder: meta.folder || od.folder || row.category || '-',
        kind: docTypeLabel(kindOpen, meta.mime || od.mime || row.mime),
        modified: when24(meta.modified) || when24(meta.added || row.createdAt) || (pending ? 'Loading' : '-'),
        owner: meta.owner || (od.drive ? (pending ? 'Loading' : '-') : 'You (uploaded here)'),
        drive: od.drive ? 'Synced' : 'Only here',
        spaces: spacesIn,
        note: od.drive ? '' : (stagedPdf && !pages && !pending ? 'Page count unknown for this PDF: scroll inside the page to move through it.' : ''),
        kicker: '', title: od.name || 'Document', body: '',
        page: page, pages: pages, thumbs: stagedPdf && pages > 1 ? Math.min(pages, 40) : 0
      };
      var thumbs = '';
      var i;
      for (i = 1; i <= (Number(dv.thumbs) || 0); i++) thumbs += '<div class="' + (i === Number(dv.page) ? 'on' : '') + '" data-action="doc-thumb" data-n="' + i + '"><span>' + i + '</span></div>';
      /* Live mode: the viewer renders the real file itself (Drive preview, or the same-origin stored copy). */
      var stageInner = '<div class="slide"><small>' + esc(dv.kicker) + '</small><h1>' + esc(dv.title) + '</h1><p>' + esc(dv.body) + '</p></div>';
      var navInner = '<span data-action="doc-slide-prev">&lsaquo;</span>' + esc(dv.page) + ' / ' + esc(dv.pages) + '<span data-action="doc-slide-next">&rsaquo;</span>';
      if (!fixtureOn()) {
        var pptx = /\.pptx?$/i.test(String(od.name || '')) || /powerpoint|presentation/i.test(String(od.mime || ''));
        var fsrc = '';
        if (pptx && od.drive) {
          stageInner = '<div class="slide"><h1>' + esc(dv.name) + '</h1><p>Google Drive cannot preview this file type here.</p><p><button class="vb" data-action="doc-drive-open">Open in Google Drive</button> <button class="vb" data-action="doc-download">Download</button></p></div>';
        } else {
          fsrc = od.drive ? 'https://drive.google.com/file/d/' + encodeURIComponent(od.drive) + '/preview'
            : (/^[0-9a-f-]{36}$/i.test(String(od.id || '')) ? '/api/documents/file?id=' + encodeURIComponent(od.id) + (stagedPdf ? '#page=' + page : '') : '');
          var z = Number(S.docZoom) || 1;
          stageInner = fsrc
            ? '<iframe class="docframe" src="' + esc(fsrc) + '" title="' + esc(dv.name) + '" allow="fullscreen" style="width:100%;height:70vh;border:0;border-radius:10px;background:#fff;display:block;transform:scale(' + z + ');transform-origin:top center"></iframe>'
            : '<div class="slide"><h1>' + esc(dv.name) + '</h1><p>No stored copy to preview yet. Use Open in Drive or upload the file.</p></div>';
        }
        /* Page arrows only when this page can actually be paged (a stored PDF with a known count). Drive previews page by scrolling inside the preview. */
        navInner = pages > 1 && stagedPdf
          ? '<span data-action="doc-slide-prev" title="Previous page">&lsaquo;</span>' + page + ' / ' + pages + '<span data-action="doc-slide-next" title="Next page">&rsaquo;</span>'
          : '<small style="padding:0 8px;opacity:.8">' + (od.drive ? 'Scroll the preview to change page' : 'Scroll to change page') + '</small>';
      }
      wrap.innerHTML +=
        '<div class="vscrim" data-action="doc-close"></div>'
        + '<div class="vwin" id="docView">'
        + '<div class="vtop"><span class="vty">' + esc(dv.type) + '</span><b>' + esc(dv.name) + '</b><small>' + esc(dv.sub) + '</small>'
        + '<div class="r"><button class="vb" data-action="doc-prev">Prev file</button><button class="vb" data-action="doc-next">Next file</button><button class="vb" data-action="doc-download">Download</button><button class="vb" data-action="doc-drive-open">Open in Drive</button><button class="vb pri" data-action="doc-add-space">+ Add to a Space</button><button class="vb" data-action="doc-close" title="Close (Esc)">Close</button></div></div>'
        + '<div class="vbody"><div class="vthumbs">' + thumbs + '</div>'
        + '<div class="vstage">' + stageInner
        + '<div class="vnav">' + navInner + '<span data-action="doc-zoom-out">&#8722;</span><span data-action="doc-zoom-in">+</span><span data-action="doc-fit">Fit</span></div></div>'
        + '<div class="vinfo"><h4>Details</h4>'
        + '<div class="kv"><span>Folder</span><b>' + esc(dv.folder) + '</b></div><div class="kv"><span>Type</span><b>' + esc(dv.kind) + '</b></div><div class="kv"><span>Modified</span><b>' + esc(dv.modified) + '</b></div><div class="kv"><span>Owner</span><b>' + esc(dv.owner) + '</b></div><div class="kv"><span>Drive</span><b style="color:' + (dv.drive === 'Synced' ? '#2fe08b' : '#f5b84a') + '">' + esc(dv.drive) + '</b></div>'
        + '<div class="sp"><h4>In spaces</h4>' + (asList(dv.spaces).length ? asList(dv.spaces).map(function (n) { return '<span class="chip2">' + esc(n) + '</span>'; }).join('') : '<small style="display:block;opacity:.7;margin-bottom:6px">Not in a Space yet</small>') + '<button class="vb add" data-action="doc-add-space">+ Add to ' + (asList(dv.spaces).length ? 'another' : 'a') + ' Space</button></div>'
        + (dv.note ? '<div class="note">' + esc(dv.note) + '</div>' : '') + '</div></div></div>';
    }
    armThumbs(wrap);
    if (P().finishPaint) P().finishPaint(wrap);
    else if (typeof window.stampDeskControls === 'function') window.stampDeskControls(wrap.getRootNode());
    markReady('docsDesk');
  }

  function paintLinksLive() {
    var wrap = wrapOf('linksDesk');
    if (!wrap) return;
    var data = linksData();
    wrap.innerHTML =
      '<div class="bar"><h1>Links</h1><span class="sub">Every bookmark, sorted &mdash; each opens the site in a new tab</span>'
      + '<div class="r"><input class="search" data-action="link-search" placeholder="Search links, notes or sites"></div></div>'
      + '<div class="lay"><section class="card tree"><div class="lh">Categories <span class="lnk" data-action="link-cat-new">+ New</span></div><div id="tree2">'
      + (data.tree || []).map(function (t) {
        var car = t.car === 'open' ? '&#9662;' : t.car === 'closed' ? '&#9656;' : '';
        /* Design 07 tree v2: drag grip on every movable row, a caret only where there are subfolders. */
        var cls = 'cr' + (t.on ? ' on' : '') + (t.kind === 'all' ? ' all' : '') + (t.indent === 2 ? ' sub' : '') + (t.indent === 3 ? ' sub3' : '');
        var kind = t.kind || 'cat';
        var hv = t.noHv ? '' : '<span class="hv">'
          + (t.noSub ? '' : '<span data-action="link-sub" data-name="' + esc(t.parent || t.name) + '">+ sub</span>')
          + '<span data-action="link-rename" data-name="' + esc(t.parent || t.name) + '" data-sub="' + esc(kind === 'sub' ? t.name : '') + '">Rename</span>'
          + (kind === 'cat' ? '<span class="x" data-action="link-hide-cat" data-name="' + esc(t.name) + '">&times;</span>' : '')
          + '</span>';
        var carBtn = car
          ? '<span class="car" data-action="link-toggle" data-key="' + esc(t.key || t.name) + '" data-name="' + esc(t.name) + '">' + car + '</span>'
          : (t.indent ? '' : '<span class="car"></span>');
        if (kind !== 'all') carBtn = '<span class="grip">::</span>' + carBtn;
        var rowId = t.id || (kind === 'all' ? 'all' : (t.key || t.name));
        return '<div class="' + cls + '" draggable="' + (kind === 'all' ? 'false' : 'true') + '" data-action="link-cat" data-id="' + esc(rowId) + '" data-kind="' + esc(kind) + '" data-name="' + esc(t.name) + '" data-parent="' + esc(t.parent || '') + '" data-sub="' + esc(t.sub || '') + '">' + carBtn + esc(t.name) + '<span class="n">' + t.n + '</span>' + hv + '</div>';
      }).join('')
      + '<div class="exp" data-action="link-expand">' + ((window.STATE && window.STATE.linkAllOpen) ? 'Collapse all' : 'Expand all') + '</div><div class="hint2">Drag to reorder. Drop a folder onto another to make it a subfolder.</div></div></section>'
      + '<section class="card"><div class="crumbs">Links &rsaquo; <b>' + esc(data.crumb || '') + '</b> &middot; ' + (data.crumbN || 0) + ' links</div>'
      + '<div class="add"><input data-action="link-title" placeholder="Title (optional - we\'ll read it from the site)"><input data-action="link-url" placeholder="Paste a link - https://"><button data-action="link-add">Add link</button></div>'
      + '<div class="wall" id="wall">' + (data.wall || []).map(function (w) {
        var href = absUrl(w[5] || w[1]);
        var letter = esc(String(w[0] || '?')[0]);
        var id = esc(w[6] || '');
        var thumb = w[7] ? '/api/links/thumb?id=' + encodeURIComponent(w[6] || '') : '';
        var cover = thumb ? '<img alt="" loading="lazy" src="' + esc(thumb) + '" class="thumb">' : '<i style="background:' + w[2] + '">' + letter + '</i>';
        return '<a class="tile" data-action="link-open" href="' + esc(href) + '" target="_blank" rel="noopener noreferrer" data-id="' + id + '" data-url="' + esc(href) + '">' + (w[4] == 2 ? '<span class="dup">Duplicate</span>' : '')
          + '<div class="lg" style="background:' + w[2] + '14">' + cover + '</div>'
          + '<div class="tm"><span title="Edit" data-action="link-edit" data-id="' + id + '" data-title="' + esc(w[0]) + '">Edit</span><span title="Move" data-action="link-move" data-id="' + id + '" data-title="' + esc(w[0]) + '" data-url="' + esc(href) + '">Move</span><span title="Delete" data-action="link-archive" data-id="' + id + '" data-note="' + esc(w[3] || '') + '">&times;</span></div>'
          + '<div class="nb"><b>' + esc(w[0]) + '</b><div class="dm">' + esc(w[1]) + '</div><div class="nt' + (w[3] ? '' : ' empty') + '" data-action="link-note" data-id="' + id + '">' + (w[3] ? esc(w[3]) : 'Add a note') + '</div></div></a>';
      }).join('') + ((data.wall || []).length ? '' : '<div class="hint">No links here yet.</div>') + '</div>'
      + '<div class="hint">Hover a tile to edit, move or delete it.</div></section></div>';
    wrap.querySelectorAll('.lg img.thumb').forEach(function (img) {
      function markLogo() {
        var w = img.naturalWidth || 0, h = img.naturalHeight || 0;
        var wide = h > 0 && w / h >= 1.55;
        var clear = false;
        try {
          if (w && h) {
            var cv = document.createElement('canvas');
            cv.width = Math.min(48, w); cv.height = Math.min(48, h);
            var ctx = cv.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, cv.width, cv.height);
              var data = ctx.getImageData(0, 0, cv.width, cv.height).data;
              var trans = 0;
              for (var i = 3; i < data.length; i += 4) if (data[i] < 12) trans += 1;
              clear = trans / (data.length / 4) > 0.18;
            }
          }
        } catch (e) { clear = false; }
        if (wide || clear) {
          img.classList.add('logo');
          if (img.parentNode) img.parentNode.classList.add('logo');
        }
      }
      if (img.complete && img.naturalWidth) markLogo();
      else img.addEventListener('load', markLogo);
    });
    if (P().finishPaint) P().finishPaint(wrap);
    else if (typeof window.stampDeskControls === 'function') window.stampDeskControls(wrap.getRootNode());
    markReady('linksDesk');
    if (!fixtureOn() && !window.__linksThumbFill) {
      window.__linksThumbFill = true;
      window.__linksThumbReport = { ok: 0, failed: 0, letter: 0 };
      function fillThumbs(offset) {
        var q = offset == null ? '/api/links/preview?backfill=all&offset=0' : '/api/links/preview?backfill=all&offset=' + offset;
        fetch(q, { credentials: 'include' }).then(function (r) { return r.json(); }).then(function (d) {
          if (!d) return;
          window.__linksThumbReport.ok += Number(d.ok || 0);
          window.__linksThumbReport.failed += Number(d.failed || 0);
          window.__linksThumbReport.letter += Number(d.letter || 0);
          if (d.n) {
            if (typeof window.refreshBoard === 'function') window.refreshBoard();
            else if (typeof window.loadBoard === 'function') window.loadBoard();
          }
          if (d.next != null) setTimeout(function () { fillThumbs(d.next); }, 200);
        }).catch(function () {});
      }
      fillThumbs(0);
    }
  }

  /* ---------- Compose (08b): starts empty, holds only what the draft holds ---------- */
  function rcptList(v) {
    return asList(v).map(function (r) {
      if (typeof r === 'string') return { email: r, name: '' };
      return { email: String((r && r.email) || ''), name: String((r && r.name) || '') };
    }).filter(function (r) { return r.email; });
  }
  /* One draft shape. Older callers pass {email, from}; fold that into to[]. */
  function normalizeDraft(raw) {
    var d = Object.assign({}, raw || {});
    if (!Array.isArray(d.to)) {
      var e = String(d.email || (window.STATE || {}).composeTo || '').trim();
      d.to = e ? [{ email: e, name: String(d.from || d.name || '') }] : [];
    }
    d.to = rcptList(d.to);
    d.cc = rcptList(d.cc);
    d.bcc = rcptList(d.bcc);
    d.subject = String(d.subject || '');
    d.body = String(d.body || '');
    d.attachments = asList(d.attachments);
    d.typing = d.typing || {};
    d.nudge = !!d.nudge;
    d.log = !!d.log;
    return d;
  }
  function composeDraft() {
    var S = window.STATE || (window.STATE = {});
    S.composeDraft = normalizeDraft(S.composeDraft);
    S.composeTo = '';
    return S.composeDraft;
  }
  function chipsHtml(list, field) {
    return rcptList(list).map(function (r, i) {
      var label = r.name || r.email;
      return '<span class="pchip" title="' + esc(r.email) + '"><span class="av" style="background:' + colorFor(r.email) + '">' + esc(iniOf(label)) + '</span>' + esc(label) + (r.name ? ' <em>&middot; ' + esc(r.email) + '</em>' : '') + ' <span class="x2" data-action="mail-rcpt-remove" data-field="' + field + '" data-i="' + i + '" title="Remove">&times;</span></span>';
    }).join('');
  }
  function rcptRow(d, field, label, extra) {
    return '<div class="fr sugg" data-field="' + field + '"><label>' + label + '</label><div class="val" id="chips-' + field + '">' + chipsHtml(d[field], field)
      + '<input id="mail-' + field + '" data-action="mail-to" data-field="' + field + '" autocomplete="off" placeholder="Name or email" value="' + esc(d.typing[field] || '') + '"></div>'
      + (extra || '<span></span>') + '<div class="dd" id="dd-' + field + '" style="display:none"></div></div>';
  }
  function contactFor(email) {
    var e = String(email || '').toLowerCase();
    if (!e) return null;
    return asList((window.STATE || {}).contacts).filter(function (c) { return String(c.email || '').toLowerCase() === e; })[0] || null;
  }
  function composeSide(d) {
    var first = d.to[0];
    var c = first ? contactFor(first.email) : null;
    /* B37 / B38: tone rewrite and "tell me what to write" go to /api/mail/write (draft only, never sends). */
    var TONES = [['warm', 'Warm'], ['direct', 'Direct'], ['shorter', 'Shorter'], ['formal', 'More formal']];
    var out = '<div class="box ai2"><h4>4orm Intelligence</h4><p>' + (d.aiNote ? esc(d.aiNote) : 'Pick a tone to rewrite the draft, or tell me what to write. You review it before anything goes out.') + '</p>'
      + '<div class="tones">' + TONES.map(function (t) { return '<span' + (d.tone === t[0] ? ' class="on"' : '') + ' data-action="mail-tone" data-tone="' + t[0] + '">' + t[1] + '</span>'; }).join('') + '</div>'
      + '<div class="ask"><input data-action="mail-ask-input" placeholder="Tell me what to write&hellip;" value="' + esc(d.ask || '') + '"><button type="button" data-action="mail-ai-write">Write</button></div></div>';
    if (c) {
      var touch = daysAgo(c.lastTouch || c.last_touch);
      out += '<div class="box"><h4>' + esc(c.name || first.email) + '</h4>'
        + (c.company ? '<div class="kv2"><span>Company</span><b>' + esc(c.company) + '</b></div>' : '')
        + '<div class="kv2"><span>Category</span><b>' + esc(normCat(c.category || c.type || 'Contact')) + '</b></div>'
        + '<div class="kv2"><span>Stage</span><b>' + esc(c.ghlStage || c.stage || 'new') + '</b></div>'
        + '<div class="kv2"><span>Last touch</span><b>' + (touch >= 99 ? 'none on record' : touch + ' days ago') + '</b></div></div>';
    } else if (first) {
      out += '<div class="box"><h4>' + esc(first.name || first.email) + '</h4><div class="kv2"><span>Contacts</span><b>not in Contacts yet</b></div></div>';
    }
    if (d.attachments.length) {
      var real = d.attachments.filter(attIsReal).length;
      out += '<div class="box"><h4>Attachments</h4><div class="kv2"><span>Files</span><b>' + d.attachments.length + '</b></div><div class="kv2"><span>How they go</span><b>' + (real === d.attachments.length ? 'attached to the email' : real ? real + ' attached, ' + (d.attachments.length - real) + ' as links' : 'as links in the email') + '</b></div></div>';
    }
    return out;
  }
  /* A compose attachment goes as a real file when it has a Drive id, a library id, or uploaded bytes. */
  function attDrive(a) {
    var v = String((a && (a.driveFileId || a.drive_file_id || a.drive)) || '');
    return /^[\w-]{8,200}$/.test(v) && !/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(v) ? v : '';
  }
  function attStaged(a) {
    var v = String((a && (a.stagedId || (a.fromLibrary ? a.id : ''))) || '');
    return /^[0-9a-f-]{36}$/i.test(v) ? v : '';
  }
  function attIsReal(a) { return !!(a && (a.data || attDrive(a) || attStaged(a))); }
  function sizeLabel(n) {
    n = Number(n) || 0;
    if (!n) return '';
    return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
  }
  /* Signature block under the body: editable, can be switched off. Loaded from /api/mail/signature. */
  function sigBlockHtml(d) {
    var S = window.STATE || {};
    var sig = S.mailSig || null;
    var html = d.sigHtml && String(d.sigHtml).replace(/<br\s*\/?>|\s|&nbsp;/gi, '') ? d.sigHtml : (sig && sig.html) || '';
    var off = !!d.sigOff;
    var head = '<div class="sh">Signature' + (sig && sig.source === 'gmail' ? ' &middot; from Gmail' : sig && sig.source === 'saved' ? ' &middot; saved' : '') + '<span class="r">'
      + (html ? '<span data-action="mail-sig-toggle">' + (off ? 'Add it back' : 'Remove') + '</span>' : '')
      + (sig && sig.needsScope ? '<span data-action="mail-sig-save">Save as my signature</span>' : '')
      + '</span></div>';
    var note = '';
    if (!sig) note = '<div class="sn">Loading your Gmail signature&hellip;</div>';
    else if (sig.needsScope && !html) note = '<div class="sn">Signature needs Gmail settings access - reconnect Google in Integrations. Or paste your signature below and click Save as my signature.</div>';
    else if (sig.needsScope) note = '<div class="sn">Signature needs Gmail settings access - reconnect Google in Integrations. Using your saved one.</div>';
    else if (!html) note = '<div class="sn">No Gmail signature found. Type one below if you want it on this email.</div>';
    return '<div class="sig' + (off ? ' off' : '') + '" id="composeSig">' + head + note
      + '<div class="sb" contenteditable="true" data-action="mail-sig" data-placeholder="Signature">' + html + '</div></div>';
  }
  function composeHtml(open) {
    var d = composeDraft();
    var title = d.reply ? 'Reply' : d.fwd ? 'Forward' : 'New email';
    /* The live HTML (links) is kept only while it still matches the text; an AI rewrite or a new draft falls back to the text. */
    var body = d.bodyHtml != null && d.bodyHtmlFor === d.body ? d.bodyHtml : esc(d.body).replace(/\n/g, '<br>');
    var atts = d.attachments.map(function (a, i) {
      var kind = docKind(a);
      var how = attIsReal(a) ? '' : ' <span class="sz">link</span>';
      return '<span class="att' + (a.busy ? ' busy' : '') + '"><span class="ty" style="background:#2e6bf2">' + esc(kind === 'img' ? 'IMG' : String(kind || 'file').toUpperCase()) + '</span>' + esc(a.name || 'File') + (a.size ? ' <span class="sz">' + esc(sizeLabel(a.size)) + '</span>' : '') + how + '<span class="x2" data-action="mail-att-remove" data-i="' + i + '" title="Remove">&times;</span></span>';
    }).join('');
    var cw = Number((window.STATE && window.STATE.prefs && window.STATE.prefs.compose_width) || 0) || 760;
    try { if (!cw) cw = Number(localStorage.getItem('compose_w') || 760) || 760; } catch (e) {}
    cw = Math.max(520, Math.min(cw, Math.max(520, (typeof window !== 'undefined' ? window.innerWidth : 1280) - 240)));
    return '<aside class="compose' + (open ? ' open' : '') + '" id="compose" style="width:' + cw + 'px" aria-hidden="' + (open ? 'false' : 'true') + '"' + (open ? '' : ' inert') + '>'
      + '<div class="cgrab" id="cgrab" data-action="mail-compose-resize" title="Drag to make the email wider or narrower. Double-click to reset." tabindex="0"><b></b></div><span class="cwidth" id="cwidth">' + cw + ' px</span>'
      + '<div class="cw"><div class="ctop"><h2>' + title + '</h2><button class="btn x" id="cclose" data-action="mail-compose-close">Close</button></div>'
      + '<div class="fr"><label>From</label><div class="val from">Chad Johnston &lt;chad@4ormfinance.com&gt;<small>sends from your Gmail</small></div><span></span></div>'
      + rcptRow(d, 'to', 'To', '<span class="sm" data-action="mail-cc-toggle">' + (d.showCc ? 'Hide Cc' : 'Cc &nbsp; Bcc') + '</span>')
      + (d.showCc ? rcptRow(d, 'cc', 'Cc') + rcptRow(d, 'bcc', 'Bcc') : '')
      + '<div class="fr subj"><label>Subject</label><div class="val"><input data-action="mail-subject" placeholder="Subject" value="' + esc(d.subject) + '"></div><span></span></div>'
      + '<div class="tbar"><span data-action="mail-fmt" data-fmt="b" title="Bold (*text*)">B</span><span data-action="mail-fmt" data-fmt="i" title="Italic (_text_)"><i>I</i></span><span data-action="mail-fmt" data-fmt="ul" title="Bullet list">&#8226;</span><span data-action="mail-fmt" data-fmt="ol" title="Numbered list">1.</span><span class="sep"></span><span class="tx" data-action="mail-link" title="Select text, then add a link">Link</span><span class="sep"></span><span data-action="mail-fmt" data-fmt="name" title="Insert first name">{ }</span><span class="sep"></span><span class="tx" data-action="mail-attach-file" title="Attach a file from this computer">Attach file</span><span class="tx" data-action="mail-attach-pick" title="Attach from Documents, Spaces or Drive">From Documents</span></div>'
      + '<div class="body" contenteditable="true" data-action="mail-body" data-placeholder="Write your email">' + body + '</div>'
      + sigBlockHtml(d)
      + (atts ? '<div class="atts">' + atts + '</div>' : '')
      + '<div class="drop" id="composeDrop">Drop files here to attach them</div>'
      + '<input type="file" id="composeFile" multiple hidden style="display:none">'
      + '<div class="cfoot"><button class="send" data-action="mail-send">Send</button><button class="send2" data-action="mail-schedule">' + (d.schedEditId ? 'Update schedule' : 'Schedule') + ' &#9662;</button>'
      + '<span class="tog" data-action="mail-tog" data-k="nudge" role="switch" aria-checked="' + d.nudge + '"><span class="sw' + (d.nudge ? '' : ' off') + '"></span>Nudge in 3 days</span>'
      + '<span class="tog" data-action="mail-tog" data-k="log" role="switch" aria-checked="' + d.log + '"><span class="sw' + (d.log ? '' : ' off') + '"></span>Log to Pipeline</span></div></div>'
      + '<div class="side2" id="composeSide">' + composeSide(d) + '</div></aside>';
  }
  window.__mailCompose = { draft: composeDraft, chips: chipsHtml, side: composeSide, sig: sigBlockHtml, isReal: attIsReal, drive: attDrive, staged: attStaged };

  function iniOf(n) {
    return String(n || '').replace(/\(.*\)/, '').trim().split(' ').map(function (x) { return x[0] || ''; }).join('').slice(0, 2).toUpperCase() || '?';
  }
  function mailViewName() {
    try {
      var q = new URLSearchParams(String(location.search || ''));
      if (q.get('people') === '1' || q.get('view') === 'people' || (window.STATE && window.STATE.mailView === 'people')) return 'people';
    } catch (e) {}
    return 'inbox';
  }
  function peopleIni(n) {
    return String(n || '?').split(' ').map(function (x) { return x[0] || ''; }).join('').slice(0, 2) || '?';
  }
  function peopleFileKind(t) {
    return t === 'p' ? 'PPT' : t === 'D' ? 'DOC' : 'PDF';
  }
  function peopleFileCls(t) {
    return t === 'D' ? 'd' : t === 'p' ? 'p' : '';
  }
  function fileCode(name) {
    var n = String(name || '').toLowerCase();
    if (/\.(ppt|pptx|key)$/.test(n)) return 'p';
    if (/\.(doc|docx|txt|rtf|xls|xlsx|csv)$/.test(n)) return 'D';
    return 'f';
  }
  var URL_RE = /https?:\/\/[^\s<>"')\]]+/g;
  /* Links the person sent or got: pulled from every email body loaded in this session (and previews). */
  function linksFor(msgs) {
    var bodies = (window.STATE || {}).mailBodies || {};
    var seen = {}, out = [];
    msgs.forEach(function (row) {
      var text = String(bodies[row[6]] || '') + ' ' + String(row[2] || '');
      (text.match(URL_RE) || []).forEach(function (u) {
        u = u.replace(/[.,;:]+$/, '');
        if (seen[u] || /unsubscribe|list-manage|\/track|mailchi\.mp|googleusercontent/i.test(u) || out.length >= 40) return;
        seen[u] = 1;
        out.push([hostOf(u), row[1], u]);
      });
    });
    return out;
  }
  /* One box per sender, built from live mail. */
  function deriveBoxes(rows) {
    var by = {};
    rows.forEach(function (row) {
      var email = String(row.email || '').toLowerCase();
      var key = email || String(senderName(row) || '').toLowerCase();
      if (!key) return;
      if (!by[key]) {
        by[key] = {
          id: key.replace(/[^a-z0-9]/g, '').slice(0, 40) || ('b' + Object.keys(by).length),
          n: senderName(row), o: email, c: colorFor(email || key),
          tags: [], in: 0, out: 0, files: [], more: 0, st: ['ok', 'Up to date'],
          last: ageLabel(toMs(row.at || row.date)) || '-', lastAt: toMs(row.at || row.date), m: [], closed: false, addrs: email ? [email] : [], derived: true
        };
      }
      addMail(by[key], row);
    });
    return by;
  }
  function addMail(box, row) {
    var dir = row.outbound || /out|sent|from you/i.test(String(row.dir || row.direction || '')) ? 'out' : 'in';
    if (dir === 'out') box.out += 1; else box.in += 1;
    var at = toMs(row.at || row.date);
    if (at > (box.lastAt || 0)) { box.lastAt = at; box.last = ageLabel(at) || '-'; }
    box.m.push([dir, cleanText(row.subject) || '(no subject)', previewOf(row), row.unread ? 1 : 0, row.threadId || '', row.messageId || '', String(row.id || ''), at]);
    /* [code, name, thumb, gmail message id, attachment id] - the ids let the chip download the real file. */
    asList(row.attachments || row.att).forEach(function (a) {
      if (box.files.length >= 24) return;
      var n = typeof a === 'string' ? a : (a && (a.name || a.filename)) || 'File';
      box.files.push([fileCode(n), n, '', String(row.id || ''), String((a && typeof a === 'object' && a.attachmentId) || '')]);
    });
    if (row.unread && dir === 'in') box.st = ['rep', 'You owe a reply'];
  }
  function storedBoxes(S) {
    var stored = asList(S.emailBoxes);
    if (!stored.length) {
      try { stored = JSON.parse(localStorage.getItem('cr_email_boxes') || '[]'); } catch (e) { stored = []; }
    }
    return stored.filter(function (sb) {
      if (!sb || typeof sb !== 'object') return false;
      var addrs = asList(sb.addrs);
      var n = String(sb.n || sb.name || '').trim();
      if (!addrs.length && /@/.test(String(sb.o || ''))) addrs = [String(sb.o)];
      if (!addrs.length && (!n || /^box$/i.test(n))) return false;
      return !!(n || addrs.length);
    });
  }
  /* Stored boxes (names, tags, order, closed) overlaid on live mail. A new box never hides the others. */
  function liveEmailPeopleState() {
    var S = window.STATE || {};
    var rows = mailRows(S);
    var derived = deriveBoxes(rows);
    var claimed = {};
    var out = storedBoxes(S).map(function (sb) {
      var addrs = asList(sb.addrs).map(function (a) { return String(a).toLowerCase(); });
      if (!addrs.length && /@/.test(String(sb.o || ''))) addrs = [String(sb.o).toLowerCase()];
      var box = Object.assign({}, sb, { addrs: addrs, in: 0, out: 0, m: [], files: [], st: ['ok', sb.m && sb.m.length ? 'Up to date' : 'Nothing yet'], last: '-', lastAt: 0, derived: false });
      addrs.forEach(function (a) { claimed[a] = 1; });
      rows.forEach(function (row) {
        if (addrs.indexOf(String(row.email || '').toLowerCase()) >= 0) addMail(box, row);
      });
      return box;
    });
    /* B59: once Chad has boxes of his own, senders not in any box wait in the "Not in a box yet" strip
       (drag one onto a box to add the address). With no stored boxes yet, every sender still gets a box. */
    var stored = out.length;
    var loose = [];
    var cut = Date.now() - 30 * 86400000;
    Object.keys(derived).forEach(function (k) {
      if (claimed[k]) return;
      var box = derived[k];
      var recent = asList(box.m).filter(function (row) { return (row[7] || 0) >= cut; }).length;
      var hidden = asList(S.emailBoxHidden).map(function (a) { return String(a).toLowerCase(); });
      if (hidden.indexOf(k) >= 0 || hidden.indexOf(String(box.o || '').toLowerCase()) >= 0) return;
      if (!stored) {
        if (recent >= 2) out.push(box);
        return;
      }
      if (/@/.test(k)) loose.push(box);
      else out.push(box);
    });
    out.forEach(function (b) {
      b.m.sort(function (x, y) { return (y[7] || 0) - (x[7] || 0); });
      b.links = linksFor(b.m);
    });
    loose.sort(function (a, b) { return (b.lastAt || 0) - (a.lastAt || 0); });
    var looseRows = loose.slice(0, 12).map(function (b) {
      var top = b.m.slice().sort(function (x, y) { return (y[7] || 0) - (x[7] || 0); })[0] || [];
      return { n: b.n || b.o, e: b.o, c: b.c, pv: top[1] || '' };
    });
    return { boxes: out, loose: looseRows, looseMore: Math.max(0, loose.length - looseRows.length), stored: storedBoxes(S).length };
  }
  window.__peopleState = function () { return liveEmailPeopleState(); };
  function peopleData() {
    if (fixtureOn()) {
      var em = (F().email && F().email.people) || {};
      return { boxes: asList(em.boxes), loose: asList(em.loose), looseMore: Number(em.looseMore || 0) };
    }
    return liveEmailPeopleState();
  }
  function paintEmail08g(wrap, personId, mailIdx) {
    var CAT = { team: ['Team', '#2e6bf2', '#eaf1fe'], inv: ['Investors', '#12a36a', '#e4f6ee'], dp: ['Design partners', '#c98408', '#fff4e0'], reg: ['Regulators', '#6b4fd8', '#efe9ff'], legal: ['Legal', '#e0364f', '#fde9ec'], other: ['Other', '#7a86a0', '#f0f3f8'] };
    var BODY = 'Sending this over before Thursday so you have it in front of you. The two-pager is the short version; the deck has the market numbers and the compliance slide we talked about. Let me know what you would change before it goes to the angels.';
    var PPL = asList((F().email && F().email.people && F().email.people.person08g));
    function card(p) {
      var c = CAT[p.cat];
      return '<div class="pb" data-action="mail-08g-open" data-id="' + p.id + '" style="--c:' + c[1] + ';--cbg:' + c[2] + '"><div class="h"><span class="av" style="background:' + p.col + '">' + p.ini + '</span><div style="min-width:0"><h4>' + esc(p.n) + '</h4><div class="org">' + esc(p.org) + '</div></div><span class="cat">' + c[0] + '</span></div>'
        + '<div class="nums"><div><b>' + p.from + '</b><small>from them</small></div><div><b>' + p.to + '</b><small>from you</small></div><div><b>' + (p.files + p.links) + '</b><small>files, links</small></div><div class="' + (/[mh]$/.test(p.last) ? 'hot' : '') + '"><b>' + p.last + '</b><small>last</small></div></div>'
        + '<div class="lt">Latest</div>' + p.em.slice(0, 3).map(function (e) { return '<div class="em"><b>' + esc(e[1]) + '</b><span>' + esc(e[2]) + '</span></div>'; }).join('')
        + '<div class="ft"><span class="fl">' + p.files + ' files · ' + p.links + ' links</span>' + (p.owe ? '<span class="owe">You owe a reply</span>' : '') + '<span class="go">Open</span></div></div>';
    }
    wrap.innerHTML = '<div class="bar"><h1>Email</h1><div class="seg"><span data-action="mail-view" data-view="inbox">Inbox</span><span class="on" data-action="mail-view" data-view="people">People</span><span>Scheduled</span></div><span class="stat"><b>60</b> unread</span><span class="stat"><b>10</b> need a reply</span></div>'
      + '<div class="grid g08" id="grid">' + PPL.map(card).join('') + '</div>'
      + '<div class="scrim" id="scrim" data-action="mail-08g-close"></div>'
      + '<aside class="pc" id="pc" role="dialog" aria-label="Person"></aside>'
      + '<section class="rd" id="rd" role="dialog" aria-label="Email"></section>'
      + '<div class="toast" id="toast"></div>';
    var tab = 'em';
    var cur = PPL.filter(function (p) { return p.id === personId; })[0] || PPL[0];
    function openMail(ei) {
      var p = cur, e = p.em[ei] || p.em[0], c = CAT[p.cat];
      var rd = wrap.querySelector('#rd');
      var thread = [[p.n, p.ini, p.col, 'Mon 26 Oct, 14:58', 'Hi Chad,|' + BODY + '|One question on slide 1: do we lead with the new AML and compliance rules, or with the record itself? I think the record, but you know the regulators better.|Best regards,|Bruce', true],
        ['Chad Johnston', 'CJ', '#2e6bf2', 'Mon 26 Oct, 11:20', 'Bruce, can you send the latest two-pager and the overview deck? I want both in the investor place card sessions this week.', false],
        [p.n, p.ini, p.col, 'Sun 25 Oct, 19:04', 'FYI - first pass at the AML slide attached. Rough, but the structure is there.', false]];
      rd.innerHTML = '<div class="rdh"><button class="back" data-action="mail-08g-rd-back">&lsaquo; Back to ' + esc(p.n.split(' ')[0]) + '</button><span class="who">' + c[0] + ' · ' + esc(p.org) + '</span><div class="r"><button class="btn" data-action="mail-08g-toast" data-msg="Opens Compose to forward this thread">Forward</button><button class="btn" data-action="mail-08g-toast" data-msg="Files this email into a column">Move to column</button><button class="btn" data-action="mail-08g-toast" data-msg="Adds the thread to a Space">Add to a Space</button><button class="btn" data-action="mail-08g-toast" data-msg="Snoozed until tomorrow 08:00">Snooze</button></div></div>'
        + '<div class="rdb"><div class="rdw"><h1>' + esc(e[1]) + '</h1><div class="meta"><span>' + thread.length + ' messages</span><span>' + p.files + ' attachments</span><span>' + (e[0] === 'in' ? 'You owe a reply' : 'Waiting on them') + '</span></div>'
        + thread.map(function (m, i) {
          return '<div class="msg' + (m[5] ? '' : ' fold') + '" data-action="mail-08g-unfold"><div class="mh"><span class="av" style="background:' + m[2] + '">' + m[1] + '</span><div><b>' + esc(m[0]) + '</b><small>to ' + (m[0] === 'Chad Johnston' ? esc(p.n) : 'Chad Johnston') + '</small></div><span class="t">' + m[3] + '</span></div><div class="body">' + String(m[4]).split('|').map(function (x) { return '<p>' + esc(x) + '</p>'; }).join('') + '</div>'
            + (m[5] ? '<div class="att">' + p.fl.slice(0, 3).map(function (f) { return '<span data-action="mail-08g-toast" data-msg="Opens ' + esc(f[1]) + ' in the viewer"><span class="ty ' + f[0] + '">' + f[0].toUpperCase() + '</span>' + esc(f[1]) + '</span>'; }).join('') + '</div>' : '') + '</div>';
        }).join('')
        + '<div class="reply"><div class="to">Reply to ' + esc(p.n) + ' · signature added</div><div class="ed" contenteditable="true"></div><div class="rf"><button class="btn pri" data-action="mail-08g-toast" data-msg="Shows the recipients, then sends after you confirm">Send</button><button class="btn" data-action="mail-08g-toast" data-msg="Attach from your computer, Documents, Drive or a Space">Attach</button><button class="btn" data-action="mail-08g-toast" data-msg="Select text, then add a link">Link</button><span class="sp"></span><span class="m">Nudge in 3 days</span></div></div></div></div>';
      rd.classList.add('on');
      wrap.querySelectorAll('.row.mail').forEach(function (r) { r.classList.toggle('cur', +r.getAttribute('data-mail') === ei); });
    }
    function openP(id) {
      cur = PPL.filter(function (p) { return p.id === id; })[0] || cur;
      var p = cur, c = CAT[p.cat];
      var pc = wrap.querySelector('#pc');
      pc.style.setProperty('--c', c[1]);
      pc.innerHTML = '<div class="ph"><div class="tl"><span class="cr">Email / People / ' + c[0] + '</span><div class="r"><button class="gb" data-action="mail-08g-prev">&lsaquo; Prev</button><button class="gb" data-action="mail-08g-next">Next &rsaquo;</button><button class="gb" data-action="mail-08g-close">Close</button></div></div>'
        + '<div class="who"><span class="av" style="background:' + p.col + '">' + p.ini + '</span><div style="min-width:0"><h2>' + esc(p.n) + '</h2><div class="role">' + esc(p.role) + ' · ' + esc(p.org) + '</div><div class="tags"><span class="cc">' + c[0] + '</span>' + (p.owe ? '<span>You owe a reply</span>' : '') + '<span>' + (p.from + p.to) + ' emails</span></div></div></div>'
        + '<div class="info"><div><b>' + esc(p.org) + '</b><small>company</small></div><div><b>' + esc(p.role) + '</b><small>role</small></div><div><b>' + esc(p.stage) + '</b><small>pipeline stage</small></div><div><b>' + esc(p.meet) + '</b><small>last meeting</small></div><div class="' + (p.items ? 'hot' : '') + '"><b>' + p.items + ' open</b><small>items owed</small></div><div><b>' + esc(p.first) + '</b><small>first contact</small></div></div></div>'
        + '<div class="tabs"><span data-action="mail-08g-tab" data-t="em" class="' + (tab === 'em' ? 'on' : '') + '">Emails<i>' + p.em.length + '</i></span><span data-action="mail-08g-tab" data-t="fl" class="' + (tab === 'fl' ? 'on' : '') + '">Files<i>' + p.fl.length + '</i></span><span data-action="mail-08g-tab" data-t="lk" class="' + (tab === 'lk' ? 'on' : '') + '">Links<i>' + p.lk.length + '</i></span></div>'
        + '<div class="pbody">' + (tab === 'em' ? p.em.map(function (e, ei) {
          return '<div class="row mail" data-action="mail-08g-mail" data-mail="' + ei + '"><div><b><span class="dir ' + e[0] + '">' + (e[0] === 'in' ? 'In' : 'Out') + '</span>' + esc(e[1]) + '</b><p>' + esc(e[2]) + ' ' + esc(BODY) + '</p></div><div class="r"><span class="m">' + e[3] + '</span></div></div>';
        }).join('') : tab === 'fl' ? (p.fl.length ? p.fl.map(function (f) {
          return '<div class="row"><div><b><span class="ty ' + f[0] + '">' + f[0].toUpperCase() + '</span>' + esc(f[1]) + '</b><p>' + f[2] + ' · from ' + f[3] + '</p></div></div>';
        }).join('') : '<div class="row"><div><b>No files yet</b><p>Attachments from this person land here.</p></div></div>')
          : (p.lk.length ? p.lk.map(function (l) { return '<div class="row"><div><b>' + esc(l[0]) + '</b><p>' + esc(l[1]) + ' · ' + l[2] + '</p></div></div>'; }).join('') : '<div class="row"><div><b>No links yet</b><p>Links found in the emails land here.</p></div></div>'))
        + '</div><div class="pfoot"><button class="btn pri" data-action="mail-compose">Email</button><button class="btn" data-action="mail-08g-toast" data-msg="Opens the calendar with + 4orm Zoom">Book</button><button class="btn" data-action="mail-08g-toast" data-msg="Opens the person in Pipeline">Pipeline</button><button class="btn" data-action="mail-08g-toast" data-msg="Adds to a Space">Add to a Space</button><span class="sp"></span><button class="btn" data-action="mail-08g-toast" data-msg="Opens the full contact">Contact</button></div>';
      pc.classList.add('on');
      wrap.querySelector('#scrim').classList.add('on');
      wrap.querySelectorAll('.pb').forEach(function (b) { b.classList.toggle('cur', b.getAttribute('data-id') === id); });
    }
    wrap.__08g = { openP: openP, openMail: openMail, close: function () {
      wrap.querySelector('#rd').classList.remove('on');
      wrap.querySelector('#pc').classList.remove('on');
      wrap.querySelector('#scrim').classList.remove('on');
    }, PPL: PPL, tabSet: function (t) { tab = t; openP(cur.id); } };
    openP(cur.id);
    if (mailIdx != null && !Number.isNaN(mailIdx)) openMail(mailIdx);
    if (P().finishPaint) P().finishPaint(wrap);
    markReady('mailDesk');
  }
  function sortPeopleBoxes(boxes, sort) {
    var list = boxes.slice();
    var ord = { rep: 0, wait: 1, cold: 2, ok: 3 };
    function t(v) {
      v = String(v || '-');
      if (v === '-') return 1e9;
      var n = parseFloat(v);
      return n * (v.indexOf('m') >= 0 && v.indexOf('min') < 0 && !/mo/.test(v) ? 1 : /h/.test(v) ? 60 : 1440);
    }
    if (sort === 'last contact') list.sort(function (a, b) { return t(a.last) - t(b.last); });
    else if (sort === 'owes a reply') list.sort(function (a, b) { return (ord[(a.st || [])[0]] || 9) - (ord[(b.st || [])[0]] || 9); });
    else if (sort === 'most mail') list.sort(function (a, b) { return (b.in + b.out) - (a.in + a.out); });
    else if (sort === 'A-Z') list.sort(function (a, b) { return String(a.n || '').localeCompare(String(b.n || '')); });
    return list;
  }
  function paintEmailPeople(wrap) {
    var personQ = '';
    var mailQ = '';
    try {
      var qp0 = new URLSearchParams(String(location.search || ''));
      personQ = qp0.get('person') || '';
      mailQ = qp0.get('mail');
    } catch (e0) {}
    if (fixtureOn() && personQ) {
      paintEmail08g(wrap, personQ === 'open' ? 'bf' : personQ, mailQ == null || mailQ === '' ? 0 : Number(mailQ));
      return;
    }
    var S = window.STATE || {};
    var data = peopleData();
    var sort = S.mailPeopleSort || 'my order';
    var tag = S.mailPeopleTag || '';
    var q = String(S.mailPeopleQ || '');
    var panel = S.mailPeoplePanel || '';
    var drawer = !!S.mailPeopleDrawer;
    var menuBox = S.mailPeopleMenu || '';
    var sortOpen = !!S.mailSortOpen;
    var boxMenuOpen = !!S.mailBoxMenuOpen;
    var personId = S.mailPerson || '';
    try {
      var qp = new URLSearchParams(String(location.search || ''));
      if (!personId && qp.get('person')) personId = qp.get('person');
    } catch (e) {}
      var ppTab = S.mailPpTab || 'emails';
    var boxes = sortPeopleBoxes(asList(data.boxes), sort);
    var qn = q.toLowerCase().replace(/^#/, '');
    function matchBox(b) {
      var hay = (b.n + ' ' + b.o + ' ' + asList(b.tags).join(' ') + ' ' + asList(b.files).map(function (f) { return f[1] || f; }).join(' ')).toLowerCase();
      return (!tag || asList(b.tags).indexOf(tag) >= 0) && (!qn || hay.indexOf(qn) >= 0);
    }
    var open = boxes.filter(function (b) { return !b.closed; });
    var closed = boxes.filter(function (b) { return b.closed; });
    var owe = boxes.filter(function (b) { return (b.st || [])[0] === 'rep'; }).length;
    var wait = boxes.filter(function (b) { return (b.st || [])[0] === 'wait'; }).length;
    var inWeek = boxes.reduce(function (a, b) { return a + (Number(b.in) || 0); }, 0);
    var tagCounts = {};
    boxes.forEach(function (b) { asList(b.tags).forEach(function (t) { tagCounts[t] = (tagCounts[t] || 0) + 1; }); });
    var tagKeys = Object.keys(tagCounts).sort();
    var dq = String(S.mailClosedQ || '').toLowerCase();
    var closedShown = closed.filter(function (b) {
      return !dq || (b.n + ' ' + b.o + ' ' + asList(b.tags).join(' ')).toLowerCase().indexOf(dq) >= 0;
    });
    var looseHtml = asList(data.loose).map(function (p) {
      return '<div class="lm" draggable="true" data-action="mail-loose-drag" data-kind="loose" data-id="' + esc(p.e || p.n) + '" data-email="' + esc(p.e || '') + '" data-name="' + esc(p.n) + '" data-from="' + esc(p.n) + '" title="Drag onto a box to file ' + esc(p.e || p.n) + ' there"><span class="av" style="background:' + esc(p.c) + '">' + esc(peopleIni(p.n)) + '</span><div><b>' + esc(p.n) + '</b><span>' + esc(p.pv) + '</span></div></div>';
    }).join('');
    var gridHtml = open.map(function (b) {
      var hide = matchBox(b) ? '' : ' hide';
      var first = String(b.n || '').split(' ')[0];
      var msgs = asList(b.m).slice(0, 3).map(function (row) {
        var d = row[0], sj = row[1], pv = row[2], un = row[3];
        return '<div class="mi" data-action="mail-box-open" data-id="' + esc(b.id) + '"><i class="' + (un ? '' : 'r') + '"></i><div style="min-width:0"><div class="sj">' + esc(sj) + '</div><div class="pv"><span class="dir ' + esc(d) + '">' + (d === 'out' ? 'You:' : esc(first) + ':') + '</span> ' + esc(pv) + '</div></div><em>' + (d === 'out' ? '&uarr;' : '&darr;') + '</em></div>';
      }).join('');
      var files;
      if (fixtureOn()) {
        files = asList(b.files).map(function (f) {
          return '<span data-action="mail-box-file" data-id="' + esc(b.id) + '" data-file="' + esc(f[1] || f) + '" data-mid="' + esc(f[3] || '') + '" data-aid="' + esc(f[4] || '') + '"><i class="' + peopleFileCls(f[0]) + '">' + peopleFileKind(f[0]) + '</i>' + esc(f[1] || f) + '</span>';
        }).join('');
        if (b.more) files += '<span class="more" data-action="mail-box-open" data-id="' + esc(b.id) + '">+ ' + esc(b.more) + ' more</span>';
        if (!asList(b.files).length) files += '<span class="more">no files yet</span>';
      } else {
        var fileN = asList(b.files).length + (Number(b.more) || 0);
        var linkN = asList(b.links).length;
        files = '<span class="more">' + fileN + ' files · ' + linkN + ' links</span>';
      }
      var tags = asList(b.tags).map(function (t) {
        return '<span data-action="mail-people-tag" data-tag="' + esc(t) + '">#' + esc(t) + '</span>';
      }).join('');
      if (!fixtureOn()) {
        var tag0 = asList(b.tags)[0] || 'Other';
        var fileN = asList(b.files).length + (Number(b.more) || 0);
        var linkN = asList(b.links).length;
        var latest = asList(b.m).slice(0, 3).map(function (row) {
          return '<div class="em"><b>' + esc(row[1]) + '</b><span>' + esc(row[2]) + '</span></div>';
        }).join('');
        return '<div class="pb' + hide + '" draggable="true" data-action="mail-box-open" data-id="' + esc(b.id) + '" style="--c:' + esc(b.c || '#2e6bf2') + ';--cbg:#eaf1fe">'
          + '<div class="h"><span class="av" style="background:' + esc(b.c) + '">' + esc(peopleIni(b.n)) + '</span><div style="min-width:0"><h4>' + esc(b.n) + '</h4><div class="org">' + esc(b.o) + '</div></div><span class="cat">' + esc(tag0) + '</span><span class="acts"><span class="m" data-action="mail-box-menu" data-id="' + esc(b.id) + '">More</span><span class="x rmv" data-action="mail-box-remove" data-id="' + esc(b.id) + '">Remove</span></span></div>'
          + '<div class="nums"><div><b>' + esc(b.in) + '</b><small>from them</small></div><div><b>' + esc(b.out) + '</b><small>from you</small></div><div><b>' + (fileN + linkN) + '</b><small>files, links</small></div><div class="' + ((b.st || [])[0] === 'rep' ? 'hot' : '') + '"><b>' + esc(b.last) + '</b><small>last</small></div></div>'
          + '<div class="lt">Latest</div>' + latest
          + '<div class="ft"><span class="fl">' + fileN + ' files · ' + linkN + ' links</span>' + ((b.st || [])[0] === 'rep' ? '<span class="owe">You owe a reply</span>' : '') + '<span class="go">Open</span></div></div>';
      }
      return '<div class="bx' + hide + '" draggable="true" data-action="mail-box-drag" data-kind="box" data-id="' + esc(b.id) + '">'
        + '<div class="bh"><span class="grab" title="Drag to move">Move</span><span class="av" style="background:' + esc(b.c) + '">' + esc(peopleIni(b.n)) + '</span><div style="min-width:0"><b>' + esc(b.n) + '</b><span>' + esc(b.o) + '</span></div><span class="acts"><span class="m" data-action="mail-box-menu" data-id="' + esc(b.id) + '">More</span><span class="x rmv" data-action="mail-box-remove" data-id="' + esc(b.id) + '">Remove</span></span></div>'
        + '<div class="tags">' + tags + '<span class="add" data-action="mail-box-tag-add" data-id="' + esc(b.id) + '">+ tag</span></div>'
        + '<div class="kp"><div><b>' + esc(b.in) + '</b><span>from them</span></div><div><b>' + esc(b.out) + '</b><span>from you</span></div><div><b>' + esc((asList(b.files).length + (Number(b.more) || 0))) + '</b><span>files</span></div><div class="' + ((b.st || [])[0] === 'rep' ? 'warn' : '') + '"><b>' + esc(b.last) + '</b><span>last</span></div></div>'
        + '<div class="last">Latest</div>' + msgs
        + '<div class="files">' + files + '</div>'
        + '<div class="bf"><span class="st ' + esc((b.st || [])[0] || 'ok') + '">' + esc((b.st || [])[1] || '') + '</span><span class="open" data-action="mail-box-open" data-id="' + esc(b.id) + '">Open</span></div></div>';
    }).join('');
    var tagBar = '<span class="lb">Tags</span>' + tagKeys.map(function (t) {
      return '<span class="t' + (tag === t ? ' on' : '') + '" data-action="mail-people-tag" data-tag="' + esc(t) + '">#' + esc(t) + '<em>' + tagCounts[t] + '</em></span>';
    }).join('') + (tag || q ? '<span class="clr" data-action="mail-people-clear">Clear</span>' : '');
    var person = boxes.filter(function (b) { return String(b.id) === String(personId); })[0];
    var ppHtml = '';
    if (person) {
      var first = String(person.n || '').split(' ')[0];
      var lk = asList(person.links);
      var wide = ppTab === 'files' || ppTab === 'links';
      var body;
      function fileThumb(f) {
        var kind = peopleFileKind(f[0]);
        var nm = f[1] || f;
        var col = f[0] === 'p' ? '#e36b1c' : f[0] === 'D' ? '#2e6bf2' : '#e0364f';
        var src = f[2] || '';
        return '<div class="fth" data-action="mail-box-file" data-id="' + esc(person.id) + '" data-file="' + esc(nm) + '" data-mid="' + esc(f[3] || '') + '" data-aid="' + esc(f[4] || '') + '"><div class="pg">' + (src ? '<img alt="" src="' + esc(src) + '">' : '<i></i><i></i><i></i><i></i>') + '</div><span class="ty" style="background:' + col + '">' + esc(kind) + '</span><div class="fn">' + esc(nm) + '</div></div>';
      }
      if (ppTab === 'files') {
        body = asList(person.files).length ? asList(person.files).map(function (f) {
          var nm = f[1] || f;
          var kind = peopleFileKind(f[0]);
          return '<div class="lrow" data-action="mail-box-file" data-id="' + esc(person.id) + '" data-file="' + esc(nm) + '" data-mid="' + esc(f[3] || '') + '" data-aid="' + esc(f[4] || '') + '"><div><b>' + esc(nm) + '</b><small>' + esc(kind) + ' · ' + esc(person.last) + ' · from ' + esc(person.n) + '</small></div><em>Open</em><a data-action="mail-box-file" data-id="' + esc(person.id) + '" data-file="' + esc(nm) + '" data-mid="' + esc(f[3] || '') + '" data-aid="' + esc(f[4] || '') + '">Download</a></div>';
        }).join('') : '<div class="dempty">No files yet.</div>';
      } else if (ppTab === 'links') {
        body = lk.length ? lk.map(function (row) {
          var n = row[0] || row.name || row.url || 'Link';
          var u = row[2] || row.url || '#';
          return '<a class="lrow" href="' + esc(u) + '" target="_blank" rel="noopener"><div><b>' + esc(n) + '</b><small>' + esc(row[1] || row.label || u) + ' · ' + esc(person.last) + '</small></div><em>Open</em></a>';
        }).join('') : '<div class="dempty">No links in these emails yet.</div>';
      } else {
        body = asList(person.m).map(function (row) {
          var d = row[0];
          return '<div class="ppm ' + esc(d) + '" data-action="mail-pp-expand" data-id="' + esc(person.id) + '" data-mid="' + esc(row[6] || '') + '" data-hdr="' + esc(row[5] || '') + '" data-tid="' + esc(row[4] || '') + '" data-sj="' + esc(row[1]) + '" data-pv="' + esc(row[2]) + '" data-dir="' + esc(d) + '" data-who="' + esc(person.n) + '"><span class="ic">' + (d === 'out' ? 'Out' : 'In') + '</span><div style="min-width:0"><div class="w">' + (d === 'out' ? 'You sent' : esc(first) + ' sent') + '</div><div class="sj">' + esc(row[1]) + '</div><div class="pv">' + esc(row[2]) + '</div></div><span class="t">' + esc(ageLabel(row[7]) || person.last) + '</span></div>';
        }).join('') || '<div class="dempty">Nothing here.</div>';
      }
      var role = person.role || String(person.o || '').split('·')[0] || '';
      var company = person.company || person.o || '';
      var stage = person.stage || person.pipelineStage || '—';
      var owed = (person.st && person.st[0] === 'rep') ? 'Reply owed' : 'None';
      var firstContact = person.first || person.since || '—';
      var lastMeet = person.lastMeet || person.lastMeeting || '—';
      ppHtml = '<div class="pph navy"><span class="av" style="background:' + esc(person.c) + '">' + esc(peopleIni(person.n)) + '</span><div style="min-width:0"><h2>' + esc(person.n) + '</h2><div class="sub">' + esc(role) + (company ? ' · ' + esc(company) : '') + '</div></div><div class="acts"><button class="btn" data-action="mail-pp-go" data-go="pipeline" data-id="' + esc(person.id) + '">Pipeline</button><button class="btn" data-action="mail-pp-go" data-go="space" data-id="' + esc(person.id) + '">Space</button><span class="x" data-action="mail-pp-close">&times;</span></div></div>'
        + '<div class="ppk info"><div><b>' + esc(company || '—') + '</b><span>company</span></div><div><b>' + esc(role || '—') + '</b><span>role</span></div><div><b>' + esc(stage) + '</b><span>pipeline stage</span></div><div><b>' + esc(lastMeet) + '</b><span>last meeting</span></div><div><b>' + esc(owed) + '</b><span>open items owed</span></div><div><b>' + esc(firstContact) + '</b><span>first contact</span></div></div>'
        + '<div class="pptabs"><span class="' + (ppTab === 'emails' ? 'on' : '') + '" data-action="mail-pp-tab" data-tab="emails">Emails</span><span class="' + (ppTab === 'files' ? 'on' : '') + '" data-action="mail-pp-tab" data-tab="files">Files</span><span class="' + (ppTab === 'links' ? 'on' : '') + '" data-action="mail-pp-tab" data-tab="links">Links</span></div>'
        + '<div class="ppbody' + (wide ? ' wide' : '') + '"><div class="pptl" id="pptl">' + body + '</div><div class="ppread" id="ppread"><div class="dempty">Click an email to read it here.</div></div></div>'
        + '<div class="ppf"><button class="btn" data-action="mail-pp-go" data-go="compose" data-id="' + esc(person.id) + '">Email ' + esc(first) + '</button><button class="btn" data-action="mail-pp-go" data-go="book" data-id="' + esc(person.id) + '">Book 20 min</button><button class="btn pri" data-action="mail-pp-go" data-go="reply" data-id="' + esc(person.id) + '">Reply to latest</button></div>';
    }
    wrap.innerHTML =
      '<div class="bar"><h1>Email</h1>'
      + '<div class="seg"><span data-action="mail-view" data-view="inbox">Inbox</span><span class="on" data-action="mail-view" data-view="people">People</span>'
      + '<span data-action="mail-view" data-view="sched">Scheduled</span></div>'
      + '<div class="r"><input class="search" data-action="mail-people-search" placeholder="Search names, companies, files or #tags" value="' + esc(q) + '">'
      + '<button class="btn" data-action="mail-closed-toggle">Closed boxes <b id="closedN" class="pill">' + closed.length + '</b></button>'
      + '<button class="btn" data-action="mail-sort-menu" id="sortBtn">Sort: <span id="sortLbl">' + esc(sort) + '</span></button>'
      + '<button class="btn pri" data-action="mail-box-new">+ New box</button></div></div>'
      + (looseHtml ? '<div class="loose"><h5>Not in a box yet<small>drag onto a box, or make one</small></h5><div class="row">' + looseHtml + '</div>'
        + (data.looseMore ? '<span class="hint">+ ' + esc(data.looseMore) + ' more</span>' : '') + '</div>' : '')
      + (!fixtureOn() && !data.stored && asList(S.contacts).some(function (c) { return c.email; })
        ? '<div class="loose"><h5>Boxes are built from your mail<small>one box per person who wrote to you</small></h5><button class="btn" data-action="mail-box-build">Build boxes from my Contacts</button></div>' : '')
      + '<div class="grid" id="grid">' + gridHtml + '<div class="newbx" id="newbx" data-action="mail-box-new">+ New box<small>A person, a company, or a deal. Mail from them lands here from now on.</small></div></div>'
      + '<aside class="drawer' + (drawer ? ' on' : '') + '" id="drawer"><div class="dh"><h3>Closed boxes</h3><span class="s" id="dcount">' + closed.length + ' closed</span><span class="x" data-action="mail-closed-toggle" title="Close list">Close</span></div>'
      + '<input class="dsearch" data-action="mail-closed-search" placeholder="Find a closed box" value="' + esc(S.mailClosedQ || '') + '">'
      + '<div class="dl" id="dl">' + (closedShown.map(function (b) {
        var unread = asList(b.m).some(function (row) { return row[3]; });
        return '<div class="di" data-action="mail-box-reopen" data-id="' + esc(b.id) + '"><span class="av" style="background:' + esc(b.c) + '">' + esc(peopleIni(b.n)) + '</span><div style="min-width:0"><b>' + esc(b.n) + (unread ? '<span class="n">new</span>' : '') + '</b><small>' + esc(b.o) + ' &middot; last ' + esc(b.last) + '</small><div class="tg">' + asList(b.tags).map(function (t) { return '<span>#' + esc(t) + '</span>'; }).join('') + '</div></div><em>Reopen</em></div>';
      }).join('') || '<div class="dempty">Nothing closed.<br>Close a box from More and it waits here.</div>') + '</div>'
      + '<div class="dfoot">Closed boxes keep collecting mail.<a data-action="mail-box-reopen-all">Reopen all</a></div></aside>'
      + '<div class="tab' + (closed.length && !drawer ? '' : ' off') + '" id="dtab" data-action="mail-closed-open">Closed boxes<b>' + closed.length + '</b></div>'
      + '<div class="menu' + (sortOpen ? ' on' : '') + '" id="sortMenu">'
      + [['my order', 'My order (drag to arrange)'], ['last contact', 'Last contact'], ['owes a reply', 'Owes a reply first'], ['most mail', 'Most mail'], ['A-Z', 'A to Z']].map(function (row) {
        return '<div data-action="mail-sort" data-s="' + esc(row[0]) + '"' + (sort === row[0] ? ' class="on"' : '') + '>' + esc(row[1]) + '</div>';
      }).join('') + '</div>'
      + '<div class="menu' + (boxMenuOpen ? ' on' : '') + '" id="boxMenu">'
      + '<div data-action="mail-box-act" data-a="open">Open</div><div data-action="mail-box-act" data-a="rename">Rename</div><div data-action="mail-box-act" data-a="addr">Add an email address</div><div data-action="mail-box-act" data-a="tag">Add a tag</div><div data-action="mail-box-act" data-a="pipeline">Open in Pipeline</div><div data-action="mail-box-act" data-a="space">Open the Space</div><hr><div data-action="mail-box-act" data-a="close">Close box</div><div data-action="mail-box-act" data-a="remove" class="red">Remove box (mail stays in Inbox)</div></div>'
      + '<div class="scrim' + (person ? ' on' : '') + '" id="scrim" data-action="mail-pp-close"></div>'
      + '<aside class="pp' + (person ? ' on' : '') + '" id="pp">' + ppHtml + '</aside>';
    if (P().finishPaint) P().finishPaint(wrap);
    markReady('mailDesk');
  }
  function mailRowAttrs(m) {
    return ' data-id="' + esc(m.id) + '" data-thread="' + esc(m.threadId || '') + '" data-mid="' + esc(m.messageId || '') + '" data-email="' + esc(m.e) + '" data-from="' + esc(m.f) + '" data-subject="' + esc(m.sj) + '" data-preview="' + esc(m.pv) + '"';
  }
  function feedRowHtml(m, inCol) {
    var filed = inCol(m.id);
    var fl = '';
    if (m.tag || (m.att && m.att.length) || filed.length) {
      fl = '<div class="fl">'
        + (m.tag ? '<span>' + esc(m.tag) + '</span>' : '')
        + asList(m.att).map(function (a) {
          var nm = typeof a === 'string' ? a : (a && (a.name || a.filename)) || 'file';
          var aid = a && typeof a === 'object' ? (a.attachmentId || a.id || '') : '';
          return '<span class="att" data-action="mail-att-open" data-mid="' + esc(m.messageId || m.id || '') + '" data-aid="' + esc(aid) + '" data-name="' + esc(nm) + '">File: ' + esc(nm) + '</span>';
        }).join('')
        + filed.map(function (c) { return '<span style="background:' + esc(c.c) + '1a;color:' + esc(c.c) + '">Flag ' + esc(c.n) + '</span>'; }).join('')
        + '</div>';
    }
    var racts = fixtureOn() ? '' : ('<span class="racts"><span class="rowact" data-action="mail-junk" data-junk="' + (m.junk ? '0' : '1') + '"' + mailRowAttrs(m) + ' title="' + (m.junk ? 'Not junk: show mail from this sender again' : 'Junk: hide mail from this sender') + '">' + (m.junk ? 'Not junk' : 'Junk') + '</span>'
      + '<span class="rowact del" data-action="mail-trash"' + mailRowAttrs(m) + ' title="Move to Gmail Trash (undo for 30 days)">Delete</span></span>');
    var cat = String(m.cat || m.tag || m.column || '').toLowerCase();
    var catCls = fixtureOn() ? '' : (/team/.test(cat) ? 'cat-team' : /invest/.test(cat) ? 'cat-inv' : /design/.test(cat) ? 'cat-dp' : /regulat/.test(cat) ? 'cat-rg' : /legal/.test(cat) ? 'cat-lg' : 'cat-ot');
    var catLab = /team/.test(cat) ? 'Team' : /invest/.test(cat) ? 'Investors' : /design/.test(cat) ? 'Design partners' : /regulat/.test(cat) ? 'Regulators' : /legal/.test(cat) ? 'Legal' : (m.tag ? m.tag : 'Other');
    if (!fixtureOn()) {
      if (m.tag && !fl) fl = '<div class="fl"><span class="ctag">' + esc(catLab) + '</span></div>';
      else if (m.tag) fl = fl.replace('<div class="fl">', '<div class="fl"><span class="ctag">' + esc(catLab) + '</span>');
    }
    return '<div class="em ' + catCls + '" draggable="true" data-kind="mail" data-action="mail-open"' + mailRowAttrs(m) + '><span class="un' + (m.un ? '' : ' r') + '"></span><span class="av" style="background:' + esc(m.c) + '">' + esc(iniOf(m.f)) + '</span><div style="min-width:0"><div class="l1"><b>' + esc(m.f) + '</b><span>' + esc(m.e) + '</span></div><div class="sj">' + esc(m.sj) + '</div><div class="pv">' + esc(m.pv) + '</div>' + fl + '</div><div class="rt"><span class="t">' + esc(m.t) + '</span><span class="flag' + (filed.length ? ' on' : '') + '" data-action="mail-flag"' + mailRowAttrs(m) + '>Flag</span>'
      + '</div>' + racts + '</div>';
  }
  function columnHtml(c, msgs) {
    var cards = asList(c.ids).map(function (id) {
      var m = msgs.filter(function (x) { return String(x.id) === String(id); })[0];
      if (!m) return '';
      return '<div class="ce" draggable="true" data-kind="mail" data-action="mail-open"' + mailRowAttrs(m) + '><div class="h"><span class="av" style="background:' + esc(m.c) + '">' + esc(iniOf(m.f)) + '</span><b>' + esc(m.f) + '</b><em>' + esc(m.t) + '</em></div><div class="sj">' + esc(m.sj) + '</div>'
        + asList(m.att).map(function (a) {
          var nm = typeof a === 'string' ? a : (a && (a.name || a.filename)) || 'file';
          var aid = a && typeof a === 'object' ? (a.attachmentId || a.id || '') : '';
          return '<span class="at" data-action="mail-att-open" data-mid="' + esc(m.messageId || m.id || '') + '" data-aid="' + esc(aid) + '" data-name="' + esc(nm) + '">File: ' + esc(nm) + '</span>';
        }).join('') + '</div>';
    }).join('');
    var fromChips = asList(c.from).length
      ? asList(c.from).map(function (f, i) { return '<span class="ch">' + esc(f) + '<em data-action="mail-rule-remove" data-col="' + esc(c.id) + '" data-rule="' + esc(asList(c.ruleIds)[i] || '') + '" data-email="' + esc(f) + '" title="Stop filing this sender here">&times;</em></span>'; }).join('')
      : '<span style="color:var(--ink3)">no one yet - flag an email and tick "Always"</span>';
    return '<div class="col" data-action="mail-col-drop" data-column="' + esc(c.id) + '" data-name="' + esc(c.n) + '" data-id="' + esc(c.id) + '"><div class="colh" draggable="true" data-action="mail-col-drag" data-kind="mailcol" data-id="' + esc(c.id) + '" data-name="' + esc(c.n) + '" title="Drag to reorder"><i style="background:' + esc(c.c) + '"></i><b contenteditable="true" spellcheck="false" data-action="mail-col-title" data-col="' + esc(c.id) + '" data-orig="' + esc(c.n) + '">' + esc(c.n) + '</b><span class="c">' + asList(c.ids).length + '</span><span class="m" data-action="mail-col-menu" data-col="' + esc(c.id) + '" data-name="' + esc(c.n) + '">&middot;&middot;&middot;</span></div>'
      + '<div class="rule"><b>Auto-files</b> new mail from ' + fromChips + '</div>'
      + '<div class="clist">' + (cards || '<div class="cempty">Nothing here yet.<br>Flag an email in the feed, or drag one in.</div>') + '</div></div>';
  }
  /* Reader: built from the clicked email (STATE.mailOpen) and its loaded body (STATE.mailOpenThread). Text only, escaped. */
  function readerHtml(S) {
    var o = S.mailOpen || null;
    var th = S.mailOpenThread || null;
    if (!o) return '<aside class="reader" id="reader"><span class="grab"></span></aside>';
    var from = o.from || o.email || 'Sender';
    var body = th && th.text ? String(th.text) : '';
    var atts = asList((th && th.attachments) || o.att).map(function (a) {
      var n = typeof a === 'string' ? a : (a && (a.name || a.filename)) || 'File';
      var kind = docKind({ name: n, mime: a && (a.mime || a.mimeType) });
      var aid = (a && typeof a === 'object' && a.attachmentId) || '';
      var dl = aid ? ' data-action="mail-att-open" data-mid="' + esc((th && th.id) || o.id || '') + '" data-aid="' + esc(aid) + '" data-name="' + esc(n) + '" title="Download"' : '';
      return '<span class="att"' + dl + '><span class="ty" style="background:#2e6bf2">' + esc(kind === 'img' ? 'IMG' : kind.toUpperCase()) + '</span>' + esc(n) + '</span>';
    }).join('');
    var when = th && th.at ? new Date(th.at).toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short', hour12: false }) : '';
    var attrs = ' data-id="' + esc(o.id) + '" data-thread="' + esc((th && th.threadId) || o.threadId || '') + '" data-mid="' + esc((th && th.messageId) || o.messageId || '') + '" data-email="' + esc(o.email) + '" data-from="' + esc(from) + '" data-subject="' + esc(o.subject) + '"';
    return '<aside class="reader open" id="reader"' + attrs + '><span class="grab"></span>'
      + '<div class="rh"><span class="av" style="background:' + colorFor(o.email || from) + ';width:36px;height:36px">' + esc(iniOf(from)) + '</span><div><h2>' + esc(o.subject || '(no subject)') + '</h2></div><button class="btn x" id="close" data-action="mail-close">Close</button></div>'
      + '<div class="rmeta">' + esc(from) + (o.email ? ' &lt;' + esc(o.email) + '&gt;' : '') + (th && th.to ? ' &middot; to ' + esc(th.to) : '') + (when ? ' &middot; ' + esc(when) : '') + '</div>'
      + '<div class="acts"><button class="p" data-action="mail-reply"' + attrs + '>Reply</button><button data-action="mail-forward"' + attrs + '>Forward</button><button data-action="mail-add-space"' + attrs + '>Add to Space</button><button data-action="mail-snooze"' + attrs + '>Snooze</button><button data-action="mail-trash"' + attrs + ' title="Move to Gmail Trash (undo for 30 days)">Delete</button></div>'
      + (atts ? '<div class="atts">' + atts + '</div>' : '')
      + '<div class="bd" style="white-space:pre-wrap">' + (body ? esc(body) : (S.mailOpenFailed ? esc(o.preview || '') + '\n\n(Could not load the full email.)' : esc(o.preview || '') + '\n\nLoading the full email…')) + '</div></aside>';
  }
  /* Typing in compose must not be wiped by a background repaint (live updates poll). */
  function composeBusy(wrap) {
    var root = wrap.getRootNode && wrap.getRootNode();
    var a = root && root.activeElement;
    return !!(a && a.closest && a.closest('#compose'));
  }
  function paintEmailLive() {
    var wrap = wrapOf('mailDesk');
    if (!wrap) return;
    var S = window.STATE || {};
    if (S.composeOpen && !S.mailPaintForce && composeBusy(wrap)) return;
    S.mailPaintForce = false;
    var data = emailData();
    var view = mailViewName();
    if (view === 'people') {
      if (P().applyPageCss) P().applyPageCss(wrap, 'mailPeople');
      paintEmailPeople(wrap);
      return;
    }
    if (P().applyPageCss) P().applyPageCss(wrap, 'mail');
    var tab = S.mailFeedTab || data.feedTab || 'everything';
    var openCompose = /(?:^|[?&])(?:compose=1|state=compose)(?:&|$)/.test(String(location.search || '')) || !!(S.composeOpen);
    if (openCompose && fixtureOn() && !(S.composeDraft && S.composeDraft.body)) {
      S.composeDraft = {
        to: [{ name: 'Joe Canavan', email: 'joe@canavan.vc' }],
        subject: 'Evidence standard for Canadian fintech — 15 minutes?',
        body: 'Hi Joe,\n\nMost of your angel book is Canadian fintech — Wealthsimple, Borrowell, CapIntel, Homewise. All of them now have to prove a recommendation was suitable and understood, not just disclosed.\n\nThat record is what 4orm builds. We\'re closing a $250K friends-and-family round by Oct 30 and opening 4ormIQ to brokers on Oct 23.\n\nWould 15 minutes Thursday or Friday work? Here\'s my calendar: book.4ormfinance.com/chad\n\nChad',
        typing: { to: 'neil' },
        tone: 'warm',
        nudge: true,
        log: true,
        attachments: [{ name: '4orm VC and Design Partner Resources.pdf' }, { name: 'Business Overview | 2026' }]
      };
    }
    var msgs = asList(data.messages);
    var cols = asList(data.cols);
    var isFix = fixtureOn();
    function inCol(id) { return cols.filter(function (c) { return asList(c.ids).map(String).indexOf(String(id)) >= 0; }); }
    var feedHtml = '';
    var last = '';
    /* Live chips: Junk mail shows only under Junk. Fixture matches 08d (Everything / People / Unread). */
    var TAB_TEST = isFix ? {
      everything: function () { return true; },
      people: function (m) { return !(m.bulk || /bulk/i.test(m.tag || '')); },
      unread: function (m) { return !!m.un; }
    } : {
      everything: function (m) { return !m.junk; },
      notmoved: function (m) { return !m.junk && !inCol(m.id).length; },
      people: function (m) { return !m.junk && !(m.bulk || /bulk/i.test(m.tag || '')); },
      unread: function (m) { return !m.junk && !!m.un; },
      junk: function (m) { return !!m.junk; }
    };
    if (!TAB_TEST[tab]) tab = 'everything';
    var tabN = {};
    Object.keys(TAB_TEST).forEach(function (k) { tabN[k] = msgs.filter(TAB_TEST[k]).length; });
    var shown = 0;
    msgs.forEach(function (m) {
      if (!TAB_TEST[tab](m)) return;
      shown += 1;
      if (m.day && m.day !== last) { feedHtml += '<div class="day">' + esc(m.day) + '</div>'; last = m.day; }
      feedHtml += feedRowHtml(m, inCol);
    });
    if (!msgs.length) feedHtml = '<div class="cempty" style="padding:18px">' + (S.mailBoard ? 'No mail in the last 45 days.' : 'Loading your mail…') + '</div>';
    else if (!shown) feedHtml = '<div class="cempty" style="padding:18px">' + (tab === 'junk' ? 'No junk. System mail, receipts and newsletters land here.' : tab === 'notmoved' ? 'Everything is filed into a column.' : 'Nothing here.') + '</div>';
    function tabChip(key, label) {
      return '<span class="' + (tab === key ? 'on' : '') + '" data-action="mail-feed-tab" data-tab="' + key + '">' + label + (isFix ? '' : ' <em>' + (tabN[key] || 0) + '</em>') + '</span>';
    }
    /* A half-typed column name survives a background repaint. */
    var nc0 = wrap.querySelector && wrap.querySelector('#newcolIn');
    var ncVal = nc0 ? String(nc0.value || '') : '';
    var ncFocus = !!(nc0 && wrap.getRootNode && wrap.getRootNode().activeElement === nc0);
    var feed0 = wrap.querySelector && wrap.querySelector('#feed');
    var feedTop = feed0 && S.mailFeedTabShown === tab ? feed0.scrollTop : 0;
    S.mailFeedTabShown = tab;
    var colsHtml = cols.map(function (c) { return columnHtml(c, msgs); }).join('');
    var schedSeg = isFix ? '' : '<span data-action="mail-sched-list">Scheduled' + ((S.mailSchedCount | 0) > 0 ? ' <em>' + (S.mailSchedCount | 0) + '</em>' : '') + '</span>';
    var tabsHtml = isFix
      ? tabChip('everything', 'Everything') + tabChip('people', 'People') + tabChip('unread', 'Unread')
      : tabChip('everything', 'Everything') + tabChip('notmoved', 'Not moved') + tabChip('people', 'People') + tabChip('unread', 'Unread') + tabChip('junk', 'Junk');
    var newColHtml = isFix
      ? '<div class="newcol" id="newcol" data-action="mail-col-new">+ New column<small>Name it anything: a deal, a person, a topic</small></div>'
      : '<div class="newcol" id="newcol" data-action="mail-col-focus"><b>+ New column</b>'
        + '<input id="newcolIn" data-action="mail-col-name" maxlength="60" autocomplete="off" placeholder="Name it anything: a deal, a person, a topic" value="' + esc(ncVal) + '">'
        + '<span class="ncrow"><button type="button" class="ncadd" data-action="mail-col-add">Add</button><span class="nchint">Enter adds &middot; Esc cancels</span></span></div>';
    wrap.innerHTML =
      '<div class="bar"><h1>Email</h1>'
      + '<div class="seg"><span class="' + (view === 'inbox' ? 'on' : '') + '" data-action="mail-view" data-view="inbox">Inbox</span><span class="' + (view === 'people' ? 'on' : '') + '" data-action="mail-view" data-view="people">People</span>' + schedSeg + '</div>'
      + '<div class="cnt"><span><b>' + esc(data.unread != null ? data.unread : msgs.filter(function (m) { return m.un; }).length) + '</b> unread</span><span><b>' + esc(data.need != null ? data.need : 0) + '</b> need a reply</span><span><b>' + esc(cols.length) + '</b> columns</span></div>'
      + '<div class="r"><input class="search" data-action="mail-search" placeholder="Search all mail" value="' + esc(S.mailQ || '') + '"><button class="btn" data-action="mail-filters">Filters</button><button class="btn pri" id="composeBtn" data-action="mail-compose">Compose</button></div></div>'
      + '<div class="lay"><section class="feed"><div class="fh"><h3>' + (S.mailQ ? 'Search: ' + esc(S.mailQ) : 'All mail') + '</h3><span class="s">one feed, newest first</span><div class="tabs">'
      + tabsHtml
      + '</div></div><div id="feed">' + feedHtml + '</div><div class="foot">' + (isFix ? 'Showing today and yesterday &middot; scroll for more' : (shown + ' of ' + msgs.length + ' emails &middot; ' + (S.mailQ ? 'last 90 days' : 'last 45 days in your inbox'))) + '</div></section>'
      + '<section><div class="colsh"><h3>Your columns</h3><span class="s">you make these &middot; flag any email to file it &middot; drag a column to reorder</span><span class="lnk" data-action="mail-col-new">+ New column</span></div>'
      + '<div class="cols" id="cols">' + colsHtml + newColHtml + '</div></section></div>'
      + '<div class="pop" id="pop"><h6>Add to a column</h6><p id="popwho"></p><div id="popopts"></div><label class="always"><input type="checkbox" id="always" data-action="mail-always" checked><span>Always put mail from <b id="popfrom"></b> here</span></label></div>'
      + '<div class="scrim' + (S.mailOpen || openCompose ? ' open' : '') + '" id="scrim" data-action="mail-close"></div>'
      + readerHtml(S)
      + composeHtml(openCompose);
    if (P().finishPaint) P().finishPaint(wrap);
    else if (typeof window.stampDeskControls === 'function') window.stampDeskControls(wrap.getRootNode());
    if (feedTop) { var feed1 = wrap.querySelector('#feed'); if (feed1) feed1.scrollTop = feedTop; }
    if (ncFocus) {
      var nc1 = wrap.querySelector('#newcolIn');
      if (nc1 && nc1.focus) { nc1.focus(); try { nc1.setSelectionRange(ncVal.length, ncVal.length); } catch (e) {} }
    }
    if (typeof window.__mailComposeAfterPaint === 'function') { try { window.__mailComposeAfterPaint(wrap); } catch (e) {} }
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
    hook('renderContacts', paintPipelineVisit);
    hook('renderPackages', window.paintRedesignSpaces);
    hook('renderLibrary', window.paintRedesignDocuments);
    hook('renderDocs', window.paintRedesignDocuments, deskIs('docs'));
    hook('renderLinks', window.paintRedesignLinks);
    hook('renderCats', window.paintRedesignLinks);
    /* Email loads its own feed on every visit. The old 7-column board loader is no longer called. */
    if (typeof window.loadMailBoard === 'function' && !window.loadMailBoard.__redesignB) {
      window.loadMailBoard = function () {
        if (window.STATE) { window.STATE.mailOpen = null; window.STATE.mailOpenThread = null; }
        window.paintRedesignEmail();
        loadLiveFeeds('mail');
      };
      window.loadMailBoard.__redesignB = true;
    }
  }
  /* Pipeline opened from the menu: load the GHL pipelines (with cached opportunities) if they are not here yet. */
  function paintPipelineVisit() {
    var S = window.STATE || {};
    if (!S.ghlPipes && !paintPipelineVisit.loading) {
      paintPipelineVisit.loading = true;
      loadLiveFeeds('contacts');
    }
    window.paintRedesignPipeline();
  }
  setInterval(hookAll, 400);
  hookAll();

  function loadLiveFeeds(desk) {
    if (fixtureOn() || typeof authFetch !== 'function') return;
    function go(url, key) {
      authFetch(url, { credentials: 'include', quiet: true }).then(function (r) {
        /* The library shows "Couldn't load - Retry" on a failed load instead of an empty grid. */
        if (key === 'docs' && (!r || !r.ok)) throw new Error('docs');
        return r.json();
      }).then(function (d) {
        if (!window.STATE) return;
        if (key === 'pipe' && d && d.pipelines) window.STATE.ghlPipes = d.pipelines;
        if (key === 'spaces') window.STATE.packages = (d && (d.packages || d.spaces)) || window.STATE.packages;
        if (key === 'docs') {
          if (!d || !Array.isArray(d.docs)) throw new Error('docs');
          window.STATE.staged = d.docs;
          window.STATE.docFolders = Array.isArray(d.folders) ? d.folders : (Array.isArray(d.categories) ? d.categories : []);
          window.STATE.docSets = Array.isArray(d.sets) ? d.sets : [];
          window.STATE.docsLoaded = true;
          window.STATE.docsError = false;
        }
        if (key === 'mail') {
          window.STATE.mailBoard = d;
          /* The board payload can come from a cache; the columns/rules routes are the live source. */
          if (window.STATE.mailColsLive) d.columns = window.STATE.mailColsLive;
          if (window.STATE.mailRulesLive) d.rules = window.STATE.mailRulesLive;
        }
        if (key === 'cols' && d && Array.isArray(d.columns)) {
          window.STATE.mailColsLive = d.columns;
          if (window.STATE.mailBoard) window.STATE.mailBoard.columns = d.columns;
        }
        if (key === 'rules' && d && Array.isArray(d.rules)) {
          window.STATE.mailRulesLive = d.rules;
          if (window.STATE.mailBoard) window.STATE.mailBoard.rules = d.rules;
        }
        if (key === 'reach' && d && Array.isArray(d.people)) window.STATE.reachOut = d.people;
        if (key === 'boxes' && d) {
          if (Array.isArray(d.boxes) && d.boxes.length) window.STATE.emailBoxes = d.boxes;
          if (Array.isArray(d.hidden)) window.STATE.emailBoxHidden = d.hidden;
        }
        if (key === 'prefs' && d && d.prefs) window.STATE.prefs = Object.assign({}, window.STATE.prefs || {}, d.prefs);
        if (desk === 'contacts' && (key === 'pipe' || key === 'reach')) { paintPipelineVisit.loading = false; paintPipelineLive(); }
        if (desk === 'work' && key === 'spaces') paintSpacesLive();
        if (desk === 'docs' && key === 'docs') paintDocumentsLive();
        if (desk === 'docs' && key === 'spaces') paintDocumentsLive();
        if (desk === 'mail' && /^(mail|boxes|cols|rules|prefs)$/.test(key)) paintEmailLive();
        if (desk === 'links') paintLinksLive();
        console.info('[live-map] ' + url, d && typeof d === 'object' ? Object.keys(d) : typeof d);
      }).catch(function () {
        if (key === 'docs' && window.STATE) {
          window.STATE.docsError = true;
          if (desk === 'docs') paintDocumentsLive();
        }
      });
    }
    if (desk === 'contacts') {
      go('/api/pipeline', 'pipe');
      go('/api/reach-out', 'reach');
    }
    if (desk === 'work') go('/api/spaces', 'spaces');
    if (desk === 'docs') {
      go('/api/documents', 'docs');
      go('/api/spaces', 'spaces');
    }
    if (desk === 'mail') {
      if (window.STATE) { window.STATE.mailColsLive = null; window.STATE.mailRulesLive = null; }
      go('/api/mail/board', 'mail');
      go('/api/mail/columns', 'cols');
      go('/api/mail/rules', 'rules');
      go('/api/mail/boxes', 'boxes');
      go('/api/prefs', 'prefs');
    }
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
