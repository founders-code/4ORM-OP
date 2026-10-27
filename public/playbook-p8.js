/* Playbook 09g to-do board, views, Say it, edit plays. Bound after the plays grid mounts. */
(function () {
  var SC = { Zoom: '#a173ff', 'Bruce asked': '#a173ff', Email: '#3b82ff', 'Voice log': '#ff5fa8', 'Outreach list': '#19d38a', Typed: '#ffb547' };
  var LINK = { Zoom: 'Open the Zoom notes', 'Bruce asked': 'Open the Zoom notes', Email: 'Open the email', 'Voice log': 'Play the voice note', 'Outreach list': "Open the Pre-seed list", Typed: '' };
  function seed() {
    return [
      { id: 1, t: 'Call Kevin about the investor list for Bruce', src: 'Bruce asked', from: 'Zoom with Bruce, 26 Oct', who: 'Kevin', n: 'Bruce wants the investor list split by who Kevin already knows.', b: 'today', w: 0 },
      { id: 2, t: "Send today's 5 pre-seed emails", src: 'Outreach list', from: 'Contacts · Pre-seed investors', b: 'today', w: 0 },
      { id: 3, t: 'Send Kevin the GTM deck', src: 'Voice log', from: 'you said "by Tuesday"', who: 'Kevin', b: 'today', w: 2 },
      { id: 4, t: 'Reply to Bruce Fair about the 2-pager', src: 'Email', from: 'you owe a reply, 9h', who: 'Bruce', b: 'today', w: 0 },
      { id: 5, t: 'Send Bruce the pilot outline', src: 'Voice log', from: 'Thu 16:40 note', who: 'Bruce', b: 'week', w: 4 },
      { id: 6, t: 'Set the OpenAI key in Vercel for Recordings', src: 'Typed', from: 'Integrations shows it missing', b: 'week', w: 0 },
      { id: 7, t: 'Book the Speer architecture review', src: 'Zoom', from: 'Speer sync, 22 Oct', who: 'Mathew', b: 'week', w: 0 },
      { id: 8, t: 'Newsletter: RPAA deadline angle', src: 'Voice log', from: 'idea from today', b: 'next', w: 0 }
    ];
  }
  window.bindPlaybookP8 = function (root) {
    if (!root || !root.querySelector) return;
    var todo = root.querySelector('#todo');
    if (!todo || todo._p8) return;
    todo._p8 = 1;
    var TD = seed();
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
    function render() {
      ['today', 'week', 'next'].forEach(function (b) {
        var r = TD.filter(function (x) { return x.b === b && !x.gone; });
        var cnt = $('cnt-' + b);
        if (cnt) cnt.textContent = r.filter(function (x) { return !x.done; }).length;
        var host = $('b-' + b);
        if (!host) return;
        var focus = document.body.classList.contains('focusday');
        host.innerHTML = r.map(function (x, k) {
          return '<div class="ti' + (x.done ? ' done' : '') + (k >= 4 && !focus ? ' more-hide' : '') + '" style="--sc:' + (SC[x.src] || '#5b8cff') + '" draggable="true" data-id="' + x.id + '"><span class="cb" data-ck="' + x.id + '">' + (x.done ? 'Y' : '') + '</span><div class="tt" data-open="' + x.id + '">' + x.t + (x.n ? '<span class="hasn">NOTES</span>' : '') + '</div>'
            + '<div class="meta"><span class="src">' + x.src + '</span><span>' + (x.from || '') + '</span>' + (x.who ? '<span>with ' + x.who + '</span>' : '') + (x.w ? '<span class="late">waiting ' + x.w + ' day' + (x.w > 1 ? 's' : '') + '</span>' : '') + '</div></div>';
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
        x.done = !x.done;
        doneToday += x.done ? 1 : -1;
        render();
        return;
      }
      var open = e.target.closest && e.target.closest('[data-open]');
      if (open) openTodo(+open.getAttribute('data-open'));
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
      TD.unshift({ id: nid++, t: v, src: 'Typed', from: 'just now', b: w === 'Today' ? 'today' : w === 'This week' ? 'week' : 'next', w: 0 });
      inp.value = '';
      render();
    });
    function openTodo(id) {
      var x = TD.filter(function (y) { return y.id === id; })[0];
      var box = $('tdbox'), m = $('tdm');
      if (!x || !box || !m) return;
      box.style.setProperty('--sc', SC[x.src] || '#5b8cff');
      box.innerHTML = '<div class="k">' + x.src + ' · ' + (x.b === 'today' ? 'Today' : x.b === 'week' ? 'This week' : 'Next week') + '</div><input class="tn" id="tdName" value="' + String(x.t).replace(/"/g, '&quot;') + '">'
        + '<div class="facts2"><div><small>From</small><span>' + (x.from || '') + '</span></div><div><small>With</small><span>' + (x.who || '-') + '</span></div><div><small>Waiting</small><span>' + (x.w ? x.w + ' days' : 'new') + '</span></div></div>'
        + '<textarea id="tdNotes" placeholder="Notes, links, what was said">' + (x.n || '') + '</textarea>'
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
          if (a === 'done') x.done = !x.done;
          else if (a === 'today' || a === 'week' || a === 'next') x.b = a;
          else if (a === 'planner' || a === 'del') { x.gone = 1; note(a === 'del' ? 'Removed. Undo from the toast.' : 'Moved to the Planner, Inbox, due in 7 days'); }
          m.classList.remove('open');
          render();
        });
      });
      m.onclick = function (e) { if (e.target === m) { m.classList.remove('open'); render(); } };
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
      });
    });
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
