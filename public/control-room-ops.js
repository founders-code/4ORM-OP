(function () {
  var CATS = ['Dev', 'VC', 'Angel', 'Friends & Fam', 'Grants', 'Regulator', 'Government', 'Dev Partners', 'Design Partners', 'Banking', 'Legal'];
  var TINT = { Dev: '#D7E6FF', VC: '#D9F3E4', Angel: '#FFF1C9', 'Friends & Fam': '#F8D7DE', Grants: '#E4D8FB', Regulator: '#FDE7D0', Government: '#D8F1F4', 'Dev Partners': '#E7EAF2', 'Design Partners': '#F3E4F8', Banking: '#DCEBDD', Legal: '#F4E8D8' };

  function laDay(ms) {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
    } catch (err) {
      return '';
    }
  }

  function soon(ms) {
    var gap = ms - Date.now();
    if (gap < 0) return 'now';
    var mins = Math.round(gap / 60000);
    if (mins < 60) return 'in ' + mins + 'm';
    return 'in ' + Math.floor(mins / 60) + 'h ' + (mins % 60) + 'm';
  }

  function areaLabel(k) {
    var hit = (CONFIG.areas || []).filter(function (a) { return a.k === k; })[0];
    return hit ? hit.label : (k || 'Other');
  }

  function liveItems() {
    return (STATE.items || []).filter(function (it) { return it.status !== 'dropped'; });
  }

  function renderOpsDash() {
    var el = document.getElementById('opsDash');
    if (!el) return;
    var rows = liveItems();
    var done = rows.filter(function (it) { return it.status === 'done'; });
    var active = rows.filter(function (it) { return it.status === 'doing' || it.status === 'new' || it.status === 'open'; });
    var waiting = rows.filter(function (it) { return it.status === 'waiting'; });
    var overdue = rows.filter(function (it) { return it.status !== 'done' && bucket(it) === 'overdue'; });
    var blocked = overdue.filter(function (it) { return it.priority === 'urgent' || it.priority === 'high'; });
    var total = rows.length;
    var comp = total ? Math.round((done.length / total) * 100) : 0;
    var onTime = done.length ? Math.round((done.filter(function (it) { return bucket(it) !== 'overdue'; }).length / done.length) * 100) : 100;
    var tiles = [
      ['Total', total, ''],
      ['Done', done.length, 'ok'],
      ['Active', active.length, 'go'],
      ['Waiting', waiting.length, ''],
      ['Blocked', blocked.length, ''],
      ['Overdue', overdue.length, 'bad'],
      ['Comp', comp + '%', 'ok'],
      ['On time', onTime + '%', 'warn']
    ];
    var byStatus = { done: done.length, active: active.length, waiting: waiting.length, blocked: blocked.length };
    var areas = {};
    rows.forEach(function (it) { var k = areaLabel(it.area); areas[k] = (areas[k] || 0) + 1; });
    var pri = { urgent: 0, high: 0, normal: 0, low: 0 };
    rows.forEach(function (it) { if (pri[it.priority] != null) pri[it.priority] += 1; });
    var highOpen = rows.filter(function (it) { return it.status !== 'done' && (it.priority === 'high' || it.priority === 'urgent'); }).length;
    var dueWeek = rows.filter(function (it) { return it.status !== 'done' && bucket(it) === 'week'; }).length;
    var dueDays = rows.filter(function (it) { return it.due && it.status !== 'done'; }).map(function (it) { return Math.max(0, Math.round((it.due - Date.now()) / 86400000)); });
    var avg = dueDays.length ? Math.round(dueDays.reduce(function (s, n) { return s + n; }, 0) / dueDays.length) : 0;
    var maxArea = Math.max.apply(null, Object.keys(areas).map(function (k) { return areas[k]; }).concat([1]));
    el.innerHTML = '<div class="money"><div><div class="k">Raise - friends &amp; family</div><div class="n">$80K / $250K</div><div class="bar"><span></span></div><div class="kick" style="color:#C5D4E6;margin-top:8px">$170K to go - 3/7 cheques - 18 days to Oct 30</div></div><div><div class="k">Runway</div><div class="n bad">~1 day</div></div><div><div class="k">Cash</div><div class="n">$100</div></div></div>'
      + '<div class="metrics">' + tiles.map(function (t) { return '<div class="metric ' + t[2] + '"><div class="k">' + esc(t[0]) + '</div><div class="n">' + esc(String(t[1])) + '</div></div>'; }).join('') + '</div>'
      + '<div class="ops-2"><div class="card" style="padding:14px"><h3>Operations overview</h3><div class="kick">Status</div><div>' + ['done', 'active', 'waiting', 'blocked'].map(function (k) { return esc(k) + ' ' + byStatus[k]; }).join(' - ') + '</div><div class="kick" style="margin-top:8px">Departments</div><div>' + Object.keys(areas).map(function (k) { return esc(k) + ' ' + areas[k]; }).join(' - ') + '</div><div class="kick" style="margin-top:8px">Priority</div><div>' + Object.keys(pri).map(function (k) { return esc(k) + ' ' + pri[k]; }).join(' - ') + '</div></div>'
      + '<div class="card" style="padding:14px"><h3>Quick insights</h3><div>High priority open ' + highOpen + '</div><div>Due this week ' + dueWeek + '</div><div>Active tasks ' + active.length + '</div><div>Avg days to due ' + avg + '</div><div>Blocked tasks ' + blocked.length + '</div></div></div>'
      + '<div class="ops-2"><div class="card" style="padding:14px"><h3>Task status breakdown</h3>' + donut([{ n: done.length, color: '#1F8A4C' }, { n: active.length, color: '#2F6FED' }, { n: waiting.length, color: '#E0A100' }, { n: blocked.length, color: '#C5363A' }]) + '</div>'
      + '<div class="card" style="padding:14px"><h3>Tasks by department</h3>' + Object.keys(areas).map(function (k) { return '<div style="display:flex;gap:8px;align-items:center;margin-top:6px"><span style="width:110px">' + esc(k) + '</span><span style="height:8px;border-radius:99px;background:#2F6FED;width:' + Math.round((areas[k] / maxArea) * 180) + 'px"></span></div>'; }).join('') + '</div></div>';
  }

  function donut(parts) {
    if (!parts.some(function (p) { return p.n; })) parts = [{ n: 1, color: '#E6EBF1' }];
    var total = parts.reduce(function (s, p) { return s + p.n; }, 0) || 1;
    var c = 2 * Math.PI * 42;
    var off = 0;
    var arcs = parts.map(function (p) {
      var len = (p.n / total) * c;
      var node = '<circle cx="60" cy="60" r="42" fill="none" stroke="' + p.color + '" stroke-width="14" stroke-dasharray="' + len + ' ' + (c - len) + '" stroke-dashoffset="' + (-off) + '" transform="rotate(-90 60 60)"/>';
      off += len;
      return node;
    }).join('');
    return '<svg viewBox="0 0 120 120" width="150" height="150">' + arcs + '</svg>';
  }

  function dueFor(col) {
    if (col === 'today') return Date.now();
    if (col === 'week') return Date.now() + 3 * 86400000;
    return null;
  }

  function renderWar() {
    var cmd = document.getElementById('warCmd');
    var board = document.getElementById('execBoard');
    if (!cmd || !board) return;
    var move = ((STATE.ceo && STATE.ceo.moves) || [])[0];
    var open = liveItems().filter(function (it) { return it.status !== 'done'; });
    var counts = {
      Today: open.filter(function (it) { return bucket(it) === 'today'; }).length,
      Overdue: open.filter(function (it) { return bucket(it) === 'overdue'; }).length,
      'Waiting on others': (STATE.contacts || []).filter(function (c) { return c.waitingOn || c.status === 'waiting'; }).length,
      'Done this week': liveItems().filter(function (it) { return it.status === 'done' && bucket(it) === 'week'; }).length
    };
    var today = laDay(Date.now());
    var next = (STATE.events || []).filter(function (ev) { return laDay(ev.start) === today && ev.start >= Date.now() - 60000; }).sort(function (a, b) { return a.start - b.start; }).slice(0, 2);
    cmd.innerHTML = '<div class="cmd"><div><div class="lb-add"><input id="opsAdd" type="text" placeholder="Capture a task" style="flex:1"/><button class="btn pri sm" id="opsAddBtn" type="button">Add</button></div><div class="pulse" style="margin-top:10px">' + Object.keys(counts).map(function (k) { return '<div><div class="k">' + esc(k) + '</div><b>' + counts[k] + '</b></div>'; }).join('') + '</div></div><div class="focus"><div class="k">Today\'s focus</div><div style="font-size:16px;font-weight:700;margin-top:4px">' + esc(move ? move.text : 'Nothing urgent on the desk.') + '</div><div id="nextUp" style="margin-top:10px"><div class="k">Next up</div>' + (next.length ? next.map(function (ev) { return '<div data-count="' + ev.start + '">' + esc(ev.title || 'Event') + ' <span>' + soon(ev.start) + '</span></div>'; }).join('') : '<div>No more events today.</div>') + '<button class="btn sm" id="findSlot" type="button" style="margin-top:8px">Find a 30-min slot</button></div></div></div>';
    var cols = [
      ['today', 'Today'],
      ['week', 'This week'],
      ['later', 'Later']
    ];
    board.innerHTML = '<div class="exec">' + cols.map(function (col) {
      var items = liveItems().filter(function (it) {
        var b = bucket(it);
        if (it.status === 'done') return false;
        if (col[0] === 'today') return b === 'today' || b === 'overdue';
        if (col[0] === 'week') return b === 'week';
        return b === 'later';
      });
      return '<div class="exec-col ' + col[0] + '" data-col="' + col[0] + '"><div class="sec-h"><h3>' + col[1] + '</h3><button class="addmini" type="button" data-add-col="' + col[0] + '">+</button></div>' + items.map(function (it) {
        return '<div class="exec-card" draggable="true" data-item="' + esc(it.id) + '"><input type="checkbox" data-done="' + esc(it.id) + '" aria-label="Done"/><button type="button" data-edit="' + esc(it.id) + '" style="flex:1;text-align:left;border:0;background:transparent;font:inherit;cursor:pointer"><b>' + esc(it.title) + '</b><div class="kick">' + esc(areaLabel(it.area)) + '</div></button><button type="button" data-del="' + esc(it.id) + '" aria-label="Delete">x</button></div>';
      }).join('') + '</div>';
    }).join('') + '</div>';
    bindWar();
  }

  function bindWar() {
    var add = document.getElementById('opsAddBtn');
    if (add) add.onclick = function () { var input = document.getElementById('opsAdd'); saveItem(input.value, input.getAttribute('data-col') || 'today'); input.value = ''; };
    document.querySelectorAll('[data-add-col]').forEach(function (btn) {
      btn.onclick = function () {
        var input = document.getElementById('opsAdd');
        if (!input) return;
        input.setAttribute('data-col', btn.getAttribute('data-add-col'));
        input.focus();
      };
    });
    var find = document.getElementById('findSlot');
    if (find) find.onclick = openSlots;
    document.querySelectorAll('.exec-card').forEach(function (card) {
      card.ondragstart = function (e) { e.dataTransfer.setData('text', card.getAttribute('data-item')); };
    });
    document.querySelectorAll('.exec-col').forEach(function (col) {
      col.ondragover = function (e) { e.preventDefault(); };
      col.ondrop = function (e) {
        e.preventDefault();
        var id = e.dataTransfer.getData('text');
        var due = dueFor(col.getAttribute('data-col'));
        authFetch('/api/items', { method: 'PATCH', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: id, due: due }) }).then(function () { return authFetch('/api/board', { credentials: 'same-origin' }); }).then(function (r) { return r.json(); }).then(applyBoard).catch(function () {});
      };
    });
    document.querySelectorAll('[data-done]').forEach(function (box) {
      box.onclick = function (e) {
        e.stopPropagation();
        authFetch('/api/items/' + box.getAttribute('data-done'), { method: 'PATCH', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'done' }) }).then(function () { return authFetch('/api/board', { credentials: 'same-origin' }); }).then(function (r) { return r.json(); }).then(applyBoard).catch(function () {});
      };
    });
    document.querySelectorAll('[data-del]').forEach(function (btn) {
      btn.onclick = function (e) {
        e.stopPropagation();
        if (!window.confirm('Delete this task?')) return;
        authFetch('/api/items/' + btn.getAttribute('data-del'), { method: 'DELETE', credentials: 'same-origin' }).then(function () { return authFetch('/api/board', { credentials: 'same-origin' }); }).then(function (r) { return r.json(); }).then(applyBoard).catch(function () {});
      };
    });
    document.querySelectorAll('[data-edit]').forEach(function (btn) {
      btn.onclick = function () { editItem(btn.getAttribute('data-edit')); };
    });
  }

  function saveItem(title, col) {
    title = String(title || '').trim();
    if (!title) return;
    authFetch('/api/items', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: title, area: 'other', due: dueFor(col) }) }).then(function (r) { if (!r.ok) throw 0; return authFetch('/api/board', { credentials: 'same-origin' }); }).then(function (r) { return r.json(); }).then(applyBoard).catch(function () {});
  }

  function editItem(id) {
    var it = (STATE.items || []).filter(function (row) { return row.id === id; })[0];
    if (!it) return;
    var card = document.getElementById('modalCard');
    var modal = document.getElementById('modal');
    if (!card || !modal) return;
    card.innerHTML = '<div class="mhd"><div style="font-weight:700">Edit task</div><button class="x" id="mClose" type="button">x</button></div><form class="mbd" id="opsEdit"><label>Title<input id="opsTitle" type="text" value="' + esc(it.title) + '" style="width:100%;margin-top:4px"/></label><label style="display:block;margin-top:8px">Notes<textarea id="opsNotes" rows="4" style="width:100%;margin-top:4px">' + esc(it.notes || '') + '</textarea></label><button class="btn pri sm" type="submit" style="margin-top:10px">Save</button></form>';
    modal.hidden = false;
    document.getElementById('opsEdit').onsubmit = function (e) {
      e.preventDefault();
      authFetch('/api/items', { method: 'PATCH', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: id, title: document.getElementById('opsTitle').value, notes: document.getElementById('opsNotes').value }) }).then(function () { modal.hidden = true; return authFetch('/api/board', { credentials: 'same-origin' }); }).then(function (r) { return r.json(); }).then(applyBoard).catch(function () {});
    };
  }

  function openSlots() {
    var card = document.getElementById('modalCard');
    var modal = document.getElementById('modal');
    if (!card || !modal) return;
    card.innerHTML = '<div class="mhd"><div style="font-weight:700">Open 30-minute slots</div><button class="x" id="mClose" type="button">x</button></div><div class="mbd" id="slotList">Reading the calendar.</div>';
    modal.hidden = false;
    authFetch('/api/calendar/slots', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (data) {
      var list = document.getElementById('slotList');
      if (!list) return;
      var slots = data.slots || [];
      list.innerHTML = (data.error ? '<div class="kick">' + esc(data.error) + '</div>' : '') + slots.map(function (slot) {
        return '<button class="slot" type="button" data-start="' + slot.start + '"' + (slot.free ? '' : ' disabled') + '>' + esc(slot.label) + (slot.free ? '' : ' - busy') + '</button>';
      }).join('');
      list.querySelectorAll('.slot').forEach(function (btn) {
        btn.onclick = function () {
          btn.disabled = true;
          authFetch('/api/calendar/slots', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ start: Number(btn.getAttribute('data-start')) }) }).then(function (r) { return r.json().then(function (d) { if (!r.ok) throw d; btn.textContent = btn.textContent + ' - booked'; }); }).catch(function () { btn.disabled = false; });
        };
      });
    }).catch(function () {
      var list = document.getElementById('slotList');
      if (list) list.textContent = 'Calendar could not be read.';
    });
  }

  function renderNews(items, categories) {
    var el = document.getElementById('newsDesk');
    if (!el) return;
    var cats = categories && categories.length ? categories : ['All'];
    var on = STATE.newsCat || 'All';
    var rows = (items || []).filter(function (item) { return on === 'All' || item.category === on; });
    var top = rows.filter(function (item) { return item.is_top || item.isTop; })[0];
    var rest = rows.filter(function (item) { return item !== top; });
    function card(item, wide) {
      var tint = TINT[item.category] || '#E7EEF6';
      return '<a class="news-card' + (wide ? ' wide' : '') + '" href="' + esc(item.url || '#') + '" target="_blank" rel="noopener"><div class="hd" style="background:' + tint + '">' + esc(item.category || '') + '</div><div style="padding:12px"><b>' + esc(item.title || '') + '</b><div class="kick">' + esc(item.summary || '') + '</div></div></a>';
    }
    el.innerHTML = '<div class="news-wrap"><div class="news-rail">' + ['All'].concat(cats.filter(function (c) { return c !== 'All'; })).map(function (c) { return '<button type="button" class="' + (c === on ? 'on' : '') + '" data-news="' + esc(c) + '">' + esc(c) + '</button>'; }).join('') + '</div><div><div class="news-grid">' + (top ? card(top, true) : '') + rest.map(function (item) { return card(item, false); }).join('') + '</div></div></div>';
    el.querySelectorAll('[data-news]').forEach(function (btn) {
      btn.onclick = function () { STATE.newsCat = btn.getAttribute('data-news'); renderNews(STATE.news || [], STATE.newsCategories || cats); };
    });
  }

  function loadNews() {
    authFetch('/api/news', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (data) {
      STATE.news = data.items || [];
      STATE.newsCategories = data.categories || [];
      renderNews(STATE.news, STATE.newsCategories);
    }).catch(function () { renderNews([], []); });
  }

  function flatFiles(nodes, out) {
    (nodes || []).forEach(function (node) {
      (node.files || node.docs || []).forEach(function (file) { out.push(file); });
      flatFiles(node.children || node.folders || [], out);
    });
    return out;
  }

  function renderLibrary() {
    var el = document.getElementById('opsLibrary');
    if (!el || el.hidden) return;
    var docs = STATE.staged || [];
    el.innerHTML = '<div class="cap" style="margin-bottom:10px"><select id="libCat" aria-label="Category">' + CATS.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('') + '</select><select id="libFile" aria-label="Drive file"><option value="">Pull from Drive</option>' + flatFiles(STATE.drives || [], []).map(function (file) { return '<option value="' + esc(file.id) + '" data-url="' + esc(file.url || '') + '" data-name="' + esc(file.name || '') + '">' + esc(file.name || 'File') + '</option>'; }).join('') + '</select><button class="btn sm" id="libPull" type="button">Pull from Drive</button><button class="btn sm" id="libPush" type="button">Move to Drive</button></div><div class="lib-grid">' + CATS.map(function (c) {
      var n = docs.filter(function (d) { return d.category === c; }).length;
      return '<button class="lib-card" type="button" data-cat="' + esc(c) + '"><b>' + esc(c) + '</b><div class="kick">' + n + ' files</div></button>';
    }).join('') + '</div><div id="libFiles" style="margin-top:12px"></div>';
    var pull = document.getElementById('libPull');
    if (pull) pull.onclick = function () {
      var sel = document.getElementById('libFile');
      var opt = sel.options[sel.selectedIndex];
      if (!opt || !opt.value) return;
      authFetch('/api/documents', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'pull', category: document.getElementById('libCat').value, name: opt.getAttribute('data-name'), url: opt.getAttribute('data-url'), driveFileId: opt.value }) }).then(loadLibrary).catch(function () {});
    };
    var push = document.getElementById('libPush');
    if (push) push.onclick = function () {
      authFetch('/api/documents', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'push' }) }).then(function (r) { return r.json(); }).then(function (d) { if (d && d.error) window.alert(d.error); }).catch(function () {});
    };
    el.querySelectorAll('.lib-card').forEach(function (card) {
      card.onclick = function () {
        var cat = card.getAttribute('data-cat');
        document.getElementById('libFiles').innerHTML = docs.filter(function (d) { return d.category === cat; }).map(function (d) {
          return '<div class="docfile"><button type="button" class="docopen" data-doc-url="' + esc(d.url || '') + '" data-doc-name="' + esc(d.name) + '">' + esc(d.name) + '</button><button type="button" data-lib-del="' + esc(d.id) + '">x</button></div>';
        }).join('') || '<div class="kick">No files in this category yet.</div>';
        document.querySelectorAll('[data-lib-del]').forEach(function (btn) {
          btn.onclick = function () {
            authFetch('/api/documents', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'remove', id: btn.getAttribute('data-lib-del') }) }).then(loadLibrary).catch(function () {});
          };
        });
      };
    });
  }

  function loadLibrary() {
    authFetch('/api/documents', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (data) {
      STATE.staged = data.docs || [];
      renderLibrary();
    }).catch(function () { STATE.staged = []; renderLibrary(); });
  }

  function setLib(mode) {
    var drive = mode === 'drive';
    var lib = document.getElementById('opsLibrary');
    var tree = document.getElementById('docTree');
    var tools = document.querySelector('#v-docs .doc-tools');
    var pins = document.querySelector('#v-docs .pinbar');
    if (lib) lib.hidden = drive;
    if (tree) tree.hidden = !drive;
    if (tools) tools.hidden = !drive;
    if (pins) pins.hidden = !drive;
    document.querySelectorAll('#libMode button').forEach(function (btn) { btn.classList.toggle('on', btn.getAttribute('data-lib') === mode); });
    if (!drive) loadLibrary();
  }

  function loadInbox() {
    var el = document.getElementById('vcInbox');
    if (!el) return;
    authFetch('/api/vc-inbox', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (data) {
      var rows = data.rows || [];
      el.innerHTML = '<h3>VC inbox</h3><div class="lb-add"><input id="vcName" type="text" placeholder="Firm or person" style="flex:1"/><input id="vcNote" type="text" placeholder="Note" style="flex:1"/><button class="btn pri sm" id="vcAdd" type="button">Catch</button></div><div style="margin-top:8px">' + rows.map(function (row) {
        return '<div class="exec-card"><div style="flex:1"><b>' + esc(row.name) + '</b><div class="kick">' + esc(row.note || '') + '</div></div><button class="btn sm" type="button" data-vc-go="' + esc(row.id) + '">Promote to Pipeline</button><button type="button" data-vc-del="' + esc(row.id) + '">Delete</button></div>';
      }).join('') + '</div>';
      document.getElementById('vcAdd').onclick = function () {
        authFetch('/api/vc-inbox', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: document.getElementById('vcName').value, note: document.getElementById('vcNote').value }) }).then(loadInbox).catch(function () {});
      };
      el.querySelectorAll('[data-vc-go]').forEach(function (btn) {
        btn.onclick = function () { authFetch('/api/vc-inbox/' + btn.getAttribute('data-vc-go'), { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'promote' }) }).then(function () { return authFetch('/api/board', { credentials: 'same-origin' }); }).then(function (r) { return r.json(); }).then(function (data) { applyBoard(data); loadInbox(); }).catch(function () {}); };
      });
      el.querySelectorAll('[data-vc-del]').forEach(function (btn) {
        btn.onclick = function () {
          if (!window.confirm('Delete this name?')) return;
          authFetch('/api/vc-inbox/' + btn.getAttribute('data-vc-del'), { method: 'DELETE', credentials: 'same-origin' }).then(loadInbox).catch(function () {});
        };
      });
    }).catch(function () { el.innerHTML = ''; });
  }

  function decoratePeople() {
    document.querySelectorAll('#pBody tr').forEach(function (tr) {
      var id = tr.getAttribute('data-cid');
      var person = (STATE.contacts || []).filter(function (c) { return c.id === id; })[0];
      if (!person || !person.fbTier || tr.querySelector('.fb')) return;
      var name = tr.querySelector('.c-name');
      if (!name) return;
      name.insertAdjacentHTML('beforeend', '<div class="kick fb">' + esc(String(person.fbTier).replace(/\s*\u00b7\s*/g, ' - ')) + ' - ' + esc(person.fbAsk || '') + '</div><select data-fb-status="' + esc(person.id) + '" aria-label="Status"><option value="not_sent">not sent</option><option value="sent">sent</option><option value="replied">replied</option></select><button class="btn sm" type="button" data-fb-go="' + esc(person.id) + '">Promote to Pipeline</button>');
      var sel = name.querySelector('select');
      if (sel) sel.value = person.fbStatus || 'not_sent';
    });
    document.querySelectorAll('[data-fb-status]').forEach(function (sel) {
      sel.onchange = function () {
        authFetch('/api/contacts/' + sel.getAttribute('data-fb-status') + '/facebook', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'status', status: sel.value }) }).catch(function () {});
      };
    });
    document.querySelectorAll('[data-fb-go]').forEach(function (btn) {
      btn.onclick = function (e) {
        e.stopPropagation();
        authFetch('/api/contacts/' + btn.getAttribute('data-fb-go') + '/facebook', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'promote' }) }).catch(function () {});
      };
    });
  }

  function renderDeskNotes() {
    var host = document.getElementById('deskNotes');
    if (!host) return;
    var rows = STATE.notes || [];
    host.innerHTML = rows.map(function (note) {
      return '<div class="exec-card" style="background:#1A2332;color:#E7EEF6"><div style="flex:1"><div class="kick">' + esc(note.body || '') + '</div><b>' + esc(note.title || '') + '</b></div><button type="button" data-note-edit="' + esc(note.id) + '">Edit</button><button type="button" data-note-del="' + esc(note.id) + '">Delete</button></div>';
    }).join('');
    host.querySelectorAll('[data-note-del]').forEach(function (btn) {
      btn.onclick = function () {
        if (!window.confirm('Delete this note?')) return;
        authFetch('/api/notes', { method: 'DELETE', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: btn.getAttribute('data-note-del'), kind: 'note' }) }).then(function () { return authFetch('/api/board', { credentials: 'same-origin' }); }).then(function (r) { return r.json(); }).then(applyBoard).catch(function () {});
      };
    });
    host.querySelectorAll('[data-note-edit]').forEach(function (btn) {
      btn.onclick = function () {
        var note = (STATE.notes || []).filter(function (n) { return n.id === btn.getAttribute('data-note-edit'); })[0];
        if (!note) return;
        document.getElementById('opsNoteTitle').value = note.title || '';
        document.getElementById('opsNoteBody').value = note.body || '';
        document.getElementById('opsNoteId').value = note.id;
      };
    });
  }

  var priorOpen = openDocView;
  openDocView = function (name, url) {
    var preview = drivePreview(url);
    if (!preview) return;
    var view = document.getElementById('docView');
    document.getElementById('docViewName').textContent = name || 'Document';
    document.getElementById('docViewDrive').href = url;
    var frame = document.getElementById('docViewFrame');
    var fail = document.getElementById('docFallback');
    if (!fail) {
      fail = document.createElement('div');
      fail.id = 'docFallback';
      fail.style.padding = '24px';
      fail.innerHTML = '<p>This file cannot be previewed here. Use Open in Drive.</p>';
      frame.parentNode.insertBefore(fail, frame.nextSibling);
    }
    frame.hidden = false;
    fail.hidden = true;
    view.hidden = false;
    var id = '';
    try {
      var parsed = new URL(url);
      var match = parsed.pathname.match(/\/d\/([^/]+)/);
      id = match ? match[1] : (parsed.searchParams.get('id') || '');
    } catch (err) { id = ''; }
    if (!id) {
      frame.hidden = true;
      fail.hidden = false;
      return;
    }
    frame.src = 'about:blank';
    authFetch('/api/drive/file?id=' + encodeURIComponent(id), { credentials: 'same-origin' }).then(function (r) {
      if (!r.ok) throw 0;
      return r.blob();
    }).then(function (blob) {
      frame.src = URL.createObjectURL(blob);
    }).catch(function () {
      frame.hidden = true;
      frame.removeAttribute('src');
      fail.hidden = false;
    });
  };

  var priorPeople = renderPeople;
  renderPeople = function (q) { priorPeople(q); decoratePeople(); };
  var priorContacts = renderContacts;
  renderContacts = function (q) {
    priorContacts(q);
    document.querySelectorAll('.pcard').forEach(function (card) { card.draggable = false; card.ondragstart = null; });
  };
  var priorCard = openContactCard;
  openContactCard = function (id) {
    priorCard(id);
    if (STATE.desk !== 'contacts') return;
    document.querySelectorAll('#drawer .fld').forEach(function (field) {
      if ((field.textContent || '').indexOf('Phone') === 0) field.remove();
    });
    var body = document.querySelector('#drawer .db');
    if (body && !document.getElementById('logPipe')) {
      body.insertAdjacentHTML('beforeend', '<div class="cap"><button class="btn sm" id="logPipe" type="button">Log note</button><a class="btn sm" id="ghlOpen" href="https://app.gohighlevel.com/" target="_blank" rel="noopener">Open in GHL</a></div><textarea id="pipeNote" rows="3" placeholder="Note" style="width:100%;margin-top:8px"></textarea>');
      document.getElementById('logPipe').onclick = function () {
        authFetch('/api/contacts', { method: 'PATCH', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: id, notes: document.getElementById('pipeNote').value }) }).catch(function () {});
      };
    }
  };

  var priorApply = applyBoard;
  applyBoard = function (data) {
    priorApply(data);
    renderOpsDash();
    renderWar();
    renderDeskNotes();
    if (STATE.desk === 'news') loadNews();
    if (STATE.desk === 'contacts') loadInbox();
  };
  var priorSwitch = switchView;
  switchView = function (v) {
    priorSwitch(v);
    if (v === 'news') loadNews();
    if (v === 'docs') setLib('library');
    if (v === 'contacts') loadInbox();
    if (v === 'room') renderOpsDash();
    if (v === 'war') renderWar();
    if (v === 'znotes') renderDeskNotes();
  };

  var brand = document.querySelector('.brand');
  if (brand) brand.addEventListener('click', function () { setNav(document.body.classList.contains('nav-collapsed')); });
  var libMode = document.getElementById('libMode');
  if (libMode) libMode.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-lib]');
    if (btn) setLib(btn.getAttribute('data-lib'));
  });
  var grid = document.getElementById('pkgGrid');
  if (grid) grid.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-push-card]');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    authFetch('/api/packages/' + btn.getAttribute('data-push-card'), { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'push-drive' }) }).catch(function () {});
  }, true);
  var notes = document.getElementById('v-znotes');
  if (notes && !document.getElementById('deskNotes')) {
    notes.insertAdjacentHTML('afterbegin', '<form id="noteForm" class="lb-add" style="margin-bottom:12px"><input id="opsNoteId" type="hidden" value=""/><input id="opsNoteTitle" type="text" placeholder="Title" style="flex:1"/><input id="opsNoteBody" type="text" placeholder="Key intel" style="flex:1"/><button class="btn pri sm" type="submit">Save note</button></form><div id="deskNotes"></div>');
    document.getElementById('noteForm').onsubmit = function (e) {
      e.preventDefault();
      var id = document.getElementById('opsNoteId').value;
      var payload = { title: document.getElementById('opsNoteTitle').value, body: document.getElementById('opsNoteBody').value };
      var req = id ? authFetch('/api/notes', { method: 'PATCH', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(Object.assign({ id: id }, payload)) }) : authFetch('/api/notes', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      req.then(function () { document.getElementById('noteForm').reset(); return authFetch('/api/board', { credentials: 'same-origin' }); }).then(function (r) { return r.json(); }).then(applyBoard).catch(function () {});
    };
  }
  var integ = document.getElementById('v-int');
  if (integ && !document.getElementById('discGoogle')) {
    integ.insertAdjacentHTML('beforeend', '<div class="cap" style="margin-top:12px"><button class="btn sm" id="discGoogle" type="button">Disconnect Google</button><button class="btn sm" id="discGhl" type="button">Disconnect GoHighLevel</button></div>');
    document.getElementById('discGoogle').onclick = function () {
      if (!window.confirm('Disconnect Google on this desk?')) return;
      authFetch('/api/integrations/google/disconnect', { method: 'DELETE', credentials: 'same-origin' }).catch(function () {});
    };
    document.getElementById('discGhl').onclick = function () {
      if (!window.confirm('Disconnect GoHighLevel on this desk?')) return;
      authFetch('/api/integrations/gohighlevel/disconnect', { method: 'DELETE', credentials: 'same-origin' }).catch(function () {});
    };
  }
  setInterval(function () {
    document.querySelectorAll('[data-count]').forEach(function (node) {
      var span = node.querySelector('span');
      if (span) span.textContent = soon(Number(node.getAttribute('data-count')));
    });
  }, 30000);
  if (document.getElementById('opsDash')) renderOpsDash();
})();
