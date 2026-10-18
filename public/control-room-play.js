(function(){
  var ROOM={war:'War Room',room:'Dashboard',contacts:'Pipeline',work:'Spaces',mail:'Email',news:'News',people:'Contacts',done:'Completed'};
  var DAYS=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  var pop=null;

  function pacificDay(){
    return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  }
  function daysTo(iso){
    var a=Date.parse(pacificDay()+'T12:00:00Z');
    var b=Date.parse(iso+'T12:00:00Z');
    return Math.max(0, Math.round((b-a)/86400000));
  }
  function padLabel(row, pad){
    if(pad.state==='missed') return 'x';
    if(pad.state==='due'){
      if(row.target==='5') return '5';
      if(/reach/i.test(row.name)) return '5';
      if(/engage/i.test(row.name)) return '2/5';
      if(/inbox/i.test(row.name)) return 'GO';
      if(/news/i.test(row.name)) return 'GO';
      return 'GO';
    }
    return '';
  }
  function closePop(){ if(pop&&pop.parentNode)pop.parentNode.removeChild(pop); pop=null; }

  function renderPlay(d){
    var el=document.getElementById('playDesk');
    if(!el) return;
    STATE.playbook=d||STATE.playbook||{rows:[],days:[],todayLit:0,score:0};
    d=STATE.playbook;
    var today=d.today||pacificDay();
    var lit=Number(d.todayLit||0);
    var runLabel=lit?('Run today\'s plays - '+lit+' lit'):'All lights off - day done';
    var heads=DAYS.map(function(name,i){
      var day=(d.days||[])[i]||'';
      return '<div class="pb-dayh'+(day===today?' on':'')+'">'+name+'</div>';
    }).join('');
    var rows=(d.rows||[]).map(function(row){
      var pads=(row.pads||[]).map(function(pad){
        var cls=pad.state==='due'?'due':(pad.state==='missed'?'missed':(pad.state==='empty'?'empty':'dim '+pad.state));
        var bg=pad.state==='empty'?'':('background:'+row.color);
        return '<button type="button" class="pb-pad '+cls+'" style="'+bg+'" data-pb-pad="'+esc(row.id)+'" data-day="'+esc(pad.day)+'" data-state="'+esc(pad.state)+'">'+esc(padLabel(row,pad))+'</button>';
      }).join('');
      return '<div class="pb-rowname"><span class="pb-sw" style="background:'+esc(row.color)+'"></span><div><div class="nm">'+esc(row.name)+'</div><button type="button" class="go" data-pb-room="'+esc(row.route)+'">'+(ROOM[row.route]||'Room')+' →</button></div></div>'+pads+'<div class="pb-streak">'+(row.target||'')+'</div>';
    }).join('');
    var iqDays=daysTo('2026-10-23');
    el.innerHTML='<div class="pb-head"><button class="pb-calbtn" type="button" id="pbMonth" aria-label="Month stack">▦</button><h2>Playbook</h2><span class="pb-week">'+esc(d.weekLabel||'')+'</span><button class="pb-run'+(lit?'':' off')+'" type="button" id="pbRun">'+esc(runLabel)+'</button><div class="pb-score"><b>'+esc(String(d.score||0))+'%</b> week on beat</div></div>'+
      '<div class="pb-grid"><div></div>'+heads+'<div class="pb-dayh">Streak</div>'+rows+'</div>'+
      '<button class="pb-add" type="button" id="pbAdd">+ Add a rhythm</button>'+
      '<div class="pb-beats"><div class="pb-tile"><div class="t">4ormIQ - 1,000 users</div><div class="s">Launch Oct 23 · '+iqDays+' days · needed pace from live users</div><div class="pb-bar"><i style="width:2%"></i></div></div>'+
      '<div class="pb-tile"><div class="t">Marketing drop</div><div class="s">Every 14 days</div></div>'+
      '<div class="pb-tile"><div class="t">Newsletter</div><div class="s">Monthly</div></div>'+
      '<div class="pb-tile"><div class="t">Research paper</div><div class="s">Monthly</div></div>'+
      '<div class="pb-tile"><div class="t">Investor update</div><div class="s">Monthly</div></div>'+
      '<div class="pb-tile"><div class="t">Investor letter</div><div class="s">Quarterly</div></div></div>';
  }

  function loadPlaybook(){
    authFetch('/api/playbook',{credentials:'same-origin'}).then(function(r){return r.json();}).then(function(d){renderPlay(d);}).catch(function(){renderPlay(STATE.playbook||{rows:[]});});
  }

  function setPad(id, day, status){
    authFetch('/api/playbook',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({rhythmId:id,day:day,status:status})}).then(function(r){return r.json();}).then(function(d){closePop();renderPlay(d);}).catch(function(){closePop();});
  }

  function showPop(btn){
    closePop();
    var id=btn.getAttribute('data-pb-pad');
    var day=btn.getAttribute('data-day');
    var state=btn.getAttribute('data-state');
    var row=(STATE.playbook.rows||[]).filter(function(r){return r.id===id;})[0];
    if(!row) return;
    pop=document.createElement('div');
    pop.className='pb-pop';
    var room=ROOM[row.route]||'Room';
    var extra=state==='done'
      ? '<button type="button" data-pb-act="open">Turn back on</button>'
      : '<button type="button" data-pb-act="done">Mark done</button><button type="button" data-pb-act="snoozed">Snooze</button>';
    pop.innerHTML='<div class="t">'+esc(row.name)+' · '+esc(room)+'</div><button type="button" data-pb-act="go" style="background:'+esc(row.color)+';color:#fff">Go to '+esc(room)+' →</button>'+extra;
    document.body.appendChild(pop);
    var box=btn.getBoundingClientRect();
    pop.style.left=Math.min(box.left, window.innerWidth-220)+'px';
    pop.style.top=(box.bottom+8+window.scrollY)+'px';
    pop.addEventListener('click',function(e){
      var act=e.target.getAttribute('data-pb-act');
      if(act==='go'){closePop();switchView(row.route);}
      else if(act==='done') setPad(id,day,'done');
      else if(act==='snoozed') setPad(id,day,'snoozed');
      else if(act==='open') setPad(id,day,'open');
    });
  }

  function monthStack(){
    var wrap=document.createElement('div');
    wrap.className='pb-stack';
    wrap.innerHTML='<div class="box"><div class="pb-head"><h2>Month stack</h2><button class="btn sm" type="button" id="pbClose">Close</button></div><div id="pbMonths"></div></div>';
    document.body.appendChild(wrap);
    wrap.querySelector('#pbClose').onclick=function(){wrap.remove();};
    wrap.addEventListener('click',function(e){if(e.target===wrap)wrap.remove();});
    var host=wrap.querySelector('#pbMonths');
    var start=new Date(pacificDay()+'T12:00:00Z');
    for(var m=0;m<3;m++){
      var dt=new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth()+m, 1));
      var label=dt.toLocaleDateString('en-US',{month:'long',year:'numeric',timeZone:'UTC'});
      var block=document.createElement('div');
      block.className='pb-month';
      block.innerHTML='<h3>'+esc(label)+'</h3><div class="kick" style="color:#9db0d0">Milestones · 4ormIQ live Oct 23 · F&F close Oct 30</div>';
      host.appendChild(block);
    }
  }

  document.addEventListener('click',function(e){
    var pad=e.target.closest&&e.target.closest('[data-pb-pad]');
    if(pad){showPop(pad);return;}
    var room=e.target.closest&&e.target.closest('[data-pb-room]');
    if(room){switchView(room.getAttribute('data-pb-room'));return;}
    if(e.target.id==='pbMonth') monthStack();
    if(e.target.id==='pbRun'){
      var due=((STATE.playbook||{}).rows||[]).map(function(r){return (r.pads||[]).filter(function(p){return p.state==='due';})[0]?r:null;}).filter(Boolean)[0];
      if(due) switchView(due.route);
    }
    if(e.target.id==='pbAdd'){
      var name=prompt('Rhythm name');
      if(!name) return;
      authFetch('/api/playbook',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({name:name})}).then(function(r){return r.json();}).then(renderPlay).catch(function(){});
    }
    if(pop&&!e.target.closest('.pb-pop')&&!e.target.closest('[data-pb-pad]')) closePop();
  });

  window.loadPlaybook=loadPlaybook;
})();
