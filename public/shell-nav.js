(function () {
  var NAV = [
    ['Workspace'],
    ['Dashboard', 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z', '', 'room', '/control-room'],
    ['War Room', 'M12 2l3 6 6 .9-4.5 4.3 1 6.3L12 16.6 6.5 19.5l1-6.3L3 8.9 9 8z', '', 'war', '/war-room'],
    ['Pipeline', 'M3 5h18l-7 8v6l-4 2v-8z', '', 'contacts', '/pipeline'],
    ['Spaces', 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z', '', 'work', '/spaces'],
    ['Documents', 'M7 3h7l5 5v13H7zM14 3v5h5', '', 'docs', '/documents'],
    ['Links', 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1', '', 'links', '/links'],
    ['Email', 'M3 6h18v12H3zM3 7l9 6 9-6', '', 'mail', '/email'],
    ['Playbook', 'M5 4h14v16H5zM9 8h6M9 12h6M9 16h3', '', 'playbook', '/playbook'],
    ['Calendar', 'M4 6h16v14H4zM4 10h16M9 3v4M15 3v4', '', 'calendar', '/calendar'],
    ['Zoom', 'M3 7h12v10H3zM15 10l6-3v10l-6-3', '', 'znotes', '/zoom'],
    ['Notes', 'M5 3h14v18l-4-3H5z', '', 'notes', '/notes'],
    ['Completed', 'M4 12l5 5L20 6', '', 'done', '/completed'],
    ['Signals & data'],
    ['News', 'M4 5h13v14H6a2 2 0 0 1-2-2zM17 9h3v8a2 2 0 0 1-2 2M8 9h5M8 13h5', '', 'news', '/news'],
    ['Drive', 'M8 3h8l6 10-4 7H6l-4-7z', '', 'drive', '/control-room?view=drive'],
    ['Contacts', 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0', '', 'people', '/control-room?view=people'],
    ['Financials', 'M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6', '', 'finance', '/control-room?view=finance'],
    ['Integrations', 'M9 7V3M15 7V3M6 7h12v5a6 6 0 0 1-12 0zM12 18v3', '', 'int', '/control-room?view=int']
  ];
  var PAGE = {
    room: 'Dashboard', war: 'War Room', contacts: 'Pipeline', work: 'Spaces', docs: 'Documents',
    links: 'Links', mail: 'Email', playbook: 'Playbook', calendar: 'Calendar', znotes: 'Zoom',
    notes: 'Notes', done: 'Completed', news: 'News', drive: 'Drive', people: 'Contacts',
    finance: 'Financials', int: 'Integrations'
  };
  var DEFAULT = NAV.filter(function (n) { return n.length > 1; }).map(function (n) { return n[0]; });
  var order = null;
  try { order = JSON.parse(localStorage.getItem('cr_nav_order') || 'null'); } catch (e) { order = null; }

  function itemByName(name) {
    for (var i = 0; i < NAV.length; i++) if (NAV[i][0] === name && NAV[i].length > 1) return NAV[i];
    return null;
  }
  function groups() {
    var out = [];
    var cur = { title: 'Workspace', items: [] };
    NAV.forEach(function (n) {
      if (n.length === 1) {
        if (cur.items.length || out.length) out.push(cur);
        cur = { title: n[0], items: [] };
      } else cur.items.push(n[0]);
    });
    out.push(cur);
    return out;
  }
  function applied() {
    var names = Array.isArray(order) ? order.slice() : DEFAULT.slice();
    DEFAULT.forEach(function (n) { if (names.indexOf(n) < 0) names.push(n); });
    return names.filter(function (n) { return !!itemByName(n); });
  }
  function saveOrder(next) {
    order = next;
    try { localStorage.setItem('cr_nav_order', JSON.stringify(next)); } catch (e) {}
    if (typeof authFetch === 'function') {
      authFetch('/api/nav-prefs', { method: 'PUT', credentials: 'same-origin', quiet: true, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ order: next }) }).catch(function () {});
    }
    paint();
  }
  function fixtureOn() {
    return !!window.fixtureMockup;
  }
  function badges() {
    if (fixtureOn() && window.REDESIGN_FIXTURE && window.REDESIGN_FIXTURE.navBadges) {
      return window.REDESIGN_FIXTURE.navBadges;
    }
    var pipe = (typeof STATE !== 'undefined' && STATE.contacts) ? STATE.contacts.length : 0;
    var plugs = 0;
    if (typeof STATE !== 'undefined' && Array.isArray(STATE.plugins)) {
      plugs = STATE.plugins.filter(function (p) { return p.connected || p.on; }).length;
    }
    if (!plugs && typeof STATE !== 'undefined' && Array.isArray(STATE.integrations)) {
      plugs = STATE.integrations.filter(function (g) { return /on|ok|connected|live/i.test(String(g.state || g.word || '')); }).length;
    }
    return { Pipeline: pipe ? String(pipe) : '', Integrations: plugs ? String(plugs) : '' };
  }
  function activeName() {
    var v = (typeof STATE !== 'undefined' && STATE.desk) || 'room';
    return PAGE[v] || 'Dashboard';
  }
  function paint() {
    var side = document.getElementById('side');
    if (!side) return;
    var active = activeName();
    var bag = badges();
    var html = '';
    if (fixtureOn()) {
      NAV.forEach(function (n) {
        if (n.length === 1) { html += '<div class="grp">' + n[0] + '</div>'; return; }
        var badge = bag[n[0]] || '';
        html += '<div class="nav' + (n[0] === active ? ' on' : '') + '" data-action="nav-go" data-v="' + n[3] + '" data-name="' + n[0] + '">' + n[0] + (badge ? '<span class="n">' + badge + '</span>' : '') + '</div>';
      });
      side.innerHTML = html;
      var crumbF = document.getElementById('pageCrumb');
      if (crumbF) crumbF.textContent = active;
      var titleF = document.querySelector('title');
      if (titleF) titleF.textContent = active + ' - 4orm Finance';
      bind();
      return;
    }
    var seen = {};
    var grouped = groups();
    var names = applied();
    grouped.forEach(function (g) {
      html += '<div class="grp" data-grp="' + g.title + '">' + g.title + '</div>';
      names.forEach(function (name) {
        var it = itemByName(name);
        if (!it || seen[name]) return;
        var inGroup = g.items.indexOf(name) >= 0;
        if (!inGroup) return;
        seen[name] = 1;
        var badge = bag[name];
        if (badge === '' || badge == null) badge = it[2] || '';
        html += '<div class="nav' + (it[0] === active ? ' on' : '') + '" data-action="nav-go" data-v="' + it[3] + '" data-name="' + it[0] + '" draggable="false"><span class="grip" aria-hidden="true"></span><span class="nl">' + it[0] + '</span>' + (badge ? '<span class="n" id="' + (name === 'Pipeline' ? 'cCount' : name === 'Integrations' ? 'iCount' : '') + '">' + badge + '</span>' : '') + '</div>';
      });
    });
    names.forEach(function (name) {
      if (seen[name]) return;
      var it = itemByName(name);
      if (!it) return;
      html += '<div class="nav' + (it[0] === active ? ' on' : '') + '" data-action="nav-go" data-v="' + it[3] + '" data-name="' + it[0] + '"><span class="grip" aria-hidden="true"></span><span class="nl">' + it[0] + '</span></div>';
    });
    var arranging = document.body.classList.contains('arranging');
    html += '<div class="arr-row"><button type="button" class="arr" id="navArrange" data-action="nav-arrange">' + (arranging ? 'Done' : 'Arrange') + '</button><button type="button" class="arr-reset" id="navReset" data-action="nav-reset">Reset to default</button></div>';
    side.innerHTML = html;
    var crumb = document.getElementById('pageCrumb');
    if (crumb) crumb.textContent = active;
    var title = document.querySelector('title');
    if (title) title.textContent = active + ' - 4orm Finance';
    bind();
  }
  function bind() {
    var side = document.getElementById('side');
    if (!side) return;
    side.querySelectorAll('.nav').forEach(function (el) {
      el.onclick = function (e) {
        if (document.body.classList.contains('arranging')) return;
        var v = el.getAttribute('data-v');
        if (v && typeof switchView === 'function') switchView(v);
        var it = itemByName(el.getAttribute('data-name'));
        if (it && it[4] && history && history.replaceState) {
          try { history.replaceState({}, '', it[4]); } catch (err) {}
        }
      };
      el.addEventListener('dragstart', function (e) {
        if (!document.body.classList.contains('arranging')) { e.preventDefault(); return; }
        e.dataTransfer.setData('text/nav', el.getAttribute('data-name') || '');
        el.classList.add('dragging');
      });
      el.addEventListener('dragend', function () { el.classList.remove('dragging'); });
      el.addEventListener('dragover', function (e) {
        if (!document.body.classList.contains('arranging')) return;
        e.preventDefault();
        el.classList.add('insert');
      });
      el.addEventListener('dragleave', function () { el.classList.remove('insert'); });
      el.addEventListener('drop', function (e) {
        e.preventDefault();
        el.classList.remove('insert');
        var from = e.dataTransfer.getData('text/nav');
        var to = el.getAttribute('data-name');
        if (!from || !to || from === to) return;
        var names = applied();
        var ix = names.indexOf(from);
        var at = names.indexOf(to);
        if (ix < 0 || at < 0) return;
        names.splice(ix, 1);
        names.splice(at, 0, from);
        saveOrder(names);
      });
    });
    var arr = document.getElementById('navArrange');
    if (arr) arr.onclick = null;
    var reset = document.getElementById('navReset');
    if (reset) reset.onclick = null;
  }
  function clock() {
    var el = document.getElementById('clock');
    if (!el) return;
    var parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Vancouver', weekday: 'short', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(new Date());
    function g(t) { for (var i = 0; i < parts.length; i++) if (parts[i].type === t) return parts[i].value; return ''; }
    el.textContent = g('weekday') + ', ' + g('month') + ' ' + g('day') + ' · ' + g('hour') + ':' + g('minute') + ' Pacific';
  }
  window.paintShellNav = paint;
  window.shellPageName = activeName;
  if (typeof authFetch === 'function' && !fixtureOn()) {
    authFetch('/api/nav-prefs', { credentials: 'same-origin', quiet: true }).then(function (r) { return r.json(); }).then(function (d) {
      if (d && Array.isArray(d.order) && d.order.length) {
        order = d.order;
        try { localStorage.setItem('cr_nav_order', JSON.stringify(order)); } catch (e) {}
        paint();
      }
    }).catch(function () {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { paint(); clock(); });
  else { paint(); clock(); }
  setInterval(clock, 15000);
  document.addEventListener('keydown', function (e) {
    if (!document.body.classList.contains('arranging')) return;
    if (!(e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown'))) return;
    var focus = document.activeElement && document.activeElement.closest && document.activeElement.closest('.nav');
    if (!focus) return;
    var names = applied();
    var name = focus.getAttribute('data-name');
    var ix = names.indexOf(name);
    if (ix < 0) return;
    var at = e.key === 'ArrowUp' ? Math.max(0, ix - 1) : Math.min(names.length - 1, ix + 1);
    names.splice(ix, 1);
    names.splice(at, 0, name);
    saveOrder(names);
    e.preventDefault();
  });
})();
