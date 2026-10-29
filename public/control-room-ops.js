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

  function moveLabel(move) {
    return move ? (move.title || move.name || move.text || '') : '';
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

  function daysToClose() {
    var end = Date.parse('2026-10-30T07:00:00Z');
    return Math.max(0, Math.ceil((end - Date.now()) / 86400000));
  }

  function missionShut() {
    try { return JSON.parse(localStorage.getItem('cr_mission') || '{}'); } catch (err) { return {}; }
  }

  function mc(id, title, sub, body) {
    var shut = missionShut()[id] === false;
    return '<section class="mcard' + (shut ? ' collapsed' : '') + '" data-card="' + id + '"><button type="button" class="ch" data-mc="' + id + '"><span class="t">' + title + '</span><span class="s">' + sub + '</span><span class="cx">' + (shut ? '>' : 'v') + '</span></button>' + body + '</section>';
  }

  function showMoney() {
    try { return localStorage.getItem('cr_show_money') === '1'; } catch (err) { return false; }
  }
  function setShowMoney(on) {
    try { localStorage.setItem('cr_show_money', on ? '1' : '0'); } catch (err) {}
    if (typeof renderOpsDash === 'function') renderOpsDash();
    if (typeof renderWar === 'function') renderWar();
  }
  function cashText(raw) {
    return showMoney() ? raw : '$••••';
  }
  function maskDollars(s) {
    if (showMoney()) return s;
    return String(s).replace(/~?\$[0-9][0-9,]*(?:\.\d+)?(?:K|M)?/g, '$••••');
  }
  function moneyEye() {
    return '<button type="button" class="eye" data-money-eye="1">' + (showMoney() ? 'Hide $' : 'View $') + '</button>';
  }
  function peopleInboxOn() {
    try { return localStorage.getItem('cr_inbox_people') !== '0'; } catch (err) { return true; }
  }
  function hiddenSenders() {
    var map = {};
    (STATE.mailHidden || []).forEach(function (email) { if (email) map[String(email).toLowerCase()] = true; });
    try {
      JSON.parse(localStorage.getItem('cr_inbox_hide') || '[]').forEach(function (email) { if (email) map[String(email).toLowerCase()] = true; });
    } catch (err) {}
    return map;
  }
  function hideSender(email) {
    email = String(email || '').toLowerCase();
    if (!email) return;
    var rows = [];
    try { rows = JSON.parse(localStorage.getItem('cr_inbox_hide') || '[]'); } catch (err) { rows = []; }
    if (rows.indexOf(email) < 0) rows.push(email);
    try { localStorage.setItem('cr_inbox_hide', JSON.stringify(rows)); } catch (err) {}
    STATE.mailHidden = (STATE.mailHidden || []).concat([email]);
    authFetch('/api/mail', { method: 'POST', quiet: true, credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ hide: email }) }).catch(function () {});
    renderOpsDash();
  }
  function dismissMove(id) {
    id = String(id || '');
    if (!id) return;
    var data = STATE.ceo || { moves: [] };
    var prev = (data.moves || []).slice();
    var mtext = typeof ceoMoveText === 'function' ? ceoMoveText(id) : '';
    STATE.ceo = Object.assign({}, data, { moves: prev.filter(function (m) { return String(m.id) !== id; }) });
    var map = {};
    try { map = JSON.parse(localStorage.getItem('cr_needle') || '{}'); } catch (err) { map = {}; }
    if (String(map.one || '') === id) map.one = '';
    try { localStorage.setItem('cr_needle', JSON.stringify(map)); } catch (err) {}
    renderWar();
    if (typeof renderOpsDash === 'function') renderOpsDash();
    authFetch('/api/ceo/moves/' + id + '/snooze', { method: 'POST', quiet: true, credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reason: 'dismissed', text: mtext }) }).then(function (r) {
      if (!r.ok) throw 0;
      return r.json();
    }).then(function (next) {
      if (typeof applyCeo === 'function') applyCeo(next);
      else STATE.ceo = next;
      renderWar();
      if (typeof renderOpsDash === 'function') renderOpsDash();
    }).catch(function () {
      STATE.ceo = Object.assign({}, data, { moves: prev });
      renderWar();
    });
  }
  function mailIsContact(row) {
    var email = String((row && row.email) || '').toLowerCase();
    var name = String((row && row.from) || '').toLowerCase();
    return (STATE.contacts || []).some(function (c) {
      return (email && c.email && String(c.email).toLowerCase() === email) || (name && c.name && String(c.name).toLowerCase() === name);
    });
  }

  function ageLabel(ms) {
    var gap = Date.now() - Number(ms || 0);
    if (!ms || gap < 0) return '';
    var mins = Math.round(gap / 60000);
    if (mins < 60) return mins + 'm ago';
    var hours = Math.round(mins / 60);
    if (hours < 48) return hours + 'h ago';
    return Math.round(hours / 24) + 'd ago';
  }

  function missionHtml(rows, doneWeek) {
    var days = daysToClose();
    var open = rows.filter(function (it) { return it.status !== 'done'; });
    var overdue = open.filter(function (it) { return bucket(it) === 'overdue'; });
    var reach = (STATE.reachOut || []).filter(function (person) { return !person.done; });
    var drafts = (STATE.packages || []).filter(function (space) { return String(space.stage || space.status || 'draft') === 'draft'; });
    var needs = [];
    if (days <= 30) needs.push(['r', 'Raise closes in ' + days + ' days. 4 of 7 cheques are still open.', 'Raise']);
    if (overdue.length) needs.push(['a', overdue.length + ' task' + (overdue.length === 1 ? '' : 's') + ' overdue.', 'Tasks']);
    if (reach.length) needs.push(['b', reach.length + ' people still waiting on a reach-out.', 'Reach out']);
    if (drafts.length) needs.push(['a', drafts.length + ' spaces are still drafts.', 'Spaces']);
    try {
      JSON.parse(localStorage.getItem('cr_dash_notes') || '[]').slice(0, 2).forEach(function (pin) {
        if (pin && pin.text) needs.push(['b', pin.text, 'Notes']);
      });
    } catch (err) {}
    if (!needs.length) needs.push(['b', 'Nothing on the desk is on fire.', 'Desk']);
    var needHtml = needs.map(function (row) {
      return '<div class="alert"><span class="sev ' + row[0] + '"></span><div>' + esc(row[1]) + '<span class="src">' + esc(row[2]) + '</span></div><button type="button" class="go" data-go="room">Open</button></div>';
    }).join('');
    var labels = [['in', 'In'], ['in', 'In'], ['in', cashText('$80K')], ['pend', 'Pend'], ['open', '5'], ['open', '6'], ['open', '7']];
    var cheques = labels.map(function (pair) { return '<div class="cq ' + pair[0] + '">' + pair[1] + '</div>'; }).join('');
    var worries = [
      ['r', '<b>Concentration.</b> The $80K in is one friends-and-family track. One delayed cheque is the whole pace.'],
      ['r', '<b>About a day of runway.</b> Cash is $100. A cheque has to land before the desk goes dark.'],
      ['a', '<b>Unsigned docs plus a short runway.</b> That pairing is what stalls a close.'],
      ['a', '<b>One build path.</b> If that partner slips, the product date slips with it.']
    ];
    var worryHtml = '<div class="worry">' + worries.map(function (row) {
      return '<div class="worryrow"><span class="ic ' + row[0] + '">!</span><div class="tx">' + row[1] + '</div></div>';
    }).join('') + '</div>';
    var vcBook = (STATE.contacts || []).filter(function (c) {
      return typeof catMatch === 'function' && typeof contactCategory === 'function' && (catMatch(contactCategory(c), 'vc') || catMatch(contactCategory(c), 'angel'));
    });
    var vcEmails = {};
    var vcNames = {};
    vcBook.forEach(function (c) {
      if (c.email) vcEmails[String(c.email).toLowerCase()] = true;
      if (c.name && String(c.name).length > 3) vcNames[String(c.name).toLowerCase()] = true;
    });
    (STATE.ghlPipes || []).forEach(function (pipe) {
      if (!/vc|venture|investor|angel|capital|raise/i.test(pipe.name || '')) return;
      (pipe.stages || []).forEach(function (stage) {
        (stage.opps || []).forEach(function (o) {
          if (o.email) vcEmails[String(o.email).toLowerCase()] = true;
          if (o.contact && String(o.contact).length > 3) vcNames[String(o.contact).toLowerCase()] = true;
        });
      });
    });
    function isVcMail(row) {
      if (row.internal || row.outbound) return false;
      var email = String(row.email || '').toLowerCase();
      var name = String(row.from || '').toLowerCase();
      return !!((email && vcEmails[email]) || (name && vcNames[name]));
    }
    function isAction(row) {
      return /\b(sign|signature|docusign|agreement|contract|invoice|action required|approve|approval|deadline|due by|by (mon|tue|wed|thu|fri)|wire)\b/i.test((row.subject || '') + ' ' + (row.snippet || ''));
    }
    var hidden = hiddenSenders();
    var peopleOnly = peopleInboxOn();
    var mail = (STATE.mail || []).filter(function (row) {
      var who = String(row.from || '').replace(/\s+/g, ' ').trim();
      var email = String(row.email || '').toLowerCase();
      if (/^chad r\.?\s*johnston$/i.test(who) && !row.outbound) return false;
      if (email && hidden[email]) return false;
      if (peopleOnly && row.bulk && !mailIsContact(row)) return false;
      return true;
    }).slice().sort(function (a, b) {
      var av = isVcMail(a) ? 0 : 1;
      var bv = isVcMail(b) ? 0 : 1;
      return av - bv || (Number(b.at) || 0) - (Number(a.at) || 0);
    });
    STATE.mailRows = mail.slice(0, 5);
    var vcMail = mail.filter(isVcMail);
    var tog = '<div class="tog"><button type="button" data-inbox-mode="people"' + (peopleOnly ? ' class="on"' : '') + '>People only</button><button type="button" data-inbox-mode="all"' + (peopleOnly ? '' : ' class="on"') + '>All mail</button></div>';
    var inbox = '<div class="inbox">' + tog + (mail.length ? STATE.mailRows.map(function (row, ix) {
      var vc = isVcMail(row);
      var act = !vc && isAction(row);
      var who = String(row.from || row.email || 'Sender');
      var bits = who.replace(/[^A-Za-z0-9 ]/g, ' ').trim().split(/\s+/).slice(0, 2).map(function (part) { return part.slice(0, 1); }).join('').toUpperCase() || '?';
      var flag = vc ? '<span class="flag vc">VC &middot; reply</span>' : act ? '<span class="flag act">Action</span>' : '<span class="flag rep">Reply</span>';
      return '<div class="ir"><span class="av' + (vc ? ' vc' : '') + '">' + esc(bits) + '</span><div class="bd"><div class="su">' + (row.outbound ? '<span class="to">To</span> ' : '') + esc(who) + '</div><div class="sj">' + esc(row.subject || '(no subject)') + '</div>' + (row.snippet ? '<div class="sn">' + esc(row.snippet) + '</div>' : '') + '<div class="age">' + esc(ageLabel(row.at)) + '</div><button type="button" class="hide" data-hide-mail="' + esc(row.email || '') + '">Not a person / bulk</button></div><div class="ra">' + flag + '<button type="button" class="rp" data-reply="' + ix + '">Reply</button></div></div>';
    }).join('') + '<div class="cmini">' + (vcMail.length ? '<b>' + vcMail.length + ' VC email' + (vcMail.length === 1 ? '' : 's') + '</b> waiting on you - never let these sit.' : 'No investor mail waiting on you.') + '</div>' : '<div class="quiet">No person-to-person mail in the last 14 days.</div>') + '</div>';
    var linked = (STATE.linkedin || []).slice().sort(function (a, b) { return (Number(b.at) || 0) - (Number(a.at) || 0); });
    var linkedNew = linked.filter(function (row) { return row.unread; }).length;
    var kindWord = { message: 'sent you a message', inmail: 'sent you an InMail', invite: 'wants to connect', update: 'posted an update' };
    var linkedHtml = linked.length ? '<div class="lnx">' + linked.slice(0, 8).map(function (row, ix) {
      return '<div class="ln' + (ix === 0 ? ' pin' : '') + (row.unread ? ' new' : '') + '"><span class="inb">in</span><div class="bd"><div class="su">' + esc(row.name || 'LinkedIn') + (row.kind === 'update' && /^linkedin$/i.test(row.name || '') ? '' : ' <span class="kd">' + esc(kindWord[row.kind] || kindWord.update) + '</span>') + '</div><div class="sn">' + esc(row.snippet || '') + '</div></div><div class="ra"><span class="age">' + esc(ageLabel(row.at)) + '</span><a class="lo" href="https://www.linkedin.com/messaging/" target="_blank" rel="noopener noreferrer">Open in LinkedIn</a></div></div>';
    }).join('') + '</div>' : '<div class="quiet">No LinkedIn notifications in the last 30 days. They arrive by email to the connected inbox.</div>';
    var queue = STATE.content;
    var content = queue && typeof queue.left === 'number' ? '<div class="runway-gauge"><div class="rbig">' + queue.left + '</div><div class="rbar"><div class="track"><i style="width:' + Math.min(100, (Number(queue.left) || 0) * 8) + '%"></i></div><div class="lab">posts left' + (queue.left ? ' - runs dry in about ' + Math.max(1, Math.round(queue.left / Math.max(queue.cadence || 1, 1))) + ' days' : '') + '</div></div></div><div class="cmini"><div class="r"><span>Scheduled / queued</span><b>' + queue.left + (queue.left === 1 ? ' post' : ' posts') + '</b></div><div class="r"><span>Posting cadence</span><b>~' + (queue.cadence || 0) + ' / day</b></div>' + (queue.newsletterDue ? '<div class="r"><span>Newsletter next due</span><b>' + esc(queue.newsletterDue) + '</b></div>' : '') + '</div>' : '<div class="quiet">GoHighLevel has not returned a content queue. Posts left and the day it runs dry show here when it does.</div>';
    var vcs = (STATE.packages || []).filter(function (space) {
      return /vc|venture|angel/i.test(String(space.spaceCategory || space.category || '') + ' ' + String(space.name || ''));
    }).map(function (space) { return { name: space.name, stage: space.stage || space.status || 'open', go: 'work' }; });
    (STATE.ghlPipes || []).forEach(function (pipe) {
      var vcPipe = /vc|venture|investor|angel|capital|raise/i.test(pipe.name || '');
      (pipe.stages || []).forEach(function (stage) {
        (stage.opps || []).forEach(function (o) {
          if (!o.contact && !o.email) return;
          if (!vcPipe) {
            var hit = (STATE.contacts || []).some(function (c) {
              return typeof catMatch === 'function' && catMatch(contactCategory(c), 'vc') && ((c.email && o.email && String(c.email).toLowerCase() === String(o.email).toLowerCase()) || (c.name && o.contact && String(c.name).toLowerCase() === String(o.contact).toLowerCase()));
            });
            if (!hit) return;
          }
          vcs.push({ name: o.contact || o.email, stage: stage.name || o.status || 'open', go: 'contacts' });
        });
      });
    });
    if (!vcs.length) {
      vcs = (STATE.contacts || []).filter(function (c) { return typeof catMatch === 'function' && catMatch(contactCategory(c), 'vc'); }).slice(0, 6).map(function (c) {
        return { name: c.name, stage: c.stage || 'ready', go: 'people' };
      });
    }
    var seenVc = {};
    var watch = vcs.filter(function (space) {
      var key = String(space.name || '').toLowerCase();
      if (!key || seenVc[key]) return false;
      seenVc[key] = 1;
      return true;
    }).slice(0, 6).map(function (space) {
      var stage = String(space.stage || space.status || 'draft');
      var color = /repli|commit/i.test(stage) ? '#17b86a' : /sent|open|meeting/i.test(stage) ? '#f0a020' : '#c6cfdd';
      return '<div class="vcrow"><span class="d" style="background:' + color + '"></span>' + esc(space.name) + '<button type="button" class="act" data-go="' + esc(space.go || 'work') + '">Open</button></div>';
    }).join('') || '<div class="quiet">No VC spaces or VC contacts on the board yet.</div>';
    var pipeScore = Math.min(100, ((STATE.pipeline || []).reduce(function (n, s) { return n + (Number(s.v) || 0); }, 0) ? 70 : 16));
    var cash = 18, raise = 32, product = rows.length ? Math.max(20, 80 - Math.min(open.length, 60)) : 24;
    var legal = rows.some(function (it) { return /legal|regulat/i.test(it.title || ''); }) ? 40 : 55;
    var score = Math.round((cash + raise + pipeScore + product + legal) / 5);
    var movers = ((STATE.ceo && STATE.ceo.moves) || []).filter(function (move) { return moveLabel(move); }).slice(0, 3);
    var needleDash = {};
    try { needleDash = JSON.parse(localStorage.getItem('cr_needle') || '{}'); } catch (err) { needleDash = {}; }
    if (needleDash.day !== laDay(Date.now())) needleDash = { day: laDay(Date.now()), ids: {} };
    var moverHtml = movers.length ? '<div class="mlist">' + movers.map(function (move, i) {
      var id = String(move.id || i);
      var on = !!(needleDash.ids && needleDash.ids[id]);
      return '<div class="m"><span class="dot" style="background:' + (on ? '#17b86a' : (i ? '#1f5fff' : '#f23a4d')) + '"></span>' + esc(moveLabel(move)) + '<span class="mt">' + (on ? 'Done' : '#' + (i + 1)) + '</span></div>';
    }).join('') + '</div><div class="pace">Same 1-3 needle-movers as the War Room.</div>' : '<div class="quiet">No ranked move yet. The War Room one-thing fills this.</div>';
    var bars = [30, 45, 25, 60, 40, 70, Math.min(100, 20 + doneWeek * 8)].map(function (n) { return '<div class="bar" style="height:' + Math.max(8, n) + '%"></div>'; }).join('');
    var meetings = (STATE.events || []).filter(function (ev) { return ev.start >= Date.now() - 60000; }).sort(function (a, b) { return a.start - b.start; }).slice(0, 3);
    var meet = meetings.length ? meetings.map(function (ev) { return '<div class="m"><span class="dot"></span>' + alarmMeetLine(ev) + '</div>'; }).join('') : '<div class="quiet">No meetings on the calendar.</div>';
    var lamps = [
      ['Runway', 'r', 'Critical', 'room'],
      ['Raise pace', 'a', 'Behind', 'room'],
      ['Pipeline', (STATE.pipeline || []).length ? 'g' : 'a', (STATE.pipeline || []).length ? 'Live' : 'Waiting', 'contacts'],
      ['Spend', 'a', 'Watch', 'room'],
      ['Legal docs', 'a', 'Open', 'docs'],
      ['Concentration', 'r', 'High', 'work'],
      ['Integrations', 'g', 'Live', 'int']
    ];
    var strip = '<div class="command"><div class="cmdtop"><div class="vital"><span class="k">Cash</span><span class="v">' + cashText('$100') + '</span><span class="sub">in the bank</span></div><div class="vital"><span class="k">Burn</span><span class="v">' + cashText('~$3K') + '</span><span class="sub">implied / month</span></div><div class="vital"><span class="k">Runway</span><span class="v red">~1 day</span><span class="sub">at this cash</span></div><div class="vital"><span class="k">Raise - F&amp;F</span><span class="v">' + cashText('$80K / $250K') + '</span><span class="prog"><i></i></span></div><div class="countdown"><div class="big">' + days + 'd</div><div class="k">to close - Oct 30</div></div>' + moneyEye() + '</div><div class="lamps">' + lamps.map(function (lamp) {
      return '<button type="button" class="lamp" data-go="' + lamp[3] + '"><span class="led ' + lamp[1] + '"></span><div class="nm">' + lamp[0] + '</div><div class="st ' + lamp[1] + '">' + lamp[2] + '</div></button>';
    }).join('') + '</div></div>';
    return strip
      + '<div class="ctrl">'
      + mc('needs', 'What needs you now', 'across the desk', needHtml)
      + mc('raise', 'Raise tracker', '7 x $25K cheques', '<div class="cheques">' + cheques + '</div><div class="pace"><b>' + cashText('$170,000') + ' to go</b> in ' + days + ' days. This week booked <b>' + cashText('$0') + '</b> new. <span class="warn">Behind pace - widen the round today.</span></div>')
      + mc('worry', 'What I would worry about', 'blind spots', maskDollars(worryHtml))
      + '</div><div class="ctrl">'
      + mc('inbox', 'Inbox - needs you', peopleOnly ? 'people only' : 'all mail', inbox)
      + mc('content', 'Content runway', 'GoHighLevel', content)
      + mc('vc', 'VC watch', 'never let one go cold', watch)
      + '</div><div class="ctrl ctrl-wide">'
      + mc('linkedin', 'Notifications', linkedNew + ' new', linkedHtml)
      + '</div><div class="row3">'
      + mc('health', 'Company health', 'desk snapshot', '<div class="health"><div class="gauge" style="--p:' + score + '"><div class="in"><div class="n">' + score + '</div><div class="l">of 100</div></div></div><div class="subscore"><span>Cash / runway</span><span class="b"><i style="width:' + cash + '%;background:#f23a4d"></i></span></div><div class="subscore"><span>Raise</span><span class="b"><i style="width:' + raise + '%;background:#f0a020"></i></span></div><div class="subscore"><span>Pipeline</span><span class="b"><i style="width:' + pipeScore + '%;background:#17b86a"></i></span></div><div class="subscore"><span>Product</span><span class="b"><i style="width:' + product + '%;background:#f0a020"></i></span></div><div class="subscore"><span>Legal</span><span class="b"><i style="width:' + legal + '%;background:#f0a020"></i></span></div></div>')
      + mc('mom', 'Momentum', 'last 7 days', '<div class="spark">' + bars + '</div><div class="momrow"><span>Done last 7d <b>' + doneWeek + '</b></span><span>Open <b>' + open.length + '</b></span></div><div class="ch" style="cursor:default"><span class="t">Next meetings</span></div><div class="mlist">' + meet + '</div>')
      + mc('move', "Today's 1-3", 'from the War Room', moverHtml)
      + '</div>';
  }

  function openReply(row) {
    var modal = document.getElementById('modal');
    var box = document.getElementById('modalCard');
    if (!modal || !box || !row) return;
    var subject = String(row.subject || '');
    if (!/^re:/i.test(subject)) subject = 'Re: ' + subject;
    box.classList.add('wide');
    box.innerHTML = '<div class="mhd"><div style="font-weight:700">Reply to ' + esc(row.from || row.email || 'sender') + '</div><button class="x" id="mClose" type="button" aria-label="Close">&#215;</button></div><div class="mbd rpx"><label>To<input id="rpTo" type="text" value="' + esc(row.email || '') + '"/></label><label>Subject<input id="rpSub" type="text" value="' + esc(subject) + '"/></label><label>Message<textarea id="rpBody" rows="9" placeholder="Write your reply"></textarea></label>' + (row.snippet ? '<div class="rpq">' + esc(row.snippet) + '</div>' : '') + '<div class="rpa"><span id="rpNote"></span><button class="btn" type="button" id="rpCancel">Cancel</button><button class="btn pri" type="button" id="rpSave">Save draft in Gmail</button></div></div>';
    modal.classList.add('open');
    modal.hidden = false;
    var close = function () { if (typeof closeModal === 'function') closeModal(); };
    document.getElementById('mClose').onclick = close;
    document.getElementById('rpCancel').onclick = close;
    var bodyEl = document.getElementById('rpBody');
    if (bodyEl) bodyEl.focus();
    document.getElementById('rpSave').onclick = function () {
      var btn = this;
      var note = document.getElementById('rpNote');
      btn.disabled = true;
      note.textContent = 'Saving...';
      authFetch('/api/mail', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ to: document.getElementById('rpTo').value, subject: document.getElementById('rpSub').value, text: bodyEl.value, threadId: row.threadId || '', messageId: row.messageId || '' })
      }).then(function (r) { return r.json(); }).then(function (d) {
        if (d && d.saved) { close(); if (typeof deskNote === 'function') deskNote('Reply saved to Gmail drafts.'); return; }
        btn.disabled = false;
        note.textContent = 'Gmail did not take the draft. Check the address, or reconnect Google in Integrations.';
      }).catch(function () { btn.disabled = false; note.textContent = 'Gmail did not take the draft. Try again in a moment.'; });
    };
  }

  function bindMission(el) {
    el.querySelectorAll('[data-reply]').forEach(function (btn) {
      btn.onclick = function (e) {
        e.stopPropagation();
        openReply((STATE.mailRows || [])[Number(btn.getAttribute('data-reply'))]);
      };
    });
    el.querySelectorAll('[data-mc]').forEach(function (btn) {
      btn.onclick = function () {
        var map = missionShut();
        var id = btn.getAttribute('data-mc');
        map[id] = map[id] === false;
        try { localStorage.setItem('cr_mission', JSON.stringify(map)); } catch (err) {}
        renderOpsDash();
      };
    });
    el.querySelectorAll('[data-go]').forEach(function (btn) {
      btn.onclick = function (e) {
        e.stopPropagation();
        if (typeof switchView === 'function') switchView(btn.getAttribute('data-go'));
      };
    });
    el.querySelectorAll('[data-money-eye]').forEach(function (btn) {
      btn.onclick = function (e) {
        e.stopPropagation();
        setShowMoney(!showMoney());
      };
    });
    el.querySelectorAll('[data-inbox-mode]').forEach(function (btn) {
      btn.onclick = function (e) {
        e.stopPropagation();
        try { localStorage.setItem('cr_inbox_people', btn.getAttribute('data-inbox-mode') === 'all' ? '0' : '1'); } catch (err) {}
        renderOpsDash();
      };
    });
    el.querySelectorAll('[data-hide-mail]').forEach(function (btn) {
      btn.onclick = function (e) {
        e.stopPropagation();
        hideSender(btn.getAttribute('data-hide-mail'));
      };
    });
  }

  function loadDeskFeeds() {
    if (STATE.feedsAsked) return;
    STATE.feedsAsked = true;
    var from = new Date(Date.now() - 86400000).toISOString();
    var to = new Date(Date.now() + 14 * 86400000).toISOString();
    authFetch('/api/calendar?from=' + encodeURIComponent(from) + '&to=' + encodeURIComponent(to), { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (data) {
      var events = (data && data.events) || [];
      if (events.length) STATE.events = events;
      console.info('[live-map] /api/calendar', { count: events.length, keys: events[0] ? Object.keys(events[0]) : [] });
      if (STATE.desk === 'room' || !STATE.desk) renderOpsDash();
      if (STATE.desk === 'war') renderWar();
    }).catch(function () { STATE.feedsAsked = false; });
    authFetch('/api/mail', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (data) {
      STATE.mail = ((data && data.messages) || []).filter(function (m) {
        var subject = String(m && m.subject || '');
        var email = String(m && m.email || '').toLowerCase();
        var who = String(m && m.from || '').replace(/\s+/g, ' ').trim();
        if (/^(calendar-notification|calendar-server)@google\.com$/.test(email)) return false;
        if (/^chad r\.?\s*johnston$/i.test(who) && !(m && m.outbound)) return false;
        return !/^\s*(?:(?:re|fwd?|fw)\s*:\s*)*(?:invitation|updated invitation|accepted|declined|tentative|tentatively accepted|canceled|cancelled|canceled event|cancelled event)(?:\s+\(.*?\))?\s*:/i.test(subject);
      });
      STATE.linkedin = (data && data.linkedin) || [];
      STATE.mailHidden = data && data.hidden ? data.hidden : (STATE.mailHidden || []);
      console.info('[live-map] /api/mail', { messages: STATE.mail.length, mailKeys: STATE.mail[0] ? Object.keys(STATE.mail[0]) : [], linkedin: STATE.linkedin.length, linkedinKeys: STATE.linkedin[0] ? Object.keys(STATE.linkedin[0]) : [] });
      if (typeof stampWarmth === 'function') stampWarmth();
      if (STATE.desk === 'room' || !STATE.desk) renderOpsDash();
      if (STATE.desk === 'people' && typeof renderPeople === 'function') renderPeople(document.getElementById('pSearch') ? document.getElementById('pSearch').value : '');
      if (STATE.desk === 'contacts' && typeof renderContacts === 'function') renderContacts(document.getElementById('cSearch') ? document.getElementById('cSearch').value : '');
    }).catch(function () { STATE.mail = STATE.mail || []; STATE.feedsAsked = false; });
    authFetch('/api/ceo/moves', { credentials: 'same-origin', quiet: true }).then(function (r) { return r.json(); }).then(function (data) {
      var moves = (data && data.moves) || [];
      console.info('[live-map] /api/ceo/moves', { count: moves.length, keys: moves[0] ? Object.keys(moves[0]) : [] });
      if (moves.length) {
        STATE.ceo = Object.assign({}, STATE.ceo || {}, { moves: moves, lamps: (data && data.lamps) || (STATE.ceo && STATE.ceo.lamps) || [] });
        if (STATE.desk === 'room' || !STATE.desk) renderOpsDash();
        if (STATE.desk === 'war') renderWar();
      }
    }).catch(function () {});
    authFetch('/api/pipeline', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (data) {
      if (data && data.pipelines && data.pipelines.length) STATE.ghlPipes = data.pipelines;
      if (typeof stampWarmth === 'function') stampWarmth();
      if (STATE.desk === 'contacts' && typeof renderContacts === 'function') renderContacts(document.getElementById('cSearch') ? document.getElementById('cSearch').value : '');
      if (STATE.desk === 'people' && typeof renderPeople === 'function') renderPeople(document.getElementById('pSearch') ? document.getElementById('pSearch').value : '');
      if (STATE.desk === 'room' || !STATE.desk) renderOpsDash();
    }).catch(function () {});
    authFetch('/api/content', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (data) {
      STATE.content = data || { empty: true };
      if (STATE.desk === 'room' || !STATE.desk) renderOpsDash();
    }).catch(function () { STATE.content = { empty: true }; });
    loadMeetingActions();
  }

  function loadMeetingActions(tries) {
    tries = tries || 0;
    function go() {
      authFetch('/api/meeting-actions', { credentials: 'include', quiet: true }).then(function (r) {
        if (r.status === 401 && tries < 4) {
          setTimeout(function () { loadMeetingActions(tries + 1); }, 350);
          return null;
        }
        return r.json();
      }).then(function (data) {
        if (!data) return;
        STATE.meetingActions = (data && data.actions) || [];
        console.info('[live-map] /api/meeting-actions', { count: STATE.meetingActions.length, keys: STATE.meetingActions[0] ? Object.keys(STATE.meetingActions[0]) : [] });
        if (STATE.desk === 'war') renderWar();
      }).catch(function () { STATE.meetingActions = STATE.meetingActions || []; });
    }
    if (window.__clerk && window.__clerk.session) go();
    else if (window.__clerkBoot) Promise.resolve(window.__clerkBoot).then(go).catch(go);
    else go();
  }

  function renderOpsDash() {
    if (typeof window.paintRedesignDashboard === 'function' && document.getElementById('opsDash')) {
      window.paintRedesignDashboard();
      return;
    }
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
    var meetHtml = upcoming.length ? upcoming.map(function (ev) { return alarmMeetLine(ev); }).join('') : '<div class="kick">No meetings on the calendar.</div>';
    var talkHtml = talks.map(function (ev) { return '<div>' + esc(ev.title || 'Call') + '</div>'; }).join('') + reachToday.map(function (person) { return '<div>' + esc(person.name) + ' <span class="kick">' + esc(person.nextAction || 'Reach out') + '</span></div>'; }).join('');
    if (!talkHtml) talkHtml = '<div class="kick">Nothing to call today.</div>';
    var topHtml = top.length ? top.map(function (it) { return '<div class="dash-task">' + esc(it.title) + (it._err ? '<div class="soft-err">' + esc(it._err) + '</div>' : '') + '<button type="button" class="ghost-x" data-task-del="' + esc(it.id) + '" aria-label="Delete">x</button></div>'; }).join('') : '<div class="kick">No open tasks.</div>';
    var trend = [];
    for (var day = 6; day >= 0; day -= 1) {
      var start = new Date(); start.setHours(0, 0, 0, 0); start = start.getTime() - day * 86400000;
      var count = done.filter(function (it) { var at = Date.parse(it.updated_at || '') || 0; return at >= start && at < start + 86400000; }).length;
      trend.push(count);
    }
    loadDeskFeeds();
    el.innerHTML = missionHtml(rows, doneWeek) + '<div class="money"><div><div class="k">Raise - friends &amp; family</div><div class="n">' + cashText('$80K / $250K') + '</div><div class="bar"><span></span></div><div class="kick" style="color:#C5D4E6;margin-top:8px">' + cashText('$170K') + ' to go - 3/7 cheques - 18 days to Oct 30</div></div><div><div class="k">Runway</div><div class="n bad">~1 day</div></div><div><div class="k">Cash</div><div class="n">' + cashText('$100') + '</div></div>' + moneyEye() + '</div>'
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
    el.querySelectorAll('[data-task-del]').forEach(function (btn) {
      btn.onclick = function (e) {
        e.stopPropagation();
        dropItem(btn.getAttribute('data-task-del'));
      };
    });
    bindMission(el);
  }

  function openOpsList(key, lists) {
    var modal = document.getElementById('modal');
    var card = document.getElementById('modalCard');
    if (!modal || !card) return;
    var rows = (lists && lists[key]) || [];
    card.classList.add('wide');
    card.innerHTML = '<div class="mhd"><div style="font-weight:700">' + esc(key.split(':').slice(1).join(':') || 'Items') + '</div><button class="x" id="mClose" type="button">x</button></div><div class="mbd">' + (rows.length ? rows.map(function (it) { return '<div class="ops-row"><button type="button" data-ops-item="' + esc(it.id) + '"><b>' + esc(it.title) + '</b><span class="kick">' + esc(areaLabel(it.area, it)) + '</span></button>' + bucketPicks(it) + (it._err ? '<div class="soft-err">' + esc(it._err) + '</div>' : '') + '<button type="button" class="ghost-x" data-ops-del="' + esc(it.id) + '" aria-label="Delete">x</button></div>'; }).join('') : '<div class="kick">Nothing in this group.</div>') + '</div>';
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
      btn.onclick = function (e) {
        e.stopPropagation();
        var id = btn.getAttribute('data-ops-del');
        lists[key] = (lists[key] || []).filter(function (it) { return it.id !== id; });
        dropItem(id, function () {
          var restored = (STATE.items || []).filter(function (it) { return it.id === id; })[0];
          if (restored) lists[key] = (lists[key] || []).concat([restored]);
          openOpsList(key, lists);
        });
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
    return '<svg viewBox="0 0 120 120" width="180" height="180">' + arcs + '<text x="60" y="66" text-anchor="middle" font-size="18" font-weight="650" fill="#18191f">' + (centre || 0) + '</text></svg>';
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
    it.due = dueFor(col);
    renderWar();
    if (typeof renderOpsDash === 'function') renderOpsDash();
    var due = it.due == null ? null : new Date(it.due).toISOString();
    function send() {
      return authFetch('/api/items', { method: 'PATCH', quiet: true, credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: id, due: due }) }).then(function (r) { if (!r.ok) throw 0; });
    }
    send().catch(function () { return send(); }).catch(function () {});
  }

  function dueFor(col) {
    if (col === 'today') return Date.now();
    if (col === 'week') return Date.now() + 3 * 86400000;
    return null;
  }

  function dropItem(id, after) {
    if (!id) return;
    var it = (STATE.items || []).filter(function (row) { return row.id === id; })[0];
    if (!it) return;
    STATE.items = (STATE.items || []).filter(function (row) { return row.id !== id; });
    renderWar();
    if (typeof renderOpsDash === 'function') renderOpsDash();
    if (after) after();
    if (String(id).indexOf('tmp-') === 0) return;
    authFetch('/api/items/' + id, { method: 'DELETE', quiet: true, credentials: 'same-origin' }).then(function (r) {
      if (!r.ok) throw 0;
    }).catch(function () {
      it._err = 'Not deleted yet';
      if (!(STATE.items || []).some(function (row) { return row.id === id; })) STATE.items = (STATE.items || []).concat([it]);
      renderWar();
      if (typeof renderOpsDash === 'function') renderOpsDash();
      if (after) after();
    });
  }

  function renderWar() {
    if (typeof window.paintRedesignWar === 'function' && document.getElementById('warDesk')) {
      window.paintRedesignWar();
      return;
    }
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
    var moves = ((STATE.ceo && STATE.ceo.moves) || []).filter(function (move) { return moveLabel(move); });
    var needleOn = {};
    try { needleOn = JSON.parse(localStorage.getItem('cr_needle') || '{}'); } catch (err) { needleOn = {}; }
    if (needleOn.day !== laDay(Date.now())) needleOn = { day: laDay(Date.now()), ids: {} };
    var one = moves[0];
    if (needleOn.one) {
      var held = moves.filter(function (move) { return String(move.id) === String(needleOn.one); })[0];
      if (held) one = held;
    }
    var doneN = 0;
    var slots = [0, 1, 2].map(function (i) {
      var move = moves[i];
      if (!move) return '<div class="nm empty">+ set needle mover ' + (i + 1) + '</div>';
      var id = String(move.id || i);
      var on = !!(needleOn.ids && needleOn.ids[id]);
      if (on) doneN += 1;
      var rank = i === 0 ? '#1 the one thing' : '#' + (i + 1);
      return '<div class="nm' + (on ? ' done' : '') + '"><span class="rank">' + rank + '</span><div class="tt">' + esc(moveLabel(move)) + '</div><span class="tag">' + esc(move.zone || move.area || 'Raise') + '</span><input class="ck" type="checkbox" data-needle="' + esc(id) + '"' + (on ? ' checked' : '') + '/></div>';
    }).join('');
    var left = STATE.focusUntil && STATE.focusUntil > Date.now() ? STATE.focusUntil - Date.now() : 25 * 60 * 1000;
    var mm = String(Math.floor(left / 60000)).padStart(2, '0');
    var ss = String(Math.floor((left % 60000) / 1000)).padStart(2, '0');
    var deg = STATE.focusUntil ? Math.max(0, Math.min(360, ((STATE.focusUntil - Date.now()) / (25 * 60 * 1000)) * 360)) : 0;
    var evening = new Date().getHours() >= 17;
    var days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    var needleLog = {};
    try { needleLog = JSON.parse(localStorage.getItem('cr_needle_log') || '{}'); } catch (err) { needleLog = {}; }
    if (doneN) needleLog[today] = doneN;
    try { localStorage.setItem('cr_needle_log', JSON.stringify(needleLog)); } catch (err) {}
    var week = '';
    for (var d = 4; d >= 0; d -= 1) {
      var when = new Date(); when.setDate(when.getDate() - d);
      var label = days[when.getDay()];
      var key = laDay(when.getTime());
      var hit = needleLog[key];
      var cls = d === 0 ? 'today' : (hit ? 'hit' : '');
      week += '<div class="day ' + cls + '"><div class="d">' + (hit ? hit : cls === 'today' ? '?' : '-') + '</div><div class="l">' + label + '</div></div>';
    }
    var busyMin = 0;
    (STATE.events || []).forEach(function (ev) {
      if (laDay(ev.start) !== today) return;
      busyMin += Number(ev.dur) || 30;
    });
    var openH = Math.max(0, Math.round((15 * 60 - busyMin) / 60));
    var budget = (STATE.events || []).length ? (openH + 'h still open today between 06:00 and 21:00 after what is already booked. Block the morning for the one thing.') : 'Open focus sits next to the calendar. Block the morning for the one thing.';
    var streak = 0;
    for (var sd = 0; sd < 60; sd += 1) {
      var sk = laDay(Date.now() - sd * 86400000);
      if (needleLog[sk]) streak += 1;
      else if (sd > 0) break;
    }
    var eodLines = moves.slice(0, 3).map(function (move, i) {
      var on = !!(needleOn.ids && needleOn.ids[String(move.id || i)]);
      return '<div class="line"><span class="ic ' + (on ? 'ok' : 'no') + '">' + (on ? '\u2713' : '\u2717') + '</span>' + esc(moveLabel(move)) + (on ? '' : ' - not done') + '</div>';
    }).join('');
    var actions = (STATE.meetingActions || []).filter(function (row) { return row.status !== 'done' && row.status !== 'tasked'; });
    var actionHtml = '<div class="meet-act"><div class="h">After your meetings - what you owe</div><div class="sub2">Scraped from Zoom notes after each call</div>' + (actions.length ? actions.slice(0, 5).map(function (row) {
      return '<div class="arow"><span class="kind ' + (row.kind === 'follow_up' ? 'fu' : 'you') + '">' + (row.kind === 'follow_up' ? 'Follow up' : 'You said') + '</span><div class="tx"><div class="nm">' + esc(row.text) + '</div><div class="meta">' + esc(row.meetingTitle || 'Meeting') + (row.meetingDate ? ' - ' + esc(row.meetingDate) : '') + '</div></div><div class="acts"><button type="button" class="btn sm" data-act-col="today" data-act-id="' + esc(row.id) + '">+ Today</button><button type="button" class="btn sm" data-act-col="week" data-act-id="' + esc(row.id) + '">+ Week</button></div></div>';
    }).join('') + (actions.length > 5 ? '<button type="button" class="lk" id="meetActAll">Review all ' + actions.length + ' meeting action items</button>' : '') : '<div class="quiet" style="padding:4px 0">No commitments scraped from Zoom notes yet.</div>') + '</div>';
    var ranked = moves.slice(0, 3);
    var rankHtml = '<div class="ceo-rank"><div class="rh"><span class="t">4orm Intelligence - CEO ranked moves</span><span class="badge">Rebuilt every morning 06:30</span><button type="button" class="btn sm" id="ceoRerun">Re-run</button></div>' + (ranked.length ? ranked.map(function (move, i) {
      var zone = String(move.zone || move.area || 'Raise');
      var zn = /regulat/i.test(zone) ? 'regulator' : /partner/i.test(zone) ? 'partners' : /cash|runway/i.test(zone) ? 'cash' : /product|dev/i.test(zone) ? 'product' : 'raise';
      var src = move.source || move.sourceLine || '';
      return '<div class="mv' + (i === 0 ? ' first' : '') + '"><span class="rk">' + (i + 1) + '</span><div><span class="zn ' + zn + '">' + esc(zone) + '</span>' + (i === 0 ? '<span class="one-tag">Your one move</span>' : '') + '<div class="tt">' + esc(moveLabel(move)) + '</div><div class="why">' + esc(move.whyNow || move.why || '') + '</div>' + (src ? '<div class="src">source: ' + esc(src) + '</div>' : '') + '</div><div class="acts"><button type="button" class="btn sm pri" data-ceo-do="' + esc(move.id) + '">Do</button><button type="button" class="btn sm" data-ceo-steps="' + esc(move.id) + '">Steps</button><button type="button" class="btn sm" data-ceo-plan="' + esc(move.id) + '">Plan</button></div><button type="button" class="ghost-x" data-ceo-later="' + esc(move.id) + '" aria-label="Dismiss">x</button></div>';
    }).join('') : '<div class="quiet">No ranked moves yet. Re-run builds today\'s list from live signals.</div>') + '</div>';
    var alarmOn = alarmPrefs().on;
    cmd.innerHTML = '<div class="command slim"><div class="cmdtop"><div class="vital"><span class="k">Cash</span><span class="v">' + cashText('$100') + '</span></div><div class="vital"><span class="k">Runway</span><span class="v red">~1 day</span></div><div class="vital"><span class="k">Raise - F&amp;F</span><span class="v">' + cashText('$80K / $250K') + '</span></div><div class="vital"><span class="k">To Oct 30</span><span class="v">' + daysToClose() + ' days</span></div><div class="vital" style="margin-left:auto;text-align:right"><span class="k">Focus streak</span><span class="v streak">' + (streak ? '\ud83d\udd25 ' + streak + ' day' + (streak === 1 ? '' : 's') : 'Start today') + '</span></div>' + moneyEye() + '</div></div>'
      + '<div class="lb-add capbar"><input id="opsAdd" type="text" placeholder="Capture a task - or type an idea to park it, so you don\'t lose focus" style="flex:1"/><button class="btn pri sm" id="opsAddBtn" type="button">Add</button></div>'
      + '<div class="war-split"><div class="focus-hero compact"><div class="l"><div class="lab">Today\'s one move</div><div class="big">' + esc(one ? moveLabel(one) : 'Pick the one thing') + '</div><div class="why">' + esc(one && (one.whyNow || one.why) ? 'Why: ' + (one.whyNow || one.why) : 'Tied to runway and the raise. Cash first.') + '</div><div class="cap" style="background:transparent;border:0;box-shadow:none;padding:0"><button class="btn pri sm" type="button" id="focusStart">\u25b6 Start 25-min focus</button><button class="btn sm" type="button" id="focusCommit">Commit this as my one thing</button><button class="btn sm" type="button" id="focusPlan">Plan</button><button class="btn sm" type="button" id="focusLater">Cancel this move</button></div>' + rankHtml + '</div><div class="r"><div class="timer" style="--deg:' + deg + 'deg"><div class="in"><div class="t" id="focusClock">' + mm + ':' + ss + '</div><div class="s">focus</div></div></div></div></div>' + actionHtml + '</div>'
      + '<div class="war-strip"><div class="coach"><b>Coaching note</b><p>Regulators can wait. Do not let them take a cash-first morning. Drop them or give them 10 minutes, then come back to the one thing.</p></div><div class="mcard" style="padding:12px"><b>Momentum</b><div class="week">' + week + '</div><div class="budget">' + esc(budget) + '</div></div><div class="card thin" id="nextUp"><div style="flex:1">' + (next.length ? next.map(function (ev) { return '<div data-count="' + ev.start + '">' + alarmMeetLine(ev) + '</div>'; }).join('') : '<div class="kick">No more events today.</div>') + '</div><div class="cap" style="background:transparent;border:0;box-shadow:none;padding:0"><button class="btn sm" id="findSlot" type="button">Find a 30-min slot</button><button class="btn sm" id="alarmMaster" type="button">' + (alarmOn ? 'Alarms on' : 'Alarms off') + '</button></div></div></div>';
    var reachHtml = '<div class="card rox"><div class="ch"><span class="t">Reach out</span><span class="sub2">people to contact - added from Pipeline or Contacts, check off when done</span></div><div class="chips">' + kinds.map(function (pair) { var n = people.filter(function (person) { return pair[0] === 'all' || person.kind === pair[0]; }).length; return '<button type="button" class="chip' + (filter === pair[0] ? ' on' : '') + '" data-reach-kind="' + pair[0] + '">' + pair[1] + ' <span class="n">' + n + '</span></button>'; }).join('') + '</div><div class="people">' + (shown.length ? shown.map(function (person) { var bits = String(person.name || '?').split(/\s+/).slice(0, 2).map(function (part) { return part.slice(0, 1); }).join('').toUpperCase(); var tagCls = { vc: 'vc', regulator: 'reg', design: 'partner', client: 'client', corporate: 'corp' }[person.kind] || 'corp'; return '<div class="person' + (person.done ? ' done' : '') + '"><div class="top"><span class="av">' + esc(bits) + '</span><div><div class="nm">' + esc(person.name) + '</div><div class="co">' + esc(person.company || '') + '</div></div></div><span class="tag ' + tagCls + '">' + esc(reachNames[person.kind] || 'Corporate') + '</span><div class="act"><label class="ckl"><input type="checkbox" data-reach-done="' + esc(person.id) + '"' + (person.done ? ' checked' : '') + ' aria-label="Done"/><span class="ck"></span></label><span class="what">' + esc(person.nextAction || 'Reach out') + '</span><button type="button" class="go" data-reach-task="' + esc(person.id) + '">+ task</button></div></div>'; }).join('') : '<div class="rox-empty">Add people from Pipeline or Contacts.</div>') + '</div></div><div class="rox-hint">From the Pipeline or Contacts, click a person and choose Add to Reach Out with a type. Checking a person off, or + task, creates an actionable task below.</div>';
    var cols = [
      ['today', 'Today'],
      ['week', 'This week'],
      ['later', 'Later']
    ];
    board.innerHTML = '<div class="execcard"><div class="sh">Execution <span class="s">everything else - drag, tag Today/Week/Later <button class="xfull" type="button" id="execFull">Expand full-screen</button></span></div><div class="exec">' + cols.map(function (col) {
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
    }).join('') + '</div></div>'
      + reachHtml
      + (evening && moves.length ? '<div class="eod"><div class="h">End of day review <span class="time">' + doneN + ' of ' + Math.min(3, moves.length) + ' done</span></div>' + eodLines + '<div class="foot">You moved <b>' + doneN + ' of ' + Math.min(3, moves.length) + '</b> needle-movers. Lock tomorrow\'s one thing now, keep the streak alive.</div></div>' : '');
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
    var full = document.getElementById('execFull');
    if (full) full.onclick = function () {
      document.body.classList.toggle('exec-full');
      full.textContent = document.body.classList.contains('exec-full') ? 'Close full-screen' : 'Expand full-screen';
    };
    var commit = document.getElementById('focusCommit');
    if (commit) commit.onclick = function () {
      var move = ((STATE.ceo && STATE.ceo.moves) || [])[0];
      if (!move || !moveLabel(move)) return;
      var map = {};
      try { map = JSON.parse(localStorage.getItem('cr_needle') || '{}'); } catch (err) { map = {}; }
      if (map.day !== laDay(Date.now())) map = { day: laDay(Date.now()), ids: {} };
      map.one = String(move.id || '');
      try { localStorage.setItem('cr_needle', JSON.stringify(map)); } catch (err) {}
      saveItem(moveLabel(move), 'today');
      commit.textContent = 'Committed for today';
      commit.disabled = true;
    };
    var focus = document.getElementById('focusStart');
    if (focus) focus.onclick = function () {
      STATE.focusUntil = Date.now() + 25 * 60 * 1000;
      if (STATE.focusTimer) clearInterval(STATE.focusTimer);
      STATE.focusTimer = setInterval(function () {
        var clock = document.getElementById('focusClock');
        if (!clock || !STATE.focusUntil) return;
        var left = STATE.focusUntil - Date.now();
        if (left <= 0) { clock.textContent = '00:00'; clearInterval(STATE.focusTimer); return; }
        var m = String(Math.floor(left / 60000)).padStart(2, '0');
        var s = String(Math.floor((left % 60000) / 1000)).padStart(2, '0');
        clock.textContent = m + ':' + s;
      }, 1000);
    };
    var plan = document.getElementById('focusPlan');
    if (plan) plan.onclick = function () {
      var move = ((STATE.ceo && STATE.ceo.moves) || [])[0];
      if (move && typeof openPlan === 'function') openPlan(move.id || 'one', moveLabel(move) || 'The one thing', 'investors');
    };
    var later = document.getElementById('focusLater');
    if (later) later.onclick = function () {
      var move = ((STATE.ceo && STATE.ceo.moves) || [])[0];
      var map = {};
      try { map = JSON.parse(localStorage.getItem('cr_needle') || '{}'); } catch (err) { map = {}; }
      if (map.one) {
        var held = ((STATE.ceo && STATE.ceo.moves) || []).filter(function (row) { return String(row.id) === String(map.one); })[0];
        if (held) move = held;
      }
      if (!move || !move.id) return;
      dismissMove(move.id);
    };
    document.querySelectorAll('[data-money-eye]').forEach(function (btn) {
      btn.onclick = function (e) {
        e.stopPropagation();
        setShowMoney(!showMoney());
      };
    });
    document.querySelectorAll('[data-needle]').forEach(function (box) {
      box.onclick = function (e) {
        e.stopPropagation();
        var map = {};
        try { map = JSON.parse(localStorage.getItem('cr_needle') || '{}'); } catch (err) { map = {}; }
        if (map.day !== laDay(Date.now())) map = { day: laDay(Date.now()), ids: {} };
        map.ids = map.ids || {};
        map.ids[box.getAttribute('data-needle')] = box.checked;
        try { localStorage.setItem('cr_needle', JSON.stringify(map)); } catch (err) {}
        renderWar();
      };
    });
    document.querySelectorAll('.exec-card').forEach(function (card) {
      card.ondragstart = function (e) { e.dataTransfer.setData('text', card.getAttribute('data-item')); };
    });
    document.querySelectorAll('.exec-col').forEach(function (col) {
      col.ondragover = function (e) { e.preventDefault(); };
      col.ondrop = function (e) {
        e.preventDefault();
        setBucket(e.dataTransfer.getData('text'), col.getAttribute('data-col'));
      };
    });
    document.querySelectorAll('[data-done]').forEach(function (box) {
      box.onclick = function (e) {
        e.stopPropagation();
        var id = box.getAttribute('data-done');
        var it = (STATE.items || []).filter(function (row) { return row.id === id; })[0];
        if (it) it.status = 'done';
        renderWar();
        if (typeof renderOpsDash === 'function') renderOpsDash();
        function send() {
          return authFetch('/api/items/' + id, { method: 'PATCH', quiet: true, credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'done' }) }).then(function (r) { if (!r.ok) throw 0; });
        }
        send().catch(function () { return send(); }).catch(function () {});
      };
    });
    document.querySelectorAll('#execBoard [data-del]').forEach(function (btn) {
      btn.onclick = function (e) {
        e.stopPropagation();
        dropItem(btn.getAttribute('data-del'));
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
    document.querySelectorAll('[data-act-id]').forEach(function (btn) {
      btn.onclick = function () {
        var id = btn.getAttribute('data-act-id');
        var col = btn.getAttribute('data-act-col') || 'today';
        var row = (STATE.meetingActions || []).filter(function (item) { return String(item.id) === String(id); })[0];
        if (!row) return;
        saveItem(row.text, col);
        row.status = 'tasked';
        renderWar();
        authFetch('/api/meeting-actions', { method: 'POST', quiet: true, credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: id, status: 'tasked' }) }).then(function (r) { return r.json(); }).then(function (data) {
          if (data && data.actions) STATE.meetingActions = data.actions;
        }).catch(function () {});
      };
    });
    var meetAll = document.getElementById('meetActAll');
    if (meetAll) meetAll.onclick = function () {
      var card = document.getElementById('modalCard');
      var modal = document.getElementById('modal');
      if (!card || !modal) return;
      var rows = STATE.meetingActions || [];
      card.innerHTML = '<div class="mhd"><div style="font-weight:700">Meeting action items</div><button class="x" id="mClose" type="button">x</button></div><div class="mbd">' + (rows.length ? rows.map(function (row) {
        return '<div class="arow" style="display:flex;gap:8px;padding:8px 0;border-top:1px solid #eef1f6"><span class="kind ' + (row.kind === 'follow_up' ? 'fu' : 'you') + '">' + (row.kind === 'follow_up' ? 'Follow up' : 'You said') + '</span><div style="flex:1"><b>' + esc(row.text) + '</b><div class="kick">' + esc(row.meetingTitle || '') + '</div></div><button type="button" class="btn sm" data-act-col="today" data-act-id="' + esc(row.id) + '">+ Today</button></div>';
      }).join('') : '<div class="quiet">None yet.</div>') + '</div>';
      modal.classList.add('open');
      modal.hidden = false;
      document.getElementById('mClose').onclick = function () { if (typeof closeModal === 'function') closeModal(); };
      card.querySelectorAll('[data-act-id]').forEach(function (btn) {
        btn.onclick = function () {
          var id = btn.getAttribute('data-act-id');
          var row = (STATE.meetingActions || []).filter(function (item) { return String(item.id) === String(id); })[0];
          if (row) { saveItem(row.text, 'today'); row.status = 'tasked'; }
          if (typeof closeModal === 'function') closeModal();
          authFetch('/api/meeting-actions', { method: 'POST', quiet: true, credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: id, status: 'tasked' }) }).catch(function () {});
        };
      });
    };
    var rerun = document.getElementById('ceoRerun');
    if (rerun) rerun.onclick = function () {
      rerun.disabled = true;
      rerun.textContent = 'Rebuilding...';
      authFetch('/api/ceo/daily', { method: 'POST', quiet: true, credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: '{}' }).then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (data) {
        if (typeof applyCeo === 'function') applyCeo(data);
        renderWar();
      }).catch(function () { rerun.disabled = false; rerun.textContent = 'Re-run'; }).then(function () { rerun.disabled = false; rerun.textContent = 'Re-run'; });
    };
    document.querySelectorAll('[data-ceo-do]').forEach(function (btn) {
      btn.onclick = function () { if (typeof ceoDo === 'function') ceoDo(btn.getAttribute('data-ceo-do')); };
    });
    document.querySelectorAll('[data-ceo-later]').forEach(function (btn) {
      btn.onclick = function () { dismissMove(btn.getAttribute('data-ceo-later')); };
    });
    document.querySelectorAll('[data-ceo-plan],[data-ceo-steps]').forEach(function (btn) {
      btn.onclick = function () {
        var id = btn.getAttribute('data-ceo-plan') || btn.getAttribute('data-ceo-steps');
        var move = ((STATE.ceo && STATE.ceo.moves) || []).filter(function (row) { return String(row.id) === String(id); })[0];
        if (move && typeof openPlan === 'function') openPlan(move.id || 'one', moveLabel(move) || 'The one thing', 'investors');
      };
    });
    var master = document.getElementById('alarmMaster');
    if (master) master.onclick = function () {
      var prefs = alarmPrefs();
      prefs.on = !prefs.on;
      saveAlarmPrefs(prefs);
      renderWar();
    };
  }

  window.saveItem = saveItem;
  function saveItem(title, col, category) {
    title = String(title || '').trim() || 'Untitled task';
    var temp = { id: 'tmp-' + Date.now(), title: title, area: 'other', status: 'new', priority: 'normal', due: dueFor(col), notes: '', category: category || '' };
    STATE.items = (STATE.items || []).concat([temp]);
    renderWar();
    authFetch('/api/items', { method: 'POST', quiet: true, credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: title, area: 'other', due: dueFor(col), category: category || '' }) }).then(function (r) { if (!r.ok) throw 0; return authFetch('/api/board', { credentials: 'same-origin' }); }).then(function (r) { return r.json(); }).then(applyBoard).catch(function () { temp._err = 'Not saved yet'; renderWar(); });
  }

  function loadReach() {
    function go() {
      authFetch('/api/reach-out', { credentials: 'include', quiet: true }).then(function (r) { return r.json(); }).then(function (d) {
        var rows = [];
        if (Array.isArray(d)) rows = d;
        else if (d && Array.isArray(d.people)) rows = d.people;
        else if (d && Array.isArray(d.items)) rows = d.items;
        else if (d && Array.isArray(d.contacts)) rows = d.contacts;
        else if (d && Array.isArray(d.reach)) rows = d.reach;
        STATE.reachOut = rows;
        console.info('[live-map] /api/reach-out', { count: rows.length, keys: rows[0] ? Object.keys(rows[0]) : [] });
        if (STATE.desk === 'war') renderWar();
        if (STATE.desk === 'room') renderOpsDash();
      }).catch(function () { STATE.reachOut = STATE.reachOut || []; });
    }
    if (window.__clerk && window.__clerk.session) go();
    else if (window.__clerkBoot) Promise.resolve(window.__clerkBoot).then(go).catch(go);
    else go();
  }
  function loadStickies() {
    authFetch('/api/notes/sticky', { credentials: 'include', quiet: true }).then(function (r) { return r.json(); }).then(function (d) {
      STATE.stickies = (d && d.notes) || STATE.stickies || [];
      console.info('[live-map] /api/notes/sticky', { count: STATE.stickies.length, keys: STATE.stickies[0] ? Object.keys(STATE.stickies[0]) : [] });
      if (STATE.desk === 'notes' && typeof renderNotes === 'function') renderNotes();
    }).catch(function () { STATE.stickies = STATE.stickies || []; });
  }
  function loadNotes() {
    authFetch('/api/notes', { credentials: 'include', quiet: true }).then(function (r) { return r.json(); }).then(function (d) {
      var rows = (d && d.notes) || [];
      console.info('[live-map] /api/notes', { count: rows.length, keys: rows[0] ? Object.keys(rows[0]) : [] });
      STATE.notes = rows;
      if (STATE.desk === 'notes' && typeof renderNotes === 'function') renderNotes();
    }).catch(function () {});
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

  function slotHead(day) {
    var bits = String(day || '').split('-');
    if (bits.length < 3) return day || 'Today';
    var when = new Date(Date.UTC(Number(bits[0]), Number(bits[1]) - 1, Number(bits[2])));
    if (Number.isNaN(when.getTime())) return day;
    var wk = when.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
    return wk + ' ' + Number(bits[2]);
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
        return '<div class="slot-day"><div class="day">' + esc(slotHead(day)) + '</div>' + rows.map(function (slot) {
          var time = String(slot.label || '').split(' ').pop();
          return '<button class="slot" type="button" data-start="' + slot.start + '"' + (slot.free ? '' : ' disabled') + '>' + esc(time) + (slot.free ? '' : ' busy') + '</button>';
        }).join('') + '</div>';
      }).join('') + '</div>';
      list.querySelectorAll('.slot').forEach(function (btn) {
        btn.onclick = function () {
          btn.disabled = true;
          authFetch('/api/calendar/slots', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ start: Number(btn.getAttribute('data-start')) }) }).then(function (r) { return r.json().then(function (d) {
            if (!r.ok) throw d;
            btn.textContent = btn.textContent + ' - booked';
            var start = Number(d && d.start) || Number(btn.getAttribute('data-start'));
            if (Number.isFinite(start)) {
              STATE.events = (STATE.events || []).concat([{ id: String((d && d.id) || ('slot-' + start)), start: start, dur: 30, title: 'Focus block', join: '' }]);
              if (STATE.desk === 'war') renderWar();
              if (STATE.desk === 'room' || !STATE.desk) renderOpsDash();
            }
          }); }).catch(function () { btn.disabled = false; });
        };
      });
    }).catch(function () {
      var list = document.getElementById('slotList');
      if (list) list.textContent = 'Calendar could not be read.';
    });
  }

  /* NEWS:BEGIN - scripts/check-icons.mjs scans this region: no svg markup, no emoji, no icon glyphs. */
    var NEWS_CHIPS = ['Compliance', 'AI & governance', 'Mortgage / brokerage', 'Automation / regtech', 'Fraud', 'Payments / FINTRAC', 'Competitors', 'Housing market'];
  var NEWS_OLD = { 'AI': 'AI & governance', 'Counseling': 'Compliance', 'Fintech & regulation': 'Compliance', 'Mortgage': 'Mortgage/brokerage', 'Fraud & scams': 'Fraud', 'Grants': 'Compliance', 'Payments / FINTRAC': 'Payments/FINTRAC', 'Competitors (Drata/Vanta/Aveni)': 'Competitors', 'Design-partner targets (Century 21/Remax)': 'Mortgage/brokerage', 'Fundraising / VC': 'Compliance' };
  var NEWS_RIVALS = ['Vanta', 'Drata', 'Secureframe', 'Aveni', 'Thoropass', 'ComplyAdvantage'];
  var NEWS_TOPICS = ['RPAA', 'safeguarding', 'suitability', 'AML', 'AI governance', 'mortgage compliance', 'non-dilutive', 'fraud'];
  var NEWS_PRIMARY = /(^|\.)(canada\.ca|gc\.ca|bankofcanada\.ca|fintrac-canafe\.canada\.ca|osfi-bsif\.gc\.ca|fsrao\.ca|bcfsa\.ca|lautorite\.qc\.ca|osc\.ca|bcsc\.bc\.ca|asc\.ca|securities-administrators\.ca|fca\.org\.uk|competition-bureau\.canada\.ca)$/;

  function newsTs(item) {
    var raw = item && (item.publishedAt != null ? item.publishedAt : item.published_at);
    if (typeof raw === 'number') return raw;
    var n = Number(raw);
    if (raw && !isNaN(n) && n > 1e11) return n;
    return Date.parse(raw || 0) || 0;
  }

  function newsCat(item) {
    var c = String(item.category || '');
    return NEWS_CHIPS.indexOf(c) >= 0 ? c : (NEWS_OLD[c] || 'Compliance');
  }

  function newsImpact(item) {
    var v = String(item.impact || '');
    if (v === 'Opportunity' || v === 'Threat' || v === 'Regulatory') return v;
    var blob = (newsCat(item) + ' ' + (item.title || '') + ' ' + (item.summary || '')).toLowerCase();
    if (/competitor|vanta|drata|aveni|secureframe|thoropass|complyadvantage/.test(blob)) return 'Threat';
    if (/regulat|fintrac|osfi|fcac|rpaa|guidance|consult|enforce|penalt|fraud/.test(blob)) return 'Regulatory';
    return 'Opportunity';
  }

  function newsHost(url) { try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return ''; } }
  function newsSource(item) { return String(item.source || '') || newsHost(item.url || '') || 'News'; }
  function newsKeep(item) {
    var title = String((item && item.title) || '');
    var url = String((item && item.url) || '');
    var sum = String((item && item.summary) || '');
    var blob = (title + ' ' + sum + ' ' + url).toLowerCase();
    if (/^episode\s+\d+/i.test(title) || /\bpodcast\b/i.test(title) || /\bhow to hit a home run\b/i.test(title)) return false;
    if (/\b(webinar|stay in the loop|becoming a |forms\b|trust account declaration|pension services portal)\b/i.test(title)) return false;
    if (/\bphilippines\b|\bphilippine\b|fsb global|global principles/.test(blob)) return false;
    if (/bloomberg/.test(blob) && /\bcrypto\b/.test(blob)) return false;
    if (/\b(wells fargo|merrill|nasdaq sell|huntington bank|euronet|epc eu|uae)\b/.test(blob) && !/\bcanada|canadian|ontario|bcfsa|fintrac|osfi\b/.test(blob)) return false;
    if (/(finextra\.com|medium\.com|complyadvantage\.com)/.test(url) && !/\bcanada|canadian\b/.test(blob)) return false;
    /* Canada only: the story must name Canada / a province / city / Canadian regulator, or come from a Canadian official site. */
    if (!NEWS_CANADA.test(title + ' ' + sum) && !NEWS_CA_OFFICIAL.test(newsHost(url))) return false;
    return true;
  }
  var NEWS_CANADA = /\b(canada|canadian|ontario|quebec|qu\u00e9bec|b\.c\.|british columbia|alberta|manitoba|saskatchewan|nova scotia|new brunswick|newfoundland|prince edward island|toronto|vancouver|calgary|edmonton|winnipeg|halifax|montreal|ottawa|fintrac|osfi|fcac|fsra|bcfsa|ciro|crea|cmhc|iiroc|bcsc|rpaa|retail payment activities act)\b/i;
  var NEWS_CA_OFFICIAL = /(^|\.)(canada\.ca|gc\.ca|bankofcanada\.ca|fsrao\.ca|bcfsa\.ca|lautorite\.qc\.ca|osc\.ca|bcsc\.bc\.ca|asc\.ca|securities-administrators\.ca|ciro\.ca|crea\.ca)$/i;
  function newsWhy(item) {
    var stored = String(item.whyItMatters || item.why_it_matters || '').replace(/^why it matters to 4orm:\s*/i, '').trim();
    var title = String(item.title || '').replace(/\s+/g, ' ').trim();
    var hook = (title.split(/[.!?:]/)[0] || title).replace(/\.$/, '').slice(0, 140);
    var cat = newsCat(item);
    var blob = (title + ' ' + (item.summary || '')).toLowerCase();
    var act = 'Log the rule and put a line in the investor update tying it to the 4orm session record.';
    if (cat === 'Housing market') act = 'Put this in the broker brief and the investor newsletter as a Canada-market proof point.';
    else if (cat === 'Payments/FINTRAC') act = 'Put this in the "why now" slide and the investor newsletter.';
    else if (cat === 'Fraud') act = 'Send it to Century 21 / Remax desks as a fraud-flag opener.';
    else if (cat === 'AI & governance') act = 'Cite it when a VC asks how 4orm keeps a human in the loop.';
    else if (cat === 'Competitors') act = 'Watch how they document advice, and name the gap 4orm closes.';
    else if (cat === 'Mortgage/brokerage') act = 'Name it on the next Century 21 / Remax design-partner call.';
    if (/\b(fine|penalt|credit union)\b/.test(blob)) act = 'Put this in the "why now" slide and the investor newsletter.';
    else if (/\b(fraud|equifax|forged)\b/.test(blob)) act = 'Send it to Century 21 / Remax desks as a fraud-flag opener.';
    var out = hook ? (hook + '. ' + act) : act;
    if (stored && stored.toLowerCase().indexOf(hook.toLowerCase().slice(0, 24)) === 0) return stored;
    return out;
  }
  function newsSummary(item) { var s = String(item.summary || ''); return /^why it matters to 4orm:/i.test(s) ? '' : s; }

  function newsWhen(item) {
    var ts = newsTs(item);
    if (!ts) return '';
    var start = new Date();
    start.setHours(0, 0, 0, 0);
    if (ts >= start.getTime()) return 'today';
    var d = Math.floor((start.getTime() - ts) / 86400000) + 1;
    return d === 1 ? 'yesterday' : d + 'd ago';
  }

  function newsCover(item, hero) {
    var cat = newsCat(item);
    var img = String(item.image || item.image_url || '');
    var ok = /^\/api\/news\/(?:image|thumb)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(img) || /^\/?(design\/)?news-images\//.test(img) || /^\/news-images\//.test(img);
    var failed = !!item._noimg;
    var kick = '<span class="cat">' + esc(cat) + '</span>';
    if (!ok && failed) {
      return '<div class="img noimg"><div class="tile"><span class="sn">' + esc(newsSource(item)) + '</span></div><span class="shade"></span>' + kick + '</div>';
    }
    return '<div class="img' + (ok ? '' : ' shimmer') + '">' + (ok ? '<img class="ph" src="' + esc(img) + '" alt="" loading="' + (hero ? 'eager' : 'lazy') + '" decoding="async"/>' : '') + '<span class="shade"></span>' + kick + '</div>';
  }

  function newsOpen(item) {
    if (!item || !item.url) return;
    if (typeof openLink === 'function') openLink(item.title || 'Story', item.url);
    var btn = document.getElementById('docViewDrive');
    if (btn) {
      btn.hidden = false;
      btn.setAttribute('data-href', item.url);
      btn.textContent = 'Open on ' + (newsHost(item.url) || 'source');
    }
  }

  function newsToSpace(item) {
    if (!item) return;
    var spaces = (STATE.packages || []).filter(function (p) { return p && p.id; });
    var modal = document.getElementById('modal');
    var box = document.getElementById('modalCard');
    if (!spaces.length || !modal || !box) {
      saveItem('News for a space: ' + (item.title || 'Story'), 'week');
      if (typeof deskNote === 'function') deskNote('No spaces yet - saved as a This week task.');
      return;
    }
    var q = '';
    function paint() {
      var rows = spaces.filter(function (p) { return !q || String(p.name || p.title || '').toLowerCase().indexOf(q.toLowerCase()) >= 0; });
      box.classList.add('wide');
      box.innerHTML = '<div class="mhd"><div style="font-weight:700">Save to a Space</div><button class="x" id="mClose" type="button" aria-label="Close">\u00d7</button></div><div class="mbd"><div class="kick" style="margin-bottom:6px">' + esc(item.title || '') + '</div><input id="nwSpaceFind" type="text" placeholder="Search spaces" value="' + esc(q) + '" style="width:100%;margin:0 0 8px"/>' + (rows.map(function (p) { return '<button type="button" class="ops-row" data-nw-space="' + esc(p.id) + '"><b>' + esc(p.name || p.title || 'Space') + '</b><span class="kick">' + esc(p.stage || p.status || '') + '</span></button>'; }).join('') || '<div class="kick">No space matches.</div>') + '</div>';
      modal.classList.add('open');
      modal.hidden = false;
      document.getElementById('mClose').onclick = function () { if (typeof closeModal === 'function') closeModal(); };
      var find = document.getElementById('nwSpaceFind');
      if (find) find.oninput = function () { q = find.value; paint(); var again = document.getElementById('nwSpaceFind'); if (again) { again.focus(); try { again.setSelectionRange(q.length, q.length); } catch (e) {} } };
      box.querySelectorAll('[data-nw-space]').forEach(function (btn) {
        btn.onclick = function () {
          var id = btn.getAttribute('data-nw-space');
          var sp = spaces.filter(function (p) { return p.id === id; })[0] || {};
          if (typeof closeModal === 'function') closeModal();
          authFetch('/api/spaces/' + encodeURIComponent(id) + '/items', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'link', name: item.title || 'Story', url: item.url || '', body: newsWhy(item) }) }).then(function (r) { return r.json(); }).then(function (d) {
            if (typeof deskNote === 'function') deskNote(d && d.saved === false ? 'Not saved to ' + (sp.name || 'the space') + ' - try again.' : 'Saved to ' + (sp.name || 'the space') + '.');
          }).catch(function () { if (typeof deskNote === 'function') deskNote('Not saved yet - try again.'); });
        };
      });
    }
    paint();
  }

  function renderNews(items) {
    var el = (window.portEl && window.portEl('v-news', 'newsDesk')) || document.getElementById('newsDesk');
    if (!el || renderNews._on) return;
    renderNews._on = true;
    try {
    var loading = !STATE.newsLoaded && !(items && items.length);
    var hidden = STATE.newsHidden || {};
    var all = (items || []).filter(newsKeep).filter(function (item) { return !hidden[String(item.id || item.url || '')]; }).slice().sort(function (a, b) { return (b.isTop ? 1 : 0) - (a.isTop ? 1 : 0) || newsTs(b) - newsTs(a); });
    var on = STATE.newsCat && (STATE.newsCat === 'All' || NEWS_CHIPS.indexOf(STATE.newsCat) >= 0) ? STATE.newsCat : 'All';
    var q = String(STATE.newsQ || '').trim().toLowerCase();
    var span = STATE.newsSpan === 'today' ? 'today' : STATE.newsSpan === 'week' ? 'week' : 'month';
    var start = new Date();
    start.setHours(0, 0, 0, 0);
    var floor = span === 'today' ? start.getTime() : span === 'week' ? Date.now() - 7 * 86400000 : Date.now() - 31 * 86400000;
    var miss = '';
    var inSpan = all.filter(function (item) { return newsTs(item) >= floor; });
    if (!inSpan.length && all.length) {
      miss = span === 'today' ? 'Nothing new today yet - showing the last week.' : 'Nothing in this window - showing the latest sweep.';
      inSpan = all.filter(function (item) { return newsTs(item) >= Date.now() - 7 * 86400000; });
      if (!inSpan.length) inSpan = all.slice();
    }
    var rows = inSpan.filter(function (item) { return on === 'All' || newsCat(item) === on; }).filter(function (item) {
      return !q || ((item.title || '') + ' ' + (item.summary || '') + ' ' + newsWhy(item) + ' ' + newsSource(item)).toLowerCase().indexOf(q) >= 0;
    });
    if (!rows.length && inSpan.length) {
      miss = q ? 'No stories match "' + esc(STATE.newsQ) + '" - showing everything in this window.' : 'Nothing in ' + esc(on) + ' yet - showing everything in this window.';
      rows = inSpan.slice();
    }
    STATE.newsView = rows;
    var top = rows.filter(function (item) { return item.isTop || item.is_top; })[0] || rows[0];
    var rest = rows.filter(function (item) { return item !== top; });
    var idx = function (item) { return rows.indexOf(item); };
    function story(item) {
      var sum = newsSummary(item);
      var why = newsWhy(item);
      return '<div class="card story" data-action="news-open" data-nw-i="' + idx(item) + '" role="button" tabindex="0">' + newsCover(item, false) + '<div class="b"><h3 class="hdline">' + esc(item.title || '') + '</h3>' + (sum ? '<div class="tk">' + esc(sum) + '</div>' : '') + (why ? '<div class="why"><b>Why it matters:</b> ' + esc(why) + '</div>' : '') + '<div class="foot"><span class="src">' + esc(newsSource(item)) + (newsWhen(item) ? ' · ' + newsWhen(item) : '') + '</span><button type="button" class="save" data-action="news-save" data-nw-save="' + idx(item) + '">Save</button><button type="button" class="rmv" data-action="news-hide" data-nw-i="' + idx(item) + '">Remove</button></div></div></div>';
    }
    var hero = '';
    if (top) {
      var i = idx(top);
      var host = newsHost(top.url || '');
      var srcLine = [esc(newsSource(top)), top.publishedAt ? new Date(newsTs(top)).toLocaleDateString('en-CA') : '', NEWS_PRIMARY.test(host) ? 'credibility: primary source' : 'credibility: reported'].filter(Boolean).join(' &middot; ');
      var sum = newsSummary(top);
      hero = '<div class="card hero"><button type="button" class="hrm" data-action="news-hide" data-nw-i="' + i + '">Remove</button><div data-action="news-open" data-nw-i="' + i + '" class="hero-open" role="button" tabindex="0">' + newsCover(top, true) + '</div><div class="b"><div class="ntop">Top release today</div><h2>' + esc(top.title || '') + '</h2>' + (sum ? '<div class="sum">' + esc(sum) + '</div>' : '') + '<div class="take"><b>Why it matters to 4orm:</b> ' + esc(newsWhy(top)) + '</div><div class="src">' + srcLine + '</div><div class="acts"><button type="button" class="a pri" data-action="news-act" data-nw-act="post" data-nw-at="' + i + '">Draft a LinkedIn post</button><button type="button" class="a" data-action="news-act" data-nw-act="letter" data-nw-at="' + i + '">Add to investor newsletter</button><button type="button" class="a" data-action="news-act" data-nw-act="vc" data-nw-at="' + i + '">Cite to a VC</button><button type="button" class="a" data-action="news-save" data-nw-save="' + i + '">Save to&hellip;</button><button type="button" class="a" data-action="news-act" data-nw-act="open" data-nw-at="' + i + '">Open source</button></div></div></div>';
    }
    var briefRows = (top ? [top] : []).concat(rest).slice(0, 4);
    var brief = briefRows.map(function (item, n) { return '<button type="button" class="r" data-action="news-open" data-nw-i="' + idx(item) + '"><span class="n">' + (n + 1) + '</span><span>' + esc(String(item.title || '').slice(0, 110)) + '</span></button>'; }).join('') || '<div class="r">The 8am sweep fills the briefing.</div>';
    var comps = NEWS_RIVALS.map(function (name) {
      var re = new RegExp('\\b' + name + '\\b', 'i');
      var hit = all.filter(function (item) { return re.test((item.title || '') + ' ' + (item.summary || '')); })[0];
      var age = hit ? Math.max(0, Math.floor((Date.now() - newsTs(hit)) / 86400000)) : null;
      var color = age == null ? '#c6cfdd' : age <= 2 ? '#f23a4d' : age <= 7 ? '#f0a020' : '#c6cfdd';
      var line = hit ? String(hit.title || '').slice(0, 54) : 'quiet';
      return { age: age == null ? 999 : age, html: '<' + (hit ? 'button type="button" data-action="news-url" data-nw-url="' + esc(hit.url || '') + '" data-nw-title="' + esc(hit.title || '') + '"' : 'div') + ' class="comprow"><span class="d" style="background:' + color + '"></span><span class="cl">' + (hit && line.toLowerCase().indexOf(name.toLowerCase()) === 0 ? esc(line) : '<b>' + esc(name) + '</b> - ' + esc(line)) + '</span><span class="mt">' + (age == null ? '-' : age === 0 ? 'today' : age + 'd') + '</span></' + (hit ? 'button' : 'div') + '>' };
    }).sort(function (x, y) { return x.age - y.age; }).map(function (c) { return c.html; }).join('');
    var trend = NEWS_TOPICS.map(function (topic) {
      var n = all.filter(function (item) { return ((item.title || '') + ' ' + (item.summary || '')).toLowerCase().indexOf(topic.toLowerCase()) >= 0; }).length;
      return { topic: topic, n: n };
    }).sort(function (x, y) { return y.n - x.n; }).map(function (row) {
      return '<button type="button" class="tp' + (q === row.topic.toLowerCase() ? ' on' : '') + '" data-action="news-topic" data-nw-topic="' + esc(row.topic) + '">' + esc(row.topic) + (row.n >= 2 ? ' <b>' + row.n + '</b>' : '') + '</button>';
    }).join('');
    var rank = { Threat: 0, Regulatory: 1, Opportunity: 2 };
    var label = { Threat: ['threat', 'Act now'], Regulatory: ['reg', 'This week'], Opportunity: ['opp', 'Use it'] };
    var pri = rows.slice(0, 16).sort(function (a, b) { return rank[newsImpact(a)] - rank[newsImpact(b)] || newsTs(b) - newsTs(a); }).slice(0, 4).map(function (item) {
      var l = label[newsImpact(item)];
      return '<button type="button" class="pr" data-action="news-open" data-nw-i="' + idx(item) + '"><span class="pl ' + l[0] + '">' + l[1] + '</span><span class="pt"><b>' + esc(String(item.title || '').slice(0, 80)) + '</b><span>' + esc(newsWhy(item)) + '</span></span></button>';
    }).join('') || '<div class="pr-empty">Priorities appear after the sweep.</div>';
    var chips = ['All'].concat(NEWS_CHIPS).map(function (c) {
      return '<button type="button" class="chip' + (c === on ? ' on' : '') + '" data-action="news-cat" data-nw-cat="' + esc(c) + '">' + esc(c) + '</button>';
    }).join('');
    var swept = STATE.newsSweptAt ? new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Vancouver', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(STATE.newsSweptAt)) : '';
    var NS = window.__newsSaved;
    var savedMode = STATE.newsMode === 'saved' && NS && typeof NS.html === 'function';
    var fxNews = !!(window.fixtureMockup || (typeof fixtureOn === 'function' && fixtureOn()));
    var modeSeg = (!fxNews && NS) ? '<div class="seg" id="newsMode"><button type="button" data-action="news-mode" data-mode="feed"' + (savedMode ? '' : ' class="on"') + '>Feed</button><button type="button" data-action="news-mode" data-mode="saved"' + (savedMode ? ' class="on"' : '') + '>Saved &middot; ' + esc(String(NS.count ? NS.count() : 0)) + '</button></div>' : '';
    var body = loading ? '<div class="card nw-empty">Loading the sweep...</div>' : (rows.length ? hero + '<div class="grid">' + rest.map(story).join('') + '</div>' : '<div class="card nw-empty">No stories yet - press Refresh to run the sweep.</div>');
    if (savedMode) {
      el.innerHTML = '<div class="nwx"><div class="top"><span class="t">News</span>' + modeSeg + '<div class="right"><input class="search" id="newsSearch" type="text" data-action="news-search" placeholder="Search saved stories and your notes..." value="' + esc(STATE.newsQ || '') + '"/></div></div>' + NS.html(all, q) + '</div>';
      if (el.setAttribute) el.setAttribute('data-port-ready', '1');
      return;
    }
    var pulseHtml = (typeof window.newsPulseBandHtml === 'function') ? window.newsPulseBandHtml(!!(window.fixtureMockup || (typeof fixtureOn === 'function' && fixtureOn()))) : '';
    el.innerHTML = '<div class="nwx"><div class="top"><span class="t">News</span>' + modeSeg + '<div class="seg" id="newsSpan"><button type="button" data-action="news-span" data-span="today"' + (span === 'today' ? ' class="on"' : '') + '>Today</button><button type="button" data-action="news-span" data-span="week"' + (span === 'week' ? ' class="on"' : '') + '>Last week</button><button type="button" data-action="news-span" data-span="month"' + (span === 'month' ? ' class="on"' : '') + '>Last month</button></div><button class="btn" id="newsRefresh" type="button" data-action="news-refresh"' + (STATE.newsBusy ? ' disabled' : '') + '>' + (STATE.newsBusy ? 'Sweeping...' : 'Refresh') + '</button><div class="right"><input class="search" id="newsSearch" type="text" data-action="news-search" placeholder="Search news..." value="' + esc(STATE.newsQ || '') + '"/><span class="sweeps">Sweeps at 06:00, 12:00 and 18:00' + (swept ? ' &middot; last ' + esc(swept) : '') + '</span></div></div><div class="chips">' + chips + '</div>' + pulseHtml + '<div class="wrap"><div class="main">' + (miss ? '<div class="nw-miss">' + miss + '</div>' : '') + body + '</div><div class="rail"><div class="card"><div class="ch"><span class="mk">4</span><span class="t">Your briefing</span><span class="s">' + briefRows.length + ' things ' + (span === 'today' ? 'today' : 'this ' + span) + '</span></div><div class="brief">' + brief + '</div></div><div class="card"><div class="ch"><span class="t">Competitor watch</span><span class="s">' + NEWS_RIVALS.length + ' tracked</span></div><div class="comp">' + comps + '</div></div><div class="card"><div class="ch"><span class="t">Trending for 4orm</span></div><div class="trend">' + trend + '</div></div><div class="card"><div class="ch"><span class="t">What this means - priority</span></div><div class="prio">' + pri + '</div></div></div></div></div>';
    if (typeof window.bindNewsPulse === 'function') {
      var fxNews = !!(window.fixtureMockup || (typeof fixtureOn === 'function' && fixtureOn()));
      var pulseHas = function (p) {
        return !!(p && ((p.gauges && p.gauges.length) || (p.consumer && p.consumer.length)));
      };
      var pulseData = fxNews
        ? window.__NEWS_PULSE_FIXTURE
        : (pulseHas(STATE.newsPulse) ? STATE.newsPulse : window.__NEWS_PULSE_FIXTURE);
      window.bindNewsPulse(el, pulseData);
      var nextAt = STATE.newsPulse && Date.parse(STATE.newsPulse.nextAt || '') || 0;
      var staleBuild = !fxNews && !!(STATE.newsPulse && (STATE.newsPulse.gauges || STATE.newsPulse.consumer || []).some(function (g) {
        return g && g.building && (g.buildingN == null || g.buildingN >= 4);
      }));
      var due = !fxNews && !STATE.newsPulseBusy && (!pulseHas(STATE.newsPulse) || staleBuild || (nextAt && Date.now() >= nextAt));
      if (due) {
        STATE.newsPulseBusy = true;
        var pulseUrl = '/api/news/pulse?view=' + (STATE.newsPulseView || 'market') + (staleBuild || !pulseHas(STATE.newsPulse) ? '&rebuild=1' : '');
        authFetch(pulseUrl).then(function (r) { return r && r.ok ? r.json() : null; }).then(function (d) {
          STATE.newsPulseBusy = false;
          if (pulseHas(d)) { STATE.newsPulse = d; window.bindNewsPulse(el, d); }
          else if (!pulseHas(STATE.newsPulse)) window.bindNewsPulse(el, window.__NEWS_PULSE_FIXTURE);
        }).catch(function () { STATE.newsPulseBusy = false; });
      }
    }
    if (el.setAttribute) el.setAttribute('data-port-ready', '1');
    el.querySelectorAll('img.ph').forEach(function (img) {
      var box = img.closest('.img');
      var ready = function () { if (box) box.classList.add('ready'); };
      var drop = function () {
        var i = Number((img.closest('[data-nw-i]') || {}).getAttribute && (img.closest('[data-nw-i]').getAttribute('data-nw-i')));
        var hit = (STATE.newsView || [])[i];
        if (hit) hit._noimg = true;
        if (box) { box.classList.remove('shimmer'); box.classList.add('noimg'); }
        img.remove();
      };
      img.addEventListener('load', ready);
      img.addEventListener('error', drop);
      if (img.complete && img.naturalWidth) ready();
      else if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) drop();
    });
    } finally {
      renderNews._on = false;
    }
  }

  function newsItemFromEl(el) {
    var view = STATE.newsView || [];
    var i = el && (el.getAttribute('data-nw-i') || el.getAttribute('data-nw-save') || el.getAttribute('data-nw-at'));
    if (i == null || i === '') return null;
    return view[Number(i)] || null;
  }

  function newsHandle(name, el) {
    if (name === 'news-span') {
      STATE.newsSpan = el.getAttribute('data-span');
      renderNews(STATE.news || []);
      return;
    }
    if (name === 'news-cat') {
      STATE.newsCat = el.getAttribute('data-nw-cat');
      renderNews(STATE.news || []);
      return;
    }
    if (name === 'news-topic') {
      var topic = el.getAttribute('data-nw-topic') || '';
      STATE.newsCat = 'All';
      STATE.newsQ = String(STATE.newsQ || '').toLowerCase() === topic.toLowerCase() ? '' : topic;
      renderNews(STATE.news || []);
      return;
    }
    if (name === 'news-refresh') {
      runNewsSweep(false);
      return;
    }
    if (name === 'news-open') {
      newsOpen(newsItemFromEl(el));
      return;
    }
    if (name === 'news-hide') {
      var hideItem = newsItemFromEl(el);
      var hid = hideItem && String(hideItem.id || hideItem.url || '');
      if (!hid) return;
      STATE.newsHidden = STATE.newsHidden || {};
      STATE.newsHidden[hid] = 1;
      renderNews(STATE.news || []);
      (window.deskToast || function () {})(document.getElementById('v-news') || document.body, 'Story removed', function () {
        delete STATE.newsHidden[hid];
        if (typeof authFetch === 'function') authFetch('/api/news/hidden', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: hid, undo: true }) }).catch(function () {});
        renderNews(STATE.news || []);
      }, 6000);
      if (typeof authFetch === 'function') authFetch('/api/news/hidden', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: hid }) }).catch(function () {});
      return;
    }
    if (name === 'news-url') {
      newsOpen({ title: el.getAttribute('data-nw-title'), url: el.getAttribute('data-nw-url') });
      return;
    }
    if (name === 'news-save') {
      var saveIt = newsItemFromEl(el);
      if (window.__newsSaved && typeof window.__newsSaved.openSave === 'function') window.__newsSaved.openSave(el, saveIt);
      else newsToSpace(saveIt);
      return;
    }
    if (name === 'news-act') {
      var item = newsItemFromEl(el);
      if (!item) return;
      var act = el.getAttribute('data-nw-act');
      if (act === 'open') { newsOpen(item); return; }
      var title = item.title || 'Story';
      saveItem((act === 'post' ? 'LinkedIn post: ' : act === 'letter' ? 'Investor newsletter: ' : 'Cite to a VC: ') + title + (item.url ? ' - ' + item.url : ''), 'week');
      if (typeof deskNote === 'function') deskNote(act === 'post' ? 'LinkedIn post draft added to This week.' : act === 'letter' ? 'Added to the investor newsletter list.' : 'Added to This week to cite to a VC.');
    }
  }

  function newsNeedThumbs(items) {
    return (items || []).some(function (item) {
      var img = String(item.image || item.image_url || '');
      return !item._noimg && !/^\/api\/news\/(?:image|thumb)\//i.test(img);
    });
  }

  function pollNewsThumbs() {
    if (pollNewsThumbs.timer) return;
    pollNewsThumbs.timer = setTimeout(function () {
      pollNewsThumbs.timer = 0;
      if (STATE.desk !== 'news' || STATE.newsBusy) return;
      authFetch('/api/news?span=month', { credentials: 'same-origin', quiet: true }).then(function (r) { return r.json(); }).then(function (data) {
        if (data && data.items) STATE.news = data.items;
        renderNews(STATE.news || []);
        if (newsNeedThumbs(STATE.news)) pollNewsThumbs();
      }).catch(function () {});
    }, 4000);
  }

  function runNewsSweep(quiet) {
    if (STATE.newsBusy) return;
    STATE.newsBusy = true;
    var before = {};
    (STATE.news || []).forEach(function (item) { before[item.id] = 1; });
    renderNews(STATE.news || []);
    if (!quiet && typeof deskNote === 'function') deskNote('Sweeping...');
    authFetch('/api/news/sweep', { method: 'POST', credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (data) {
      STATE.newsBusy = false;
      STATE.newsLoaded = true;
      if (data && data.items && data.items.length) STATE.news = data.items;
      if (data && data.sweptAt) STATE.newsSweptAt = data.sweptAt;
      var fresh = typeof data.saved === 'number' ? data.saved : (STATE.news || []).filter(function (item) { return !before[item.id]; }).length;
      renderNews(STATE.news || []);
      if (!quiet && typeof deskNote === 'function') deskNote('Sweeping... found ' + fresh + ' new');
      if (newsNeedThumbs(STATE.news)) pollNewsThumbs();
    }).catch(function () {
      STATE.newsBusy = false;
      STATE.newsLoaded = true;
      renderNews(STATE.news || []);
      if (!quiet && typeof deskNote === 'function') deskNote('Sweep did not finish - showing the last one.');
    });
  }

  function bindNewsDesk() {
    var el = (window.portEl && window.portEl('v-news', 'newsDesk')) || document.getElementById('newsDesk');
    var root = el && el.getRootNode && el.getRootNode();
    if (root && root.nodeType === 11 && typeof window.bindShadowActions === 'function') window.bindShadowActions(root);
    else if (el && typeof window.stampDeskControls === 'function') window.stampDeskControls(el);
  }

  function loadNews() {
    if (window.fixtureMockup || (typeof fixtureOn === 'function' && fixtureOn())) {
      var P = window.__NEWS_PULSE_FIXTURE || {};
      STATE.newsLoaded = true;
      STATE.news = (P.gauges || []).map(function (g, i) {
        var s = g.story || {};
        return {
          id: 'fx-' + g.k,
          title: s.h,
          summary: s.dek,
          category: s.chip,
          impact: s.imp === 'reg' ? 'Regulatory' : s.imp === 'opp' ? 'Opportunity' : 'Threat',
          image: s.img,
          why_it_matters: s.wim,
          url: 'https://www.canadianmortgagetrends.com/',
          source: (g.why && g.why[0]) || 'News',
          publishedAt: Date.now() - i * 3600000,
          isTop: i === 0
        };
      });
      renderNews(STATE.news);
      bindNewsDesk();
      return;
    }
    renderNews(STATE.news || []);
    bindNewsDesk();
    authFetch('/api/news/hidden', { credentials: 'same-origin', quiet: true }).then(function (r) { return r.json(); }).then(function (data) {
      STATE.newsHidden = {};
      (data && data.ids || []).forEach(function (id) { STATE.newsHidden[id] = 1; });
    }).catch(function () {}).then(function () {
    authFetch('/api/news?span=month', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (data) {
      STATE.newsLoaded = true;
      if (data && data.items && data.items.length) STATE.news = data.items;
      if (data && data.sweptAt) STATE.newsSweptAt = data.sweptAt;
      renderNews(STATE.news || []);
      if (!(STATE.news || []).length) runNewsSweep(true);
      else if (newsNeedThumbs(STATE.news)) pollNewsThumbs();
    }).catch(function () { STATE.newsLoaded = true; renderNews(STATE.news || []); });
    });
  }
  /* NEWS:END */

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

  function docKind(d) {
    var n = String(d.name || '').toLowerCase();
    var m = String(d.mime || '').toLowerCase();
    if (m.indexOf('image/') === 0 || /\.(png|jpe?g|gif|webp)$/.test(n)) return 'images';
    if (m.indexOf('pdf') >= 0 || n.slice(-4) === '.pdf') return 'pdf';
    if (/ppt|presentation/.test(m) || /\.pptx?$/.test(n)) return 'slides';
    if (/sheet|excel|csv/.test(m) || /\.(xlsx?|csv)$/.test(n)) return 'sheets';
    return 'docs';
  }

  function docUsed(d) {
    var names = (STATE.docUse && STATE.docUse[d.id]) ? STATE.docUse[d.id].slice() : [];
    (STATE.packages || []).forEach(function (p) {
      (p.docs || []).forEach(function (x) {
        if ((d.driveFileId && x.driveFileId === d.driveFileId) || (x.name && x.name === d.name)) {
          if (names.indexOf(p.name) < 0) names.push(p.name);
        }
      });
    });
    return names;
  }

  function docSets() {
    var base = [['investor', 'Investor data room', ['VC', 'Angel', 'Friends & Fam']], ['regulator', 'Regulator pack', ['Regulator', 'Government']], ['ff', 'F&F bundle', ['Friends & Fam']]];
    var mine = [];
    try { mine = JSON.parse(localStorage.getItem('cr_doc_sets') || '[]'); } catch (err) { mine = []; }
    return base.concat((mine || []).filter(function (s) { return s && s.id; }).map(function (s) { return [s.id, s.name || 'Untitled set', [], s.ids || []]; }));
  }

  function inSet(set, d) {
    if (set[3]) return set[3].indexOf(d.id) >= 0;
    return set[2].indexOf(d.category) >= 0;
  }

  function libraryMarkup(docs, folders) {
    var sets = docSets();
    var active = STATE.docFolder && folders.indexOf(STATE.docFolder) >= 0 ? STATE.docFolder : (folders[0] || '');
    var types = [['all', 'All'], ['pdf', 'PDF'], ['slides', 'Slides'], ['sheets', 'Sheets'], ['docs', 'Docs'], ['images', 'Images']];
    var wheres = [['space', 'In a space'], ['drive', 'From Drive'], ['upload', 'Uploaded']];
    var q = String(STATE.docQ || '').toLowerCase();
    var tree = folders.map(function (c) {
      var n = docs.filter(function (d) { return d.category === c; }).length;
      var on = c === active && !STATE.docSet;
      return '<div class="row lib-card' + (on ? ' on' : '') + '" data-cat="' + esc(c) + '" data-pick-folder="' + esc(c) + '"><span class="chev">' + (on ? '\u25be' : '\u25b8') + '</span><input data-lib-rename="' + esc(c) + '" value="' + esc(c) + '" aria-label="Folder name"><span class="ct">' + n + '</span><button type="button" class="ghost-x" data-lib-folder-x="' + esc(c) + '" aria-label="Delete folder">x</button></div>';
    }).join('');
    var setHtml = sets.map(function (s) {
      var n = docs.filter(function (d) { return inSet(s, d); }).length;
      return '<div class="row' + (STATE.docSet === s[0] ? ' on' : '') + '" data-doc-set="' + esc(s[0]) + '"><span class="pin">\u2605</span>' + esc(s[1]) + '<span class="ct">' + n + '</span></div>';
    }).join('');
    var chips = '<div class="chips">' + types.map(function (t) { return '<button type="button" class="fchip' + ((STATE.docType || 'all') === t[0] ? ' on' : '') + '" data-doc-type="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div><div class="chips">' + wheres.map(function (t) { return '<button type="button" class="fchip' + (STATE.docWhere === t[0] ? ' on' : '') + '" data-doc-where="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>';
    var title = active;
    var pool = docs.filter(function (d) {
      if (q) return String(d.name || '').toLowerCase().indexOf(q) >= 0 || String(d.category || '').toLowerCase().indexOf(q) >= 0;
      if (STATE.docSet) {
        var set = sets.filter(function (s) { return s[0] === STATE.docSet; })[0];
        if (set) { title = set[1]; if (!inSet(set, d)) return false; }
      } else if (d.category !== active) return false;
      if ((STATE.docType || 'all') !== 'all' && docKind(d) !== STATE.docType) return false;
      var used = docUsed(d);
      var where = used.length ? 'space' : (d.driveFileId ? 'drive' : 'upload');
      if (STATE.docWhere && STATE.docWhere !== 'all' && where !== STATE.docWhere) return false;
      return true;
    });
    if (q) title = 'Search: ' + STATE.docQ;
    var picked = STATE.docPick || {};
    var tiles = pool.map(function (d) {
      var image = (d.mime || '').indexOf('image/') === 0;
      var kind = ((d.name || '').split('.').pop() || 'file').slice(0, 4).toUpperCase();
      var k = docKind(d);
      var cls = k === 'pdf' ? ' pdf' : k === 'sheets' ? ' xls' : k === 'images' ? ' img' : '';
      var src = image ? ('/api/documents/file?id=' + encodeURIComponent(d.id)) : (d.driveFileId ? ('https://drive.google.com/thumbnail?id=' + encodeURIComponent(d.driveFileId) + '&sz=w400') : '');
      var sheet = image ? '' : '<div class="sheet"><div class="ln t"></div><div class="ln"></div><div class="ln s"></div><div class="ln"></div></div>';
      var face = (src ? '<img alt="" src="' + src + '" onload="var k=this.parentNode.querySelector(\'.sheet\');if(k)k.hidden=true" onerror="this.hidden=true"/>' : '') + sheet;
      var used = docUsed(d);
      var on = picked[d.id] ? ' sel' : '';
      return '<div class="doc' + on + ' mini-wrap" draggable="true" data-lib-inline="' + esc(d.id) + '"><input class="ck pick" type="checkbox" data-lib-pick="' + esc(d.id) + '"' + (picked[d.id] ? ' checked' : '') + ' aria-label="Select"><span class="sync ' + (d.driveFileId ? 'ok' : 'local') + '"></span><button type="button" class="ghost-x" data-lib-x="' + esc(d.id) + '" aria-label="Delete file">x</button><button type="button" class="mini"><div class="page' + cls + '">' + face + '<span class="typ">' + esc(kind) + '</span></div><div class="m"><div class="nm">' + esc(d.name || 'File') + '</div><span class="usein' + (used.length ? '' : ' none') + '">' + esc(used.length ? 'in: ' + used.slice(0, 2).join(', ') : 'not in a space') + '</span>' + (d._err ? '<span class="usein none">' + esc(d._err) + '</span>' : '') + '</div></button></div>';
    }).join('');
    var ids = Object.keys(picked);
    var menu = STATE.docMenu === 'space' ? '<div class="dmenu">' + ((STATE.packages || []).map(function (p) { return '<button type="button" data-lib-to-space="' + esc(p.id) + '">' + esc(p.name) + '</button>'; }).join('') || '<div class="hintbar">No spaces yet.</div>') + '</div>' : STATE.docMenu === 'move' ? '<div class="dmenu">' + folders.map(function (c) { return '<button type="button" data-lib-move-to="' + esc(c) + '">' + esc(c) + '</button>'; }).join('') + '</div>' : '';
    var bar = ids.length ? '<div class="selbar"><b>' + ids.length + ' selected</b><div class="sp"><button type="button" class="act go" id="libAddSpace">Add to Space</button><button type="button" class="act" id="libBuildSpace">Build a Space</button><button type="button" class="act" id="libPushSel">Push to Drive</button><button type="button" class="act" id="libMoveSel">Move</button><button type="button" class="act" id="libDelSel">Delete</button></div>' + menu + '</div>' : '';
    var rail = (STATE.packages || []).slice(0, 12).map(function (p) {
      var ini = String(p.name || 'S').replace(/[^A-Za-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase();
      var n = (p.docs || []).length;
      return '<div class="spacedrop" data-space-drop="' + esc(p.id) + '"><div class="d">' + esc(ini) + '</div><div><div class="nm">' + esc(p.name) + '</div><div class="sub">' + n + ' doc' + (n === 1 ? '' : 's') + ' \u00b7 drop to add</div></div></div>';
    }).join('');
    var recent = docs.slice(-5).reverse().map(function (d) { var k = docKind(d); var ic = k === 'pdf' ? 'PDF' : k === 'sheets' ? 'XLS' : k === 'slides' ? 'PPT' : k === 'images' ? 'IMG' : 'DOC'; return '<div class="ri"><span class="ic">' + ic + '</span>' + esc(d.name || 'File') + '</div>'; }).join('') || '<div class="hintbar" style="padding:4px 0">Nothing added yet.</div>';
    var view = STATE.docView === 'list' ? 'list' : 'grid';
    return '<div class="dcx"><div class="head"><span class="t">Documents</span><input class="search" id="libSearch" type="search" placeholder="Search all documents - name, type, or what\'s inside" value="' + esc(STATE.docQ || '') + '"><div class="seg"><button type="button" data-doc-view="grid"' + (view === 'grid' ? ' class="on"' : '') + '>Grid</button><button type="button" data-doc-view="list"' + (view === 'list' ? ' class="on"' : '') + '>List</button></div><button type="button" class="btn" id="libAddFolder">+ Folder</button><button type="button" class="btn pri" id="libNewSet">New set</button></div><div class="cap">Your staging library and launchpad: <button type="button" class="lk" id="libPullOpen">pull from Drive</button>, <label class="lk">upload<input id="libUpload" class="file-in" type="file" multiple></label>, preview inline, select, and drop straight into a Space to build a send-bundle.</div><div class="wrap"><div class="card side"><div class="sh">Folders <button type="button" class="add" id="libAddFolder2">+ new</button></div><div class="doc-tree">' + tree + '</div><div class="divide"></div><div class="sh">Sets <button type="button" class="add" id="libNewSet2">+ new</button></div><div class="set">' + setHtml + '</div><div class="divide"></div><div class="sh">Filter by type</div>' + chips + '</div><div id="libDrop">' + bar + '<div class="grid doc-grid' + (view === 'list' ? ' list' : '') + '">' + (tiles || '<div class="empty">No files in ' + esc(title) + ' yet. Drop files here, or pull them from Drive.</div>') + '</div></div><div class="card rr"><div class="sh">Drag docs into a Space</div><div class="spacelist">' + rail + '<div class="spacedrop build" id="libBuildSpace2"><div class="d">+</div><div><div class="nm">Build a new Space</div><div class="sub">from the selection</div></div></div></div><div class="divide"></div><div class="sh">Recently added</div><div class="recent">' + recent + '</div><div class="hintbar">Green dot = synced to Drive \u00b7 amber = local only. <button type="button" class="lk" id="libInc">Top incumbents</button></div></div></div></div>';
  }

  function openPullDrive(active, folders) {
    var modal = document.getElementById('modal');
    var box = document.getElementById('modalCard');
    if (!modal || !box) return;
    box.classList.remove('wide');
    var files = flatFiles(STATE.drives || [], []);
    box.innerHTML = '<div class="mhd"><div style="font-weight:700">Pull from Drive</div><button class="x" id="mClose" type="button">x</button></div><div class="mbd dcx-pull"><label>Folder<div class="pills" id="libCat">' + folders.map(function (c, i) { return '<button type="button" data-cat="' + esc(c) + '"' + ((c === active || (!active && !i)) ? ' class="on"' : '') + '>' + esc(c) + '</button>'; }).join('') + '</div></label><label>Drive file<div class="plist" id="libFile">' + (files.length ? files.map(function (file) { return '<button type="button" data-id="' + esc(file.id) + '" data-url="' + esc(file.url || '') + '" data-name="' + esc(file.name || '') + '">' + esc(file.name || 'File') + '</button>'; }).join('') : '<div class="quiet">No Drive files to pull.</div>') + '</div></label><div class="cap"><button class="btn sm pri" id="libPull" type="button">Pull into this folder</button><button class="btn sm" id="libPush" type="button">Push this folder to Drive</button></div></div>';
    modal.classList.add('open');
    modal.hidden = false;
    document.getElementById('mClose').onclick = function () { if (typeof closeModal === 'function') closeModal(); };
    var catBox = document.getElementById('libCat');
    var fileBox = document.getElementById('libFile');
    catBox.querySelectorAll('button').forEach(function (btn) {
      btn.onclick = function () {
        catBox.querySelectorAll('button').forEach(function (other) { other.classList.remove('on'); });
        btn.classList.add('on');
      };
    });
    fileBox.querySelectorAll('button').forEach(function (btn) {
      btn.onclick = function () {
        fileBox.querySelectorAll('button').forEach(function (other) { other.classList.remove('on'); });
        btn.classList.add('on');
      };
    });
    document.getElementById('libPull').onclick = function () {
      var opt = fileBox.querySelector('button.on');
      var folder = catBox.querySelector('button.on');
      if (!opt || !opt.getAttribute('data-id') || !folder) return;
      authFetch('/api/documents', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'pull', category: folder.getAttribute('data-cat'), name: opt.getAttribute('data-name'), url: opt.getAttribute('data-url'), driveFileId: opt.getAttribute('data-id') }) }).then(function () { if (typeof closeModal === 'function') closeModal(); loadLibrary(); }).catch(function () {});
    };
    document.getElementById('libPush').onclick = function () {
      var folder = catBox.querySelector('button.on');
      if (folder) pushFolder(folder.getAttribute('data-cat'));
    };
  }

  function pushFolder(cat) {
    authFetch('/api/documents', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'push', category: cat }) }).then(function (r) { return r.json(); }).then(function (d) { if (d && d.error) window.alert(d.error); }).catch(function () {});
  }

  function renderLibrary() {
    var el = document.getElementById('opsLibrary');
    if (!el || el.hidden) return;
    var docs = STATE.staged || [];
    var folders = libFolders();
    if (STATE.docPick) {
      var live = {};
      docs.forEach(function (d) { if (STATE.docPick[d.id]) live[d.id] = true; });
      STATE.docPick = live;
    }
    el.innerHTML = libraryMarkup(docs, folders);
    if (!STATE.docSpacesAsked && typeof loadPackages === 'function') {
      STATE.docSpacesAsked = true;
      loadPackages().then(function () { renderLibrary(); });
    }
    var activeFolder = STATE.docFolder && folders.indexOf(STATE.docFolder) >= 0 ? STATE.docFolder : (folders[0] || 'Dev');
    var pullOpen = document.getElementById('libPullOpen');
    if (pullOpen) pullOpen.onclick = function () { openPullDrive(activeFolder, folders); };
    var search = document.getElementById('libSearch');
    if (search) search.oninput = function () {
      STATE.docQ = search.value;
      var pos = search.selectionStart;
      renderLibrary();
      var again = document.getElementById('libSearch');
      if (again) { again.focus(); try { again.setSelectionRange(pos, pos); } catch (err) {} }
    };
    el.querySelectorAll('[data-doc-view]').forEach(function (btn) {
      btn.onclick = function () { STATE.docView = btn.getAttribute('data-doc-view'); renderLibrary(); };
    });
    function newSet() {
      var mine = [];
      try { mine = JSON.parse(localStorage.getItem('cr_doc_sets') || '[]'); } catch (err) { mine = []; }
      var id = 'set-' + Date.now();
      mine.push({ id: id, name: 'Untitled set', ids: Object.keys(STATE.docPick || {}) });
      try { localStorage.setItem('cr_doc_sets', JSON.stringify(mine)); } catch (err) {}
      STATE.docSet = id;
      renderLibrary();
    }
    ['libNewSet', 'libNewSet2'].forEach(function (id) { var b = document.getElementById(id); if (b) b.onclick = newSet; });
    var addFolder2 = document.getElementById('libAddFolder2');
    if (addFolder2) addFolder2.onclick = function () { var b = document.getElementById('libAddFolder'); if (b) b.click(); };
    function takeFiles(files, category) {
      var cat = category || activeFolder || 'Dev';
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
    if (upload) upload.onchange = function () { takeFiles(upload.files, activeFolder); };
    if (drop) {
      drop.ondragover = function (e) { e.preventDefault(); };
      drop.ondrop = function (e) { e.preventDefault(); if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) takeFiles(e.dataTransfer.files, activeFolder); };
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
          var wrap = mini.closest('[data-lib-inline]');
          var doc = docs.filter(function (d) { return d.id === (wrap ? wrap.getAttribute('data-lib-inline') : ''); })[0];
          if (!doc) return;
          var url = doc.driveFileId ? ('https://drive.google.com/file/d/' + encodeURIComponent(doc.driveFileId) + '/preview') : (doc.url || ('/api/documents/file?id=' + encodeURIComponent(doc.id)));
          openDocView(doc.name, url, '');
          return;
        }
        var folder = e.target.closest('[data-pick-folder]');
        STATE.docFolder = (folder && folder.getAttribute('data-pick-folder')) || card.getAttribute('data-cat');
        STATE.docSet = '';
        renderLibrary();
      };
    });
    el.querySelectorAll('[data-pick-folder]').forEach(function (btn) {
      btn.onclick = function (e) {
        if (e.target.closest('[data-lib-rename],[data-lib-folder-x]')) return;
        e.stopPropagation();
        STATE.docFolder = btn.getAttribute('data-pick-folder') || '';
        STATE.docSet = '';
        renderLibrary();
      };
    });
    el.querySelectorAll('[data-doc-set]').forEach(function (btn) {
      btn.onclick = function () { STATE.docSet = btn.getAttribute('data-doc-set') || ''; STATE.docQ = ''; renderLibrary(); };
    });
    el.querySelectorAll('[data-doc-type]').forEach(function (btn) {
      btn.onclick = function () { STATE.docType = btn.getAttribute('data-doc-type') || 'all'; renderLibrary(); };
    });
    el.querySelectorAll('[data-doc-where]').forEach(function (btn) {
      btn.onclick = function () { var w = btn.getAttribute('data-doc-where') || 'all'; STATE.docWhere = STATE.docWhere === w ? 'all' : w; renderLibrary(); };
    });
    el.querySelectorAll('[data-lib-pick]').forEach(function (box) {
      box.onclick = function (e) { e.stopPropagation(); };
      box.onchange = function () {
        STATE.docPick = STATE.docPick || {};
        var id = box.getAttribute('data-lib-pick') || '';
        if (box.checked) STATE.docPick[id] = true; else delete STATE.docPick[id];
        renderLibrary();
      };
    });
    el.querySelectorAll('.doc-grid .mini').forEach(function (mini) {
      mini.onclick = function (e) {
        if (e.target.closest('[data-lib-x],[data-lib-pick]')) return;
        var wrap = mini.closest('[data-lib-inline]');
        var doc = docs.filter(function (d) { return d.id === (wrap ? wrap.getAttribute('data-lib-inline') : ''); })[0];
        if (!doc) return;
        var url = doc.driveFileId ? ('https://drive.google.com/file/d/' + encodeURIComponent(doc.driveFileId) + '/preview') : (doc.url || ('/api/documents/file?id=' + encodeURIComponent(doc.id)));
        openDocView(doc.name, url, '');
      };
    });
    function selectedDocs() {
      return (STATE.staged || []).filter(function (d) { return STATE.docPick && STATE.docPick[d.id]; });
    }
    function rememberUse(spaceName, ids) {
      STATE.docUse = STATE.docUse || {};
      ids.forEach(function (id) {
        STATE.docUse[id] = STATE.docUse[id] || [];
        if (STATE.docUse[id].indexOf(spaceName) < 0) STATE.docUse[id].push(spaceName);
      });
    }
    function addDocsToSpace(spaceId, ids) {
      var space = (STATE.packages || []).filter(function (p) { return p.id === spaceId; })[0];
      if (!space || !ids.length) return;
      ids.forEach(function (id) {
        var doc = (STATE.staged || []).filter(function (d) { return d.id === id; })[0];
        if (!doc || String(id).indexOf('tmp-') === 0) return;
        authFetch('/api/spaces/' + spaceId, { method: 'POST', credentials: 'same-origin', quiet: true, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'add-doc', name: doc.name, url: doc.url || '', mime: doc.mime || '', driveFileId: doc.driveFileId || '' }) }).catch(function () {});
      });
      rememberUse(space.name, ids);
      renderLibrary();
    }
    var addSpace = document.getElementById('libAddSpace');
    if (addSpace) addSpace.onclick = function () { STATE.docMenu = STATE.docMenu === 'space' ? '' : 'space'; renderLibrary(); };
    el.querySelectorAll('[data-lib-to-space]').forEach(function (btn) {
      btn.onclick = function () { STATE.docMenu = ''; addDocsToSpace(btn.getAttribute('data-lib-to-space') || '', Object.keys(STATE.docPick || {})); };
    });
    function buildSpace() {
      var ids = Object.keys(STATE.docPick || {});
      if (!ids.length) return;
      var name = 'Bundle';
      authFetch('/api/spaces', { method: 'POST', credentials: 'same-origin', quiet: true, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: name }) }).then(function (r) { return r.json(); }).then(function (d) {
        var id = d && (d.id || (d.space && d.space.id) || (d.package && d.package.id));
        if (!id) return;
        STATE.packages = (STATE.packages || []).concat([{ id: id, name: d.name || name, docs: [], stage: 'draft', status: 'draft' }]);
        addDocsToSpace(id, ids);
      }).catch(function () {});
    }
    var build = document.getElementById('libBuildSpace');
    if (build) build.onclick = buildSpace;
    var build2 = document.getElementById('libBuildSpace2');
    if (build2) build2.onclick = buildSpace;
    var pushSel = document.getElementById('libPushSel');
    if (pushSel) pushSel.onclick = function () { pushFolder(activeFolder); };
    var moveSel = document.getElementById('libMoveSel');
    if (moveSel) moveSel.onclick = function () { STATE.docMenu = STATE.docMenu === 'move' ? '' : 'move'; renderLibrary(); };
    el.querySelectorAll('[data-lib-move-to]').forEach(function (btn) {
      btn.onclick = function () {
        var cat = btn.getAttribute('data-lib-move-to') || '';
        if (!cat) return;
        selectedDocs().forEach(function (doc) {
          if (String(doc.id).indexOf('tmp-') === 0) return;
          doc.category = cat;
          authFetch('/api/documents', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'move', id: doc.id, category: cat }) }).catch(function () { doc._err = 'Not moved yet'; });
        });
        STATE.docPick = {};
        STATE.docMenu = '';
        renderLibrary();
      };
    });
    var delSel = document.getElementById('libDelSel');
    if (delSel) delSel.onclick = function () {
      if (!window.confirm('Delete the selected files?')) return;
      var ids = Object.keys(STATE.docPick || {});
      STATE.staged = (STATE.staged || []).filter(function (d) { return ids.indexOf(d.id) < 0; });
      STATE.docPick = {};
      renderLibrary();
      ids.forEach(function (id) {
        if (id.indexOf('tmp-') === 0) return;
        authFetch('/api/documents', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'remove', id: id }) }).catch(function () {});
      });
    };
    el.querySelectorAll('[data-space-drop]').forEach(function (box) {
      box.ondragover = function (e) { e.preventDefault(); };
      box.ondrop = function (e) {
        e.preventDefault();
        var plain = '';
        try { plain = e.dataTransfer.getData('text/plain') || ''; } catch (err) { plain = ''; }
        var ids = plain.indexOf('4orm-doc:') === 0 ? [plain.slice(9)] : Object.keys(STATE.docPick || {});
        addDocsToSpace(box.getAttribute('data-space-drop') || '', ids);
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
      return '<div class="exec-card" style="background:#18191f;color:#E7EEF6"><div style="flex:1"><div class="kick">' + esc(note.body || '') + '</div><b>' + esc(note.title || '') + '</b></div><button type="button" data-note-edit="' + esc(note.id) + '">Edit</button><button type="button" data-note-del="' + esc(note.id) + '">Delete</button></div>';
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

  openDocView = function (name, url, extra) {
    var raw = String(url || '');
    var tag = String(extra || '');
    var fid = /^[\w-]{8,}$/.test(tag) && !/^[0-9a-f-]{36}$/i.test(tag) ? tag : '';
    var note = fid ? '' : tag;
    var view = document.getElementById('docView');
    document.getElementById('docViewName').textContent = name || 'Document';
    var driveBtn = document.getElementById('docViewDrive');
    var frame = document.getElementById('docViewFrame');
    var miss = document.getElementById('docViewMiss');
    var preview = typeof drivePreview === 'function' ? drivePreview(raw) : '';
    if (!preview && fid) preview = 'https://drive.google.com/file/d/' + fid + '/preview';
    var href = /^https:\/\//.test(raw) ? raw : (fid ? 'https://drive.google.com/file/d/' + fid + '/view' : '');
    if (!fid && preview) {
      var hit = preview.match(/\/d\/([^/]+)/);
      fid = hit ? hit[1] : '';
    }
    if (driveBtn) {
      driveBtn.hidden = !href;
      driveBtn.textContent = 'Open in Drive';
      driveBtn.setAttribute('data-href', href);
      driveBtn.onclick = null;
    }
    function showMiss() {
      frame.hidden = true;
      frame.src = 'about:blank';
      if (miss) {
        miss.hidden = false;
        var line = miss.querySelector('.s');
        if (line) line.textContent = note || 'Google Drive does not offer an embedded preview for this file type.';
        var go = miss.querySelector('button');
        if (go) go.hidden = !href;
      }
    }
    function showFrame(src) {
      if (miss) miss.hidden = true;
      frame.hidden = false;
      frame.src = src;
    }
    if (typeof deskBusy === 'function') deskBusy(true);
    function done() { if (typeof deskBusy === 'function') deskBusy(false); }
    function asBlob(r) {
      if (!r.ok) throw 0;
      return r.blob();
    }
    function okBlob(blob) {
      var type = blob && blob.type || '';
      return type.indexOf('image/') === 0 || type === 'application/pdf' || type.indexOf('text/') === 0;
    }
    view.hidden = false;
    if (raw && (raw.indexOf('/api/documents/file') === 0 || raw.indexOf('/api/spaces/') === 0)) {
      frame.src = 'about:blank';
      authFetch(raw, { credentials: 'same-origin' }).then(asBlob).then(function (blob) {
        if (!okBlob(blob)) throw 0;
        showFrame(URL.createObjectURL(blob));
      }).catch(showMiss).then(done, done);
      return;
    }
    if (!preview) {
      if (!raw && !note) { view.hidden = true; done(); return; }
      showMiss();
      done();
      return;
    }
    showFrame(preview);
    if (!fid) { done(); return; }
    authFetch('/api/drive/file?id=' + encodeURIComponent(fid), { credentials: 'same-origin' }).then(asBlob).then(function (blob) {
      if (!okBlob(blob) || view.hidden || frame.src !== preview) return;
      showFrame(URL.createObjectURL(blob));
    }).catch(function () {}).then(done, done);
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

  if (typeof applyCeo === 'function') {
    var priorCeo = applyCeo;
    applyCeo = function (data) {
      var nextMoves = (data && data.moves) || [];
      var prevMoves = (STATE.ceo && STATE.ceo.moves) || [];
      var nextLamps = (data && data.lamps) || [];
      var prevLamps = (STATE.ceo && STATE.ceo.lamps) || [];
      priorCeo(Object.assign({}, data || {}, {
        moves: nextMoves.length ? nextMoves : prevMoves,
        lamps: nextLamps.length ? nextLamps : prevLamps
      }));
      console.info('[live-map] /api/ceo', { moves: ((STATE.ceo && STATE.ceo.moves) || []).length, moveKeys: STATE.ceo && STATE.ceo.moves && STATE.ceo.moves[0] ? Object.keys(STATE.ceo.moves[0]) : [], lamps: ((STATE.ceo && STATE.ceo.lamps) || []).length });
      if (!STATE.desk || STATE.desk === 'room') renderOpsDash();
      if (STATE.desk === 'war') renderWar();
    };
  }
  var priorApply = applyBoard;
  applyBoard = function (data) {
    priorApply(data);
    console.info('[live-map] /api/board', { items: (STATE.items || []).length, itemKeys: STATE.items && STATE.items[0] ? Object.keys(STATE.items[0]) : [], notes: (STATE.notes || []).length, noteKeys: STATE.notes && STATE.notes[0] ? Object.keys(STATE.notes[0]) : [], events: (STATE.events || []).length, plugins: (STATE.plugins || []).length });
    renderOpsDash();
    renderWar();
    renderDeskNotes();
    if (typeof renderNotes === 'function') renderNotes();
    var deskNow = STATE.desk || '';
    if (deskNow === 'war' || deskNow === 'room' || deskNow === 'planner' || !deskNow) {
      loadDeskFeeds();
      loadReach();
      loadMeetingActions();
    }
    if (deskNow === 'notes') { loadStickies(); loadNotes(); }
    if (deskNow === 'finance' && typeof loadFinance === 'function') loadFinance();
    if (deskNow === 'news') loadNews();
    if (deskNow === 'contacts') loadInbox();
  };
  var priorSwitch = switchView;
  switchView = function (v) {
    priorSwitch(v);
    if (v === 'news') loadNews();
    if (v === 'docs') setLib('library');
    if (v === 'drive') renderDocs();
    if (v === 'contacts') { loadDeskFeeds(); loadInbox(); }
    if (v === 'people') loadDeskFeeds();
    if (v === 'room') { loadDeskFeeds(); renderOpsDash(); }
    if (v === 'war') { loadDeskFeeds(); loadReach(); loadMeetingActions(); renderWar(); }
    if (v === 'notes') { loadStickies(); loadNotes(); if (typeof renderNotes === 'function') renderNotes(); renderSticky(); }
    if (v === 'znotes') renderZNotes();
    if (v === 'mail' && typeof loadMailBoard === 'function') loadMailBoard();
    if (v === 'done' && typeof loadSnapshots === 'function') loadSnapshots();
    if (v === 'finance' && typeof loadFinance === 'function') loadFinance();
  };
  window.loadNews = loadNews;
  try {
    if ((window.STATE && window.STATE.desk === 'news') || /(?:^|[?&])view=news(?:&|$)/.test(String(location.search || '')) || /\/news\/?$/.test(String(location.pathname || ''))) {
      loadNews();
    }
  } catch (eNews) {}

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
  var zoomForm = document.getElementById('zoomForm');
  if (zoomForm) zoomForm.onsubmit = function (e) {
    e.preventDefault();
    var id = document.getElementById('zoomId').value;
    var title = document.getElementById('zoomTitle').value.trim() || 'Untitled meeting';
    var people = document.getElementById('zoomPeople').value;
    var others = document.getElementById('zoomOthers').value;
    var payload = { title: title, attendees: people, others: others };
    var names = people.split(',').map(function (bit) { return bit.trim(); }).filter(Boolean);
    var lines = others.split('\n').map(function (bit) { return bit.trim(); }).filter(Boolean);
    zoomForm.reset();
    if (id) {
      var note = (STATE.zoomNotes || []).filter(function (n) { return n.id === id; })[0];
      if (note) { note.title = title; note.attendees = names; note.others = lines; note._err = ''; }
      renderZNotes();
      authFetch('/api/zoom/' + id, { method: 'PATCH', quiet: true, credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }).then(function (r) { if (!r.ok) throw 0; }).catch(function () { if (note) { note._err = 'Not saved yet'; renderZNotes(); } });
      return;
    }
    var temp = { id: 'tmp-' + Date.now(), title: title, attendees: names, others: lines, date: new Date().toISOString().slice(0, 10), solo: !names.length, intel: [], improve: [], sources: [] };
    STATE.zoomNotes = STATE.zoomNotes || [];
    STATE.zoomNotes.unshift(temp);
    renderZNotes();
    authFetch('/api/zoom', { method: 'POST', quiet: true, credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }).then(function (r) { if (!r.ok) throw 0; return authFetch('/api/board', { credentials: 'same-origin' }); }).then(function (r) { return r.json(); }).then(applyBoard).catch(function () { temp._err = 'Not saved yet'; renderZNotes(); });
  };
  var priorZ = renderZNotes;
  renderZNotes = function () {
    priorZ();
    var grid = document.getElementById('zGrid');
    if (!grid) return;
    grid.querySelectorAll('[data-zdel]').forEach(function (btn) {
      btn.onclick = function (ev) {
        ev.stopPropagation();
        if (!window.confirm('Delete this meeting note?')) return;
        var id = btn.getAttribute('data-zdel');
        var prev = (STATE.zoomNotes || []).slice();
        STATE.zoomNotes = prev.filter(function (n) { return n.id !== id; });
        renderZNotes();
        if (String(id).indexOf('tmp-') === 0) return;
        authFetch('/api/zoom/' + id, { method: 'DELETE', quiet: true, credentials: 'same-origin' }).then(function (r) { if (!r.ok) throw 0; }).catch(function () { STATE.zoomNotes = prev; renderZNotes(); });
      };
    });
    grid.querySelectorAll('[data-zedit]').forEach(function (btn) {
      btn.onclick = function (ev) {
        ev.stopPropagation();
        var note = (STATE.zoomNotes || []).filter(function (n) { return n.id === btn.getAttribute('data-zedit'); })[0];
        if (!note) return;
        document.getElementById('zoomId').value = note.id;
        document.getElementById('zoomTitle').value = note.title || '';
        document.getElementById('zoomPeople').value = (note.attendees || []).join(', ');
        document.getElementById('zoomOthers').value = (note.others || []).join('\n');
        var title = document.getElementById('zoomTitle');
        if (title) title.focus();
      };
    });
  };
  function renderSticky() {
    var host = document.getElementById('stickyDesk');
    if (!host) return;
    var colours = ['yellow', 'blue', 'green', 'pink'];
    function paint(notes) {
      var q = String(STATE.stickQ || '').toLowerCase();
      var kind = STATE.stickKind || 'all';
      var colours = ['yellow', 'blue', 'green', 'pink', 'orange', 'purple'];
      var shown = notes.filter(function (note) {
        var meta = note.meta || {};
        if (kind === 'archive') return !!meta.archived;
        if (meta.archived) return false;
        if (kind === 'pinned') return !!meta.pin;
        if (kind !== 'all' && meta.kind !== kind) return false;
        return !q || String(note.body || '').toLowerCase().indexOf(q) >= 0;
      });
      var kinds = [['all', 'All'], ['pinned', 'Pinned'], ['idea', 'Idea'], ['todo', 'To-do'], ['person', 'Person'], ['decision', 'Decision'], ['archive', 'Archive']];
      host.innerHTML = '<div class="nbar"><span class="t">Notes</span><div class="nadd"><button class="nb" id="stickAdd" type="button">+ New note</button><span class="dots" id="stickDots"></span></div><div class="right"><input id="stickFind" class="nsearch" type="text" placeholder="Search notes..." aria-label="Search notes" value="' + esc(q) + '"><button class="nbtn" id="stickTidy" type="button">Tidy up</button><button class="nbtn" id="stickFull" type="button">Full screen</button></div></div><div class="stick-filters">' + kinds.map(function (pair) { return '<button type="button" data-stick-kind="' + pair[0] + '"' + (kind === pair[0] ? ' class="on"' : '') + '>' + pair[1] + '</button>'; }).join('') + '</div><div class="sticky-board" id="stickBoard"></div>';
      var board = document.getElementById('stickBoard');
      board.innerHTML = shown.map(function (note, index) {
        var meta = note.meta || {};
        var tilt = (index % 2 ? 1.2 : -1.2);
        var kindLabel = { idea: 'Idea', todo: 'To-do', person: 'Person', decision: 'Decision' }[meta.kind || ''] || 'Type';
        var pinMark = meta.pin ? '<span class="pin" aria-hidden="true">&#128204;</span>' : '';
        var checks = (meta.checks || []).map(function (row, i) {
          return '<label class="check' + (row.done ? ' done' : '') + '"><input type="checkbox" data-stick-check="' + esc(note.id) + '" data-i="' + i + '"' + (row.done ? ' checked' : '') + '/><input type="text" data-stick-line="' + esc(note.id) + '" data-i="' + i + '" value="' + esc(row.t || '') + '" placeholder="Checklist item" aria-label="Checklist item"/></label>';
        }).join('');
        var link = meta.link && meta.link.name ? '<button type="button" class="nlink" data-stick-jump="' + esc(note.id) + '">' + esc(meta.link.name) + '</button>' : '';
        return '<div class="sticky ' + esc(note.color || 'yellow') + '" data-stick="' + esc(note.id) + '" style="left:' + (Number(note.x) || 24) + 'px;top:' + (Number(note.y) || 24) + 'px;width:' + (Number(note.w) || 220) + 'px;height:' + (Number(note.h) || 220) + 'px;transform:rotate(' + tilt + 'deg)">' + pinMark + '<button type="button" class="tag" data-stick-kind-btn="' + esc(note.id) + '">' + esc(kindLabel) + '</button><button type="button" class="tag" data-stick-pin="' + esc(note.id) + '">' + (meta.pin ? 'Pinned' : 'Pin') + '</button><div class="dots">' + colours.map(function (c) { return '<button type="button" class="' + c + ((note.color || 'yellow') === c ? ' on' : '') + '" data-color="' + c + '" aria-label="' + c + '"></button>'; }).join('') + '</div><textarea rows="3">' + esc(note.body || '') + '</textarea>' + checks + '<button type="button" class="addcheck" data-stick-addcheck="' + esc(note.id) + '">+ check</button>' + link + '<input class="note-line" data-stick-link="' + esc(note.id) + '" value="' + esc((meta.link && meta.link.name) || '') + '" placeholder="Link a person or space" aria-label="Link a person or space"/><input class="note-line" data-stick-remind="' + esc(note.id) + '" value="' + esc(meta.remind || '') + '" placeholder="Reminder" aria-label="Reminder"/><div class="acts"><button type="button" data-stick-task="' + esc(note.id) + '">Convert to task</button><button type="button" data-stick-content="' + esc(note.id) + '">Send to content runway</button><button type="button" data-stick-space="' + esc(note.id) + '">Save to a space</button><button type="button" data-stick-dash="' + esc(note.id) + '">Pin to dashboard</button><button type="button" data-stick-open="' + esc(note.id) + '">Open space</button></div>' + (note._err ? '<div class="soft-err">' + esc(note._err) + '</div>' : '') + '<button type="button" class="ghost-x" data-stick-del="' + esc(note.id) + '" aria-label="Archive">x</button><button type="button" class="stick-size" data-stick-size="' + esc(note.id) + '" aria-label="Resize"></button></div>';
      }).join('');
      var dotHost = document.getElementById('stickDots');
      if (dotHost) {
        dotHost.innerHTML = colours.map(function (c) { return '<button type="button" class="' + c + ((STATE.stickColor || 'yellow') === c ? ' on' : '') + '" data-new-color="' + c + '" aria-label="' + c + '"></button>'; }).join('');
        dotHost.querySelectorAll('[data-new-color]').forEach(function (dot) {
          dot.onclick = function () { STATE.stickColor = dot.getAttribute('data-new-color'); paint(notes); };
        });
      }
      var findBox = document.getElementById('stickFind');
      if (findBox) findBox.oninput = function () {
        STATE.stickQ = findBox.value;
        paint(notes);
        var again = document.getElementById('stickFind');
        if (again) { again.focus(); var n = again.value.length; again.setSelectionRange(n, n); }
      };
      var tidy = document.getElementById('stickTidy');
      if (tidy) tidy.onclick = function () {
        notes.forEach(function (note, i) {
          note.x = 16 + (i % 4) * 200;
          note.y = 16 + Math.floor(i / 4) * 170;
          if (String(note.id).indexOf('tmp-') === 0) return;
          authFetch('/api/notes/' + note.id, { method: 'PATCH', credentials: 'same-origin', quiet: true, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ x: note.x, y: note.y }) }).catch(function () {});
        });
        paint(notes);
      };
      host.querySelectorAll('[data-stick-kind]').forEach(function (btn) {
        btn.onclick = function () { STATE.stickKind = btn.getAttribute('data-stick-kind'); paint(notes); };
      });
      var full = document.getElementById('stickFull');
      if (full) full.onclick = function () { document.body.classList.toggle('exec-full'); var board = document.getElementById('stickBoard'); if (board) board.style.minHeight = document.body.classList.contains('exec-full') ? '80vh' : ''; };
      document.getElementById('stickAdd').onclick = function () {
        var temp = { id: 'tmp-' + Date.now(), body: '', color: STATE.stickColor || 'yellow', x: 24 + (notes.length % 4) * 28, y: 24 + (notes.length % 3) * 20 };
        notes.push(temp);
        paint(notes);
        var area = host.querySelector('[data-stick="' + temp.id + '"] textarea');
        if (area) area.focus();
        authFetch('/api/notes/sticky', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ body: '', color: temp.color, x: temp.x, y: temp.y }) }).then(function (r) { if (!r.ok) throw 0; return r.json();         }).then(function (saved) {
          var card = host.querySelector('[data-stick="' + temp.id + '"]');
          temp.id = saved.id || temp.id;
          if (card && saved.id) card.setAttribute('data-stick', saved.id);
          var area = card && card.querySelector('textarea');
          if (saved.id && area && (area.value || temp.color !== 'yellow' || (temp.meta))) {
            authFetch('/api/notes/' + saved.id, { method: 'PATCH', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ body: area.value, color: temp.color, x: card.offsetLeft, y: card.offsetTop }) }).catch(function () {});
          }
        }).catch(function () { temp._err = 'Not saved yet'; var card = host.querySelector('[data-stick="' + temp.id + '"]'); if (card && !card.querySelector('.soft-err')) card.insertAdjacentHTML('beforeend', '<div class="soft-err">Not saved yet</div>'); });
      };
      function patchMeta(note) {
        if (!note || String(note.id).indexOf('tmp-') === 0) return;
        authFetch('/api/notes/' + note.id, { method: 'PATCH', quiet: true, credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ meta: note.meta || {} }) }).catch(function () {});
      }
      board.querySelectorAll('[data-stick-task]').forEach(function (btn) {
        btn.onclick = function (e) {
          e.stopPropagation();
          var note = notes.filter(function (row) { return row.id === btn.getAttribute('data-stick-task'); })[0];
          if (note) saveItem(note.body || 'Note', 'today');
        };
      });

      function noteBy(attr, el) {
        return notes.filter(function (row) { return row.id === el.getAttribute(attr); })[0];
      }
      board.querySelectorAll('[data-stick-check]').forEach(function (box) {
        box.onchange = function (e) {
          e.stopPropagation();
          var note = noteBy('data-stick-check', box);
          var i = Number(box.getAttribute('data-i'));
          if (!note || !note.meta || !note.meta.checks || !note.meta.checks[i]) return;
          note.meta.checks[i].done = box.checked;
          var row = box.closest('.check');
          if (row) row.classList.toggle('done', box.checked);
          patchMeta(note);
        };
      });
      board.querySelectorAll('[data-stick-line]').forEach(function (box) {
        box.onchange = function () {
          var note = noteBy('data-stick-line', box);
          var i = Number(box.getAttribute('data-i'));
          if (!note || !note.meta || !note.meta.checks || !note.meta.checks[i]) return;
          note.meta.checks[i].t = box.value;
          patchMeta(note);
        };
      });
      board.querySelectorAll('[data-stick-addcheck]').forEach(function (btn) {
        btn.onclick = function (e) {
          e.stopPropagation();
          var note = noteBy('data-stick-addcheck', btn);
          if (!note) return;
          note.meta = note.meta || {};
          note.meta.checks = note.meta.checks || [];
          note.meta.checks.push({ t: '', done: false });
          if (!note.meta.kind) note.meta.kind = 'todo';
          patchMeta(note);
          paint(notes);
        };
      });
      board.querySelectorAll('[data-stick-link]').forEach(function (box) {
        box.onchange = function () {
          var note = noteBy('data-stick-link', box);
          if (!note) return;
          var q = box.value.trim().toLowerCase();
          note.meta = note.meta || {};
          var person = (STATE.contacts || []).filter(function (c) { return String(c.name || '').toLowerCase() === q; })[0];
          var space = (STATE.packages || []).filter(function (sp) { return String(sp.name || '').toLowerCase() === q; })[0];
          if (person) note.meta.link = { kind: 'person', id: person.id, name: person.name };
          else if (space) note.meta.link = { kind: 'space', id: space.id, name: space.name };
          else note.meta.link = q ? { kind: 'name', id: '', name: box.value.trim() } : null;
          patchMeta(note);
          paint(notes);
        };
      });
      board.querySelectorAll('[data-stick-jump]').forEach(function (btn) {
        btn.onclick = function (e) {
          e.stopPropagation();
          var note = noteBy('data-stick-jump', btn);
          var link = note && note.meta && note.meta.link;
          if (!link) return;
          if (link.kind === 'space' && typeof switchView === 'function') {
            switchView('work');
            var card = document.querySelector('[data-pkg="' + link.id + '"]');
            if (card) card.click();
          } else if (typeof switchView === 'function') switchView('people');
        };
      });
      board.querySelectorAll('[data-stick-content]').forEach(function (btn) {
        btn.onclick = function (e) {
          e.stopPropagation();
          var note = noteBy('data-stick-content', btn);
          if (note) saveItem('Draft post: ' + String(note.body || 'Note').slice(0, 80), 'today');
        };
      });
      board.querySelectorAll('[data-stick-space]').forEach(function (btn) {
        btn.onclick = function (e) {
          e.stopPropagation();
          var note = noteBy('data-stick-space', btn);
          if (!note) return;
          var name = (note.meta && note.meta.link && note.meta.link.name) || '';
          var space = (STATE.packages || []).filter(function (sp) { return String(sp.name || '').toLowerCase() === String(name).toLowerCase() || (note.meta && note.meta.link && note.meta.link.id === sp.id); })[0];
          if (!space) { note._err = 'Type a space name in the link line first.'; paint(notes); return; }
          var notesText = String(space.description || space.notes || '');
          var extra = String(note.body || '').trim();
          if (extra && notesText.indexOf(extra) < 0) notesText = (notesText + '\n' + extra).trim();
          space.description = notesText;
          note.meta = note.meta || {};
          note.meta.link = { kind: 'space', id: space.id, name: space.name };
          note._err = '';
          patchMeta(note);
          if (String(space.id).indexOf('tmp-') !== 0) authFetch('/api/spaces/' + space.id, { method: 'PATCH', quiet: true, credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ notes: notesText }) }).catch(function () {});
          paint(notes);
        };
      });
      board.querySelectorAll('[data-stick-dash]').forEach(function (btn) {
        btn.onclick = function (e) {
          e.stopPropagation();
          var note = noteBy('data-stick-dash', btn);
          if (!note) return;
          note.meta = note.meta || {};
          note.meta.pin = true;
          patchMeta(note);
          var pins = [];
          try { pins = JSON.parse(localStorage.getItem('cr_dash_notes') || '[]'); } catch (err) { pins = []; }
          pins = pins.filter(function (row) { return row.id !== note.id; });
          pins.unshift({ id: note.id, text: String(note.body || 'Pinned note').slice(0, 80) });
          try { localStorage.setItem('cr_dash_notes', JSON.stringify(pins.slice(0, 5))); } catch (err) {}
          paint(notes);
        };
      });
      board.querySelectorAll('[data-stick-open]').forEach(function (btn) {
        btn.onclick = function (e) {
          e.stopPropagation();
          var note = noteBy('data-stick-open', btn);
          var link = note && note.meta && note.meta.link;
          if (!link || !link.id) { if (note) { note._err = 'Link a space first.'; paint(notes); } return; }
          if (typeof switchView === 'function') switchView('work');
          var card = document.querySelector('[data-pkg="' + link.id + '"]');
          if (card) card.click();
        };
      });
      board.querySelectorAll('[data-stick-remind]').forEach(function (box) {
        box.onchange = function () {
          var note = notes.filter(function (row) { return row.id === box.getAttribute('data-stick-remind'); })[0];
          if (!note) return;
          note.meta = note.meta || {};
          note.meta.remind = box.value;
          patchMeta(note);
        };
      });
      board.querySelectorAll('[data-stick-del]').forEach(function (btn) {
        btn.onclick = function () {
          var id = btn.getAttribute('data-stick-del');
          var note = notes.filter(function (row) { return row.id === id; })[0];
          if (note && (STATE.stickKind === 'archive' || (note.meta && note.meta.archived))) {
            var left = notes.filter(function (row) { return row.id !== id; });
            notes.splice(0, notes.length);
            left.forEach(function (row) { notes.push(row); });
            paint(notes);
            if (String(id).indexOf('tmp-') === 0) return;
            authFetch('/api/notes/' + id, { method: 'DELETE', credentials: 'same-origin' }).catch(function () {});
            return;
          }
          if (note) { note.meta = note.meta || {}; note.meta.archived = true; patchMeta(note); }
          paint(notes);
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
        card.querySelectorAll('.tag').forEach(function (tag) {
          tag.onclick = function (e) {
            e.stopPropagation();
            var note = notes.filter(function (row) { return row.id === card.getAttribute('data-stick'); })[0];
            if (!note) return;
            note.meta = note.meta || {};
            if (tag.hasAttribute('data-stick-pin')) note.meta.pin = !note.meta.pin;
            else {
              var order = ['idea', 'todo', 'person', 'decision', ''];
              note.meta.kind = order[(order.indexOf(note.meta.kind || '') + 1) % order.length];
            }
            patchMeta(note);
            paint(notes);
          };
        });
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
          if (e.target.closest('textarea,button,select,input,label')) return;
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
    authFetch('/api/notes/sticky', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (data) { STATE.stickies = data.notes || []; paint(STATE.stickies); if (typeof renderNotes === 'function') renderNotes(); }).catch(function () { paint([]); var board = document.getElementById('stickBoard'); if (board) board.insertAdjacentHTML('afterbegin', '<div class="soft-err">Notes could not load. A new note still stays on this board.</div>'); });
  }
  document.addEventListener('click', function (e) {
    var link = e.target.closest('a[target="_blank"]');
    if (!link) return;
    var href = link.getAttribute('href') || '';
    if (/linkedin\.com/i.test(href)) return;
    e.preventDefault();
    openDocView(link.textContent || 'Link', href, '');
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

  function alarmPrefs() {
    var on = true;
    var lead = 10;
    try {
      var raw = JSON.parse(localStorage.getItem('cr_alarm') || '{}');
      if (raw && raw.on === false) on = false;
      if (raw && (raw.lead === 5 || raw.lead === 10 || raw.lead === 15)) lead = raw.lead;
    } catch (err) {}
    return { on: on, lead: lead };
  }
  function saveAlarmPrefs(next) {
    try { localStorage.setItem('cr_alarm', JSON.stringify(next)); } catch (err) {}
  }
  function muteMap() {
    try {
      var raw = JSON.parse(localStorage.getItem('cr_alarm_mute') || '{}');
      return raw && typeof raw === 'object' ? raw : {};
    } catch (err) { return {}; }
  }
  function alarmMuted(id) {
    return !!(STATE.alarmMute && STATE.alarmMute[id]);
  }
  function persistMutes() {
    try { localStorage.setItem('cr_alarm_mute', JSON.stringify(STATE.alarmMute || {})); } catch (err) {}
  }
  function alarmMeetLine(ev, withWhen) {
    var muted = alarmMuted(ev.id);
    var when = withWhen
      ? ((typeof fmtTime === 'function' ? fmtTime(ev.start) : ''))
      : soon(ev.start);
    if (withWhen) when = new Date(ev.start).toLocaleDateString(undefined, { weekday: 'short' }) + (when ? ' ' + when : '');
    return '<div class="meet-row"><button type="button" class="mute-bell' + (muted ? ' on' : '') + '" data-mute-meet="' + esc(ev.id) + '" title="' + (muted ? 'Alarm off' : 'Silence this meeting') + '" aria-label="' + (muted ? 'Unmute alarm' : 'Mute alarm') + '">' + (muted ? 'Alarm off' : 'Alarm') + '</button><span class="ttl">' + esc(ev.title || 'Meeting') + '</span><span class="mt">' + esc(when) + '</span></div>';
  }
  function paintMeetViews() {
    if ((STATE.desk === 'room' || !STATE.desk) && typeof renderOpsDash === 'function') renderOpsDash();
    if (STATE.desk === 'war' && typeof renderWar === 'function') renderWar();
    if (typeof renderTodayPop === 'function') renderTodayPop();
    if (typeof paintCal === 'function') paintCal();
  }
  function toggleMeetMute(id) {
    if (!id) return;
    STATE.alarmMute = STATE.alarmMute || muteMap();
    if (STATE.alarmMute[id]) delete STATE.alarmMute[id];
    else STATE.alarmMute[id] = 1;
    persistMutes();
    paintMeetViews();
    authFetch('/api/alarms', { method: 'POST', credentials: 'same-origin', quiet: true, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ eventId: id, muted: !!STATE.alarmMute[id] }) }).catch(function () {});
  }
  function alarmCtx() {
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    if (!playBubble.ctx) playBubble.ctx = new Ctx();
    if (playBubble.ctx.state === 'suspended') playBubble.ctx.resume();
    return playBubble.ctx;
  }
  function playLongNote() {
    try {
      var ctx = alarmCtx();
      if (!ctx) return;
      var t0 = ctx.currentTime;
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, t0);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.22, t0 + 0.08);
      gain.gain.setValueAtTime(0.22, t0 + 1.0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 1.22);
    } catch (err) {}
  }
  function playBubble() {
    try {
      var ctx = alarmCtx();
      if (!ctx) return;
      var t0 = ctx.currentTime;
      [0, 0.3, 0.6, 0.9, 1.2].forEach(function (offset) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, t0 + offset);
        osc.frequency.exponentialRampToValueAtTime(900, t0 + offset + 0.25);
        gain.gain.setValueAtTime(0.0001, t0 + offset);
        gain.gain.exponentialRampToValueAtTime(0.28, t0 + offset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + offset + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t0 + offset);
        osc.stop(t0 + offset + 0.26);
      });
    } catch (err) {}
  }
  var alarmArmed = false;
  function armAlarm() {
    if (alarmArmed) return;
    alarmArmed = true;
    try { alarmCtx(); } catch (err) {}
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      try { Notification.requestPermission(); } catch (err) {}
    }
  }
  document.addEventListener('pointerdown', armAlarm, { once: true });
  document.addEventListener('keydown', armAlarm, { once: true });
  function firedSet() {
    try {
      var raw = JSON.parse(localStorage.getItem('cr_alarm_fired') || '{}');
      var day = laDay(Date.now());
      if (raw.day !== day) return { day: day, ids: {} };
      return { day: day, ids: raw.ids || {} };
    } catch (err) { return { day: laDay(Date.now()), ids: {} }; }
  }
  function whenLine(ev) {
    try {
      return new Date(ev.start).toLocaleTimeString('en-GB', { timeZone: 'America/Vancouver', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    } catch (err) { return ''; }
  }
  function showMeetAlarm(ev, lead) {
    var box = document.getElementById('meetAlarm');
    if (!box) return;
    var join = /^https?:\/\//i.test(ev.join || '') ? ev.join : '';
    box.innerHTML = '<div class="tx"><div class="t">Meeting in ' + lead + ' min - ' + esc(ev.title || 'Meeting') + '</div><div class="s">' + esc(whenLine(ev)) + '</div></div>' + (join ? '<button type="button" class="btn pri sm" data-join-meet="' + esc(join) + '">Join</button>' : '') + '<button type="button" class="btn sm" data-dismiss-alarm>Dismiss</button>';
    box.hidden = false;
  }
  function tickAlarms() {
    var prefs = alarmPrefs();
    if (!prefs.on) return;
    var now = Date.now();
    var fired = firedSet();
    var stages = [{ id: '10', min: 10, kind: 'long' }, { id: '5', min: 5, kind: 'bubble' }, { id: '3', min: 3, kind: 'bubble' }];
    (STATE.events || []).forEach(function (ev) {
      if (!ev || !ev.id || alarmMuted(ev.id)) return;
      var left = ev.start - now;
      if (left < -30000 || left > 10 * 60 * 1000 + 15000) return;
      stages.forEach(function (stage, i) {
        var key = ev.id + ':' + stage.id;
        if (fired.ids[key]) return;
        var minMs = stage.min * 60 * 1000;
        var nextMs = stages[i + 1] ? stages[i + 1].min * 60 * 1000 : -30000;
        if (left > minMs + 15000 || left <= nextMs) return;
        fired.ids[key] = 1;
        try { localStorage.setItem('cr_alarm_fired', JSON.stringify(fired)); } catch (err) {}
        showMeetAlarm(ev, stage.min);
        if (alarmArmed) {
          if (stage.kind === 'long') playLongNote();
          else playBubble();
        }
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          try {
            var note = new Notification('Meeting in ' + stage.min + ' min - ' + (ev.title || 'Meeting'), { body: whenLine(ev), silent: false });
            note.onclick = function () { window.focus(); };
          } catch (err) {}
        }
      });
    });
  }
  function pollCalAlarms() {
    var from = new Date(Date.now() - 3600000).toISOString();
    var to = new Date(Date.now() + 6 * 3600000).toISOString();
    authFetch('/api/calendar?from=' + encodeURIComponent(from) + '&to=' + encodeURIComponent(to), { credentials: 'same-origin', quiet: true }).then(function (r) { return r.json(); }).then(function (data) {
      if (!data || !Array.isArray(data.events) || !data.events.length) return;
      var byId = {};
      (STATE.events || []).forEach(function (ev) { if (ev && ev.id) byId[ev.id] = ev; });
      data.events.forEach(function (ev) { if (ev && ev.id) byId[ev.id] = ev; });
      STATE.events = Object.keys(byId).map(function (key) { return byId[key]; });
      tickAlarms();
    }).catch(function () {});
  }
  function alarmSettingsHtml() {
    var prefs = alarmPrefs();
    return '<div class="alarm-set"><div class="lab">Meeting alarm</div><div class="sub">T-10 one long note, then Bubble five times at T-5 and T-3. Mute any event from the list. Master off stops every alert. No sound until you click once on this page.</div><div class="row"><label><input type="checkbox" id="alarmOn"' + (prefs.on ? ' checked' : '') + '/> Alarm on</label><button type="button" class="btn sm" id="alarmTestLong">Test long note</button><button type="button" class="btn sm" id="alarmTest">Test Bubble</button></div></div>';
  }
  function bindAlarmSettings() {
    var on = document.getElementById('alarmOn');
    var test = document.getElementById('alarmTest');
    var long = document.getElementById('alarmTestLong');
    if (on) on.onchange = function () { var prefs = alarmPrefs(); prefs.on = !!on.checked; saveAlarmPrefs(prefs); };
    if (test) test.onclick = function () { armAlarm(); playBubble(); };
    if (long) long.onclick = function () { armAlarm(); playLongNote(); };
  }
  function bootAlarms() {
    STATE.alarmMute = STATE.alarmMute || muteMap();
    authFetch('/api/alarms', { credentials: 'same-origin', quiet: true }).then(function (r) { return r.json(); }).then(function (data) {
      if (!data || !Array.isArray(data.muted)) return;
      var map = muteMap();
      data.muted.forEach(function (id) { map[id] = 1; });
      STATE.alarmMute = map;
      persistMutes();
      paintMeetViews();
      tickAlarms();
    }).catch(function () {});
    if (bootAlarms.done) { tickAlarms(); return; }
    bootAlarms.done = true;
    setInterval(tickAlarms, 15000);
    setInterval(pollCalAlarms, 60000);
    tickAlarms();
  }
  document.addEventListener('click', function (e) {
    var mute = e.target.closest && e.target.closest('[data-mute-meet]');
    if (mute) {
      e.preventDefault();
      e.stopPropagation();
      toggleMeetMute(mute.getAttribute('data-mute-meet'));
      return;
    }
    var join = e.target.closest && e.target.closest('[data-join-meet]');
    if (join) {
      e.preventDefault();
      var url = join.getAttribute('data-join-meet') || '';
      if (/^https?:\/\//i.test(url)) window.open(url, '_blank', 'noopener');
      return;
    }
    var dismiss = e.target.closest && e.target.closest('[data-dismiss-alarm]');
    if (dismiss) {
      var box = document.getElementById('meetAlarm');
      if (box) box.hidden = true;
    }
  });
  window.alarmMeetLine = alarmMeetLine;
  window.alarmMuted = alarmMuted;
  window.alarmSettingsHtml = alarmSettingsHtml;
  window.bindAlarmSettings = bindAlarmSettings;
  window.bootAlarms = bootAlarms;
  window.saveItem = saveItem;
  window.renderWar = renderWar;
  window.renderOpsDash = renderOpsDash;
  window.renderNews = renderNews;
  window.runNewsSweep = runNewsSweep;
  window.__newsHandle = newsHandle;
  window.__newsHelpers = { why: newsWhy, source: newsSource, ts: newsTs, cat: newsCat, keep: newsKeep, open: newsOpen, toSpace: newsToSpace, host: newsHost };
  window.openReply = openReply;
  window.hideSender = hideSender;
  window.setShowMoney = setShowMoney;
  window.showMoney = showMoney;
  if (document.getElementById('opsDash')) renderOpsDash();
})();
