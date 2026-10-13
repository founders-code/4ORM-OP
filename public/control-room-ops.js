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

  function areaLabel(k, it) {
    if (it && /^Reach out -/.test(String(it.category || ''))) return String(it.category);
    if (it && /regulat/i.test(String(it.category || ''))) return 'Regulator';
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
      ['Total', total, '', 'on the desk'],
      ['Done', done.length, 'ok', 'closed'],
      ['Active', active.length, 'go', 'in motion'],
      ['Waiting', waiting.length, '', 'paused'],
      ['Blocked', blocked.length, blocked.length ? 'bad' : '', 'stuck'],
      ['Overdue', overdue.length, 'bad', 'past due'],
      ['Comp', comp + '%', 'ok', 'done / total'],
      ['On time', onTime + '%', 'warn', 'closed on time']
    ];
    var byStatus = { done: done.length, active: active.length, waiting: waiting.length, blocked: blocked.length };
    var areas = {};
    var areaRows = {};
    rows.forEach(function (it) { var k = areaLabel(it.area, it); areas[k] = (areas[k] || 0) + 1; (areaRows[k] = areaRows[k] || []).push(it); });
    var pri = { urgent: 0, high: 0, normal: 0, low: 0 };
    rows.forEach(function (it) { if (pri[it.priority] != null) pri[it.priority] += 1; });
    var highOpen = rows.filter(function (it) { return it.status !== 'done' && (it.priority === 'high' || it.priority === 'urgent'); }).length;
    var dueWeek = rows.filter(function (it) { return it.status !== 'done' && bucket(it) === 'week'; }).length;
    var dueToday = rows.filter(function (it) { return it.status !== 'done' && (bucket(it) === 'today' || bucket(it) === 'overdue'); }).length;
    var oldest = overdue.reduce(function (max, it) { var age = it.due ? Math.max(0, Math.round((Date.now() - it.due) / 86400000)) : 0; return Math.max(max, age); }, 0);
    var weekAgo = Date.now() - 7 * 86400000;
    var doneWeek = done.filter(function (it) { var at = Date.parse(it.updated_at || '') || it.due || 0; return at >= weekAgo; }).length;
    var maxStatus = Math.max(done.length, active.length, waiting.length, blocked.length, 1);
    var maxArea = Math.max.apply(null, Object.keys(areas).map(function (k) { return areas[k]; }).concat([1]));
    var maxPri = Math.max(pri.urgent, pri.high, pri.normal, pri.low, 1);
    var lists = {};
    function meters(pairs, max) {
      return pairs.map(function (pair) {
        var key = pair[2];
        lists[key] = pair[3] || [];
        return '<button type="button" class="meter" data-ops="' + esc(key) + '"><em>' + esc(pair[0]) + '</em><span><i style="width:' + Math.round((pair[1] / max) * 100) + '%"></i></span><b>' + pair[1] + '</b></button>';
      }).join('');
    }
    var parts = [
      { n: done.length, color: '#1F8A4C', label: 'Completed' },
      { n: active.length, color: '#2F6FED', label: 'Active' },
      { n: waiting.length, color: '#E0A100', label: 'Waiting' },
      { n: blocked.length, color: '#C5363A', label: 'Blocked' }
    ];
    var upcoming = (STATE.events || []).filter(function (ev) { return ev.start >= Date.now() - 60000; }).sort(function (a, b) { return a.start - b.start; }).slice(0, 3);
    var todayKey = laDay(Date.now());
    var talks = (STATE.events || []).filter(function (ev) { return laDay(ev.start) === todayKey; }).slice(0, 4);
    var reachToday = (STATE.reachOut || []).filter(function (person) { return !person.done; }).slice(0, 4);
    var rank = { urgent: 0, high: 1, normal: 2, low: 3 };
    var top = rows.filter(function (it) { return it.status !== 'done'; }).sort(function (a, b) {
      return (rank[a.priority] == null ? 9 : rank[a.priority]) - (rank[b.priority] == null ? 9 : rank[b.priority]);
    }).slice(0, 3);
    var meetHtml = upcoming.length ? upcoming.map(function (ev) { return '<div>' + esc(ev.title || 'Event') + ' <span class="kick">' + soon(ev.start) + '</span></div>'; }).join('') : '<div class="kick">No meetings on the calendar.</div>';
    var talkHtml = talks.map(function (ev) { return '<div>' + esc(ev.title || 'Call') + '</div>'; }).join('') + reachToday.map(function (person) { return '<div>' + esc(person.name) + ' <span class="kick">' + esc(person.nextAction || 'Reach out') + '</span></div>'; }).join('');
    if (!talkHtml) talkHtml = '<div class="kick">Nothing to call today.</div>';
    var topHtml = top.length ? top.map(function (it) { return '<div>' + esc(it.title) + '</div>'; }).join('') : '<div class="kick">No open tasks.</div>';
    var trend = [];
    for (var day = 6; day >= 0; day -= 1) {
      var start = new Date(); start.setHours(0, 0, 0, 0); start = start.getTime() - day * 86400000;
      var count = done.filter(function (it) { var at = Date.parse(it.updated_at || '') || 0; return at >= start && at < start + 86400000; }).length;
      trend.push(count);
    }
    el.innerHTML = '<div class="money"><div><div class="k">Raise - friends &amp; family</div><div class="n">$80K / $250K</div><div class="bar"><span></span></div><div class="kick" style="color:#C5D4E6;margin-top:8px">$170K to go - 3/7 cheques - 18 days to Oct 30</div></div><div><div class="k">Runway</div><div class="n bad">~1 day</div></div><div><div class="k">Cash</div><div class="n">$100</div></div></div>'
      + '<div class="metrics">' + tiles.map(function (t) { return '<div class="metric ' + t[2] + '"><div class="k">' + esc(t[0]) + '</div><div class="n">' + esc(String(t[1])) + '</div><div class="kick">' + esc(t[3]) + '</div></div>'; }).join('') + '</div>'
      + '<div class="ops-2"><div class="card" style="padding:14px"><h3>Operations overview</h3><div class="kick">Status</div>' + meters([['Done', done.length, 'status:done', done], ['Active', active.length, 'status:active', active], ['Waiting', waiting.length, 'status:waiting', waiting], ['Blocked', blocked.length, 'status:blocked', blocked]], maxStatus) + '<div class="kick" style="margin-top:10px">Departments</div>' + meters(Object.keys(areas).map(function (k) { return [k, areas[k], 'area:' + k, areaRows[k]]; }), maxArea) + '<div class="kick" style="margin-top:10px">Priority</div>' + meters(Object.keys(pri).map(function (k) { return [k, pri[k], 'pri:' + k, rows.filter(function (it) { return it.priority === k; })]; }), maxPri) + '</div>'
      + '<div class="card" style="padding:14px"><h3>Quick insights</h3><div class="insights">'
      + '<button type="button" data-ops="ins:high"><b>' + highOpen + '</b><span>High priority open</span></button>'
      + '<button type="button" data-ops="ins:week"><b>' + dueWeek + '</b><span>Due this week</span></button>'
      + '<button type="button" data-ops="ins:active"><b>' + active.length + '</b><span>Active tasks</span></button>'
      + '<button type="button" data-ops="ins:today"><b>' + dueToday + '</b><span>Due today</span></button>'
      + '<button type="button" data-ops="ins:old"><b>' + oldest + 'd</b><span>Oldest overdue</span></button>'
      + '<button type="button" data-ops="ins:done"><b>' + doneWeek + '</b><span>Done last 7d</span></button>'
      + '</div><div class="desk-live"><h3>Next meetings</h3>' + meetHtml + '<h3>Today\'s conversations</h3>' + talkHtml + '<h3>Top 3 tasks</h3>' + topHtml + '</div></div></div>'
      + '<div class="ops-2"><div class="card" style="padding:14px"><h3>Task status breakdown</h3><div class="donut-wrap">' + donut(parts, total) + '<div class="legend">' + parts.map(function (p) { var pct = total ? Math.round((p.n / total) * 100) : 0; return '<div><b style="color:' + p.color + '">' + p.n + '</b> ' + esc(p.label) + ' ' + pct + '%</div>'; }).join('') + '</div></div></div>'
      + '<div class="card" style="padding:14px"><h3>Tasks by department</h3>' + Object.keys(areas).map(function (k) { return '<button type="button" class="meter" data-ops="area:' + esc(k) + '"><em>' + esc(k) + '</em><span><i style="width:' + Math.round((areas[k] / maxArea) * 100) + '%"></i></span><b>' + areas[k] + '</b></button>'; }).join('') + '<h3 style="margin-top:16px">Completed - last 7 days</h3>' + spark(trend) + '</div></div>';
    lists['ins:high'] = rows.filter(function (it) { return it.status !== 'done' && (it.priority === 'high' || it.priority === 'urgent'); });
    lists['ins:week'] = rows.filter(function (it) { return it.status !== 'done' && bucket(it) === 'week'; });
    lists['ins:active'] = active;
    lists['ins:today'] = rows.filter(function (it) { return it.status !== 'done' && (bucket(it) === 'today' || bucket(it) === 'overdue'); });
    lists['ins:old'] = overdue;
    lists['ins:done'] = done.filter(function (it) { var at = Date.parse(it.updated_at || '') || it.due || 0; return at >= weekAgo; });
    el.querySelectorAll('[data-ops]').forEach(function (btn) {
      btn.onclick = function () { openOpsList(btn.getAttribute('data-ops'), lists); };
    });
  }

  function openOpsList(key, lists) {
    var modal = document.getElementById('modal');
    var card = document.getElementById('modalCard');
    if (!modal || !card) return;
    var rows = (lists && lists[key]) || [];
    card.classList.add('wide');
    card.innerHTML = '<div class="mhd"><div style="font-weight:700">' + esc(key.split(':').slice(1).join(':') || 'Items') + '</div><button class="x" id="mClose" type="button">x</button></div><div class="mbd">' + (rows.length ? rows.map(function (it) { return '<div class="ops-row"><button type="button" data-ops-item="' + esc(it.id) + '"><b>' + esc(it.title) + '</b><span class="kick">' + esc(areaLabel(it.area, it)) + '</span></button>' + bucketPicks(it) + '<button type="button" class="ghost-x" data-ops-del="' + esc(it.id) + '" aria-label="Delete">x</button></div>'; }).join('') : '<div class="kick">Nothing in this group.</div>') + '</div>';
    modal.classList.add('open');
    modal.hidden = false;
    document.getElementById('mClose').onclick = function () { if (typeof closeModal === 'function') closeModal(); };
    card.querySelectorAll('[data-set-bucket]').forEach(function (btn) {
      btn.onclick = function (e) {
        e.stopPropagation();
        setBucket(btn.getAttribute('data-set-bucket'), btn.getAttribute('data-col'));
        openOpsList(key, lists);
      };
    });
    card.querySelectorAll('[data-ops-item]').forEach(function (btn) {
      btn.onclick = function () { if (typeof closeModal === 'function') closeModal(); editItem(btn.getAttribute('data-ops-item')); };
    });
    card.querySelectorAll('[data-ops-del]').forEach(function (btn) {
      btn.onclick = function () {
        var id = btn.getAttribute('data-ops-del');
        STATE.items = (STATE.items || []).filter(function (it) { return it.id !== id; });
        lists[key] = (lists[key] || []).filter(function (it) { return it.id !== id; });
        if (typeof renderWar === 'function') renderWar();
        renderOpsDash();
        authFetch('/api/items/' + id, { method: 'DELETE', credentials: 'same-origin' }).catch(function () {});
        openOpsList(key, lists);
      };
    });
  }

  function spark(values) {
    var max = Math.max.apply(null, values.concat([1]));
    var w = 280; var h = 64;
    var pts = values.map(function (n, i) { return (i * (w / 6)) + ',' + (h - (n / max) * (h - 8) - 4); }).join(' ');
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" height="64"><polyline fill="none" stroke="#2F6FED" stroke-width="2" points="' + pts + '"/></svg>';
  }

  function donut(parts, centre) {
    var drawn = parts.slice();
    if (!drawn.some(function (p) { return p.n; })) drawn = [{ n: 1, color: '#E6EBF1' }];
    var total = drawn.reduce(function (s, p) { return s + p.n; }, 0) || 1;
    var c = 2 * Math.PI * 42;
    var off = 0;
    var arcs = drawn.map(function (p) {
      var len = (p.n / total) * c;
      var node = '<circle cx="60" cy="60" r="42" fill="none" stroke="' + p.color + '" stroke-width="14" stroke-dasharray="' + len + ' ' + (c - len) + '" stroke-dashoffset="' + (-off) + '" transform="rotate(-90 60 60)"/>';
      off += len;
      return node;
    }).join('');
    return '<svg viewBox="0 0 120 120" width="180" height="180">' + arcs + '<text x="60" y="66" text-anchor="middle" font-size="18" font-weight="650" fill="#102033">' + (centre || 0) + '</text></svg>';
  }

  function bucketPicks(it) {
    var b = bucket(it);
    var cur = b === 'week' ? 'week' : (b === 'later' ? 'later' : 'today');
    return '<span class="bucket-picks">' + [['today', 'Today'], ['week', 'Week'], ['later', 'Later']].map(function (pair) {
      return '<button type="button" data-set-bucket="' + esc(it.id) + '" data-col="' + pair[0] + '"' + (cur === pair[0] ? ' class="on"' : '') + '>' + pair[1] + '</button>';
    }).join('') + '</span>';
  }

  function setBucket(id, col) {
    var it = (STATE.items || []).filter(function (row) { return row.id === id; })[0];
    if (!it) return;
    var prev = it.due;
    it.due = dueFor(col);
    renderWar();
    if (typeof renderOpsDash === 'function') renderOpsDash();
    var due = it.due == null ? null : new Date(it.due).toISOString();
    authFetch('/api/items', { method: 'PATCH', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: id, due: due }) }).then(function (r) { if (!r.ok) throw 0; }).catch(function () { it.due = prev; renderWar(); });
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
    var today = laDay(Date.now());
    var next = (STATE.events || []).filter(function (ev) { return laDay(ev.start) === today && ev.start >= Date.now() - 60000; }).sort(function (a, b) { return a.start - b.start; }).slice(0, 2);
    var kinds = [['all', 'All'], ['corporate', 'Corporate'], ['vc', 'VC'], ['client', 'Client'], ['design', 'Design partner'], ['regulator', 'Regulator']];
    var reachNames = { corporate: 'Corporate', vc: 'VC', client: 'Client', design: 'Design partner', regulator: 'Regulator' };
    var people = STATE.reachOut || [];
    var filter = STATE.reachKind || 'all';
    var shown = people.filter(function (person) { return filter === 'all' || person.kind === filter; });
    cmd.innerHTML = '<div class="lb-add"><input id="opsAdd" type="text" placeholder="Capture a task" style="flex:1"/><button class="btn pri sm" id="opsAddBtn" type="button">Add</button></div>'
      + '<div class="card" id="nextUp" style="padding:8px 12px;margin-top:8px;display:flex;align-items:center;gap:12px"><div style="flex:1">' + (next.length ? next.map(function (ev) { return '<div data-count="' + ev.start + '">' + esc(ev.title || 'Event') + ' <span class="kick">' + soon(ev.start) + '</span></div>'; }).join('') : '<div class="kick">No more events today.</div>') + '</div><button class="btn sm" id="findSlot" type="button">Find a 30-min slot</button></div>'
      + '<div class="card" style="padding:12px;margin-top:10px"><h3>Reach out</h3><div class="news-chips">' + kinds.map(function (pair) { var n = people.filter(function (person) { return pair[0] === 'all' || person.kind === pair[0]; }).length; return '<button type="button" data-reach-kind="' + pair[0] + '"' + (filter === pair[0] ? ' class="on"' : '') + '>' + pair[1] + ' ' + n + '</button>'; }).join('') + '</div><div class="reach-grid">' + (shown.length ? shown.map(function (person) { var bits = String(person.name || '?').split(/\s+/).slice(0, 2).map(function (part) { return part.slice(0, 1); }).join('').toUpperCase(); return '<div class="reach-card"><div class="av">' + esc(bits) + '</div><b>' + esc(person.name) + '</b><div class="kick">' + esc(person.company || '') + '</div><span class="kick">' + esc(reachNames[person.kind] || 'Corporate') + '</span><label class="cap"><input type="checkbox" data-reach-done="' + esc(person.id) + '"' + (person.done ? ' checked' : '') + '/>' + esc(person.nextAction || 'Reach out') + '</label><button type="button" data-reach-task="' + esc(person.id) + '">+ task</button></div>'; }).join('') : '<div class="kick">Add people from Pipeline or Contacts.</div>') + '</div></div>';
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
        return '<div class="exec-card" draggable="true" data-item="' + esc(it.id) + '"><input type="checkbox" data-done="' + esc(it.id) + '" aria-label="Done"/><button type="button" data-edit="' + esc(it.id) + '" style="flex:1;text-align:left;border:0;background:transparent;font:inherit;cursor:pointer"><b>' + esc(it.title) + '</b><div class="kick">' + esc(areaLabel(it.area, it)) + '</div></button>' + bucketPicks(it) + (it._err ? '<div class="soft-err">' + esc(it._err) + '</div>' : '') + '<button type="button" class="ghost-x" data-del="' + esc(it.id) + '" aria-label="Delete">x</button></div>';
      }).join('') + '</div>';
    }).join('') + '</div>';
    bindWar();
  }

  function bindWar() {
    var add = document.getElementById('opsAddBtn');
    if (add) add.onclick = function () { var input = document.getElementById('opsAdd'); saveItem(input.value, input.getAttribute('data-col') || 'today'); input.value = ''; };
    document.querySelectorAll('[data-add-col]').forEach(function (btn) {
      btn.onclick = function () { saveItem('', btn.getAttribute('data-add-col')); };
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
    document.querySelectorAll('[data-reach-kind]').forEach(function (btn) {
      btn.onclick = function () { STATE.reachKind = btn.getAttribute('data-reach-kind'); renderWar(); };
    });
    document.querySelectorAll('[data-reach-done]').forEach(function (box) {
      box.onclick = function (e) {
        e.stopPropagation();
        var person = (STATE.reachOut || []).filter(function (row) { return row.id === box.getAttribute('data-reach-done'); })[0];
        if (!person) return;
        person.done = !!box.checked;
        if (box.checked) saveItem(person.nextAction || 'Reach out', 'today', 'Reach out - ' + (person.kind === 'design' ? 'Design partner' : (person.kind || 'Corporate')));
        authFetch('/api/reach-out/' + person.id, { method: 'PATCH', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ done: person.done }) }).catch(function () {});
        renderWar();
      };
    });
    document.querySelectorAll('[data-reach-task]').forEach(function (btn) {
      btn.onclick = function () {
        var person = (STATE.reachOut || []).filter(function (row) { return row.id === btn.getAttribute('data-reach-task'); })[0];
        if (!person) return;
        var label = { corporate: 'Corporate', vc: 'VC', client: 'Client', design: 'Design partner', regulator: 'Regulator' }[person.kind] || 'Corporate';
        saveItem(person.nextAction || 'Reach out', 'today', 'Reach out - ' + label);
      };
    });
    document.querySelectorAll('[data-set-bucket]').forEach(function (btn) {
      btn.onclick = function (e) {
        e.stopPropagation();
        e.preventDefault();
        setBucket(btn.getAttribute('data-set-bucket'), btn.getAttribute('data-col'));
      };
    });
  }

  function saveItem(title, col, category) {
    title = String(title || '').trim() || 'Untitled task';
    var temp = { id: 'tmp-' + Date.now(), title: title, area: 'other', status: 'new', priority: 'normal', due: dueFor(col), notes: '', category: category || '' };
    STATE.items = (STATE.items || []).concat([temp]);
    renderWar();
    authFetch('/api/items', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: title, area: 'other', due: dueFor(col), category: category || '' }) }).then(function (r) { if (!r.ok) throw 0; return authFetch('/api/board', { credentials: 'same-origin' }); }).then(function (r) { return r.json(); }).then(applyBoard).catch(function () { temp._err = 'Not saved yet'; renderWar(); });
  }

  function loadReach() {
    authFetch('/api/reach-out', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (d) {
      STATE.reachOut = (d && d.people) || [];
      if (STATE.desk === 'war') renderWar();
      if (STATE.desk === 'room') renderOpsDash();
    }).catch(function () { STATE.reachOut = STATE.reachOut || []; });
  }

  function editItem(id) {
    var it = (STATE.items || []).filter(function (row) { return row.id === id; })[0];
    if (!it) return;
    var card = document.getElementById('modalCard');
    var modal = document.getElementById('modal');
    if (!card || !modal) return;
    card.innerHTML = '<div class="mhd"><div style="font-weight:700">Edit task</div><button class="x" id="mClose" type="button">x</button></div><form class="mbd" id="opsEdit"><label>Title<input id="opsTitle" type="text" value="' + esc(it.title) + '" style="width:100%;margin-top:4px"/></label><label style="display:block;margin-top:8px">Notes<textarea id="opsNotes" rows="4" style="width:100%;margin-top:4px">' + esc(it.notes || '') + '</textarea></label><div class="soft-err" id="opsEditErr"></div><button class="btn pri sm" type="submit" style="margin-top:10px">Save</button></form>';
    modal.classList.add('open');
    modal.hidden = false;
    document.getElementById('mClose').onclick = function () { if (typeof closeModal === 'function') closeModal(); };
    document.getElementById('opsEdit').onsubmit = function (e) {
      e.preventDefault();
      var next = document.getElementById('opsTitle').value.trim() || 'Untitled task';
      it.title = next;
      it.notes = document.getElementById('opsNotes').value;
      authFetch('/api/items', { method: 'PATCH', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: id, title: next, notes: it.notes }) }).then(function (r) { if (!r.ok) throw 0; if (typeof closeModal === 'function') closeModal(); return authFetch('/api/board', { credentials: 'same-origin' }); }).then(function (r) { return r.json(); }).then(applyBoard).catch(function () { var err = document.getElementById('opsEditErr'); if (err) err.textContent = 'Not saved yet'; renderWar(); });
    };
  }

  function openSlots() {
    var card = document.getElementById('modalCard');
    var modal = document.getElementById('modal');
    if (!card || !modal) return;
    card.classList.add('wide');
    card.innerHTML = '<div class="mhd"><div style="font-weight:700">Open 30-minute slots</div><button class="x" id="mClose" type="button">x</button></div><div class="mbd" id="slotList">Reading the calendar.</div>';
    modal.classList.add('open');
    modal.hidden = false;
    document.getElementById('mClose').onclick = function () { if (typeof closeModal === 'function') closeModal(); };
    authFetch('/api/calendar/slots', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (data) {
      var list = document.getElementById('slotList');
      if (!list) return;
      var slots = data.slots || [];
      var days = [];
      slots.forEach(function (slot) { if (days.indexOf(slot.day) < 0) days.push(slot.day || 'Today'); });
      list.innerHTML = (data.error ? '<div class="kick">' + esc(data.error) + '</div>' : '') + '<div class="slot-cal">' + (days.length ? days : ['Today']).map(function (day) {
        var rows = slots.filter(function (slot) { return (slot.day || 'Today') === day; });
        return '<div class="slot-day"><div class="day">' + esc(day) + '</div>' + rows.map(function (slot) {
          var time = String(slot.label || '').split(' ').pop();
          return '<button class="slot" type="button" data-start="' + slot.start + '"' + (slot.free ? '' : ' disabled') + '>' + esc(time) + (slot.free ? '' : ' busy') + '</button>';
        }).join('') + '</div>';
      }).join('') + '</div>';
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
    var rest = top ? [top].concat(rows.filter(function (item) { return item !== top; })) : rows;
    function card(item, wide) {
      var tint = TINT[item.category] || '#E7EEF6';
      var when = item.publishedAt ? new Date(item.publishedAt).toLocaleDateString('en-CA') : '';
      var shot = item.image ? '<img alt="" src="' + esc(item.image) + '" onerror="this.hidden=true"/>' : esc(item.category || '');
      return '<button type="button" class="news-card' + (wide ? ' wide' : '') + '" data-news-url="' + esc(item.url || '') + '" data-news-title="' + esc(item.title || '') + '" data-news-why="' + esc(item.summary || '') + '"><div class="shot" style="background:' + tint + '">' + shot + '</div><div style="padding:12px"><b>' + esc(item.title || '') + '</b><div class="kick">' + esc(item.summary || '') + '</div><div class="kick">' + esc(when) + '</div></div></button>';
    }
    var empty = rows.length ? '' : '<div class="kick">The 8:00 and 11:00 Pacific sweeps fill this. Refresh pulls a fresh scrape.</div>';
    el.innerHTML = '<div class="news-wrap"><div class="cap"><div class="seg" id="newsSpan"><button type="button" data-span="week"' + (STATE.newsSpan === 'week' ? ' class="on"' : '') + '>Last week</button><button type="button" data-span="month"' + (STATE.newsSpan === 'week' ? '' : ' class="on"') + '>Last month</button></div><button class="btn sm" id="newsRefresh" type="button">Refresh</button></div><div class="news-chips">' + ['All'].concat(cats.filter(function (c) { return c !== 'All'; })).map(function (c) { return '<button type="button" class="' + (c === on ? 'on' : '') + '" data-news="' + esc(c) + '">' + esc(c) + (c === 'All' ? '' : ' <span data-news-del="' + esc(c) + '" aria-label="Remove category">x</span>') + '</button>'; }).join('') + '</div><div class="news-grid">' + empty + rest.map(function (item) { return card(item, false); }).join('') + '</div></div>';
    el.querySelectorAll('[data-span]').forEach(function (btn) {
      btn.onclick = function () {
        STATE.newsSpan = btn.getAttribute('data-span') === 'month' ? 'month' : 'week';
        loadNews();
      };
    });
    el.querySelectorAll('[data-news]').forEach(function (btn) {
      btn.onclick = function () { STATE.newsCat = btn.getAttribute('data-news'); renderNews(STATE.news || [], STATE.newsCategories || cats); };
    });
    el.querySelectorAll('.news-card').forEach(function (btn) {
      btn.onclick = function () { if (typeof openLink === 'function') openLink(btn.getAttribute('data-news-title'), btn.getAttribute('data-news-url')); };
    });
    var refresh = document.getElementById('newsRefresh');
    if (refresh) refresh.onclick = function () {
      refresh.disabled = true;
      authFetch('/api/news/refresh', { method: 'POST', credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (data) {
        STATE.news = data.items || [];
        STATE.newsCategories = data.categories || STATE.newsCategories;
        renderNews(STATE.news, STATE.newsCategories);
      }).catch(function () { refresh.disabled = false; });
    };
    el.querySelectorAll('[data-news-del]').forEach(function (btn) {
      btn.onclick = function (e) {
        e.stopPropagation();
        if (!window.confirm('Remove this category? Articles stay.')) return;
        authFetch('/api/news/categories/' + encodeURIComponent(btn.getAttribute('data-news-del')), { method: 'DELETE', credentials: 'same-origin' }).then(loadNews).catch(function () {});
      };
    });
  }

  function loadNews() {
    authFetch('/api/news' + (STATE.newsSpan === 'week' ? '?span=week' : '?span=month'), { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (data) {
      STATE.news = data.items || [];
      STATE.newsCategories = data.categories || [];
      renderNews(STATE.news, STATE.newsCategories);
    }).catch(function () { renderNews([], ['Compliance', 'AI', 'Counseling', 'Fintech & regulation', 'Mortgage', 'Fraud & scams', 'Grants', 'Payments / FINTRAC']); });
  }

  function flatFiles(nodes, out) {
    (nodes || []).forEach(function (node) {
      (node.files || node.docs || []).forEach(function (file) { out.push(file); });
      flatFiles(node.children || node.folders || [], out);
    });
    return out;
  }

  function libFolders() {
    var names = (STATE.docFolders && STATE.docFolders.length ? STATE.docFolders.slice() : CATS.slice());
    (STATE.staged || []).forEach(function (d) { if (d.category && names.indexOf(d.category) < 0) names.push(d.category); });
    return names;
  }

  function renderLibrary() {
    var el = document.getElementById('opsLibrary');
    if (!el || el.hidden) return;
    var docs = STATE.staged || [];
    var folders = libFolders();
    el.innerHTML = '<div class="lb-add" id="libDrop">drag documents here, or <label class="btn sm">choose files<input id="libUpload" class="file-in" type="file" multiple></label></div><div class="cap" style="margin:10px 0"><input id="libFolderName" type="text" placeholder="New folder name" aria-label="New folder name"><button class="btn sm" id="libAddFolder" type="button">Add a folder</button><span class="kick">Pull a Drive file into</span><select id="libCat" aria-label="Folder">' + folders.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('') + '</select><select id="libFile" aria-label="Drive file"><option value="">Choose a Drive file</option>' + flatFiles(STATE.drives || [], []).map(function (file) { return '<option value="' + esc(file.id) + '" data-url="' + esc(file.url || '') + '" data-name="' + esc(file.name || '') + '">' + esc(file.name || 'File') + '</option>'; }).join('') + '</select><button class="btn sm" id="libPull" type="button">Pull into this folder</button><button class="btn sm" id="libPush" type="button">Push this folder to Drive</button></div><div class="lib-grid">' + folders.map(function (c) {
      var n = docs.filter(function (d) { return d.category === c; }).length;
      var mine = docs.filter(function (d) { return d.category === c; }).slice(0, 9);
      var tiles = mine.map(function (d) {
        var image = (d.mime || '').indexOf('image/') === 0;
        var kind = ((d.name || '').split('.').pop() || 'file').slice(0, 4).toUpperCase();
        var pdf = (d.mime || '') === 'application/pdf' || /\.pdf$/i.test(d.name || '');
        var src = image ? ('/api/documents/file?id=' + encodeURIComponent(d.id)) : (d.driveFileId ? ('https://drive.google.com/thumbnail?id=' + encodeURIComponent(d.driveFileId) + '&sz=w400') : '');
        var page = (!src && pdf) ? '<span class="page-shot"><iframe title="" src="/api/documents/file?id=' + encodeURIComponent(d.id) + '#page=1"></iframe></span>' : '';
        var face = (src ? '<img alt="" src="' + src + '" onload="var k=this.parentNode.querySelector(\'.dk\');if(k)k.hidden=true" onerror="this.hidden=true"/>' : '') + page + '<span class="dk"' + (src || page ? ' hidden' : '') + '>' + esc(kind) + '</span>';
        return '<div class="mini-wrap" draggable="true" data-lib-inline="' + esc(d.id) + '"><button type="button" class="ghost-x" data-lib-x="' + esc(d.id) + '" aria-label="Delete file">x</button><button type="button" class="mini">' + face + '<em>' + esc(d.name || 'File') + '</em>' + (d._err ? '<em class="soft-err">' + esc(d._err) + '</em>' : '') + '</button></div>';
      }).join('');
      return '<div class="lib-card" data-cat="' + esc(c) + '"><div class="lib-h"><input data-lib-rename="' + esc(c) + '" value="' + esc(c) + '" aria-label="Folder name"><button type="button" class="ghost-x" data-lib-folder-x="' + esc(c) + '" aria-label="Delete folder">x</button><div class="kick">' + n + ' files</div></div><div class="lib-mini">' + tiles + '</div></div>';
    }).join('') + '</div><button type="button" class="btn sm" id="libInc" style="margin-top:10px">Top incumbents</button>';
    var pull = document.getElementById('libPull');
    if (pull) pull.onclick = function () {
      var sel = document.getElementById('libFile');
      var opt = sel.options[sel.selectedIndex];
      if (!opt || !opt.value) return;
      authFetch('/api/documents', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'pull', category: document.getElementById('libCat').value, name: opt.getAttribute('data-name'), url: opt.getAttribute('data-url'), driveFileId: opt.value }) }).then(loadLibrary).catch(function () {});
    };
    var push = document.getElementById('libPush');
    if (push) push.onclick = function () {
      authFetch('/api/documents', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'push', category: document.getElementById('libCat').value }) }).then(function (r) { return r.json(); }).then(function (d) { if (d && d.error) window.alert(d.error); }).catch(function () {});
    };
    function takeFiles(files, category) {
      var cat = category || (document.getElementById('libCat') ? document.getElementById('libCat').value : 'Dev');
      if (!cat) cat = 'Dev';
      var list = [].slice.call(files || []);
      if (!list.length) return;
      if (typeof deskBusy === 'function') deskBusy(true);
      var jobs = list.map(function (file) {
        var temp = 'tmp-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
        STATE.staged = (STATE.staged || []).concat([{ id: temp, category: cat, name: file.name || 'File', mime: file.type || '', driveFileId: '', url: '' }]);
        var body = new FormData();
        body.append('file', file);
        body.append('category', cat);
        body.append('name', file.name || 'File');
        body.append('mime', file.type || '');
        return authFetch('/api/documents/upload', { method: 'POST', credentials: 'same-origin', body: body }).then(function (r) {
          return r.json().then(function (d) { return { ok: !!(r.ok && d && d.ok), temp: temp }; });
        }).catch(function () { return { ok: false, temp: temp }; });
      });
      renderLibrary();
      Promise.all(jobs).then(function (results) {
        if (typeof deskBusy === 'function') deskBusy(false);
        var failed = results.filter(function (row) { return !row.ok; });
        if (!failed.length) { loadLibrary(); return; }
        failed.forEach(function (row) {
          var hit = (STATE.staged || []).filter(function (d) { return d.id === row.temp; })[0];
          if (hit) hit._err = 'Not saved yet';
        });
        renderLibrary();
      });
    }
    var drop = document.getElementById('libDrop');
    var upload = document.getElementById('libUpload');
    if (upload) upload.onchange = function () { takeFiles(upload.files, document.getElementById('libCat').value); };
    if (drop) {
      drop.ondragover = function (e) { e.preventDefault(); };
      drop.ondrop = function (e) { e.preventDefault(); takeFiles(e.dataTransfer.files, document.getElementById('libCat').value); };
    }
    function openFolder(cat) {
      var modal = document.getElementById('modal');
      var box = document.getElementById('modalCard');
      if (!modal || !box) return;
      var files = docs.filter(function (d) { return d.category === cat; });
      box.classList.add('wide');
      var mode = 'grid';
      try { mode = localStorage.getItem('cr_lib_mode') || 'grid'; } catch (err) { mode = 'grid'; }
      box.innerHTML = '<div class="mhd"><div style="font-weight:700">' + esc(cat) + '</div><div class="seg" id="libMode"><button type="button" data-lib-mode="list"' + (mode === 'list' ? ' class="on"' : '') + '>List</button><button type="button" data-lib-mode="grid"' + (mode === 'grid' ? ' class="on"' : '') + '>Thumbnails</button></div><button class="x" id="mClose" type="button">x</button></div><div class="mbd"><div class="lib-pop' + (mode === 'list' ? ' list' : '') + '">' + (files.map(function (d) {
        var image = (d.mime || '').indexOf('image/') === 0;
        var kind = ((d.name || '').split('.').pop() || (d.mime || 'file').split('/').pop() || 'file').slice(0, 8).toUpperCase();
        var thumb = image ? '<img alt="" src="/api/documents/file?id=' + encodeURIComponent(d.id) + '">' : '<span class="type">' + esc(kind) + '</span>';
        return '<div class="lib-tile"><button type="button" data-lib-open="' + esc(d.id) + '">' + thumb + '<span class="dn">' + esc(d.name) + '</span></button><button type="button" data-lib-del="' + esc(d.id) + '" aria-label="Remove">x</button></div>';
      }).join('') || '<div class="kick">No files in this folder yet.</div>') + '</div></div>';
      modal.classList.add('open');
      modal.hidden = false;
      document.getElementById('mClose').onclick = function () { if (typeof closeModal === 'function') closeModal(); };
      box.querySelectorAll('[data-lib-mode]').forEach(function (btn) {
        btn.onclick = function () {
          try { localStorage.setItem('cr_lib_mode', btn.getAttribute('data-lib-mode') || 'grid'); } catch (err) {}
          openFolder(cat);
        };
      });
      box.querySelectorAll('[data-lib-open]').forEach(function (btn) {
        btn.onclick = function () {
          var doc = files.filter(function (d) { return d.id === btn.getAttribute('data-lib-open'); })[0];
          if (!doc) return;
          var url = doc.driveFileId ? ('https://drive.google.com/file/d/' + encodeURIComponent(doc.driveFileId) + '/preview') : (doc.url || ('/api/documents/file?id=' + encodeURIComponent(doc.id)));
          openDocView(doc.name, url, '');
        };
      });
      box.querySelectorAll('[data-lib-del]').forEach(function (btn) {
        btn.onclick = function () {
          authFetch('/api/documents', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'remove', id: btn.getAttribute('data-lib-del') }) }).then(function () { if (typeof closeModal === 'function') closeModal(); loadLibrary(); }).catch(function () {});
        };
      });
    }
    var addFolder = document.getElementById('libAddFolder');
    if (addFolder) addFolder.onclick = function () {
      var box = document.getElementById('libFolderName');
      var name = box && box.value.trim() ? box.value.trim() : 'Untitled folder';
      STATE.docFolders = libFolders();
      if (STATE.docFolders.indexOf(name) < 0) STATE.docFolders.push(name);
      if (box) box.value = '';
      renderLibrary();
      authFetch('/api/documents', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'add-folder', name: name }) }).then(function (r) { return r.json(); }).then(function (d) {
        if (d && d.saved === false) return;
        loadLibrary();
      }).catch(function () {});
    };
    el.querySelectorAll('[data-lib-rename]').forEach(function (box) {
      box.onclick = function (e) { e.stopPropagation(); };
      box.onblur = function () {
        var from = box.getAttribute('data-lib-rename') || '';
        var name = box.value.trim() || from;
        if (!from || name === from) return;
        (STATE.staged || []).forEach(function (d) { if (d.category === from) d.category = name; });
        STATE.docFolders = libFolders().map(function (c) { return c === from ? name : c; });
        renderLibrary();
        authFetch('/api/documents', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'rename-folder', from: from, name: name }) }).catch(function () {});
      };
    });
    el.querySelectorAll('[data-lib-folder-x]').forEach(function (btn) {
      btn.onclick = function (e) {
        e.stopPropagation();
        var name = btn.getAttribute('data-lib-folder-x') || '';
        if (!name || !window.confirm('Delete this folder? Files move to Uncategorized.')) return;
        (STATE.staged || []).forEach(function (d) { if (d.category === name) d.category = 'Uncategorized'; });
        STATE.docFolders = libFolders().filter(function (c) { return c !== name; });
        if (STATE.docFolders.indexOf('Uncategorized') < 0) STATE.docFolders.push('Uncategorized');
        renderLibrary();
        authFetch('/api/documents', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'remove-folder', name: name }) }).catch(function () {});
      };
    });
    el.querySelectorAll('[data-lib-x]').forEach(function (btn) {
      btn.onclick = function (e) {
        e.stopPropagation();
        var id = btn.getAttribute('data-lib-x') || '';
        STATE.staged = (STATE.staged || []).filter(function (d) { return d.id !== id; });
        renderLibrary();
        if (id.indexOf('tmp-') === 0) return;
        authFetch('/api/documents', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'remove', id: id }) }).catch(function () {});
      };
    });
    var inc = document.getElementById('libInc');
    if (inc) inc.onclick = function () {
      var names = ['Vanta|https://www.vanta.com', 'Drata|https://drata.com', 'Secureframe|https://secureframe.com', 'Thoropass|https://thoropass.com', 'AutoRek|https://www.autorek.com', 'Aveni|https://aveni.ai', 'Fenergo|https://www.fenergo.com', 'Hummingbird|https://hummingbird.co', 'ComplyAdvantage|https://complyadvantage.com', 'Trulioo|https://www.trulioo.com'];
      var modal = document.getElementById('modal');
      var box = document.getElementById('modalCard');
      if (!modal || !box) return;
      box.classList.add('wide');
      box.innerHTML = '<div class="mhd"><div style="font-weight:700">Top incumbents</div><button class="x" id="mClose" type="button">x</button></div><div class="mbd">' + names.map(function (row) { var bits = row.split('|'); return '<button type="button" class="ops-row" data-inc="' + esc(bits[1]) + '" data-name="' + esc(bits[0]) + '"><b>' + esc(bits[0]) + '</b></button>'; }).join('') + '</div>';
      modal.classList.add('open');
      modal.hidden = false;
      document.getElementById('mClose').onclick = function () { if (typeof closeModal === 'function') closeModal(); };
      box.querySelectorAll('[data-inc]').forEach(function (btn) {
        btn.onclick = function () { openDocView(btn.getAttribute('data-name'), btn.getAttribute('data-inc'), 'Reference incumbent.'); };
      });
    };
    el.querySelectorAll('.mini-wrap').forEach(function (mini) {
      mini.ondragstart = function (e) {
        if (!e.dataTransfer) return;
        var id = mini.getAttribute('data-lib-inline') || '';
        e.dataTransfer.setData('text/plain', '4orm-doc:' + id);
        e.dataTransfer.effectAllowed = 'move';
        el._dragDoc = true;
      };
    });
    el.querySelectorAll('.lib-card').forEach(function (card) {
      card.ondragover = function (e) { e.preventDefault(); card.classList.add('over'); };
      card.ondragleave = function () { card.classList.remove('over'); };
      card.ondrop = function (e) {
        e.preventDefault();
        e.stopPropagation();
        card.classList.remove('over');
        var plain = '';
        try { plain = e.dataTransfer.getData('text/plain') || ''; } catch (err) { plain = ''; }
        if (plain.indexOf('4orm-doc:') === 0) {
          var id = plain.slice(9);
          var cat = card.getAttribute('data-cat') || '';
          var doc = (STATE.staged || []).filter(function (d) { return d.id === id; })[0];
          if (!doc || doc.category === cat || String(id).indexOf('tmp-') === 0) return;
          doc.category = cat;
          renderLibrary();
          authFetch('/api/documents', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'move', id: id, category: cat }) }).then(function (r) { return r.json(); }).then(function (d) {
            if (!d || d.ok === false) { doc._err = 'Not moved yet'; renderLibrary(); }
          }).catch(function () { doc._err = 'Not moved yet'; renderLibrary(); });
          return;
        }
        takeFiles(e.dataTransfer.files, card.getAttribute('data-cat'));
      };
      card.onclick = function (e) {
        if (el._dragDoc) { el._dragDoc = false; return; }
        if (e.target.closest('[data-lib-x],[data-lib-folder-x],[data-lib-rename]')) return;
        var mini = e.target.closest('.mini');
        if (mini) {
          var doc = docs.filter(function (d) { return d.id === mini.getAttribute('data-lib-inline'); })[0];
          if (!doc) return;
          var url = doc.driveFileId ? ('https://drive.google.com/file/d/' + encodeURIComponent(doc.driveFileId) + '/preview') : (doc.url || ('/api/documents/file?id=' + encodeURIComponent(doc.id)));
          openDocView(doc.name, url, '');
          return;
        }
        openFolder(card.getAttribute('data-cat'));
      };
    });
  }

  function loadLibrary() {
    authFetch('/api/documents', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (data) {
      STATE.staged = data.docs || [];
      STATE.docFolders = data.folders || data.categories || STATE.docFolders || CATS;
      renderLibrary();
    }).catch(function () { STATE.staged = []; renderLibrary(); });
  }

  function setLib() {
    var lib = document.getElementById('opsLibrary');
    if (lib) lib.hidden = false;
    loadLibrary();
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

  openDocView = function (name, url, note) {
    var view = document.getElementById('docView');
    document.getElementById('docViewName').textContent = name || 'Document';
    var driveBtn = document.getElementById('docViewDrive');
    var frame = document.getElementById('docViewFrame');
    var fail = document.getElementById('docFallback');
    if (!fail) {
      fail = document.createElement('div');
      fail.id = 'docFallback';
      fail.style.padding = '24px';
      frame.parentNode.insertBefore(fail, frame.nextSibling);
    }
    frame.hidden = false;
    fail.hidden = true;
    view.hidden = false;
    var preview = typeof drivePreview === 'function' ? drivePreview(url) : '';
    if (driveBtn) {
      driveBtn.hidden = !preview;
      driveBtn.onclick = function () { if (preview) frame.src = preview; };
    }
    if (typeof deskBusy === 'function') deskBusy(true);
    function done() { if (typeof deskBusy === 'function') deskBusy(false); }
    function showBlob(blob) {
      var type = blob && blob.type || '';
      var ok = type.indexOf('image/') === 0 || type === 'application/pdf' || type.indexOf('text/') === 0;
      if (!ok) throw 0;
      frame.hidden = false;
      fail.hidden = true;
      frame.src = URL.createObjectURL(blob);
    }
    if (url && url.indexOf('/api/documents/file') === 0) {
      frame.src = 'about:blank';
      authFetch(url, { credentials: 'same-origin' }).then(function (r) {
        if (!r.ok) throw 0;
        return r.blob();
      }).then(showBlob).catch(function () {
        frame.hidden = true;
        fail.hidden = false;
        fail.innerHTML = '<p>' + esc(note || 'This file cannot be previewed here.') + '</p>';
      }).then(done, done);
      return;
    }
    if (!preview) {
      frame.hidden = true;
      fail.hidden = false;
      fail.innerHTML = '<p>' + esc(note || 'This file cannot be previewed here.') + '</p>';
      done();
      return;
    }
    frame.src = preview;
    var id = '';
    try {
      var parsed = new URL(preview);
      var match = parsed.pathname.match(/\/d\/([^/]+)/);
      id = match ? match[1] : '';
    } catch (err) { id = ''; }
    if (!id) { done(); return; }
    authFetch('/api/drive/file?id=' + encodeURIComponent(id), { credentials: 'same-origin' }).then(function (r) {
      if (!r.ok) throw 0;
      return r.blob();
    }).then(showBlob).catch(function () {}).then(done, done);
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
    var body = document.querySelector('#drawer .db');
    if (STATE.desk === 'contacts') {
    document.querySelectorAll('#drawer .fld').forEach(function (field) {
      if ((field.textContent || '').indexOf('Phone') === 0) field.remove();
    });
    if (body && !document.getElementById('logPipe')) {
      body.insertAdjacentHTML('beforeend', '<div class="cap"><button class="btn sm" id="logPipe" type="button">Log note</button><button class="btn sm" id="ghlOpen" type="button">Open in GHL</button></div><textarea id="pipeNote" rows="3" placeholder="Note" style="width:100%;margin-top:8px"></textarea>');
      document.getElementById('logPipe').onclick = function () {
        authFetch('/api/contacts', { method: 'PATCH', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: id, notes: document.getElementById('pipeNote').value }) }).catch(function () {});
      };
      document.getElementById('ghlOpen').onclick = function () {
        openDocView('GoHighLevel', '', 'This record stays on the desk. GoHighLevel remains the source of truth.');
      };
    }
    }
    if (body && !document.getElementById('addReach')) {
      var c = (STATE.contacts || []).filter(function (row) { return row.id === id; })[0] || {};
      body.insertAdjacentHTML('beforeend', '<div class="cap" style="margin-top:10px"><span class="kick">Add to Reach out</span><span class="bucket-picks" id="reachKind"><button type="button" data-rk="corporate" class="on">Corporate</button><button type="button" data-rk="vc">VC</button><button type="button" data-rk="client">Client</button><button type="button" data-rk="design">Design partner</button><button type="button" data-rk="regulator">Regulator</button></span><button class="btn sm" id="addReach" type="button">Add to Reach out</button><button class="btn sm" id="addSpace" type="button">Add to a Space</button></div>');
      body.querySelectorAll('[data-rk]').forEach(function (btn) {
        btn.onclick = function () {
          body.querySelectorAll('[data-rk]').forEach(function (other) { other.classList.remove('on'); });
          btn.classList.add('on');
        };
      });
      document.getElementById('addReach').onclick = function () {
        var picked = body.querySelector('[data-rk].on');
        var kind = picked ? picked.getAttribute('data-rk') : 'corporate';
        var person = { id: 'tmp-' + Date.now(), name: c.name || 'Person', company: c.company || '', kind: kind, nextAction: c.nextAction || 'Reach out', done: false, contactId: id };
        STATE.reachOut = (STATE.reachOut || []).concat([person]);
        authFetch('/api/reach-out', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: person.name, company: person.company, kind: kind, contactId: id, nextAction: person.nextAction }) }).then(loadReach).catch(function () {});
      };
      document.getElementById('addSpace').onclick = function () {
        var modal = document.getElementById('modal');
        var box = document.getElementById('modalCard');
        if (!modal || !box) return;
        var rows = STATE.packages || [];
        box.classList.add('wide');
        box.innerHTML = '<div class="mhd"><div style="font-weight:700">Add to a Space</div><button class="x" id="mClose" type="button">x</button></div><div class="mbd">' + (rows.length ? rows.map(function (space) { return '<button type="button" class="ops-row" data-space-add="' + esc(space.id) + '"><b>' + esc(space.name || 'Space') + '</b></button>'; }).join('') : '<div class="kick">No spaces yet.</div>') + '</div>';
        modal.classList.add('open');
        modal.hidden = false;
        document.getElementById('mClose').onclick = function () { if (typeof closeModal === 'function') closeModal(); };
        box.querySelectorAll('[data-space-add]').forEach(function (btn) {
          btn.onclick = function () {
            authFetch('/api/spaces/' + btn.getAttribute('data-space-add'), { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'add-recipient', contactId: id, name: c.name || 'Person', email: c.email || '', role: c.role || '', listed: false }) }).then(function () { if (typeof closeModal === 'function') closeModal(); }).catch(function () {});
          };
        });
      };
    }
  };

  var priorApply = applyBoard;
  applyBoard = function (data) {
    priorApply(data);
    renderOpsDash();
    renderWar();
    renderDeskNotes();
    loadReach();
    if (STATE.desk === 'news') loadNews();
    if (STATE.desk === 'contacts') loadInbox();
  };
  var priorSwitch = switchView;
  switchView = function (v) {
    priorSwitch(v);
    if (v === 'news') loadNews();
    if (v === 'docs') setLib('library');
    if (v === 'drive') renderDocs();
    if (v === 'contacts') loadInbox();
    if (v === 'room') renderOpsDash();
    if (v === 'war') { loadReach(); renderWar(); }
    if (v === 'notes') renderSticky();
    if (v === 'znotes') renderZNotes();
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
    authFetch('/api/spaces/' + btn.getAttribute('data-push-card'), { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'push-drive' }) }).catch(function () {});
  }, true);
  var zoom = document.getElementById('v-znotes');
  if (zoom && !document.getElementById('zoomForm')) {
    zoom.insertAdjacentHTML('afterbegin', '<form id="zoomForm" class="lb-add" style="margin-bottom:12px"><input id="zoomId" type="hidden" value=""/><input id="zoomTitle" type="text" placeholder="Title" style="flex:1"/><input id="zoomPeople" type="text" placeholder="Attendees" style="flex:1"/><textarea id="zoomOthers" rows="2" placeholder="What others said" style="flex:1"></textarea><button class="btn pri sm" type="submit">Save</button></form>');
    document.getElementById('zoomForm').onsubmit = function (e) {
      e.preventDefault();
      var id = document.getElementById('zoomId').value;
      var payload = { title: document.getElementById('zoomTitle').value, attendees: document.getElementById('zoomPeople').value, others: document.getElementById('zoomOthers').value };
      var req = id ? authFetch('/api/zoom/' + id, { method: 'PATCH', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }) : authFetch('/api/zoom', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      req.then(function () { document.getElementById('zoomForm').reset(); return authFetch('/api/board', { credentials: 'same-origin' }); }).then(function (r) { return r.json(); }).then(applyBoard).catch(function () {});
    };
  }
  var priorZ = renderZNotes;
  renderZNotes = function () {
    priorZ();
    var grid = document.getElementById('zGrid');
    if (!grid) return;
    grid.querySelectorAll('.zrow').forEach(function (row) {
      var open = row.querySelector('[data-z]');
      var id = open ? open.getAttribute('data-z') : '';
      if (!id || row.querySelector('[data-zdel]')) return;
      row.insertAdjacentHTML('beforeend', '<button type="button" data-zedit="' + id + '">Edit</button><button type="button" data-zdel="' + id + '">Delete</button>');
    });
    grid.querySelectorAll('[data-zdel]').forEach(function (btn) {
      btn.onclick = function () {
        if (!window.confirm('Delete this meeting note?')) return;
        authFetch('/api/zoom/' + btn.getAttribute('data-zdel'), { method: 'DELETE', credentials: 'same-origin' }).then(function () { return authFetch('/api/board', { credentials: 'same-origin' }); }).then(function (r) { return r.json(); }).then(applyBoard).catch(function () {});
      };
    });
    grid.querySelectorAll('[data-zedit]').forEach(function (btn) {
      btn.onclick = function () {
        var note = (STATE.zoomNotes || []).filter(function (n) { return n.id === btn.getAttribute('data-zedit'); })[0];
        if (!note) return;
        document.getElementById('zoomId').value = note.id;
        document.getElementById('zoomTitle').value = note.title || '';
        document.getElementById('zoomPeople').value = (note.attendees || []).join(', ');
        document.getElementById('zoomOthers').value = (note.others || []).join('\n');
      };
    });
  };
  function renderSticky() {
    var host = document.getElementById('stickyDesk');
    if (!host) return;
    var colours = ['yellow', 'blue', 'green', 'pink'];
    function paint(notes) {
      host.innerHTML = '<div class="sec-h"><h3>Notes</h3><button class="btn pri sm" id="stickAdd" type="button">+ New note</button></div><div class="sticky-board" id="stickBoard"></div>';
      var board = document.getElementById('stickBoard');
      board.innerHTML = notes.map(function (note) {
        return '<div class="sticky ' + esc(note.color || 'yellow') + '" data-stick="' + esc(note.id) + '" style="left:' + (Number(note.x) || 24) + 'px;top:' + (Number(note.y) || 24) + 'px;width:' + (Number(note.w) || 180) + 'px;height:' + (Number(note.h) || 140) + 'px"><div class="dots">' + colours.map(function (c) { return '<button type="button" class="' + c + ((note.color || 'yellow') === c ? ' on' : '') + '" data-color="' + c + '" aria-label="' + c + '"></button>'; }).join('') + '</div><textarea rows="4">' + esc(note.body || '') + '</textarea>' + (note._err ? '<div class="soft-err">' + esc(note._err) + '</div>' : '') + '<button type="button" class="ghost-x" data-stick-del="' + esc(note.id) + '" aria-label="Delete">x</button><button type="button" class="stick-size" data-stick-size="' + esc(note.id) + '" aria-label="Resize"></button></div>';
      }).join('');
      document.getElementById('stickAdd').onclick = function () {
        var temp = { id: 'tmp-' + Date.now(), body: '', color: 'yellow', x: 24 + (notes.length % 4) * 28, y: 24 + (notes.length % 3) * 20 };
        notes.push(temp);
        paint(notes);
        var area = host.querySelector('[data-stick="' + temp.id + '"] textarea');
        if (area) area.focus();
        authFetch('/api/notes/sticky', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ body: '', color: 'yellow', x: temp.x, y: temp.y }) }).then(function (r) { if (!r.ok) throw 0; return r.json();         }).then(function (saved) {
          var card = host.querySelector('[data-stick="' + temp.id + '"]');
          temp.id = saved.id || temp.id;
          if (card && saved.id) card.setAttribute('data-stick', saved.id);
          var area = card && card.querySelector('textarea');
          if (saved.id && area && (area.value || temp.color !== 'yellow')) {
            authFetch('/api/notes/' + saved.id, { method: 'PATCH', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ body: area.value, color: temp.color, x: card.offsetLeft, y: card.offsetTop }) }).catch(function () {});
          }
        }).catch(function () { temp._err = 'Not saved yet'; var card = host.querySelector('[data-stick="' + temp.id + '"]'); if (card && !card.querySelector('.soft-err')) card.insertAdjacentHTML('beforeend', '<div class="soft-err">Not saved yet</div>'); });
      };
      board.querySelectorAll('[data-stick-del]').forEach(function (btn) {
        btn.onclick = function () {
          var id = btn.getAttribute('data-stick-del');
          var left = notes.filter(function (note) { return note.id !== id; });
          notes.splice(0, notes.length);
          left.forEach(function (note) { notes.push(note); });
          paint(notes);
          if (String(id).indexOf('tmp-') === 0) return;
          authFetch('/api/notes/' + id, { method: 'DELETE', credentials: 'same-origin' }).catch(function () {});
        };
      });
      board.querySelectorAll('[data-stick-size]').forEach(function (handle) {
        handle.onpointerdown = function (e) {
          e.preventDefault();
          e.stopPropagation();
          var card = handle.closest('.sticky');
          if (!card) return;
          var sx = e.clientX;
          var sy = e.clientY;
          var sw = card.offsetWidth;
          var sh = card.offsetHeight;
          function move(ev) {
            card.style.width = Math.max(140, sw + ev.clientX - sx) + 'px';
            card.style.height = Math.max(100, sh + ev.clientY - sy) + 'px';
          }
          function up() {
            document.removeEventListener('pointermove', move);
            document.removeEventListener('pointerup', up);
            var id = card.getAttribute('data-stick');
            if (String(id).indexOf('tmp-') === 0) return;
            authFetch('/api/notes/' + id, { method: 'PATCH', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ w: card.offsetWidth, h: card.offsetHeight }) }).catch(function () {});
          }
          document.addEventListener('pointermove', move);
          document.addEventListener('pointerup', up);
        };
      });
      board.querySelectorAll('.sticky').forEach(function (card) {
        var area = card.querySelector('textarea');
        area.oninput = function () {
          var note = notes.filter(function (row) { return row.id === card.getAttribute('data-stick'); })[0];
          if (note) note.body = area.value;
        };
        area.onchange = function () {
          var id = card.getAttribute('data-stick');
          if (String(id).indexOf('tmp-') === 0) return;
          authFetch('/api/notes/' + id, { method: 'PATCH', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ body: area.value }) }).catch(function () {});
        };
        card.querySelectorAll('[data-color]').forEach(function (dot) {
          dot.onclick = function (e) {
            e.stopPropagation();
            var color = dot.getAttribute('data-color');
            card.className = 'sticky ' + color;
            card.querySelectorAll('[data-color]').forEach(function (node) { node.classList.toggle('on', node === dot); });
            var note = notes.filter(function (row) { return row.id === card.getAttribute('data-stick'); })[0];
            if (note) note.color = color;
            var id = card.getAttribute('data-stick');
            if (String(id).indexOf('tmp-') === 0) return;
            authFetch('/api/notes/' + id, { method: 'PATCH', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ color: color }) }).catch(function () {});
          };
        });
        card.onpointerdown = function (e) {
          if (e.target.closest('textarea,button,select')) return;
          var sx = e.clientX - card.offsetLeft;
          var sy = e.clientY - card.offsetTop;
          function move(ev) { card.style.left = (ev.clientX - sx) + 'px'; card.style.top = (ev.clientY - sy) + 'px'; }
          function up() {
            document.removeEventListener('pointermove', move);
            document.removeEventListener('pointerup', up);
            var id = card.getAttribute('data-stick');
            var note = notes.filter(function (row) { return row.id === id; })[0];
            if (note) { note.x = card.offsetLeft; note.y = card.offsetTop; }
            if (String(id).indexOf('tmp-') === 0) return;
            authFetch('/api/notes/' + id, { method: 'PATCH', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ x: card.offsetLeft, y: card.offsetTop }) }).catch(function () {});
          }
          document.addEventListener('pointermove', move);
          document.addEventListener('pointerup', up);
        };
      });
    }
    authFetch('/api/notes/sticky', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (data) { paint(data.notes || []); }).catch(function () { paint([]); var board = document.getElementById('stickBoard'); if (board) board.insertAdjacentHTML('afterbegin', '<div class="soft-err">Notes could not load. A new note still stays on this board.</div>'); });
  }
  document.addEventListener('click', function (e) {
    var link = e.target.closest('a[target="_blank"]');
    if (!link) return;
    e.preventDefault();
    openDocView(link.textContent || 'Link', link.getAttribute('href') || '', '');
  }, true);
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
