(function () {
  var MAIL = { messages: [], columns: [], rules: [], counts: { unread: 0, needs: 0, total: 0 }, q: '', filters: false, open: null, thread: null, assist: null, contact: null, status: '' };

  function initials(name) {
    return String(name || '?').replace(/[^A-Za-z0-9 ]/g, ' ').trim().split(/\s+/).slice(0, 2).map(function (p) { return p.slice(0, 1); }).join('').toUpperCase() || '?';
  }
  function ageOf(ms) {
    var gap = Date.now() - Number(ms || 0);
    if (!ms || gap < 0) return '';
    var mins = Math.round(gap / 60000);
    if (mins < 60) return mins + 'm';
    var hours = Math.round(mins / 60);
    if (hours < 48) return hours + 'h';
    return Math.round(hours / 24) + 'd';
  }
  function readerWidth() {
    var w = 520;
    try { w = Number(localStorage.getItem('cr_email_reader') || 0) || 520; } catch (err) {}
    return Math.max(380, Math.min(760, w));
  }
  function setReaderWidth(w) {
    w = Math.max(380, Math.min(760, w));
    try { localStorage.setItem('cr_email_reader', String(w)); } catch (err) {}
    var el = document.getElementById('emailReader');
    if (el) el.style.width = w + 'px';
  }
  function inCol(col, row) {
    if (col.key === 'needs_now') return !!row.needsNow;
    return row.column === col.key;
  }
  function bandFor(col, rules) {
    if (col.key === 'needs_now') return 'Urgent overlay - unread people mail that needs a reply';
    if (col.key === 'quiet') return 'Auto-muted bulk and marketing';
    var hits = (rules || []).filter(function (r) { return r.target === col.key; });
    if (!hits.length) return '';
    return hits.slice(0, 3).map(function (r) { return (r.matchType === 'sender' ? 'From ' : r.matchType === 'domain' ? 'Domain ' : r.matchType === 'subject' ? 'Subject ' : '') + r.matchValue; }).join(' · ');
  }

  function paintBoard() {
    var el = document.getElementById('emailDesk');
    if (!el) return;
    var q = MAIL.q;
    var rows = MAIL.messages || [];
    if (q) {
      var needle = q.toLowerCase();
      rows = rows.filter(function (row) {
        return (row.from + ' ' + row.email + ' ' + row.subject + ' ' + row.snippet).toLowerCase().indexOf(needle) >= 0;
      });
    }
    var counts = MAIL.counts || { unread: 0, needs: 0, total: rows.length };
    var rules = MAIL.rules || [];
    var cols = MAIL.columns || [];
    var filters = MAIL.filters ? '<div class="emx-filters"><div class="emx-bar" style="margin:0 0 8px"><b>Rules</b><button type="button" class="btn" id="emxNewRule">+ New rule</button></div>' + (rules.length ? rules.map(function (rule) {
      return '<div class="row"><span>' + esc(rule.matchType) + ' ' + esc(rule.matchValue) + ' -> ' + esc(rule.target) + (rule.sticky ? ' (sticky)' : '') + '</span><button type="button" class="btn" data-del-rule="' + esc(rule.id) + '">Remove</button></div>';
    }).join('') : '<div class="kick">No rules yet. Drag a card onto a column.</div>') + '</div>' : '';
    el.innerHTML = '<div class="emx-bar"><span class="t">Email</span><input class="search" id="emxFind" type="text" placeholder="Search mail..." value="' + esc(MAIL.q) + '"/><div class="emx-counts"><span><b>' + counts.unread + '</b> unread</span><span><b>' + counts.needs + '</b> needs now</span><span><b>' + counts.total + '</b> in view</span></div><button type="button" class="btn" id="emxFilters">Filters (' + rules.length + ')</button><button type="button" class="btn pri" id="emxCompose">Compose</button></div>'
      + '<div class="emx-rules"><span class="dot"></span> Auto-filing on - ' + rules.length + ' rule' + (rules.length === 1 ? '' : 's') + ' - drag any email onto a column creates a sticky rule <button type="button" class="lk" id="emxNewRuleTop">+ New rule</button></div>'
      + (MAIL.status === 'unavailable' ? '<div class="quiet" style="margin:0 0 10px">Gmail could not be read. Reconnect Google in Integrations to send, archive, and file.</div>' : '')
      + filters
      + '<div class="emx-board" id="emxBoard">' + cols.map(function (col) {
        var list = rows.filter(function (row) { return inCol(col, row); });
        var band = bandFor(col, rules);
        return '<section class="emx-col' + (col.key === 'quiet' ? ' quiet' : '') + (col.collapsed ? ' collapsed' : '') + '" data-col="' + esc(col.key) + '" style="flex-basis:' + (col.collapsed ? 42 : col.width) + 'px">'
          + '<div class="hd" draggable="true"><input class="nm" data-col-name="' + esc(col.key) + '" value="' + esc(col.name) + '"/><span class="n">' + list.length + '</span>'
          + (col.key === 'needs_now' || col.key === 'quiet' ? '' : '<button type="button" class="x" data-del-col="' + esc(col.key) + '" aria-label="Delete">x</button>')
          + '</div>'
          + (band ? '<div class="emx-band">' + esc(band) + '</div>' : '')
          + '<div class="emx-list">' + (list.length ? list.map(function (row) {
            var vc = (row.tags || []).indexOf('VC') >= 0;
            return '<article class="emx-card" draggable="true" data-mail="' + esc(row.id) + '"><span class="av' + (vc ? ' vc' : '') + '">' + esc(initials(row.from)) + '</span><div><div class="su">' + esc(row.from || row.email || 'Sender') + '</div><div class="sj">' + esc(row.subject || '(no subject)') + '</div><div class="sn">' + esc(row.preview || row.snippet || '') + '</div></div><div>' + (row.unread ? '<span class="dot"></span>' : '') + '<div class="age">' + esc(ageOf(row.at)) + '</div></div>'
              + ((row.tags || []).length ? '<div class="emx-tags">' + row.tags.map(function (tag) { return '<span class="' + (tag === 'Needs reply' ? 'hot' : tag === 'VC' ? 'ok' : '') + '">' + esc(tag) + '</span>'; }).join('') + '</div>' : '')
              + '</article>';
          }).join('') : '<div class="kick" style="padding:8px">None in this column.</div>') + '</div><div class="emx-cw" data-col-w="' + esc(col.key) + '"></div></section>';
      }).join('') + '<button type="button" class="emx-addcol" id="emxAddCol" title="New column">+</button></div>';
    bindBoard();
  }

  function bindBoard() {
    var find = document.getElementById('emxFind');
    if (find) {
      find.oninput = function () {
        MAIL.q = find.value;
        var needle = MAIL.q.toLowerCase();
        document.querySelectorAll('.emx-card').forEach(function (card) {
          var id = card.getAttribute('data-mail');
          var row = (MAIL.messages || []).filter(function (m) { return m.id === id; })[0];
          var blob = row ? (row.from + ' ' + row.email + ' ' + row.subject + ' ' + (row.snippet || '')).toLowerCase() : '';
          card.hidden = !!(needle && blob.indexOf(needle) < 0);
        });
      };
      find.onkeydown = function (e) {
        if (e.key === 'Enter') { e.preventDefault(); MAIL.q = find.value; loadMailBoard(true); }
      };
    }
    var filters = document.getElementById('emxFilters');
    if (filters) filters.onclick = function () { MAIL.filters = !MAIL.filters; paintBoard(); };
    var compose = document.getElementById('emxCompose');
    if (compose) compose.onclick = function () { openCompose('', '', ''); };
    ['emxNewRule', 'emxNewRuleTop'].forEach(function (id) {
      var btn = document.getElementById(id);
      if (btn) btn.onclick = openRule;
    });
    document.querySelectorAll('[data-del-rule]').forEach(function (btn) {
      btn.onclick = function () {
        authFetch('/api/mail/rules', { method: 'POST', quiet: true, credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ delete: btn.getAttribute('data-del-rule') }) }).then(function (r) { return r.json(); }).then(function (d) {
          if (d && d.rules) MAIL.rules = d.rules;
          paintBoard();
        }).catch(function () {});
      };
    });
    document.querySelectorAll('[data-col-name]').forEach(function (input) {
      input.onchange = function () {
        authFetch('/api/mail/columns', { method: 'POST', quiet: true, credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'rename', key: input.getAttribute('data-col-name'), name: input.value }) }).then(function (r) { return r.json(); }).then(function (d) {
          if (d && d.columns) MAIL.columns = d.columns;
        }).catch(function () {});
      };
    });
    document.querySelectorAll('[data-del-col]').forEach(function (btn) {
      btn.onclick = function (e) {
        e.stopPropagation();
        if (!confirm('Delete this column? Mail in it moves to Prospects.')) return;
        authFetch('/api/mail/columns', { method: 'POST', quiet: true, credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'delete', key: btn.getAttribute('data-del-col') }) }).then(function (r) { return r.json(); }).then(function (d) {
          if (d && d.columns) MAIL.columns = d.columns;
          paintBoard();
        }).catch(function () {});
      };
    });
    var add = document.getElementById('emxAddCol');
    if (add) add.onclick = function () {
      var name = prompt('Column name');
      if (!name) return;
      authFetch('/api/mail/columns', { method: 'POST', quiet: true, credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'create', name: name }) }).then(function (r) { return r.json(); }).then(function (d) {
        if (d && d.columns) MAIL.columns = d.columns;
        paintBoard();
      }).catch(function () {});
    };
    document.querySelectorAll('.emx-card').forEach(function (card) {
      card.ondragstart = function (e) { e.dataTransfer.setData('text', card.getAttribute('data-mail')); };
      card.onclick = function () { openReader(card.getAttribute('data-mail')); };
    });
    document.querySelectorAll('.emx-col').forEach(function (col) {
      col.ondragover = function (e) { e.preventDefault(); col.classList.add('on'); };
      col.ondragleave = function () { col.classList.remove('on'); };
      col.ondrop = function (e) {
        e.preventDefault();
        col.classList.remove('on');
        var id = e.dataTransfer.getData('text');
        var key = col.getAttribute('data-col');
        if (id && id.indexOf('col:') === 0) {
          reorderCols(id.slice(4), key);
          return;
        }
        moveMail(id, key, true);
      };
      var hd = col.querySelector('.hd');
      if (hd) hd.ondragstart = function (e) { e.dataTransfer.setData('text', 'col:' + col.getAttribute('data-col')); };
    });
    document.querySelectorAll('[data-col-w]').forEach(function (h) {
      h.onpointerdown = function (e) {
        if (e.button !== 0) return;
        e.preventDefault();
        var key = h.getAttribute('data-col-w');
        var col = h.parentNode;
        var x0 = e.clientX;
        var w0 = col.getBoundingClientRect().width;
        var move = function (ev) {
          var w = Math.max(200, Math.min(560, Math.round(w0 + ev.clientX - x0)));
          col.style.flexBasis = w + 'px';
          col._w = w;
        };
        var up = function () {
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', up);
          authFetch('/api/mail/columns', { method: 'POST', quiet: true, credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'width', key: key, width: col._w || w0 }) }).catch(function () {});
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
      };
    });
  }

  function reorderCols(from, to) {
    var keys = (MAIL.columns || []).map(function (c) { return c.key; });
    var i = keys.indexOf(from);
    var j = keys.indexOf(to);
    if (i < 0 || j < 0 || i === j) return;
    keys.splice(j, 0, keys.splice(i, 1)[0]);
    MAIL.columns.sort(function (a, b) { return keys.indexOf(a.key) - keys.indexOf(b.key); });
    paintBoard();
    authFetch('/api/mail/columns', { method: 'POST', quiet: true, credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'reorder', keys: keys }) }).catch(function () {});
  }

  function moveMail(id, column, sticky) {
    var row = (MAIL.messages || []).filter(function (m) { return m.id === id; })[0];
    if (!row || !column) return;
    row.column = column;
    if (column === 'needs_now') row.needsNow = true;
    paintBoard();
    authFetch('/api/mail/act', { method: 'POST', quiet: true, credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'move', id: id, column: column, sticky: !!sticky, email: row.email, matchType: 'sender' }) }).then(function () {
      if (sticky) return authFetch('/api/mail/rules', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (d) { if (d && d.rules) MAIL.rules = d.rules; paintBoard(); });
    }).catch(function () {});
  }

  function openRule() {
    var cols = (MAIL.columns || []).map(function (c) { return '<option value="' + esc(c.key) + '">' + esc(c.name) + '</option>'; }).join('');
    var card = document.getElementById('modalCard');
    var modal = document.getElementById('modal');
    if (!card || !modal) return;
    card.innerHTML = '<div class="mhd"><div style="font-weight:700">New rule</div><button class="x" id="mClose" type="button">x</button></div><div class="mbd"><label>Match<select id="emxMt"><option value="sender">From sender</option><option value="domain">From domain</option><option value="subject">Subject contains</option></select></label><label>Value<input id="emxMv" type="text" placeholder="name@ or domain or words"/></label><label>File into<select id="emxTg">' + cols + '</select></label><label><input id="emxSt" type="checkbox" checked/> Always apply to future mail (sticky)</label><div class="cap"><button class="btn pri sm" type="button" id="emxSaveRule">Save rule</button></div></div>';
    modal.classList.add('open');
    modal.hidden = false;
    document.getElementById('mClose').onclick = function () { if (typeof closeModal === 'function') closeModal(); };
    document.getElementById('emxSaveRule').onclick = function () {
      authFetch('/api/mail/rules', { method: 'POST', quiet: true, credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ matchType: document.getElementById('emxMt').value, matchValue: document.getElementById('emxMv').value, target: document.getElementById('emxTg').value, sticky: document.getElementById('emxSt').checked }) }).then(function (r) { return r.json(); }).then(function (d) {
        if (d && d.rules) MAIL.rules = d.rules;
        if (typeof closeModal === 'function') closeModal();
        paintBoard();
      }).catch(function () {});
    };
  }

  function openCompose(to, subject, text) {
    var card = document.getElementById('modalCard');
    var modal = document.getElementById('modal');
    if (!card || !modal) return;
    card.classList.add('wide');
    card.innerHTML = '<div class="mhd"><div style="font-weight:700">Compose</div><button class="x" id="mClose" type="button">x</button></div><div class="mbd rpx"><label>To<input id="emxTo" type="text" value="' + esc(to || '') + '"/></label><label>Subject<input id="emxSub" type="text" value="' + esc(subject || '') + '"/></label><label>Message<textarea id="emxBody" rows="9">' + esc(text || '') + '</textarea></label><div class="rpa"><span id="emxNote"></span><button class="btn pri" type="button" id="emxSend">Send</button></div></div>';
    modal.classList.add('open');
    modal.hidden = false;
    document.getElementById('mClose').onclick = function () { if (typeof closeModal === 'function') closeModal(); };
    document.getElementById('emxSend').onclick = function () {
      var note = document.getElementById('emxNote');
      authFetch('/api/mail/act', { method: 'POST', quiet: true, credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'compose', to: document.getElementById('emxTo').value, subject: document.getElementById('emxSub').value, text: document.getElementById('emxBody').value }) }).then(function (r) { return r.json(); }).then(function (d) {
        if (d && d.ok) { if (typeof closeModal === 'function') closeModal(); if (typeof deskNote === 'function') deskNote(d.drafted ? 'Saved to Gmail drafts.' : 'Sent.'); return; }
        if (note) note.textContent = d && d.status === 403 ? 'Reconnect Google in Integrations to send.' : 'Gmail did not take that send.';
      }).catch(function () { if (note) note.textContent = 'Gmail did not take that send.'; });
    };
  }

  function paintReader() {
    var el = document.getElementById('emailReader');
    if (!el) return;
    var row = MAIL.open;
    if (!row) { el.hidden = true; return; }
    var thread = MAIL.thread;
    var assist = MAIL.assist || { who: '', asking: '', reply: '' };
    var contact = MAIL.contact;
    var bits = initials(row.from);
    var chips = [];
    if (contact && contact.name) chips.push('Contact');
    if (contact && contact.category) chips.push(contact.category);
    if (contact && contact.company) chips.push(contact.company);
    var body = thread && thread.text ? thread.text : (row.snippet || '');
    el.hidden = false;
    el.style.width = readerWidth() + 'px';
    el.innerHTML = '<div class="emx-rh" id="emxRh" title="Drag to resize"></div>'
      + '<div class="emx-rhead"><span class="av">' + esc(bits) + '</span><div><div class="su">' + esc(row.from || 'Sender') + '</div><div class="sj">' + esc((thread && thread.subject) || row.subject || '') + '</div><div class="meta">' + esc(row.email || '') + (row.at ? ' · ' + esc(ageOf(row.at)) + ' ago' : '') + '</div></div><button type="button" class="x" id="emxClose" aria-label="Close">x</button></div>'
      + (chips.length ? '<div class="emx-chips">' + chips.map(function (c) { return '<span>' + esc(c) + '</span>'; }).join('') + '</div>' : '')
      + '<div class="emx-assist"><div class="k">4orm Intelligence</div><div class="row"><b>Who:</b> ' + esc(assist.who || 'Not in Contacts yet.') + '</div><div class="row"><b>Asking:</b> ' + esc(assist.asking || row.subject || '') + '</div><div class="draft" id="emxDraft">' + esc(assist.reply || '') + '</div></div>'
      + '<div class="emx-body"><div class="msg"><div class="who">' + esc(row.from || '') + '</div>' + esc(body) + '</div></div>'
      + '<div class="emx-reply" hidden id="emxReplyBox"><textarea id="emxReply" placeholder="Write a reply"></textarea><div class="emx-acts" style="padding:0;border:0;background:transparent"><button type="button" class="btn pri" id="emxSendReply">Send reply</button></div></div>'
      + '<div class="emx-acts"><button type="button" class="btn pri" id="emxReply">Reply</button><button type="button" class="btn" id="emxSpace">Add to Space</button><button type="button" class="btn" id="emxTask">Create task</button><button type="button" class="btn" id="emxSnooze">Snooze</button><button type="button" class="btn" id="emxMove">Move column</button><button type="button" class="btn" id="emxPromote">Promote in pipeline</button><button type="button" class="btn" id="emxDone">Mark done</button></div>';
    bindReader();
  }

  function bindReader() {
    var close = document.getElementById('emxClose');
    if (close) close.onclick = function () { MAIL.open = null; document.getElementById('emailReader').hidden = true; };
    var rh = document.getElementById('emxRh');
    if (rh) rh.onpointerdown = function (e) {
      if (e.button !== 0) return;
      e.preventDefault();
      var x0 = e.clientX;
      var w0 = readerWidth();
      var move = function (ev) { setReaderWidth(w0 - (ev.clientX - x0)); };
      var up = function () { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    };
    var reply = document.getElementById('emxReply');
    if (reply) reply.onclick = function () {
      var box = document.getElementById('emxReplyBox');
      var area = document.getElementById('emxReply');
      if (box) box.hidden = false;
      if (area) { area.value = (MAIL.assist && MAIL.assist.reply) || ''; area.focus(); }
    };
    var send = document.getElementById('emxSendReply');
    if (send) send.onclick = function () {
      var row = MAIL.open;
      var area = document.getElementById('emxReply');
      if (!row || !area) return;
      authFetch('/api/mail/act', { method: 'POST', quiet: true, credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'reply', to: row.email, subject: row.subject, text: area.value, threadId: row.threadId, messageId: row.messageId }) }).then(function (r) { return r.json(); }).then(function (d) {
        if (typeof deskNote === 'function') deskNote(d && d.ok ? (d.drafted ? 'Saved to Gmail drafts.' : 'Sent.') : (d && d.status === 403 ? 'Reconnect Google in Integrations to send.' : 'Gmail did not take that send.'));
      }).catch(function () {});
    };
    var task = document.getElementById('emxTask');
    if (task) task.onclick = function () {
      var row = MAIL.open;
      if (row && typeof saveItem === 'function') saveItem('Reply to ' + (row.from || row.email) + ' - ' + (row.subject || ''), 'today');
    };
    var snooze = document.getElementById('emxSnooze');
    if (snooze) snooze.onclick = function () {
      var row = MAIL.open;
      if (!row) return;
      authFetch('/api/mail/act', { method: 'POST', quiet: true, credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'snooze', id: row.id, hours: 24 }) }).then(function () {
        MAIL.messages = (MAIL.messages || []).filter(function (m) { return m.id !== row.id; });
        MAIL.open = null;
        document.getElementById('emailReader').hidden = true;
        paintBoard();
      }).catch(function () {});
    };
    var done = document.getElementById('emxDone');
    if (done) done.onclick = function () {
      var row = MAIL.open;
      if (!row) return;
      authFetch('/api/mail/act', { method: 'POST', quiet: true, credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'done', id: row.id }) }).then(function () {
        MAIL.messages = (MAIL.messages || []).filter(function (m) { return m.id !== row.id; });
        MAIL.open = null;
        document.getElementById('emailReader').hidden = true;
        paintBoard();
      }).catch(function () {});
    };
    var move = document.getElementById('emxMove');
    if (move) move.onclick = function () {
      var names = (MAIL.columns || []).map(function (c) { return c.name; }).join(', ');
      var pick = prompt('Move to column', names);
      if (!pick) return;
      var col = (MAIL.columns || []).filter(function (c) { return c.name.toLowerCase() === String(pick).toLowerCase() || c.key === pick; })[0];
      if (col && MAIL.open) moveMail(MAIL.open.id, col.key, false);
    };
    var space = document.getElementById('emxSpace');
    if (space) space.onclick = function () {
      var row = MAIL.open;
      var rows = STATE.packages || [];
      var card = document.getElementById('modalCard');
      var modal = document.getElementById('modal');
      if (!card || !modal || !row) return;
      card.innerHTML = '<div class="mhd"><div style="font-weight:700">Add to a Space</div><button class="x" id="mClose" type="button">x</button></div><div class="mbd">' + (rows.length ? rows.map(function (s) { return '<button type="button" class="ops-row" data-emx-space="' + esc(s.id) + '"><b>' + esc(s.name || 'Space') + '</b></button>'; }).join('') : '<div class="kick">No spaces yet.</div>') + '</div>';
      modal.classList.add('open');
      modal.hidden = false;
      document.getElementById('mClose').onclick = function () { if (typeof closeModal === 'function') closeModal(); };
      card.querySelectorAll('[data-emx-space]').forEach(function (btn) {
        btn.onclick = function () {
          authFetch('/api/spaces/' + btn.getAttribute('data-emx-space'), { method: 'POST', quiet: true, credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'add-recipient', name: row.from, email: row.email, listed: false }) }).then(function () { if (typeof closeModal === 'function') closeModal(); }).catch(function () {});
        };
      });
    };
    var promote = document.getElementById('emxPromote');
    if (promote) promote.onclick = function () {
      if (typeof switchView === 'function') switchView('contacts');
    };
  }

  function openReader(id) {
    var row = (MAIL.messages || []).filter(function (m) { return m.id === id; })[0];
    if (!row) return;
    MAIL.open = row;
    MAIL.thread = null;
    MAIL.assist = null;
    MAIL.contact = null;
    paintReader();
    if (row.unread) {
      row.unread = false;
      authFetch('/api/mail/act', { method: 'POST', quiet: true, credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'read', id: row.id }) }).catch(function () {});
    }
    authFetch('/api/mail/thread?id=' + encodeURIComponent(id), { credentials: 'same-origin', quiet: true }).then(function (r) { return r.json(); }).then(function (d) {
      if (!MAIL.open || MAIL.open.id !== id) return;
      MAIL.thread = d && d.thread;
      MAIL.assist = d && d.assist;
      MAIL.contact = d && d.contact;
      paintReader();
    }).catch(function () {});
  }

  function loadMailBoard(refresh) {
    var el = document.getElementById('emailDesk');
    if (!el) return;
    if (!MAIL.messages.length) el.innerHTML = '<div class="quiet">Reading Gmail...</div>';
    var q = MAIL.q ? '&q=' + encodeURIComponent(MAIL.q) : '';
    authFetch('/api/mail/board' + (refresh || q ? '?refresh=1' : '') + q, { credentials: 'same-origin', quiet: true }).then(function (r) { return r.json(); }).then(function (d) {
      MAIL.messages = (d && d.messages) || [];
      MAIL.columns = (d && d.columns) || MAIL.columns;
      MAIL.rules = (d && d.rules) || [];
      MAIL.counts = (d && d.counts) || { unread: 0, needs: 0, total: 0 };
      MAIL.status = (d && d.status) || '';
      paintBoard();
    }).catch(function () {
      if (!MAIL.messages.length) {
        var desk = document.getElementById('emailDesk');
        if (desk) desk.innerHTML = '<div class="quiet">Gmail could not be read. Try again in a moment.</div>';
      }
    });
  }

  window.loadMailBoard = loadMailBoard;
})();
