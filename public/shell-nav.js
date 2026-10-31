(function () {
  var NAV = [
    ['Today'],
    ['News', '', '', 'news', '/news'],
    ['Playbook', '', '', 'playbook', '/playbook'],
    ['Planner', '', '', 'planner', '/planner'],
    ['Calendar', '', '', 'calendar', '/calendar'],
    ['Email', '', '', 'mail', '/email'],
    ['People'],
    ['Contacts', '', '', 'people', '/contacts'],
    ['Lists', '', '', 'people', '/lists'],
    ['Spaces', '', '', 'work', '/spaces'],
    ['Pipeline', '', '', 'contacts', '/pipeline'],
    ['Stage emails', '', '', 'stagemail', '/pipeline?builder=1'],
    ['Development', '', '', 'dev', '/development'],
    ['Library'],
    ['Links', '', '', 'links', '/links'],
    ['Notes', '', '', 'notes', '/notes'],
    ['Documents', '', '', 'docs', '/documents'],
    ['Recordings', '', '', 'rec', '/recordings'],
    ['Zoom', '', '', 'znotes', '/zoom'],
    ['Signals'],
    ['Completed', '', '', 'done', '/completed'],
    ['Financials', '', '', 'finance', '/financials'],
    ['Vault', '', '', 'vault', '/vault'],
    ['Integrations', '', '', 'int', '/integrations'],
    ['Control room', '', '', 'ops', '/control-room']
  ];
  var PAGE = {
    room: 'Planner', war: 'Planner', planner: 'Planner', contacts: 'Pipeline', work: 'Spaces', docs: 'Documents',
    links: 'Links', mail: 'Email', playbook: 'Playbook', calendar: 'Calendar', znotes: 'Zoom',
    notes: 'Notes', done: 'Completed', news: 'News', people: 'Contacts', rec: 'Recordings',
    finance: 'Financials', int: 'Integrations', vault: 'Vault', ops: 'Control room'
  };
  /* Desk alias kept for the Control room: 'war', '/planner' */
  var DEFAULT = NAV.filter(function (n) { return n.length > 1; }).map(function (n) { return n[0]; });
  var order = null;
  try { order = JSON.parse(localStorage.getItem('cr_nav_order') || 'null'); } catch (e) { order = null; }
  try { if (localStorage.getItem('cr_nav_hidden') === '1') document.body.classList.add('navshut'); } catch (e) {}

  function itemByName(name) {
    for (var i = 0; i < NAV.length; i++) if (NAV[i][0] === name && NAV[i].length > 1) return NAV[i];
    return null;
  }
  function groups() {
    var out = [];
    var cur = { title: 'Today', items: [] };
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
    names = names.map(function (n) {
      if (n === 'War Room' || n === 'Timeline') return 'Planner';
      if (n === 'Drive' || n === 'Record') return '';
      return n;
    }).filter(Boolean);
    if (names.indexOf('Lists') < 0 && names.indexOf('Contacts') >= 0) names.splice(names.indexOf('Contacts') + 1, 0, 'Lists');
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
    var S = typeof STATE !== 'undefined' ? STATE : {};
    var today = (S.items || []).filter(function (it) {
      if (it.status === 'done' || it.status === 'dropped') return false;
      var due = it.due || it.nextDate || '';
      return !due || String(due).slice(0, 10) <= new Date().toISOString().slice(0, 10);
    }).length;
    var mailNeed = (S.mail || []).filter(function (m) { return m && (m.unread || m.needsReply || m.needReply); }).length;
    var gone = S.zoomDismissed || {};
    var owed = (S.meetingActions || []).filter(function (a) { return a && !gone[String(a.id)] && a.status !== 'done' && a.status !== 'handled' && a.status !== 'tasked' && a.status !== 'dismissed'; }).length;
    var cold = (S.contacts || []).filter(function (c) {
      var last = c.lastTouch || c.last_touch || c.lastContact || '';
      if (!last) return false;
      var days = (Date.now() - new Date(last).getTime()) / 86400000;
      return days >= 14;
    }).length;
    var attn = (S.integrations || []).filter(function (g) { return /warn|error|off|attention|missing/i.test(String(g.state || g.word || '')); }).length;
    return {
      Pipeline: today ? String(today) : '',
      Email: mailNeed ? String(mailNeed) : '',
      Zoom: owed ? String(owed) : '',
      Contacts: cold ? String(cold) : '',
      Integrations: attn ? String(attn) : ''
    };
  }
  function activeName() {
    /* Development opens over the page it was called from; while it is open, it is the active page. */
    var dv = document.getElementById('devRoomHost'), dvx = dv && dv.shadowRoot && dv.shadowRoot.querySelector('.dvx.on');
    if (dvx || /^\/development\/?$/.test(location.pathname)) return 'Development';
    var v = (typeof STATE !== 'undefined' && STATE.desk) || 'room';
    if (v === 'people' && typeof STATE !== 'undefined' && STATE.peopleTab === 'lists') return 'Lists';
    return PAGE[v] || 'War Room';
  }
  function paint() {
    var side = document.getElementById('side');
    if (!side) return;
    if (!fixtureOn()) {
      try { order = JSON.parse(localStorage.getItem('cr_nav_order') || 'null'); } catch (e) { order = null; }
    }
    var active = activeName();
    var bag = badges();
    var html = '';
    if (fixtureOn()) {
      NAV.forEach(function (n) {
        if (n.length === 1) { html += '<div class="grp">' + n[0] + '</div>'; return; }
        var badge = bag[n[0]] || '';
        var chip = badge ? '<span class="n">' + badge + '</span>' : '';
        html += '<div class="nav' + (n[0] === active ? ' on' : '') + '" data-action="nav-go" data-v="' + n[3] + '" data-name="' + n[0] + '">' + n[0] + chip + '</div>';
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
    var drag = document.body.classList.contains('arranging') ? 'true' : 'false';
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
        html += '<div class="nav' + (it[0] === active ? ' on' : '') + '" data-action="nav-go" data-v="' + it[3] + '" data-path="' + it[4] + '" data-name="' + it[0] + '" draggable="' + drag + '" tabindex="0"><span class="grip" aria-hidden="true"></span><span class="nl">' + it[0] + (it[0] === 'Vault' && !window.__vaultOpen ? ' <span class="locked">locked</span>' : '') + '</span>' + (badge ? '<span class="n" id="' + (name === 'Pipeline' ? 'cCount' : name === 'Integrations' ? 'iCount' : '') + '">' + badge + '</span>' : '') + '</div>';
      });
    });
    names.forEach(function (name) {
      if (seen[name]) return;
      var it = itemByName(name);
      if (!it) return;
      html += '<div class="nav' + (it[0] === active ? ' on' : '') + '" data-action="nav-go" data-v="' + it[3] + '" data-path="' + it[4] + '" data-name="' + it[0] + '" draggable="' + drag + '" tabindex="0"><span class="grip" aria-hidden="true"></span><span class="nl">' + it[0] + '</span></div>';
    });
    /* 30 Oct 2026: a repaint with the same menu is skipped, so the menu does not flicker when a page loads. */
    var crumb = document.getElementById('pageCrumb');
    if (crumb && crumb.textContent !== active) crumb.textContent = active;
    var title = document.querySelector('title');
    if (title && title.textContent !== active + ' - 4orm Finance') title.textContent = active + ' - 4orm Finance';
    if (side.__ph === html && side.firstChild && side.firstChild === side.__phFirst) return;
    side.innerHTML = html;
    side.__ph = html; side.__phFirst = side.firstChild;
    bind();
  }
  function bind() {
    var side = document.getElementById('side');
    if (!side) return;
    /* Clicks are handled once by desk-actions.js 'nav-go' (switchView + URL).
       Only the Arrange drag lives here. */
    side.querySelectorAll('.nav').forEach(function (el) {
      el.addEventListener('dragstart', function (e) {
        if (!document.body.classList.contains('arranging')) { e.preventDefault(); return; }
        e.dataTransfer.setData('text/nav', el.getAttribute('data-name') || '');
        e.dataTransfer.effectAllowed = 'move';
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
        if (!document.body.classList.contains('arranging')) return;
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
      }
      var hidden = d && d.hidden;
      try { if (hidden == null) hidden = localStorage.getItem('cr_nav_hidden') === '1'; } catch (e) {}
      if (hidden) {
        document.body.classList.add('navshut');
        var tog = document.getElementById('navtog');
        if (tog) tog.textContent = 'Menu';
      }
      paint();
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
