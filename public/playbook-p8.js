/* Playbook 09g to-do board, views, Say it, edit plays. Bound after the plays grid mounts. */
(function () {
  var SC = { Zoom: '#a173ff', 'Bruce asked': '#a173ff', Email: '#3b82ff', 'Voice log': '#ff5fa8', 'Outreach list': '#19d38a', Typed: '#ffb547', Planner: '#2fd6c6' };
  var LINK = { Zoom: 'Open the Zoom notes', 'Bruce asked': 'Open the Zoom notes', Email: 'Open the email', 'Voice log': 'Play the voice note', 'Outreach list': "Open the Pre-seed list", Typed: '' };
  /* Exact 09g To-do seed (design-reference/redesign/09g-playbook.html). */
  function seed() {
    return [
      { id: 1, t: 'Call Kevin about the investor list for Bruce', src: 'Bruce asked', from: 'Zoom with Bruce, 26 Oct', who: 'Kevin', n: 'Bruce wants the investor list split by who Kevin already knows. Ask Kevin which of the 25 funds he has a warm path to, and which he would rather Bruce opens.', b: 'today', w: 0 },
      { id: 2, t: "Send today's 5 pre-seed emails", src: 'Outreach list', from: 'Contacts · Pre-seed investors', b: 'today', w: 0 },
      { id: 3, t: 'Send Kevin the GTM deck', src: 'Voice log', from: 'you said "by Tuesday"', who: 'Kevin', n: 'The GTM deck is the October version. Kevin needs the pricing slide and the broker funnel numbers.', b: 'today', w: 2 },
      { id: 4, t: 'Reply to Bruce Fair about the 2-pager', src: 'Email', from: 'you owe a reply, 9h', who: 'Bruce', n: 'Bruce sent the 2-pager with edits on page 2. Reply with the fixed version or a time to go through it.', b: 'today', w: 0 },
      { id: 5, t: 'Send Bruce the pilot outline', src: 'Voice log', from: 'Thu 4:40 pm note', who: 'Bruce', n: 'Pilot outline: scope, 30 days, success measures. Bruce takes it to the brokerage on Friday.', b: 'week', w: 4 },
      { id: 6, t: 'Set the OpenAI key in Vercel for Recordings', src: 'Typed', from: 'Integrations shows it missing', b: 'week', w: 0 },
      { id: 7, t: 'Book the Speer architecture review', src: 'Zoom', from: 'Speer sync, 22 Oct', who: 'Mathew', b: 'week', w: 0 },
      { id: 8, t: 'Newsletter: RPAA deadline angle', src: 'Voice log', from: 'idea from today', b: 'next', w: 0 },
      { id: 9, t: 'Run Prompt 7c', src: 'Typed', from: 'Spaces menu and pulse fix', b: 'today', w: 0 },
      { id: 10, t: 'Send Mike Stevens the regulator intro note', src: 'Zoom', from: 'call with Mike, 21 Oct', who: 'Mike', n: 'Mike offered intros to BCFSA and FSRA. Send the short note and the one-pager so he can forward it.', b: 'today', w: 5 },
      { id: 11, t: 'Pick the Timeline look', src: 'Typed', from: 'design page', b: 'week', w: 0 },
      { id: 12, t: 'Draft the November investor update', src: 'Voice log', from: 'monthly beat', b: 'next', w: 0 }
    ];
  }
  function escT(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  /* Live to-dos: every open task on the board, bucketed by its due date (Vancouver day). */
  function liveTD() {
    var items = ((window.STATE || {}).items || []).filter(function (it) {
      if (!it || !it.id || it.status === 'done' || it.status === 'dropped' || it.plan_of || it.planOf) return false;
      /* Imported mail and Planner roadmap steps are not to-dos. */
      return !/^(gmail|mail|email_sync|roadmap|timeline)$/i.test(String(it.source || ''));
    });
    var now = new Date();
    var endToday = new Date(now); endToday.setHours(23, 59, 59, 999);
    var endWeek = new Date(endToday); endWeek.setDate(endWeek.getDate() + 7);
    function srcOf(s) {
      s = String(s || '').toLowerCase();
      if (/zoom/.test(s)) return 'Zoom';
      if (/mail|gmail/.test(s)) return 'Email';
      if (/voice/.test(s)) return 'Voice log';
      if (/list|outreach|reach/.test(s)) return 'Outreach list';
      return 'Typed';
    }
    return items.map(function (it) {
      var due = it.due == null || it.due === '' ? NaN : (typeof it.due === 'number' ? it.due : (/^\d+$/.test(String(it.due)) ? Number(it.due) : Date.parse(it.due)));
      var b = !isFinite(due) ? 'next' : due <= endToday.getTime() ? 'today' : due <= endWeek.getTime() ? 'week' : 'next';
      var late = isFinite(due) && due < now.getTime() - 86400000 ? Math.floor((now.getTime() - due) / 86400000) : 0;
      return { id: String(it.id), t: String(it.title || 'Untitled task'), src: srcOf(it.source), from: String(it.category || it.area || ''), n: String(it.notes || ''), b: b, w: late, due: due };
    }).concat(planTD()).sort(function (a, c) { return (isFinite(a.due) ? a.due : 9e15) - (isFinite(c.due) ? c.due : 9e15); });
  }
  /* Planner steps that land in the next two weeks (or are in motion) are to-dos too, so the timeline gets worked. */
  var PLAN = [];
  var PIPE_NAME = { corporate: 'Corporate', capital: 'Capital', revenue: 'Revenue', marketing: 'Marketing', development: 'Development', partnership: 'Partnership', regulators: 'Regulators', team: 'Team' };
  function planTD() {
    var today = Math.floor(Date.now() / 86400000);
    return PLAN.filter(function (i) {
      if (!i || i.st === 'done' || i.p === 'goals' || (i.kind !== 'span' && i.kind !== 'ms')) return false;
      return i.e <= today + 13 || (i.kind === 'span' && i.s <= today && i.e >= today);
    }).map(function (i) {
      var due = i.e * 86400000 + 19 * 3600000;
      var b = i.e <= today ? 'today' : i.e <= today + 7 ? 'week' : 'next';
      return { id: 'tl:' + i.id, t: String(i.n || 'Planner step'), src: 'Planner', from: (PIPE_NAME[i.p] || i.p || '') + (i.kind === 'span' ? ' step' : ' key date'), n: '', b: b, w: i.e < today ? today - i.e : 0, due: due, plan: true };
    });
  }
  function loadPlan(then) {
    var fn = typeof window.authFetch === 'function' ? window.authFetch : fetch;
    fn('/api/timeline', { credentials: 'same-origin' }).then(function (r) { return r && r.ok ? r.json() : null; }).then(function (d) {
      if (d && Array.isArray(d.items)) PLAN = d.items;
      if (then) then();
    }).catch(function () {});
  }
  window.bindPlaybookP8 = function (root) {
    if (!root || !root.querySelector) return;
    var todo = root.querySelector('#todo');
    if (!todo || todo._p8) return;
    todo._p8 = 1;
    var LIVE = !/(?:^|[?&])fixture=mockup(?:&|$)/.test(location.search || '');
    var TD = LIVE ? liveTD() : seed();
    var doneToday = 0, nid = 40;
    function $(id) { return root.getElementById ? root.getElementById(id) : root.querySelector('#' + id); }
    function note(m) {
      var t = $('toast') || document.getElementById('actNote');
      if (!t) return;
      t.textContent = m;
      t.classList.add('show');
      t.hidden = false;
      clearTimeout(t._t);
      t._t = setTimeout(function () { t.classList.remove('show'); }, 1800);
    }
    function apiCall(url, method, body) {
      var fn = typeof window.authFetch === 'function' ? window.authFetch : fetch;
      return fn(url, { method: method, credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    }
    function dueFor(b) {
      var d = new Date(); d.setHours(12, 0, 0, 0);
      if (b === 'week') d.setDate(d.getDate() + 3);
      if (b === 'next') d.setDate(d.getDate() + 8);
      return d.toISOString();
    }
    function patchLocal(id, body) {
      var S0 = window.STATE || {};
      (S0.items || []).forEach(function (it) { if (String(it.id) === String(id)) Object.assign(it, body, { updatedAt: Date.now() }); });
    }
    function patchLive(id, body) {
      patchLocal(id, body);
      return apiCall('/api/items', 'PATCH', Object.assign({ id: id }, body)).then(function (r) { if (!r || !r.ok) throw new Error('save'); return r; })
        .catch(function () { note('Could not save that. Try again.'); });
    }
    /* Refresh today's Completed record so a ticked to-do shows there straight away. */
    function snapToday() { apiCall('/api/snapshots', 'POST', {}).catch(function () {}); }
    function undoToast(msg, undo) {
      var old = window.document.getElementById('tdUndo');
      if (old) old.remove();
      var t = window.document.createElement('div');
      t.id = 'tdUndo';
      t.setAttribute('style', 'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:9999;background:#101a33;color:#fff;border:1px solid rgba(120,150,255,.3);border-radius:12px;padding:10px 12px 10px 16px;display:flex;gap:14px;align-items:center;font:600 13.5px Inter,system-ui,sans-serif;box-shadow:0 14px 40px rgba(0,0,0,.45)');
      t.innerHTML = '<span></span><button type="button" style="font:700 13px Inter,system-ui,sans-serif;background:#1f5fff;color:#fff;border:0;border-radius:8px;padding:6px 12px;cursor:pointer">Undo</button>';
      t.firstChild.textContent = msg;
      t.querySelector('button').onclick = function () { t.remove(); undo(); };
      window.document.body.appendChild(t);
      setTimeout(function () { if (t.parentNode) t.remove(); }, 6000);
    }
    function setPlanDone(x, done) {
      var id = String(x.id).slice(3);
      PLAN.forEach(function (i) { if (String(i.id) === id) i.st = done ? 'done' : ''; });
      return apiCall('/api/timeline/items/' + encodeURIComponent(id), 'PATCH', { st: done ? 'done' : '' }).catch(function () { note('Could not save that. Try again.'); });
    }
    function setStatusLive(x, status, msg) {
      if (String(x.id).indexOf('tl:') === 0) {
        setPlanDone(x, status === 'done').then(function () { if (status === 'done') snapToday(); });
        render();
        undoToast(msg, function () { setPlanDone(x, false).then(snapToday); render(); });
        return;
      }
      var S0 = window.STATE || {};
      var row = (S0.items || []).filter(function (it) { return String(it.id) === String(x.id); })[0];
      var prev = (row && row.status && row.status !== 'done' && row.status !== 'dropped') ? row.status : 'new';
      patchLive(x.id, { status: status }).then(function () { if (status === 'done') snapToday(); });
      render();
      undoToast(msg, function () {
        patchLive(x.id, { status: prev }).then(function () { if (status === 'done') snapToday(); });
        render();
      });
    }
    function completeLive(x, el) {
      if (el) {
        el.classList.add('done');
        var cb = el.querySelector('.cb'); if (cb) cb.textContent = 'Y';
        el.style.transition = 'opacity .35s ease, transform .35s ease';
        el.style.opacity = '0'; el.style.transform = 'translateX(14px)';
      }
      doneToday += 1;
      setTimeout(function () { setStatusLive(x, 'done', 'Done. It is in Completed.'); }, el ? 360 : 0);
    }
    function addLive(title, b) {
      apiCall('/api/items', 'POST', { title: title, area: 'other', priority: 'normal', due: dueFor(b) })
        .then(function (r) { if (!r || !r.ok) throw new Error('add'); return r.json(); })
        .then(function (row) {
          var S0 = window.STATE || (window.STATE = {});
          S0.items = S0.items || [];
          if (row && row.id) S0.items.unshift(row);
          render();
          note('Added');
        })
        .catch(function () { note('Could not add that. Try again.'); });
    }
    function render() {
      if (LIVE) TD = liveTD();
      ['today', 'week', 'next'].forEach(function (b) {
        var r = TD.filter(function (x) { return x.b === b && !x.gone && !(LIVE && x.done); });
        var cnt = $('cnt-' + b);
        if (cnt) cnt.textContent = r.filter(function (x) { return !x.done; }).length;
        var host = $('b-' + b);
        if (!host) return;
        var port = (root.querySelector && root.querySelector('.port-body')) || root.host || document.body;
        var focus = document.body.classList.contains('focusday') || (port && port.classList && port.classList.contains('focusday'));
        host.innerHTML = r.map(function (x, k) {
          return '<div class="ti' + (x.done ? ' done' : '') + (k >= 4 && !focus ? ' more-hide' : '') + '" style="--sc:' + (SC[x.src] || '#5b8cff') + '" draggable="true" data-id="' + x.id + '"><span class="cb" data-ck="' + x.id + '">' + (x.done ? 'Y' : '') + '</span><div class="tt" data-open="' + x.id + '">' + escT(x.t) + (x.n ? '<span class="hasn">NOTES</span>' : '') + '</div>'
            + '<div class="meta"><span class="src">' + escT(x.src) + '</span><span>' + escT(x.from || '') + '</span>' + (x.who ? '<span>with ' + escT(x.who) + '</span>' : '') + (x.w ? '<span class="late">waiting ' + x.w + ' day' + (x.w > 1 ? 's' : '') + '</span>' : '') + '</div></div>';
        }).join('') + (r.length > 4 && !focus ? '<div class="tmore" data-exp="' + b + '">+ ' + (r.length - 4) + ' more</div>' : '') || '<div style="color:#6f7fa6;font-size:12.5px;padding:8px 4px">Nothing here.</div>';
      });
      var dn = $('tdDone');
      if (dn) dn.textContent = doneToday;
      window.TDL = TD;
      paintFocus();
    }
    /* Focus today: only what is needed today. Calendar for today, today's daily plays, and to-dos due today.
       Full week keeps the Today / This week / Next week board. */
    var TITLES = { today: 'Today', week: 'This week', next: 'Next week' };
    function isFocus() {
      var port = (root.querySelector && root.querySelector('.port-body')) || root.host || document.body;
      return document.body.classList.contains('focusday') || !!(port && port.classList && port.classList.contains('focusday'));
    }
    function vanDay(ms) {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Vancouver', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
    }
    function vanTime(ms) {
      return new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Vancouver', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(ms));
    }
    function setTitle(b, text, n) {
      var col = todo.querySelector('.tdc[data-b="' + b + '"]');
      if (!col) return;
      var h = col.querySelector('h4');
      if (h) h.innerHTML = escT(text) + ' <i id="cnt-' + b + '">' + (n == null ? '' : n) + '</i>';
      col.style.setProperty('--cc', b === 'week' && todo.classList.contains('fx') ? '#4d7cff' : b === 'next' && todo.classList.contains('fx') ? '#2fe08b' : ({ today: '#ff5a6e', week: '#ffb547', next: '#3b82ff' })[b]);
    }

    /* ---------- Focus today: calls, and a pop-up for every item ---------- */
    var FX = { evs: [], plays: [], ti: 0, calls: null, at: 0 };
    var OUTS = ['No answer', 'Left voicemail', 'Spoke', 'Interested', 'Call back', 'Not interested', 'Wrong number', 'Meeting booked'];
    function loadCalls(force) {
      if (!LIVE) return;
      if (!force && FX.calls && Date.now() - FX.at < 90000) return;
      FX.at = Date.now();
      apiCall('/api/growth?calls=1', 'GET').then(function (r) { return r && r.ok ? r.json() : null; }).then(function (d) {
        if (d) { FX.calls = d; paintCalls(); }
      }).catch(function () {});
    }
    function fmtTel(v) { return String(v || '').split(/\s*(?:;|\/|,|\bor\b)\s*/)[0].replace(/[^\d+]/g, ''); }
    /* How to reach them: LinkedIn for the angels list, else the phone, else email. */
    function reachLink(r) {
      var tel = fmtTel(r.phone);
      var li = String(r.linkedin || '');
      if (li && !/^https?:/i.test(li)) li = 'https://' + li;
      if (r.channel === 'LinkedIn' && li) return '<a href="' + escT(li) + '" target="_blank" rel="noopener" data-stop="1">LinkedIn</a>';
      if (tel) return '<a href="tel:' + escT(tel) + '" data-stop="1">Call</a>';
      if (r.email) return '<a href="mailto:' + escT(r.email) + '" data-stop="1">Email</a>';
      if (li) return '<a href="' + escT(li) + '" target="_blank" rel="noopener" data-stop="1">LinkedIn</a>';
      return '';
    }
    function callRow(r, kind) {
      var who = r.list === 'angels' ? r.name : (String(r.contact || '').split(/\s*[|;]\s*/)[0] || '');
      if (/^(existing contact|leadership|executive|business contact|principal broker)/i.test(who) || /@|^\+?\d/.test(who)) who = '';
      var tel = fmtTel(r.phone);
      var dueTxt = kind === 'due' ? ('<span class="late">' + escT(r.status && r.status !== 'Not contacted' ? r.status : 'Follow up') + '</span>')
        : (r.plan_day && String(r.plan_day).slice(0, 10) < FX.calls.today ? '<span class="late">carried over</span>' : '');
      return '<div class="fxc" data-fxcall="' + escT(r.id) + '"><div class="nm"><b>' + escT(r.list === 'angels' ? r.name : (who || r.name)) + '</b>'
        + '<small>' + escT(r.list === 'angels' ? (r.title || '') : (who ? r.name : (r.title || ''))) + '</small></div>'
        + '<span class="ls">' + escT(r.listName || '') + ' · ' + escT(r.channel || 'Call') + '</span>' + dueTxt
        + (r.ghl_stage ? '<span class="gh">GHL · ' + escT(r.ghl_stage) + '</span>' : '')
        + '<span class="act">' + reachLink(r) + '<button type="button">Log</button></span></div>';
    }
    function paintCalls() {
      var host = $('fxCalls');
      if (!host) {
        var grid = todo.querySelector('.tdg');
        if (!grid) return;
        grid.insertAdjacentHTML('afterend', '<div class="fxcalls" id="fxCalls"></div>');
        host = $('fxCalls');
      }
      host.hidden = false;
      loadCalls(false);
      var d = FX.calls;
      if (!d) { host.innerHTML = '<h4>Calls today</h4><div class="fxnone">Loading your call list…</div>'; return; }
      var due = d.due || [], planned = d.planned || [];
      var cap = host._all ? 999 : 12;
      host.innerHTML = '<div class="fxch"><h4>Calls today <i>' + (due.length + planned.length) + ' to go · ' + (d.doneToday || 0) + ' done</i></h4>'
        + '<a href="#" class="fxj" data-golist="w-design">Open Lists</a></div>'
        + (due.length ? '<div class="fxrh">Call-backs and follow-ups due</div>' + due.slice(0, cap).map(function (r) { return callRow(r, 'due'); }).join('') : '')
        + '<div class="fxrh">Reach out today</div>' + (planned.length ? planned.slice(0, cap).map(function (r) { return callRow(r, 'plan'); }).join('') : '<div class="fxnone">Nobody planned for today. The Lists page plans the next days.</div>')
        + ((due.length > cap || planned.length > cap) ? '<button type="button" class="fxall" data-fxall="1">Show all ' + (due.length + planned.length) + '</button>' : '');
    }
    function fxModal(html, bind) {
      var box = $('tdbox'), m = $('tdm');
      if (!box || !m) return;
      box.style.setProperty('--sc', '#4d7cff');
      box.innerHTML = html;
      m.classList.add('open');
      m.onclick = function (e) { if (e.target === m) m.classList.remove('open'); };
      box.querySelectorAll('[data-a="close"]').forEach(function (b) { b.onclick = function () { m.classList.remove('open'); }; });
      if (bind) bind(box, function () { m.classList.remove('open'); });
    }
    function openEvent(ev) {
      var end = ev.start + (Number(ev.dur) || 30) * 60000;
      var people = (ev.attendees || ev.people || []).map(function (a) { return typeof a === 'string' ? a : (a.name || a.email || ''); }).filter(Boolean);
      fxModal('<div class="k">Calendar · today</div><div class="tn ro">' + escT(ev.title || 'Event') + '</div>'
        + '<div class="facts2"><div><small>When</small><span>' + vanTime(ev.start) + ' to ' + vanTime(end) + '</span></div><div><small>Length</small><span>' + (Number(ev.dur) || 30) + ' min</span></div><div><small>Where</small><span>' + escT(ev.location || (ev.join ? 'Online' : '-')) + '</span></div></div>'
        + (people.length ? '<div class="fxwho"><small>With</small> ' + escT(people.slice(0, 8).join(', ')) + '</div>' : '')
        + (ev.description ? '<div class="fxdesc">' + escT(String(ev.description).slice(0, 600)) + '</div>' : '')
        + '<div class="acts">' + (ev.join ? '<a class="pri btnl" href="' + escT(ev.join) + '" target="_blank" rel="noopener">Join</a>' : '')
        + '<button data-a="prep">Prep to-do for today</button><button data-a="follow">Follow-up to-do tomorrow</button><button data-a="cal">Open in Calendar</button><button data-a="close">Close</button></div>',
        function (box, close) {
          box.querySelector('[data-a="prep"]').onclick = function () { close(); addLive('Prep: ' + (ev.title || 'meeting'), 'today'); };
          box.querySelector('[data-a="follow"]').onclick = function () {
            close();
            var d = new Date(); d.setDate(d.getDate() + 1); d.setHours(12, 0, 0, 0);
            apiCall('/api/items', 'POST', { title: 'Follow up: ' + (ev.title || 'meeting'), area: 'other', priority: 'normal', due: d.toISOString() })
              .then(function (r) { if (!r || !r.ok) throw 0; return r.json(); }).then(function (row) { var S0 = window.STATE || {}; S0.items = S0.items || []; if (row && row.id) S0.items.unshift(row); render(); note('Follow-up added for tomorrow'); })
              .catch(function () { note('Could not add that. Try again.'); });
          };
          box.querySelector('[data-a="cal"]').onclick = function () { close(); if (typeof window.switchView === 'function') window.switchView('calendar'); try { history.replaceState({}, '', '/calendar'); } catch (e) {} };
        });
    }
    function openPlay(r) {
      var M = window.__playMount || {};
      var ti = FX.ti;
      var lab = (r.lab && r.lab[ti]) || '';
      var go = r.room && r.room[1] ? r.room[1] : '';
      var day = r.pads && r.pads[ti] && r.pads[ti].day;
      fxModal('<div class="k">Play · ' + escT(r.grp || 'Daily') + '</div><div class="tn ro">' + escT(r.n || 'Play') + '</div>'
        + '<div class="facts2"><div><small>Target</small><span>' + escT(r.target || (lab && !/^go$/i.test(lab) ? lab : '-')) + '</span></div><div><small>Today</small><span>' + (r.d && r.d[ti] === 'done' ? 'Done' : 'Still to do') + '</span></div><div><small>Open</small><span>' + (go ? '<a href="' + escT(go) + '">' + escT(go.replace(/^\//, '')) + '</a>' : '-') + '</span></div></div>'
        + (r.how ? '<div class="fxdesc">' + escT(r.how) + '</div>' : '')
        + '<div class="acts"><button class="pri" data-a="done">Done today</button>' + (go ? '<button data-a="go">Open</button>' : '') + '<button data-a="later">Later today</button><button data-a="close">Close</button></div>',
        function (box, close) {
          function save(status) {
            r.d[ti] = status === 'done' ? 'done' : 'next';
            if (typeof M.render === 'function') M.render();
            paintFocus();
            if (!LIVE || !r.id || !day) return;
            apiCall('/api/playbook', 'POST', { rhythmId: r.id, day: day, status: status }).then(function (x) { return x && x.ok ? x.json() : null; })
              .then(function (d) { if (d && d.rows && window.STATE) window.STATE.playbook = d; }).catch(function () { note('Could not save that play'); });
          }
          box.querySelector('[data-a="done"]').onclick = function () { close(); save('done'); undoToast(r.n + ' done', function () { r.d[ti] = 'due'; if (typeof M.render === 'function') M.render(); paintFocus(); if (LIVE && r.id && day) apiCall('/api/playbook', 'POST', { rhythmId: r.id, day: day, status: 'open' }); }); };
          box.querySelector('[data-a="later"]').onclick = function () { close(); save('snoozed'); note(r.n + ' moved to later today'); };
          var g = box.querySelector('[data-a="go"]'); if (g) g.onclick = function () { close(); window.location.href = go; };
        });
    }
    function openCall(id) {
      var d = FX.calls || {};
      var r = (d.due || []).concat(d.planned || []).filter(function (x) { return String(x.id) === String(id); })[0];
      if (!r) return;
      var tel = fmtTel(r.phone);
      var chosen = '';
      fxModal('<div class="k">' + escT(r.listName || 'Call list') + (r.ghl_stage ? ' · GoHighLevel ' + escT(r.ghl_stage) : '') + '</div><div class="tn ro">' + escT(r.name) + '</div>'
        + '<div class="facts2"><div><small>Reach by</small><span>' + (reachLink(r) || escT(r.channel || '-')) + '</span></div><div><small>Contact</small><span>' + escT(String(r.contact || '-').split(/\s*[|;]\s*/)[0]) + '</span></div><div><small>Phone</small><span>' + (tel ? '<a href="tel:' + escT(tel) + '">' + escT(r.phone) + '</a>' : '-') + '</span></div><div><small>Email</small><span>' + (r.email ? '<a href="mailto:' + escT(r.email) + '">' + escT(r.email) + '</a>' : '-') + '</span></div></div>'
        + (r.notes ? '<div class="fxdesc">' + escT(r.notes) + '</div>' : '')
        + '<div class="outs">' + OUTS.map(function (o) { return '<button type="button" data-o="' + escT(o) + '">' + escT(o) + '</button>'; }).join('') + '</div>'
        + '<textarea id="fxNote" placeholder="Call notes"></textarea>'
        + '<div class="fu"><small>Follow up</small><input type="date" id="fxFu"></div>'
        + '<div class="acts"><button class="pri" data-a="save">Save call</button><button data-a="list">Open in Lists</button><button data-a="close">Close</button></div>',
        function (box, close) {
          box.querySelectorAll('[data-o]').forEach(function (b) {
            b.onclick = function () {
              chosen = chosen === b.getAttribute('data-o') ? '' : b.getAttribute('data-o');
              box.querySelectorAll('[data-o]').forEach(function (x) { x.classList.toggle('on', x.getAttribute('data-o') === chosen); });
              var fu = box.querySelector('#fxFu');
              if (chosen === 'Call back' && fu && !fu.value) { var t = new Date(Date.now() + 86400000); fu.value = t.toLocaleDateString('en-CA', { timeZone: 'America/Vancouver' }); }
            };
          });
          box.querySelector('[data-a="save"]').onclick = function () {
            var noteTxt = String(box.querySelector('#fxNote').value || '').trim();
            var fu = box.querySelector('#fxFu').value || '';
            if (!chosen && !noteTxt) { note('Pick an outcome or write a note'); return; }
            close();
            apiCall('/api/growth', 'POST', { action: 'touch', id: r.id, channel: 'Call', outcome: chosen, note: noteTxt, next_date: fu })
              .then(function (x) { if (!x || !x.ok) throw 0; return x.json(); })
              .then(function (res) {
                var tid = res && res.touch && res.touch.id;
                if (chosen === 'Meeting booked') apiCall('/api/growth', 'PATCH', { id: r.id, stage: 'Meeting booked' });
                else if (!r.stage || r.stage === 'Cold') apiCall('/api/growth', 'PATCH', { id: r.id, stage: 'Contacted' });
                loadCalls(true);
                undoToast('Call saved: ' + r.name, function () { if (tid) apiCall('/api/growth', 'POST', { action: 'undo-touch', touchId: tid }).then(function () { loadCalls(true); }); });
              })
              .catch(function () { note('Could not save the call. Try again.'); });
          };
          box.querySelector('[data-a="list"]').onclick = function () {
            close();
            try { window.STATE.peopleTab = 'lists'; } catch (e) {}
            if (typeof window.switchView === 'function') window.switchView('people');
            try { history.replaceState({}, '', '/lists'); } catch (e) {}
          };
        });
    }
    /* Planner steps open the same pop-up as a to-do. Today, This week and Next week move the step's date on the Planner. */
    function openPlanStep(x) {
      var id = String(x.id).slice(3);
      var item = PLAN.filter(function (i) { return String(i.id) === id; })[0] || {};
      fxModal('<div class="k">Planner · ' + escT(x.from || '') + '</div><div class="tn ro">' + escT(x.t) + '</div>'
        + '<div class="facts2"><div><small>Due</small><span>' + (isFinite(x.due) ? escT(new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Vancouver', weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(x.due))) : '-') + '</span></div><div><small>Late</small><span>' + (x.w ? x.w + ' days' : 'no') + '</span></div><div><small>Owner</small><span>' + escT(item.o || 'Chad') + '</span></div></div>'
        + (item.note ? '<div class="fxdesc">' + escT(item.note) + '</div>' : '')
        + '<div class="acts"><button class="pri" data-a="done">Done</button><button data-a="today">Today</button><button data-a="week">This week</button><button data-a="next">Next week</button><button data-a="planner">To the Planner</button><button data-a="close">Close</button></div>',
        function (box, close) {
          box.querySelector('[data-a="done"]').onclick = function () { close(); setStatusLive(x, 'done', 'Done. It is in Completed.'); };
          ['today', 'week', 'next'].forEach(function (b) {
            box.querySelector('[data-a="' + b + '"]').onclick = function () {
              close();
              var iso = dueFor(b).slice(0, 10);
              var dayN = Math.floor(Date.parse(iso + 'T12:00:00Z') / 86400000);
              var body = { due_date: iso };
              if (item.s != null && item.s > dayN) body.start_date = iso;
              PLAN.forEach(function (i) { if (String(i.id) === id) { i.e = dayN; if (i.s > dayN) i.s = dayN; } });
              apiCall('/api/timeline/items/' + encodeURIComponent(id), 'PATCH', body).then(function (r) { if (!r || !r.ok) throw 0; note('Moved on the Planner'); }).catch(function () { note('Could not move that step. Try again.'); loadPlan(render); });
              render();
            };
          });
          box.querySelector('[data-a="planner"]').onclick = function () { close(); if (typeof window.switchView === 'function') window.switchView('planner'); try { history.replaceState({}, '', '/planner'); } catch (e) {} };
        });
    }
    function paintFocus() {
      var on = isFocus();
      todo.classList.toggle('fx', on);
      if (!on) {
        paintCalls();
        ['today', 'week', 'next'].forEach(function (b) { var c = $('cnt-' + b); setTitle(b, TITLES[b], c ? c.textContent : ''); });
        return;
      }
      var today = vanDay(Date.now());
      /* Calendar column (uses the "week" slot). */
      var evs = (((window.STATE || {}).events) || []).filter(function (ev) {
        return ev && ev.start && vanDay(ev.start) === today && !(ev.dur >= 1440);
      }).sort(function (a, b) { return a.start - b.start; });
      var now = Date.now();
      FX.evs = evs;
      var calHost = $('b-week');
      if (calHost) calHost.innerHTML = evs.map(function (ev, k) {
        var end = ev.start + (Number(ev.dur) || 30) * 60000;
        var live = now >= ev.start && now < end;
        return '<div class="ti fxev' + (live ? ' now' : '') + (end < now ? ' past' : '') + '" data-fxev="' + k + '" style="--sc:#4d7cff"><span class="fxt">' + vanTime(ev.start) + '</span><div class="tt">' + escT(ev.title || 'Event')
          + '</div><div class="meta"><span>' + (Number(ev.dur) || 30) + ' min</span>' + (ev.join ? '<a class="fxj" href="' + escT(ev.join) + '" target="_blank" rel="noopener">Join</a>' : '') + (live ? '<span class="late">now</span>' : '') + '</div></div>';
      }).join('') || '<div class="fxnone">Nothing on the calendar today.</div>';
      setTitle('week', 'Calendar', evs.length);
      /* Today's plays (uses the "next" slot): every daily play still due today, from the Playbook grid. */
      var M = window.__playMount || {};
      var rows = (M.rows || []).filter(function (r) { return r && !r.s && r.d; });
      var ti = M.todayIdx == null ? 0 : M.todayIdx;
      var due = rows.filter(function (r) { var st = r.d[ti]; return st === 'due' || st === 'next'; });
      FX.plays = due; FX.ti = ti;
      var playHost = $('b-next');
      if (playHost) playHost.innerHTML = due.map(function (r, k) {
        var lab = (r.lab && r.lab[ti]) || '';
        var go = r.room && r.room[1] ? r.room[1] : '';
        return '<div class="ti fxpl" data-fxplay="' + k + '" style="--sc:' + escT(r.c || '#2fe08b') + '"><div class="tt">' + escT(r.n || 'Play') + '</div><div class="meta"><span>' + escT(r.grp || 'Daily') + '</span>'
          + (lab && !/^go$/i.test(lab) ? '<span>' + escT(lab) + '</span>' : (r.target ? '<span>' + escT(r.target) + '</span>' : ''))
          + (go ? '<a class="fxj" href="' + escT(go) + '">Open</a>' : '') + '</div></div>';
      }).join('') || '<div class="fxnone">' + (rows.length ? 'Every play for today is done.' : 'Plays load with the Playbook grid.') + '</div>';
      paintCalls();
      setTitle('next', "Today's plays", due.length);
      var c = $('cnt-today');
      setTitle('today', 'To-dos due today', c ? c.textContent : '');
    }
    todo.addEventListener('click', function (e) {
      var exp = e.target.closest && e.target.closest('[data-exp]');
      if (exp) { exp.parentNode.querySelectorAll('.more-hide').forEach(function (n) { n.classList.remove('more-hide'); }); exp.remove(); return; }
      var ck = e.target.closest && e.target.closest('[data-ck]');
      if (ck) {
        var x = TD.filter(function (y) { return String(y.id) === String(ck.getAttribute('data-ck')); })[0];
        if (!x) return;
        if (LIVE) { completeLive(x, ck.closest('.ti')); return; }
        x.done = !x.done;
        doneToday += x.done ? 1 : -1;
        render();
        return;
      }
      var gl = e.target.closest && e.target.closest('[data-golist]');
      if (gl) {
        e.preventDefault();
        try { window.STATE.peopleTab = 'lists'; window.STATE.peopleListKey = gl.getAttribute('data-golist'); } catch (x) {}
        if (typeof window.switchView === 'function') window.switchView('people');
        return;
      }
      if (e.target.closest && e.target.closest('[data-stop]')) return;
      var fe = e.target.closest && e.target.closest('[data-fxev]');
      if (fe && !(e.target.closest('a'))) { var ev = FX.evs[+fe.getAttribute('data-fxev')]; if (ev) openEvent(ev); return; }
      var fp = e.target.closest && e.target.closest('[data-fxplay]');
      if (fp && !(e.target.closest('a'))) { var pr = FX.plays[+fp.getAttribute('data-fxplay')]; if (pr) openPlay(pr); return; }
      var fc = e.target.closest && e.target.closest('[data-fxcall]');
      if (fc) {
        var cid = fc.getAttribute('data-fxcall');
        if (window.openDossier) {
          var all = ((FX.calls && FX.calls.due) || []).concat((FX.calls && FX.calls.planned) || []).map(function (r) { return r.id; });
          window.openDossier(cid, { queue: all, onSaved: function () { loadCalls(true); } });
        } else openCall(cid);
        return;
      }
      var fa = e.target.closest && e.target.closest('[data-fxall]');
      if (fa) { var ch = $('fxCalls'); if (ch) { ch._all = true; paintCalls(); } return; }
      var open = e.target.closest && e.target.closest('[data-open]');
      if (open) { openTodo(open.getAttribute('data-open')); return; }
      /* In Focus today the whole card opens, not only its title. */
      var card = isFocus() && e.target.closest && e.target.closest('.ti[data-id]');
      if (card && !e.target.closest('a')) openTodo(card.getAttribute('data-id'));
    });
    todo.querySelectorAll('.tdc').forEach(function (c) {
      c.addEventListener('dragover', function (e) { e.preventDefault(); c.classList.add('drop'); });
      c.addEventListener('dragleave', function () { c.classList.remove('drop'); });
      c.addEventListener('drop', function (e) {
        e.preventDefault();
        c.classList.remove('drop');
        var id = e.dataTransfer.getData('text');
        var x = TD.filter(function (y) { return String(y.id) === String(id); })[0];
        if (!x) return;
        var nb = c.getAttribute('data-b');
        if (LIVE) {
          if (x.plan) { note('Planner steps move on the Planner'); return; }
          patchLive(x.id, { due: dueFor(nb) });
          render();
          return;
        }
        x.b = nb; render();
      });
    });
    todo.addEventListener('dragstart', function (e) {
      var ti = e.target.closest && e.target.closest('.ti');
      if (ti && e.dataTransfer) e.dataTransfer.setData('text', ti.getAttribute('data-id') || '');
    });
    var inp = $('tdIn');
    if (inp) inp.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      var v = String(inp.value || '').trim();
      if (!v) return;
      if (!/^TEST /i.test(v) && !(window.STATE && /opstest/i.test(window.STATE.email || ''))) {
        /* live adds stay; tests use TEST prefix */
      }
      var w = ($('tdWhen') && $('tdWhen').value) || 'Today';
      if (LIVE) { addLive(v, w === 'Today' ? 'today' : w === 'This week' ? 'week' : 'next'); inp.value = ''; return; }
      TD.unshift({ id: nid++, t: v, src: 'Typed', from: 'just now', b: w === 'Today' ? 'today' : w === 'This week' ? 'week' : 'next', w: 0 });
      inp.value = '';
      render();
    });
    function openTodo(id) {
      var x = TD.filter(function (y) { return String(y.id) === String(id); })[0];
      if (x && x.plan) { openPlanStep(x); return; }
      var box = $('tdbox'), m = $('tdm');
      var t0 = x ? x.t : '', n0 = x ? (x.n || '') : '';
      function saveEdits() {
        if (!LIVE || !x) return;
        if (x.t !== t0 || (x.n || '') !== n0) {
          t0 = x.t; n0 = x.n || '';
          patchLive(x.id, { title: x.t || 'Untitled task', notes: x.n || '' });
        }
      }
      if (!x || !box || !m) return;
      box.style.setProperty('--sc', SC[x.src] || '#5b8cff');
      box.innerHTML = '<div class="k">' + x.src + ' · ' + (x.b === 'today' ? 'Today' : x.b === 'week' ? 'This week' : 'Next week') + '</div><input class="tn" id="tdName" value="' + String(x.t).replace(/"/g, '&quot;') + '">'
        + '<div class="facts2"><div><small>From</small><span>' + escT(x.from || '') + '</span></div><div><small>With</small><span>' + escT(x.who || '-') + '</span></div><div><small>Waiting</small><span>' + (x.w ? x.w + ' days' : 'new') + '</span></div></div>'
        + '<textarea id="tdNotes" placeholder="Notes, links, what was said">' + escT(x.n || '') + '</textarea>'
        + '<div class="lk">' + (LINK[x.src] ? '<a>' + LINK[x.src] + '</a>' : '') + (x.who ? "<a>Open " + x.who + "'s space</a>" : '') + '<a>Add a file</a></div>'
        + '<div class="acts"><button class="pri" data-a="done">' + (x.done ? 'Mark not done' : 'Done') + '</button><button data-a="today">Today</button><button data-a="week">This week</button><button data-a="next">Next week</button><button data-a="planner">To the Planner</button><button data-a="close">Close</button><button class="del" data-a="del">Delete</button></div>';
      m.classList.add('open');
      var name = box.querySelector('#tdName');
      var notes = box.querySelector('#tdNotes');
      if (name) name.addEventListener('input', function (e) { x.t = e.target.value; });
      if (notes) notes.addEventListener('input', function (e) { x.n = e.target.value; });
      box.querySelectorAll('[data-a]').forEach(function (b) {
        b.addEventListener('click', function () {
          var a = b.getAttribute('data-a');
          if (LIVE) {
            saveEdits();
            m.classList.remove('open');
            if (a === 'done') { completeLive(x, null); return; }
            if (a === 'today' || a === 'week' || a === 'next') { patchLive(x.id, { due: dueFor(a) }); render(); return; }
            if (a === 'del') { setStatusLive(x, 'dropped', 'Removed.'); return; }
            if (a === 'planner') { patchLive(x.id, { due: dueFor('next') }); note('Moved to the Planner, due in 7 days'); render(); return; }
            render();
            return;
          }
          if (a === 'done') x.done = !x.done;
          else if (a === 'today' || a === 'week' || a === 'next') x.b = a;
          else if (a === 'planner' || a === 'del') { x.gone = 1; note(a === 'del' ? 'Removed. Undo from the toast.' : 'Moved to the Planner, Inbox, due in 7 days'); }
          m.classList.remove('open');
          render();
        });
      });
      m.onclick = function (e) { if (e.target === m) { saveEdits(); m.classList.remove('open'); render(); } };
    }
    root.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        var m = $('tdm');
        if (m && m.classList.contains('open')) { m.classList.remove('open'); render(); }
      }
    });
    var ctr = $('ctr');
    function modeHost() {
      return (root.querySelector && root.querySelector('.port-body')) || root.host || document.body;
    }
    if (ctr) ctr.querySelectorAll('button').forEach(function (x) {
      x.addEventListener('click', function () {
        var MODES = ['focusday', 'compact', 'lanes', 'blocks', 'sprint'];
        MODES.forEach(function (m) { document.body.classList.remove(m); });
        var port = modeHost();
        if (port && port.classList) MODES.forEach(function (m) { port.classList.remove(m); });
        if (window.PBWork && window.PBWork.setMode) window.PBWork.setMode(x.getAttribute('data-m'));
        if (x.getAttribute('data-m') !== 'full') {
          document.body.classList.add(x.getAttribute('data-m'));
          if (port && port.classList) port.classList.add(x.getAttribute('data-m'));
        }
        ctr.querySelectorAll('button').forEach(function (y) { y.classList.toggle('on', y === x); });
        render();
        /* 09g: re-place the TODAY band for the 0.5s grid column transition. */
        var t0 = performance.now();
        (function tick() {
          try {
            var m = window.__playMount;
            if (m && typeof m.place === 'function') m.place();
            else window.dispatchEvent(new Event('resize'));
          } catch (err) {}
          if (performance.now() - t0 < 650) requestAnimationFrame(tick);
        })();
      });
    });
    /* Two views: Full week (the compact grid, where the page opens) and Focus today. Keep whichever is on across repaints. */
    if (ctr) {
      var want = ['lanes', 'blocks', 'sprint'].filter(function (m) { return document.body.classList.contains(m); })[0] || 'compact';
      var btn = ctr.querySelector('button[data-m="' + want + '"]');
      if (btn && !(document.body.classList.contains(want) && btn.classList.contains('on'))) btn.click();
    }
    var apply = $('vSave');
    if (apply) apply.addEventListener('click', function () {
      var tx = $('vTx');
      var raw = String((tx && tx.textContent) || '');
      var low = raw.toLowerCase();
      var n = 0;
      var doneM = /done(?:\s+with)?\s+([^.\n]+)/i.exec(raw);
      if (doneM) {
        var q = doneM[1].trim().toLowerCase();
        var hit = TD.filter(function (x) { return !x.done && String(x.t).toLowerCase().indexOf(q.slice(0, 12)) >= 0; })[0]
          || TD.filter(function (x) { return !x.done && q.indexOf(String(x.who || '').toLowerCase()) >= 0; })[0];
        if (hit) { hit.done = true; n += 1; }
      }
      var addM = /add:?\s+([^,\n]+)(?:,\s*(today|this week|next week))?/i.exec(raw);
      if (addM) {
        var buck = /next week/i.test(addM[2] || '') ? 'next' : /this week/i.test(addM[2] || '') ? 'week' : 'today';
        TD.unshift({ id: nid++, t: addM[1].trim(), src: 'Voice log', from: 'you said it just now', b: buck, w: 0 });
        n += 1;
      }
      render();
      if (typeof authFetch === 'function') {
        authFetch('/api/audit/snapshot', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: '{}' }).then(function (r) { return r && r.json(); }).then(function (d) {
          var c = (d && d.concerns) || [];
          note('Snapshot taken.' + (c.length ? (' ' + c.length + ' things to know: ' + c.slice(0, 3).join(' · ')) : ''));
        }).catch(function () { note('Snapshot taken.'); });
      } else note(n + ' applied');
    });
    /* Run sheet tick-offs: the same saves the grid and the to-do list make, with Undo. */
    function playDoneQuick(r, onUndo) {
      var M = window.__playMount || {};
      var ti = M.todayIdx == null ? 0 : M.todayIdx;
      var day = r.pads && r.pads[ti] && r.pads[ti].day;
      if (!r.d) return;
      r.d[ti] = 'done';
      if (typeof M.render === 'function') M.render();
      paintFocus();
      if (LIVE && r.id && day) apiCall('/api/playbook', 'POST', { rhythmId: r.id, day: day, status: 'done' }).then(function (x) { return x && x.ok ? x.json() : null; })
        .then(function (d) { if (d && d.rows && window.STATE) window.STATE.playbook = d; }).catch(function () { note('Could not save that play'); });
      undoToast(r.n + ' done', function () {
        r.d[ti] = 'due'; if (typeof M.render === 'function') M.render(); paintFocus();
        if (LIVE && r.id && day) apiCall('/api/playbook', 'POST', { rhythmId: r.id, day: day, status: 'open' });
        if (onUndo) onUndo();
      });
    }
    function todoDoneQuick(id) {
      var x = TD.filter(function (y) { return String(y.id) === String(id); })[0];
      if (!x) return;
      if (LIVE) { completeLive(x, null); return; }
      x.done = true; doneToday += 1; render();
    }
    if (window.PBWork && window.PBWork.bind) window.PBWork.bind(root, { event: openEvent, play: openPlay, todo: openTodo, toast: undoToast, playDone: playDoneQuick, todoDone: todoDoneQuick });
    window.tdRender = render;
    window.TDL = TD;
    render();
    if (LIVE) { loadPlan(render); setInterval(function () { if (todo.isConnected) loadPlan(render); }, 600000); }
    /* The board loads after the Playbook paints: redraw whenever the task list changes. */
    if (LIVE) {
      var sig = '';
      var tick = setInterval(function () {
        if (!todo.isConnected) { clearInterval(tick); return; }
        var its = (window.STATE || {}).items || [];
        var next = its.length + ':' + its.map(function (i) { return i.id + i.status + (i.due || '') + (i.title || ''); }).join('|').length;
        if (next === sig) return;
        sig = next;
        var m = $('tdm');
        if (m && m.classList.contains('open')) return;
        render();
      }, 1500);
    }
    try {
      var lhs = root.querySelectorAll ? root.querySelectorAll('.lh') : [];
      lhs.forEach(function (h) {
        var nx = h.nextElementSibling;
        if (!nx) return;
        h.classList.add('fold');
        h.dataset.st = 'Close';
        h.onclick = function () {
          nx.classList.toggle('folded');
          h.dataset.st = nx.classList.contains('folded') ? 'Open' : 'Close';
        };
      });
    } catch (eFold) {}
  };
})();
