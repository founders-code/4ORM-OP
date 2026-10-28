/* Playbook 09g to-do board, views, Say it, edit plays. Bound after the plays grid mounts. */
(function () {
  var SC = { Zoom: '#a173ff', 'Bruce asked': '#a173ff', Email: '#3b82ff', 'Voice log': '#ff5fa8', 'Outreach list': '#19d38a', Typed: '#ffb547' };
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
      return it && it.id && it.status !== 'done' && it.status !== 'dropped' && !it.plan_of;
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
    }).sort(function (a, c) { return (isFinite(a.due) ? a.due : 9e15) - (isFinite(c.due) ? c.due : 9e15); });
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
    function setStatusLive(x, status, msg) {
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
      var open = e.target.closest && e.target.closest('[data-open]');
      if (open) openTodo(open.getAttribute('data-open'));
    });
    todo.querySelectorAll('.tdc').forEach(function (c) {
      c.addEventListener('dragover', function (e) { e.preventDefault(); c.classList.add('drop'); });
      c.addEventListener('dragleave', function () { c.classList.remove('drop'); });
      c.addEventListener('drop', function (e) {
        e.preventDefault();
        c.classList.remove('drop');
        var id = e.dataTransfer.getData('text');
        var x = TD.filter(function (y) { return String(y.id) === String(id); })[0];
        if (x) { x.b = c.getAttribute('data-b'); render(); }
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
        document.body.classList.remove('focusday', 'compact');
        var port = modeHost();
        if (port && port.classList) port.classList.remove('focusday', 'compact');
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
      var want = document.body.classList.contains('focusday') ? 'focusday' : 'compact';
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
    window.tdRender = render;
    window.TDL = TD;
    render();
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
