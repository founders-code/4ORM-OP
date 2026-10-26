/* Recordings (15). Shadow page on #recDesk. No icons. */
(function () {
  function P() { return window.__port || {}; }
  function fixtureOn() { return P().fixtureOn ? P().fixtureOn() : !!window.fixtureMockup; }
  function wrapOf(id) { return P().wrapOf ? P().wrapOf(id) : null; }
  function whenCss(fn) { if (P().whenCss) P().whenCss(fn); else fn(); }
  function markReady(id) { if (P().markReady) P().markReady(id); }
  function esc(s) { return P().esc ? P().esc(s) : String(s == null ? '' : s); }
  function S() { return window.STATE || (window.STATE = {}); }
  function api(url, opts) {
    opts = opts || {};
    var fn = typeof window.authFetch === 'function' ? window.authFetch : fetch;
    return fn(url, Object.assign({ credentials: 'same-origin', headers: { 'content-type': 'application/json' } }, opts, {
      body: opts.body != null ? JSON.stringify(opts.body) : opts.body
    }));
  }
  var TYPES = { zoom: 'Zoom', person: 'In person', call: 'Phone call', voice: 'Voice note' };
  var recState = { group: 'type', q: '', openId: '', rec: null, chunks: [], paused: false, sec: 0, tick: null, stream: null, analyser: null, ctx: null };

  function sample() {
    return [
      { id: '1', type: 'zoom', week: 'This week', title: 'Dean and Chad weekly - wallet setup and investor intros', when: 'Mon 26 Oct · 10:00', duration_s: 42 * 60, people: ['Dean Hesse', 'Chad'], summary: 'Dean will introduce two investors once the one-pager is updated. Wallet setup steps are blocking his test account. Agreed to send the steps today and book a follow-up Thursday.', acts: [['Send Dean the wallet setup steps', 'due today'], ['Update the investor one-pager', 'Wed'], ['Book Thursday follow-up', 'Thu']], transcript: [{ t: '00:00', who: 'Chad', text: 'Thanks for making time.' }, { t: '00:42', who: 'Dean Hesse', text: 'Wallet setup is still blocking the test account.' }] },
      { id: '2', type: 'person', week: 'This week', title: 'Coffee with Enrich Mortgage - discovery', when: 'Mon 26 Oct · 08:15', duration_s: 31 * 60, people: ['Enrich Mortgage Group', 'Chad'], summary: 'Enrich wants proof of what each client was told before a mortgage is signed. Interested in a 30-day pilot with two brokers. Asked for pricing for 10 seats.', acts: [['Send 10-seat pricing', 'due today'], ['Draft 30-day pilot outline', 'Fri']], transcript: [] },
      { id: '3', type: 'call', week: 'This week', title: 'Kevin Wong - confirming the $25K', when: 'Sun 25 Oct · 16:40', duration_s: 9 * 60, people: ['Kevin Wong', 'Chad'], summary: 'Kevin confirmed the $25K and will wire Thursday once he has the subscription documents. Wants a short update every month after closing.', acts: [['Send subscription documents', 'due today']], transcript: [] },
      { id: '4', type: 'voice', week: 'This week', title: 'Idea - credit union one-pager', when: 'Sun 25 Oct · 07:52', duration_s: 3 * 60, people: ['Chad'], summary: 'One page for credit union boards: what changes for members, what it costs, and the FINTRAC fines that make the case. Use Bow Valley as the first reader.', acts: [], transcript: [] },
      { id: '5', type: 'zoom', week: 'Last week', title: 'Bow Valley CU - requirements walkthrough', when: 'Thu 22 Oct · 10:00', duration_s: 55 * 60, people: ['Bow Valley Credit Union', 'Chad'], summary: 'Their compliance lead needs the requirements list and a sample record before the board meeting. Booked the next meeting for Thursday 10:00.', acts: [['Send requirements PDF', 'done']], transcript: [] },
      { id: '6', type: 'call', week: 'Last week', title: 'BCFSA - intro call request', when: 'Wed 21 Oct · 13:30', duration_s: 6 * 60, people: ['BCFSA', 'Chad'], summary: 'Left a message with the policy desk. They asked for a short written intro first, leading with conduct risk.', acts: [['Write the BCFSA intro', 'Mon']], transcript: [] },
      { id: '7', type: 'person', week: 'Last week', title: 'Lunch with Mike - capture rate questions', when: 'Tue 20 Oct · 12:00', duration_s: 48 * 60, people: ['Mike Gardner', 'Chad'], summary: 'Mike questioned the capture rate assumption. Agreed to send the base case and the three scenarios. He may join the round if the pilot numbers hold.', acts: [['Send base case and scenarios', 'overdue']], transcript: [] },
      { id: '8', type: 'voice', week: 'Earlier', title: 'Thoughts after the Speer review', when: 'Thu 8 Oct · 18:20', duration_s: 5 * 60, people: ['Chad'], summary: 'Keegan wants a named design partner before the next step. Bow Valley or Enrich are the two best candidates. Pivot the deck to lead with the partner.', acts: [], transcript: [] }
    ];
  }

  function fmtDur(s) {
    s = Number(s) || 0;
    if (s >= 3600) return Math.floor(s / 3600) + ' h ' + Math.round((s % 3600) / 60) + ' m';
    if (s >= 60) return Math.round(s / 60) + ' m';
    return Math.max(1, s) + ' s';
  }
  function fmtWhen(iso) {
    if (!iso) return '';
    try {
      return new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Vancouver', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
    } catch (e) { return String(iso).slice(0, 16); }
  }
  function weekOf(iso) {
    if (!iso) return 'Earlier';
    var t = new Date(iso).getTime();
    var now = Date.now();
    if (now - t < 7 * 86400000) return 'This week';
    if (now - t < 14 * 86400000) return 'Last week';
    return 'Earlier';
  }
  function list() {
    if (fixtureOn()) return sample();
    return (S().recordings || []).map(function (r) {
      var acts = r.acts || [];
      if (!acts.length && r.action_items) acts = r.action_items.map(function (a) { return [a.text || a[0], a.due || a[1] || '']; });
      return Object.assign({}, r, {
        week: weekOf(r.started_at),
        when: fmtWhen(r.started_at),
        acts: acts
      });
    });
  }
  function toast(root, t) {
    var e = root.getElementById ? root.getElementById('toast') : root.querySelector('#toast');
    if (!e) return;
    e.textContent = t;
    e.classList.add('show');
    clearTimeout(e._t);
    e._t = setTimeout(function () { e.classList.remove('show'); }, 1800);
  }
  function blobToB64(blob) {
    return new Promise(function (resolve) {
      var r = new FileReader();
      r.onload = function () {
        var s = String(r.result || '');
        var i = s.indexOf(',');
        resolve(i >= 0 ? s.slice(i + 1) : s);
      };
      r.readAsDataURL(blob);
    });
  }
  function chunkB64(b64) {
    var size = 350000;
    var out = [];
    for (var i = 0; i < b64.length; i += size) out.push(b64.slice(i, i + size));
    return out;
  }

  function paint() {
    var wrap = wrapOf('recDesk');
    if (!wrap) return;
    if (P().applyPageCss) P().applyPageCss(wrap, 'rec');
    var REC = list();
    var owed = REC.reduce(function (n, r) { return n + (r.acts || []).filter(function (a) { return a[1] !== 'done'; }).length; }, 0);
    var month = REC.reduce(function (n, r) { return n + (Number(r.duration_s) || 0); }, 0);
    wrap.innerHTML =
      '<div class="bar"><h1>Recordings</h1><span class="sub">Every meeting, call and voice note, titled and summed up for you</span>'
      + '<div class="r"><div class="stats"><span><b>' + REC.length + '</b> recordings</span><span><b>' + owed + '</b> actions owed</span><span><b>' + fmtDur(month) + '</b> this month</span></div>'
      + '<button class="btn rec" data-action="rec-start">Record meeting</button></div></div>'
      + '<div class="recbar" id="recbar">'
      + '<span class="live"><i></i><span id="liveTxt">Recording</span></span>'
      + '<span class="tm" id="tm">00:00</span>'
      + '<div class="meter" id="meter">' + Array(18).fill('<b></b>').join('') + '</div>'
      + '<div class="who"><input id="recWho" data-action="rec-who" placeholder="Who\'s here? Type names, or leave it - the summary picks them up"><small>Tell people you\'re recording your notes. Audio stays private to you.</small></div>'
      + '<span class="src">Browser mic</span>'
      + '<button class="btn sm" data-action="rec-pause">Pause</button>'
      + '<button class="btn sm pri" data-action="rec-stop">Stop and save</button>'
      + '<button class="btn sm" data-action="rec-discard">Discard</button></div>'
      + '<div class="tools"><input class="search" id="q" data-action="rec-search" placeholder="Search titles, summaries and transcripts">'
      + '<span class="lbl">Columns</span><div class="seg" id="groupSeg">'
      + '<span class="' + (recState.group === 'type' ? 'on' : '') + '" data-action="rec-group" data-g="type">Type</span>'
      + '<span class="' + (recState.group === 'week' ? 'on' : '') + '" data-action="rec-group" data-g="week">Week</span>'
      + '<span class="' + (recState.group === 'status' ? 'on' : '') + '" data-action="rec-group" data-g="status">Status</span></div></div>'
      + '<div class="cols" id="cols"></div>'
      + '<div class="scrim" id="scrim" data-action="rec-close"></div>'
      + '<aside class="dr" id="dr" role="dialog" aria-label="Recording"></aside>'
      + '<div class="toast" id="toast"></div>';
    if (P().finishPaint) P().finishPaint(wrap);
    paintCols(wrap);
    if (recState.openId) openDrawer(wrap, recState.openId);
    markReady('recDesk');
  }

  function matches(r, q) {
    if (!q) return true;
    var blob = [r.title, r.summary].concat((r.transcript || []).map(function (t) { return t.text || t; })).join(' ').toLowerCase();
    return blob.indexOf(q) >= 0;
  }
  function colsFor(REC) {
    var q = recState.q;
    if (recState.group === 'type') return Object.keys(TYPES).map(function (k) { return [TYPES[k], REC.filter(function (r) { return r.type === k && matches(r, q); })]; });
    if (recState.group === 'week') return ['This week', 'Last week', 'Earlier'].map(function (w) { return [w, REC.filter(function (r) { return (r.week || weekOf(r.started_at)) === w && !r.proc && matches(r, q); })]; }).concat([['Processing', REC.filter(function (r) { return r.proc && matches(r, q); })]]);
    return [
      ['Processing', REC.filter(function (r) { return (r.proc || r.status === 'transcribing' || r.status === 'summarizing') && matches(r, q); })],
      ['Actions owed', REC.filter(function (r) { return !r.proc && (r.acts || []).some(function (a) { return a[1] !== 'done'; }) && matches(r, q); })],
      ['All done', REC.filter(function (r) { return !r.proc && (r.acts || []).length && (r.acts || []).every(function (a) { return a[1] === 'done'; }) && matches(r, q); })],
      ['No actions', REC.filter(function (r) { return !r.proc && !(r.acts || []).length && matches(r, q); })]
    ];
  }
  function card(r) {
    if (r.proc || r.status === 'transcribing' || r.status === 'summarizing') {
      return '<div class="rc proc" data-action="rec-open" data-id="' + esc(r.id) + '"><div class="k"><span class="tag ' + esc(r.type) + '">' + esc(TYPES[r.type] || r.type) + '</span><span class="when">' + esc(r.when || r.step || '') + '</span></div><h4>' + esc(r.step || 'Transcribing') + '</h4><p>' + esc(fmtDur(r.duration_s)) + ' recorded. The title, summary and actions appear here when it\'s done.</p><div class="prog"><i style="width:' + (r.pct || 35) + '%"></i></div></div>';
    }
    var owed = (r.acts || []).filter(function (a) { return a[1] !== 'done'; }).length;
    var ppl = (r.people || []).filter(function (p) { return !/^chad$/i.test(p); }).join(', ') || 'Just you';
    return '<div class="rc" data-action="rec-open" data-id="' + esc(r.id) + '"><div class="k"><span class="tag ' + esc(r.type) + '">' + esc(TYPES[r.type] || r.type) + '</span><span class="when">' + esc(r.when || '') + '</span></div><h4>' + esc(r.title || 'Recording') + '</h4><p>' + esc(r.summary || '') + '</p><div class="ft"><span>' + esc(fmtDur(r.duration_s)) + '</span><span class="pp">' + esc(ppl) + '</span>' + (owed ? '<span class="ow">' + owed + ' owed</span>' : '') + '</div></div>';
  }
  function paintCols(wrap) {
    var cols = wrap.getElementById ? wrap.getElementById('cols') : wrap.querySelector('#cols');
    if (!cols) return;
    cols.innerHTML = colsFor(list()).map(function (pair) {
      return '<div class="col"><div class="colh"><b>' + esc(pair[0]) + '</b><span class="n">' + pair[1].length + '</span></div><div class="list">' + (pair[1].map(card).join('') || '<div class="empty">Nothing here yet</div>') + '</div></div>';
    }).join('');
  }

  function openDrawer(wrap, id) {
    var r = list().filter(function (x) { return String(x.id) === String(id); })[0];
    var dr = wrap.getElementById ? wrap.getElementById('dr') : wrap.querySelector('#dr');
    var scrim = wrap.getElementById ? wrap.getElementById('scrim') : wrap.querySelector('#scrim');
    if (!r || !dr) return;
    recState.openId = id;
    var acts = r.acts || [];
    var tr = r.transcript || [];
    dr.innerHTML =
      '<div class="dh"><div><h2 id="dTitle" contenteditable="true" spellcheck="false" data-action="rec-title">' + esc(r.title) + '</h2><div class="m">' + esc((TYPES[r.type] || r.type) + ' · ' + (r.when || '') + ' · ' + fmtDur(r.duration_s) + ' · title written automatically, click to rename') + '</div></div>'
      + '<div class="r"><button class="btn sm" data-action="rec-space">Add to a Space</button><button class="btn sm" data-action="rec-close">Close</button></div></div>'
      + '<div class="db">'
      + '<div class="player"><button class="btn sm" data-action="rec-play">Play</button><audio id="recAudio" src="' + (r.fromZoom || fixtureOn() ? '' : '/api/recordings/' + encodeURIComponent(r.id) + '?audio=1') + '"></audio><div class="tl" data-action="rec-seek"><i></i></div><span class="t" id="dDur">' + esc(fmtDur(r.duration_s)) + '</span></div>'
      + '<div class="sec">Summary</div><div class="sum">' + esc(r.summary || '') + '</div>'
      + '<div class="sec">People</div><div class="ppl">' + (r.people || []).map(function (p) { return '<span>' + esc(p) + '</span>'; }).join('') + '</div>'
      + '<div class="sec">Action items</div><div id="dAi">' + (acts.length ? acts.map(function (a, i) {
        return '<div class="ai' + (a[1] === 'done' ? ' done' : '') + '" data-i="' + i + '"><span class="cb" data-action="rec-act-done" data-i="' + i + '"></span><span>' + esc(a[0]) + '<small>' + esc(a[1] === 'done' ? 'done' : ('due ' + a[1])) + '</small></span><button class="btn sm" data-action="rec-act-today" data-i="' + i + '">+ Today</button></div>';
      }).join('') : '<div class="sum">No action items in this one.</div>') + '</div>'
      + '<div class="sec">Transcript</div><div class="tr">' + (tr.length ? tr.map(function (line) {
        return '<p><a data-action="rec-jump" data-t="' + esc(line.t || '00:00') + '">' + esc(line.t || '00:00') + '</a><b>' + esc(line.who || '') + (line.who ? ':' : '') + '</b> ' + esc(line.text || '') + '</p>';
      }).join('') : '<p>Transcript appears after processing.</p>') + '</div></div>';
    dr.classList.add('on');
    if (scrim) scrim.classList.add('on');
  }

  function stopMic(discard) {
    recState.paused = false;
    if (recState.tick) { clearInterval(recState.tick); recState.tick = null; }
    if (recState.rec) { try { recState.rec.stop(); } catch (e) {} }
    if (recState.stream) recState.stream.getTracks().forEach(function (t) { t.stop(); });
    recState.stream = null;
    recState.rec = null;
    if (recState.ctx) { try { recState.ctx.close(); } catch (e) {} recState.ctx = null; }
    if (discard) recState.chunks = [];
  }

  function startMic(root) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { toast(root, 'This browser cannot record'); return; }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      recState.stream = stream;
      recState.chunks = [];
      recState.sec = 0;
      recState.paused = false;
      recState.rec = new MediaRecorder(stream);
      recState.rec.ondataavailable = function (e) { if (e.data && e.data.size) recState.chunks.push(e.data); };
      recState.rec.start(1000);
      try {
        recState.ctx = new (window.AudioContext || window.webkitAudioContext)();
        recState.analyser = recState.ctx.createAnalyser();
        recState.ctx.createMediaStreamSource(stream).connect(recState.analyser);
      } catch (e) {}
      var bar = root.getElementById ? root.getElementById('recbar') : root.querySelector('#recbar');
      if (bar) { bar.classList.add('on'); bar.classList.remove('paused'); }
      recState.tick = setInterval(function () {
        if (recState.paused) return;
        recState.sec += 1;
        var tm = root.getElementById ? root.getElementById('tm') : root.querySelector('#tm');
        if (tm) tm.textContent = String(Math.floor(recState.sec / 60)).padStart(2, '0') + ':' + String(recState.sec % 60).padStart(2, '0');
        var meter = root.getElementById ? root.getElementById('meter') : root.querySelector('#meter');
        if (meter) Array.from(meter.querySelectorAll('b')).forEach(function (b) { b.style.height = (4 + Math.random() * 22) + 'px'; });
      }, 1000);
      toast(root, 'Recording from the browser mic');
    }).catch(function () { toast(root, 'Mic permission is needed to record'); });
  }

  function uploadAndProcess(root, blob, people) {
    var dur = recState.sec;
    api('/api/recordings', { method: 'POST', body: { type: 'person', people: people, duration_s: dur, started_at: new Date().toISOString() } })
      .then(function (r) { return r && r.ok ? r.json() : null; })
      .then(function (row) {
        if (!row || !row.id) { toast(root, 'Could not save'); return; }
        S().recordings = S().recordings || [];
        S().recordings.unshift(Object.assign({}, row, { proc: true, step: 'Transcribing', pct: 20, week: 'This week', when: fmtWhen(row.started_at), acts: [] }));
        paint();
        return blobToB64(blob).then(function (b64) {
          var parts = chunkB64(b64);
          var chain = Promise.resolve();
          if (parts.length > 1) {
            parts.forEach(function (p, i) {
              chain = chain.then(function () { return api('/api/recordings/' + row.id, { method: 'PATCH', body: { action: 'chunk', n: i, b64: p } }); });
            });
            return chain.then(function () { return api('/api/recordings/' + row.id, { method: 'PATCH', body: { action: 'finalize' } }); });
          }
          return api('/api/recordings/' + row.id, { method: 'PATCH', body: { action: 'finalize', b64: b64 } });
        }).then(function (res) { return res && res.json ? res.json() : null; }).then(function (done) {
          loadLive(true);
          toast(root, done && done.title ? ('Ready: "' + done.title + '"') : 'Saved');
        });
      }).catch(function () { toast(root, 'Could not save'); });
  }

  function loadLive(force) {
    if (fixtureOn()) { paint(); return; }
    api('/api/recordings').then(function (r) { return r && r.ok ? r.json() : { recordings: [] }; }).then(function (d) {
      S().recordings = (d && d.recordings) || [];
      var acts = (S().meetingActions || []);
      S().recordings.forEach(function (rec) {
        rec.acts = acts.filter(function (a) { return a.source === 'recording' && String(a.meetingId || a.meeting_id) === String(rec.id); }).map(function (a) {
          return [a.text, a.status === 'done' ? 'done' : (a.due || '')];
        });
      });
      if (S().desk === 'rec' || force) paint();
    }).catch(function () { S().recordings = S().recordings || []; if (S().desk === 'rec') paint(); });
  }

  window.paintRedesignRecordings = function () { whenCss(function () { loadLive(true); }); };

  window.__deskRefreshExt = window.__deskRefreshExt || {};
  window.__deskRefreshExt.rec = function () { if (S().desk === 'rec') loadLive(true); };

  window.deskActions = window.deskActions || {};
  Object.assign(window.deskActions, {
    'rec-start': function (el, root) { startMic(root); },
    'rec-pause': function (el, root) {
      recState.paused = !recState.paused;
      var bar = root.getElementById ? root.getElementById('recbar') : root.querySelector('#recbar');
      if (bar) bar.classList.toggle('paused', recState.paused);
      var live = root.getElementById ? root.getElementById('liveTxt') : root.querySelector('#liveTxt');
      if (live) live.textContent = recState.paused ? 'Paused' : 'Recording';
      el.textContent = recState.paused ? 'Resume' : 'Pause';
      try { if (recState.paused && recState.rec && recState.rec.pause) recState.rec.pause(); else if (recState.rec && recState.rec.resume) recState.rec.resume(); } catch (e) {}
    },
    'rec-discard': function (el, root) {
      stopMic(true);
      var bar = root.getElementById ? root.getElementById('recbar') : root.querySelector('#recbar');
      if (bar) bar.classList.remove('on');
      toast(root, 'Recording discarded - nothing was saved');
    },
    'rec-stop': function (el, root) {
      var who = root.getElementById ? root.getElementById('recWho') : root.querySelector('#recWho');
      var people = who && who.value ? who.value.split(',').map(function (s) { return s.trim(); }).filter(Boolean) : [];
      var rec = recState.rec;
      if (rec) rec.onstop = function () {
        var blob = new Blob(recState.chunks, { type: 'audio/webm' });
        stopMic(false);
        var bar = root.getElementById ? root.getElementById('recbar') : root.querySelector('#recbar');
        if (bar) bar.classList.remove('on');
        if (fixtureOn()) { toast(root, 'Saved. Transcribing now'); return; }
        uploadAndProcess(root, blob, people);
      };
      if (rec && rec.state !== 'inactive') rec.stop();
      else stopMic(false);
    },
    'rec-group': function (el, root) {
      recState.group = el.getAttribute('data-g') || 'type';
      paintCols(root);
      root.querySelectorAll('#groupSeg span').forEach(function (s) { s.classList.toggle('on', s.getAttribute('data-g') === recState.group); });
    },
    'rec-search': function () {},
    'rec-open': function (el, root) { openDrawer(root, el.getAttribute('data-id')); },
    'rec-close': function (el, root) {
      recState.openId = '';
      var dr = root.getElementById ? root.getElementById('dr') : root.querySelector('#dr');
      var scrim = root.getElementById ? root.getElementById('scrim') : root.querySelector('#scrim');
      if (dr) dr.classList.remove('on');
      if (scrim) scrim.classList.remove('on');
    },
    'rec-space': function (el, root) { toast(root, 'Pick a Space - the summary and actions go in, the audio stays here'); },
    'rec-play': function (el, root) {
      var a = root.getElementById ? root.getElementById('recAudio') : root.querySelector('#recAudio');
      if (!a || !a.src) { toast(root, 'No audio on this card'); return; }
      if (a.paused) { a.play(); el.textContent = 'Pause'; } else { a.pause(); el.textContent = 'Play'; }
    },
    'rec-jump': function (el, root) {
      var a = root.getElementById ? root.getElementById('recAudio') : root.querySelector('#recAudio');
      var t = String(el.getAttribute('data-t') || '0:00').split(':');
      var sec = (Number(t[0]) || 0) * 60 + (Number(t[1]) || 0);
      if (a) { a.currentTime = sec; a.play(); }
    },
    'rec-act-done': function (el, root) {
      var rec = list().filter(function (x) { return String(x.id) === String(recState.openId); })[0];
      if (!rec || !rec.acts) return;
      var i = +el.getAttribute('data-i');
      rec.acts[i][1] = rec.acts[i][1] === 'done' ? '' : 'done';
      var acts = (S().meetingActions || []).filter(function (a) { return String(a.meetingId) === String(rec.id); });
      if (acts[i] && !fixtureOn()) api('/api/meeting-actions', { method: 'POST', body: { id: acts[i].id, status: rec.acts[i][1] === 'done' ? 'done' : 'open' } });
      openDrawer(root, rec.id); paintCols(root);
    },
    'rec-act-today': function (el, root) {
      toast(root, 'Added to Today in the War Room');
      if (fixtureOn()) return;
      var rec = list().filter(function (x) { return String(x.id) === String(recState.openId); })[0];
      var acts = (S().meetingActions || []).filter(function (a) { return String(a.meetingId) === String(rec && rec.id); });
      var i = +el.getAttribute('data-i');
      if (acts[i]) api('/api/meeting-actions', { method: 'POST', body: { id: acts[i].id, column: 'today' } });
    }
  });
  window.__deskInputExt = window.__deskInputExt || {};
  window.__deskInputExt['rec-search'] = function (el, root) { recState.q = String(el.value || '').toLowerCase(); paintCols(root); };
  window.__deskKeyExt = window.__deskKeyExt || {};
  window.__deskKeyExt['rec-title'] = function (el, root, ev) {
    if (ev.key !== 'Enter') return false;
    ev.preventDefault();
    el.blur();
    var title = String(el.textContent || '').trim();
    if (!title || fixtureOn()) { toast(root, 'Title saved'); return true; }
    api('/api/recordings/' + recState.openId, { method: 'PATCH', body: { title: title } }).then(function () { loadLive(true); toast(root, 'Title saved'); });
    return true;
  };
})();
