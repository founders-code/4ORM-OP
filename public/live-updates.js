(function () {
  var cursor = '';
  var timer = null;
  var inflight = false;

  function auth(url, opts) {
    if (typeof window.authFetch === 'function') return window.authFetch(url, opts);
    return fetch(url, opts);
  }

  function desk() {
    return (window.STATE && window.STATE.desk) || '';
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

  function tick() {
    if (inflight || document.visibilityState !== 'visible') return;
    if (typeof window.authFetch !== 'function' && !window.STATE) return;
    inflight = true;
    var url = '/api/changes' + (cursor ? '?since=' + encodeURIComponent(cursor) : '');
    auth(url, { credentials: 'same-origin', quiet: true }).then(function (r) {
      return r.json();
    }).then(apply).catch(function () {}).then(function () {
      inflight = false;
    });
  }

  function loop() {
    if (timer) clearTimeout(timer);
    timer = null;
    if (document.visibilityState !== 'visible') return;
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
