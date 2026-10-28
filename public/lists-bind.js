/* Contacts > Lists — design 27 Call lists, fed by /api/reach-out */
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

  function notePreview(text) {
    var lines = String(text || '').replace(/\r/g, '').split(/\n+/).map(function (l) { return l.trim(); }).filter(Boolean);
    return lines.slice(0, 2).join(' ');
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

  window.bindOutreachLists = function (root) {
    if (!root) return;
    var state = {
      lists: [],
      cur: null,
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
    function closePop() { var p = $('#pop'); if (p) p.classList.remove('on'); }
    function openPop() { var p = $('#pop'); if (p) p.classList.add('on'); }

    function api(path, opts) {
      opts = opts || {};
      var init = { credentials: 'include', headers: {}, quiet: true };
      if (opts.method) init.method = opts.method;
      if (opts.body) {
        init.headers['content-type'] = 'application/json';
        init.body = JSON.stringify(opts.body);
      }
      var fn = typeof window.authFetch === 'function' ? window.authFetch : fetch;
      return fn(path, init).then(function (r) { return r.json().catch(function () { return null; }).then(function (d) { return { ok: r.ok, status: r.status, data: d }; }); });
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
      toast(id ? 'Opening space' : 'No space linked yet for ' + (person && person.name || 'that row'));
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
      var rows = (state.cur.people || []).slice();
      if (state.q) {
        var q = state.q;
        rows = rows.filter(function (p) {
          return (p.name + ' ' + p.company + ' ' + p.email + ' ' + p.phone + ' ' + (p.notes || '')).toLowerCase().indexOf(q) >= 0;
        });
      }
      return rows;
    }

    function renderNav() {
      var nav = $('#listnav');
      if (!nav) return;
      nav.innerHTML = state.lists.map(function (l) {
        var on = state.cur && state.cur.key === l.key;
        return '<button type="button" class="' + (on ? 'on' : '') + '" data-l="' + esc(l.key) + '">' + esc(l.name) + '<small>' + esc(String(l.count || 0)) + '</small></button>';
      }).join('');
      nav.querySelectorAll('button[data-l]').forEach(function (el) {
        el.onclick = function () {
          state.cur = state.lists.find(function (l) { return l.key === el.getAttribute('data-l'); }) || state.lists[0];
          render();
        };
      });
      var sel = $('#lsel');
      if (sel) {
        sel.innerHTML = state.lists.map(function (l) {
          return '<option value="' + esc(l.key) + '"' + (state.cur && state.cur.key === l.key ? ' selected' : '') + '>' + esc(l.name) + '</option>';
        }).join('');
      }
    }

    function renderBody() {
      var body = $('#lbody');
      if (!body || !state.cur) return;
      var rows = peopleOf();
      var nextId = '';
      for (var i = 0; i < rows.length; i++) {
        if (!rows[i].done) { nextId = rows[i].id; break; }
      }
      body.innerHTML = rows.map(function (p) {
        var phone = p.phone || '';
        var email = p.email || '';
        var cls = 'r' + (p.id === nextId ? ' next' : '') + (p.done ? ' done' : '');
        return '<tr class="' + cls + '" data-id="' + esc(p.id) + '">'
          + '<td><b>' + esc(p.name) + '</b><small>' + esc(companyLine(p)) + '</small></td>'
          + '<td>' + (phone ? '<a href="tel:' + esc(phone.replace(/\s+/g, '')) + '">' + esc(phone) + '</a>' : '—') + '</td>'
          + '<td>' + (email ? '<a href="mailto:' + esc(email) + '">' + esc(email) + '</a>' : '—') + '</td>'
          + '<td><span class="nt">' + esc(notePreview(p.notes)) + '</span></td>'
          + '<td><span class="stg">' + esc(p.stage || 'Cold') + '</span></td>'
          + '<td>' + esc(p.lastTouch || 'Never') + '</td></tr>';
      }).join('') || '<tr><td colspan="6" style="padding:18px;color:#6f7fa6">Nobody on this list yet.</td></tr>';
      body.querySelectorAll('tr.r').forEach(function (tr) {
        tr.onclick = function (ev) {
          if (ev.target && ev.target.closest && ev.target.closest('a')) return;
          var p = (state.cur.people || []).find(function (x) { return x.id === tr.getAttribute('data-id'); });
          if (p) showPerson(p);
        };
      });
    }

    function showPerson(p) {
      $('#pn').textContent = p.name || 'Person';
      $('#pm').textContent = companyLine(p) + (p.stage ? ' · ' + p.stage : '') + ' · last touch ' + (p.lastTouch || 'Never');
      var phone = p.phone || '';
      var email = p.email || '';
      $('#pc').innerHTML = (phone ? '<a href="tel:' + esc(phone.replace(/\s+/g, '')) + '">Call ' + esc(phone) + '</a>' : '')
        + (email ? '<a href="mailto:' + esc(email) + '">Email ' + esc(email) + '</a>' : '');
      $('#pnotes').innerHTML = '<p>Loading notes…</p><small>Notes from Contacts, the space and Zoom notes, newest first</small>';
      openPop();
      var openBtn = $('#popen');
      if (openBtn) openBtn.onclick = function () { closePop(); openSpace(p); };
      var markBtn = $('#pmark');
      if (markBtn) markBtn.onclick = function () {
        var prev = !!p.done;
        p.done = true;
        state.cur.done = (state.cur.people || []).filter(function (x) { return x.done; }).length;
        closePop();
        render();
        api('/api/reach-out/' + encodeURIComponent(p.id), { method: 'PATCH', body: { done: true } }).then(function (r) {
          if (!r.ok) {
            p.done = prev;
            state.cur.done = (state.cur.people || []).filter(function (x) { return x.done; }).length;
            render();
            toast('Could not mark called');
            return;
          }
          toast('Marked called', function () {
            p.done = false;
            api('/api/reach-out/' + encodeURIComponent(p.id), { method: 'PATCH', body: { done: false } }).then(load);
          });
        });
      };
      api('/api/reach-out?notes=' + encodeURIComponent(p.id)).then(function (r) {
        var list = (r.data && r.data.notes) || [];
        if (!list.length && p.notes) list = [{ source: 'List', when: '', text: p.notes }];
        if (!list.length) {
          $('#pnotes').innerHTML = '<p>No notes yet.</p><small>Notes from Contacts, the space and Zoom notes, newest first</small>';
          return;
        }
        $('#pnotes').innerHTML = list.map(function (n) {
          return '<p>' + esc(n.text).replace(/\n/g, '<br>') + '</p>'
            + '<small>' + esc(n.source) + (n.when ? ' · ' + esc(n.when) : '') + '</small>';
        }).join('') + '<small>Notes from Contacts, the space and Zoom notes, newest first</small>';
      }).catch(function () {
        $('#pnotes').innerHTML = '<p>' + esc(p.notes || 'No notes yet.') + '</p><small>Notes from Contacts, the space and Zoom notes, newest first</small>';
      });
    }

    function render() {
      if (!state.cur && state.lists.length) state.cur = state.lists[0];
      renderNav();
      var name = $('#lname');
      var stat = $('#lstat');
      if (name && state.cur) name.textContent = state.cur.name;
      if (stat && state.cur) {
        var left = (state.cur.people || []).filter(function (p) { return !p.done; }).length;
        stat.textContent = state.cur.count + ' people · 5 a day · ' + state.cur.done + ' done'
          + (left ? ' · ' + left + ' left' : '');
      }
      renderBody();
    }

    function load() {
      if (window.STATE && window.STATE.peopleLists && window.STATE.peopleLists.length && !state.lists.length) {
        state.lists = window.STATE.peopleLists;
        state.cur = state.lists[0] || null;
        render();
      } else if (!state.lists.length) {
        var nav = $('#listnav');
        if (nav) nav.innerHTML = '<button type="button"><b>Loading lists</b><small>—</small></button>';
      }
      return api('/api/reach-out?lists=1').then(function (r) {
        var lists = (r.data && r.data.lists) || [];
        state.lists = lists;
        if (!state.cur || !lists.find(function (l) { return l.key === state.cur.key; })) state.cur = lists[0] || null;
        if (window.STATE) window.STATE.peopleLists = lists;
        render();
        return lists;
      }).catch(function () {
        if (!state.lists.length) state.lists = [];
        render();
        return state.lists;
      });
    }

    var search = $('#lsearch');
    if (search) search.oninput = function (e) { state.q = String(e.target.value || '').toLowerCase(); render(); };
    var sel = $('#lsel');
    if (sel) sel.onchange = function (e) {
      state.cur = state.lists.find(function (l) { return l.key === e.target.value; }) || state.lists[0];
      render();
    };
    var px = $('#px');
    if (px) px.onclick = closePop;
    var pop = $('#pop');
    if (pop) pop.onclick = function (e) { if (e.target === pop) closePop(); };
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closePop();
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
          api('/api/reach-out', { method: 'POST', body: { action: 'upload-list', name: nm, rows: parsed.rows } }).then(function (r) {
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
