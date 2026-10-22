(function () {
  var cursor = '';
  var timer = null;
  var inflight = false;
  var stopped = false;
  var retried401 = false;
  var clerkWait = '';

  function auth(url, opts) {
    if (typeof window.authFetch === 'function') return window.authFetch(url, opts);
    return fetch(url, opts);
  }

  function desk() {
    return (window.STATE && window.STATE.desk) || '';
  }

  function clerkObj() {
    return window.__clerk || window.Clerk || null;
  }

  function hasSession() {
    var clerk = clerkObj();
    if (clerk && clerk.session) return true;
    if (clerk && clerk.user) return true;
    return false;
  }

  function clerkReady() {
    if (!window.__clerkBoot) return true;
    if (clerkObj()) return true;
    return clerkWait === 'done';
  }

  function canPoll() {
    if (stopped) return false;
    if (typeof window.authFetch !== 'function') return false;
    if (!clerkReady()) return false;
    if (clerkObj() && !hasSession()) return false;
    if (!window.STATE && !hasSession()) return false;
    return true;
  }

  function showSignedOut() {
    if (document.getElementById('deskSignedOut')) return;
    var n = document.createElement('div');
    n.id = 'deskSignedOut';
    n.setAttribute('role', 'status');
    n.textContent = 'Signed out, sign in again';
    n.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:90;background:#142036;color:#fff;padding:10px 16px;border-radius:10px;font-size:13px;font-weight:600;box-shadow:0 10px 30px rgba(3,10,30,.28)';
    document.body.appendChild(n);
  }

  function stopSignedOut() {
    stopped = true;
    inflight = false;
    if (timer) { clearTimeout(timer); timer = null; }
    showSignedOut();
  }

  function filterMail(rows) {
    return (rows || []).filter(function (m) {
      var subject = String((m && m.subject) || '');
      var email = String((m && m.email) || '').toLowerCase();
      var who = String((m && m.from) || '').replace(/\s+/g, ' ').trim();
      if (/^(calendar-notification|calendar-server)@google\.com$/.test(email)) return false;
      if (/^chad r\.?\s*johnston$/i.test(who) && !(m && m.outbound)) return false;
      return !/^\s*(?:(?:re|fwd?|fw)\s*:\s*)*(?:invitation|updated invitation|accepted|declined|tentative|tentatively accepted|canceled|cancelled|canceled event|cancelled event)(?:\s+\(.*?\))?\s*:/i.test(subject);
    });
  }

  function paintRoom() {
    if (typeof renderOpsDash === 'function' && (!desk() || desk() === 'room')) renderOpsDash();
  }

  function apply(d) {
    if (!d || !window.STATE) return;
    if (d.cursor) cursor = String(d.cursor);
    var kinds = d.kinds || [];
    if (!kinds.length) return;
    if (d.mail) {
      window.STATE.mail = filterMail(d.mail);
      paintRoom();
      if (desk() === 'mail' && typeof window.paintRedesignEmail === 'function') window.paintRedesignEmail();
    }
    if (d.linkedin) {
      window.STATE.linkedin = d.linkedin;
      paintRoom();
      if (desk() === 'people' && typeof renderPeople === 'function') renderPeople(document.getElementById('pSearch') ? document.getElementById('pSearch').value : '');
    }
    if (d.calendar) {
      window.STATE.events = d.calendar;
      paintRoom();
      if (desk() === 'calendar' && typeof window.paintRedesignCalendar === 'function') window.paintRedesignCalendar();
    }
    if (d.pipeline) {
      window.STATE.ghlPipes = d.pipeline;
      paintRoom();
      if (typeof window.paintRedesignPipeline === 'function') window.paintRedesignPipeline();
      if (desk() === 'contacts' && typeof renderContacts === 'function') renderContacts(document.getElementById('cSearch') ? document.getElementById('cSearch').value : '');
    }
    if (d.zoom) {
      window.STATE.zoomNotes = d.zoom;
      if (typeof window.paintRedesignZoom === 'function') window.paintRedesignZoom();
    }
    if (d.people) {
      window.STATE.contacts = d.people;
      if (desk() === 'people' && typeof renderPeople === 'function') renderPeople(document.getElementById('pSearch') ? document.getElementById('pSearch').value : '');
      if (desk() === 'contacts' && typeof renderContacts === 'function') renderContacts(document.getElementById('cSearch') ? document.getElementById('cSearch').value : '');
    }
  }

  function refreshTokenOnce() {
    var clerk = clerkObj();
    if (!clerk || !clerk.session || typeof clerk.session.getToken !== 'function') return Promise.resolve(null);
    return clerk.session.getToken({ skipCache: true }).catch(function () { return null; });
  }

  function tick() {
    if (stopped || inflight || document.visibilityState !== 'visible') return;
    if (!canPoll()) return;
    inflight = true;
    var url = '/api/changes' + (cursor ? '?since=' + encodeURIComponent(cursor) : '');
    auth(url, { credentials: 'same-origin', quiet: true }).then(function (r) {
      if (!r) return null;
      if (r.status === 401) {
        if (!retried401) {
          retried401 = true;
          return refreshTokenOnce().then(function (token) {
            if (!token && !hasSession()) {
              stopSignedOut();
              return null;
            }
            return auth(url, { credentials: 'same-origin', quiet: true }).then(function (again) {
              if (!again || again.status === 401) {
                stopSignedOut();
                return null;
              }
              retried401 = false;
              return again.json();
            });
          });
        }
        stopSignedOut();
        return null;
      }
      retried401 = false;
      return r.json();
    }).then(apply).catch(function () {}).then(function () {
      inflight = false;
    });
  }

  function loop() {
    if (timer) clearTimeout(timer);
    timer = null;
    if (stopped || document.visibilityState !== 'visible') return;
    if (!canPoll()) {
      if (window.__clerkBoot && clerkWait !== 'done' && !clerkObj()) {
        clerkWait = 'pending';
        Promise.resolve(window.__clerkBoot).then(function () {
          clerkWait = 'done';
          if (!stopped) loop();
        }).catch(function () {
          clerkWait = 'done';
          if (!stopped) loop();
        });
      }
      return;
    }
    tick();
    timer = setTimeout(loop, 15000);
  }

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') loop();
    else if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  });

  if (document.readyState === 'complete') loop();
  else window.addEventListener('load', loop);
})();
