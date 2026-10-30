/* Playbook beats: the deadline alert and the plan (30 Oct 2026).
   When a longer beat (newsletter, marketing drop, investor update...) is three days out or less, a card pops up
   in the corner of any page. Opening it, or clicking the beat on the Playbook, shows a calendar from today to the
   due date with the days left, and the steps to get there, each with its own date, detail, tick and note.
   Ticks and notes save to /api/playbook/beats (action plan). No icons, no emoji, 24-hour Vancouver dates. */
(function () {
  if (window.beatPlan) return;
  var TZ = 'America/Vancouver';
  var COLORS = { '--green': '#12a36a', '--blue': '#2e6bf2', '--violet': '#6b4fd8', '--red': '#e0364f', '--amber': '#c98408', '--lime': '#5f9e12' };

  /* Steps work back from the due day (at = days before due). Matched on the beat's name; the last row is the default. */
  var PLANS = [
    [/newsletter/i, [
      ['angle', 6, 'Pick the angle', 'One idea worth a reader\'s two minutes. Pull from the voice log, News saved and this month\'s calls.'],
      ['outline', 5, 'Outline', 'Headline, three points, one ask. Note the sources you will link.'],
      ['draft', 3, 'Write the draft', 'Plain language, short paragraphs, no claim the evidence does not back.'],
      ['review', 2, 'Review and links', 'Check every figure and link. Unsubscribe line and mailing address are in the footer.'],
      ['test', 1, 'Test send to Chad', 'Send one test to chad@4ormfinance.com and read it on the phone.'],
      ['send', 0, 'Schedule or send', 'Send to the list, then log it on the Playbook.']
    ]],
    [/marketing|drop/i, [
      ['pick', 6, 'Choose the piece', 'Clip, post or one-pager. Tie it to what the pipeline needs this fortnight.'],
      ['make', 4, 'Make the material', 'Script, cut or design. Keep it to one message.'],
      ['review', 2, 'Review', 'Facts, plain language, brand. Nothing described as built that is not.'],
      ['schedule', 1, 'Schedule the posts', 'LinkedIn and the site. Write the first comment.'],
      ['publish', 0, 'Publish', 'Post it and reply to early comments within the hour.']
    ]],
    [/research|paper/i, [
      ['question', 12, 'Question and sources', 'One question. List the primary sources before writing.'],
      ['outline', 9, 'Outline', 'Findings first, then method, then what it means for the reader.'],
      ['draft', 5, 'Draft', 'Use the research paper template.'],
      ['review', 2, 'Review', 'Every claim matched to a source. A second reader if possible.'],
      ['publish', 0, 'Publish', 'Site, LinkedIn, and a line in the newsletter.']
    ]],
    [/investor update/i, [
      ['metrics', 4, 'Pull the numbers', 'Cash, runway, pipeline, design partners, what moved since last month.'],
      ['write', 3, 'Write highlights and asks', 'Three wins, one challenge, two specific asks.'],
      ['review', 1, 'Review', 'Figures match the books. Nothing forward-looking stated as fact.'],
      ['send', 0, 'Send', 'Send from the Investor update draft, then log it.']
    ]],
    [/investor letter|quarter/i, [
      ['numbers', 14, 'Quarter numbers', 'Close the quarter: cash, burn, raise, milestones against plan.'],
      ['draft', 9, 'Draft the letter', 'What happened, what we learned, what is next quarter.'],
      ['advisors', 5, 'Review with advisors', 'Share the draft with an advisor and legal where needed.'],
      ['final', 2, 'Final', 'Last read, figures checked.'],
      ['send', 0, 'Send', 'Send and file a copy in Documents.']
    ]],
    [/./, [
      ['plan', 5, 'Plan', 'What done looks like, and who needs to be involved.'],
      ['draft', 3, 'Make it', 'Do the main piece of work.'],
      ['review', 1, 'Review', 'Check it before it goes out.'],
      ['done', 0, 'Done', 'Ship it and log it on the Playbook.']
    ]]
  ];

  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function today() { return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
  function utc(d) { var p = String(d).split('-').map(Number); return Date.UTC(p[0], p[1] - 1, p[2]); }
  function addDays(d, n) { return new Date(utc(d) + n * 86400000).toISOString().slice(0, 10); }
  function between(a, b) { return Math.round((utc(b) - utc(a)) / 86400000); }
  function label(d) { var p = String(d || '').split('-').map(Number); if (p.length < 3 || !p[0]) return ''; return new Date(Date.UTC(p[0], p[1] - 1, p[2], 12)).toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }); }
  function stepsFor(b) {
    for (var i = 0; i < PLANS.length; i++) if (PLANS[i][0].test(b.name || '')) return PLANS[i][1];
    return PLANS[PLANS.length - 1][1];
  }
  function colorOf(b) { return COLORS[b.color] || '#2e6bf2'; }
  function call(url, opts) {
    opts = opts || {};
    var o = { method: opts.method || 'GET', credentials: 'same-origin', headers: {} };
    if (opts.body != null) { o.headers['content-type'] = 'application/json'; o.body = JSON.stringify(opts.body); }
    var fn = typeof window.authFetch === 'function' ? window.authFetch : fetch;
    return fn(url, o).then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error((d && d.error) || 'Could not save'); return d; }); });
  }
  function leftText(n) { return n < 0 ? (-n) + (n === -1 ? ' day late' : ' days late') : n === 0 ? 'due today' : n === 1 ? 'due tomorrow' : n + ' days left'; }

  var CSS = ''
    + '.bp-card{position:fixed;right:18px;bottom:18px;z-index:150;width:340px;max-width:calc(100vw - 32px);background:#fff;color:#101a33;border-radius:14px;box-shadow:0 18px 50px rgba(3,10,30,.35);font:13px/1.4 Inter,-apple-system,"Segoe UI",system-ui,sans-serif;overflow:hidden;animation:bpIn .25s ease-out}'
    + '@keyframes bpIn{from{transform:translateY(12px);opacity:0}to{transform:none;opacity:1}}'
    + '.bp-card .h{display:flex;align-items:center;padding:10px 14px;font-size:11px;font-weight:850;letter-spacing:.06em;text-transform:uppercase;color:#7a86a0;border-bottom:1px solid #e8ecf3}'
    + '.bp-card .h span{flex:1}.bp-card .h button{border:0;background:none;color:#4a5672;font:inherit;font-size:11.5px;font-weight:750;cursor:pointer;text-transform:none;letter-spacing:0}'
    + '.bp-card .r{display:flex;align-items:center;gap:12px;padding:11px 14px;cursor:pointer;border-left:4px solid #2e6bf2}.bp-card .r+.r{border-top:1px solid #f0f2f7}.bp-card .r:hover{background:#f5f7fb}'
    + '.bp-card .r .n{font-size:22px;font-weight:850;min-width:34px;text-align:center;line-height:1}.bp-card .r .n small{display:block;font-size:10px;font-weight:750;color:#7a86a0;margin-top:2px}'
    + '.bp-card .r b{display:block;font-size:13.5px}.bp-card .r em{font-style:normal;color:#7a86a0;font-size:12px}.bp-card .r .go{margin-left:auto;font-weight:750;color:#2e6bf2;font-size:12px;white-space:nowrap}'
    + '.bp-scrim{position:fixed;inset:0;background:rgba(3,10,30,.4);z-index:160}'
    + '.bp-dr{position:fixed;top:0;right:0;bottom:0;width:min(620px,96vw);z-index:161;background:#fff;color:#101a33;box-shadow:-20px 0 60px rgba(3,10,30,.35);display:flex;flex-direction:column;font:13px/1.45 Inter,-apple-system,"Segoe UI",system-ui,sans-serif}'
    + '.bp-dr .dh{display:flex;align-items:center;gap:12px;padding:16px 20px;border-bottom:1px solid #e8ecf3}.bp-dr .dh h3{margin:0;font-size:17px;font-weight:850;flex:1;min-width:0}'
    + '.bp-dr .dh .x{cursor:pointer;font-size:13px;font-weight:750;color:#4a5672;border:0;background:none}'
    + '.bp-dr .db{flex:1;overflow:auto;padding:16px 20px 24px}'
    + '.bp-top{display:flex;gap:16px;align-items:center;margin-bottom:14px}.bp-big{font-size:44px;font-weight:900;line-height:1}.bp-big small{display:block;font-size:12px;font-weight:750;color:#7a86a0;margin-top:4px}'
    + '.bp-top .meta{font-size:13px;color:#4a5672}.bp-top .meta b{color:#101a33}.bp-prog{height:6px;border-radius:9px;background:#eef1f6;margin-top:8px;overflow:hidden}.bp-prog i{display:block;height:100%}'
    + '.bp-cal{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:14px;margin:6px 0 18px}'
    + '.bp-m h6{margin:0 0 6px;font-size:12px;font-weight:850;color:#4a5672}.bp-m .g{display:grid;grid-template-columns:repeat(7,1fr);gap:3px}'
    + '.bp-m .w{font-size:10px;font-weight:800;color:#a3acc0;text-align:center}.bp-m .d{position:relative;height:34px;border-radius:7px;background:#f5f7fb;font-size:11.5px;font-weight:700;color:#4a5672;padding:3px 4px;overflow:hidden}'
    + '.bp-m .d.e{background:none}.bp-m .d.past{opacity:.4}.bp-m .d.win{background:#eaf1fe}.bp-m .d.today{outline:2px solid #101a33;outline-offset:-2px}.bp-m .d.due{color:#fff}'
    + '.bp-m .d i{position:absolute;left:4px;right:4px;bottom:3px;font-style:normal;font-size:9px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#2e6bf2}.bp-m .d.due i{color:#fff}.bp-m .d i.ok{color:#12a36a;text-decoration:line-through}'
    + '.bp-sec{font-size:11.5px;font-weight:850;letter-spacing:.06em;text-transform:uppercase;color:#7a86a0;margin:4px 0 8px}'
    + '.bp-st{border:1px solid #e8ecf3;border-radius:12px;padding:10px 12px;margin-bottom:8px}.bp-st.late{border-color:#f5b8c2;background:#fff8f9}.bp-st.ok{background:#f6fbf8;border-color:#cfeedd}'
    + '.bp-st .t{display:flex;gap:10px;align-items:flex-start}.bp-st input[type=checkbox]{width:18px;height:18px;margin:1px 0 0;accent-color:#12a36a;flex:none;cursor:pointer}'
    + '.bp-st b{font-size:13.5px}.bp-st.ok b{text-decoration:line-through;color:#4a5672}.bp-st .when{margin-left:auto;font-size:12px;font-weight:750;color:#4a5672;white-space:nowrap}.bp-st.late .when{color:#e0364f}'
    + '.bp-st p{margin:4px 0 0 28px;color:#4a5672;font-size:12.5px}.bp-st textarea{display:block;width:calc(100% - 28px);margin:8px 0 0 28px;min-height:34px;resize:vertical;font:inherit;font-size:12.5px;border:1px solid #e8ecf3;border-radius:8px;padding:6px 8px;color:#101a33;box-sizing:border-box}'
    + '.bp-foot{display:flex;gap:8px;flex-wrap:wrap;padding:12px 20px;border-top:1px solid #e8ecf3}'
    + '.bp-btn{height:32px;border-radius:9px;border:1px solid #e8ecf3;background:#fff;color:#101a33;font:inherit;font-size:12.5px;font-weight:750;padding:0 12px;cursor:pointer;white-space:nowrap}.bp-btn.pri{background:#2e6bf2;border-color:#2e6bf2;color:#fff}'
    + '.bp-msg{font-size:12px;color:#7a86a0;margin-left:auto;align-self:center}';
  function ensureCss() {
    if (document.getElementById('bpCss')) return;
    var st = document.createElement('style'); st.id = 'bpCss'; st.textContent = CSS; document.head.appendChild(st);
  }

  var beats = [];
  var cur = null;
  var hooks = {};

  function monthHtml(y, m, b, t, steps, plan) {
    var first = new Date(Date.UTC(y, m, 1)), days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    var lead = (first.getUTCDay() + 6) % 7;
    var byDay = {};
    steps.forEach(function (s) { var d = addDays(b.nextDue, -s[1]); (byDay[d] = byDay[d] || []).push(s); });
    var html = '<div class="bp-m"><h6>' + esc(first.toLocaleDateString('en-CA', { month: 'long', year: 'numeric', timeZone: 'UTC' })) + '</h6><div class="g">'
      + ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(function (w) { return '<div class="w">' + w + '</div>'; }).join('');
    for (var i = 0; i < lead; i++) html += '<div class="d e"></div>';
    for (var d = 1; d <= days; d++) {
      var ymd = y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      var cls = 'd' + (ymd < t ? ' past' : '') + (ymd >= t && ymd <= b.nextDue ? ' win' : '') + (ymd === t ? ' today' : '') + (ymd === b.nextDue ? ' due' : '');
      var st = byDay[ymd] || [];
      var tag = ymd === b.nextDue ? '<i>Due</i>' : st.length ? '<i class="' + (plan[st[0][0]] && plan[st[0][0]].done ? 'ok' : '') + '">' + esc(st[0][2]) + '</i>' : '';
      html += '<div class="' + cls + '"' + (ymd === b.nextDue ? ' style="background:' + colorOf(b) + '"' : '') + ' title="' + esc(label(ymd) + (st.length ? ': ' + st.map(function (s) { return s[2]; }).join(', ') : '')) + '">' + d + tag + '</div>';
    }
    return html + '</div></div>';
  }

  function bodyHtml(b) {
    var t = today(), steps = stepsFor(b), plan = b.plan || {};
    var done = steps.filter(function (s) { return plan[s[0]] && plan[s[0]].done; }).length;
    var start = addDays(b.nextDue, -Math.max.apply(null, steps.map(function (s) { return s[1]; })));
    var from = start < t ? start : t;
    var p0 = from.split('-').map(Number), p1 = b.nextDue.split('-').map(Number);
    var months = '', y = p0[0], m = p0[1] - 1, guard = 0;
    while ((y < p1[0] || (y === p1[0] && m <= p1[1] - 1)) && guard++ < 6) { months += monthHtml(y, m, b, t, steps, plan); m++; if (m > 11) { m = 0; y++; } }
    var left = between(t, b.nextDue);
    var html = '<div class="bp-top"><div class="bp-big" style="color:' + colorOf(b) + '">' + Math.abs(left) + '<small>' + (left < 0 ? 'days late' : left === 1 ? 'day left' : 'days left') + '</small></div>'
      + '<div class="meta" style="flex:1"><b>' + esc(b.name) + '</b> is due <b>' + esc(label(b.nextDue)) + '</b> (' + esc(b.label || '') + ').<br>' + done + ' of ' + steps.length + ' steps done' + (b.sub ? ' &middot; ' + esc(b.sub) : '')
      + '<div class="bp-prog"><i style="width:' + Math.round(done / steps.length * 100) + '%;background:' + colorOf(b) + '"></i></div></div></div>'
      + '<div class="bp-cal">' + months + '</div>'
      + '<div class="bp-sec">The plan</div>';
    html += steps.map(function (s) {
      var day = addDays(b.nextDue, -s[1]), st = plan[s[0]] || {}, late = !st.done && day < t;
      var when = day === t ? 'Today' : late ? label(day) + ', late' : label(day);
      return '<div class="bp-st' + (st.done ? ' ok' : '') + (late ? ' late' : '') + '" data-step="' + esc(s[0]) + '"><div class="t"><input type="checkbox" data-bp-tick' + (st.done ? ' checked' : '') + ' aria-label="' + esc(s[2]) + ' done"><b>' + esc(s[2]) + '</b><span class="when">' + esc(when) + '</span></div>'
        + '<p>' + esc(s[3]) + '</p><textarea data-bp-note placeholder="Notes for this step">' + esc(st.note || '') + '</textarea></div>';
    }).join('');
    return html;
  }

  function close() { ['bpDr', 'bpScrim'].forEach(function (id) { var n = document.getElementById(id); if (n) n.remove(); }); cur = null; }
  function msg(text) { var m = document.getElementById('bpMsg'); if (m) m.textContent = text; }
  function repaint() { var db = document.getElementById('bpDb'); if (db && cur) { var top = db.scrollTop; db.innerHTML = bodyHtml(cur); db.scrollTop = top; } }
  function adopt(d) {
    if (d && Array.isArray(d.beats)) {
      beats = d.beats;
      if (cur) cur = beats.filter(function (x) { return x.id === cur.id; })[0] || cur;
      if (typeof hooks.onBeats === 'function') { try { hooks.onBeats(d); } catch (e) {} }
    }
  }
  function save(step, patch) {
    if (!cur) return;
    var b = cur;
    msg('Saving...');
    call('/api/playbook/beats', { method: 'POST', body: Object.assign({ id: b.id, action: 'plan', day: b.nextDue, step: step }, patch) })
      .then(function (d) { adopt(d); msg('Saved'); if ('done' in patch) repaint(); })
      .catch(function (e) { msg(e.message || 'Could not save'); });
  }

  function open(b, opts) {
    if (!b) return;
    opts = opts || {};
    ensureCss();
    close();
    var card = document.getElementById('bpCard'); if (card) card.remove();
    cur = b;
    var scrim = document.createElement('div'); scrim.id = 'bpScrim'; scrim.className = 'bp-scrim'; scrim.onclick = close;
    var dr = document.createElement('aside'); dr.id = 'bpDr'; dr.className = 'bp-dr'; dr.setAttribute('role', 'dialog'); dr.setAttribute('aria-label', b.name + ' plan');
    dr.innerHTML = '<div class="dh"><h3>' + esc(b.name) + ' &middot; ' + esc(leftText(between(today(), b.nextDue))) + '</h3><button type="button" class="x" data-bp-close>Close</button></div>'
      + '<div class="db" id="bpDb">' + bodyHtml(b) + '</div>'
      + '<div class="bp-foot"><button type="button" class="bp-btn pri" data-bp-done>Mark ' + esc(label(b.nextDue)) + ' done</button>'
      + (opts.onEdit ? '<button type="button" class="bp-btn" data-bp-edit>Edit beat</button>' : '')
      + '<button type="button" class="bp-btn" data-bp-play>Open Playbook</button><span class="bp-msg" id="bpMsg"></span></div>';
    document.body.appendChild(scrim);
    document.body.appendChild(dr);
    dr.addEventListener('click', function (e) {
      var tEl = e.target;
      if (tEl.closest('[data-bp-close]')) { close(); return; }
      if (tEl.closest('[data-bp-edit]')) { var cb = opts.onEdit, was = cur; close(); cb(was); return; }
      if (tEl.closest('[data-bp-play]')) { close(); var nav = document.querySelector('[data-name="Playbook"]'); if (nav) nav.click(); else location.href = '/playbook'; return; }
      if (tEl.closest('[data-bp-done]')) {
        var bb = cur;
        msg('Saving...');
        call('/api/playbook/beats', { method: 'POST', body: { id: bb.id, action: 'done', day: bb.nextDue } }).then(function (d) {
          adopt(d); close();
          if (typeof hooks.toast === 'function') hooks.toast(bb.name + ' marked done. The countdown moves to the next one.');
        }).catch(function (er) { msg(er.message || 'Could not save'); });
      }
    });
    dr.addEventListener('change', function (e) {
      var box = e.target.closest('[data-step]'); if (!box) return;
      if (e.target.matches('[data-bp-tick]')) save(box.getAttribute('data-step'), { done: !!e.target.checked });
      if (e.target.matches('[data-bp-note]')) save(box.getAttribute('data-step'), { note: e.target.value });
    });
    document.addEventListener('keydown', function esc1(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc1); } });
  }

  /* ---------- the alert ---------- */
  var SOON = 3;
  function seenKey(b) { return 'bpSeen:' + b.id + ':' + b.nextDue; }
  function dismissed(b) { try { return localStorage.getItem(seenKey(b)) === today(); } catch (e) { return false; } }
  function alertCard() {
    if (document.getElementById('bpDr')) return;
    var due = beats.filter(function (b) { var n = between(today(), b.nextDue); return n <= SOON && !dismissed(b); })
      .sort(function (a, b) { return a.nextDue < b.nextDue ? -1 : 1; });
    var old = document.getElementById('bpCard'); if (old) old.remove();
    if (!due.length) return;
    ensureCss();
    var card = document.createElement('div'); card.id = 'bpCard'; card.className = 'bp-card'; card.setAttribute('role', 'alert');
    card.innerHTML = '<div class="h"><span>Coming up</span><button type="button" data-bp-later>Later</button></div>'
      + due.slice(0, 4).map(function (b) {
        var n = between(today(), b.nextDue), steps = stepsFor(b), plan = b.plan || {};
        var done = steps.filter(function (s) { return plan[s[0]] && plan[s[0]].done; }).length;
        return '<div class="r" data-bp-open="' + esc(b.id) + '" style="border-left-color:' + colorOf(b) + '"><div class="n" style="color:' + colorOf(b) + '">' + Math.abs(n) + '<small>' + (n < 0 ? 'late' : n === 1 ? 'day' : 'days') + '</small></div>'
          + '<div><b>' + esc(b.name) + '</b><em>' + esc(leftText(n)) + ' &middot; ' + esc(label(b.nextDue)) + ' &middot; ' + done + ' of ' + steps.length + ' steps</em></div><span class="go">Plan</span></div>';
      }).join('');
    card.addEventListener('click', function (e) {
      if (e.target.closest('[data-bp-later]')) { due.forEach(function (b) { try { localStorage.setItem(seenKey(b), today()); } catch (er) {} }); card.remove(); return; }
      var r = e.target.closest('[data-bp-open]');
      if (r) open(beats.filter(function (b) { return b.id === r.getAttribute('data-bp-open'); })[0], { onEdit: hooks.edit ? function (x) { hooks.edit(x); } : null });
    });
    document.body.appendChild(card);
  }
  function load() {
    if (/(?:^|[?&])fixture=mockup/.test(String(location.search || ''))) return;
    if (/^\/(book|bruce)/.test(location.pathname)) return;
    call('/api/playbook/beats').then(function (d) { adopt(d); alertCard(); }).catch(function () {});
  }
  setTimeout(load, 2500);
  setInterval(function () { if (!document.hidden) load(); }, 30 * 60 * 1000);

  window.beatPlan = {
    open: function (b, opts) { open(b, opts); },
    setBeats: function (list) { if (Array.isArray(list)) beats = list; },
    hooks: hooks,
    stepsFor: stepsFor
  };
})();
