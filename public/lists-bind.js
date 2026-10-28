/* Contacts > Lists — design 25-build tab 2, fed by /api/reach-out */
(function () {
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  }

  function vancouverTodayLabel() {
    try {
      var parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Vancouver',
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      }).formatToParts(new Date());
      var get = function (t) { return (parts.find(function (p) { return p.type === t; }) || {}).value || ''; };
      return get('weekday') + ' ' + get('day') + ' ' + get('month');
    } catch (e) {
      return '';
    }
  }

  function stCls(s) {
    s = String(s || '');
    if (/won|met|contacted|replied|meeting/i.test(s)) return 'met';
    if (/reach|send|1st/i.test(s)) return 'r1';
    return 'cold';
  }

  function readyBars(arr) {
    var a = Array.isArray(arr) ? arr : [];
    var n = 0;
    var html = '';
    for (var i = 0; i < 6; i++) {
      var on = !!a[i];
      if (on) n += 1;
      html += '<i class="' + (on ? 'f' : '') + '"></i>';
    }
    return { html: html, n: n };
  }

  window.bindOutreachLists = function (root) {
    if (!root) return;
    var state = {
      lists: [],
      cur: null,
      filt: 'todo',
      q: '',
      undo: null,
    };

    function $(sel) { return root.querySelector(sel); }
    function toast(m, undo) {
      var t = $('#tmsg');
      var u = $('#tundo');
      var box = $('#toast');
      if (t) t.textContent = m;
      if (u) {
        if (undo) {
          u.style.display = '';
          u.textContent = 'Undo';
          u.onclick = function () { undo(); };
        } else {
          u.style.display = 'none';
          u.onclick = null;
        }
      }
      if (box) {
        box.classList.add('show');
        setTimeout(function () { box.classList.remove('show'); }, 6000);
      }
    }
    function closeModal() { var m = $('#modal'); if (m) m.classList.remove('open'); }
    function modal(h) {
      var box = $('#mbox'); var wrap = $('#modal');
      if (box) box.innerHTML = h; if (wrap) wrap.classList.add('open');
    }

    function api(path, opts) {
      opts = opts || {};
      var init = { credentials: 'include', headers: {} };
      if (opts.method) init.method = opts.method;
      if (opts.body) {
        init.headers['content-type'] = 'application/json';
        init.body = JSON.stringify(opts.body);
      }
      return fetch(path, init).then(function (r) { return r.json().catch(function () { return null; }).then(function (d) { return { ok: r.ok, status: r.status, data: d }; }); });
    }

    function openSpace(person) {
      var id = person && (person.spaceId || person.space_id);
      if (id && typeof window.__openSpacePanel === 'function') {
        var el = document.createElement('div');
        el.setAttribute('data-id', id);
        el.setAttribute('data-space', id);
        window.__openSpacePanel(el, root);
        return;
      }
      if (person && person.name && typeof window.openDesk === 'function') {
        try { window.openDesk('work'); } catch (e) {}
      }
      toast(id ? 'Opening space' : 'No space linked yet for ' + (person && person.name || 'that row'));
    }

    function renderNav() {
      var nav = $('#listnav');
      if (!nav) return;
      nav.innerHTML = state.lists.map(function (l) {
        var on = state.cur && state.cur.key === l.key;
        var pct = l.count ? Math.round((l.done / l.count) * 100) : 0;
        return '<div class="lc' + (on ? ' on' : '') + '" data-l="' + esc(l.key) + '"><b>' + esc(l.name) + '</b><span>' + esc(l.sub || (l.count + ' people')) + '</span><div class="pb"><i style="width:' + pct + '%"></i></div></div>';
      }).join('');
      nav.querySelectorAll('.lc').forEach(function (el) {
        el.onclick = function () {
          state.cur = state.lists.find(function (l) { return l.key === el.getAttribute('data-l'); }) || state.lists[0];
          render();
        };
      });
    }

    function peopleOf() {
      if (!state.cur) return [];
      var rows = (state.cur.people || []).slice();
      if (state.filt === 'todo') rows = rows.filter(function (p) { return !p.done; });
      if (state.filt === 'done') rows = rows.filter(function (p) { return p.done; });
      if (state.q) {
        var q = state.q;
        rows = rows.filter(function (p) {
          return (p.name + ' ' + p.company + ' ' + p.email + ' ' + p.phone).toLowerCase().indexOf(q) >= 0;
        });
      }
      return rows;
    }

    function renderBody() {
      var body = $('#lbody');
      if (!body || !state.cur) return;
      var today = vancouverTodayLabel();
      var rows = peopleOf();
      var byDay = {};
      var order = [];
      rows.forEach(function (p) {
        var d = p.day || 'Later';
        if (!byDay[d]) { byDay[d] = []; order.push(d); }
        byDay[d].push(p);
      });
      var nextId = '';
      for (var i = 0; i < rows.length; i++) {
        if (!rows[i].done) { nextId = rows[i].id; break; }
      }
      var html = '';
      order.forEach(function (day) {
        var group = byDay[day] || [];
        var doneN = group.filter(function (p) { return p.done; }).length;
        var isToday = day === today;
        html += '<div class="dayrow">' + esc(day.toUpperCase())
          + (isToday ? '<em>TODAY · ' + doneN + ' OF ' + group.length + ' DONE</em>' : '')
          + '</div>';
        group.forEach(function (p) {
          var ready = readyBars(p.ready);
          var cls = 'row' + (p.done ? ' done' : '') + (p.id === nextId ? ' next' : '');
          html += '<div class="' + cls + '" data-id="' + esc(p.id) + '">'
            + '<div class="ck' + (p.done ? ' on' : '') + '" data-ck="' + esc(p.id) + '"></div>'
            + '<div><div class="nm">' + esc(p.name) + '</div><div class="org">' + esc(p.role || '') + '</div></div>'
            + '<div class="co2">' + esc(p.company) + (p.companySub ? '<small>' + esc(p.companySub) + '</small>' : '') + '</div>'
            + '<div><div class="ph">' + esc(p.phone || '-') + '</div><div class="em">' + esc(p.email || '-') + '</div></div>'
            + '<div><span class="stg ' + stCls(p.stage) + '">' + esc(String(p.stage || 'COLD').toUpperCase()) + '</span>'
            + '<div class="lt">last · ' + esc(p.lastTouch || 'Never') + '</div></div>'
            + '<div><div class="ready">' + ready.html + '</div><div class="rlab">' + ready.n + ' of 6 built</div></div>'
            + '<div class="nx">' + esc(p.nextStep || '') + '</div>'
            + '<div class="arr">&rsaquo;</div>'
            + '</div>';
        });
      });
      if (!rows.length) html = '<div class="empty" style="padding:18px;color:#6f7fa6">Nobody on this list yet.</div>';
      body.innerHTML = html;
      body.querySelectorAll('.row').forEach(function (el) {
        el.onclick = function (ev) {
          if (ev.target && ev.target.getAttribute && ev.target.getAttribute('data-ck') != null) return;
          if (ev.target && ev.target.closest && ev.target.closest('[data-ck]')) return;
          var p = (state.cur.people || []).find(function (x) { return x.id === el.getAttribute('data-id'); });
          if (p) openSpace(p);
        };
      });
      body.querySelectorAll('[data-ck]').forEach(function (el) {
        el.onclick = function (ev) {
          ev.stopPropagation();
          var id = el.getAttribute('data-ck');
          var p = (state.cur.people || []).find(function (x) { return x.id === id; });
          if (!p) return;
          var prev = !!p.done;
          p.done = !prev;
          state.cur.done = (state.cur.people || []).filter(function (x) { return x.done; }).length;
          render();
          api('/api/reach-out/' + encodeURIComponent(id), { method: 'PATCH', body: { done: p.done } }).then(function (r) {
            if (!r.ok) {
              p.done = prev;
              state.cur.done = (state.cur.people || []).filter(function (x) { return x.done; }).length;
              render();
              toast('Could not save that tick');
              return;
            }
            toast(p.done ? 'Marked done · stage written when GoHighLevel has the opportunity' : 'Moved back to to-do');
          }).catch(function () {
            p.done = prev;
            render();
            toast('Could not save that tick');
          });
        };
      });
    }

    function render() {
      if (!state.cur && state.lists.length) state.cur = state.lists[0];
      renderNav();
      var name = $('#lname');
      var stat = $('#lstat');
      if (name && state.cur) name.textContent = state.cur.name;
      if (stat && state.cur) stat.textContent = state.cur.done + ' of ' + state.cur.count + ' done';
      root.querySelectorAll('#lfilt span').forEach(function (s) {
        s.classList.toggle('on', s.getAttribute('data-f') === state.filt);
      });
      renderBody();
    }

    function load() {
      return api('/api/reach-out?lists=1').then(function (r) {
        var lists = (r.data && r.data.lists) || [];
        state.lists = lists;
        if (!state.cur || !lists.find(function (l) { return l.key === state.cur.key; })) state.cur = lists[0] || null;
        if (window.STATE) window.STATE.peopleLists = lists;
        render();
        return lists;
      }).catch(function () {
        state.lists = [];
        render();
        return [];
      });
    }

    root.querySelectorAll('#lfilt span').forEach(function (s) {
      s.onclick = function () { state.filt = s.getAttribute('data-f') || 'todo'; render(); };
    });
    var search = $('#lsearch');
    if (search) search.oninput = function (e) { state.q = String(e.target.value || '').toLowerCase(); render(); };
    var todayBtn = $('#todayBtn');
    if (todayBtn) todayBtn.onclick = function () {
      var rows = (state.cur && state.cur.people || []).filter(function (p) { return !p.done; });
      if (!rows.length) { toast('Nothing left to do in this list'); return; }
      openSpace(rows[0]);
    };
    var newList = $('#newList');
    if (newList) newList.onclick = function () {
      modal('<h3>New list</h3><p>A list is a table of contacts with the columns you choose.</p>'
        + '<input id="nlname" placeholder="Name, for example Regulators this month">'
        + '<div class="row" style="margin-top:12px;display:flex;gap:8px;justify-content:flex-end">'
        + '<button type="button" class="btn" id="nlcancel">Cancel</button>'
        + '<button type="button" class="btn pri" id="nlcreate">Create list</button></div>');
      var c = $('#nlcancel'); var g = $('#nlcreate');
      if (c) c.onclick = closeModal;
      if (g) g.onclick = function () {
        var nm = ($('#nlname') && $('#nlname').value) || '';
        closeModal();
        api('/api/reach-out', { method: 'POST', body: { action: 'create-list', name: nm } }).then(function (r) {
          if (!r.ok) { toast('Could not create that list'); return; }
          var id = r.data && r.data.id;
          toast('List created', id ? function () {
            api('/api/reach-out', { method: 'POST', body: { action: 'delete-list', id: id } }).then(load);
          } : null);
          load();
        });
      };
    };

    // Soft-delete a custom list: long-press is overkill; expose via double-click on custom nav items after load.
    root.addEventListener('contextmenu', function (ev) {
      var lc = ev.target && ev.target.closest && ev.target.closest('#listnav .lc');
      if (!lc) return;
      var key = lc.getAttribute('data-l') || '';
      if (key.indexOf('custom:') !== 0) return;
      ev.preventDefault();
      var id = key.slice('custom:'.length);
      var prev = state.lists.slice();
      api('/api/reach-out', { method: 'POST', body: { action: 'delete-list', id: id } }).then(function (r) {
        if (!r.ok) { toast('Could not delete that list'); return; }
        toast('List removed', function () {
          api('/api/reach-out', { method: 'POST', body: { action: 'restore-list', id: id } }).then(load);
        });
        load();
      });
      state.lists = prev;
    });

    load();
  };
})();
