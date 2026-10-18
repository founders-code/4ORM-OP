(function(){
  var VIEW='week';
  var CURSOR=new Date();
  var START_H=7;
  var END_H=20;
  var PX=48;
  var dropped={};

  function laDay(ms){
    return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(ms));
  }
  function laParts(ms){
    var bag={};
    new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',weekday:'short',hourCycle:'h23'}).formatToParts(new Date(ms)).forEach(function(p){if(p.type!=='literal')bag[p.type]=p.value;});
    return bag;
  }
  function isoWeek(day){
    var p=day.split('-').map(Number);
    var utc=new Date(Date.UTC(p[0],p[1]-1,p[2]));
    utc.setUTCDate(utc.getUTCDate()+4-(utc.getUTCDay()||7));
    var yearStart=new Date(Date.UTC(utc.getUTCFullYear(),0,1));
    return Math.ceil(((utc.getTime()-yearStart.getTime())/86400000+1)/7);
  }
  function monday(day){
    var p=day.split('-').map(Number);
    var utc=new Date(Date.UTC(p[0],p[1]-1,p[2]));
    var dow=utc.getUTCDay()||7;
    utc.setUTCDate(utc.getUTCDate()-(dow-1));
    return utc.toISOString().slice(0,10);
  }
  function addDays(day,n){
    var p=day.split('-').map(Number);
    return new Date(Date.UTC(p[0],p[1]-1,p[2]+n)).toISOString().slice(0,10);
  }
  function hue(title){
    var t=String(title||'').toLowerCase();
    if(/invest|raise|cheque|vc |angel/.test(t)) return 'gold';
    if(/bill|pay|invoice|rent/.test(t)) return 'violet';
    if(/launch|milestone|4ormiq|drop/.test(t)) return 'lime';
    if(/holiday/.test(t)) return 'teal';
    return '';
  }
  function weekDist(start){
    var today=laDay(Date.now());
    var thisMon=monday(today);
    var diff=Math.round((Date.parse(start+'T12:00:00Z')-Date.parse(thisMon+'T12:00:00Z'))/604800000);
    if(diff===-2) return '2 weeks ago';
    if(diff===-1) return 'last week';
    if(diff===0) return 'this week';
    if(diff===1) return 'next week';
    if(diff>1) return diff+' weeks out';
    return Math.abs(diff)+' weeks ago';
  }
  function monthGold(start){
    var today=new Date(laDay(Date.now())+'T12:00:00Z');
    for(var n=1;n<=3;n++){
      var mark=new Date(today); mark.setUTCMonth(mark.getUTCMonth()+n);
      var day=mark.toISOString().slice(0,10);
      if(day>=start && day<=addDays(start,6)) return n+' month'+(n>1?'s':'')+' out';
    }
    return '';
  }
  function minsOnDay(ms){
    var p=laParts(ms);
    return Number(p.hour)*60+Number(p.minute);
  }

  function parseQuick(raw){
    var text=String(raw||'').trim();
    if(!text) return null;
    if(/^remind me to /i.test(text)) return {task:text.replace(/^remind me to /i,'')};
    var days={sun:0,mon:1,tue:2,wed:3,thu:4,fri:5,sat:6};
    var hit=text.match(/\b(sun|mon|tue|wed|thu|fri|sat|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i);
    var tm=text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
    var now=new Date();
    var start=new Date(now);
    if(hit){
      var want=days[hit[1].slice(0,3).toLowerCase()];
      var dow=now.getDay();
      var add=(want-dow+7)%7; if(!add) add=7;
      start.setDate(now.getDate()+add);
    }
    var hour=9, minute=0;
    if(tm){
      hour=Number(tm[1]); minute=Number(tm[2]||0);
      if(/pm/i.test(tm[3])&&hour<12) hour+=12;
      if(/am/i.test(tm[3])&&hour===12) hour=0;
    }
    start.setHours(hour,minute,0,0);
    var title=text.replace(/\b(sun|mon|tue|wed|thu|fri|sat|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/ig,'').replace(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/ig,'').replace(/\s+/g,' ').trim();
    return {title:title||'Hold', start:start.getTime(), dur:30};
  }

  function suggestions(events){
    var out=[];
    if(dropped.all) return out;
    var today=laDay(Date.now());
    for(var i=0;i<14;i++){
      var day=addDays(today,i);
      var p=day.split('-').map(Number);
      var utc=new Date(Date.UTC(p[0],p[1]-1,p[2]));
      var dow=utc.getUTCDay();
      if(dow===0||dow===6) continue;
      var busy=(events||[]).filter(function(ev){return laDay(ev.start)===day;}).map(function(ev){return {a:minsOnDay(ev.start),b:minsOnDay(ev.start)+Number(ev.dur||30)};});
      busy.push({a:9*60,b:9*60+30});
      function free(a,len){
        var b=a+len;
        return !busy.some(function(x){return a<x.b && b>x.a;});
      }
      function add(title,hour,dur,color){
        if(dropped[day+'|'+title]) return;
        var a=hour*60;
        if(!free(a,dur)) return;
        var start=Date.parse(day+'T'+String(hour).padStart(2,'0')+':00:00-07:00');
        out.push({day:day,title:title,start:start,dur:dur,color:color||'#2E6BF2'});
        busy.push({a:a,b:a+dur});
      }
      add('Video + inbox',7,60,'#7a5bd0');
      add('One move',9,30,'#1f5fff');
      if(dow===2) add('Chase cold',11,45,'#e0483a');
      if(dow===3) add('Speer sync',11,45,'#0f8a8a');
      if(dow===4) add('Metrics snapshot',11,45,'#1f5fff');
      if(dow===5) add('Weekly review',11,45,'#0b1f55');
      add('Outreach block',15,60,'#1a9d5a');
      add('Post clip + engage',16,30,'#c79a3a');
      add('Shutdown',17,15,'#44506a');
    }
    return out;
  }

  function eventBox(ev, dash){
    var top=Math.max(0,(minsOnDay(ev.start)-START_H*60)/60*PX);
    var h=Math.max(PX/2,(Number(ev.dur||30)/60)*PX);
    var cls='cal-ev '+(dash?'dash ':hue(ev.title));
    var tm=laParts(ev.start);
    var label=(Number(tm.hour)%12||12)+(Number(tm.minute)?':'+tm.minute:'')+' '+esc(ev.title);
    return '<div class="'+cls+'" style="top:'+top+'px;height:'+h+'px" title="'+esc(ev.title)+'"><span class="tm"></span>'+esc(String(ev.title||'')).slice(0,42)+'</div>';
  }

  function paintWeek(events, plays){
    var today=laDay(Date.now());
    var start=monday(addDays(today,-21));
    var html='';
    for(var w=0;w<18;w++){
      var mon=addDays(start,w*7);
      var dist=weekDist(mon);
      var gold=monthGold(mon);
      var days=[];
      for(var d=0;d<7;d++) days.push(addDays(mon,d));
      var cells=days.map(function(day){
        var list=(events||[]).filter(function(ev){return laDay(ev.start)===day && Number(laParts(ev.start).hour)>=START_H;});
        var extra=(plays||[]).filter(function(ev){return ev.day===day;});
        var now='';
        if(day===today){
          var mins=minsOnDay(Date.now());
          now='<div class="cal-now" style="top:'+((mins-START_H*60)/60*PX)+'px"></div>';
        }
        return '<div class="cal-cell'+(day===today?' today':'')+'">'+now+list.map(function(ev){return eventBox(ev,false);}).join('')+extra.map(function(ev){return eventBox(ev,true);}).join('')+'</div>';
      }).join('');
      html+='<div class="cal-week" data-week="'+mon+'"><div class="cal-wlab">CW '+isoWeek(mon)+' - '+esc(mon.slice(5))+' · '+esc(addDays(mon,6).slice(5))+' <span class="pill'+(dist==='this week'?' this':'')+'">'+esc(dist)+'</span>'+(gold?' <span class="pill gold">'+esc(gold)+'</span>':'')+'</div><div class="cal-grid"><div></div>'+days.map(function(day){return '<div class="cal-allday">'+esc(day.slice(8))+'</div>';}).join('')+'<div></div>'+cells+'</div></div>';
    }
    return html;
  }

  function paintMonth(events){
    var y=CURSOR.getFullYear(), m=CURSOR.getMonth();
    var first=new Date(y,m,1);
    var start=new Date(first); start.setDate(1- ((first.getDay()+6)%7));
    var cells='';
    for(var i=0;i<42;i++){
      var dt=new Date(start); dt.setDate(start.getDate()+i);
      var day=laDay(dt);
      var list=(events||[]).filter(function(ev){return laDay(ev.start)===day;}).slice(0,3);
      var more=Math.max(0,(events||[]).filter(function(ev){return laDay(ev.start)===day;}).length-3);
      cells+='<div class="cal-mcell'+(day===laDay(Date.now())?' today':'')+'"><b>'+dt.getDate()+'</b>'+list.map(function(ev){return '<div>'+esc(ev.title).slice(0,22)+'</div>';}).join('')+(more?'<div>'+more+' more...</div>':'')+'</div>';
    }
    return '<div class="cal-mgrid">'+cells+'</div>';
  }

  function paintYear(){
    var y=CURSOR.getFullYear();
    var months='';
    for(var m=0;m<12;m++){
      months+='<div class="cal-tile pb-tile"><div class="t">'+new Date(y,m,1).toLocaleDateString('en-US',{month:'short'})+'</div><div class="s">dots mark days with meetings</div></div>';
    }
    return '<div class="cal-yp">'+months+'</div>';
  }

  function nextUp(events){
    var now=Date.now();
    var hit=(events||[]).filter(function(ev){return ev.start>=now;}).sort(function(a,b){return a.start-b.start;})[0];
    if(!hit) return '<div class="cal-next"><div class="t">Next up</div><div class="s">No upcoming meetings in this window.</div></div>';
    return '<div class="cal-next"><div class="t">'+esc(hit.title)+'</div><div class="s">Next meeting · prep from the War Room one-move.</div><button class="btn sm" type="button" data-cal-prep>Prep</button> '+(hit.join?'<a class="btn sm" href="'+esc(hit.join)+'" target="_blank" rel="noopener noreferrer">Open</a>':'')+'</div>';
  }

  function renderCal(){
    var el=document.getElementById('calDesk');
    if(!el) return;
    var events=STATE.calEvents||[];
    var plays=VIEW==='week'?suggestions(events):[];
    var title='CW '+isoWeek(laDay(CURSOR.getTime()))+' · '+CURSOR.toLocaleDateString('en-US',{month:'long'})+' <span class="y">'+CURSOR.getFullYear()+'</span>';
    var p=laParts(Date.now());
    var ribbonLeft=((Number(p.hour)+Number(p.minute)/60-7)/13)*100;
    var body=VIEW==='month'?paintMonth(events):(VIEW==='year'?paintYear():paintWeek(events,plays));
    el.innerHTML='<aside class="cal-side"><div class="iq-mark"><b>4</b><span>ormIQ</span></div><input id="calQuick" placeholder="Coffee with Bruce Tue 3pm"/><div class="cal-mini" id="calMini"></div><div class="cal-ribbon"><i style="left:10%;width:18%"></i><i class="now" style="left:'+Math.max(0,Math.min(100,ribbonLeft))+'%"></i></div>'+nextUp(events)+'<div><div class="s" style="font-size:11px;color:#9db0d0;margin-bottom:6px">Next week\'s shape</div><div class="cal-shape"><i style="width:40%;background:#5b8cff"></i><i style="width:20%;background:#1f5fff"></i><i style="width:15%;background:#17b86a"></i><i style="width:25%;background:#1a2744"></i></div></div><div class="cal-tog"><label><input type="checkbox" checked> Meetings</label><label><input type="checkbox" checked> Investors & raise</label><label><input type="checkbox" checked> Payments & bills</label><label><input type="checkbox" checked> Milestones</label><label><input type="checkbox" checked> Playbook plays</label></div></aside>'+
      '<div class="cal-main"><div class="cal-bar"><button class="btn sm" type="button" id="calPrev">&lt;</button><button class="btn sm" type="button" id="calJump">Today</button><button class="btn sm" type="button" id="calNext">&gt;</button><h2>'+title+'</h2><div class="cal-views">'+['Day','Week','Month','Quarter','Year'].map(function(name){var k=name.toLowerCase();return '<button type="button" class="'+(VIEW===k?'on':'')+'" data-cal-view="'+k+'">'+name+'</button>';}).join('')+'</div><button class="cal-book" type="button" id="calShare">Share booking link</button></div>'+(plays.length?'<div class="cal-plan">4orm Intelligence fitted '+plays.length+' plays around meetings. <button class="btn sm" type="button" id="calAccept">Accept all</button> <button class="btn sm" type="button" id="calReplan">Re-plan</button></div>':'')+'<div id="calBody">'+body+'</div></div>';
    var mini=document.getElementById('calMini');
    if(mini){
      mini.innerHTML=['M','T','W','T','F','S','S'].map(function(x){return '<b>'+x+'</b>';}).join('')+Array.from({length:35}).map(function(_,i){return '<span>'+(i+1>31?'':(i+1))+'</span>';}).join('');
    }
  }

  function loadCalendarPage(){
    var from=new Date(); from.setDate(from.getDate()-28);
    var to=new Date(); to.setDate(to.getDate()+90);
    authFetch('/api/calendar?from='+encodeURIComponent(from.toISOString())+'&to='+encodeURIComponent(to.toISOString()),{credentials:'same-origin'}).then(function(r){return r.json();}).then(function(d){
      STATE.calEvents=d&&d.events||[];
      renderCal();
      var body=document.getElementById('calBody');
      var next=body&&body.querySelector('[data-week="'+monday(addDays(laDay(Date.now()),7))+'"]');
      if(next) next.scrollIntoView({block:'start'});
    }).catch(function(){STATE.calEvents=[];renderCal();});
  }

  function createHold(item){
    if(item.task){
      authFetch('/api/items',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({title:item.task,bucket:'today'})}).catch(function(){});
      return;
    }
    authFetch('/api/calendar',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({title:item.title,start:item.start,dur:item.dur||30})}).then(function(){loadCalendarPage();}).catch(function(){});
  }

  document.addEventListener('click',function(e){
    var view=e.target.closest&&e.target.closest('[data-cal-view]');
    if(view){VIEW=view.getAttribute('data-cal-view');renderCal();return;}
    if(e.target.id==='calJump'){CURSOR=new Date();renderCal();return;}
    if(e.target.id==='calPrev'){CURSOR.setDate(CURSOR.getDate()-7);renderCal();return;}
    if(e.target.id==='calNext'){CURSOR.setDate(CURSOR.getDate()+7);renderCal();return;}
    if(e.target.id==='calShare'){
      var url=location.origin+'/chad';
      if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(url);
      if(typeof deskNote==='function') deskNote('Booking link copied');
      return;
    }
    if(e.target.id==='calAccept'){
      var plays=suggestions(STATE.calEvents||[]);
      plays.slice(0,8).forEach(function(p){createHold(p);});
      return;
    }
    if(e.target.id==='calReplan'){dropped={};renderCal();return;}
    if(e.target.getAttribute&&e.target.getAttribute('data-cal-prep')) switchView('war');
  });
  document.addEventListener('keydown',function(e){
    if(e.key!=='Enter') return;
    if(e.target&&e.target.id==='calQuick'){
      var item=parseQuick(e.target.value);
      e.target.value='';
      if(item) createHold(item);
    }
  });

  window.loadCalendarPage=loadCalendarPage;
})();
