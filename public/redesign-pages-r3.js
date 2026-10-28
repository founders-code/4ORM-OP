/* Round 3 features on the redesign pages. Loaded once by desk-actions.js; adds handlers to window.deskActions.
   B34 scheduled send (compose Schedule menu + Scheduled list), B56 box tags to GoHighLevel and Contacts,
   P13 longer beats with cadence, C22 Google calendar select, "Add to investor update" + draft view,
   Granola / Riverside sync on Zoom refresh, Perplexity Research in News and on a Space angle.
   No icons, no emoji. Times are 24-hour, America/Vancouver. Every field saves. Removes are soft with Undo. */
(function () {
  if (window.__r3Loaded) return;
  window.__r3Loaded = true;
  var TZ = 'America/Vancouver';

  function S() { return window.STATE || (window.STATE = {}); }
  function fixtureOn() {
    try { return /(?:^|[?&])fixture=mockup(?:&|$)/.test(String(location.search || '')); } catch (e) { return false; }
  }
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function attr(el, n) { return el && el.getAttribute ? (el.getAttribute(n) || '') : ''; }
  /* JSON call. Resolves with the body; rejects with Error(message) carrying .status and .body. */
  function call(url, opts) {
    opts = opts || {};
    var o = { method: opts.method || 'GET', credentials: 'same-origin', headers: {} };
    if (opts.body != null) { o.headers['content-type'] = 'application/json'; o.body = JSON.stringify(opts.body); }
    var fn = typeof window.authFetch === 'function' ? window.authFetch : fetch;
    return fn(url, o).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) {
          var err = new Error((d && d.error) || ('HTTP ' + r.status));
          err.status = r.status;
          err.body = d;
          throw err;
        }
        return d;
      });
    });
  }
  function msgOf(err, fallback) { return err && err.message && !/^HTTP /.test(err.message) ? err.message : fallback; }
  function toast(root, text, undo) {
    var M = window.__deskMail;
    if (M && typeof M.toast === 'function') { M.toast(root, text, undo); return; }
    try { console.info('[r3]', text); } catch (e) {}
  }
  function vanToday() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  }
  function vanNowHm() {
    return new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());
  }
  function addDays(ymd, n) {
    var p = ymd.split('-').map(Number);
    return new Date(Date.UTC(p[0], p[1] - 1, p[2] + n)).toISOString().slice(0, 10);
  }
  function dayLabel(ymd) {
    var p = String(ymd || '').split('-').map(Number);
    if (p.length < 3 || !p[0]) return '';
    return new Date(Date.UTC(p[0], p[1] - 1, p[2], 12)).toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
  }
  function hostRoot(id) {
    var h = document.getElementById(id);
    return h && h.shadowRoot ? h.shadowRoot : null;
  }

  /* ---------- shared look (injected once per root) ---------- */
  var CSS = ''
    + '.r3-pop{position:fixed;z-index:140;background:#fff;color:#101a33;border-radius:14px;box-shadow:0 18px 50px rgba(3,10,30,.35);padding:12px;min-width:280px;max-width:380px;font:13px/1.4 Inter,-apple-system,"Segoe UI",system-ui,sans-serif}'
    + '.r3-pop h5{margin:0 0 8px;font-size:12px;font-weight:800;color:#4a5672;letter-spacing:.04em;text-transform:uppercase}'
    + '.r3-pop .opt{display:flex;justify-content:space-between;gap:10px;padding:8px 10px;border-radius:9px;cursor:pointer;font-weight:650}'
    + '.r3-pop .opt:hover{background:#eaf1fe}.r3-pop .opt span{color:#7a86a0;font-weight:600}'
    + '.r3-pop .row{display:flex;gap:8px;align-items:center;margin-top:8px}.r3-pop label{font-size:12px;color:#4a5672;font-weight:700;min-width:70px}'
    + '.r3-pop input,.r3-pop select,.r3-pop textarea,.r3-dr input,.r3-dr select,.r3-dr textarea{font:inherit;font-size:13px;border:1px solid #e8ecf3;border-radius:8px;padding:6px 8px;color:#101a33;background:#fff;min-width:0}'
    + '.r3-pop .hint{font-size:11.5px;color:#7a86a0;margin-top:6px}.r3-pop .err{font-size:12px;color:#e0364f;margin-top:6px;font-weight:650}'
    + '.r3-btn{height:32px;border-radius:9px;border:1px solid #e8ecf3;background:#fff;color:#101a33;font-size:12.5px;font-weight:750;padding:0 12px;cursor:pointer;white-space:nowrap}'
    + '.r3-btn.pri{background:#2e6bf2;border-color:#2e6bf2;color:#fff}.r3-btn.red{color:#e0364f}.r3-btn[disabled]{opacity:.5;cursor:default}'
    + '.r3-scrim{position:fixed;inset:0;background:rgba(3,10,30,.35);z-index:130}'
    + '.r3-dr{position:fixed;top:0;right:0;bottom:0;width:min(560px,96vw);z-index:135;background:#fff;color:#101a33;box-shadow:-20px 0 60px rgba(3,10,30,.35);display:flex;flex-direction:column;font:13px/1.45 Inter,-apple-system,"Segoe UI",system-ui,sans-serif}'
    + '.r3-dr .dh{display:flex;align-items:center;gap:10px;padding:16px 18px;border-bottom:1px solid #e8ecf3}.r3-dr .dh h3{margin:0;font-size:16px;font-weight:850;flex:1;min-width:0}'
    + '.r3-dr .dh .x{cursor:pointer;font-size:13px;font-weight:750;color:#4a5672}'
    + '.r3-dr .db{flex:1;overflow:auto;padding:14px 18px}.r3-dr .df{display:flex;gap:8px;padding:12px 18px;border-top:1px solid #e8ecf3;flex-wrap:wrap}'
    + '.r3-dr .it{border:1px solid #e8ecf3;border-radius:12px;padding:10px 12px;margin-bottom:10px}'
    + '.r3-dr .it .top{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.r3-dr .it b{font-size:13.5px}'
    + '.r3-dr .st{font-size:11px;font-weight:800;border-radius:999px;padding:2px 8px;background:#f5f7fb;color:#4a5672}'
    + '.r3-dr .st.queued{background:#eaf1fe;color:#2e6bf2}.r3-dr .st.sent{background:#e4f6ee;color:#12a36a}.r3-dr .st.failed{background:#fde9ec;color:#e0364f}.r3-dr .st.sending{background:#fff4e0;color:#c98408}'
    + '.r3-dr .meta{font-size:12px;color:#7a86a0;margin-top:3px}.r3-dr .pv{font-size:12.5px;color:#4a5672;margin-top:6px;white-space:pre-wrap;max-height:4.4em;overflow:hidden}'
    + '.r3-dr .acts{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap}.r3-dr .warn{background:#fff4e0;color:#8a5a00;border-radius:10px;padding:8px 10px;font-size:12.5px;margin-bottom:10px;font-weight:600}'
    + '.r3-dr .sec{font-size:11.5px;font-weight:850;letter-spacing:.06em;text-transform:uppercase;color:#7a86a0;margin:14px 0 6px}'
    + '.r3-dr .full{width:100%;display:block;margin-top:6px}.r3-dr textarea.full{min-height:70px;resize:vertical}'
    + '.r3-dr .ans{white-space:pre-wrap;font-size:13.5px;line-height:1.55}.r3-dr .src a{color:#2e6bf2;font-weight:650;text-decoration:none}.r3-dr .src div{margin:4px 0;font-size:12.5px}'
    + '.r3-dr .empty{color:#7a86a0;padding:20px 0}';
  function ensureCss(root) {
    if (!root || !root.appendChild) return;
    var host = root.getElementById ? root : document;
    if (host.getElementById && host.getElementById('r3css')) return;
    var st = document.createElement('style');
    st.id = 'r3css';
    st.textContent = CSS;
    (root.nodeType === 11 ? root : document.head).appendChild(st);
  }
  function rootGet(root, id) { return root && root.getElementById ? root.getElementById(id) : document.getElementById(id); }
  function closePop(root) { var p = rootGet(root, 'r3Pop'); if (p) p.remove(); }
  function openPop(root, anchor, html) {
    ensureCss(root);
    closePop(root);
    var box = document.createElement('div');
    box.id = 'r3Pop';
    box.className = 'r3-pop';
    box.innerHTML = html;
    (root.nodeType === 11 ? root : document.body).appendChild(box);
    var r = anchor && anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : { left: 80, top: 80, bottom: 100 };
    var w = box.offsetWidth || 320, h = box.offsetHeight || 200;
    var left = Math.min(Math.max(8, r.left), window.innerWidth - w - 8);
    var top = r.bottom + 6;
    if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 6);
    box.style.left = left + 'px';
    box.style.top = top + 'px';
    return box;
  }
  /* The Email header switch: Scheduled stays lit while its panel is open, then the switch returns to the view you were on. */
  function markSched(root, on) {
    try {
      var seg = root.querySelector && root.querySelector('.bar .seg');
      if (!seg) return;
      seg.querySelectorAll('span').forEach(function (sp) {
        var isSched = sp.getAttribute('data-action') === 'mail-sched-list';
        if (on) sp.classList.toggle('on', isSched);
        else sp.classList.toggle('on', !isSched && sp.getAttribute('data-view') === (S().mailView || 'inbox'));
      });
    } catch (e) {}
  }
  function closeDrawer(root) {
    var had = !!rootGet(root, 'r3Dr');
    ['r3Dr', 'r3Scrim'].forEach(function (id) { var n = rootGet(root, id); if (n) n.remove(); });
    if (had && S().mailSchedOpen) { S().mailSchedOpen = false; markSched(root, false); }
  }
  function openDrawer(root, title, bodyHtml, footHtml) {
    ensureCss(root);
    closeDrawer(root);
    var scrim = document.createElement('div');
    scrim.id = 'r3Scrim';
    scrim.className = 'r3-scrim';
    scrim.setAttribute('data-action', 'r3-close');
    var dr = document.createElement('aside');
    dr.id = 'r3Dr';
    dr.className = 'r3-dr';
    dr.innerHTML = '<div class="dh"><h3>' + esc(title) + '</h3><span class="x" data-action="r3-close" role="button">Close &times;</span></div><div class="db" id="r3Db">' + bodyHtml + '</div>' + (footHtml ? '<div class="df" id="r3Df">' + footHtml + '</div>' : '');
    var host = root.nodeType === 11 ? root : document.body;
    host.appendChild(scrim);
    host.appendChild(dr);
    return dr;
  }
  document.addEventListener('mousedown', function (e) {
    var path = e.composedPath ? e.composedPath() : [];
    for (var i = 0; i < path.length; i++) {
      var n = path[i];
      if (n && n.id === 'r3Pop') return;
      if (n && n.getAttribute && /^(mail-schedule|r3-beat|r3-beat-new|play-beat)$/.test(n.getAttribute('data-action') || '')) return;
    }
    var roots = [document].concat(['mailDesk', 'playDesk', 'calDesk'].map(hostRoot).filter(Boolean));
    path.forEach(function (n) { if (n && n.nodeType === 11 && roots.indexOf(n) < 0) roots.push(n); });
    roots.forEach(function (r) { closePop(r); });
  }, true);
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var path = e.composedPath ? e.composedPath() : [];
    var root = null;
    for (var i = 0; i < path.length; i++) if (path[i] && path[i].nodeType === 11) { root = path[i]; break; }
    root = root || document;
    if (rootGet(root, 'r3Pop')) { closePop(root); e.stopPropagation(); return; }
    if (rootGet(root, 'r3Dr')) { closeDrawer(root); e.stopPropagation(); }
  }, true);

  /* ======================= B34: scheduled send ======================= */
  function M() { return window.__deskMail || {}; }
  function presetList() {
    var today = vanToday();
    var now = vanNowHm();
    var dow = new Date(today + 'T12:00:00Z').getUTCDay();
    var toMon = dow === 1 ? 7 : (8 - dow) % 7 || 7;
    var out = [];
    if (now < '15:30') out.push(['Later today', today, '16:00']);
    out.push(['Tomorrow morning', addDays(today, 1), '08:00']);
    out.push(['Tomorrow afternoon', addDays(today, 1), '13:00']);
    out.push(['Monday morning', addDays(today, toMon), '08:00']);
    return out;
  }
  function composeReady(root) {
    var m = M();
    if (!m.state || !m.sync) return null;
    var bad = m.sync(root);
    var d = m.state();
    if (bad && bad.length) { toast(root, 'Not a valid email address: ' + bad.join(', ')); return null; }
    if (!d.to || !d.to.length) { toast(root, 'Add a valid recipient'); return null; }
    if (!String(d.subject || '').trim() && !String(d.body || '').trim()) { toast(root, 'Write a subject or a message first'); return null; }
    return d;
  }
  function schedulePayload(d, date, time) {
    var m = M();
    var reply = !!(d.reply && d.threadId);
    return {
      to: d.to.map(function (r) { return r.email; }),
      cc: (d.cc || []).map(function (r) { return r.email; }),
      bcc: (d.bcc || []).map(function (r) { return r.email; }),
      subject: d.subject || '',
      text: String(d.body || '') + (m.bundle ? m.bundle(d.attachments || []) : ''),
      attachments: (d.attachments || []).map(function (a) { return { name: a.name || 'File', url: a.url || '', driveFileId: a.driveFileId || a.drive_file_id || '' }; }),
      threadId: reply ? d.threadId : '',
      messageId: reply ? (d.messageId || '') : '',
      reply: reply,
      nudge: !!d.nudge,
      log: !!d.log,
      date: date,
      time: time
    };
  }
  function doSchedule(root, date, time) {
    var d = composeReady(root);
    if (!d) return;
    /* Scheduled sends carry Drive/Documents files as links and plain text only; files uploaded from the computer cannot wait on the server. */
    if ((d.attachments || []).some(function (a) { return a && a.data; })) { toast(root, 'Files from this computer can only go with Send now. Remove them or attach from Documents to schedule.'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) { toast(root, 'Pick a date and a 24-hour time, like 08:00'); return; }
    var who = d.to.map(function (r) { return r.email; }).join(', ');
    if (!window.confirm('Schedule this email to send from your Gmail at ' + date + ' ' + time + ' (Vancouver time)?\n\nTo: ' + who + '\nSubject: ' + (d.subject || '(no subject)') + '\n\nIt sends once, at that time. You can cancel or edit it from Scheduled until then.')) return;
    if (fixtureOn()) { toast(root, 'Scheduled (fixture)'); closePop(root); return; }
    var editing = d.schedEditId;
    var body = schedulePayload(d, date, time);
    if (editing && d.attachments && d.attachments.length === 0) body.attachments = d.schedAttachments || [];
    var req = editing
      ? call('/api/mail/schedule/' + encodeURIComponent(editing), { method: 'PATCH', body: body })
      : call('/api/mail/schedule', { method: 'POST', body: body });
    req.then(function (res) {
      closePop(root);
      var item = res && res.item;
      S().composeOpen = false;
      S().composeDraft = null;
      if (M().repaint) M().repaint();
      refreshSchedCount(true);
      toast(root, (editing ? 'Updated. ' : '') + 'Scheduled for ' + ((item && item.sendAtLabel) || (date + ' ' + time)) + ' Vancouver time', item && item.id ? function () {
        call('/api/mail/schedule/' + encodeURIComponent(item.id), { method: 'POST', body: { action: 'cancel' } })
          .then(function () { refreshSchedCount(true); toast(root, 'Scheduled send cancelled'); })
          .catch(function (err) { toast(root, msgOf(err, 'Could not cancel it')); });
      } : null);
    }).catch(function (err) {
      var p = rootGet(root, 'r3Pop');
      var e = p && p.querySelector('.err');
      if (e) e.textContent = msgOf(err, 'Could not schedule that email');
      else toast(root, msgOf(err, 'Could not schedule that email'));
    });
  }
  function scheduleMenu(el, root) {
    var d = M().state ? M().state() : {};
    var rows = presetList().map(function (p) {
      return '<div class="opt" data-action="mail-sched-preset" data-date="' + p[1] + '" data-time="' + p[2] + '">' + esc(p[0]) + '<span>' + esc(dayLabel(p[1])) + ' ' + p[2] + '</span></div>';
    }).join('');
    var date = d.schedDate || addDays(vanToday(), 1);
    var time = d.schedTime || '08:00';
    openPop(root, el, '<h5>' + (d.schedEditId ? 'Change the send time' : 'Schedule send') + '</h5>' + rows
      + '<div class="row"><label>Date</label><input type="date" data-action="r3-field" data-ext-field id="r3SchedDate" value="' + esc(date) + '" min="' + vanToday() + '"></div>'
      + '<div class="row"><label>Time</label><input data-action="r3-field" data-ext-field id="r3SchedTime" value="' + esc(time) + '" placeholder="08:00" maxlength="5" inputmode="numeric" style="width:80px"><button class="r3-btn pri" type="button" data-action="mail-sched-custom">Schedule</button></div>'
      + '<div class="hint">24-hour time, Vancouver. Sends once from your Gmail within 5 minutes of that time.</div><div class="err"></div>');
  }
  var schedCountAt = 0;
  function refreshSchedCount(force) {
    if (fixtureOn() || (!force && Date.now() - schedCountAt < 60000)) return;
    schedCountAt = Date.now();
    call('/api/mail/schedule').then(function (d) {
      var n = (d.items || []).filter(function (x) { return x.status === 'queued' || x.status === 'sending'; }).length;
      var changed = (S().mailSchedCount | 0) !== n;
      S().mailSchedCount = n;
      S().mailSched = d;
      if (changed && S().desk === 'mail' && !S().composeOpen && typeof window.paintRedesignEmail === 'function') window.paintRedesignEmail();
    }).catch(function () {});
  }
  var STATUS_WORD = { queued: 'Scheduled', sending: 'Sending', sent: 'Sent', cancelled: 'Cancelled', failed: 'Did not send' };
  function schedListHtml(d) {
    var items = (d && d.items) || [];
    var warn = d && d.cron === false ? '<div class="warn">The cron secret is not set in Vercel, so the 5-minute job cannot run and nothing scheduled will send.</div>' : '';
    if (items.some(function (x) { return x.late; })) warn += '<div class="warn">Something is late: the 5-minute job has not sent it yet. Check the cron in Vercel.</div>';
    if (!items.length) return warn + '<div class="empty">Nothing scheduled. Use Schedule in a new email.</div>';
    return warn + items.map(function (x) {
      var live = x.status === 'queued' || x.status === 'failed';
      var done = x.status === 'sent' || x.status === 'cancelled' || x.status === 'failed';
      return '<div class="it"><div class="top"><span class="st ' + esc(x.status) + '">' + esc(STATUS_WORD[x.status] || x.status) + '</span><b>' + esc(x.subject || '(no subject)') + '</b></div>'
        + '<div class="meta">' + esc(x.sendAtLabel) + ' Vancouver &middot; to ' + esc((x.to || []).join(', ')) + ((x.cc || []).length ? ' &middot; cc ' + esc(x.cc.join(', ')) : '') + '</div>'
        + (x.error ? '<div class="meta" style="color:#e0364f">' + esc(x.error) + '</div>' : '')
        + '<div class="pv">' + esc(String(x.text || '').slice(0, 280)) + '</div>'
        + '<div class="acts">'
        + (live ? '<button class="r3-btn" type="button" data-action="mail-sched-edit" data-id="' + esc(x.id) + '">Edit</button><button class="r3-btn" type="button" data-action="mail-sched-cancel" data-id="' + esc(x.id) + '">Cancel send</button>' : '')
        + (done ? '<button class="r3-btn red" type="button" data-action="mail-sched-hide" data-id="' + esc(x.id) + '">Remove from list</button>' : '')
        + '</div></div>';
    }).join('');
  }
  function paintSchedList(root) {
    var body = rootGet(root, 'r3Db');
    if (body) body.innerHTML = schedListHtml(S().mailSched);
  }
  function loadSchedList(root) {
    return call('/api/mail/schedule').then(function (d) {
      S().mailSched = d;
      S().mailSchedCount = (d.items || []).filter(function (x) { return x.status === 'queued' || x.status === 'sending'; }).length;
      paintSchedList(root);
    }).catch(function (err) {
      var body = rootGet(root, 'r3Db');
      if (body) body.innerHTML = '<div class="empty">' + esc(msgOf(err, 'Could not load scheduled mail')) + ' <span class="r3-btn" data-action="mail-sched-list" role="button">Retry</span></div>';
    });
  }
  function schedItem(id) {
    return ((S().mailSched || {}).items || []).filter(function (x) { return x.id === id; })[0] || null;
  }

  var actions = {
    'r3-field': function () {},
    'r3-close': function (el, root) { closeDrawer(root); closePop(root); },
    'mail-schedule': function (el, root) {
      if (rootGet(root, 'r3Pop')) { closePop(root); return; }
      if (!composeReady(root)) return;
      scheduleMenu(el, root);
    },
    'mail-sched-preset': function (el, root) { doSchedule(root, attr(el, 'data-date'), attr(el, 'data-time')); },
    'mail-sched-custom': function (el, root) {
      var date = String((rootGet(root, 'r3SchedDate') || {}).value || '');
      var raw = String((rootGet(root, 'r3SchedTime') || {}).value || '').trim();
      var m = raw.match(/^(\d{1,2}):?(\d{2})$/);
      var time = m ? ('0' + m[1]).slice(-2) + ':' + m[2] : raw;
      doSchedule(root, date, time);
    },
    'mail-sched-list': function (el, root) {
      openDrawer(root, 'Scheduled', '<div class="empty">Loading&hellip;</div>', '<button class="r3-btn" type="button" data-action="r3-close">Close</button>');
      S().mailSchedOpen = true;
      markSched(root, true);
      if (fixtureOn()) { S().mailSched = { items: [], cron: true }; paintSchedList(root); return; }
      loadSchedList(root);
    },
    'mail-sched-cancel': function (el, root) {
      var id = attr(el, 'data-id');
      call('/api/mail/schedule/' + encodeURIComponent(id), { method: 'POST', body: { action: 'cancel' } }).then(function () {
        toast(root, 'Cancelled. It will not send.');
        loadSchedList(root);
        refreshSchedCount(true);
      }).catch(function (err) { toast(root, msgOf(err, 'Could not cancel it')); loadSchedList(root); });
    },
    'mail-sched-hide': function (el, root) {
      var id = attr(el, 'data-id');
      call('/api/mail/schedule/' + encodeURIComponent(id), { method: 'DELETE' }).then(function () {
        loadSchedList(root);
      }).catch(function (err) { toast(root, msgOf(err, 'Could not remove it')); });
    },
    'mail-sched-edit': function (el, root) {
      var x = schedItem(attr(el, 'data-id'));
      if (!x || !M().open) return;
      closeDrawer(root);
      var at = String(x.sendAtLabel || '').split(' ');
      M().open({
        to: (x.to || []).map(function (e) { return { email: e, name: '' }; }),
        cc: (x.cc || []).map(function (e) { return { email: e, name: '' }; }),
        bcc: (x.bcc || []).map(function (e) { return { email: e, name: '' }; }),
        showCc: !!((x.cc || []).length || (x.bcc || []).length),
        subject: x.subject || '',
        body: x.text || '',
        attachments: [],
        schedAttachments: x.attachments || [],
        reply: !!x.reply,
        threadId: x.threadId || '',
        messageId: x.messageId || '',
        nudge: !!x.nudge,
        log: !!x.log,
        schedEditId: x.id,
        schedDate: at[0] || '',
        schedTime: at[1] || ''
      });
      toast(mailRootNow() || root, 'Editing the scheduled email. Use Update schedule to save it.');
    },

    /* ---------- Research (Perplexity) ---------- */
    'news-research': function (el, root) {
      var i = Number(attr(el, 'data-nw-at'));
      var item = ((S().newsView || [])[i]) || null;
      if (!item) { toast(root, 'That story is no longer in the feed'); return; }
      var q = 'What does this mean for Canadian payment service providers and for 4orm Finance: ' + String(item.title || '');
      var ctx = [item.summary || item.description || '', item.url ? 'Story: ' + item.url : ''].filter(Boolean).join('\n');
      research(root, item.title || 'Research', q, ctx, { kind: 'news', item: item });
    },
    'space-research': function (el, root) {
      var sid = attr(el, 'data-id') || (S().pkg && S().pkg.id) || '';
      var box = root.querySelector && root.querySelector('.angle[data-action="space-angle"]');
      var angle = box ? String(box.innerText || '').trim() : String((S().pkg && S().pkg.angle) || '');
      var name = String((S().pkg && (S().pkg.name || S().pkg.title)) || '');
      var q = angle ? 'Find current, citable evidence for this angle: ' + angle : 'Find current, citable facts for an outreach angle about: ' + name;
      research(root, 'Research: ' + (name || 'this Space'), q.slice(0, 590), name ? 'Space: ' + name : '', { kind: 'space', id: sid });
    },
    'r3-research-angle': function (el, root) {
      var r = S().r3Research;
      if (!r || r.ctx.kind !== 'space') return;
      var sid = r.ctx.id;
      if (!/^[0-9a-f-]{36}$/i.test(String(sid || ''))) { toast(root, 'Save the Space first'); return; }
      var box = root.querySelector && root.querySelector('.angle[data-action="space-angle"]');
      var before = box ? String(box.innerText || '').trim() : String((S().pkg && S().pkg.angle) || '');
      var addText = researchText(r);
      var next = (before ? before + '\n\n' : '') + addText;
      call('/api/spaces/' + encodeURIComponent(sid), { method: 'PATCH', body: { angle: next } }).then(function () {
        if (box) box.innerText = next;
        if (S().pkg && String(S().pkg.id) === String(sid)) S().pkg.angle = next;
        closeDrawer(root);
        toast(root, 'Research added to the angle', function () {
          call('/api/spaces/' + encodeURIComponent(sid), { method: 'PATCH', body: { angle: before } }).then(function () {
            var b2 = root.querySelector && root.querySelector('.angle[data-action="space-angle"]');
            if (b2) b2.innerText = before;
            if (S().pkg && String(S().pkg.id) === String(sid)) S().pkg.angle = before;
          }).catch(function () { toast(root, 'Could not put the old angle back'); });
        });
      }).catch(function (err) { toast(root, msgOf(err, 'Could not save the angle')); });
    },
    'r3-research-inv': function (el, root) {
      var r = S().r3Research;
      if (!r) return;
      var item = r.ctx.item || {};
      addToUpdate(root, {
        section: 'news',
        title: String(item.title || r.title || 'Research').slice(0, 280),
        body: r.answer.replace(/\[\d+\]/g, '').slice(0, 1200),
        source: 'news',
        sourceRef: 'news:' + String(item.url || item.title || r.title).slice(0, 180),
        url: item.url || ''
      }, false);
    },
    'r3-research-copy': function (el, root) {
      var r = S().r3Research;
      if (!r) return;
      copyText(root, researchText(r));
    },

    /* ---------- Investor update ---------- */
    'done-investor': function (el, root) {
      var date = attr(el, 'data-date');
      var headline = attr(el, 'data-headline');
      if (!date) { toast(root, 'Open a day first'); return; }
      if (fixtureOn()) { toast(root, 'Added (fixture)'); return; }
      addToUpdate(root, {
        section: 'progress',
        title: dayLabel(date) + ': ' + (headline || 'day snapshot').slice(0, 200),
        body: headline || '',
        source: 'completed',
        sourceRef: 'done:' + date,
        url: ''
      }, true);
    },
    'r3-inv-open': function (el, root) { openInvestor(root); },
    'r3-inv-remove': function (el, root) {
      var id = attr(el, 'data-id');
      call('/api/investor-update/items/' + encodeURIComponent(id), { method: 'PATCH', body: { deleted: true } }).then(function () {
        loadInvestor(root);
        toast(root, 'Removed from the update', function () {
          call('/api/investor-update/items/' + encodeURIComponent(id), { method: 'PATCH', body: { deleted: false } }).then(function () { loadInvestor(root); });
        });
      }).catch(function (err) { toast(root, msgOf(err, 'Could not remove it')); });
    },
    'r3-inv-copy': function (el, root) { copyText(root, (S().r3Inv || {}).text || ''); },

    /* ---------- Integrations ---------- */
    'int-perplexity-test': function (el, root) {
      el.disabled = true;
      call('/api/integrations/perplexity', { method: 'POST', body: { kind: 'check' } }).then(function (d) {
        toast(root, 'Perplexity answered with ' + ((d.sources || []).length) + ' sources. The key works.');
      }).catch(function (err) { toast(root, msgOf(err, 'Perplexity did not answer')); })
        .then(function () { if (window.__deskRefreshExt && window.__deskRefreshExt.int) window.__deskRefreshExt.int(); });
    }
  };

  function mailRootNow() { return M().root ? M().root() : hostRoot('mailDesk'); }
  function copyText(root, text) {
    var done = function () { toast(root, 'Copied'); };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(done, function () { window.prompt('Copy this', text); }); return; }
    } catch (e) {}
    window.prompt('Copy this', text);
  }

  /* ---------- Perplexity research drawer ---------- */
  function researchText(r) {
    return r.answer + (r.sources.length ? '\n\nSources:\n' + r.sources.map(function (s) { return '[' + s.n + '] ' + s.title + ' - ' + s.url; }).join('\n') : '');
  }
  function research(root, title, q, ctx, meta) {
    if (fixtureOn()) { toast(root, 'Research (fixture)'); return; }
    var foot = '<button class="r3-btn" type="button" data-action="r3-close">Close</button>';
    openDrawer(root, title, '<div class="empty">Researching with Perplexity. This takes up to half a minute.</div>', foot);
    call('/api/integrations/perplexity', { method: 'POST', body: { q: q, context: ctx, kind: meta.kind } }).then(function (d) {
      var r = { title: title, answer: String(d.answer || ''), sources: d.sources || [], ctx: meta };
      S().r3Research = r;
      var body = rootGet(root, 'r3Db');
      var footEl = rootGet(root, 'r3Df');
      if (!body) return;
      body.innerHTML = '<div class="ans">' + esc(r.answer) + '</div>'
        + (r.sources.length ? '<div class="sec">Sources</div><div class="src">' + r.sources.map(function (s) {
          return '<div>[' + s.n + '] <a href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer">' + esc(s.title) + '</a>' + (s.date ? ' &middot; ' + esc(s.date) : '') + '</div>';
        }).join('') + '</div>' : '<div class="meta">No sources came back, so treat this as unverified.</div>');
      if (footEl) {
        footEl.innerHTML = (meta.kind === 'space' ? '<button class="r3-btn pri" type="button" data-action="r3-research-angle">Add to the angle</button>' : '<button class="r3-btn pri" type="button" data-action="r3-research-inv">Add to investor update</button>')
          + '<button class="r3-btn" type="button" data-action="r3-research-copy">Copy with sources</button>' + foot;
      }
    }).catch(function (err) {
      var body = rootGet(root, 'r3Db');
      if (body) body.innerHTML = '<div class="empty">' + esc(msgOf(err, 'Research failed')) + '</div>';
    });
  }

  /* ---------- Investor update draft ---------- */
  function addToUpdate(root, item, openAfter) {
    call('/api/investor-update', { method: 'POST', body: item }).then(function (d) {
      var label = monthName(d.month);
      toast(root, (d.existed ? 'Already in the ' : 'Added to the ') + label + ' investor update', d.existed || !d.item ? null : function () {
        call('/api/investor-update/items/' + encodeURIComponent(d.item.id), { method: 'PATCH', body: { deleted: true } }).then(function () {
          toast(root, 'Taken out of the update');
          if (rootGet(root, 'r3Inv')) loadInvestor(root);
        });
      });
      if (openAfter) openInvestor(root);
      else if (rootGet(root, 'r3Dr')) closeDrawer(root);
    }).catch(function (err) { toast(root, msgOf(err, 'Could not add that to the investor update')); });
  }
  function monthName(m) {
    var p = String(m || '').split('-').map(Number);
    if (!p[0]) return 'monthly';
    return new Date(Date.UTC(p[0], p[1] - 1, 15)).toLocaleDateString('en-CA', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  }
  var SECTION_NAMES = [['highlights', 'Highlights'], ['progress', 'Progress'], ['metrics', 'Metrics'], ['news', 'In the news'], ['asks', 'Asks']];
  function investorHtml(d) {
    var items = d.items || [];
    var html = '<div id="r3Inv"><div class="meta">Draft for ' + esc(monthName(d.month)) + '. Nothing here is sent; copy it into your update when it is ready.</div>'
      + '<div class="sec">Title</div><input class="full" data-action="r3-field" data-ext-field data-inv="title" value="' + esc(d.title) + '">'
      + '<div class="sec">Opening note</div><textarea class="full" data-action="r3-field" data-ext-field data-inv="intro" placeholder="Two or three lines on the month">' + esc(d.intro) + '</textarea>';
    SECTION_NAMES.forEach(function (sec) {
      var list = items.filter(function (i) { return i.section === sec[0]; });
      if (!list.length && sec[0] !== 'asks') return;
      html += '<div class="sec">' + esc(sec[1]) + '</div>';
      list.forEach(function (i) {
        html += '<div class="it"><input class="full" data-action="r3-field" data-ext-field data-item="' + esc(i.id) + '" data-k="title" value="' + esc(i.title) + '">'
          + '<textarea class="full" data-action="r3-field" data-ext-field data-item="' + esc(i.id) + '" data-k="body" placeholder="Detail (optional)">' + esc(i.body) + '</textarea>'
          + '<div class="acts"><select data-action="r3-field" data-ext-field data-item="' + esc(i.id) + '" data-k="section">' + SECTION_NAMES.map(function (s) { return '<option value="' + s[0] + '"' + (s[0] === i.section ? ' selected' : '') + '>' + esc(s[1]) + '</option>'; }).join('') + '</select>'
          + (i.url ? '<a class="r3-btn" href="' + esc(i.url) + '" target="_blank" rel="noopener noreferrer" data-action="r3-field" style="line-height:30px;text-decoration:none">Open source</a>' : '')
          + '<button class="r3-btn red" type="button" data-action="r3-inv-remove" data-id="' + esc(i.id) + '">Remove</button><span class="meta">from ' + esc(i.source) + '</span></div></div>';
      });
      if (sec[0] === 'asks') html += '<textarea class="full" data-action="r3-field" data-ext-field data-inv="asks" placeholder="What you need from investors this month">' + esc(d.asks) + '</textarea>';
    });
    if (!items.length) html += '<div class="empty">Nothing added yet. Use "Add to investor update" on a Completed day or on News research.</div>';
    return html + '</div>';
  }
  function loadInvestor(root) {
    return call('/api/investor-update').then(function (d) {
      S().r3Inv = d;
      var body = rootGet(root, 'r3Db');
      if (body) { body.innerHTML = investorHtml(d); wireInvestor(root); }
    }).catch(function (err) {
      var body = rootGet(root, 'r3Db');
      if (body) body.innerHTML = '<div class="empty">' + esc(msgOf(err, 'Could not load the draft')) + '</div>';
    });
  }
  function wireInvestor(root) {
    var box = rootGet(root, 'r3Inv');
    if (!box) return;
    box.querySelectorAll('[data-inv]').forEach(function (f) {
      f.addEventListener('change', function () {
        var k = attr(f, 'data-inv');
        var b = {};
        b[k] = String(f.value || '');
        call('/api/investor-update', { method: 'PATCH', body: b }).then(function () { toast(root, 'Saved'); }).catch(function () { toast(root, 'Could not save that'); });
      });
    });
    box.querySelectorAll('[data-item]').forEach(function (f) {
      f.addEventListener('change', function () {
        var b = {};
        b[attr(f, 'data-k')] = String(f.value || '');
        call('/api/investor-update/items/' + encodeURIComponent(attr(f, 'data-item')), { method: 'PATCH', body: b }).then(function () {
          if (attr(f, 'data-k') === 'section') loadInvestor(root); else toast(root, 'Saved');
        }).catch(function () { toast(root, 'Could not save that'); });
      });
    });
  }
  function openInvestor(root) {
    openDrawer(root, 'Investor update draft', '<div class="empty">Loading&hellip;</div>',
      '<button class="r3-btn pri" type="button" data-action="r3-inv-copy">Copy as text</button><button class="r3-btn" type="button" data-action="r3-close">Close</button>');
    loadInvestor(root);
  }

  /* ======================= P13: longer beats ======================= */
  var beatsLast = null;
  function beatTile(b) {
    var d = Number(b.daysLeft) || 0;
    return '<div class="beat" data-action="r3-beat" data-id="' + esc(b.id) + '"><div class="btop"><span class="n">' + esc(b.name) + '</span><span class="d">' + d + '<small>' + (d === 0 ? 'd, due today' : 'd') + '</small></span></div>'
      + '<div class="bar"><i style="width:' + Math.max(3, Math.min(100, Number(b.pct) || 3)) + '%;background:var(' + esc(/^--[a-z]+$/.test(b.color) ? b.color : '--blue') + ')"></i></div>'
      + '<div class="f"><span>' + esc(b.label) + ' &middot; ' + esc(dayLabel(b.nextDue)) + '</span><span' + (b.lastDone && b.lastDone >= b.prevDue ? ' class="rdy"' : '') + '>' + esc(b.lastDone && b.lastDone >= b.prevDue ? 'last one done' : (b.sub || '-')) + '</span></div></div>';
  }
  function paintBeats(el, head, pb, today, ahead) {
    if (!el || !pb || !Array.isArray(pb.beats)) return false;
    beatsLast = { el: el, head: head, pb: pb, today: today, ahead: ahead };
    var goal = (ahead || [])[0];
    var html = '';
    if (goal) {
      var t0 = Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10));
      var t1 = Date.UTC(+goal.ymd.slice(0, 4), +goal.ymd.slice(5, 7) - 1, +goal.ymd.slice(8, 10));
      var days = Math.max(0, Math.round((t1 - t0) / 86400000));
      html += '<div class="beat goal" data-action="r3-field"><div class="btop"><span class="n">' + esc(goal.title) + '</span><span class="d">' + days + '<small>d</small></span></div><div class="bar"><i style="width:' + Math.max(3, Math.min(100, Math.round(100 - days / 60 * 100))) + '%;background:var(--lime)"></i></div><div class="f"><span>due ' + esc(dayLabel(goal.ymd)) + '</span><span>' + esc(goal.area || 'roadmap') + '</span></div></div>';
    }
    html += pb.beats.map(beatTile).join('');
    html += '<div class="beat" data-action="r3-beat-new" style="display:flex;align-items:center;justify-content:center;font-weight:750;opacity:.8">+ Add a beat</div>';
    el.innerHTML = html;
    el.style.display = '';
    if (head) head.style.display = '';
    return true;
  }
  function beatById(id) {
    return ((beatsLast && beatsLast.pb && beatsLast.pb.beats) || []).filter(function (b) { return b.id === id; })[0] || null;
  }
  function beatForm(b) {
    var c = (b && b.cadence) || { kind: 'monthly', every: 14, anchor: vanToday() };
    var kinds = [['days', 'Every N days'], ['weekly', 'Weekly'], ['monthly', 'Monthly'], ['quarterly', 'Quarterly']];
    return '<h5>' + (b ? 'Longer beat' : 'New longer beat') + '</h5>'
      + '<div class="row"><label>Name</label><input data-action="r3-field" data-ext-field id="r3BName" value="' + esc(b ? b.name : '') + '" placeholder="Investor update" style="flex:1"></div>'
      + '<div class="row"><label>How often</label><select data-action="r3-field" data-ext-field id="r3BKind">' + kinds.map(function (k) { return '<option value="' + k[0] + '"' + (k[0] === c.kind ? ' selected' : '') + '>' + k[1] + '</option>'; }).join('') + '</select>'
      + '<input data-action="r3-field" data-ext-field id="r3BEvery" inputmode="numeric" value="' + esc(c.kind === 'days' ? c.every : 14) + '" style="width:56px" title="Number of days"><span class="hint" style="margin:0">days</span></div>'
      + '<div class="row"><label>Starts</label><input type="date" data-action="r3-field" data-ext-field id="r3BAnchor" value="' + esc(c.anchor) + '"></div>'
      + '<div class="row"><label>Note</label><input data-action="r3-field" data-ext-field id="r3BSub" value="' + esc(b ? b.sub : '') + '" placeholder="what is ready" style="flex:1"></div>'
      + (b ? '<div class="hint">Next: ' + esc(dayLabel(b.nextDue)) + ' (' + esc(b.nextDue) + '), in ' + esc(b.daysLeft) + ' days.</div>' : '')
      + '<div class="row" style="flex-wrap:wrap">'
      + '<button class="r3-btn pri" type="button" data-action="r3-beat-save" data-id="' + esc(b ? b.id : '') + '">Save</button>'
      + (b ? '<button class="r3-btn" type="button" data-action="r3-beat-done" data-id="' + esc(b.id) + '" data-day="' + esc(b.nextDue) + '">Mark ' + esc(dayLabel(b.nextDue)) + ' done</button>' : '')
      + (b && /investor update/i.test(b.name) ? '<button class="r3-btn" type="button" data-action="r3-inv-open">Open the draft</button>' : '')
      + (b ? '<button class="r3-btn red" type="button" data-action="r3-beat-remove" data-id="' + esc(b.id) + '">Remove</button>' : '')
      + '</div><div class="err"></div>';
  }
  function beatsReply(root, d, msg, undo) {
    if (beatsLast && d && Array.isArray(d.beats)) {
      beatsLast.pb.beats = d.beats;
      if (S().playbook) S().playbook.beats = d.beats;
      paintBeats(beatsLast.el, beatsLast.head, beatsLast.pb, beatsLast.today, beatsLast.ahead);
    }
    closePop(root);
    if (msg) toast(root, msg, undo);
  }
  function beatErr(root, err) {
    var p = rootGet(root, 'r3Pop');
    var e = p && p.querySelector('.err');
    if (e) e.textContent = msgOf(err, 'Could not save that beat');
    else toast(root, msgOf(err, 'Could not save that beat'));
  }
  Object.assign(actions, {
    'r3-beat': function (el, root) { openPop(root, el, beatForm(beatById(attr(el, 'data-id')))); },
    'play-beat': function (el, root) { openPop(root, el, beatForm(beatById(attr(el, 'data-id')))); },
    'r3-beat-new': function (el, root) { openPop(root, el, beatForm(null)); },
    'r3-beat-save': function (el, root) {
      var id = attr(el, 'data-id');
      var kind = String((rootGet(root, 'r3BKind') || {}).value || 'monthly');
      var cadence = { kind: kind, every: Number((rootGet(root, 'r3BEvery') || {}).value) || 14, anchor: String((rootGet(root, 'r3BAnchor') || {}).value || '') };
      var body = { name: String((rootGet(root, 'r3BName') || {}).value || '').trim(), cadence: cadence, sub: String((rootGet(root, 'r3BSub') || {}).value || '') };
      if (!body.name) { beatErr(root, new Error('Name the beat')); return; }
      if (fixtureOn()) { closePop(root); toast(root, 'Saved (fixture)'); return; }
      var req = id ? call('/api/playbook/beats', { method: 'PATCH', body: Object.assign({ id: id }, body) }) : call('/api/playbook/beats', { method: 'POST', body: body });
      req.then(function (d) { beatsReply(root, d, id ? 'Beat saved' : 'Beat added'); }).catch(function (err) { beatErr(root, err); });
    },
    'r3-beat-done': function (el, root) {
      var id = attr(el, 'data-id');
      var day = attr(el, 'data-day');
      call('/api/playbook/beats', { method: 'POST', body: { id: id, action: 'done', day: day } }).then(function (d) {
        beatsReply(root, d, 'Marked done. The countdown moves to the next one.', function () {
          call('/api/playbook/beats', { method: 'POST', body: { id: id, action: 'undone', day: day } }).then(function (d2) { beatsReply(root, d2, 'Back to not done'); });
        });
      }).catch(function (err) { beatErr(root, err); });
    },
    'r3-beat-remove': function (el, root) {
      var id = attr(el, 'data-id');
      call('/api/playbook/beats', { method: 'PATCH', body: { id: id, active: false } }).then(function (d) {
        beatsReply(root, d, 'Beat removed', function () {
          call('/api/playbook/beats', { method: 'PATCH', body: { id: id, active: true } }).then(function (d2) { beatsReply(root, d2, 'Beat is back'); });
        });
      }).catch(function (err) { beatErr(root, err); });
    }
  });

  /* ======================= C22: Google calendar select ======================= */
  var cal = { list: null, at: 0, sourceId: '', armed: false, root: null };
  function loadCalendars() {
    if (fixtureOn()) return Promise.resolve([]);
    if (cal.list && Date.now() - cal.at < 10 * 60 * 1000) return Promise.resolve(cal.list);
    return call('/api/calendar/calendars').then(function (d) {
      cal.list = (d.calendars || []).filter(function (c) { return c.writable || c.source; });
      cal.at = Date.now();
      var src = cal.list.filter(function (c) { return c.source; })[0];
      cal.sourceId = src ? src.id : '';
      return cal.list;
    }).catch(function () { cal.list = []; cal.at = Date.now(); return []; });
  }
  function calColor(id) {
    var c = (cal.list || []).filter(function (x) { return x.id === id; })[0];
    return c ? c.color : '';
  }
  function paintSwatch(root) {
    var sel = rootGet(root, 'r3Gcal');
    var sw = rootGet(root, 'pSw');
    if (!sel || !sw) return;
    var col = calColor(sel.value);
    if (col && sw.style.background !== col) sw.style.background = col;
  }
  function decorateCal(root) {
    if (!root || root.__r3Cal) return;
    var pCal = rootGet(root, 'pCal');
    var pop = rootGet(root, 'pop');
    if (!pCal || !pop) return;
    loadCalendars().then(function (list) {
      if (!list.length || root.__r3Cal) return;
      root.__r3Cal = true;
      cal.root = root;
      var sel = document.createElement('select');
      sel.id = 'r3Gcal';
      sel.setAttribute('data-action', 'r3-field');
      sel.setAttribute('data-ext-field', '');
      sel.title = 'Google calendar this event goes on';
      sel.innerHTML = list.map(function (c) { return '<option value="' + esc(c.id) + '">' + esc(c.name) + (c.source ? ' (shown here)' : '') + '</option>'; }).join('');
      pCal.style.display = 'none';
      pCal.parentNode.insertBefore(sel, pCal.nextSibling);
      sel.addEventListener('change', function () { paintSwatch(root); });
      /* The editor repaints its swatch from the event type; keep showing the Google calendar's colour. */
      var sw = rootGet(root, 'pSw');
      if (sw && window.MutationObserver) new MutationObserver(function () { if (pop.classList.contains('open')) paintSwatch(root); }).observe(sw, { attributes: true, attributeFilter: ['style'] });
      if (window.MutationObserver) new MutationObserver(function () {
        if (!pop.classList.contains('open')) return;
        var api = window.__redesignCal || {};
        var ev = typeof api.sel === 'function' ? api.sel() : null;
        var title = String((rootGet(root, 'pTitle') || {}).value || '');
        var at = ev && ev.gcalAt && String(ev.t || '') === title ? ev.gcalAt : cal.sourceId;
        sel.value = (cal.list || []).some(function (c) { return c.id === at; }) ? at : cal.sourceId;
        paintSwatch(root);
      }).observe(pop, { attributes: true, attributeFilter: ['class'] });
      root.addEventListener('click', function (e) {
        var t = (e.composedPath && e.composedPath()[0]) || e.target;
        if (t && t.closest && t.closest('#pSave')) cal.armed = true;
      }, true);
    });
  }
  /* Called from calWrite (redesign-pages-c.js): the calendarId to send, or '' for the default calendar. */
  function calendarFor(ev, type) {
    if (!cal.armed || (type !== 'create' && type !== 'patch')) return '';
    cal.armed = false;
    var sel = cal.root && rootGet(cal.root, 'r3Gcal');
    var v = sel ? String(sel.value || '') : '';
    if (!v || v === cal.sourceId) return '';
    if (ev.gcalAt === v) return '';
    ev.gcalAt = v;
    return v;
  }
  setInterval(function () {
    var api = window.__redesignCal;
    if (api && api.root && !api.root.__r3Cal) decorateCal(api.root);
  }, 1500);

  /* ======================= News: Research button ======================= */
  function decorateNews() {
    var host = document.getElementById('newsDesk');
    var root = host ? (host.shadowRoot || host) : null;
    if (!root || !root.querySelector) return;
    var acts = root.querySelector('.hero .acts');
    if (!acts || acts.querySelector('[data-action="news-research"]')) return;
    var save = acts.querySelector('[data-nw-at]');
    if (!save) return;
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'a';
    b.setAttribute('data-action', 'news-research');
    b.setAttribute('data-nw-at', attr(save, 'data-nw-at'));
    b.title = 'Research this story with Perplexity, with sources';
    b.textContent = 'Research';
    acts.appendChild(b);
  }
  setInterval(decorateNews, 1200);

  /* ======================= register ======================= */
  function wrap(name, make) {
    var A = window.deskActions;
    var orig = A[name];
    if (!orig || orig.__r3) return;
    var fn = make(orig);
    fn.__r3 = true;
    A[name] = fn;
  }
  function register() {
    var A = window.deskActions;
    if (!A) return false;
    Object.assign(A, actions);
    /* Send now while editing a scheduled email: cancel the queued one first, so it never goes twice. */
    wrap('mail-send', function (orig) {
      return function (el, root, ev) {
        var d = M().state ? M().state() : {};
        if (!d.schedEditId) return orig(el, root, ev);
        var id = d.schedEditId;
        if (!window.confirm('This email is scheduled. Send it now instead? The scheduled send is cancelled first.')) return;
        call('/api/mail/schedule/' + encodeURIComponent(id), { method: 'POST', body: { action: 'cancel' } }).then(function () {
          delete d.schedEditId;
          refreshSchedCount(true);
          orig(el, root, ev);
        }).catch(function (err) {
          var st = err && err.body && err.body.item && err.body.item.status;
          if (st === 'cancelled') { delete d.schedEditId; orig(el, root, ev); return; }
          toast(root, st === 'sent' || st === 'sending' ? 'It has already gone out, so it was not sent again.' : msgOf(err, 'Could not cancel the scheduled send, so nothing was sent'));
        });
      };
    });
    /* B56: a new tag on a box also goes to GoHighLevel and Contacts for the box's addresses. */
    wrap('mail-box-tag-add', function (orig) {
      return function (el, root, ev) {
        var id = attr(el, 'data-id');
        function boxNow() {
          return (S().emailBoxes || []).filter(function (b) { return String(b.id) === String(id); })[0]
            || ((typeof window.__peopleState === 'function' ? window.__peopleState().boxes : []) || []).filter(function (b) { return String(b.id) === String(id); })[0] || null;
        }
        var before = ((boxNow() || {}).tags || []).slice();
        orig(el, root, ev);
        var box = boxNow();
        if (!box) return;
        var added = (box.tags || []).filter(function (t) { return before.indexOf(t) < 0; });
        var emails = (box.addrs || []).concat(/@/.test(String(box.o || '')) ? [box.o] : []);
        if (!added.length || fixtureOn()) return;
        if (!emails.length) { toast(root, 'Tag saved on the box. Add an email address to send it to GoHighLevel.'); return; }
        call('/api/ghl/tags', { method: 'POST', body: { emails: emails, add: added } }).then(function (d) {
          var bits = [];
          if (d.ghl === 'not_connected') bits.push('GoHighLevel is not connected');
          else bits.push(d.ghlTagged ? 'tagged in GoHighLevel' : 'no GoHighLevel contact with that email');
          bits.push(d.contactsTagged ? 'and in Contacts' : 'not in Contacts yet');
          toast(root, '#' + added.join(', #') + ' saved: ' + bits.join(', '), function () {
            call('/api/ghl/tags', { method: 'POST', body: { emails: emails, remove: added } }).catch(function () {});
            box.tags = (box.tags || []).filter(function (t) { return added.indexOf(t) < 0; });
            var b2 = (S().emailBoxes || []).filter(function (b) { return String(b.id) === String(id); })[0];
            if (b2) b2.tags = box.tags.slice();
            try { localStorage.setItem('cr_email_boxes', JSON.stringify(S().emailBoxes || [])); } catch (e) {}
            call('/api/mail/boxes', { method: 'POST', body: { action: 'save', boxes: (S().emailBoxes || []).map(function (b) { return { id: b.id, n: b.n, o: b.o || '', c: b.c || '#2e6bf2', tags: b.tags || [], addrs: b.addrs || [], closed: !!b.closed }; }) } }).catch(function () {});
            if (typeof window.paintRedesignEmail === 'function') window.paintRedesignEmail();
          });
        }).catch(function (err) { toast(root, 'Tag saved on the box, but ' + msgOf(err, 'GoHighLevel did not take it')); });
      };
    });
    wrap('zoom-refresh', function (orig) {
      return function (el, root, ev) { return orig(el, root, ev); };
    });
    window.__deskInputExt = window.__deskInputExt || {};
    window.__deskInputExt['r3-field'] = function () {};
    window.__deskRefreshExt = window.__deskRefreshExt || {};
    var priorMail = window.__deskRefreshExt.mail;
    window.__deskRefreshExt.mail = function () {
      if (typeof priorMail === 'function') { try { priorMail(); } catch (e) {} }
      refreshSchedCount(false);
    };
    return true;
  }
  if (!register()) {
    var tries = 0;
    var t = setInterval(function () { tries += 1; if (register() || tries > 80) clearInterval(t); }, 50);
  }
  window.__r3 = { paintBeats: paintBeats, calendarFor: calendarFor, openInvestor: openInvestor, refreshSchedCount: refreshSchedCount };
})();
