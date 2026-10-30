/* Email compose: any day and time proposed in the email shows on the right as "Times in this email".
   Each one opens a new Calendar event with the person the email is to, 30 minutes, Zoom included.
   Chad presses Save in the Calendar to send the invite. Nothing is booked from here. (30 Oct 2026) */
(function () {
  var DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  var MONS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  var WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function S() { return window.STATE || {}; }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function today() {
    if (typeof window.vancouverTodayDate === 'function') { try { var t = window.vancouverTodayDate(); return new Date(t.getFullYear(), t.getMonth(), t.getDate()); } catch (e) {} }
    var p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Vancouver', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()).split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }
  function ymd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function hhmm(h) { var H = Math.floor(h), M = Math.round((h - H) * 60); return String(H).padStart(2, '0') + ':' + String(M).padStart(2, '0'); }
  var DAY_RE = '(today|tomorrow|(?:next\\s+)?(?:mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)(?:day|sday|nesday|rsday|urday)?)';
  var DATE_RE = '((?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?|\\d{1,2}(?:st|nd|rd|th)?\\s+(?:of\\s+)?(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*)';
  var TIME_RE = '((?:at|@)\\s*\\d{1,2}(?::\\d{2})?(?:\\s*(?:am|pm|a\\.m\\.|p\\.m\\.))?(?![\\d:])|\\d{1,2}(?::\\d{2})?\\s*(?:am|pm|a\\.m\\.|p\\.m\\.)|\\d{1,2}:\\d{2}|\\b[0-2]\\d[0-5]\\d\\b|noon)';
  function parseTime(t) {
    t = String(t).toLowerCase().replace(/^(at|@)\s*/, '').trim();
    if (t === 'noon') return 12;
    var m = t.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?$/);
    if (!m && /^[0-2]\d[0-5]\d$/.test(t)) return +t.slice(0, 2) + (+t.slice(2)) / 60;
    if (!m) return null;
    var h = +m[1], mi = m[2] ? +m[2] : 0, ap = m[3] ? m[3][0] : '';
    if (ap === 'p' && h < 12) h += 12;
    if (ap === 'a' && h === 12) h = 0;
    if (!ap && !m[2] && h >= 1 && h <= 6) h += 12; /* "at 2" means the afternoon */
    if (h > 23 || mi > 59) return null;
    return h + mi / 60;
  }
  function parseDay(dayTxt, dateTxt, base) {
    var low = String(dateTxt || '').toLowerCase();
    if (low) {
      var mon = MONS.findIndex(function (m) { return low.indexOf(m) >= 0; });
      var dn = +(low.match(/\d{1,2}/) || [])[0];
      if (mon >= 0 && dn) {
        var d = new Date(base.getFullYear(), mon, dn);
        if (d < base && (base - d) > 30 * 86400000) d = new Date(base.getFullYear() + 1, mon, dn);
        return d;
      }
    }
    var w = String(dayTxt || '').toLowerCase();
    if (!w) return null;
    if (w === 'today') return new Date(base);
    if (w === 'tomorrow') return new Date(base.getFullYear(), base.getMonth(), base.getDate() + 1);
    var next = /^next\s+/.test(w); w = w.replace(/^next\s+/, '');
    var i = DAYS.indexOf(w.slice(0, 3));
    if (i < 0) return null;
    var diff = (i - base.getDay() + 7) % 7; if (diff === 0) diff = 7;
    return new Date(base.getFullYear(), base.getMonth(), base.getDate() + diff);
  }
  /* Finds "Tuesday at 10:00", "Mon Nov 2 at 2pm", "Nov 3 at 1330", "tomorrow at 9:30". */
  function findTimes(text) {
    var base = today();
    var re = new RegExp('(?:' + DAY_RE + '[,\\s]*(?:the\\s+)?' + DATE_RE + '?|' + DATE_RE + ')[^.\\n?!]{0,22}?' + TIME_RE, 'ig');
    var out = [], seen = {}, m;
    var src = String(text || '');
    while ((m = re.exec(src))) {
      var dayTxt = m[1] || '', dateTxt = m[2] || m[3] || '', tm = m[4];
      var d = parseDay(dayTxt, dateTxt, base);
      var h = parseTime(tm);
      if (!d || h == null) continue;
      var key = ymd(d) + ' ' + h;
      if (seen[key]) continue;
      seen[key] = 1;
      out.push({ d: ymd(d), s: h, label: WD[d.getDay()] + ' ' + d.getDate() + ' ' + MN[d.getMonth()] + ' ' + hhmm(h), said: m[0] });
    }
    return out.slice(0, 6);
  }
  window.mailFindTimes = findTimes;

  /* Open a new Calendar event, ready to Save: the person, 30 minutes, Zoom. */
  window.openCalendarDraft = function (x) {
    var before = window.__redesignCal;
    if (typeof window.switchView === 'function') window.switchView('calendar');
    var t0 = Date.now();
    (function wait() {
      var C = window.__redesignCal;
      var ready = C && typeof C.openPop === 'function' && (C !== before || Date.now() - t0 > 2500) && C.root && C.root.getElementById && C.root.getElementById('pop');
      if (!ready) { if (Date.now() - t0 < 10000) return setTimeout(wait, 200); return; }
      try { if (C.focusTo) C.focusTo(x.d); } catch (e) {}
      var ev = { isNew: true, d: x.d, s: x.s, e: x.s + 0.5, t: x.t, c: 'meet', ppl: x.ppl || [], loc: [], links: [], docs: [], notes: x.notes || '' };
      C.openPop(ev, Math.max(40, window.innerWidth / 2 - 200), 140);
    })();
  };

  function recipient() {
    var d = S().composeDraft || {};
    return (d.to || [])[0] || null;
  }
  function boxHtml(times) {
    if (!times.length) return '';
    var r = recipient();
    var who = r ? (r.name || r.email) : '';
    return '<h4>Times in this email</h4><p>Open one in the Calendar with ' + esc(who || 'them') + ', 30 minutes, Zoom included. Save there sends the invite.</p>'
      + times.map(function (t, i) {
        return '<div class="kv2" style="align-items:center;gap:8px;margin-top:6px"><span style="font-weight:750;color:#101a33">' + esc(t.label) + '</span>'
          + '<button type="button" data-mt="' + i + '" style="height:28px;border-radius:999px;border:none;background:#2e6bf2;color:#fff;font:750 12px Inter,system-ui,sans-serif;padding:0 12px;cursor:pointer">Open in Calendar</button></div>';
      }).join('');
  }
  var last = '';
  function scan() {
    var host = document.getElementById('mailDesk');
    var root = host && host.shadowRoot;
    if (!root || !S().composeOpen) { last = ''; return; }
    var cp = root.getElementById('compose');
    var body = cp && cp.querySelector('.body');
    var side = cp && cp.querySelector('.side2');
    if (!body || !side) return;
    var text = String(body.innerText || '');
    var r = recipient();
    var sig = text + '|' + (r ? r.email + r.name : '');
    var box = side.querySelector('#mtBox');
    if (sig === last && box) return;
    last = sig;
    var times = findTimes(text);
    root.__mtTimes = times;
    if (!times.length) { if (box) box.remove(); return; }
    if (!box) {
      box = document.createElement('div');
      box.id = 'mtBox';
      box.className = 'box';
      var ai = side.querySelector('.ai2');
      if (ai && ai.nextSibling) side.insertBefore(box, ai.nextSibling); else side.appendChild(box);
    }
    box.innerHTML = boxHtml(times);
    if (!root.__mtBound) {
      root.__mtBound = 1;
      root.addEventListener('click', function (e) {
        var b = e.target && e.target.closest && e.target.closest('[data-mt]');
        if (!b) return;
        e.preventDefault(); e.stopPropagation();
        var t = (root.__mtTimes || [])[+b.getAttribute('data-mt')];
        var rc = recipient();
        if (!t) return;
        var nm = rc ? (rc.name && !/@/.test(rc.name) ? rc.name : '') : '';
        var ppl = rc && rc.email ? [(nm || rc.email) + ' <' + rc.email + '>'] : [];
        var d = S().composeDraft || {};
        window.openCalendarDraft({ d: t.d, s: t.s, t: '4orm Finance' + (nm ? ' x ' + nm : ''), ppl: ppl, notes: d.subject ? 'From the email: ' + d.subject : '' });
      }, true);
    }
  }
  setInterval(function () { try { scan(); } catch (e) {} }, 1200);
})();
