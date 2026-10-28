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
  var recState = { group: 'day', q: '', openId: '', rec: null, chunks: [], paused: false, sec: 0, tick: null, stream: null, analyser: null, ctx: null, src: 'both', recId: '', chunkN: 0, warn: 0 };

  function sample() {
    return [
      { id: 'r1', day: 'Today', time: '16:10', src: 'both', duration_s: 38 * 60, title: 'Bruce and Chad - deck order and the two-pager', summary: 'Agreed to lead with the counselling demo, then the evidence record. Bruce sends the revised two-pager by Wednesday.', acts: [['Send revised two-pager', 'Bruce'], ['Book Kevin for Thursday', 'Chad']], transcript: [{ t: '00:00', who: 'Chad', text: 'Thanks for jumping on. I want to settle the order of the deck before Thursday.' }, { t: '00:31', who: 'Bruce', text: 'I think the demo has to come first. People get it once they see the conversation.' }, { t: '01:12', who: 'Chad', text: 'Agreed. Then the evidence record, then the market.' }] },
      { id: 'r2', day: 'Today', time: '11:02', src: 'both', duration_s: 24 * 60, title: 'Webinar - OSFI E-23 model risk guideline', summary: 'Notes from the OSFI webinar. E-23 takes effect 1 May 2027; firms must keep an inventory of models and show oversight.', acts: [], transcript: [{ t: '00:00', who: 'Speaker', text: "Welcome to today's session on guideline E-23." }, { t: '04:20', who: 'Speaker', text: 'Institutions are expected to maintain a model inventory.' }] },
      { id: 'r3', day: 'Sun 25 Oct', time: '07:52', src: 'mic', duration_s: 3 * 60, title: 'Idea - credit union one-pager', summary: 'One page for credit union boards: what changes for members, what it costs, and the FINTRAC angle.', acts: [['Draft the credit union one-pager', 'Chad']], transcript: [{ t: '00:00', who: 'Chad', text: 'Quick idea for the credit union one-pager.' }] },
      { id: 'r4', day: 'Thu 22 Oct', time: '10:00', src: 'both', duration_s: 55 * 60, title: 'Bow Valley CU - requirements walkthrough', summary: 'Their compliance lead needs the requirements list before the board meeting. Pricing goes in a separate page.', acts: [['Send the requirements list', 'done']], transcript: [{ t: '00:00', who: 'Chad', text: 'Thanks for making time.' }, { t: '00:42', who: 'Bow Valley', text: 'The main thing is seeing the record a member would get.' }] }
    ];
  }

  function fmtDur(s) {
    s = Number(s) || 0;
    if (s >= 3600) return Math.floor(s / 3600) + ' h ' + Math.round((s % 3600) / 60) + ' m';
    if (s >= 60) return Math.round(s / 60) + ' m';
    return (Number(s) || 0) + ' s';
  }
  function fmtWhen(iso) {
    if (!iso) return '';
    try {
      var d = new Date(iso);
      var day = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Vancouver', day: 'numeric' }).format(d);
      var mon = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Vancouver', month: 'short' }).format(d);
      var year = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Vancouver', year: 'numeric' }).format(d);
      return day + ' ' + mon + ' ' + year;
    } catch (e) { return String(iso).slice(0, 16); }
  }
  function agoChipIso(iso) {
    if (!iso) return '';
    var t = new Date(iso);
    var now = new Date();
    var a = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    var b = Date.UTC(t.getFullYear(), t.getMonth(), t.getDate());
    var days = Math.round((a - b) / 86400000);
    var text = days <= 0 ? 'Today' : days === 1 ? 'Yesterday' : days < 7 ? days + ' days ago' : days < 14 ? '1 week ago' : days < 28 ? Math.round(days / 7) + ' weeks ago' : (Math.max(1, Math.round(days / 30)) + (Math.round(days / 30) === 1 ? ' month ago' : ' months ago'));
    return '<span class="ago">' + text + '</span>';
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
    if (!wrap) {
      var host = document.getElementById('recDesk');
      if (!host) return;
      var root = host.shadowRoot || host.attachShadow({ mode: 'open' });
      wrap = root.querySelector && root.querySelector('.port-body');
      if (!wrap) {
        wrap = document.createElement('div');
        wrap.className = 'port-body';
        root.appendChild(wrap);
      }
    }
    if (P().applyPageCss) P().applyPageCss(wrap, 'rec');
    var REC = list();
    var month = REC.reduce(function (n, r) { return n + (Number(r.duration_s) || 0); }, 0);
    var src = recState.src || (S().prefs && S().prefs.rec_source) || 'both';
    recState.src = src;
    wrap.innerHTML =
      '<div class="bar"><h1>Recordings</h1><span class="sub">Record what you hear and say: calls, Zoom, videos. Every recording is transcribed, summed up and searchable.</span>'
      + '<div class="r"><div class="stats"><span><b>' + REC.filter(function (r) { return !r.proc; }).length + '</b> recordings</span><span><b>' + fmtDur(month) + '</b> this month</span></div>'
      + '<button class="btn rec" data-action="rec-sheet">Record</button></div></div>'
      + '<div class="start" id="start"><h3>What should it hear?</h3><p class="hint">Pick once. The site remembers your choice.</p>'
      + '<div class="srcs" id="srcs"><label class="' + (src !== 'mic' ? 'on' : '') + '" data-action="rec-src" data-src="both"><b>My computer\'s sound and my mic</b><span>For Zoom, Teams, phone calls through the computer, or a video. Your browser asks which screen or tab to listen to: pick it and tick Share audio.</span></label>'
      + '<label class="' + (src === 'mic' ? 'on' : '') + '" data-action="rec-src" data-src="mic"><b>Just my mic</b><span>For a meeting in the room or a voice note.</span></label></div>'
      + '<div class="row"><input id="recTitle" placeholder="Name it now, or leave it blank and the title is written for you"><button class="btn" data-action="rec-cancel">Cancel</button><button class="btn pri" data-action="rec-start">Start recording</button></div>'
      + '<div class="note">Let people know you are recording. Audio and transcripts stay private to your account.</div></div>'
      + '<div class="recbar" id="recbar"><span class="live"><i></i><span id="liveTxt">Recording</span></span><span class="tm" id="tm">00:00</span>'
      + '<div class="lv"><span>Computer</span><i><b id="lvC"></b></i><span>Mic</span><i><b id="lvM"></b></i></div>'
      + '<input class="ttl" id="liveTitle" placeholder="Title (optional)">'
      + '<button class="btn sm" data-action="rec-pause">Pause</button><button class="btn sm pri" data-action="rec-stop">Stop and save</button><button class="btn sm" data-action="rec-discard">Discard</button>'
      + '<div class="warn" id="warnC">No sound from the computer yet. If the other people are silent, that is fine. If they are talking, stop and start again, and tick Share audio in the browser window.</div></div>'
      + '<div class="tools"><input class="search" id="q" data-action="rec-search" placeholder="Search everything that was said: titles, summaries and transcripts"><span class="cnt" id="cnt"></span></div>'
      + '<div class="list" id="list"></div>'
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
    if (r.proc || r.status === 'transcribing' || r.status === 'summarizing' || r.status === 'waiting' || /waiting for transcription|openai|transcrib/i.test(String(r.step || r.detail || ''))) {
      /* Without OPENAI_API_KEY nothing is actually transcribing - never claim it is. */
      var peerWaiting = (S().recordings || []).some(function (x) {
        return /waiting for transcription|openai_api_key|openai/i.test(String(x.step || x.detail || x.error || ''));
      });
      var waiting = r.status === 'waiting' || /waiting for transcription|openai|not set/i.test(String(r.step || r.detail || r.error || ''));
      var noKey = waiting || peerWaiting || window.__openaiMissing !== false;
      var label = noKey ? 'Waiting for transcription - add OPENAI_API_KEY in Vercel' : (r.step || 'Transcribing');
      var body = noKey
        ? (esc(fmtDur(r.duration_s)) + ' recorded. Transcription cannot run until OPENAI_API_KEY is set in Vercel.')
        : (esc(fmtDur(r.duration_s)) + ' recorded. The title, summary and actions appear here when it\'s done.');
      return '<div class="rc proc" data-action="rec-open" data-id="' + esc(r.id) + '"><div class="k"><span class="tag ' + esc(r.type) + '">' + esc(TYPES[r.type] || r.type) + '</span><span class="when">' + esc(r.when || '') + ' ' + agoChipIso(r.started_at) + '</span></div><h4>' + esc(label) + '</h4><p>' + body + '</p>' + (noKey ? '' : '<div class="prog"><i style="width:' + (r.pct || 35) + '%"></i></div>') + '</div>';
    }
    var owed = (r.acts || []).filter(function (a) { return a[1] !== 'done'; }).length;
    var ppl = (r.people || []).filter(function (p) { return !/^chad$/i.test(p); }).join(', ') || 'Just you';
    return '<div class="rc" data-action="rec-open" data-id="' + esc(r.id) + '"><div class="k"><span class="tag ' + esc(r.type) + '">' + esc(TYPES[r.type] || r.type) + '</span><span class="when">' + esc(r.when || '') + ' ' + agoChipIso(r.started_at) + '</span></div><h4>' + esc(r.title || 'Recording') + '</h4><p>' + esc(r.summary || '') + '</p><div class="ft"><span>' + esc(fmtDur(r.duration_s)) + '</span><span class="pp">' + esc(ppl) + '</span>' + (owed ? '<span class="ow">' + owed + ' owed</span>' : '') + '</div></div>';
  }
  function dayOf(r) {
    if (r.day) return r.day;
    var iso = r.started_at;
    if (!iso) return 'Earlier';
    try {
      var van = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Vancouver', weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(iso));
      var today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Vancouver', weekday: 'short', day: 'numeric', month: 'short' }).format(new Date());
      return van === today ? 'Today' : van;
    } catch (e) { return 'Earlier'; }
  }
  function timeOf(r) {
    if (r.time) return r.time;
    if (!r.started_at) return '';
    try { return new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Vancouver', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(r.started_at)); }
    catch (e) { return ''; }
  }
  function paintCols(wrap) {
    var box = wrap.getElementById ? wrap.getElementById('list') : wrap.querySelector('#list');
    if (!box) return;
    var q = recState.q;
    var shown = list().filter(function (r) { return r.proc || matches(r, q); });
    var cnt = wrap.getElementById ? wrap.getElementById('cnt') : wrap.querySelector('#cnt');
    if (cnt) cnt.textContent = q ? (shown.length + (shown.length === 1 ? ' match' : ' matches')) : '';
    if (!shown.length) {
      box.innerHTML = '<div class="empty">' + (q ? 'Nothing said matches "' + esc(q) + '". Try a name, a company or a word from the call.' : 'No recordings yet. Press Record before your next call.') + '</div>';
      return;
    }
    var h = '', last = '';
    shown.forEach(function (r) {
      var day = dayOf(r);
      if (day !== last) { last = day; h += '<div class="day">' + esc(day) + '</div>'; }
      var src = (r.src || r.type) === 'mic' || r.type === 'voice' ? 'mic' : 'both';
      var mins = Math.max(1, Math.round((Number(r.duration_s) || 0) / 60));
      if (r.proc || r.status === 'transcribing' || r.status === 'summarizing' || r.status === 'waiting') {
        var peerWait = (S().recordings || []).some(function (x) {
          return /waiting for transcription|openai_api_key|openai/i.test(String(x.step || x.detail || ''));
        });
        var noKey = r.status === 'waiting' || peerWait || window.__openaiMissing !== false || /waiting for transcription|openai/i.test(String(r.step || ''));
        var stepLab = noKey ? 'Waiting for transcription - add OPENAI_API_KEY in Vercel' : (r.step || 'Transcribing');
        h += '<div class="rw proc" data-action="rec-open" data-id="' + esc(r.id) + '"><span class="t">' + esc(timeOf(r)) + '</span><div style="min-width:0"><h4>' + esc(stepLab) + '</h4>' + (noKey ? '' : '<div class="prog"><i style="width:' + (r.pct || 35) + '%"></i></div>') + '</div><span class="src' + (src === 'mic' ? ' mic' : '') + '">' + (src === 'mic' ? 'Mic' : 'Computer and mic') + '</span><span class="d">' + mins + ' m</span></div>';
        return;
      }
      var line = r.summary || '';
      if (q) {
        var hit = [r.title, r.summary].concat((r.transcript || []).map(function (t) { return t.text || ''; })).find(function (x) { return String(x).toLowerCase().indexOf(q) >= 0; });
        if (hit && String(r.title).toLowerCase().indexOf(q) < 0) line = hit;
      }
      h += '<div class="rw" data-action="rec-open" data-id="' + esc(r.id) + '"><span class="t">' + esc(timeOf(r)) + '</span><div style="min-width:0"><h4>' + esc(r.title) + '</h4><p>' + esc(line) + '</p></div><span class="src' + (src === 'mic' ? ' mic' : '') + '">' + (src === 'mic' ? 'Mic' : 'Computer and mic') + '</span><span class="d">' + mins + ' m ' + agoChipIso(r.started_at) + '</span></div>';
    });
    box.innerHTML = h;
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
      + '<div class="r"><button class="btn sm" data-action="rec-space">Add to a Space</button><button class="btn sm red" data-action="rec-delete">Delete</button><button class="btn sm" data-action="rec-close">Close</button></div></div>'
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
    var src = recState.src || 'both';
    var start = root.getElementById ? root.getElementById('start') : root.querySelector('#start');
    if (start) start.classList.remove('on');
    function mixAndRecord(compStream, micStream) {
      recState.ctx = new (window.AudioContext || window.webkitAudioContext)();
      var dest = recState.ctx.createMediaStreamDestination();
      recState.analyser = recState.ctx.createAnalyser();
      if (micStream) recState.ctx.createMediaStreamSource(micStream).connect(dest);
      if (compStream && compStream.getAudioTracks().length) recState.ctx.createMediaStreamSource(compStream).connect(dest);
      else if (src !== 'mic') {
        var warn = root.getElementById ? root.getElementById('warnC') : root.querySelector('#warnC');
        if (warn) warn.classList.add('on');
      }
      if (micStream) recState.ctx.createMediaStreamSource(micStream).connect(recState.analyser);
      var tracks = dest.stream.getAudioTracks();
      if (!tracks.length && micStream) tracks = micStream.getAudioTracks();
      recState.stream = new MediaStream(tracks.concat((compStream && compStream.getVideoTracks()) || []));
      if (compStream) compStream.getVideoTracks().forEach(function (t) { t.stop(); });
      recState.chunks = [];
      recState.sec = 0;
      recState.paused = false;
      recState.chunkN = 0;
      recState.rec = new MediaRecorder(new MediaStream(tracks), { mimeType: 'audio/webm;codecs=opus' });
      recState.rec.ondataavailable = function (e) {
        if (!e.data || !e.data.size) return;
        recState.chunks.push(e.data);
        if (recState.recId && !fixtureOn()) {
          blobToB64(e.data).then(function (b64) {
            api('/api/recordings/' + recState.recId + '/chunk', { method: 'POST', body: { n: recState.chunkN++, b64: b64 } });
          });
        }
      };
      recState.rec.start(10000);
      var bar = root.getElementById ? root.getElementById('recbar') : root.querySelector('#recbar');
      if (bar) { bar.classList.add('on'); bar.classList.remove('paused'); }
      var titleIn = root.getElementById ? root.getElementById('recTitle') : root.querySelector('#recTitle');
      var liveT = root.getElementById ? root.getElementById('liveTitle') : root.querySelector('#liveTitle');
      if (liveT && titleIn) liveT.value = titleIn.value || '';
      recState.tick = setInterval(function () {
        if (recState.paused) return;
        recState.sec += 1;
        var tm = root.getElementById ? root.getElementById('tm') : root.querySelector('#tm');
        if (tm) tm.textContent = String(Math.floor(recState.sec / 60)).padStart(2, '0') + ':' + String(recState.sec % 60).padStart(2, '0');
        var lvM = root.getElementById ? root.getElementById('lvM') : root.querySelector('#lvM');
        var lvC = root.getElementById ? root.getElementById('lvC') : root.querySelector('#lvC');
        if (lvM) lvM.style.width = (10 + Math.random() * 60) + '%';
        if (lvC) lvC.style.width = src === 'mic' ? '0%' : ((recState.sec % 7 < 5 ? 20 + Math.random() * 70 : 0) + '%');
      }, 1000);
      toast(root, 'Recording. Keep this tab open.');
      if (fixtureOn()) return;
      api('/api/recordings', { method: 'POST', body: { type: src === 'mic' ? 'voice' : 'person', duration_s: 0, started_at: new Date().toISOString() } })
        .then(function (r) { return r && r.ok ? r.json() : null; })
        .then(function (row) { if (row && row.id) recState.recId = row.id; });
    }
    var mic = navigator.mediaDevices && navigator.mediaDevices.getUserMedia
      ? navigator.mediaDevices.getUserMedia({ audio: true })
      : Promise.reject();
    if (src === 'mic') {
      mic.then(function (s) { mixAndRecord(null, s); }).catch(function () { toast(root, 'Mic permission is needed to record'); });
      return;
    }
    var disp = navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia
      ? navigator.mediaDevices.getDisplayMedia({ video: true, audio: true, systemAudio: 'include' })
      : Promise.reject();
    Promise.all([disp.catch(function () { return null; }), mic.catch(function () { return null; })]).then(function (pair) {
      if (!pair[0] && !pair[1]) { toast(root, 'This browser cannot record'); return; }
      mixAndRecord(pair[0], pair[1]);
    });
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

  window.paintRedesignRecordings = function () {
    try { paint(); } catch (e) {}
    whenCss(function () {
      paint();
      if (!fixtureOn()) loadLive(true);
    });
  };
  setTimeout(function () {
    if ((window.STATE && window.STATE.desk === 'rec') || /recording/.test(location.pathname || '')) {
      window.paintRedesignRecordings();
    }
  }, 300);

  window.__deskRefreshExt = window.__deskRefreshExt || {};
  window.__deskRefreshExt.rec = function () { if (S().desk === 'rec') loadLive(true); };

  window.deskActions = window.deskActions || {};
  Object.assign(window.deskActions, {
    'rec-src': function (el, root) {
      recState.src = el.getAttribute('data-src') || 'both';
      root.querySelectorAll('#srcs label').forEach(function (n) { n.classList.toggle('on', n === el); });
      if (!fixtureOn()) api('/api/prefs', { method: 'PATCH', body: { rec_source: recState.src } });
    },
    'rec-cancel': function (el, root) {
      var start = root.getElementById ? root.getElementById('start') : root.querySelector('#start');
      if (start) start.classList.remove('on');
    },
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
    'rec-sheet': function (el, root) {
      var start = root.getElementById ? root.getElementById('start') : root.querySelector('#start');
      if (start) start.classList.add('on');
    },
    'rec-open': function (el, root) {
      var id = el.getAttribute('data-id');
      if (id) openDrawer(root, id);
      else {
        var start = root.getElementById ? root.getElementById('start') : root.querySelector('#start');
        if (start) start.classList.add('on');
      }
    },
    'rec-delete': function (el, root) {
      var id = recState.openId;
      if (!id) return;
      var gone = (S().recordings || []).filter(function (r) { return String(r.id) === String(id); })[0];
      S().recordings = (S().recordings || []).filter(function (r) { return String(r.id) !== String(id); });
      recState.openId = '';
      paint();
      if (fixtureOn()) { toast(root, 'Recording deleted.'); return; }
      api('/api/recordings/' + id, { method: 'DELETE' });
      toast(root, 'Recording deleted.', function () {
        if (gone) S().recordings.unshift(gone);
        if (!fixtureOn()) api('/api/recordings/' + id, { method: 'PATCH', body: { status: 'ready', restore: true } });
        paint();
      });
    },
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
