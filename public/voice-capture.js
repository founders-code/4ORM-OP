/* Record, in the top bar on every page. Click, talk, click again. What you said becomes a to-do or a
   reminder (with its time). Uses the browser's own speech-to-text, so it works with no API key.
   "Remind me at 1530 to call Bruce" -> reminder due today 15:30. "Tomorrow send Kevin the deck" -> to-do due tomorrow. */
(function () {
  if (window.__voiceCapture) return;
  window.__voiceCapture = true;
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;

  function css() {
    if (document.getElementById('vcCss')) return;
    var st = document.createElement('style');
    st.id = 'vcCss';
    st.textContent = '#vcBtn.rec{background:#ff4d6d!important;color:#fff!important;border-color:#ff4d6d!important;box-shadow:0 0 0 4px rgba(255,77,109,.18)}'
      + '#vcBtn .vd{width:8px;height:8px;border-radius:50%;background:#ff4d6d;display:inline-block}#vcBtn.rec .vd{background:#fff;animation:vcp 1s infinite}'
      + '@keyframes vcp{50%{opacity:.3}}'
      + '#vcPanel{position:fixed;top:64px;right:18px;z-index:9998;width:min(420px,calc(100vw - 32px));background:#0e1430;border:1px solid rgba(120,150,255,.3);border-radius:14px;box-shadow:0 20px 60px rgba(0,0,0,.55);padding:14px;color:#e9eefa;font:500 13.5px Inter,system-ui,sans-serif}'
      + '#vcPanel h4{margin:0 0 8px;font-size:14px;font-weight:850;display:flex;justify-content:space-between;align-items:center}#vcPanel h4 small{color:#a3b0d2;font-weight:700;font-size:12px}'
      + '#vcPanel textarea{width:100%;min-height:84px;box-sizing:border-box;background:#070b1d;color:#e9eefa;border:1px solid rgba(120,150,255,.26);border-radius:10px;padding:9px 11px;font:inherit;resize:vertical}'
      + '#vcPanel .vk{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}#vcPanel .vk button{font:inherit;font-size:12.5px;font-weight:750;border-radius:999px;padding:5px 12px;border:1px solid rgba(120,150,255,.26);background:transparent;color:#c8d1ea;cursor:pointer}'
      + '#vcPanel .vk button.on{background:#3b82ff;border-color:#3b82ff;color:#fff}'
      + '#vcPanel .vw{color:#a3b0d2;font-size:12.5px;margin-bottom:8px}#vcPanel .vw b{color:#fff}'
      + '#vcPanel .va{display:flex;gap:8px;justify-content:flex-end}#vcPanel .va button{font:inherit;font-weight:800;font-size:13px;border-radius:10px;padding:8px 14px;border:1px solid rgba(120,150,255,.26);background:rgba(255,255,255,.05);color:#e9eefa;cursor:pointer}'
      + '#vcPanel .va button.p{background:#3b82ff;border-color:#3b82ff;color:#fff}';
    document.head.appendChild(st);
  }

  function vanParts(d) {
    var p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Vancouver', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d);
    var g = function (t) { return Number((p.find(function (x) { return x.type === t; }) || {}).value || 0); };
    return { y: g('year'), m: g('month'), d: g('day'), h: g('hour'), mi: g('minute') };
  }
  /* A Vancouver wall-clock time to an ISO instant. */
  function vanIso(y, m, d, h, mi) {
    var guess = Date.UTC(y, m - 1, d, h, mi);
    for (var k = 0; k < 2; k++) {
      var v = vanParts(new Date(guess));
      var diff = Date.UTC(v.y, v.m - 1, v.d, v.h, v.mi) - Date.UTC(y, m - 1, d, h, mi);
      guess -= diff;
    }
    return new Date(guess).toISOString();
  }
  var WD = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

  /* Read kind, day and time from what was said. Returns { kind, title, due, label }. */
  function parse(text) {
    var t = String(text || '').trim();
    var low = t.toLowerCase();
    var kind = /\b(remind me|reminder)\b/.test(low) ? 'reminder' : /^(note|add a note|write a note|notes?)\b/.test(low) ? 'note' : 'task';
    var now = vanParts(new Date());
    var base = new Date(Date.UTC(now.y, now.m - 1, now.d));
    var addDays = 0, dayLabel = 'today';
    if (/\btomorrow\b/.test(low)) { addDays = 1; dayLabel = 'tomorrow'; }
    else if (/\bnext week\b/.test(low)) { addDays = 7; dayLabel = 'next week'; }
    else if (/\bthis week\b/.test(low)) { addDays = 2; dayLabel = 'this week'; }
    else {
      for (var i = 0; i < 7; i++) {
        if (new RegExp('\\b(on )?' + WD[i] + '\\b').test(low)) {
          var cur = base.getUTCDay();
          addDays = (i - cur + 7) % 7 || 7;
          dayLabel = WD[i].charAt(0).toUpperCase() + WD[i].slice(1);
          break;
        }
      }
    }
    var h = null, mi = 0, m;
    if ((m = low.match(/\bin (\d+|an?|one|two|three) (hour|hours|minute|minutes)\b/))) {
      var n = m[1] === 'a' || m[1] === 'an' || m[1] === 'one' ? 1 : m[1] === 'two' ? 2 : m[1] === 'three' ? 3 : Number(m[1]);
      var ms = Date.now() + n * (/hour/.test(m[2]) ? 3600000 : 60000);
      var v = vanParts(new Date(ms));
      return finish(kind, t, new Date(ms).toISOString(), 'at ' + pad(v.h) + ':' + pad(v.mi));
    }
    if ((m = low.match(/\b(?:at|by|for)\s+(\d{1,2})(?::|\.)?(\d{2})?\s*(am|pm|a\.m\.|p\.m\.)?/))) {
      h = Number(m[1]); mi = Number(m[2] || 0);
      var ap = (m[3] || '').replace(/\./g, '');
      if (!m[2] && m[1].length >= 3) { h = Math.floor(Number(m[1]) / 100); mi = Number(m[1]) % 100; }
      if (ap === 'pm' && h < 12) h += 12;
      if (ap === 'am' && h === 12) h = 0;
      if (!ap && h > 0 && h < 7) h += 12;
    } else if (/\b(this )?morning\b/.test(low)) h = 9;
    else if (/\b(this )?afternoon\b/.test(low)) h = 14;
    else if (/\btonight|this evening\b/.test(low)) h = 19;
    var day = new Date(base.getTime() + addDays * 86400000);
    var hh = h == null ? 12 : h;
    var due = vanIso(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), hh, mi);
    return finish(kind, t, due, dayLabel + (h == null ? '' : ' at ' + pad(hh) + ':' + pad(mi)));
  }
  function pad(n) { return String(n).padStart(2, '0'); }
  function finish(kind, t, due, label) {
    var title = t
      .replace(/^(please\s+)?(remind me|add a reminder|reminder|add a task|add|task|to-?do)\s*(to|that|:)?\s*/i, '')
      .replace(/\b(tomorrow|today|next week|this week|this morning|this afternoon|tonight)\b/ig, '')
      .replace(/\b(at|by|for)\s+\d{1,2}([:.]?\d{2})?\s*(am|pm|a\.m\.|p\.m\.)?/ig, '')
      .replace(/\bin (\d+|an?|one|two|three) (hours?|minutes?)\b/ig, '')
      .replace(/\b(on )?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/ig, '')
      .replace(/\s{2,}/g, ' ').replace(/^[\s,.-]+|[\s,.-]+$/g, '').replace(/^(to|that)\s+/i, '');
    title = title.charAt(0).toUpperCase() + title.slice(1);
    return { kind: kind, title: title || t, due: due, label: label };
  }

  var rec = null, listening = false, finalText = '', panel = null, kindOverride = null;
  function btn() { return document.getElementById('vcBtn'); }
  function setBtn(on) {
    var b = btn(); if (!b) return;
    b.classList.toggle('rec', on);
    b.lastChild.textContent = on ? 'Stop' : 'Record';
  }
  function openPanel() {
    css();
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'vcPanel';
      panel.innerHTML = '<h4>Record <small id="vcState">listening</small></h4><textarea id="vcText" placeholder="Talk, or type. Say remind me at 1530 to call Bruce, or tomorrow send Kevin the deck."></textarea>'
        + '<div class="vk"><button type="button" data-k="task">To-do</button><button type="button" data-k="reminder">Reminder</button><button type="button" data-k="note">Note</button><button type="button" data-k="meeting">Meeting</button></div>'
        + '<div class="vw" id="vcWhen"></div>'
        + '<div class="va"><button type="button" data-a="discard">Discard</button><button type="button" data-a="again">Record again</button><button type="button" class="p" data-a="save">Save</button></div>';
      document.body.appendChild(panel);
      panel.addEventListener('input', preview);
      panel.addEventListener('click', function (e) {
        var k = e.target.closest('[data-k]');
        if (k) { kindOverride = k.getAttribute('data-k'); preview(); if (kindOverride === 'meeting' && !listening) start(); return; }
        var a = e.target.closest('[data-a]');
        if (!a) return;
        var act = a.getAttribute('data-a');
        if (act === 'discard') { stop(); close(); }
        if (act === 'again') { finalText = ''; document.getElementById('vcText').value = ''; start(); }
        if (act === 'save') save();
      });
    }
    panel.hidden = false;
    preview();
  }
  function close() { if (panel) panel.hidden = true; kindOverride = null; }
  function current() {
    var p = parse(document.getElementById('vcText').value);
    if (kindOverride) p.kind = kindOverride;
    return p;
  }
  function preview() {
    if (!panel) return;
    var txt = document.getElementById('vcText').value.trim();
    var p = current();
    panel.querySelectorAll('[data-k]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-k') === p.kind); });
    var what = p.kind === 'note' ? 'Saves to <b>Notes</b>' : p.kind === 'meeting' ? 'Saves the whole conversation to <b>Notes</b> as meeting notes (keep recording until the meeting ends)' : 'Saves as a <b>' + (p.kind === 'reminder' ? 'reminder' : 'to-do') + '</b>';
    document.getElementById('vcWhen').innerHTML = txt ? what + ': <b>' + esc(p.kind === 'meeting' ? meetingTitle() : p.title) + '</b>' + (p.kind === 'task' || p.kind === 'reminder' ? ', ' + esc(p.label) : '') : (p.kind === 'meeting' ? 'Meeting mode: everything said is written down until you press Stop.' : 'Nothing heard yet.');
  }
  function esc(v) { return String(v || '').replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function setState(s) { var el = document.getElementById('vcState'); if (el) el.textContent = s; }

  function start() {
    openPanel();
    try { if (window.Notification && Notification.permission === 'default') Notification.requestPermission(); } catch (e) {}
    if (!SR) { setState('type it: this browser has no speech-to-text'); document.getElementById('vcText').focus(); return; }
    try { if (rec) rec.abort(); } catch (e) {}
    rec = new SR();
    rec.lang = 'en-CA';
    rec.continuous = true;
    rec.interimResults = true;
    var box = document.getElementById('vcText');
    var before = box.value ? box.value.trim() + ' ' : '';
    finalText = '';
    rec.onresult = function (ev) {
      var interim = '';
      for (var i = ev.resultIndex; i < ev.results.length; i++) {
        if (ev.results[i].isFinal) finalText += ev.results[i][0].transcript;
        else interim += ev.results[i][0].transcript;
      }
      box.value = (before + finalText + interim).replace(/\s{2,}/g, ' ');
      preview();
    };
    rec.onerror = function (e) { setState(e && e.error === 'not-allowed' ? 'microphone blocked: allow it for this site' : 'stopped'); listening = false; setBtn(false); };
    rec.onend = function () {
      /* Meeting mode keeps listening through pauses until Stop or Save. */
      if (kindOverride === 'meeting' && !stopping) { try { before = box.value ? box.value.trim() + ' ' : ''; finalText = ''; rec.start(); return; } catch (e) {} }
      listening = false; setBtn(false); setState('done: check it, then Save');
    };
    try { rec.start(); listening = true; setBtn(true); setState('listening'); } catch (e) { setState('could not start the microphone'); }
  }
  var stopping = false;
  function stop() { stopping = true; try { if (rec) rec.stop(); } catch (e) {} listening = false; setBtn(false); setTimeout(function () { stopping = false; }, 800); }

  function toast(msg) {
    var t = document.getElementById('vcToast');
    if (!t) { t = document.createElement('div'); t.id = 'vcToast'; t.setAttribute('style', 'position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:9999;background:#101a33;color:#fff;border:1px solid rgba(120,150,255,.3);border-radius:12px;padding:10px 16px;font:700 13.5px Inter,system-ui,sans-serif;box-shadow:0 14px 40px rgba(0,0,0,.45)'); document.body.appendChild(t); }
    t.textContent = msg; t.style.display = 'block'; clearTimeout(t._h); t._h = setTimeout(function () { t.style.display = 'none'; }, 3500);
  }
  function meetingTitle() {
    var p = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Vancouver', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());
    return 'Meeting ' + p.replace(',', '');
  }
  function saveNote(title, text, isMeeting) {
    var fn = window.authFetch || fetch;
    setState('saving');
    fn('/api/notes', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: title, body: text, color: isMeeting ? 'blue' : 'yellow' }) })
      .then(function (r) { if (!r || !r.ok) throw new Error('save'); return r.json(); })
      .then(function () {
        document.getElementById('vcText').value = '';
        close();
        toast(isMeeting ? 'Meeting notes saved to Notes' : 'Note saved to Notes');
        if (typeof window.renderNotes === 'function') try { window.renderNotes(); } catch (e) {}
      })
      .catch(function () { setState('could not save, try again'); });
  }
  function save() {
    stop();
    var txt = document.getElementById('vcText').value.trim();
    if (!txt) { setState('nothing to save'); return; }
    var p = current();
    if (p.kind === 'note') { saveNote(p.title.length > 80 ? p.title.slice(0, 77) + '...' : p.title, txt.replace(/^(note|add a note|write a note|notes?)[:,]?\s*/i, ''), false); return; }
    if (p.kind === 'meeting') { saveNote(meetingTitle(), txt, true); return; }
    var fn = window.authFetch || fetch;
    var body = { title: (p.kind === 'reminder' ? 'Reminder: ' : '') + p.title, area: 'other', priority: p.kind === 'reminder' ? 'high' : 'normal', due: p.due, category: p.kind === 'reminder' ? 'reminder' : 'voice' };
    setState('saving');
    fn('/api/items', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { if (!r || !r.ok) throw new Error('save'); return r.json(); })
      .then(function (row) {
        if (row && row.id) {
          fn('/api/items', { method: 'PATCH', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: row.id, notes: 'Recorded: ' + txt }) }).catch(function () {});
          var S = window.STATE || {};
          S.items = S.items || [];
          S.items.unshift(Object.assign({}, row, { source: 'voice' }));
        }
        document.getElementById('vcText').value = '';
        close();
        toast((p.kind === 'reminder' ? 'Reminder saved, ' : 'To-do saved, ') + p.label);
        if (typeof window.tdRender === 'function') window.tdRender();
      })
      .catch(function () { setState('could not save, try again'); });
  }

  function mount() {
    var anchor = document.getElementById('signalsBtn');
    if (!anchor || document.getElementById('vcBtn')) return;
    css();
    var b = document.createElement('button');
    b.className = 'tb';
    b.id = 'vcBtn';
    b.type = 'button';
    b.title = 'Record a to-do, reminder, note or meeting';
    b.innerHTML = '<span class="vd"></span><span>Record</span>';
    b.addEventListener('click', function (e) {
      e.stopPropagation();
      if (listening) { stop(); return; }
      start();
    });
    anchor.parentNode.insertBefore(b, anchor);
  }
  /* Reminders go off on time: a banner (and a desktop notification when allowed) on whatever page is open. */
  var fired = {};
  try { fired = JSON.parse(sessionStorage.getItem('vcFired') || '{}') || {}; } catch (e) { fired = {}; }
  function checkReminders() {
    var now = Date.now();
    ((window.STATE || {}).items || []).forEach(function (it) {
      if (!it || it.status === 'done' || it.status === 'dropped' || fired[it.id]) return;
      if (String(it.category || '') !== 'reminder' && !/^Reminder:/i.test(String(it.title || ''))) return;
      var due = typeof it.due === 'number' ? it.due : Date.parse(it.due || '');
      if (!isFinite(due) || due > now || now - due > 10 * 60000) return;
      fired[it.id] = 1;
      try { sessionStorage.setItem('vcFired', JSON.stringify(fired)); } catch (e) {}
      var msg = String(it.title || 'Reminder').replace(/^Reminder:\s*/i, '');
      toast('Reminder: ' + msg);
      try { if (window.Notification && Notification.permission === 'granted') new Notification('Reminder', { body: msg }); } catch (e) {}
      try { if (typeof window.fourmSound === 'function') window.fourmSound('pop'); } catch (e) {}
    });
  }
  setInterval(checkReminders, 30000);
  window.__voiceParse = parse;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
  setTimeout(mount, 1500);
})();
