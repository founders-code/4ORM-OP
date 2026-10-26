(function () {
  var C = ['#2E6BF2', '#0E8A5F', '#C9962B', '#6B4FD8', '#D6334E', '#0f9fb5', '#e2702b'];
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  /* Sample meetings for ?fixture=mockup live in redesign-fixture-c.js (loaded only with that flag). */
  function fixtureRows() { return ((window.REDESIGN_FIXTURE_C || {}).ZOOM_FIXTURE) || []; }

  function ini(n) { return String(n || '').split(' ').map(function (x) { return x[0] || ''; }).join('').slice(0, 2).toUpperCase(); }
  function col(n) { return C[String(n || '').split('').reduce(function (a, c) { return a + c.charCodeAt(0); }, 0) % C.length]; }
  function zRoot() { return (window.portRoot && window.portRoot('v-znotes')) || document.getElementById('v-znotes') || document; }
  function zEl(id) { return (window.portEl && window.portEl('v-znotes', id)) || document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  function fmtDate(iso) {
    var p = String(iso || '').slice(0, 10).split('-');
    if (p.length < 3) return '';
    return MONTHS[Number(p[1]) - 1] + ' ' + Number(p[2]) + ', ' + p[0];
  }
  function srcOf(n) {
    if (n.origin) return n.origin === 'granola' ? 'Granola' : 'Zoom';
    var blob = (n.sources || []).map(function (s) { return (s && s.name) || ''; }).join(' ');
    return /granola/i.test(blob) ? 'Granola' : 'Zoom';
  }
  function contactFor(name) {
    var low = String(name || '').toLowerCase();
    return (STATE.contacts || []).filter(function (c) { return String(c.name || '').toLowerCase() === low; })[0];
  }
  function roleOf(n, name) {
    if (n.roles && n.roles[name]) return n.roles[name];
    var c = contactFor(name);
    if (!c) return '';
    return c.role || (typeof contactCategory === 'function' ? contactCategory(c) : '');
  }
  function chipMatch(n, chip) {
    if (!chip || chip === 'All') return true;
    if (chip === 'Solo') return !!(n.solo || !(n.attendees || []).length);
    var blob = (n.title + ' ' + (n.attendees || []).join(' ')).toLowerCase();
    if (chip === 'Speer') return /speer|spear/.test(blob);
    var cats = (n.attendees || []).map(function (name) {
      var c = contactFor(name);
      return c && typeof contactCategory === 'function' ? contactCategory(c) : '';
    }).join(' ');
    if (chip === 'Investors') return /angel|vc|invest/.test(cats + blob);
    if (chip === 'Design partners') return /design|broker|prospect/.test(cats + blob);
    if (chip === 'Team') return /team|partner|advisor|personal/.test(cats) || /bruce|kevin|zed/.test(blob);
    return true;
  }
  function srcMatch(n, src) {
    if (!src || src === 'both') return true;
    var origin = srcOf(n).toLowerCase();
    return src === origin;
  }
  function weekOf(iso) {
    var d = new Date(String(iso).slice(0, 10) + 'T12:00:00');
    if (isNaN(d.getTime())) return 'Earlier';
    var now = new Date();
    now.setHours(12, 0, 0, 0);
    var start = new Date(now);
    start.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    var last = new Date(start);
    last.setDate(start.getDate() - 7);
    if (d >= start) return 'This week';
    if (d >= last) return 'Last week';
    var end = new Date(d);
    end.setDate(d.getDate() + (6 - ((d.getDay() + 6) % 7)));
    var a = MONTHS[d.getMonth()] + ' ' + d.getDate();
    var b = MONTHS[end.getMonth()] + ' ' + end.getDate();
    return a + ' - ' + b;
  }
  function saidLine(n) {
    if (n.others && n.others.length) return n.others.join(' ');
    if (n.intel && n.intel.length) return n.intel.map(function (s) { return s.value || s.label; }).join(' ');
    return n.aiSummary || n.rawNotes || '';
  }
  function oweCount(n) {
    if (n.actions && n.actions.length) return n.actions.length;
    var id = String(n.id || '');
    var noteId = String(n.noteId || '');
    var title = String(n.title || '').toLowerCase().replace(/\s+/g, ' ').trim();
    var date = String(n.date || '').slice(0, 10);
    var nOpen = (STATE.meetingActions || []).filter(function (a) {
      if (a.status === 'done' || a.status === 'tasked') return false;
      var mid = String(a.meetingId || a.meeting_id || '');
      if (mid && (mid === id || mid === noteId)) return true;
      var at = String(a.meetingTitle || a.meeting_title || '').toLowerCase().replace(/\s+/g, ' ').trim();
      var ad = String(a.meetingDate || a.meeting_date || '').slice(0, 10);
      if (title && at && title === at) return true;
      if (title && at && date && ad && date === ad && (title.indexOf(at) >= 0 || at.indexOf(title) >= 0)) return true;
      return false;
    }).length;
    if (nOpen) return nOpen;
    if (n.owe != null) return Number(n.owe) || 0;
    return 0;
  }
  function zRows() {
    if (window.fixtureMockup) {
      var rows = fixtureRows().slice();
      if (STATE.zSort === 'old') rows.reverse();
      return rows;
    }
    var q = String(STATE.zQuery || '').toLowerCase();
    var chip = STATE.zChip || 'All';
    var src = STATE.zSrc || 'both';
    var rows = (STATE.zoomNotes || []).filter(function (n) {
      if (!chipMatch(n, chip)) return false;
      if (!srcMatch(n, src)) return false;
      if (!q) return true;
      var blob = (n.title + ' ' + (n.attendees || []).join(' ') + ' ' + saidLine(n) + ' ' + (n.improve || []).join(' ')).toLowerCase();
      return blob.indexOf(q) > -1;
    });
    rows.sort(function (a, b) {
      var c = String(a.date).localeCompare(String(b.date));
      if (c === 0) c = String(a.title).localeCompare(String(b.title));
      return STATE.zSort === 'old' ? c : -c;
    });
    return rows;
  }
  function syncedLabel() {
    var at = STATE.zoomSyncedAt;
    if (!at) return 'not synced yet';
    var min = Math.max(0, Math.round((Date.now() - Number(at)) / 60000));
    if (min < 1) return 'synced just now';
    return 'synced ' + min + ' min ago';
  }
  function toast(t) {
    var x = zEl('zToast');
    if (!x) return;
    x.textContent = t;
    x.classList.add('show');
    setTimeout(function () { x.classList.remove('show'); }, 1600);
  }
  function setDrawer(on) {
    var dr = zEl('zDrawer');
    var sc = zEl('zScrim');
    if (dr) dr.classList.toggle('open', !!on);
    if (sc) sc.classList.toggle('open', !!on);
    STATE.zOpen = !!on;
    if (!on) {
      STATE.zOpenId = '';
      if (STATE.desk === 'znotes') try { history.replaceState({}, '', '/zoom'); } catch (e) {}
    }
  }
  function bindGrab() {
    var g = zEl('zGrab');
    var dr = zEl('zDrawer');
    if (!g || !dr || g._bound) return;
    g._bound = true;
    var w = 0;
    try { w = Number(localStorage.getItem('cr_zoom_drawer_w') || 0); } catch (e) {}
    if (w) dr.style.width = w + 'px';
    var on = false;
    g.addEventListener('mousedown', function () { on = true; document.body.style.userSelect = 'none'; });
    document.addEventListener('mousemove', function (e) {
      if (!on) return;
      var next = Math.min(Math.max(window.innerWidth - e.clientX, 480), window.innerWidth * 0.95);
      dr.style.width = next + 'px';
    });
    document.addEventListener('mouseup', function () {
      if (!on) return;
      on = false;
      document.body.style.userSelect = '';
      try { localStorage.setItem('cr_zoom_drawer_w', String(parseInt(dr.style.width, 10) || 860)); } catch (e) {}
    });
  }

  function readerHtml(n) {
    var people = n.attendees || [];
    var av = function (name) { return '<span class="av" style="background:' + col(name) + '">' + esc(ini(name)) + '</span>'; };
    var when = fmtDate(n.date);
    if (n.durationMin) when += ' · ' + n.durationMin + ' min';
    var src = srcOf(n);
    when += ' · ' + src + ' notes' + (src === 'Zoom' ? ' + recording + transcript' : '');
    var saidMap = n.said || {};
    if (!Object.keys(saidMap).length) {
      people.forEach(function (name, i) {
        saidMap[name] = i === 0 ? (n.others || []).slice() : [];
      });
      if (!people.length && (n.others || []).length) saidMap['Notes'] = n.others.slice();
    }
    var improve = n.improve || [];
    var quotes = n.quotes || [];
    var decided = n.decided || [];
    var owe = n.actions || (STATE.meetingActions || []).filter(function (a) { return a.meetingId === n.id; }).map(function (a) {
      return [a.kind === 'follow_up' ? 'fu' : 'you', a.text, a.id];
    });
    var intel = (n.intel || []).length ? '<div class="sec" style="margin-bottom:14px"><div class="sh"><b>Their intel</b><span>' + n.intel.length + '</span></div><div class="intel-stats">' + n.intel.map(function (s) { return '<div class="zstat"><div class="zv">' + esc(s.value || '') + '</div><div class="zl">' + esc(s.label || '') + '</div></div>'; }).join('') + '</div></div>' : '';
    var sources = (n.sources || []).length ? '<div class="sec" style="margin-bottom:14px"><div class="sh"><b>Sources</b></div><div class="zsources">' + n.sources.map(function (s) {
      if (s && s.url) return '<a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.name || s.url) + '</a>';
      return '<span>' + esc((s && s.name) || '') + '</span>';
    }).join('') + '</div></div>' : '';
    var saidBlocks = n.solo ? '' : '<div class="sec" style="margin-bottom:14px"><div class="sh"><b>What others said</b><span>intel first</span></div>' + (Object.keys(saidMap).length ? Object.keys(saidMap).map(function (name) {
      var pts = saidMap[name] || [];
      if (!pts.length) pts = ['(Summary for ' + name.split(' ')[0] + ' appears here from the transcript.)'];
      var role = roleOf(n, name);
      return '<div class="said"><div class="who">' + av(name) + esc(name) + (role ? ' <em>' + esc(role) + '</em>' : '') + '</div><ul>' + pts.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></div>';
    }).join('') : '<div class="emp">' + esc(saidLine(n) || 'Nothing captured yet.') + '</div>') + '</div>';
    var first = people[0] ? people[0].split(' ')[0] : '';
    return '<div class="rh" style="margin-top:-6px"><h2>' + esc(n.title) + '</h2><div class="ic"><button class="ib" type="button" data-zedit="' + esc(n.id) + '" title="Edit">&#9998;</button><button class="ib" type="button" data-zdel="' + esc(n.id) + '" title="Delete">&#128465;</button></div></div>'
      + '<div class="when">' + esc(when) + '</div>'
      + '<div class="ppl">' + people.map(function (name) { var role = roleOf(n, name); return '<span class="pp">' + av(name) + esc(name) + (role ? ' <em>&middot; ' + esc(role) + '</em>' : '') + '</span>'; }).join('') + '<span class="pp"><span class="av" style="background:#8a96ad">CJ</span>You</span></div>'
      + '<div class="acts"><button class="btn sm pri" type="button" data-zact="transcript">Open transcript</button>' + (src === 'Zoom' ? '<button class="btn sm" type="button" data-zact="play">Play recording</button>' : '') + '<button class="btn sm" type="button" data-zact="follow">Draft follow-up email</button><button class="btn sm" type="button" data-zact="space">Add to a Space</button>' + (first ? '<button class="btn sm" type="button" data-zact="contact" data-zname="' + esc(people[0]) + '">Open ' + esc(first) + ' in Contacts</button>' : '') + '</div>'
      + '<div class="ai"><div class="sh"><b>4orm Intelligence on this meeting</b><span>summary</span></div><p>' + esc(n.aiSummary || saidLine(n) || 'Summary appears here once the transcript is in.') + '</p><div class="ask"><input id="zAskQ" placeholder="Ask about this meeting - e.g. &quot;What did ' + esc(first || 'I') + ' push back on?&quot;"><button class="btn sm pri" type="button" id="zAskGo">Ask</button></div><div class="emp" id="zAskA"></div></div>'
      + '<div class="grid2"><div>' + saidBlocks
      + (improve.length ? '<div class="sec imp" style="margin-bottom:14px"><div class="sh"><b>Where you can improve</b><span>coaching</span></div>' + improve.map(function (t, k) { return '<div class="iv"><span>' + (k + 1) + '</span>' + esc(t) + '</div>'; }).join('') + '</div>' : '')
      + (quotes.length ? '<div class="sec"><div class="sh"><b>Worth quoting</b><span>from the transcript</span></div>' + quotes.map(function (q) { return '<div class="q"><b>' + esc(q[0]) + ':</b> "' + esc(q[1]) + '"</div>'; }).join('') + '</div>' : '')
      + intel + sources + '</div><div>'
      + '<div class="sec" style="margin-bottom:14px"><div class="sh"><b>What you owe</b><span>' + owe.length + ' open</span></div>'
      + (owe.length ? owe.map(function (o) { return '<div class="owe"><span class="k ' + (o[0] === 'fu' ? 'fu' : 'you') + '">' + (o[0] === 'fu' ? 'Follow up' : 'You said') + '</span><span class="t">' + esc(o[1]) + '</span><span class="ad"><button type="button" data-z-task="today" data-z-text="' + esc(o[1]) + '">+ Today</button><button type="button" data-z-task="week" data-z-text="' + esc(o[1]) + '">+ Week</button></span></div>'; }).join('') : '<div class="emp">Nothing owed from this meeting.</div>') + '</div>'
      + '<div class="sec" style="margin-bottom:14px"><div class="sh"><b>Decided</b><span>' + decided.length + '</span></div>' + (decided.length ? decided.map(function (d) { return '<div class="dec"><i>&#10003;</i>' + esc(d) + '</div>'; }).join('') : '<div class="emp">No decisions captured.</div>') + '</div>'
      + '<div class="sec"><div class="sh"><b>Full notes</b><span>as captured</span></div><div class="raw">' + esc(n.rawNotes || n.others.join('\n') || saidLine(n) || 'Nothing captured yet.') + '</div></div>'
      + '</div></div>'
      + '<div class="foot">Summarised by 4orm Intelligence from the ' + esc(src) + ' ' + (src === 'Zoom' ? 'transcript' : 'notes') + ' &middot; check the transcript before quoting anyone.</div>';
  }

  function openZoom(id) {
    var rows = zRows();
    var n = rows.filter(function (row) { return row.id === id; })[0];
    if (!n) n = (STATE.zoomNotes || []).filter(function (row) { return row.id === id; })[0];
    if (!n) return;
    STATE.zOpenId = id;
    var rd = zEl('zReader');
    if (rd) rd.innerHTML = readerHtml(n);
    setDrawer(true);
    bindGrab();
    if (!window.fixtureMockup) try { history.replaceState({}, '', '/zoom?m=' + encodeURIComponent(id)); } catch (e) {}
    var ask = zEl('zAskGo');
    var box = zEl('zAskQ');
    if (ask && box) ask.onclick = function () {
      var q = box.value.trim();
      if (!q) return;
      var out = zEl('zAskA');
      if (out) out.textContent = 'Reading the transcript...';
      authFetch('/api/zoom/' + encodeURIComponent(id) + '/ask', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ q: q }) }).then(function (r) { return r.json(); }).then(function (d) {
        if (out) out.textContent = (d && d.answer) || 'Nothing in this meeting matches that.';
      }).catch(function () { if (out) out.textContent = 'Could not answer from this meeting yet.'; });
    };
  }

  function showAdd(note) {
    var m = zEl('zAdd');
    if (!m) return;
    zEl('zAddId').value = (note && note.id) || '';
    zEl('zAddTitle').value = (note && note.title) || '';
    zEl('zAddPeople').value = note ? (note.attendees || []).join(', ') : '';
    zEl('zAddOthers').value = note ? (note.others || []).join('\n') : '';
    zEl('zAddOwe').value = '';
    m.classList.add('open');
    var t = zEl('zAddTitle');
    if (t) t.focus();
  }
  function hideAdd() { var m = zEl('zAdd'); if (m) m.classList.remove('open'); }

  function saveNote() {
    var id = zEl('zAddId').value;
    var title = zEl('zAddTitle').value.trim() || 'Untitled meeting';
    var people = zEl('zAddPeople').value;
    var others = zEl('zAddOthers').value;
    var owe = zEl('zAddOwe').value;
    var names = people.split(',').map(function (b) { return b.trim(); }).filter(Boolean);
    var lines = others.split('\n').map(function (b) { return b.trim(); }).filter(Boolean);
    if (owe.trim()) lines.push(owe.trim());
    var payload = { title: title, attendees: people, others: others, solo: !names.length };
    hideAdd();
    if (id && String(id).indexOf('tmp-') !== 0 && String(id).indexOf('fx-') !== 0) {
      var note = (STATE.zoomNotes || []).filter(function (n) { return n.id === id; })[0];
      if (note) { note.title = title; note.attendees = names; note.others = lines; note.solo = !names.length; }
      renderZNotes();
      if (STATE.zOpenId === id) openZoom(id);
      authFetch('/api/zoom/' + id, { method: 'PATCH', quiet: true, credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }).catch(function () { toast('Not saved yet'); });
      return;
    }
    var temp = { id: 'tmp-' + Date.now(), title: title, attendees: names, others: lines, date: new Date().toISOString().slice(0, 10), solo: !names.length, intel: [], improve: [], sources: [], origin: 'granola' };
    STATE.zoomNotes = STATE.zoomNotes || [];
    STATE.zoomNotes.unshift(temp);
    renderZNotes();
    authFetch('/api/zoom', { method: 'POST', quiet: true, credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }).then(function (r) { return r.json(); }).then(function (row) {
      if (row && row.id) { var i = STATE.zoomNotes.findIndex(function (n) { return n.id === temp.id; }); if (i >= 0) STATE.zoomNotes[i] = Object.assign(temp, { id: row.id }); }
      renderZNotes();
    }).catch(function () { temp._err = 'Not saved yet'; renderZNotes(); });
  }

  function delNote(id) {
    if (!window.confirm('Delete this meeting note? The transcript stays in Zoom.')) return;
    var prev = (STATE.zoomNotes || []).slice();
    STATE.zoomNotes = prev.filter(function (n) { return n.id !== id; });
    if (STATE.zOpenId === id) setDrawer(false);
    renderZNotes();
    if (String(id).indexOf('tmp-') === 0 || String(id).indexOf('fx-') === 0) return;
    authFetch('/api/zoom/' + id, { method: 'DELETE', quiet: true, credentials: 'same-origin' }).then(function (r) { if (!r.ok) throw 0; }).catch(function () { STATE.zoomNotes = prev; renderZNotes(); toast('Could not delete that note.'); });
  }

  function renderZNotes() {
    if (window.fixtureMockup) return;
    var host = zEl('zoomDesk') || document.getElementById('zoomDesk');
    if (!host) return;
    var rows = zRows();
    var all = window.fixtureMockup ? fixtureRows() : (STATE.zoomNotes || []);
    var chip = STATE.zChip || 'All';
    var src = STATE.zSrc || 'both';
    var sort = STATE.zSort || 'new';
    var boxes = '';
    var week = '';
    rows.forEach(function (x) {
      var wk = x.wk || weekOf(x.date);
      if (wk !== week) {
        if (week) boxes += '</div>';
        week = wk;
        boxes += '<div class="wkh">' + esc(wk) + '</div><div class="gridm">';
      }
      var people = x.attendees || [];
      var who = people.length ? people.slice(0, 2).join(', ') + (people.length > 2 ? ' +' + (people.length - 2) : '') : 'Just you';
      var solo = !!(x.solo || !people.length);
      var said = saidLine(x) || 'Nothing captured yet.';
      var leadName = (people[0] || '').split(' ')[0];
      var quoted = String(said).replace(/^Note to self:\s*/i, '');
      var nameRe = leadName ? new RegExp('^' + leadName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*:\\s*', 'i') : null;
      if (nameRe) { quoted = quoted.replace(nameRe, '').replace(nameRe, ''); }
      var lead = solo ? '<b style="color:#46556E">Note to self:</b> ' : (leadName ? '<b>' + esc(leadName) + ':</b> ' : '');
      var owe = oweCount(x);
      var tag = solo ? '<span class="tag solo">Solo</span>' : (owe ? '<span class="tag owe">You owe ' + owe + '</span>' : '<span class="tag solo">Nothing owed</span>');
      var d = String(x.date || '').slice(0, 10).split('-');
      var label = d.length === 3 ? MONTHS[Number(d[1]) - 1].slice(0, 3).toUpperCase() + ' ' + Number(d[2]) + ', ' + d[0] : fmtDate(x.date);
      boxes += '<div class="mc" data-z="' + esc(x.id) + '"><div class="d">' + esc(label) + '<span class="src">' + esc(srcOf(x)) + '</span></div><div class="t">' + esc(x.title) + '</div>'
        + '<div class="pp2">' + (people.map(function (name) { return '<span class="av" style="background:' + col(name) + '">' + esc(ini(name)) + '</span>'; }).join('') || '<span class="av" style="background:#8a96ad;margin:0">CJ</span>') + '<span class="n">' + esc(who) + '</span></div>'
        + '<div class="sn' + (solo ? ' self' : '') + '">' + lead + esc(quoted) + '</div>'
        + '<div class="ft">' + tag + '<span class="op">Open &rarr;</span><span class="ib" data-zedit="' + esc(x.id) + '" title="Edit">&#9998;</span><span class="ib" data-zdel="' + esc(x.id) + '" title="Delete">&#128465;</span></div></div>';
    });
    if (week) boxes += '</div>';
    if (!rows.length) boxes = '<div class="emp" style="padding:20px 4px">No meetings match.</div>';
    host.innerHTML = '<div class="top"><h1>Zoom notes</h1><span class="sub">What other people said, and what you owe them</span><span class="meta">' + (window.fixtureMockup ? '43 meetings &middot; synced 2 min ago' : (all.length + ' meetings &middot; ' + esc(syncedLabel()))) + '</span><button class="btn" type="button" id="zRefresh">&#8635; Refresh</button><button class="btn pri" type="button" id="zAddBtn">+ Add note</button></div>'
      + '<div class="card bar"><input class="search" id="zSearch" placeholder="Search a person, company or something they said" value="' + esc(STATE.zQuery || '') + '">'
      + '<div class="chips">' + ['All', 'Investors', 'Speer', 'Design partners', 'Team', 'Solo'].map(function (c) { return '<button class="chip' + (chip === c ? ' on' : '') + '" type="button" data-zchip="' + c + '">' + c + '</button>'; }).join('') + '</div>'
      + '<div class="seg">' + [['both', 'Zoom + Granola'], ['zoom', 'Zoom'], ['granola', 'Granola']].map(function (p) { return '<span class="' + (src === p[0] ? 'on' : '') + '" data-zsrc="' + p[0] + '">' + p[1] + '</span>'; }).join('') + '</div>'
      + '<div class="seg"><span class="' + (sort !== 'old' ? 'on' : '') + '" data-zsort="new">Newest</span><span class="' + (sort === 'old' ? 'on' : '') + '" data-zsort="old">Oldest</span></div></div>'
      + '<div id="zBoxes">' + boxes + '</div>'
      + '<div class="scrim" id="zScrim"></div><div class="drawer" id="zDrawer"><span class="grab" id="zGrab"></span><div class="x"><button class="btn sm" id="zClose" type="button">Close &times;</button></div><div class="rd" id="zReader"></div></div>'
      + '<div class="toast" id="zToast"></div>'
      + '<div class="zadd" id="zAdd"><form class="box" id="zAddForm"><h3 id="zAddHead">Add note</h3><input type="hidden" id="zAddId"/><input id="zAddTitle" placeholder="Title" required/><input id="zAddPeople" placeholder="Attendees"/><textarea id="zAddOthers" placeholder="What others said"></textarea><textarea id="zAddOwe" placeholder="What you owe"></textarea><div class="row"><button class="btn" type="button" id="zAddCancel">Cancel</button><button class="btn pri" type="submit">Save</button></div></form></div>';
    bindZoomDesk(host);
    if (STATE.zOpenId) openZoom(STATE.zOpenId);
  }

  function bindZoomDesk(host) {
    var search = zEl('zSearch');
    if (search) search.oninput = function () { STATE.zQuery = search.value; renderZNotes(); var again = zEl('zSearch'); if (again) { again.focus(); try { again.setSelectionRange(STATE.zQuery.length, STATE.zQuery.length); } catch (e) {} } };
    host.querySelectorAll('[data-zchip]').forEach(function (b) { b.onclick = function () { STATE.zChip = b.getAttribute('data-zchip'); renderZNotes(); }; });
    host.querySelectorAll('[data-zsrc]').forEach(function (b) { b.onclick = function () { STATE.zSrc = b.getAttribute('data-zsrc'); renderZNotes(); }; });
    host.querySelectorAll('[data-zsort]').forEach(function (b) { b.onclick = function () { STATE.zSort = b.getAttribute('data-zsort'); renderZNotes(); }; });
    var boxes = zEl('zBoxes');
    if (boxes) boxes.onclick = function (e) {
      var del = e.target.closest('[data-zdel]');
      if (del) { e.stopPropagation(); delNote(del.getAttribute('data-zdel')); return; }
      var ed = e.target.closest('[data-zedit]');
      if (ed) { e.stopPropagation(); var note = (window.fixtureMockup ? fixtureRows() : STATE.zoomNotes || []).filter(function (n) { return n.id === ed.getAttribute('data-zedit'); })[0]; showAdd(note); return; }
      var card = e.target.closest('.mc');
      if (card) openZoom(card.getAttribute('data-z'));
    };
    var scrim = zEl('zScrim');
    if (scrim) scrim.onclick = function () { setDrawer(false); };
    var close = zEl('zClose');
    if (close) close.onclick = function () { setDrawer(false); };
    var addBtn = zEl('zAddBtn');
    if (addBtn) addBtn.onclick = function () { showAdd(null); };
    var cancel = zEl('zAddCancel');
    if (cancel) cancel.onclick = hideAdd;
    var form = zEl('zAddForm');
    if (form) form.onsubmit = function (e) { e.preventDefault(); saveNote(); };
    var refresh = zEl('zRefresh');
    if (refresh) refresh.onclick = function () { zoomRefresh(false); };
    bindGrab();
    var rd = zEl('zReader');
    if (rd) rd.onclick = function (e) {
      var del = e.target.closest('[data-zdel]');
      if (del) { delNote(del.getAttribute('data-zdel')); return; }
      var ed = e.target.closest('[data-zedit]');
      if (ed) { var note = (STATE.zoomNotes || []).filter(function (n) { return n.id === ed.getAttribute('data-zedit'); })[0]; showAdd(note); return; }
      var task = e.target.closest('[data-z-task]');
      if (task) {
        var col = task.getAttribute('data-z-task') === 'week' ? 'week' : 'today';
        var text = task.getAttribute('data-z-text') || 'Follow up';
        if (typeof window.saveItem === 'function') window.saveItem(text, col);
        else if (typeof addItem === 'function') addItem(text);
        task.closest('.owe').classList.add('added');
        toast('Task added to War Room Execution');
        return;
      }
      var act = e.target.closest('[data-zact]');
      if (!act) return;
      var kind = act.getAttribute('data-zact');
      var open = (zRows().filter(function (n) { return n.id === STATE.zOpenId; })[0]) || {};
      if (kind === 'transcript') {
        var href = open.transcript ? '' : ((open.sources || []).filter(function (s) { return s && s.url; })[0] || {}).url;
        if (href && typeof openLink === 'function') openLink('Transcript', href);
        else toast(open.transcript ? 'Transcript is in Full notes below.' : 'No transcript URL yet.');
        if (open.transcript) {
          var raw = zEl('zReader').querySelector('.raw');
          if (raw) raw.textContent = open.transcript;
        }
      } else if (kind === 'play') {
        if (open.recordingUrl && typeof openLink === 'function') openLink('Recording', open.recordingUrl);
        else toast('No recording on this meeting yet.');
      } else if (kind === 'follow') {
        if (typeof window.saveItem === 'function') window.saveItem('Follow-up: ' + (open.title || 'meeting'), 'today');
        toast('Follow-up draft added to Today.');
      } else if (kind === 'space') {
        if (typeof switchView === 'function') switchView('work');
      } else if (kind === 'contact') {
        var name = act.getAttribute('data-zname');
        var c = contactFor(name);
        if (typeof switchView === 'function') switchView('contacts');
        setTimeout(function () {
          if (c && typeof openContactCard === 'function') openContactCard(c.id);
        }, 80);
      }
    };
  }

  function zoomRefresh(quiet) {
    var b = zEl('zRefresh');
    if (zoomRefresh.busy) return;
    zoomRefresh.busy = true;
    if (b) { b.disabled = true; b.innerHTML = '&#8635; Refreshing...'; }
    try { localStorage.setItem('cr_zoom_sync', String(Date.now())); } catch (e) {}
    authFetch('/api/zoom-notes', { method: 'POST', credentials: 'same-origin', quiet: true }).then(function (r) { return r.json(); }).then(function (d) {
      STATE.zoomSyncedAt = Date.now();
      if (d && Array.isArray(d.notes) && d.notes.length) STATE.zoomNotes = d.notes;
      if (typeof loadMeetingActions === 'function') loadMeetingActions();
      else authFetch('/api/meeting-actions', { credentials: 'include' }).then(function (r) { return r.json(); }).then(function (a) { STATE.meetingActions = (a && a.actions) || []; renderZNotes(); });
      if (STATE.desk === 'znotes') renderZNotes();
      if (quiet) return;
      if (!d || (d.error && !d.busy)) { toast('Zoom could not be reached. Try again.'); return; }
      if (d.busy) { toast(d.error); return; }
      var bits = [];
      if (d.added) bits.push(d.added + (d.added === 1 ? ' new call' : ' new calls'));
      if (d.filled) bits.push(d.filled + (d.filled === 1 ? ' transcript filled in' : ' transcripts filled in'));
      toast(bits.length ? bits.join(', ') + ' added' : 'Up to date');
    }).catch(function () { if (!quiet) toast('Zoom could not be reached. Try again.'); }).then(function () {
      zoomRefresh.busy = false;
      if (b) { b.disabled = false; b.innerHTML = '&#8635; Refresh'; }
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && STATE.zOpen) setDrawer(false);
  });

  window.renderZNotes = renderZNotes;
  window.openZoom = openZoom;
  window.paintZoom = function () { if (STATE.zOpenId) openZoom(STATE.zOpenId); };
  window.zoomRefresh = zoomRefresh;

  var prior = window.switchView;
  if (typeof prior === 'function') {
    window.switchView = function (v) {
      prior.apply(this, arguments);
      if (v === 'znotes' && !window.fixtureMockup) {
        document.body.classList.add('dk-page');
        try { history.replaceState({}, '', STATE.zOpenId ? '/zoom?m=' + encodeURIComponent(STATE.zOpenId) : '/zoom'); } catch (e) {}
        authFetch('/api/meeting-actions', { credentials: 'include' }).then(function (r) { return r.json(); }).then(function (d) { STATE.meetingActions = (d && d.actions) || []; renderZNotes(); }).catch(function () { renderZNotes(); });
      }
    };
  }
})();
