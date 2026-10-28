/* Contacts / Lists — design 28 call list rows, stages, callbacks, spaces. */
(function () {
  var STAGES = [
    { k: 'Reach out', hint: 'no contact yet', color: '#a3b0d2', bg: 'rgba(163,176,210,.12)' },
    { k: 'Contacted', hint: '', color: '#8dbaff', bg: 'rgba(59,130,255,.16)' },
    { k: 'Emailed', hint: '', color: '#c4a8ff', bg: 'rgba(161,115,255,.16)' },
    { k: 'Send package', hint: 'to-do', color: '#ffd08a', bg: 'rgba(255,181,71,.16)' },
    { k: 'Book meeting', hint: 'to-do', color: '#ff9fc4', bg: 'rgba(255,77,141,.16)' },
    { k: 'Meeting booked', hint: '', color: '#7ff0c2', bg: 'rgba(25,211,138,.16)' },
  ];

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  }

  function notePreview(text) {
    var lines = String(text || '').replace(/\r/g, '').split(/\n+/).map(function (l) { return l.trim(); }).filter(Boolean);
    return lines.slice(0, 2).join(' ');
  }

  function stageIndex(name) {
    var n = String(name || '').trim().toLowerCase();
    if (!n || /cold|new|open|reach/.test(n)) return 0;
    for (var i = 0; i < STAGES.length; i++) {
      if (STAGES[i].k.toLowerCase() === n) return i;
    }
    if (/contact/.test(n)) return 1;
    if (/email/.test(n)) return 2;
    if (/package|send/.test(n)) return 3;
    if (/book/.test(n) && !/booked/.test(n)) return 4;
    if (/meeting|booked|won/.test(n)) return 5;
    return 0;
  }

  function parseCsv(text) {
    var rows = [];
    var i = 0;
    var cur = '';
    var row = [];
    var q = false;
    var s = String(text || '').replace(/^\uFEFF/, '');
    while (i < s.length) {
      var ch = s[i];
      if (q) {
        if (ch === '"' && s[i + 1] === '"') { cur += '"'; i += 2; continue; }
        if (ch === '"') { q = false; i += 1; continue; }
        cur += ch; i += 1; continue;
      }
      if (ch === '"') { q = true; i += 1; continue; }
      if (ch === ',') { row.push(cur); cur = ''; i += 1; continue; }
      if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; i += 1; continue; }
      if (ch === '\r') { i += 1; continue; }
      cur += ch; i += 1;
    }
    row.push(cur);
    if (row.some(function (c) { return String(c).trim(); })) rows.push(row);
    return rows;
  }

  function mapCsvRows(raw) {
    if (!raw.length) return { name: 'Uploaded list', rows: [] };
    var header = raw[0].map(function (h) { return String(h || '').trim().toLowerCase(); });
    var hasHeader = header.some(function (h) {
      return /^(name|full.?name|person|company|org|phone|tel|email|e-?mail|notes?|city|location)$/.test(h);
    });
    var cols = hasHeader ? header : [];
    var start = hasHeader ? 1 : 0;
    function idx(keys) {
      for (var k = 0; k < keys.length; k++) {
        var i = cols.indexOf(keys[k]);
        if (i >= 0) return i;
      }
      return -1;
    }
    var iName = idx(['name', 'full name', 'person', 'contact']);
    var iCo = idx(['company', 'org', 'organisation', 'organization', 'firm']);
    var iPhone = idx(['phone', 'tel', 'mobile', 'cell']);
    var iEmail = idx(['email', 'e-mail', 'mail']);
    var iNotes = idx(['notes', 'note', 'comment', 'comments']);
    var iCity = idx(['city', 'location', 'base']);
    if (!hasHeader) {
      iName = 0; iCo = 1; iPhone = 2; iEmail = 3; iNotes = 4; iCity = 5;
    }
    var out = [];
    for (var r = start; r < raw.length; r++) {
      var cells = raw[r];
      var get = function (ix) { return ix >= 0 ? String(cells[ix] || '').trim() : ''; };
      var email = get(iEmail);
      var name = get(iName);
      if (!name && !email) continue;
      out.push({
        name: name,
        company: get(iCo),
        phone: get(iPhone),
        email: email,
        notes: get(iNotes),
        city: get(iCity),
      });
    }
    return { name: 'Uploaded list', rows: out };
  }

  window.bindOutreachLists = function (root, opts) {
    if (!root) return;
    opts = opts || {};
    var startMode = (opts.mode === 'contacts' || (window.STATE && window.STATE.peopleTab === 'contacts')) ? 'contacts' : 'lists';
    var state = {
      lists: [],
      contacts: null,
      role: 'all',
      cur: null,
      q: '',
      filt: 'all',
      mode: startMode,
      undo: null,
      loading: true,
    };
    /* The page repaints (live updates, drawer closing). Keep the chosen list, role, filter and search across repaints
       so the view never jumps back to the first list. */
    var KEEP = window.__listsKeep = window.__listsKeep || {};
    if (KEEP.role) state.role = KEEP.role;
    if (KEEP.filt) state.filt = KEEP.filt;
    if (KEEP.q) state.q = KEEP.q;
    function pickCur(lists) {
      var want = KEEP.cur;
      return (want && lists.find(function (l) { return l.key === want; })) || (state.cur && lists.find(function (l) { return l.key === state.cur.key; })) || lists[0] || null;
    }

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
    function closePop() { var p = $('#pop'); if (p) p.classList.remove('on'); }
    function openPop() { var p = $('#pop'); if (p) p.classList.add('on'); }
    function hideMinis() {
      var s = $('#smenu'); var c = $('#cbmini');
      if (s) s.classList.remove('on');
      if (c) c.classList.remove('on');
    }

    function api(path, opts) {
      opts = opts || {};
      var init = { credentials: 'include', headers: {}, quiet: true };
      if (opts.method) init.method = opts.method;
      if (opts.body) {
        init.headers['content-type'] = 'application/json';
        init.body = JSON.stringify(opts.body);
      }
      var fn = typeof window.authFetch === 'function' ? window.authFetch : fetch;
      return fn(path, init).then(function (r) {
        return r.json().catch(function () { return null; }).then(function (d) {
          return { ok: r.ok, status: r.status, data: d };
        });
      });
    }

    function companyLine(p) {
      var bits = [p.company, p.city || p.companySub].filter(Boolean);
      var seen = {};
      return bits.filter(function (b) {
        var k = String(b).toLowerCase();
        if (seen[k]) return false;
        seen[k] = 1;
        return true;
      }).join(' · ');
    }

    function peopleOf() {
      if (!state.cur) return [];
      var rows = (state.cur.people || []).slice().filter(function (p) { return !p._del; });
      if (state.q) {
        var q = state.q;
        rows = rows.filter(function (p) {
          return (p.name + ' ' + p.company + ' ' + p.email + ' ' + p.phone + ' ' + (p.notes || '') + ' ' + (p.role || '')).toLowerCase().indexOf(q) >= 0;
        });
      }
      rows = rows.filter(function (p) {
        var g = stageIndex(p.stage);
        if (state.filt === 's0') return g === 0 && !p.callback;
        if (state.filt === 's5') return g === 5;
        if (state.filt === 'prog') return g > 0 && g < 5;
        if (state.filt === 'cb') return !!p.callback;
        return true;
      });
      return rows;
    }

    function openSpaceById(id) {
      if (!id || typeof window.__openSpacePanel !== 'function') return;
      var el = document.createElement('div');
      el.setAttribute('data-id', id);
      el.setAttribute('data-space', id);
      window.__openSpacePanel(el, root);
    }

    function openOrStartSpace(person) {
      var id = person && (person.spaceId || person.space_id);
      if (id) { openSpaceById(id); return; }
      var name = (person && person.name) || 'Space';
      var contactId = String((person && (person.contactId || person.id)) || '');
      var nameKey = String(name).trim().toLowerCase();
      /* Never create a duplicate — match by contact id or exact name first. */
      api('/api/spaces').then(function (listed) {
        var packs = (listed.data && (listed.data.packages || listed.data.spaces || listed.data.items)) || [];
        var hit = packs.find(function (s) {
          var sid = String(s.contactId || s.contact_id || '');
          var sn = String(s.name || s.title || '').trim().toLowerCase();
          return (contactId && sid && sid === contactId) || (nameKey && sn === nameKey);
        });
        if (hit && hit.id) {
          person.spaceId = hit.id;
          render();
          openSpaceById(hit.id);
          return;
        }
        return api('/api/spaces', { method: 'POST', body: { name: name, contactId: contactId } }).then(function (r) {
          if (!r.ok || !r.data || !r.data.id) {
            toast('Could not start a space for ' + name);
            return;
          }
          person.spaceId = r.data.id;
          toast('Started a space called ' + name);
          render();
          openSpaceById(r.data.id);
        });
      });
    }

    function clearStageTodos(person) {
      var titles = [
        'Send package to ' + person.name,
        'Book a meeting with ' + person.name,
      ];
      titles.forEach(function (title) {
        api('/api/items', { method: 'POST', body: { title: title, status: 'done', bucket: 'today', category: 'call-list' } }).catch(function () {});
      });
    }

    function addStageTodo(person, stageIx) {
      if (stageIx !== 3 && stageIx !== 4) return;
      var title = (stageIx === 3 ? 'Send package to ' : 'Book a meeting with ') + person.name;
      api('/api/items', { method: 'POST', body: { title: title, bucket: 'today', area: 'outreach', category: 'call-list' } }).then(function (r) {
        if (r.ok) toast('Added to your To do: ' + title);
      });
    }

    function setStage(person, stageIx) {
      var prev = person.stage;
      var next = STAGES[stageIx] ? STAGES[stageIx].k : 'Reach out';
      person.stage = next;
      clearStageTodos(person);
      if (stageIx === 3 || stageIx === 4) addStageTodo(person, stageIx);
      render();
      var contactId = person.contactId || '';
      var reachId = person.id || contactId;
      api('/api/reach-out/' + encodeURIComponent(reachId), {
        method: 'PATCH',
        body: { stage: next, contactId: contactId },
      }).then(function (r) {
        if (!r.ok) {
          person.stage = prev;
          render();
          toast('Could not save stage');
        }
      });
    }

    function contactsAsList() {
      var people = (state.contacts && state.contacts.people) || [];
      if (state.role && state.role !== 'all' && state.role !== 'cold' && state.role !== 'cb') {
        people = people.filter(function (p) {
          return String(p.role || '').toLowerCase().indexOf(String(state.role).toLowerCase()) >= 0
            || String(p.category || '').toLowerCase() === String(state.role).toLowerCase();
        });
      }
      if (state.role === 'cold') {
        people = people.filter(function (p) { return !!p.cold; });
      }
      if (state.role === 'cb') {
        people = people.filter(function (p) { return !!p.callback; });
      }
      return { key: 'contacts', name: 'All people', people: people, count: people.length };
    }

    function renderNav() {
      var listsEl = $('#llists');
      var rolesEl = $('#lroles');
      if (listsEl) listsEl.style.display = state.mode === 'lists' ? '' : 'none';
      if (rolesEl) rolesEl.style.display = state.mode === 'contacts' ? '' : 'none';
      var nav = $('#listnav');
      if (nav && state.mode === 'lists') {
        nav.innerHTML = state.lists.map(function (l) {
          var on = state.cur && state.cur.key === l.key;
          return '<button type="button" class="' + (on ? 'on' : '') + '" data-l="' + esc(l.key) + '"' + (l.file ? ' title="' + esc(l.file) + '"' : '') + '><span style="display:flex;flex-direction:column;min-width:0;text-align:left"><span>' + esc(l.name) + '</span>' + (l.kind === 'uploaded' ? '<em style="font-style:normal;font-size:11px;font-weight:600;color:#a3b0d2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(l.file || l.sub || 'uploaded list') + '</em>' : '') + '</span><small>' + esc(String(l.count || 0)) + '</small></button>';
        }).join('') || (state.loading ? '<button type="button"><b>Loading lists</b><small>—</small></button>' : '');
        nav.querySelectorAll('button[data-l]').forEach(function (el) {
          el.onclick = function () {
            state.cur = state.lists.find(function (l) { return l.key === el.getAttribute('data-l'); }) || state.lists[0];
            render();
          };
        });
      }
      var rnav = $('#rolenav');
      if (rnav && state.mode === 'contacts') {
        var all = (state.contacts && state.contacts.people) || [];
        var roles = [
          ['all', 'All people', all.length],
          ['VC', 'VCs', all.filter(function (p) { return /vc/i.test(p.role || p.category || ''); }).length],
          ['Angel', 'Angels', all.filter(function (p) { return /angel/i.test(p.role || p.category || ''); }).length],
          ['Strategic', 'Strategic', all.filter(function (p) { return /strateg/i.test(p.role || p.category || ''); }).length],
          ['Design partner', 'Design partners', all.filter(function (p) { return /design/i.test(p.role || p.category || ''); }).length],
          ['Regulator', 'Regulators', all.filter(function (p) { return /regulat/i.test(p.role || p.category || ''); }).length],
        ];
        var smart = [
          ['cold', 'Going cold', all.filter(function (p) { return !!p.cold; }).length],
          ['cb', 'Callbacks due', all.filter(function (p) { return !!p.callback; }).length],
        ];
        rnav.innerHTML = roles.map(function (r) {
          return '<button type="button" class="' + (state.role === r[0] ? 'on' : '') + '" data-r="' + esc(r[0]) + '">' + esc(r[1]) + '<small>' + r[2] + '</small></button>';
        }).join('') + '<h6 style="margin-top:12px">SMART LISTS</h6>' + smart.map(function (r) {
          return '<button type="button" class="' + (state.role === r[0] ? 'on' : '') + '" data-r="' + esc(r[0]) + '">' + esc(r[1]) + '<small>' + r[2] + '</small></button>';
        }).join('');
        rnav.querySelectorAll('button[data-r]').forEach(function (el) {
          el.onclick = function () {
            state.role = el.getAttribute('data-r') || 'all';
            state.cur = contactsAsList();
            render();
          };
        });
      }
    }

    function showStageMenu(btn, person) {
      var m = $('#smenu');
      if (!m) return;
      var b = btn.getBoundingClientRect();
      m.style.left = Math.min(b.left, window.innerWidth - 240) + 'px';
      m.style.top = (b.bottom + 6) + 'px';
      m.innerHTML = '<b>Stage</b>' + STAGES.map(function (S, j) {
        return '<button type="button" data-s="' + j + '" style="color:' + S.color + '">' + esc(S.k)
          + (j === 3 || j === 4 ? ' <small>adds a to-do</small>' : '') + '</button>';
      }).join('');
      m.classList.add('on');
      m.onclick = function (ev) {
        var bt = ev.target.closest('button[data-s]');
        if (!bt) return;
        m.classList.remove('on');
        setStage(person, +bt.getAttribute('data-s'));
      };
    }

    function showCallbackMenu(btn, person) {
      var m = $('#cbmini');
      if (!m) return;
      var b = btn.getBoundingClientRect();
      m.style.left = Math.max(8, b.left - 80) + 'px';
      m.style.top = (b.bottom + 6) + 'px';
      m.classList.add('on');
      m.onclick = function (ev) {
        var bt = ev.target.closest('button[data-when]');
        if (!bt) return;
        var when = bt.getAttribute('data-when');
        m.classList.remove('on');
        if (when === 'pick') {
          var raw = window.prompt('Call back when? (Vancouver time)', 'tomorrow 09:00');
          if (!raw) return;
          when = raw;
        }
        person.callback = when;
        render();
        api('/api/reach-out/' + encodeURIComponent(person.id), {
          method: 'PATCH',
          body: { callback: when, contactId: person.contactId || '' },
        }).then(function (r) {
          if (!r.ok) toast('Could not save callback');
          else {
            api('/api/items', {
              method: 'POST',
              body: { title: 'Call back ' + person.name, bucket: 'today', area: 'outreach', category: 'callback' },
            }).catch(function () {});
          }
        });
      };
    }

    function softDeletePerson(person) {
      person._del = true;
      render();
      var isContact = state.mode === 'contacts' || !!(person.contactId && /^[0-9a-f-]{36}$/i.test(person.contactId));
      var path = isContact && person.contactId
        ? '/api/contacts/' + encodeURIComponent(person.contactId)
        : '/api/reach-out/' + encodeURIComponent(person.id);
      var body = isContact && person.contactId ? null : { deleted: true };
      var init = isContact && person.contactId
        ? { method: 'DELETE' }
        : { method: 'PATCH', body: body };
      api(path, init).then(function (r) {
        if (!r.ok) {
          person._del = false;
          render();
          toast('Could not delete');
          return;
        }
        toast((person.name || 'Person') + ' removed', function () {
          person._del = false;
          if (isContact && person.contactId) {
            api('/api/contacts/' + encodeURIComponent(person.contactId), { method: 'POST', body: { action: 'restore' } }).then(load);
          } else {
            api('/api/reach-out/' + encodeURIComponent(person.id), { method: 'PATCH', body: { deleted: false } }).then(load);
          }
          render();
        });
      });
    }

    function showPerson(p) {
      $('#pn').textContent = p.name || 'Person';
      $('#pm').textContent = companyLine(p) + (p.role ? ' · ' + p.role : '') + (p.stage ? ' · ' + p.stage : '');
      var phone = p.phone || '';
      var email = p.email || '';
      $('#pc').innerHTML = (phone ? '<a href="tel:' + esc(phone.replace(/\s+/g, '')) + '">Call ' + esc(phone) + '</a>' : '')
        + (email ? '<a href="mailto:' + esc(email) + '">Email ' + esc(email) + '</a>' : '');
      var en = $('#en'); var ec = $('#ec'); var ep = $('#ep'); var ee = $('#ee');
      if (en) en.value = p.name || '';
      if (ec) ec.value = p.company || '';
      if (ep) ep.value = phone;
      if (ee) ee.value = email;
      $('#pnotes').innerHTML = '<p>Loading notes…</p>';
      openPop();
      var openBtn = $('#popen');
      if (openBtn) {
        openBtn.textContent = (p.spaceId || p.space_id) ? 'Open space' : 'Start space';
        openBtn.onclick = function () { closePop(); openOrStartSpace(p); };
      }
      var emailBtn = $('#pemail');
      if (emailBtn) emailBtn.onclick = function () {
        if (email) window.location.href = 'mailto:' + email;
        if (stageIndex(p.stage) < 2) setStage(p, 2);
      };
      var noteAdd = $('#pnoteAdd');
      if (noteAdd) {
        noteAdd.value = '';
        noteAdd.onkeydown = function (e) {
          if (e.key !== 'Enter' || e.shiftKey) return;
          e.preventDefault();
          var text = String(noteAdd.value || '').trim();
          if (!text) return;
          noteAdd.value = '';
          var contactId = p.contactId || p.id;
          api('/api/contacts/' + encodeURIComponent(contactId), {
            method: 'PATCH',
            body: { note: text },
          }).then(function (r) {
            if (!r.ok) { toast('Could not save note'); return; }
            p.notes = text + (p.notes ? '\n' + p.notes : '');
            showPerson(p);
          });
        };
      }
      api('/api/reach-out?notes=' + encodeURIComponent(p.id)).then(function (r) {
        var list = (r.data && r.data.notes) || [];
        if (!list.length && p.notes) list = [{ source: 'List', when: '', text: p.notes }];
        if (!list.length) {
          $('#pnotes').innerHTML = '<p><small>No notes yet.</small></p>';
          return;
        }
        $('#pnotes').innerHTML = list.map(function (n) {
          return '<p>' + esc(n.text).replace(/\n/g, '<br>') + '</p>'
            + '<small>' + esc(n.source) + (n.when ? ' · ' + esc(n.when) : '') + '</small>';
        }).join('');
      }).catch(function () {
        $('#pnotes').innerHTML = '<p>' + esc(p.notes || 'No notes yet.') + '</p>';
      });
    }

    function renderBody() {
      var body = $('#lbody');
      if (!body) return;
      if (state.loading && !(state.cur && state.cur.people && state.cur.people.length)) {
        body.innerHTML = '<tr><td colspan="6" style="padding:18px;color:#a3b0d2">Loading contacts…</td></tr>';
        return;
      }
      if (!state.cur) {
        body.innerHTML = '<tr><td colspan="6" style="padding:18px;color:#6f7fa6">No lists yet.</td></tr>';
        return;
      }
      var rows = peopleOf();
      var nextId = '';
      for (var i = 0; i < rows.length; i++) {
        if (stageIndex(rows[i].stage) === 0 && !rows[i].callback) { nextId = rows[i].id; break; }
      }
      body.innerHTML = rows.map(function (p) {
        var phone = p.phone || '';
        var email = p.email || '';
        var g = stageIndex(p.stage);
        var S = STAGES[g];
        var cls = 'r' + (p.id === nextId ? ' next' : '');
        var role = p.role ? '<span class="sp has">' + esc(p.role) + '</span>' : '';
        var cb = p.callback ? '<span class="cb">Call back ' + esc(p.callback) + '</span>' : '';
        var spaceLabel = (p.spaceId || p.space_id) ? 'Open space' : 'Start space';
        return '<tr class="' + cls + '" data-id="' + esc(p.id) + '">'
          + '<td><b>' + esc(p.name) + '</b><small>' + esc(companyLine(p)) + '</small>' + role + cb + '</td>'
          + '<td>' + (phone ? '<a href="tel:' + esc(phone.replace(/\s+/g, '')) + '">' + esc(phone) + '</a>' : '—') + '</td>'
          + '<td>' + (email ? '<a href="mailto:' + esc(email) + '">' + esc(email) + '</a>' : '<small>no email</small>') + '</td>'
          + '<td><span class="nt">' + (notePreview(p.notes) ? esc(notePreview(p.notes)) : '<small>no notes yet</small>') + '</span></td>'
          + '<td><button type="button" class="stg2" data-a="stage" style="color:' + S.color + ';background:' + S.bg + '">' + esc(S.k)
          + (S.hint ? '<small>' + esc(S.hint) + '</small>' : '') + '</button></td>'
          + '<td><div class="pills">'
          + '<button type="button" class="pl cbk" data-a="cb">Callback</button>'
          + '<button type="button" class="pl" data-a="email">Email</button>'
          + '<button type="button" class="pl go" data-a="space">' + spaceLabel + '</button>'
          + '<button type="button" class="pl del" data-a="del">Delete</button>'
          + '</div></td></tr>';
      }).join('') || '<tr><td colspan="6" style="padding:18px;color:#6f7fa6">Nobody on this list yet.</td></tr>';

      body.querySelectorAll('tr.r').forEach(function (tr) {
        tr.onclick = function (ev) {
          if (ev.target && ev.target.closest && ev.target.closest('a')) return;
          var p = (state.cur.people || []).find(function (x) { return x.id === tr.getAttribute('data-id'); });
          if (!p) return;
          var actEl = ev.target.closest && ev.target.closest('[data-a]');
          var a = actEl && actEl.getAttribute('data-a');
          if (a === 'stage') { ev.stopPropagation(); showStageMenu(actEl, p); return; }
          if (a === 'cb') { ev.stopPropagation(); showCallbackMenu(actEl, p); return; }
          if (a === 'email') {
            ev.stopPropagation();
            if (p.email) window.location.href = 'mailto:' + p.email;
            if (stageIndex(p.stage) < 2) setStage(p, 2);
            return;
          }
          if (a === 'space') { ev.stopPropagation(); openOrStartSpace(p); return; }
          if (a === 'del') { ev.stopPropagation(); softDeletePerson(p); return; }
          showPerson(p);
        };
      });
    }

    function render() {
      if (state.mode === 'contacts') state.cur = contactsAsList();
      else if (!state.cur && state.lists.length) state.cur = pickCur(state.lists);
      if (state.mode === 'lists' && state.cur && state.cur.key) KEEP.cur = state.cur.key;
      KEEP.role = state.role; KEEP.filt = state.filt; KEEP.q = state.q;
      renderNav();
      var name = $('#lname');
      var stat = $('#lstat');
      var prog = $('#lprog');
      if (name && state.cur) name.textContent = state.mode === 'contacts'
        ? (state.role === 'all' ? 'All people' : (state.role === 'cb' ? 'Callbacks due' : (state.role === 'cold' ? 'Going cold' : state.role)))
        : state.cur.name;
      if (stat && state.cur) {
        var people = (state.cur.people || []).filter(function (p) { return !p._del; });
        var moved = people.filter(function (p) { return stageIndex(p.stage) > 0; }).length;
        var booked = people.filter(function (p) { return stageIndex(p.stage) === 5; }).length;
        var cbs = people.filter(function (p) { return !!p.callback; }).length;
        stat.textContent = people.length + ' shown · ' + moved + ' reached · ' + booked + ' booked · ' + cbs + ' callbacks';
        if (prog) prog.style.width = (people.length ? (moved / people.length * 100) : 0) + '%';
      }
      renderBody();
    }

    function mapContactRow(c, spaces) {
      var spaceHit = (spaces || []).find(function (s) {
        return (c.id && String(s.contactId || s.contact_id) === String(c.id))
          || (c.email && String(s.email || '').toLowerCase() === String(c.email).toLowerCase());
      });
      var cb = '';
      if (/^call back\s+/i.test(String(c.nextAction || ''))) cb = String(c.nextAction).replace(/^call back\s+/i, '');
      var age = c.lastTouch ? Math.floor((Date.now() - Number(c.lastTouch)) / 86400000) : null;
      return {
        id: String(c.id),
        contactId: String(c.id),
        name: c.name || 'Untitled',
        company: c.company || '',
        role: c.role || c.category || '',
        category: c.category || '',
        phone: c.phone || '',
        email: c.email || '',
        notes: c.notes || '',
        stage: c.stage || 'Reach out',
        callback: cb,
        spaceId: spaceHit ? (spaceHit.spaceId || spaceHit.id) : (c.spaceId || ''),
        cold: age == null || age >= 21,
      };
    }

    function loadContacts() {
      state.loading = true;
      render();
      var boardPeople = [];
      try {
        if (typeof window.__peoplePage === 'object' && window.__peoplePage.liveContactsVm) {
          /* Prefer live board contacts already on the page when present. */
        }
        var s = window.STATE || {};
        var raw = s.contacts || s.people || s.boardContacts || [];
        if (Array.isArray(raw) && raw.length) boardPeople = raw;
        else if (s.board && Array.isArray(s.board.contacts)) boardPeople = s.board.contacts;
      } catch (e) {}
      return Promise.all([
        api('/api/contacts'),
        api('/api/reach-out?lists=1'),
      ]).then(function (pair) {
        var extras = (pair[0].data) || {};
        var spaces = extras.spaces || [];
        var lists = (pair[1].data && pair[1].data.lists) || [];
        state.lists = lists;
        if (window.STATE) window.STATE.peopleLists = lists;
        var fromLists = [];
        lists.forEach(function (l) {
          (l.people || []).forEach(function (p) {
            fromLists.push(p);
          });
        });
        var byKey = {};
        function put(p) {
          var k = String(p.contactId || p.id || p.email || p.name || '').toLowerCase();
          if (!k) return;
          if (!byKey[k]) byKey[k] = p;
        }
        boardPeople.forEach(function (c) { put(mapContactRow(c, spaces)); });
        fromLists.forEach(function (p) {
          put({
            id: p.id,
            contactId: p.contactId || p.id,
            name: p.name,
            company: p.company,
            role: p.role || '',
            phone: p.phone,
            email: p.email,
            notes: p.notes,
            stage: p.stage,
            callback: p.callback || '',
            spaceId: p.spaceId || p.space_id || '',
            cold: false,
          });
        });
        state.contacts = { people: Object.keys(byKey).map(function (k) { return byKey[k]; }) };
        state.loading = false;
        state.cur = contactsAsList();
        render();
        return state.contacts;
      }).catch(function () {
        state.loading = false;
        state.contacts = state.contacts || { people: [] };
        render();
        return state.contacts;
      });
    }

    function load() {
      if (state.mode === 'contacts') return loadContacts();
      state.loading = true;
      render();
      if (window.STATE && window.STATE.peopleLists && window.STATE.peopleLists.length && !state.lists.length) {
        state.lists = window.STATE.peopleLists;
        state.cur = pickCur(state.lists);
        state.loading = false;
        render();
      }
      return api('/api/reach-out?lists=1').then(function (r) {
        var lists = (r.data && r.data.lists) || [];
        state.lists = lists;
        state.loading = false;
        state.cur = pickCur(lists);
        if (window.STATE) window.STATE.peopleLists = lists;
        render();
        return lists;
      }).catch(function () {
        state.loading = false;
        if (!state.lists.length) state.lists = [];
        render();
        return state.lists;
      });
    }

    var search = $('#lsearch');
    if (search && state.q && !search.value) search.value = state.q;
    (function () { var fb = $('#lfilt'); if (!fb || !state.filt) return; fb.querySelectorAll('button[data-f]').forEach(function (x) { x.classList.toggle('on', x.getAttribute('data-f') === state.filt); }); })();
    if (search) search.oninput = function (e) { state.q = String(e.target.value || '').toLowerCase(); render(); };
    var filt = $('#lfilt');
    if (filt) filt.querySelectorAll('button[data-f]').forEach(function (b) {
      b.onclick = function () {
        state.filt = b.getAttribute('data-f') || 'all';
        filt.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); });
        render();
      };
    });
    var px = $('#px');
    if (px) px.onclick = closePop;
    var pop = $('#pop');
    if (pop) pop.onclick = function (e) { if (e.target === pop) closePop(); };
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { closePop(); hideMinis(); }
    });
    document.addEventListener('click', function (e) {
      if (!e.target.closest || (!e.target.closest('#cbmini') && !e.target.closest('[data-a=cb]'))) {
        var c = $('#cbmini'); if (c) c.classList.remove('on');
      }
      if (!e.target.closest || (!e.target.closest('#smenu') && !e.target.closest('[data-a=stage]'))) {
        var s = $('#smenu'); if (s) s.classList.remove('on');
      }
    });

    function startUpload() {
      var file = $('#csvFile');
      if (file) file.click();
    }
    var uploadBtn = $('#uploadList');
    if (uploadBtn) uploadBtn.onclick = startUpload;
    var csvFile = $('#csvFile');
    if (csvFile) csvFile.onchange = function () {
      var f = csvFile.files && csvFile.files[0];
      csvFile.value = '';
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function () {
        var parsed = mapCsvRows(parseCsv(String(reader.result || '')));
        if (!parsed.rows.length) { toast('No people found in that CSV'); return; }
        var base = String(f.name || 'Uploaded list').replace(/\.csv$/i, '');
        modal('<h3>Upload list</h3><p>Map name, company, phone, email and notes. Matching contacts by email.</p>'
          + '<input id="ulname" value="' + esc(base) + '">'
          + '<p style="margin-top:10px">' + parsed.rows.length + ' people ready.</p>'
          + '<div class="row" style="margin-top:12px;display:flex;gap:8px;justify-content:flex-end">'
          + '<button type="button" class="btn" id="ulcancel">Cancel</button>'
          + '<button type="button" class="btn pri" id="ulgo">Create list</button></div>');
        var c = $('#ulcancel'); var g = $('#ulgo');
        if (c) c.onclick = closeModal;
        if (g) g.onclick = function () {
          var nm = ($('#ulname') && $('#ulname').value) || base;
          closeModal();
          api('/api/reach-out', { method: 'POST', body: { action: 'upload-list', name: nm, file: f.name || '', rows: parsed.rows } }).then(function (r) {
            if (!r.ok) { toast('Could not upload that list'); return; }
            var id = r.data && r.data.id;
            toast('List uploaded · ' + ((r.data && r.data.matched) || 0) + ' matched by email', id ? function () {
              api('/api/reach-out', { method: 'POST', body: { action: 'delete-list', id: id } }).then(load);
            } : null);
            load().then(function (lists) {
              var hit = (lists || []).find(function (l) { return l.id === id || l.key === 'custom:' + id; });
              if (hit) { state.cur = hit; render(); }
            });
          });
        };
      };
      reader.readAsText(f);
    };

    root.addEventListener('contextmenu', function (ev) {
      var lc = ev.target && ev.target.closest && ev.target.closest('#listnav button[data-l]');
      if (!lc) return;
      var key = lc.getAttribute('data-l') || '';
      if (key.indexOf('custom:') !== 0) return;
      ev.preventDefault();
      var id = key.slice('custom:'.length);
      api('/api/reach-out', { method: 'POST', body: { action: 'delete-list', id: id } }).then(function (r) {
        if (!r.ok) { toast('Could not delete that list'); return; }
        toast('List removed', function () {
          api('/api/reach-out', { method: 'POST', body: { action: 'restore-list', id: id } }).then(load);
        });
        load();
      });
    });

    load();
  };
})();
