/* News: Saved collections (design 13b-news-saved.html).
   Feed / Saved toggle, the "Save to collections" popover, the Saved view (Just in strip, collections rail,
   collection header actions, saved rows). Rendered inside the News shadow root by renderNews
   (control-room-ops.js) through window.__newsSaved.html(). Every control is a data-action handled by the
   single delegated bus in desk-actions.js (handlers are added to window.deskActions).
   Server: /api/news/collections (GET, POST), /api/news/collections/:id (PATCH, DELETE soft),
   /api/news/collections/:id/export (Markdown download), /api/news/collections/saved (POST),
   /api/news/collections/saved/:id (PATCH, DELETE soft). No icons, no emoji, 24-hour times. */
(function () {
  var TZ = 'America/Vancouver';
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  var pend = null;
  var justRows = [];
  var loading = false;
  var undoFn = null;

  function fixtureOn() {
    try { return /(?:^|[?&])fixture=mockup(?:&|$)/.test(String(location.search || '')); } catch (e) { return false; }
  }
  function S() { return window.STATE || (window.STATE = {}); }
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function H() { return window.__newsHelpers || {}; }
  function api(url, opts) {
    opts = opts || {};
    var o = { method: opts.method || 'GET', credentials: 'same-origin', quiet: true, headers: {} };
    if (opts.body) { o.headers['content-type'] = 'application/json'; o.body = JSON.stringify(opts.body); }
    var fn = typeof window.authFetch === 'function' ? window.authFetch : fetch;
    return fn(url, o).then(function (r) {
      if (!r || !r.ok) {
        var status = r ? r.status : 0;
        return (r && r.json ? r.json().catch(function () { return {}; }) : Promise.resolve({})).then(function (d) {
          var err = new Error((d && d.error) || ('HTTP ' + status));
          err.status = status;
          throw err;
        });
      }
      return r.json();
    });
  }
  function dayLabel(ms) {
    if (!ms) return '';
    try { return new Date(ms).toLocaleDateString('en-CA', { timeZone: TZ, month: 'short', day: 'numeric' }); } catch (e) { return ''; }
  }
  function rerender() {
    if (typeof window.renderNews === 'function') window.renderNews((S().news) || []);
  }
  function newsRoot() {
    var host = document.getElementById('v-news');
    return (host && host.shadowRoot) || null;
  }

  /* ---------- fixture (design 13b data, used only with ?fixture=mockup) ---------- */
  var FX_C = [
    { k: 'why', n: '"Why now" proof', d: 'Regulator moves and fines that prove the problem is urgent', bg: '#fde9ec', c: '#e0364f', used: 'Seed deck slide 4' },
    { k: 'inv', n: 'Investor newsletter', d: 'Goes into the next investor update', bg: '#fff0e6', c: '#c2560c', used: 'November update draft' },
    { k: 'reg', n: 'Regulator note', d: 'Material for BCFSA / FSRA / FINTRAC conversations', bg: '#efeaff', c: '#6b4fd8', used: '' },
    { k: 'li', n: 'LinkedIn ideas', d: 'Stories worth a post in your voice', bg: '#e7f0fb', c: '#0a66c2', used: '2 posts drafted' },
    { k: 'vc', n: 'VC proof points', d: 'Market signals for VC conversations', bg: '#e4f6ee', c: '#12a36a', used: 'VC proof space' },
    { k: 'dp', n: 'Design-partner openers', d: 'Reasons for brokers and insurers to take a call', bg: '#eaf1fe', c: '#2e6bf2', used: '' },
    { k: 'res', n: 'Research paper', d: 'Sources for the suitability research paper', bg: '#f5f7fb', c: '#4a5672', used: '' },
    { k: 'cmp', n: 'Competitors', d: 'Moves by Vanta, Drata, Aveni and others', bg: '#fff4e0', c: '#c98408', used: '' }
  ];
  var FX_EXTRA = { why: 3, inv: 2, reg: 1, li: 3, vc: 2, dp: 1, res: 3, cmp: 1 };
  var FX_S = [
    { t: 'FINTRAC fines four credit unions $816,750', s: 'Canadian Mortgage Trends', d: 'Oct 12', img: 'https://www.canadianmortgagetrends.com/wp-content/uploads/2026/07/Court-ruling_sm.jpg', cat: 'Payments / FINTRAC', why: 'Regulators are penalising missed client reviews and undocumented risk assessments - the record a 4orm session produces automatically.', note: 'Use as the opener on slide 4 - 46 of 118 high-risk files unreviewed.', in: ['why', 'inv', 'reg'], used: 'Seed deck slide 4' },
    { t: 'OSFI warns AI could amplify cyber and technology risks for lenders', s: 'Canadian Mortgage Trends', d: 'Oct 8', img: 'https://www.canadianmortgagetrends.com/wp-content/uploads/2025/10/Peter-Routledge_med.jpg', cat: 'AI & governance', why: 'OSFI says governance and testing must keep pace with AI adoption. Supports the auditable-AI pitch.', note: '', in: ['why', 'vc', 'reg'], used: '' },
    { t: 'AI is making mortgage fraud harder to spot, Equifax warns', s: 'Canadian Mortgage Trends', d: 'Oct 13', img: 'https://www.canadianmortgagetrends.com/wp-content/uploads/2026/10/Mortgage-fraud2_sm.jpg', cat: 'Fraud', why: 'AI-forged income letters are slipping past underwriting. A design-partner talking point.', note: 'Send to Century 21 / Remax desks as a fraud-flag opener.', in: ['dp', 'li'], used: 'LinkedIn post drafted' },
    { t: 'AI-powered mortgage lender Northguard Financial to launch in 2027', s: 'Canadian Mortgage Trends', d: 'Oct 14', img: 'https://www.canadianmortgagetrends.com/wp-content/uploads/2026/10/Northguard-500x267.png', cat: 'Mortgage / brokerage', why: 'A new AI-first lender will need suitability evidence from day one - a possible design partner.', note: '', in: ['cmp', 'dp'], used: '' }
  ];
  var FX_JUST = [
    { title: 'FINTRAC fines four credit unions $816,750', source: 'Canadian Mortgage Trends', day: 'Oct 12', sug: ['why', 'inv', 'reg'] },
    { title: 'OSFI warns AI could amplify cyber and technology risks for lenders', source: 'Canadian Mortgage Trends', day: 'Oct 8', sug: ['why', 'vc', 'reg'] },
    { title: 'AI is making mortgage fraud harder to spot, Equifax warns', source: 'Canadian Mortgage Trends', day: 'Oct 13', sug: ['dp', 'li'] }
  ];
  function seedFixture() {
    if (S().newsColsLoaded) return;
    S().newsCols = FX_C.map(function (c) { return { id: c.k, key: c.k, name: c.n, description: c.d, bg: c.bg, color: c.c, usedIn: c.used, fixtureExtra: FX_EXTRA[c.k] || 0 }; });
    S().newsSavedRows = FX_S.map(function (s, i) {
      return { id: 'fx-' + i, url: '', title: s.t, source: s.s, image: s.img, category: s.cat, why: s.why, note: s.note, usedIn: s.used, collections: s.in.slice(), dayText: s.d, savedText: 'Oct 21' };
    });
    S().newsColsLoaded = true;
    if (!S().newsColCur) S().newsColCur = 'why';
  }

  /* ---------- data ---------- */
  function cols() { return S().newsCols || []; }
  function savedRows() { return S().newsSavedRows || []; }
  function colById(id) { return cols().filter(function (c) { return String(c.id) === String(id); })[0] || null; }
  function colCount(c) {
    var n = savedRows().filter(function (s) { return (s.collections || []).indexOf(c.id) >= 0; }).length;
    return n + (fixtureOn() ? (c.fixtureExtra || 0) : 0);
  }
  function savedByUrl(url) {
    if (!url) return null;
    return savedRows().filter(function (s) { return s.url === url; })[0] || null;
  }
  function load(force) {
    if (fixtureOn()) { seedFixture(); return; }
    if (loading || (S().newsColsLoaded && !force)) return;
    loading = true;
    api('/api/news/collections').then(function (d) {
      loading = false;
      S().newsCols = (d && d.collections) || [];
      S().newsSavedRows = (d && d.saved) || [];
      S().newsColsLoaded = true;
      S().newsColsErr = '';
      if (!colById(S().newsColCur) && cols()[0]) S().newsColCur = cols()[0].id;
      rerender();
    }).catch(function (err) {
      loading = false;
      S().newsColsLoaded = true;
      S().newsColsErr = err && err.status === 403 ? 'Saved collections are only open to the room owner.' : "Couldn't load your collections.";
      rerender();
    });
  }
  function upsertSaved(row) {
    var list = savedRows().slice();
    var at = -1;
    list.forEach(function (s, i) { if (String(s.id) === String(row.id)) at = i; });
    if (at >= 0) list[at] = row; else list.unshift(row);
    S().newsSavedRows = list;
  }

  /* Suggested collections by story category / text (default collection keys). */
  function suggest(item) {
    var cat = String((item && (item.category || '')) || '');
    if (H().cat && item) cat = H().cat(item);
    var blob = ((item && item.title) || '') + ' ' + ((item && item.summary) || '');
    var keys = ['inv'];
    if (/payments|fintrac/i.test(cat) || /\b(fine[sd]?|penalt\w*)\b/i.test(blob)) keys = ['why', 'inv', 'reg'];
    else if (/ai & governance/i.test(cat)) keys = ['why', 'vc', 'reg'];
    else if (/fraud|mortgage/i.test(cat)) keys = ['dp', 'li'];
    else if (/competitor/i.test(cat)) keys = ['cmp', 'vc'];
    else if (/housing/i.test(cat)) keys = ['inv', 'vc'];
    else if (/compliance|regtech/i.test(cat)) keys = ['reg', 'res'];
    return cols().filter(function (c) { return keys.indexOf(c.key) >= 0; }).map(function (c) { return c.id; });
  }

  /* ---------- toast (inside the News shadow root, design .toast) ---------- */
  function toast(msg, undo) {
    var root = newsRoot();
    if (!root) { if (typeof window.deskNote === 'function') window.deskNote(msg); return; }
    var el = root.querySelector('.toast.nsv-toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'toast nsv-toast';
      root.appendChild(el);
    }
    undoFn = undo || null;
    el.innerHTML = esc(msg) + (undo ? '<button type="button" data-action="news-toast-undo">Undo</button>' : '');
    el.classList.add('show');
    clearTimeout(toast.t);
    toast.t = setTimeout(function () { el.classList.remove('show'); undoFn = null; }, undo ? 5000 : 2200);
  }

  /* ---------- popovers (id deskPop: desk-actions closes it on any outside click) ---------- */
  function closePop() {
    var root = newsRoot();
    var p = root && root.getElementById('deskPop');
    if (p) p.remove();
  }
  function placePop(anchor, html) {
    var root = (anchor && anchor.getRootNode && anchor.getRootNode()) || newsRoot();
    if (!root || root.nodeType !== 11) return null;
    closePop();
    var box = document.createElement('div');
    box.id = 'deskPop';
    box.className = 'pop on';
    box.setAttribute('data-action', 'news-pop-stay');
    box.innerHTML = html;
    var r = anchor && anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : { left: 40, bottom: 120 };
    box.style.position = 'fixed';
    box.style.left = Math.max(8, Math.min(r.left, (window.innerWidth || 1280) - 320)) + 'px';
    box.style.top = Math.max(8, Math.min(r.bottom + 6, (window.innerHeight || 800) - 380)) + 'px';
    root.appendChild(box);
    if (typeof window.bindShadowActions === 'function') window.bindShadowActions(root);
    return box;
  }
  function paintSaveOpts() {
    var box = newsRoot() && newsRoot().getElementById('deskPop');
    var opts = box && box.querySelector('.nsv-opts');
    if (!opts || !pend) return;
    var sug = pend.sug || [];
    opts.innerHTML = cols().map(function (c) {
      var on = pend.sel.indexOf(c.id) >= 0;
      return '<div class="opt' + (on ? ' on' : '') + '" data-action="news-pop-opt" data-id="' + esc(c.id) + '"><i></i>' + esc(c.name) + '<em>' + (sug.indexOf(c.id) >= 0 ? 'suggested &middot; ' : '') + colCount(c) + '</em></div>';
    }).join('') || '<div class="opt">No collections yet - add one below.</div>';
  }
  function openSave(anchor, item, opts) {
    opts = opts || {};
    if (!item) return;
    load(false);
    var existing = opts.saved || savedByUrl(item.url || '');
    var sug = suggest(item);
    pend = {
      item: item,
      saved: existing,
      sel: existing ? (existing.collections || []).slice() : (opts.sel || sug).slice(),
      sug: sug,
      move: !!opts.move,
      onDone: opts.onDone || null
    };
    var note = existing ? existing.note || '' : '';
    placePop(anchor, '<h6>' + (opts.move ? 'Move to collections' : 'Save to collections') + '</h6><div class="sug">Suggested for this story</div><div class="nsv-opts"></div>'
      + (opts.move ? '' : '<textarea data-ext-field="1" data-action="news-pop-note" placeholder="Note to self (optional) - why it matters">' + esc(note) + '</textarea>')
      + (opts.move ? '' : '<div class="pf"><a data-action="news-pop-space">Or save it to a Space instead</a></div>')
      + '<div class="pf nsv-pf"><a data-action="news-pop-new">+ New collection</a><button type="button" class="b2" data-action="news-pop-cancel">Cancel</button><button type="button" class="b2 pri" data-action="news-pop-save">Save</button></div>');
    paintSaveOpts();
  }
  function openAsk(anchor, title, value, placeholder, onSave) {
    var box = placePop(anchor, '<h6>' + esc(title) + '</h6><input class="ask" type="text" maxlength="160" data-ext-field="1" data-action="news-ask-input" placeholder="' + esc(placeholder || '') + '" value="' + esc(value || '') + '"/><div class="pf"><button type="button" class="b2" data-action="news-pop-cancel">Cancel</button><button type="button" class="b2 pri" data-action="news-ask-save">Save</button></div>');
    if (!box) return;
    box.__ask = onSave;
    var input = box.querySelector('input');
    if (input) setTimeout(function () { try { input.focus(); input.select(); } catch (e) {} }, 20);
  }
  function askSubmit(root) {
    var box = root && root.getElementById && root.getElementById('deskPop');
    if (!box || typeof box.__ask !== 'function') return;
    var input = box.querySelector('input.ask');
    var v = String((input && input.value) || '').trim();
    var fn = box.__ask;
    closePop();
    fn(v);
  }

  /* ---------- server writes ---------- */
  function newCollection(name, then) {
    name = String(name || '').trim();
    if (!name) return;
    if (fixtureOn()) {
      var id = 'fx-c-' + Date.now();
      S().newsCols = cols().concat([{ id: id, key: '', name: name, description: '', bg: '#f5f7fb', color: '#4a5672', usedIn: '' }]);
      toast('Collection added (fixture)');
      if (then) then(id);
      return;
    }
    api('/api/news/collections', { method: 'POST', body: { name: name } }).then(function (d) {
      if (d && d.collection) S().newsCols = cols().concat([d.collection]);
      toast('Collection "' + name + '" added');
      if (then && d && d.collection) then(d.collection.id);
      rerender();
    }).catch(function () { toast('Could not add that collection'); });
  }
  function patchCollection(id, body, okMsg) {
    var c = colById(id);
    if (!c) return;
    var before = { name: c.name, description: c.description, usedIn: c.usedIn };
    Object.keys(body).forEach(function (k) { c[k] = body[k]; });
    rerender();
    if (fixtureOn()) { toast(okMsg + ' (fixture)'); return; }
    api('/api/news/collections/' + encodeURIComponent(id), { method: 'PATCH', body: body }).then(function (d) {
      if (d && d.collection) Object.keys(d.collection).forEach(function (k) { if (k !== 'count') c[k] = d.collection[k]; });
      toast(okMsg);
      rerender();
    }).catch(function () {
      Object.keys(before).forEach(function (k) { c[k] = before[k]; });
      rerender();
      toast('Could not save that change');
    });
  }
  function deleteCollection(id) {
    var c = colById(id);
    if (!c) return;
    if (!window.confirm('Delete the collection "' + c.name + '"? Its stories stay saved.')) return;
    var list = cols().slice();
    S().newsCols = list.filter(function (x) { return x !== c; });
    if (String(S().newsColCur) === String(id)) S().newsColCur = (cols()[0] || {}).id || '';
    rerender();
    function restore() {
      S().newsCols = list;
      S().newsColCur = id;
      rerender();
    }
    if (fixtureOn()) { toast('Collection deleted (fixture)', restore); return; }
    api('/api/news/collections/' + encodeURIComponent(id), { method: 'DELETE' }).then(function () {
      toast('Collection deleted', function () {
        api('/api/news/collections/' + encodeURIComponent(id), { method: 'PATCH', body: { archived: false } }).then(function () {
          restore();
          toast('Collection restored');
        }).catch(function () { toast('Could not restore it'); });
      });
    }).catch(function () { restore(); toast('Could not delete that collection'); });
  }
  function patchSaved(row, body, okMsg) {
    var before = {};
    Object.keys(body).forEach(function (k) { before[k] = row[k]; row[k] = body[k]; });
    rerender();
    if (fixtureOn() || !UUID.test(String(row.id))) { if (okMsg) toast(okMsg + (fixtureOn() ? ' (fixture)' : '')); return; }
    api('/api/news/collections/saved/' + encodeURIComponent(row.id), { method: 'PATCH', body: body }).then(function (d) {
      if (d && d.saved) upsertSaved(d.saved);
      if (okMsg) toast(okMsg);
      rerender();
    }).catch(function () {
      Object.keys(before).forEach(function (k) { row[k] = before[k]; });
      rerender();
      toast('Could not save that change');
    });
  }
  function removeSaved(row) {
    var list = savedRows().slice();
    S().newsSavedRows = list.filter(function (s) { return s !== row; });
    rerender();
    function restore() { S().newsSavedRows = list; rerender(); }
    if (fixtureOn() || !UUID.test(String(row.id))) { toast('Removed (fixture)', restore); return; }
    api('/api/news/collections/saved/' + encodeURIComponent(row.id), { method: 'DELETE' }).then(function () {
      toast('Removed from Saved', function () {
        api('/api/news/collections/saved/' + encodeURIComponent(row.id), { method: 'PATCH', body: { archived: false } }).then(function (d) {
          if (d && d.saved) { S().newsSavedRows = list; upsertSaved(d.saved); }
          rerender();
          toast('Story restored');
        }).catch(function () { toast('Could not restore it'); });
      });
    }).catch(function () { restore(); toast('Could not remove that story'); });
  }
  function saveFromPop(root) {
    if (!pend) return;
    var p = pend;
    var box = root && root.getElementById && root.getElementById('deskPop');
    var ta = box && box.querySelector('textarea');
    var note = ta ? String(ta.value || '') : null;
    closePop();
    pend = null;
    var n = p.sel.length;
    var label = 'Saved to ' + n + ' collection' + (n === 1 ? '' : 's');
    if (p.saved) {
      var body = { collections: p.sel.slice() };
      if (note != null) body.note = note;
      patchSaved(p.saved, body, p.move ? 'Moved' : label);
      if (p.onDone) p.onDone(n);
      return;
    }
    var item = p.item;
    var h = H();
    var row = {
      id: 'tmp-' + Date.now(), url: String(item.url || ''), title: String(item.title || 'Story'),
      source: h.source ? h.source(item) : String(item.source || ''), image: String(item.image || item.image_url || ''),
      category: h.cat ? h.cat(item) : String(item.category || ''), why: h.why ? h.why(item) : '',
      publishedAt: h.ts ? h.ts(item) : 0, note: note || '', usedIn: '', collections: p.sel.slice(), savedAt: Date.now()
    };
    upsertSaved(row);
    if (p.onDone) p.onDone(n);
    rerender();
    if (fixtureOn()) { toast(label + ' (fixture)'); return; }
    api('/api/news/collections/saved', { method: 'POST', body: {
      title: row.title, url: row.url, source: row.source, image: row.image, category: row.category, why: row.why,
      publishedAt: row.publishedAt, newsId: String(item.id || ''), note: row.note, collections: row.collections
    } }).then(function (d) {
      S().newsSavedRows = savedRows().filter(function (s) { return s !== row; });
      if (d && d.saved) upsertSaved(d.saved);
      toast(label);
      rerender();
    }).catch(function () {
      S().newsSavedRows = savedRows().filter(function (s) { return s !== row; });
      rerender();
      toast('Could not save that story');
    });
  }
  function draftFrom(c) {
    var rows = savedRows().filter(function (s) { return (s.collections || []).indexOf(c.id) >= 0; });
    if (!rows.length) { toast('Nothing in this collection yet'); return; }
    var title = 'Draft from ' + c.name + ': ' + String(rows[0].title || '').slice(0, 90) + (rows.length > 1 ? ' + ' + (rows.length - 1) + ' more' : '');
    var notes = rows.map(function (s, i) {
      return (i + 1) + '. ' + s.title + (s.source ? ' (' + s.source + ')' : '') + (s.url ? '\n   ' + s.url : '') + (s.why ? '\n   Why: ' + s.why : '') + (s.note ? '\n   Note: ' + s.note : '');
    }).join('\n');
    if (fixtureOn()) { toast('Draft task added (fixture)'); return; }
    api('/api/items', { method: 'POST', body: { title: title, area: 'other', category: 'News' } }).then(function (item) {
      if (!item || !item.id) throw new Error('no id');
      return api('/api/items', { method: 'PATCH', body: { id: item.id, notes: c.name + ' - ' + rows.length + ' stories\n\n' + notes } });
    }).then(function () {
      toast('Draft task added to the War Room with all ' + rows.length + ' stories');
      if (typeof window.loadBoard === 'function') window.loadBoard();
    }).catch(function () { toast('Could not create the draft'); });
  }
  function exportCol(c) {
    function download(name, text) {
      var blob = new Blob([text], { type: 'text/markdown' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = (String(name).replace(/[^A-Za-z0-9 _-]+/g, '').trim().replace(/\s+/g, '-') || 'collection') + '.md';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    }
    if (fixtureOn() || !UUID.test(String(c.id))) {
      var rows = savedRows().filter(function (s) { return (s.collections || []).indexOf(c.id) >= 0; });
      download(c.name, '# ' + c.name + '\n\n' + rows.map(function (s) { return '## ' + s.title + '\n' + s.source + '\n\n' + s.why + (s.note ? '\n\nNote: ' + s.note : ''); }).join('\n\n'));
      toast('Exported ' + c.name);
      return;
    }
    var fn = typeof window.authFetch === 'function' ? window.authFetch : fetch;
    fn('/api/news/collections/' + encodeURIComponent(c.id) + '/export', { credentials: 'same-origin', quiet: true }).then(function (r) {
      if (!r || !r.ok) throw new Error('fail');
      return r.text();
    }).then(function (text) {
      download(c.name, text);
      toast('Exported ' + c.name + ' as a document');
    }).catch(function () { toast('Could not export that collection'); });
  }

  /* ---------- Saved view markup ---------- */
  function savedSearchHit(s, q) {
    if (!q) return true;
    return (s.title + ' ' + s.source + ' ' + s.why + ' ' + s.note + ' ' + s.usedIn).toLowerCase().indexOf(q) >= 0;
  }
  function justHtml(all) {
    var h = H();
    if (fixtureOn()) {
      justRows = FX_JUST.map(function (j) { return { title: j.title, source: j.source, url: '', _day: j.day, _sug: j.sug }; });
    } else {
      justRows = (all || []).filter(function (item) { return item && item.url && !savedByUrl(item.url); })
        .sort(function (a, b) { return (h.ts ? h.ts(b) - h.ts(a) : 0); }).slice(0, 3);
    }
    if (!justRows.length) return '';
    var start = new Date();
    start.setHours(0, 0, 0, 0);
    var today = fixtureOn() ? 3 : (all || []).filter(function (item) { return h.ts && h.ts(item) >= start.getTime(); }).length;
    return '<div class="just"><h5>Just in - save what\'s useful <small>' + today + ' new Canadian ' + (today === 1 ? 'story' : 'stories') + ' today</small></h5><div class="jrow">'
      + justRows.map(function (item, i) {
        var day = item._day || dayLabel(h.ts ? h.ts(item) : 0);
        var done = item._savedN;
        return '<div class="jc"><b>' + esc(item.title || '') + '</b><div class="src">' + esc(h.source ? h.source(item) : item.source || '') + (day ? ' &middot; ' + esc(day) : '') + '</div><button type="button" class="savebtn' + (done ? ' done' : '') + '" data-action="news-save-just" data-j="' + i + '">' + (done ? 'Saved to ' + done : 'Save to&hellip;') + '</button></div>';
      }).join('') + '</div></div>';
  }
  function html(all, q) {
    load(false);
    q = String(q || '').toLowerCase();
    if (!S().newsColsLoaded) return '<div class="nsv"><div class="nsv-msg">Loading your collections...</div></div>';
    if (S().newsColsErr) return '<div class="nsv"><div class="nsv-msg">' + esc(S().newsColsErr) + '<button type="button" class="b2" data-action="news-cols-retry">Retry</button></div></div>';
    var list = cols();
    var cur = colById(S().newsColCur) || list[0] || null;
    if (cur) S().newsColCur = cur.id;
    var rail = '<h5>Collections</h5>' + list.map(function (c) {
      return '<div class="cl' + (cur && c.id === cur.id ? ' on' : '') + '" data-action="news-col" data-id="' + esc(c.id) + '"><span class="ic" style="background:' + esc(c.bg) + ';color:' + esc(c.color) + ';font-weight:900"></span><div style="min-width:0"><b>' + esc(c.name) + '</b><small>' + (c.usedIn ? 'Used in ' + esc(c.usedIn) : 'Not used yet') + '</small></div><em>' + colCount(c) + '</em></div>';
    }).join('') + '<div class="newc" data-action="news-col-new">+ New collection</div>';
    var head = cur
      ? '<span class="ic" style="background:' + esc(cur.bg) + ';color:' + esc(cur.color) + ';font-weight:900"></span><div><h2>' + esc(cur.name) + '</h2><p>' + esc(cur.description || 'Your saved stories') + ' &middot; ' + colCount(cur) + ' stories</p></div><div class="acts2"><button type="button" class="b2 ai" data-action="news-col-draft">Draft from these</button><button type="button" class="b2" data-action="news-col-export">Export to Doc</button><button type="button" class="b2" data-action="news-col-menu" aria-label="More collection actions">&middot;&middot;&middot;</button></div>'
      : '<span class="ic"></span><div><h2>No collections</h2><p>Add one with "+ New collection".</p></div><div class="acts2"></div>';
    var rows = cur ? savedRows().filter(function (s) { return (s.collections || []).indexOf(cur.id) >= 0 && savedSearchHit(s, q); }) : [];
    var body = rows.map(function (s) {
      var img = /^\/api\/news\/(?:image|thumb)\/|^https:\/\//.test(String(s.image || '')) ? '<img src="' + esc(s.image) + '" alt="" loading="lazy"/>' : '';
      var tags = (s.collections || []).map(function (id) {
        var c = colById(id);
        return c ? '<span data-action="news-col" data-id="' + esc(c.id) + '" style="background:' + esc(c.bg) + ';color:' + esc(c.color) + ';cursor:pointer">' + esc(c.name) + '</span>' : '';
      }).join('');
      var src = [esc(s.source), esc(s.dayText || dayLabel(s.publishedAt)), 'saved ' + esc(s.savedText || dayLabel(s.savedAt))].filter(Boolean).join(' &middot; ');
      return '<div class="si" data-id="' + esc(s.id) + '"><div class="th">' + img + '<span>' + esc(s.category || 'News') + '</span></div><div class="bd"><h3>' + esc(s.title) + '</h3><div class="src">' + src + '</div>' + (s.why ? '<div class="why"><b>Why it matters:</b> ' + esc(s.why) + '</div>' : '') + '<div class="mynote" contenteditable="true" data-ext-field="1" data-action="news-saved-note" data-id="' + esc(s.id) + '">' + esc(s.note || '') + '</div></div><div class="side2"><h6>In collections</h6><div class="tagc">' + tags + '</div><h6 style="margin-top:6px">Used</h6><div class="used' + (s.usedIn ? '' : ' no') + '" data-action="news-saved-used" data-id="' + esc(s.id) + '" style="cursor:pointer">' + esc(s.usedIn || 'Not used yet') + '</div><div class="ops">' + (s.url ? '<span data-action="news-saved-open" data-id="' + esc(s.id) + '">Open</span>' : '') + '<span data-action="news-saved-move" data-id="' + esc(s.id) + '">Move&hellip;</span><span data-action="news-saved-remove" data-id="' + esc(s.id) + '">Remove</span></div></div></div>';
    }).join('') || '<div style="color:#9fb0d0;padding:20px">' + (q ? 'No saved story here matches "' + esc(q) + '".' : 'Nothing saved here yet. Use "Save to&hellip;" on any story.') + '</div>';
    return '<div class="nsv">' + justHtml(all) + '<div class="svw"><aside class="cols-rail">' + rail + '</aside><section><div class="chead">' + head + '</div><div class="svlist">' + body + '</div></section></div></div>';
  }
  function count() {
    load(false);
    if (fixtureOn()) return 21;
    return savedRows().length;
  }
  function rowById(id) { return savedRows().filter(function (s) { return String(s.id) === String(id); })[0] || null; }
  function setMode(mode) {
    S().newsMode = mode === 'saved' ? 'saved' : 'feed';
    try {
      var url = '/news' + (S().newsMode === 'saved' ? '?view=saved' : '') + (fixtureOn() ? (S().newsMode === 'saved' ? '&' : '?') + 'fixture=mockup' : '');
      if (window.history && history.replaceState) history.replaceState({}, '', url);
    } catch (e) {}
    if (S().newsMode === 'saved') load(false);
    rerender();
  }

  /* ---------- delegated actions ---------- */
  var actions = {
    'news-mode': function (el) { setMode(el.getAttribute('data-mode')); },
    'news-pop-stay': function () {},
    'news-pop-cancel': function () { pend = null; closePop(); },
    'news-pop-opt': function (el) {
      if (!pend) return;
      var id = el.getAttribute('data-id');
      var at = pend.sel.indexOf(id);
      if (at >= 0) pend.sel.splice(at, 1); else pend.sel.push(id);
      paintSaveOpts();
    },
    'news-pop-note': function () {},
    'news-pop-new': function (el) {
      var pf = el.closest && el.closest('.nsv-pf');
      if (!pf) return;
      pf.innerHTML = '<input class="ask" type="text" maxlength="80" data-ext-field="1" data-action="news-pop-newname" placeholder="Collection name"/><button type="button" class="b2 pri" data-action="news-pop-newadd">Add</button>';
      var input = pf.querySelector('input');
      if (input) setTimeout(function () { try { input.focus(); } catch (e) {} }, 20);
    },
    'news-pop-newname': function () {},
    'news-pop-newadd': function (el, root) {
      var box = root && root.getElementById && root.getElementById('deskPop');
      var input = box && box.querySelector('input[data-action="news-pop-newname"]');
      var name = String((input && input.value) || '').trim();
      if (!name) { if (input) input.focus(); return; }
      newCollection(name, function (id) {
        if (pend && pend.sel.indexOf(id) < 0) pend.sel.push(id);
        var pf = box && box.querySelector('.nsv-pf');
        if (pf) pf.innerHTML = '<a data-action="news-pop-new">+ New collection</a><button type="button" class="b2" data-action="news-pop-cancel">Cancel</button><button type="button" class="b2 pri" data-action="news-pop-save">Save</button>';
        paintSaveOpts();
      });
    },
    'news-pop-space': function () {
      var item = pend && pend.item;
      pend = null;
      closePop();
      if (item && H().toSpace) H().toSpace(item);
    },
    'news-pop-save': function (el, root) { saveFromPop(root); },
    'news-ask-input': function () {},
    'news-ask-save': function (el, root) { askSubmit(root); },
    'news-toast-undo': function () { var fn = undoFn; undoFn = null; if (fn) fn(); },
    'news-cols-retry': function () { S().newsColsLoaded = false; S().newsColsErr = ''; load(true); rerender(); },
    'news-save-just': function (el) {
      var i = Number(el.getAttribute('data-j'));
      var item = justRows[i];
      if (!item) return;
      openSave(el, item, { sel: item._sug ? cols().filter(function (c) { return item._sug.indexOf(c.key) >= 0; }).map(function (c) { return c.id; }) : null, onDone: function (n) { item._savedN = n; } });
    },
    'news-col': function (el) { S().newsColCur = el.getAttribute('data-id'); rerender(); },
    'news-col-new': function (el) { openAsk(el, 'New collection', '', 'Collection name', function (name) { newCollection(name, function (id) { S().newsColCur = id; rerender(); }); }); },
    'news-col-draft': function () { var c = colById(S().newsColCur); if (c) draftFrom(c); },
    'news-col-export': function () { var c = colById(S().newsColCur); if (c) exportCol(c); },
    'news-col-menu': function (el) {
      var c = colById(S().newsColCur);
      if (!c) return;
      placePop(el, '<h6>' + esc(c.name) + '</h6><button type="button" class="mi" data-action="news-colm-rename">Rename</button><button type="button" class="mi" data-action="news-colm-desc">Edit description</button><button type="button" class="mi" data-action="news-colm-used">Set "Used in"</button><button type="button" class="mi red" data-action="news-colm-del">Delete collection</button>');
    },
    'news-colm-rename': function (el) {
      var c = colById(S().newsColCur);
      if (!c) return;
      openAsk(el, 'Rename collection', c.name, 'Collection name', function (v) { if (v && v !== c.name) patchCollection(c.id, { name: v }, 'Renamed'); });
    },
    'news-colm-desc': function (el) {
      var c = colById(S().newsColCur);
      if (!c) return;
      openAsk(el, 'Description', c.description, 'What goes in this collection', function (v) { patchCollection(c.id, { description: v }, 'Description saved'); });
    },
    'news-colm-used': function (el) {
      var c = colById(S().newsColCur);
      if (!c) return;
      openAsk(el, 'Used in', c.usedIn, 'e.g. Seed deck slide 4', function (v) { patchCollection(c.id, { usedIn: v }, 'Saved'); });
    },
    'news-colm-del': function () { closePop(); deleteCollection(S().newsColCur); },
    'news-saved-note': function () {},
    'news-saved-used': function (el) {
      var row = rowById(el.getAttribute('data-id'));
      if (!row) return;
      openAsk(el, 'Where did you use it?', row.usedIn, 'e.g. LinkedIn post drafted', function (v) { patchSaved(row, { usedIn: v }, 'Saved'); });
    },
    'news-saved-open': function (el) {
      var row = rowById(el.getAttribute('data-id'));
      if (row && row.url && H().open) H().open({ title: row.title, url: row.url });
    },
    'news-saved-move': function (el) {
      var row = rowById(el.getAttribute('data-id'));
      if (!row) return;
      openSave(el, { title: row.title, url: row.url, category: row.category }, { saved: row, move: true });
    },
    'news-saved-remove': function (el) {
      var row = rowById(el.getAttribute('data-id'));
      if (row) removeSaved(row);
    }
  };
  function install() {
    if (!window.deskActions) return false;
    Object.assign(window.deskActions, actions);
    window.__deskKeyExt = window.__deskKeyExt || {};
    window.__deskKeyExt['news-ask-input'] = function (el, root, e) {
      if (e.key === 'Enter') { e.preventDefault(); askSubmit(root); return true; }
      if (e.key === 'Escape') { e.preventDefault(); closePop(); return true; }
      return false;
    };
    window.__deskKeyExt['news-pop-newname'] = function (el, root, e) {
      if (e.key === 'Enter') { e.preventDefault(); actions['news-pop-newadd'](el, root, e); return true; }
      return false;
    };
    window.__deskKeyExt['news-saved-note'] = function (el, root, e) {
      if (e.key === 'Escape') { if (el.blur) el.blur(); return true; }
      return false;
    };
    window.__deskBlurExt = window.__deskBlurExt || {};
    window.__deskBlurExt['news-saved-note'] = function (el) {
      var row = rowById(el.getAttribute('data-id'));
      if (!row) return;
      var v = String(el.innerText || el.textContent || '').replace(/\s+$/g, '');
      if (v === String(row.note || '')) return;
      row.note = v;
      if (fixtureOn() || !UUID.test(String(row.id))) return;
      api('/api/news/collections/saved/' + encodeURIComponent(row.id), { method: 'PATCH', body: { note: v } }).then(function () {
        toast('Note saved');
      }).catch(function () { toast('Could not save that note'); });
    };
    return true;
  }
  if (!install()) {
    var tries = 0;
    var t = setInterval(function () { if (install() || ++tries > 50) clearInterval(t); }, 100);
  }

  window.__newsSaved = { html: html, count: count, openSave: openSave, load: load, setMode: setMode };

  /* /news?view=saved opens the Saved view. The boot router only knows /news, so take over after it runs. */
  (function bootSaved() {
    var path = String(location.pathname || '');
    var view = '';
    try { view = new URLSearchParams(location.search || '').get('view') || ''; } catch (e) {}
    if (view !== 'saved') return;
    S().newsMode = 'saved';
    if (/^\/news\/?$/.test(path) || /control-room/.test(path)) {
      setTimeout(function () {
        if (S().desk !== 'news' && typeof window.switchView === 'function') window.switchView('news');
        rerender();
      }, 120);
    }
  })();
})();
