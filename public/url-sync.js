/* 30 Oct 2026: the address bar follows the page you are on, so a reload or a shared link lands on the same page
   (before, it kept the first page's address: /lists while on Completed, /zoom while on Calendar). */
(function () {
  var PATH = { war: '/war-room', news: '/news', playbook: '/playbook', planner: '/planner', calendar: '/calendar', mail: '/email', work: '/spaces',
    contacts: '/pipeline', links: '/links', notes: '/notes', docs: '/documents', rec: '/recordings', znotes: '/zoom', done: '/completed',
    finance: '/financials', vault: '/vault', int: '/integrations', ops: '/ops' };
  function wrap() {
    var orig = window.switchView;
    if (typeof orig !== 'function' || orig.__urlSync) return !!orig;
    var w = function (v) {
      var out = orig.apply(this, arguments);
      try {
        var p = v === 'people' ? ((window.STATE && window.STATE.peopleTab === 'lists') ? '/lists' : '/contacts') : PATH[v];
        if (p && location.pathname !== p) history.replaceState(history.state, '', p + (location.hash || ''));
      } catch (e) {}
      return out;
    };
    w.__urlSync = true;
    window.switchView = w;
    return true;
  }
  if (!wrap()) { var n = 0, t = setInterval(function () { n += 1; if (wrap() || n > 100) clearInterval(t); }, 50); }
})();
