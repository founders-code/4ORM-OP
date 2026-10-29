/* Contacts (15) and Financials (16) on the redesign pattern.
   Each page renders into its own shadow root (#peopleDesk, #finDesk) with the design's page CSS
   (/port-css/contacts.css, /port-css/financials.css, copied verbatim from design-reference/redesign).
   Every control carries a data-action handled by the single delegated listener in desk-actions.js
   (handlers are added to window.deskActions; inputs use the __deskInputExt / __deskKeyExt hooks).
   ?fixture=mockup paints the design's own sample data. No icons, no emoji, 24-hour times. */
(function () {
  var TOKEN = ':host{--ground:#0b0c10;--ground2:#0b0c10;--side:#07080b;--card:#fff;--ink:#101a33;--ink2:#4a5672;--ink3:#7a86a0;--line:#e8ecf3;--soft:#f5f7fb;--blue:#2e6bf2;--blue50:#eaf1fe;--green:#12a36a;--green50:#e4f6ee;--amber:#c98408;--amber50:#fff4e0;--red:#e0364f;--red50:#fde9ec;--violet:#6b4fd8;display:block;min-width:0;color:var(--ink);font-size:16px;line-height:normal;font-family:Inter,-apple-system,BlinkMacSystemFont,"SF Pro Display","Segoe UI",system-ui,sans-serif}'
    + '*{box-sizing:border-box}button{font:inherit;cursor:pointer}[hidden]{display:none!important}[data-action]{cursor:pointer}'
    + '.card{background:var(--card);border-radius:16px;box-shadow:0 10px 30px rgba(3,10,30,.22);min-width:0}'
    + '.ch{display:flex;align-items:center;gap:8px;padding:14px 16px 10px}.ch h3{margin:0;font-size:14px;font-weight:800}.ch .s{margin-left:auto;font-size:12px;color:var(--ink3);font-weight:600;white-space:nowrap}'
    + '.lnk{color:var(--blue);font-weight:700;font-size:12.5px;white-space:nowrap;cursor:pointer}'
    + '.foot{padding:10px 16px 14px;font-size:12.5px;color:var(--ink3);border-top:1px solid var(--line)}'
    + '.port-body{display:block;min-width:0}'
    /* design shell av-fix: avatar initials are white and bold on every page */
    + '.av{color:#fff!important;font-size:11.5px!important;font-weight:800!important}'
    + '.av{color:#fff;font-weight:800;font-size:11px}'
    + '.desk-toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:95;background:#18191f;color:#fff;padding:10px 16px;border-radius:10px;font-size:13px;font-weight:600;display:none;align-items:center;gap:12px;box-shadow:0 10px 30px rgba(3,10,30,.28)}'
    + '.desk-toast.show{display:flex}.desk-toast button{background:#fff;color:#142036;border:0;border-radius:8px;padding:4px 10px;font-weight:800}'
    + '.tbl tr.picked td{background:var(--blue50)}.tbl tr[data-action]{cursor:pointer}'
    + '.pk{font-size:11px;font-weight:800;color:var(--blue);margin-left:6px}'
    + '.stt{font-size:11px;font-weight:800;color:var(--amber);margin-left:6px}'
    + '.fbl{font-size:11.5px;color:var(--ink3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block}'
    + '.selbar{display:flex;align-items:center;gap:6px}.selbar .n{font-size:12.5px;font-weight:700;color:var(--ink2);margin-right:4px}'
    + '.chip.warn{border-color:var(--red);color:var(--red)}'
    + '.coldnone{font-size:12.5px;color:#9fb0d0;padding:4px 0}'
    + '.nomatch{padding:14px 16px;font-size:13px;color:var(--ink3)}'
    + '.pov{position:fixed;inset:0;z-index:92;background:rgba(10,16,40,.45);display:flex;align-items:center;justify-content:center;padding:24px}'
    + '.pbox{width:min(560px,92vw);background:#fff;border-radius:16px;padding:18px 20px;box-shadow:0 18px 40px rgba(3,10,30,.35)}'
    + '.pbox h3{margin:0 0 4px;font-size:17px;font-weight:850}.pbox .to{font-size:12.5px;color:var(--ink3);margin-bottom:12px}'
    + '.pbox input,.pbox textarea{width:100%;border:1px solid var(--line);border-radius:10px;padding:10px;font:inherit;font-size:14px;margin:0 0 10px;color:var(--ink)}'
    + '.pbox textarea{min-height:150px;resize:vertical}.pbox .er{color:var(--red);font-size:12.5px;font-weight:700;min-height:16px}'
    + '.pbox .acts{display:flex;gap:8px;justify-content:flex-end;margin-top:6px}'
    + '.btn[disabled]{opacity:.55;cursor:default}';
  var CSS = { contacts: '/port-css/contacts.css?v=4', finance: '/port-css/financials.css?v=5', outreach: '/port-css/outreach-lists.css?v=21', neon: '/port-css/neon.css?v=2', contrastP10: '/port-css/contrast-p10.css?v=6' };
  var cssText = {};
  var NA = 'Fills in from the master finance sheet once it\'s connected';
  var COLD_DAYS = 21;
  var PAGE_ROWS = 10;
  var PAL = ['#2e6bf2', '#12a36a', '#c98408', '#6b4fd8', '#e0364f', '#0f9fb5', '#c2560c'];

  function fixtureOn() {
    try { return /(?:^|[?&])fixture=mockup(?:&|$)/.test(String(location.search || '')); } catch (e) { return false; }
  }
  function S() { return window.STATE || (window.STATE = {}); }
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function attr(el, n) { return el && el.getAttribute ? (el.getAttribute(n) || '') : ''; }
  function api(url, opts) {
    opts = opts || {};
    var o = { method: opts.method || 'GET', credentials: 'same-origin', quiet: true, headers: {} };
    if (opts.body != null) { o.headers['content-type'] = 'application/json'; o.body = JSON.stringify(opts.body); }
    var fn = typeof window.authFetch === 'function' ? window.authFetch : fetch;
    return fn(url, o);
  }
  function readJson(r) { return r && r.json ? r.json().catch(function () { return {}; }) : Promise.resolve({}); }

  function loadCss(key) {
    if (cssText[key] != null) return Promise.resolve(cssText[key]);
    return fetch(CSS[key]).then(function (r) { return r.ok ? r.text() : ''; }).catch(function () { return ''; }).then(function (t) {
      cssText[key] = t || '';
      return cssText[key];
    });
  }
  function mount(hostId, key) {
    var host = document.getElementById(hostId);
    if (!host) return null;
    var root = host.shadowRoot;
    if (!root) {
      root = host.attachShadow({ mode: 'open' });
      var style = document.createElement('style');
      style.textContent = TOKEN;
      root.appendChild(style);
      var wrap = document.createElement('div');
      wrap.className = 'port-body';
      root.appendChild(wrap);
    }
    var st = root.querySelector('style');
    if (st && cssText[key] != null && st.getAttribute('data-css') !== key) {
      var extra = key === 'contacts' ? ((cssText.outreach || '') + (cssText.neon || '') + (cssText.contrastP10 || '')) : (cssText.contrastP10 || '');
      st.textContent = TOKEN + cssText[key] + extra;
      st.setAttribute('data-css', key);
      var wrap = root.querySelector('.port-body');
      if (wrap && key === 'contacts') wrap.classList.add('neon', 'lists');
    }
    return root;
  }
  /* Paint without losing the caret in a text field that is being typed into. */
  function paintInto(root, html) {
    var wrap = root.querySelector('.port-body');
    var active = root.activeElement;
    var keep = active && active.getAttribute ? attr(active, 'data-action') : '';
    var a = 0, b = 0;
    try { if (keep) { a = active.selectionStart; b = active.selectionEnd; } } catch (e) {}
    wrap.innerHTML = html;
    if (typeof window.bindShadowActions === 'function') window.bindShadowActions(root);
    var host = root.host;
    if (host && host.setAttribute) host.setAttribute('data-port-ready', '1');
    if (keep) {
      var again = root.querySelector('[data-action="' + keep + '"]');
      if (again && again.focus) { again.focus(); try { again.setSelectionRange(a, b); } catch (e) {} }
    }
  }
  function toast(root, msg, undo) {
    var t = root.getElementById('pplToast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'pplToast';
      t.className = 'desk-toast';
      root.appendChild(t);
    }
    window.__deskUndo = undo || null;
    t.innerHTML = esc(msg) + (undo ? ' <button type="button" data-action="toast-undo">Undo</button>' : '');
    t.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () { t.classList.remove('show'); }, Number(arguments[3]) || 4200);
  }
  function rootFor(id) { var h = document.getElementById(id); return h && h.shadowRoot; }

  /* ===================== CONTACTS ===================== */
  var ROLES = [
    ['vc', 'VCs', '#c2560c', true], ['angel', 'Angels', '#e6a817', true], ['strategic', 'Strategic', '#2e6bf2', true],
    ['design', 'Design partners', '#2fd6c6', true], ['regulators', 'Regulators', '#6b4fd8', true], ['advisors', 'Advisors', '#12a36a', true],
    ['network', 'Network', '#7a86a0', true], ['partners', 'Partners', '#b02a54', false], ['grants', 'Grants', '#c79a3a', false],
    ['facebook', 'Facebook', '#3b5bdb', false], ['personal', 'Personal', '#e0483a', false]
  ];
  var SMART = [['cold', 'Going cold', true], ['owe', 'Owe a reply', true], ['warm', 'Warm and active', false], ['intro', 'Can intro me', false]];
  var CHIPS = [['all', 'All'], ['vc', 'VCs'], ['angel', 'Angels'], ['strategic', 'Strategic'], ['regulators', 'Regulators']];
  var SORTS = [['attention', 'Needs attention'], ['warmth', 'Warmth'], ['lastTouch', 'Last touch'], ['name', 'Name']];

  function catOf(c) {
    if (typeof window.contactCategory === 'function') { try { return window.contactCategory(c); } catch (e) {} }
    return String(c.category || c.type || 'other');
  }
  function catIs(cat, f) {
    if (typeof window.catMatch === 'function') { try { return window.catMatch(cat, f); } catch (e) {} }
    return cat === f;
  }
  function touchMs(c) {
    var raw = c.lastTouch != null ? c.lastTouch : c.last_touch;
    if (typeof raw === 'string' && /^\d+$/.test(raw)) return Number(raw);
    if (typeof raw === 'number') return raw;
    return Date.parse(raw || '') || 0;
  }
  function ageDays(c) {
    var t = touchMs(c);
    return t ? Math.max(0, Math.round((Date.now() - t) / 86400000)) : null;
  }
  function warmth(c) {
    var age = ageDays(c);
    var dots = age == null ? 1 : age <= 3 ? 5 : age <= 7 ? 4 : age <= 14 ? 3 : age < COLD_DAYS ? 2 : 1;
    var k = dots >= 4 ? 'h' : dots === 3 ? 'w' : 'c';
    return { dots: dots, k: k, label: k === 'h' ? 'Warm' : k === 'w' ? 'Cooling' : 'Cold', age: age };
  }
  function isCold(c) { var a = ageDays(c); return a == null || a >= COLD_DAYS; }
  function starred(c) { var m = S().contactStars || {}; return !!(m[c.id] || c.starred); }
  function inSegment(c, f) {
    if (!f || f === 'all') return true;
    if (f === 'starred') return starred(c);
    if (f === 'cold') return isCold(c);
    if (f === 'owe') return /reply|waiting|owe/i.test(String(c.nextAction || ''));
    if (f === 'warm') return warmth(c).dots >= 4;
    if (f === 'intro') return /intro/i.test([c.role, c.nextAction, c.why, c.notes].join(' '));
    if (f === 'facebook') return catOf(c) === 'facebook' || !!c.fbTier;
    return catIs(catOf(c), f);
  }
  function roleOf(c) {
    var cat = catOf(c);
    var map = {
      vc: ['VC', 'r-vc'], angel: ['Angel', 'r-vc'], design: ['Design partner', 'r-str'], design_partner: ['Design partner', 'r-str'],
      regulator: ['Regulator', 'r-reg'], regulatory: ['Regulator', 'r-reg'], business: ['Strategic', 'r-str'], strategic: ['Strategic', 'r-str'],
      board: ['Advisor', 'r-adv'], advisor: ['Advisor', 'r-adv'], partner: ['Partner', 'r-adv'], partners: ['Partner', 'r-adv'],
      grant: ['Grant', 'r-net'], grant_reg: ['Grant', 'r-net'], facebook: ['Network', 'r-net'], personal: ['Personal', 'r-net']
    };
    return map[cat] || ['Network', 'r-net'];
  }
  function inits(n) {
    return String(n || '?').replace(/[^A-Za-z ]/g, '').split(/\s+/).filter(Boolean).map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase() || '?';
  }
  function colorFor(n, i) {
    if (typeof window.avColor === 'function') { try { return window.avColor(String(n || '?')); } catch (e) {} }
    return PAL[(i || 0) % PAL.length];
  }
  function agoText(age) {
    if (age == null) return 'no touch yet';
    if (age === 0) return 'today';
    if (age === 1) return 'yesterday';
    return age + ' days ago';
  }
  function contacts() { return (S().contacts || []).filter(function (c) { return c && c.id; }); }
  function findContact(id) { return contacts().filter(function (c) { return String(c.id) === String(id); })[0] || null; }

  function loadContactExtras(force) {
    var s = S();
    if (fixtureOn()) return;
    if (!force && s.__pplExtraAt && Date.now() - s.__pplExtraAt < 60000) return;
    s.__pplExtraAt = Date.now();
    api('/api/contacts').then(function (r) { if (!r || !r.ok) throw new Error('fail'); return r.json(); }).then(function (d) {
      var m = {};
      (d.starred || []).forEach(function (id) { m[id] = true; });
      s.contactStars = m;
      s.contactSpaces = Array.isArray(d.spaces) ? d.spaces : [];
      paintContacts();
    }).catch(function () { s.__pplExtraAt = 0; });
  }

  function liveContactsVm() {
    var s = S();
    if (typeof window.stampWarmth === 'function') { try { window.stampWarmth(); } catch (e) {} }
    var all = contacts();
    var counts = { all: all.length, starred: 0 };
    ROLES.concat(SMART).forEach(function (r) { counts[r[0]] = 0; });
    all.forEach(function (c) {
      Object.keys(counts).forEach(function (k) { if (k !== 'all' && inSegment(c, k)) counts[k] += 1; });
    });
    var coldAll = all.filter(isCold).sort(function (a, b) {
      var x = ageDays(a), y = ageDays(b);
      return (y == null ? 9999 : y) - (x == null ? 9999 : x);
    });
    var filter = s.peopleType || 'all';
    var q = String(s.peopleQ || '').toLowerCase().trim();
    var key = s.peopleSort || 'attention';
    var dir = s.peopleDir || 1;
    var rows = all.filter(function (c) {
      if (!inSegment(c, filter)) return false;
      return !q || [c.name, c.company, c.email, c.role, c.category, c.notes].join(' ').toLowerCase().indexOf(q) >= 0;
    });
    rows.sort(function (a, b) {
      if (key === 'name') return String(a.name || '').localeCompare(String(b.name || '')) * dir;
      if (key === 'warmth') return (warmth(b).dots - warmth(a).dots || touchMs(b) - touchMs(a)) * dir;
      if (key === 'lastTouch') return (touchMs(b) - touchMs(a)) * dir;
      /* needs attention: owed replies first, then coldest, then due next steps */
      var oa = /reply|waiting|owe/i.test(String(a.nextAction || '')) ? 0 : 1;
      var ob = /reply|waiting|owe/i.test(String(b.nextAction || '')) ? 0 : 1;
      return ((oa - ob) || (warmth(a).dots - warmth(b).dots) || (touchMs(a) - touchMs(b))) * dir;
    });
    var shown = s.peopleAll ? rows : rows.slice(0, PAGE_ROWS);
    function row(c, i) {
      var w = warmth(c);
      var r = roleOf(c);
      return {
        id: String(c.id), name: c.name || 'Untitled contact', sub: c.company || c.role || c.email || '', initials: inits(c.name),
        color: colorFor(c.name, i), roleClass: r[1], roleLabel: r[0], dots: w.dots, k: w.k, warmLabel: w.label,
        last: agoText(w.age), old: w.age == null || w.age >= COLD_DAYS, next: c.nextAction || 'Reach out',
        starred: starred(c), fb: c.fbTier ? (String(c.fbTier).replace(/\s*\u00b7\s*/g, ' - ') + (c.fbAsk ? ' - ' + c.fbAsk : '')) : '',
        fbStatus: c.fbTier ? (c.fbStatus || 'not_sent') : '', picked: !!(s.selPeople && s.selPeople[c.id]), email: c.email || ''
      };
    }
    return {
      total: all.length, counts: counts, filter: filter, q: s.peopleQ || '', sort: key,
      loading: !window.__boardApplied && !all.length,
      coldCount: coldAll.length,
      cold: coldAll.slice(0, 4).map(function (c, i) {
        var w = warmth(c);
        var r = roleOf(c);
        return { id: String(c.id), name: c.name || 'Person', initials: inits(c.name), color: colorFor(c.name, i), meta: r[0] + ' &middot; last touch ' + esc(agoText(w.age)), width: w.age == null ? 100 : Math.min(100, Math.round(w.age / 30 * 100)) };
      }),
      rows: shown.map(row), matched: rows.length, showAll: !!s.peopleAll, selMode: !!s.peopleSel,
      picked: Object.keys(s.selPeople || {}).filter(function (id) { return s.selPeople[id] && findContact(id); }).length
    };
  }

  /* Sample data for ?fixture=mockup lives in redesign-fixture-people.js (loaded only in fixture mode). */
  function fixtureData() { return window.REDESIGN_FIXTURE_PEOPLE || null; }
  function fixtureContactsVm() {
    var fx = fixtureData();
    var s = S();
    var vm = fx ? JSON.parse(JSON.stringify(fx.contacts)) : { total: 0, counts: { all: 0 }, coldCount: 0, cold: [], rows: [], matched: 0 };
    vm.filter = s.peopleType || 'all';
    vm.q = s.peopleQ || '';
    vm.sort = s.peopleSort || 'attention';
    vm.showAll = false; vm.selMode = false; vm.picked = 0;
    return vm;
  }
  var fixtureLoading = null;
  function whenFixture(fn) {
    if (!fixtureOn() || fixtureData()) { fn(); return; }
    if (!fixtureLoading) {
      fixtureLoading = new Promise(function (res) {
        var tag = document.createElement('script');
        tag.src = '/redesign-fixture-people.js?v=1';
        tag.onload = res; tag.onerror = res;
        document.head.appendChild(tag);
      });
    }
    fixtureLoading.then(fn);
  }

  function contactsHtml(vm) {
    var rail = '<div class="sg' + (vm.filter === 'all' ? ' on' : '') + '" style="margin-top:8px" data-action="people-filter" data-type="all">All people<span class="n">' + vm.counts.all + '</span></div>'
      + '<div class="sg' + (vm.filter === 'starred' ? ' on' : '') + '" data-action="people-filter" data-type="starred">Starred<span class="n">' + (vm.counts.starred || 0) + '</span></div>'
      + '<div class="lh">By role</div>'
      + ROLES.filter(function (r) { return r[3] || vm.counts[r[0]] > 0 || vm.filter === r[0]; }).map(function (r) {
        return '<div class="sg' + (vm.filter === r[0] ? ' on' : '') + '" data-action="people-filter" data-type="' + r[0] + '"><i style="background:' + r[2] + '"></i>' + r[1] + '<span class="n">' + (vm.counts[r[0]] || 0) + '</span></div>';
      }).join('')
      + '<div class="sepl"></div><div class="lh">Smart lists</div>'
      + SMART.map(function (r) {
        return '<div class="sg' + (vm.filter === r[0] ? ' on' : '') + '" data-action="people-filter" data-type="' + r[0] + '">' + r[1] + '<span class="n' + (r[2] ? ' hot' : '') + '">' + (vm.counts[r[0]] || 0) + '</span></div>';
      }).join('')
      + '<div style="height:10px"></div>';
    var cold = '<section class="cold"><div class="coldh"><b>Going cold &mdash; reach out before the round closes</b><span>' + vm.coldCount + ' ' + (vm.coldCount === 1 ? 'person' : 'people') + ', no touch in ' + COLD_DAYS + '+ days</span>'
      + (vm.coldCount ? '<span class="lnk" data-action="people-cold-all">See all ' + vm.coldCount + '</span>' : '') + '</div>'
      + (vm.cold.length ? '<div class="cg">' + vm.cold.map(function (c) {
        return '<div class="cc" data-action="people-open" data-id="' + esc(c.id) + '"><div class="t"><span class="av" style="background:' + esc(c.color) + '">' + esc(c.initials) + '</span><b>' + esc(c.name) + '</b></div><div class="m">' + c.meta + '</div><div class="bar2"><i style="width:' + c.width + '%"></i></div><button type="button" data-action="people-email" data-id="' + esc(c.id) + '">Email via GHL</button></div>';
      }).join('') + '</div>' : '<div class="coldnone">No one has gone ' + COLD_DAYS + ' days without a touch.</div>')
      + '</section>';
    var flt;
    if (vm.selMode) {
      flt = '<div class="flt"><div class="selbar"><span class="n">' + vm.picked + ' picked</span>'
        + '<button type="button" class="chip" data-action="people-pick-all">Select all ' + vm.matched + '</button>'
        + '<button type="button" class="chip" data-action="people-pick-none">Clear</button>'
        + '<button type="button" class="chip warn" data-action="people-delete-picked">Delete selected (' + vm.picked + ')</button>'
        + '<button type="button" class="chip on" data-action="people-select">Done</button></div></div>';
    } else {
      flt = '<div class="flt">' + CHIPS.map(function (c) {
        return '<button type="button" class="chip' + (vm.filter === c[0] ? ' on' : '') + '" data-action="people-filter" data-type="' + c[0] + '">' + c[1] + '</button>';
      }).join('') + '<button type="button" class="chip" data-action="people-select">Select</button>'
        + '<span class="sort">Sort: ' + SORTS.map(function (s) {
          return vm.sort === s[0] ? '<b data-action="people-sort" data-sort="' + s[0] + '">' + s[1] + '</b>' : '<span data-action="people-sort" data-sort="' + s[0] + '">' + s[1] + '</span>';
        }).join(' &middot; ') + '</span></div>';
    }
    var body = vm.rows.map(function (r) {
      var dots = [1, 2, 3, 4, 5].map(function (n) { return '<i class="' + (n <= r.dots ? 'on ' + r.k : '') + '"></i>'; }).join('');
      var fb = r.fb ? '<span class="fbl">' + esc(r.fb) + '</span>' : '';
      var fbActs = r.fbStatus ? '<button type="button" data-action="people-fb-status" data-id="' + esc(r.id) + '" data-status="' + esc(r.fbStatus) + '">' + esc({ not_sent: 'Not sent', sent: 'Sent', replied: 'Replied' }[r.fbStatus] || 'Not sent') + '</button><button type="button" data-action="people-fb-promote" data-id="' + esc(r.id) + '">Promote</button>' : '';
      return '<tr data-action="people-open" data-id="' + esc(r.id) + '"' + (r.picked ? ' class="picked"' : '') + '><td><div class="ps"><span class="av" style="background:' + esc(r.color) + '">' + esc(r.initials) + '</span><div style="min-width:0"><b>' + esc(r.name) + (r.starred ? '<span class="stt">Starred</span>' : '') + (vm.selMode && r.picked ? '<span class="pk">Picked</span>' : '') + '</b><span>' + esc(r.sub) + '</span>' + fb + '</div></div></td>'
        + '<td><span class="role ' + r.roleClass + '">' + esc(r.roleLabel) + '</span></td>'
        + '<td><div class="wm">' + dots + '<span>' + esc(r.warmLabel) + '</span></div></td>'
        + '<td class="lt' + (r.old ? ' old' : '') + '">' + esc(r.last) + '</td>'
        + '<td class="nx">' + esc(r.next) + '</td>'
        + '<td><div class="ac"><button type="button" data-action="people-email" data-id="' + esc(r.id) + '">Email</button><button type="button" data-action="people-space" data-id="' + esc(r.id) + '">Space</button><button type="button" data-action="people-reach" data-id="' + esc(r.id) + '">Reach out</button><button type="button" data-action="people-star" data-id="' + esc(r.id) + '">' + (r.starred ? 'Unstar' : 'Star') + '</button>' + fbActs + '</div></td></tr>';
    }).join('');
    var foot = vm.matched > vm.rows.length
      ? 'Showing ' + vm.rows.length + ' of ' + vm.matched + ' &middot; <span class="lnk" data-action="people-show-all">Show all</span>'
      : 'Showing ' + vm.rows.length + ' of ' + vm.matched + (vm.showAll && vm.matched > PAGE_ROWS ? ' &middot; <span class="lnk" data-action="people-show-all">Show fewer</span>' : '');
    var tab = S().peopleTab === 'lists' ? 'lists' : 'contacts';
    /* Design 28: one header + Contacts/Lists switch; both modes share the call-list rows. */
    var sub = tab === 'lists'
      ? 'your call lists, synced with GoHighLevel'
      : 'everyone you know · from email, calls and GoHighLevel';
    return '<div class="bar"><h1>' + (tab === 'lists' ? 'Lists' : 'Contacts') + '</h1><span class="sub">' + sub + '</span></div><div data-lists-host="1"></div>';
  }

  function paintContacts() {
    try {
      try {
        /* The URL picks the tab once, on arrival. After that the switch decides, or the page flips back on every repaint. */
        if (!S().__peopleUrlRead) {
          S().__peopleUrlRead = true;
          var qs = new URLSearchParams(String(location.search || ''));
          if (qs.get('lists') === '1' || qs.get('tab') === 'lists') S().peopleTab = 'lists';
          if (qs.get('tab') === 'contacts') S().peopleTab = 'contacts';
          if (/^\/lists\/?$/.test(location.pathname || '')) S().peopleTab = 'lists';
          else if (/^\/(contacts|people)\/?$/.test(location.pathname || '') && !qs.get('tab')) S().peopleTab = 'contacts';
        }
      } catch (e) {}
    } catch (e) {}
    Promise.all([loadCss('contacts'), loadCss('outreach'), loadCss('neon'), loadCss('contrastP10')]).then(function () { whenFixture(function () {
      var root = mount('peopleDesk', 'contacts');
      if (!root) return;
      var vm = fixtureOn() ? fixtureContactsVm() : liveContactsVm();
      paintInto(root, contactsHtml(vm) + composeHtml());
      watchDrawer();
      var st = root.querySelector('style');
      if (st) st.textContent = TOKEN + (cssText.contacts || '') + (cssText.outreach || '') + (cssText.neon || '') + (cssText.contrastP10 || '');
      var wrap = root.querySelector('.port-body');
      if (wrap) wrap.classList.add('neon', 'lists');
      var listsToken = String(Date.now());
      S().__listsPaint = listsToken;
      var mode = S().peopleTab === 'lists' ? 'lists' : 'contacts';
      /* The list frame is cached after the first load so switching Contacts and Lists never flashes blank. */
      var snip = window.__listsSnippet ? Promise.resolve(window.__listsSnippet) : fetch('/lists-snippet.html?v=17').then(function (r) { return r.ok ? r.text() : ''; });
      snip.then(function (html) {
        if (html) window.__listsSnippet = html;
        if (S().__listsPaint !== listsToken) return;
        if (!html) return;
        var host = root.querySelector('[data-lists-host]');
        if (host) host.outerHTML = html;
        else if (wrap) wrap.insertAdjacentHTML('beforeend', html);
        if (typeof window.bindOutreachLists === 'function') window.bindOutreachLists(root, { mode: mode });
      });
    }); });
    loadContactExtras(false);
    if (!S().peopleLists && typeof api === 'function') {
      api('/api/reach-out?lists=1').then(readJson).catch(function () { return null; }).then(function (d) {
        if (d && d.lists) { S().peopleLists = d.lists; if (S().peopleTab === 'lists') repaintPeople(); }
      });
    }
  }

  /* Email via GoHighLevel: one real 1:1 send through /api/contacts/:id (GoHighLevel conversations). */
  function composeHtml() {
    var cp = S().peopleCompose;
    if (!cp) return '';
    return '<div class="pov" data-action="people-email-close" data-self="1"><div class="pbox" role="dialog" aria-modal="true" aria-label="Email via GoHighLevel">'
      + '<h3>Email ' + esc(cp.name) + ' via GoHighLevel</h3><div class="to">To ' + esc(cp.email) + ' &middot; sends one email from chad@4ormfinance.com and logs the touch</div>'
      + '<input type="text" placeholder="Subject" aria-label="Subject" data-action="people-email-subject" data-ext-field value="' + esc(cp.subject || '') + '">'
      + '<textarea placeholder="Write the email" aria-label="Message" data-action="people-email-body" data-ext-field>' + esc(cp.body || '') + '</textarea>'
      + '<div class="er">' + esc(cp.error || '') + '</div>'
      + '<div class="acts"><button type="button" class="btn" data-action="people-email-close">Cancel</button><button type="button" class="btn pri" data-action="people-email-send"' + (cp.busy ? ' disabled' : '') + '>' + (cp.busy ? 'Sending' : 'Send via GoHighLevel') + '</button></div>'
      + '</div></div>';
  }

  var drawerWatched = false;
  function watchDrawer() {
    if (drawerWatched || typeof MutationObserver !== 'function') return;
    var d = document.getElementById('drawer');
    if (!d) return;
    drawerWatched = true;
    var was = d.classList.contains('open');
    new MutationObserver(function () {
      var now = d.classList.contains('open');
      if (was && !now && S().desk === 'people') paintContacts();
      was = now;
    }).observe(d, { attributes: true, attributeFilter: ['class'] });
  }

  function repaintPeople() { paintContacts(); }
  function needLive(root) {
    if (fixtureOn()) { toast(root, 'Sample data (fixture) - nothing saved'); return false; }
    return true;
  }
  function failMsg(r, d, fallback) {
    if (r && r.status === 403) return 'Not allowed for this sign-in';
    return (d && d.error) || fallback;
  }

  var peopleActions = {
    'people-tab': function (el) {
      S().peopleTab = attr(el, 'data-tab') || 'contacts';
      try { var u = new URL(location.href); u.searchParams.set('tab', S().peopleTab); u.searchParams.delete('lists'); history.replaceState(history.state, '', u.pathname + u.search + u.hash); } catch (e) {}
      if (S().peopleTab === 'lists' && !S().peopleLists) {
        api('/api/reach-out?lists=1').then(readJson).then(function (d) {
          S().peopleLists = (d && d.lists) || [];
          repaintPeople();
        }).catch(function () { S().peopleLists = []; repaintPeople(); });
      }
      repaintPeople();
    },
    'people-list': function (el) {
      S().peopleListId = attr(el, 'data-id');
      S().peopleTab = 'lists';
      repaintPeople();
    },
    'people-filter': function (el) {
      var s = S();
      s.peopleType = attr(el, 'data-type') || 'all';
      s.peopleAll = false;
      repaintPeople();
    },
    'people-sort': function (el) {
      var s = S();
      var key = attr(el, 'data-sort');
      if ((s.peopleSort || 'attention') === key) s.peopleDir = (s.peopleDir || 1) * -1;
      else { s.peopleSort = key; s.peopleDir = 1; }
      repaintPeople();
    },
    'people-show-all': function () { S().peopleAll = !S().peopleAll; repaintPeople(); },
    'people-cold-all': function () { var s = S(); s.peopleType = 'cold'; s.peopleAll = true; repaintPeople(); },
    'people-search': function () {},
    'people-email-subject': function () {},
    'people-email-body': function () {},
    'people-add-email': function (el, root) {
      var box = document.getElementById('cNext') || document.querySelector('#drawer input');
      var mail = document.querySelector('#drawer a[href^="mailto:"], #drawer [data-action="people-add-email"]');
      toast(root, 'Add an email on this card, then save');
      if (mail && mail.focus) mail.focus();
      else if (box) box.focus();
    },
    'people-add-phone': function (el, root) {
      var box = document.getElementById('cPhone') || document.querySelector('#drawer input[aria-label="Phone"], #drawer input[placeholder*="hone" i]');
      toast(root, 'Add a phone on this card, then save');
      if (box && box.focus) box.focus();
    },
    'people-add': function (el, root) {
      if (!needLive(root)) return;
      if (typeof window.openAddContact === 'function') { window.openAddContact(); return; }
      api('/api/contacts', { method: 'POST', body: { name: 'Untitled contact', area: 'other', type: 'other', tier: 'B' } }).then(function (r) {
        return readJson(r).then(function (d) { if (!r.ok) throw new Error(failMsg(r, d, 'Could not add a contact')); return d; });
      }).then(function (row) {
        if (row && row.id) (S().contacts = S().contacts || []).push(row);
        repaintPeople();
        if (row && row.id && typeof window.openContactCard === 'function') window.openContactCard(row.id);
      }).catch(function (err) { toast(root, err.message || 'Could not add a contact'); });
    },
    'people-open': function (el, root) {
      var id = attr(el, 'data-id');
      var s = S();
      if (s.peopleSel) {
        s.selPeople = s.selPeople || {};
        if (s.selPeople[id]) delete s.selPeople[id]; else s.selPeople[id] = true;
        repaintPeople();
        return;
      }
      if (!needLive(root)) return;
      if (!findContact(id)) return;
      if (typeof window.openContactCard === 'function') window.openContactCard(id);
      else toast(root, 'The contact card is unavailable');
    },
    'people-select': function () {
      var s = S();
      s.peopleSel = !s.peopleSel;
      if (!s.peopleSel) s.selPeople = {};
      repaintPeople();
    },
    'people-pick-all': function () {
      var s = S();
      s.selPeople = s.selPeople || {};
      var keepAll = s.peopleAll;
      s.peopleAll = true;
      liveContactsVm().rows.forEach(function (r) { s.selPeople[r.id] = true; });
      s.peopleAll = keepAll;
      repaintPeople();
    },
    'people-pick-none': function () { S().selPeople = {}; repaintPeople(); },
    'people-delete-picked': function (el, root) {
      if (!needLive(root)) return;
      var s = S();
      var ids = Object.keys(s.selPeople || {}).filter(function (id) { return s.selPeople[id] && findContact(id); });
      if (!ids.length) { toast(root, 'Pick people first'); return; }
      if (!window.confirm('Delete ' + ids.length + ' contact' + (ids.length === 1 ? '' : 's') + '? You can restore them from the dedupe log.')) return;
      var removed = contacts().filter(function (c) { return ids.indexOf(String(c.id)) >= 0; });
      s.contacts = contacts().filter(function (c) { return ids.indexOf(String(c.id)) < 0; });
      s.selPeople = {};
      s.peopleSel = false;
      repaintPeople();
      var failed = [];
      Promise.all(ids.map(function (id) {
        return api('/api/contacts/' + encodeURIComponent(id), { method: 'DELETE' }).then(function (r) { if (!r || !r.ok) failed.push(id); }).catch(function () { failed.push(id); });
      })).then(function () {
        if (failed.length) {
          removed.forEach(function (c) { if (failed.indexOf(String(c.id)) >= 0) S().contacts.push(c); });
          repaintPeople();
          toast(root, 'Could not delete ' + failed.length + ' of ' + ids.length);
          return;
        }
        toast(root, ids.length + ' deleted. Undo', function () {
          Promise.all(ids.map(function (id) {
            return api('/api/contacts/' + encodeURIComponent(id), { method: 'POST', body: { action: 'restore' } });
          })).then(function () {
            removed.forEach(function (c) { S().contacts.push(c); });
            repaintPeople();
          });
        }, 6000);
      });
    },
    'people-delete': function (el, root) {
      if (!needLive(root)) return;
      var id = attr(el, 'data-id');
      var c = findContact(id);
      if (!c) { toast(root, 'That contact is gone'); return; }
      S().contacts = contacts().filter(function (row) { return String(row.id) !== String(id); });
      if (typeof window.closeDrawer === 'function') window.closeDrawer();
      repaintPeople();
      api('/api/contacts/' + encodeURIComponent(id), { method: 'DELETE' }).then(function (r) {
        if (!r || !r.ok) throw new Error('fail');
        toast(root, 'Deleted ' + (c.name || 'contact') + '. Undo', function () {
          api('/api/contacts/' + encodeURIComponent(id), { method: 'POST', body: { action: 'restore' } }).then(function () {
            S().contacts.push(c);
            repaintPeople();
          });
        }, 6000);
      }).catch(function () {
        S().contacts.push(c);
        repaintPeople();
        toast(root, 'Could not delete ' + (c.name || 'that contact'));
      });
    },
    'people-star': function (el, root) {
      if (!needLive(root)) return;
      var id = attr(el, 'data-id');
      var c = findContact(id);
      if (!c) return;
      var s = S();
      s.contactStars = s.contactStars || {};
      var on = !starred(c);
      if (on) s.contactStars[id] = true; else delete s.contactStars[id];
      c.starred = on;
      repaintPeople();
      api('/api/contacts', { method: 'PATCH', body: { id: id, starred: on } }).then(function (r) {
        return readJson(r).then(function (d) { if (!r.ok) throw new Error(failMsg(r, d, 'Could not save the star')); });
      }).then(function () {
        toast(root, on ? 'Starred ' + (c.name || '') : 'Unstarred ' + (c.name || ''));
      }).catch(function (err) {
        if (on) delete s.contactStars[id]; else s.contactStars[id] = true;
        c.starred = !on;
        repaintPeople();
        toast(root, err.message || 'Could not save the star');
      });
    },
    'people-reach': function (el, root) {
      if (!needLive(root)) return;
      var c = findContact(attr(el, 'data-id'));
      if (!c) return;
      api('/api/reach-out', { method: 'POST', body: { name: c.name, company: c.company || '', kind: 'corporate', nextAction: c.nextAction || 'Reach out' } }).then(function (r) {
        return readJson(r).then(function (d) { if (!r.ok || !d || d.saved === false) throw new Error(failMsg(r, d, 'Could not add to Reach out')); return d; });
      }).then(function () {
        toast(root, (c.name || 'Person') + ' added to Reach out on the War Room');
        if (typeof window.loadBoard === 'function') window.loadBoard();
      }).catch(function (err) { toast(root, err.message || 'Could not add to Reach out'); });
    },
    'people-space': function (el, root) {
      if (!needLive(root)) return;
      var c = findContact(attr(el, 'data-id'));
      if (!c) return;
      var email = String(c.email || '').trim().toLowerCase();
      var hit = (S().contactSpaces || []).filter(function (l) {
        return (l.contactId && String(l.contactId) === String(c.id)) || (email && l.email === email);
      })[0];
      if (!hit) {
        if (!S().contactSpaces) { loadContactExtras(true); toast(root, 'Checking Spaces - try again in a moment'); return; }
        toast(root, (c.name || 'This person') + ' is not a recipient in any Space yet');
        return;
      }
      if (typeof window.switchView === 'function') window.switchView('work');
      try { history.replaceState({}, '', '/spaces'); } catch (e) {}
      var act = window.deskActions && window.deskActions['space-open'];
      if (act) {
        var tag = document.createElement('span');
        tag.setAttribute('data-id', hit.spaceId);
        act(tag, document);
      } else if (typeof window.openSpace === 'function') window.openSpace(hit.spaceId);
    },
    'people-email': function (el, root) {
      if (!needLive(root)) return;
      var c = findContact(attr(el, 'data-id'));
      if (!c) return;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(c.email || '').trim())) {
        toast(root, 'No email on file for ' + (c.name || 'this person') + '. Add one in their contact card.');
        if (typeof window.openContactCard === 'function') window.openContactCard(c.id);
        return;
      }
      S().peopleCompose = { id: String(c.id), name: c.name || 'Person', email: String(c.email).trim(), subject: '', body: '' };
      repaintPeople();
      setTimeout(function () { var f = root.querySelector('[data-action="people-email-subject"]'); if (f) f.focus(); }, 30);
    },
    'people-email-close': function (el, root, e) {
      if (attr(el, 'data-self') && e) {
        var t = (e.composedPath && e.composedPath()[0]) || e.target;
        if (t !== el) return;
      }
      S().peopleCompose = null;
      repaintPeople();
    },
    'people-email-send': function (el, root) {
      var cp = S().peopleCompose;
      if (!cp || cp.busy) return;
      if (!String(cp.subject || '').trim() || !String(cp.body || '').trim()) { cp.error = 'Add a subject and a message.'; repaintPeople(); return; }
      cp.busy = true;
      cp.error = '';
      repaintPeople();
      api('/api/contacts/' + encodeURIComponent(cp.id), { method: 'POST', body: { action: 'email', subject: cp.subject, body: cp.body } }).then(function (r) {
        return readJson(r).then(function (d) { if (!r.ok || !d || !d.sent) throw new Error(failMsg(r, d, 'GoHighLevel did not send it')); return d; });
      }).then(function (d) {
        var c = findContact(cp.id);
        if (c) c.lastTouch = d.lastTouch || Date.now();
        S().peopleCompose = null;
        repaintPeople();
        toast(root, 'Sent to ' + cp.name + ' via GoHighLevel');
      }).catch(function (err) {
        cp.busy = false;
        cp.error = err.message || 'GoHighLevel did not send it';
        repaintPeople();
      });
    },
    'people-fb-status': function (el, root) {
      if (!needLive(root)) return;
      var id = attr(el, 'data-id');
      var c = findContact(id);
      if (!c) return;
      var order = ['not_sent', 'sent', 'replied'];
      var prev = c.fbStatus || 'not_sent';
      var next = order[(order.indexOf(prev) + 1) % order.length];
      c.fbStatus = next;
      repaintPeople();
      api('/api/contacts/' + encodeURIComponent(id) + '/facebook', { method: 'POST', body: { action: 'status', status: next } }).then(function (r) {
        return readJson(r).then(function (d) { if (!r.ok || !d || !d.ok) throw new Error(failMsg(r, d, 'Could not save that status')); });
      }).then(function () { toast(root, 'Status saved'); }).catch(function (err) {
        c.fbStatus = prev;
        repaintPeople();
        toast(root, err.message || 'Could not save that status');
      });
    },
    'people-fb-promote': function (el, root) {
      if (!needLive(root)) return;
      var id = attr(el, 'data-id');
      var c = findContact(id);
      if (!c) return;
      api('/api/contacts/' + encodeURIComponent(id) + '/facebook', { method: 'POST', body: { action: 'promote' } }).then(function (r) {
        return readJson(r).then(function (d) { if (!r.ok || !d || !d.ok) throw new Error(failMsg(r, d, 'Could not promote that contact')); return d; });
      }).then(function (d) {
        c.category = 'vc';
        c.fbStatus = 'sent';
        repaintPeople();
        toast(root, d.error ? d.error : 'Promoted to the pipeline and GoHighLevel');
      }).catch(function (err) { toast(root, err.message || 'Could not promote that contact'); });
    }
  };

  /* ===================== FINANCIALS ===================== */
  function has(v) { return v != null && v !== ''; }
  function money(n) { return '$' + Number(n).toLocaleString('en-US'); }
  function shortDate(raw) {
    if (!raw) return '';
    var at = Date.parse(String(raw).length === 10 ? raw + 'T12:00:00' : raw);
    if (!Number.isFinite(at)) return String(raw);
    try { return new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Vancouver', day: 'numeric', month: 'short' }).format(new Date(at)); } catch (e) { return String(raw); }
  }
  function fixtureFinance() { var fx = fixtureData(); return fx ? JSON.parse(JSON.stringify(fx.finance)) : {}; }
  function financeHtml(f, unlocked) {
    f = f || {};
    var r = f.raise || {};
    var cash = has(f.cashLabel) ? f.cashLabel : (has(f.cash) ? money(f.cash) : null);
    function kp(label, val, sub, cls, rawLabel) {
      return '<div class="kp' + (cls && has(val) ? ' ' + cls : '') + '"><span>' + (rawLabel ? label : esc(label)) + '</span><b>' + (has(val) ? esc(val) : '&mdash;') + '</b><small>' + (has(val) ? sub : 'set it with Edit figures') + '</small></div>';
    }
    var raiseSub = r.sub || [has(r.targetLabel) ? 'of ' + esc(r.targetLabel) : '', has(r.closeDate) ? 'closes ' + esc(shortDate(r.closeDate)) : ''].filter(Boolean).join(' &middot; ') || 'raised to date';
    var stateWord = { in: 'In', pending: 'Pending', pd: 'Pending', open: 'Open', op: 'Open' };
    var stateCls = { in: 'in', pending: 'pd', pd: 'pd', open: 'op', op: 'op' };
    var cheques = (f.cheques || []).map(function (c, i) {
      var st = String(c.state || 'open');
      return '<div class="cq ' + (stateCls[st] || 'op') + '">' + esc(c.word || stateWord[st] || 'Open') + '<small>' + esc(c.label || ('cheque ' + (i + 1))) + '</small></div>';
    }).join('');
    var daysLeft = has(r.daysLeft) ? r.daysLeft : (function () {
      if (!has(r.closeDate)) return null;
      var at = Date.parse(String(r.closeDate).length === 10 ? r.closeDate + 'T12:00:00' : r.closeDate);
      return Number.isFinite(at) ? String(Math.max(0, Math.ceil((at - Date.now()) / 86400000))) : null;
    })();
    function rs(label, v) { return '<span>' + label + ' <b>' + (has(v) ? esc(v) : '-') + '</b></span>'; }
    var exp = (f.expenses || []).filter(function (e) { return e && has(e.amount); });
    var max = exp.reduce(function (m, e) { return Math.max(m, Number(e.amount) || 0); }, 0) || 1;
    var lines = exp.length
      ? exp.map(function (e) { return '<div class="bline">' + esc(e.name) + '<div class="t"><i style="width:' + Math.round((Number(e.amount) || 0) / max * 100) + '%"></i></div><b>' + esc(money(e.amount)) + '</b></div>'; }).join('')
      : ['Team &amp; contractors', 'Platform &amp; hosting', 'Legal &amp; compliance', 'Tools &amp; software', 'Marketing'].map(function (n) { return '<div class="bline">' + n + '<div class="t"><i style="width:0"></i></div><b>&mdash;</b></div>'; }).join('')
        + '<div class="empty">Fills in from the master finance sheet once it\'s connected &mdash; no numbers are guessed here.</div>';
    var model = f.model || null;
    var sc = model && (model.scenarios || []).length
      ? '<div class="sc">' + model.scenarios.map(function (s) {
        return '<div class="sv' + (s.locked ? ' base' : '') + '"><h4>' + esc(s.name) + (s.locked ? ' <em>Locked</em>' : '') + '</h4><b>' + esc(s.value) + '</b><span>' + esc(model.metric || '2031 revenue') + ' &middot; projection</span></div>';
      }).join('') + '</div><div class="disc">Projections from the financial model, not results.</div>'
      : '<div class="empty">' + (unlocked ? esc(NA) : 'Unlock to see the model scenarios.') + '</div>';
    var sheet = has(f.sheetUrl)
      ? '<button type="button" class="btn" data-action="fin-sheet" data-url="' + esc(f.sheetUrl) + '">Open finance sheet</button>'
      : '';
    return '<div class="bar"><h1>Financials</h1><span class="lock" data-action="fin-lock-hint">' + (unlocked ? 'Unlocked · locks again when you leave' : 'Locked — enter the code to open') + '</span>'
      + '<div class="r">' + (unlocked ? '<button type="button" class="btn" data-action="fin-figs">Edit figures</button>' : '') + '<button type="button" class="btn" id="lockBtn" data-action="fin-lock">Lock now</button>' + sheet + '</div></div>'
      + (unlocked && S().finFigEdit ? figsForm(f.figures || {}) : '')
      + '<div class="k4">' + kp('Cash', cash, f.cashSub || ('in the bank' + (has(f.asOf) ? ' &middot; ' + esc(f.asOf) : ''))) + kp('Burn', f.burnLabel, f.burnSub || 'per month')
      + kp('Runway', f.runwayLabel, 'at this cash', 'red') + kp(r.title || 'Raise', r.inLabel, raiseSub, '', !!r.title) + '</div>'
      + '<div class="g2"><section class="card"><div class="ch"><h3>Raise detail</h3><span class="s">' + ((f.cheques || []).length ? (f.cheques.length + ' cheques') : 'cheques') + '</span></div>'
      + (cheques ? '<div class="chq">' + cheques + '</div>' : '<div class="empty">' + esc(NA) + '</div>')
      + '<div class="rs">' + rs('In', r.inLabel) + rs('To go', r.toGoLabel) + rs('Days left', daysLeft) + rs('Needed pace', r.pace) + '</div>'
      + (has(r.paceNote) ? '<div class="pace">' + r.paceNote + '</div>' : '')
      + '</section><section class="card"><div class="ch"><h3>Where the money goes</h3><span class="s">monthly burn by line</span></div>' + lines + '</section></div>'
      + '<section class="card"><div class="ch"><h3>Model scenarios</h3><span class="s">' + esc((model && model.metric) || '2031 revenue') + (model && model.date ? ' &middot; ' + esc(model.date) + ' model' : '') + '</span></div>' + sc + '</section>';
  }
  /* Edit figures: the four numbers kept by hand. Burn comes from Monthly expenses below. */
  function figsForm(fg) {
    function v(x) { return x == null ? '' : String(x); }
    return '<section class="card figs"><style>.figs .fg{display:grid;grid-template-columns:repeat(4,minmax(0,1fr)) auto;gap:10px;align-items:end;padding:4px 16px 16px}'
      + '.figs label{display:block;font-size:11px;font-weight:800;letter-spacing:.06em;color:#4a5672;margin-bottom:4px}'
      + '.figs input{width:100%;box-sizing:border-box;font:inherit;font-size:14px;font-weight:700;color:#101a33;background:#fff;border:1px solid #d5dbe8;border-radius:9px;padding:8px 10px}'
      + '.figs .er{color:#c0263e;font-size:12.5px;padding:0 16px 12px}@media(max-width:900px){.figs .fg{grid-template-columns:1fr 1fr}}</style>'
      + '<div class="ch"><h3>Edit figures</h3><span class="s">burn and runway work themselves out from these and the expenses list</span></div>'
      + '<div class="fg"><div><label>CASH IN THE BANK</label><input data-fig="cash" inputmode="decimal" placeholder="e.g. 42000" value="' + esc(v(fg.cash)) + '"></div>'
      + '<div><label>RAISED SO FAR</label><input data-fig="raiseIn" inputmode="decimal" placeholder="e.g. 80000" value="' + esc(v(fg.raiseIn)) + '"></div>'
      + '<div><label>RAISE TARGET</label><input data-fig="raiseTarget" inputmode="decimal" placeholder="e.g. 250000" value="' + esc(v(fg.raiseTarget)) + '"></div>'
      + '<div><label>CLOSE DATE</label><input data-fig="closeDate" type="date" value="' + esc(v(fg.closeDate)) + '"></div>'
      + '<div style="display:flex;gap:8px"><button type="button" class="btn" data-action="fin-figs">Cancel</button><button type="button" class="btn pri" data-action="fin-figs-save">Save</button></div></div>'
      + (S().finFigErr ? '<div class="er">' + esc(S().finFigErr) + '</div>' : '') + '</section>';
  }
  /* Monthly expenses and spend (back end only; the calendar shows these only when its $ switch is on). */
  var MONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function m2(n) { return '$' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function ord(n) { var t = n % 100; return n + ((t > 10 && t < 14) ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th')); }
  function expensesHtml(s) {
    var d = s.expData, ed = s.expEdit || null;
    var css = '<style>.xpw .xk{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:4px 0 14px}.xpw .xk div{background:rgba(255,255,255,.03);border:1px solid rgba(120,150,255,.14);border-radius:10px;padding:10px 12px}.xpw .xk small{display:block;font-size:11px;font-weight:800;letter-spacing:.07em;color:#a3b0d2}.xpw .xk b{display:block;font-size:20px;font-weight:900;margin-top:2px;color:#e9eefa}.xpw .xk i{font-style:normal;font-size:12px;color:#a3b0d2}'
      + '.xpw table{width:100%;border-collapse:collapse}.xpw th{font-size:11px;letter-spacing:.07em;color:#a3b0d2;text-align:left;padding:7px 8px;border-bottom:1px solid rgba(120,150,255,.14)}.xpw td{padding:8px;border-bottom:1px solid rgba(120,150,255,.1);color:#c8d1ea;font-size:13px}.xpw td b{color:#e9eefa}'
      + '.xpw .fq{font-size:11px;font-weight:800;border-radius:6px;padding:2px 7px}.xpw .fq.m{background:rgba(255,181,71,.13);color:#ffd08a}.xpw .fq.y{background:rgba(161,115,255,.14);color:#d6c2ff}'
      + '.xpw .lk{font:inherit;font-size:12px;font-weight:750;background:none;border:0;color:#8dbaff;cursor:pointer;padding:2px 6px}.xpw .lk.del{color:#ff9fb0}'
      + '.xpw input,.xpw select{font:inherit;font-size:13px;background:#18191f;border:1px solid rgba(120,150,255,.28);border-radius:7px;color:#e9eefa;padding:5px 7px;width:100%}'
      + '.xpw .add{margin-top:10px}.xpw .er{color:#ff9fb0;font-size:12.5px;margin-top:6px}.xpw .nt{font-size:12.5px;color:#a3b0d2;margin-top:10px}'
      + '@media(max-width:700px){.xpw .xk{grid-template-columns:1fr 1fr}}</style>';
    if (!d) return css + '<section class="card xpw"><div class="ch"><h3>Monthly expenses</h3><span class="s">loading</span></div></section>';
    if (d.error) return css + '<section class="card xpw"><div class="ch"><h3>Monthly expenses</h3></div><div class="empty">' + esc(d.error) + '</div></section>';
    var sp = d.spend || {}, list = d.expenses || [];
    var neon = sp.neon || {};
    var neonTxt = neon.connected ? (neon.computeHours + ' compute hours since ' + esc(String(neon.periodStart || '').slice(0, 10))) : 'add a Neon API key in Vercel to track this';
    var k = '<div class="xk"><div><small>THIS MONTH</small><b>' + m2(sp.monthTotal) + '</b><i>' + m2(sp.soFar) + ' out so far · ' + (sp.paymentsThisMonth || 0) + ' payments</i></div>'
      + '<div><small>EVERY MONTH</small><b>' + m2(sp.monthly) + '</b><i>plus ' + m2(sp.yearly) + ' in yearly renewals</i></div>'
      + '<div><small>A YEAR IN ALL</small><b>' + m2(sp.annual) + '</b><i>from this list</i></div>'
      + '<div><small>AI CALLS THIS MONTH</small><b>' + (sp.aiCalls || 0) + '</b><i>about ' + m2(sp.aiEstimate) + ' · Neon: ' + neonTxt + '</i></div></div>';
    function row(e) {
      if (ed && ed.id === e.id) return editRow(e);
      return '<tr><td><b>' + esc(e.name) + '</b></td><td><span class="fq ' + e.freq + '">' + (e.freq === 'm' ? 'Monthly' : 'Yearly') + '</span></td><td>'
        + (e.freq === 'm' ? 'the ' + ord(e.day) : MONS[(e.month || 1) - 1] + ' ' + e.day) + '</td><td><b>' + m2(e.amount) + '</b></td><td style="text-align:right;white-space:nowrap">'
        + '<button type="button" class="lk" data-xp="edit" data-id="' + esc(e.id) + '">Edit</button><button type="button" class="lk del" data-xp="del" data-id="' + esc(e.id) + '">Delete</button></td></tr>';
    }
    function editRow(e) {
      e = e || { id: '', name: '', freq: 'm', day: 1, month: null, amount: '' };
      var mo = MONS.map(function (n, i) { return '<option value="' + (i + 1) + '"' + (e.month === i + 1 ? ' selected' : '') + '>' + n + '</option>'; }).join('');
      return '<tr class="xed"><td><input id="xpName" value="' + esc(e.name) + '" placeholder="Service"></td><td><select id="xpFreq"><option value="m"' + (e.freq === 'm' ? ' selected' : '') + '>Monthly</option><option value="y"' + (e.freq === 'y' ? ' selected' : '') + '>Yearly</option></select></td>'
        + '<td style="display:flex;gap:6px"><select id="xpMonth" title="Month (yearly bills)"><option value="">Every month</option>' + mo + '</select><input id="xpDay" type="number" min="1" max="31" value="' + esc(e.day) + '" style="width:64px" title="Day of the month"></td>'
        + '<td><input id="xpAmt" type="number" step="0.01" min="0" value="' + esc(e.amount) + '" style="width:100px"></td>'
        + '<td style="text-align:right;white-space:nowrap"><button type="button" class="lk" data-xp="save" data-id="' + esc(e.id) + '">Save</button><button type="button" class="lk" data-xp="cancel">Cancel</button></td></tr>';
    }
    var body = list.map(row).join('') + (ed && ed.id === '' ? editRow(null) : '');
    return css + '<section class="card xpw" id="xpCard"><div class="ch"><h3>Monthly expenses</h3><span class="s">shown on the calendar only when you press its $ button</span></div>' + k
      + '<table><thead><tr><th>SERVICE</th><th>HOW OFTEN</th><th>COMES OUT</th><th>AMOUNT</th><th></th></tr></thead><tbody>' + body + '</tbody></table>'
      + (s.expErr ? '<div class="er">' + esc(s.expErr) + '</div>' : '')
      + (s.expUndo ? '<div class="nt" style="color:#e9eefa">Deleted ' + esc(s.expUndo.name) + ' <button type="button" class="lk" data-xp="undo">Undo</button></div>' : '')
      + '<button type="button" class="btn add" data-xp="new">+ Add an expense</button>'
      + '<div class="nt">Started from the SaaS OPEX tab of the finance tracker. Deleting a row can be undone for 6 seconds.</div></section>';
  }
  function loadExpenses(force) {
    var s = S();
    if (s.__expLoading || (s.expData && !force)) return;
    s.__expLoading = true;
    api('/api/finance/expenses').then(function (r) { return r && r.json ? r.json().then(function (j) { return { ok: r.ok, j: j }; }) : null; }).then(function (x) {
      s.__expLoading = false;
      s.expData = x && x.ok ? x.j : { error: (x && x.j && x.j.locked) ? 'Unlock Financials to see the expenses.' : 'Expenses could not load right now.' };
      if (s.desk === 'finance') paintFinance();
    }).catch(function () { s.__expLoading = false; s.expData = { error: 'Expenses could not load right now.' }; if (s.desk === 'finance') paintFinance(); });
  }
  function bindExpenses(root) {
    var card = root.getElementById && root.getElementById('xpCard');
    if (!card || card.__bound) return;
    card.__bound = true;
    card.addEventListener('click', function (ev) {
      var b = ev.target.closest && ev.target.closest('[data-xp]');
      if (!b) return;
      var s = S(), act = b.getAttribute('data-xp'), id = b.getAttribute('data-id') || '';
      var list = (s.expData && s.expData.expenses) || [];
      if (act === 'new') { s.expEdit = { id: '' }; s.expErr = ''; paintFinance(); return; }
      if (act === 'edit') { s.expEdit = { id: id }; s.expErr = ''; paintFinance(); return; }
      if (act === 'cancel') { s.expEdit = null; s.expErr = ''; paintFinance(); return; }
      if (act === 'save') {
        var v = function (x) { var el = root.getElementById(x); return el ? el.value : ''; };
        var freq = v('xpFreq'), body = { name: v('xpName'), freq: freq, day: Number(v('xpDay')), month: freq === 'y' ? Number(v('xpMonth')) : null, amount: Number(v('xpAmt')) };
        if (id) body.id = id;
        api('/api/finance/expenses', { method: id ? 'PATCH' : 'POST', body: body }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); }).then(function (x) {
          if (!x.ok) { s.expErr = (x.j && x.j.error) || 'Could not save.'; paintFinance(); return; }
          s.expEdit = null; s.expErr = ''; loadExpenses(true);
        });
        return;
      }
      if (act === 'del') {
        var gone = list.filter(function (e) { return e.id === id; })[0];
        api('/api/finance/expenses', { method: 'DELETE', body: { id: id } }).then(function () {
          s.expUndo = gone ? { id: id, name: gone.name } : null;
          clearTimeout(s.__expUndoT); s.__expUndoT = setTimeout(function () { s.expUndo = null; if (S().desk === 'finance') paintFinance(); }, 6000);
          loadExpenses(true);
        });
        return;
      }
      if (act === 'undo' && s.expUndo) {
        var u = s.expUndo; s.expUndo = null; clearTimeout(s.__expUndoT);
        api('/api/finance/expenses', { method: 'DELETE', body: { id: u.id, restore: true } }).then(function () { loadExpenses(true); });
      }
    });
  }
  function gateHtml(on) {
    var g = S().finGate || {};
    return '<div class="gate' + (on ? ' on' : '') + '" id="gate"><div class="gbox' + (g.shake ? ' shake' : '') + '" id="gbox"><div class="ic">Locked</div><h3>Financials</h3><p>Enter your code, then press Return.</p>'
      + '<input id="code" type="password" inputmode="numeric" maxlength="8" autocomplete="off" aria-label="Code" data-action="fin-code" data-ext-field' + (g.busy ? ' disabled' : '') + '><div class="er" id="er">' + esc(g.error || '') + '</div></div></div>';
  }
  function paintFinance() {
    var s = S();
    loadCss('finance').then(function () { whenFixture(function () {
      var root = mount('finDesk', 'finance');
      if (!root) return;
      var fx = fixtureOn();
      var unlocked = fx ? !s.finFxLocked : !!(s.finUnlocked && s.finance && s.finance.locked === false);
      var data = fx ? fixtureFinance() : (unlocked ? s.finance : null);
      paintInto(root, financeHtml(data, unlocked) + (unlocked && !fx ? expensesHtml(s) : '') + gateHtml(!unlocked));
      if (unlocked && !fx) { bindExpenses(root); loadExpenses(false); }
      var g = s.finGate || {};
      if (g.shake) setTimeout(function () { var b = root.getElementById('gbox'); if (b) b.classList.remove('shake'); g.shake = false; }, 400);
      if (!unlocked && s.desk === 'finance') setTimeout(function () { var i = root.getElementById('code'); if (i && !i.disabled) i.focus(); }, 30);
    }); });
    /* A still-valid 15-minute cookie unlocks without asking again (one check per visit). */
    if (!fixtureOn() && s.desk === 'finance' && !s.finUnlocked && !s.__finChecking && !s.__finChecked) {
      s.__finChecking = true;
      api('/api/finance').then(function (r) { return r && r.ok ? r.json() : null; }).then(function (d) {
        s.__finChecking = false;
        s.__finChecked = true;
        if (d && d.locked === false && s.desk === 'finance') { s.finance = d; s.finUnlocked = true; try { sessionStorage.setItem('cr_fin_until', String(Date.now() + 15 * 60000)); } catch (e) {} }
        paintFinance();
      }).catch(function () { s.__finChecking = false; s.__finChecked = true; });
    }
  }
  function submitCode(root, input) {
    var s = S();
    var g = s.finGate || (s.finGate = {});
    var got = String(input.value || '').replace(/\s+/g, '');
    input.value = '';
    if (!got || g.busy) return;
    function bad(msg) { g.busy = false; g.error = msg; g.shake = true; paintFinance(); }
    if (fixtureOn()) { s.finFxLocked = false; g.error = ''; paintFinance(); return; }
    g.busy = true;
    g.error = '';
    api('/api/finance', { method: 'POST', body: { code: got } }).then(function (r) {
      if (!r) throw new Error('none');
      if (r.status === 429) { bad('Too many tries. Wait 15 minutes.'); return null; }
      if (r.status === 403) { bad('That code did not match.'); return null; }
      if (!r.ok) { bad('Finance is unavailable right now.'); return null; }
      return api('/api/finance').then(function (x) { if (!x || !x.ok) { bad('Finance is unavailable right now.'); return null; } return x.json(); });
    }).then(function (d) {
      if (!d) return;
      if (d.locked !== false) { bad('Finance is unavailable right now.'); return; }
      g.busy = false;
      s.finance = d;
      s.finUnlocked = true;
      try { sessionStorage.setItem('cr_fin_until', String(Date.now() + 15 * 60000)); } catch (e) {}
      paintFinance();
    }).catch(function () { bad('Finance is unavailable right now.'); });
  }
  var financeActions = {
    'fin-code': function () {},
    'fin-lock': function (el, root) {
      var s = S();
      if (fixtureOn()) { s.finFxLocked = true; paintFinance(); return; }
      s.finUnlocked = false;
      s.finance = null; s.expData = null; s.expEdit = null;
      s.__finChecked = true;
      try { sessionStorage.removeItem('cr_fin_until'); } catch (e) {}
      paintFinance();
      api('/api/finance', { method: 'POST', body: { lock: true } }).then(function (r) {
        if (!r || !r.ok) toast(root, 'Locked here; the server lock did not confirm');
      }).catch(function () { toast(root, 'Locked here; the server lock did not confirm'); });
    },
    'fin-figs': function () {
      var s = S();
      s.finFigEdit = !s.finFigEdit;
      s.finFigErr = '';
      paintFinance();
    },
    'fin-figs-save': function (el, root) {
      var s = S();
      var body = {};
      root.querySelectorAll('[data-fig]').forEach(function (i) { body[i.getAttribute('data-fig')] = i.value; });
      api('/api/finance/figures', { method: 'PATCH', body: body }).then(function (r) {
        return r ? r.json().then(function (d) { return { ok: r.ok, d: d }; }) : { ok: false, d: {} };
      }).then(function (x) {
        if (!x.ok) { s.finFigErr = (x.d && x.d.error) || 'Could not save.'; paintFinance(); return; }
        s.finFigEdit = false;
        s.finFigErr = '';
        return api('/api/finance').then(function (r) { return r && r.ok ? r.json() : null; }).then(function (d) {
          if (d && d.locked === false) s.finance = d;
          paintFinance();
          toast(root, 'Figures saved');
        });
      }).catch(function () { s.finFigErr = 'Could not save.'; paintFinance(); });
    },
    'fin-sheet': function (el) {
      var url = attr(el, 'data-url');
      if (/^https:\/\//.test(url)) window.open(url, '_blank', 'noopener,noreferrer');
    },
    'fin-lock-hint': function (el, root) {
      toast(root, 'Financials lock when you leave the page. Enter the code to unlock.');
    }
  };
  /* Leaving the page: switchView's lockFinance(true) posts the lock; reset the per-visit check here. */
  function onDeskChange() {
    var s = S();
    if (s.desk !== 'finance') { s.__finChecked = false; s.finGate = {}; s.expData = null; s.expEdit = null; }
  }

  /* ===================== wiring ===================== */
  function register() {
    if (!window.deskActions) return false;
    Object.assign(window.deskActions, peopleActions, financeActions);
    if (typeof window.openContactCard === 'function' && !window.openContactCard.__p6) {
      var priorCard = window.openContactCard;
      window.openContactCard = function (id) {
        priorCard(id);
        var del = document.getElementById('delOne');
        if (del) {
          del.setAttribute('data-action', 'people-delete');
          del.setAttribute('data-id', id);
          del.onclick = null;
        }
        var close = document.getElementById('dClose');
        if (close) close.textContent = 'Close';
        var c = findContact(id) || {};
        Array.from(document.querySelectorAll('#drawer a[href^="mailto:"], #drawer a[href^="tel:"]')).forEach(function (a) {
          var href = a.getAttribute('href') || '';
          if (href === 'mailto:' || href === 'tel:' || href === 'mailto:undefined' || href === 'tel:undefined' || href === 'tel:null' || /^tel:\s*$/.test(href) || (href.indexOf('tel:') === 0 && !/\d/.test(href))) {
            if (/^mailto:/.test(href)) {
              a.removeAttribute('href');
              a.setAttribute('data-action', 'people-add-email');
              a.setAttribute('data-id', id);
              a.textContent = 'No email on file - Add one';
            } else {
              a.removeAttribute('href');
              a.setAttribute('data-action', 'people-add-phone');
              a.setAttribute('data-id', id);
              a.hidden = false;
              a.textContent = 'No phone on file - Add one';
            }
          }
        });
        void c;
      };
      window.openContactCard.__p6 = true;
    }
    window.__deskInputExt = window.__deskInputExt || {};
    window.__deskKeyExt = window.__deskKeyExt || {};
    window.__deskRefreshExt = window.__deskRefreshExt || {};
    var searchTimer = 0;
    window.__deskInputExt['people-search'] = function (el) {
      S().peopleQ = String(el.value || '');
      S().peopleAll = false;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(paintContacts, 140);
    };
    window.__deskInputExt['people-email-subject'] = function (el) { var cp = S().peopleCompose; if (cp) cp.subject = String(el.value || ''); };
    window.__deskInputExt['people-email-body'] = function (el) { var cp = S().peopleCompose; if (cp) cp.body = String(el.value || ''); };
    window.__deskKeyExt['fin-code'] = function (el, root, e) {
      if (e.key !== 'Enter') return false;
      e.preventDefault();
      submitCode(root, el);
      return true;
    };
    function composeKey(el, root, e) {
      if (e.key === 'Escape') { e.preventDefault(); S().peopleCompose = null; paintContacts(); return true; }
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); peopleActions['people-email-send'](el, root); return true; }
      return false;
    }
    window.__deskKeyExt['people-email-subject'] = composeKey;
    window.__deskKeyExt['people-email-body'] = composeKey;
    window.__deskKeyExt['people-search'] = function (el, root, e) {
      if (e.key === 'Escape' && el.value) { el.value = ''; S().peopleQ = ''; paintContacts(); return true; }
      return false;
    };
    window.__deskRefreshExt.people = function () { if (S().desk === 'people') paintContacts(); };
    window.__deskRefreshExt.finance = function () { if (S().desk === 'finance') paintFinance(); };
    return true;
  }
  if (!register()) {
    var tries = 0;
    var t = setInterval(function () { tries += 1; if (register() || tries > 40) clearInterval(t); }, 50);
  }
  window.paintRedesignContacts = function () { onDeskChange(); if (S().desk === 'people') paintContacts(); };
  window.paintRedesignFinance = function () { onDeskChange(); if (S().desk === 'finance') paintFinance(); };
  window.__peoplePage = { liveContactsVm: liveContactsVm, contactsHtml: contactsHtml, financeHtml: financeHtml, fixtureContactsVm: fixtureContactsVm, fixtureFinance: fixtureFinance, gateHtml: gateHtml };
})();
