var NEWS_SEED=['Compliance','AI','Counseling','Fintech & regulation','Mortgage','Fraud & scams','Grants','Payments / FINTRAC','Competitors (Drata/Vanta/Aveni)','Design-partner targets (Century 21/Remax)','Fundraising / VC'];
var PLAN=null;
if(!STATE.newsCat) STATE.newsCat='All';

function zoneOfMove(m){
  var blob=String(m.text||'').toLowerCase();
  if(m.principle==='P4'||m.facing==='regulator'||/regulator|fcac|licen/.test(blob)) return 'regulator';
  if(m.principle==='P2'||/broker|design-partner|century|remax/.test(blob)||(m.area==='outreach'&&m.principle!=='P1')) return 'partner';
  return 'raise';
}
function planBtn(id,title,area){
  return '<button type="button" class="btn sm" data-plan="'+esc(id)+'" data-ptitle="'+esc(title||'')+'" data-parea="'+esc(area||'other')+'">Plan</button>';
}
function ageDays(value){
  if(value==null||value==='') return null;
  var ms=typeof value==='number'?value:Date.parse(String(value).slice(0,10)+'T12:00:00');
  if(!isFinite(ms)) return null;
  return Math.max(0,Math.floor((Date.now()-ms)/86400000));
}
function ageChip(days,late){
  if(days==null) return '';
  return '<span class="chip'+((late||days>=7)?' age-bad':'')+'">'+days+'d</span>';
}
function renderNow(){
  var el=document.getElementById('now');
  if(!el) return;
  function list(pred){return openItems().filter(pred).sort(function(a,b){return (a.due||1e15)-(b.due||1e15);});}
  function group(label,rows){
    var body=rows.length?rows.map(function(it){
      var late=it.due!=null&&days(it.due)<0;
      return '<div class="wrow"><div class="wt">'+esc(it.title)+'</div><span class="chip">'+esc(AREA_LABEL[it.area]||it.area)+'</span><span class="wd'+(late?' late':'')+'">'+esc(it.due?fmtDay(it.due):'No date')+'</span>'+planBtn('item:'+it.id,it.title,it.area)+'</div>';
    }).join(''):'<div class="wempty">Nothing here.</div>';
    return '<div class="wgroup"><div class="kick">'+label+'</div>'+body+'</div>';
  }
  var late=list(function(it){return bucket(it)==='overdue';});
  var today=list(function(it){return bucket(it)==='today';});
  var week=list(function(it){return bucket(it)==='week';});
  el.innerHTML='<div class="whead"><h3>Now</h3><button class="btn sm" type="button" id="nowRoad">Open roadmap</button></div>'+(late.length?group('Overdue',late):'')+group('Today',today)+group('This week',week);
}
function renderCeo(){
  var root=document.getElementById('ceoMoves');
  if(!root) return;
  var data=STATE.ceo||{lamps:[],moves:[]};
  var lamps=document.getElementById('warLamps');
  if(lamps) lamps.innerHTML=(data.lamps||[]).map(function(l){
    var name=(l.label||l.key||'').split(' ')[0];
    var tone=l.state==='red'?'bad':(l.state==='amber'?'warn':'');
    return '<button type="button" class="bb-lamp '+tone+'" data-lamp="'+esc(l.key)+'" title="'+esc(l.label)+'">'+esc(name+' '+l.word)+'</button>';
  }).join('');
  var shown=(data.lamps||[]).filter(function(l){return l.key===STATE.ceoLamp;})[0];
  var detail=document.getElementById('warDetail');
  if(detail) detail.textContent=shown?shown.detail:'';
  var moves=data.moves||[];
  var one=document.getElementById('ceoOne');
  if(one) one.textContent=moves.length?moves[0].text:'Reading the desk.';
  if(!moves.length){root.innerHTML='<div class="ceo-why">'+((data.lamps||[]).length?'Nothing new until the snooze ends.':'Reading the desk.')+'</div>';return;}
  var zones=[['raise','Raise'],['partner','Design partners'],['regulator','Regulator']];
  root.innerHTML=zones.map(function(zone){
    var rows=moves.filter(function(m){return zoneOfMove(m)===zone[0];});
    var body=rows.length?rows.map(function(m){
      var how=(m.how||[]).filter(function(step){return !!step;});
      var howHtml=how.length?'<details class="ceo-how"><summary>How</summary><ol>'+how.map(function(step){return '<li>'+esc(step)+'</li>';}).join('')+'</ol></details>':'';
      var stepsBtn=how.length?'<button type="button" class="btn sm" data-do-steps="'+esc(m.id)+'">Do all steps</button>':'';
      return '<div class="ceo-move"><div class="ceo-line">'+esc(m.text)+'</div><div><span class="chip">'+esc(m.whyNow||'')+'</span> <span class="chip">'+esc((m.principle||'')+' '+(m.principleLabel||''))+'</span></div>'+howHtml+'<div class="ceo-actions"><button type="button" class="btn pri sm" data-do="'+esc(m.id)+'">Do</button>'+stepsBtn+'<button type="button" class="btn sm" data-snooze="'+esc(m.id)+'">Not now</button><button type="button" class="btn sm" data-ask="'+esc(m.text)+'">Ask</button>'+planBtn('move:'+m.id,m.text,m.area)+'</div></div>';
    }).join(''):'<div class="wempty">Nothing live on this track.</div>';
    return '<div class="zone"><div class="zone-k">'+zone[1]+'</div>'+body+'</div>';
  }).join('');
}
function renderWar(){
  var metrics=document.getElementById('warMetrics');
  if(metrics){
    var next=openItems().filter(function(it){return it.due!=null;}).sort(function(a,b){return a.due-b.due;})[0];
    var openPipe=(STATE.contacts||[]).filter(function(c){return c.stage!=='committed'&&c.stage!=='lost';}).length;
    metrics.innerHTML='<div class="bb-cell"><div class="k">One metric</div><div class="v">Cash $100</div></div><div class="bb-cell bad"><div class="k">Runway</div><div class="v">~1 day</div></div><div class="bb-cell"><div class="k">Next due</div><div class="v">'+esc(next?fmtDay(next.due):'None')+'</div></div><div class="bb-cell"><div class="k">Pipeline</div><div class="v">'+openPipe+'</div></div>';
  }
  var bar=document.getElementById('raiseBar');
  if(bar){
    var left=Math.max(0,Math.round((Date.parse('2026-10-30T18:00:00Z')-Date.now())/86400000));
    bar.innerHTML='<span class="rn">Raise - Friends &amp; Family - survival track</span><div class="bar" aria-hidden="true"><span></span></div><span class="rs">$80K of $250K</span><span class="rs">$170K to go - 3/7 chunks - '+left+' days to Oct 30 - <b>~1 day runway</b></span>';
  }
  renderWaiting();
  renderSweep();
}
function noteById(id){return (STATE.zoomNotes||[]).filter(function(n){return n.id===id;})[0];}
function hiddenWait(key){return (STATE.resolvedWaiting||[]).indexOf(key)>=0;}
function closeBtn(itemId,key){
  var attrs=itemId?' data-close-item="'+esc(itemId)+'"':' data-close-key="'+esc(key||'')+'"';
  return '<button type="button" class="wclose"'+attrs+' aria-label="Done">\u00d7</button>';
}
function renderWaiting(){
  var us=document.getElementById('waitUs');
  var said=document.getElementById('saidCard');
  var them=document.getElementById('waitThem');
  if(!us||!said||!them) return;
  var rows=[];
  (STATE.commitments||[]).filter(function(c){return c.status==='open';}).forEach(function(c){
    var key='us:commit:'+c.id;
    if(hiddenWait(key)) return;
    var note=noteById(c.sourceNoteId);
    var who=(note&&(note.attendees||[]).filter(function(n){return n&&n.toLowerCase()!=='chad';})[0])||'Them';
    var age=ageDays(c.madeOn);
    rows.push({who:who,what:c.text,age:age,late:age!=null&&age>=7,plan:'commit:'+c.id,area:'follow_up',key:key});
  });
  openItems().filter(function(it){return it.source==='gmail';}).forEach(function(it){
    var age=ageDays(it.due);
    var late=it.due!=null&&days(it.due)<0;
    rows.push({who:'Mail',what:it.title,age:age,late:late,plan:'item:'+it.id,area:it.area,itemId:it.id});
  });
  openItems().filter(function(it){return it.source!=='gmail'&&(!it.owner||/^chad\b/i.test(it.owner));}).forEach(function(it){
    var hit=(STATE.contacts||[]).filter(function(c){return c.name&&c.name.length>2&&it.title.toLowerCase().indexOf(c.name.toLowerCase())>=0;})[0];
    if(!hit) return;
    var late=it.due!=null&&days(it.due)<0;
    rows.push({who:hit.name,what:it.title,age:ageDays(it.due),late:late,plan:'item:'+it.id,area:it.area,itemId:it.id});
  });
  us.innerHTML='<div class="whead"><h3>Waiting on us</h3></div>'+(rows.length?rows.map(function(row,i){
    return '<div class="wrow" data-peek="us:'+i+'"><div class="wt"><span class="chip">'+esc(row.who)+'</span> '+esc(row.what)+'</div>'+ageChip(row.age,row.late)+planBtn(row.plan,row.what,row.area)+closeBtn(row.itemId,row.key)+'</div>';
  }).join(''):'<div class="wempty">Nobody is blocked on you.</div>');
  STATE._waitUs=rows;
  var commits=(STATE.commitments||[]).filter(function(c){return c.status!=='done';});
  said.innerHTML='<div class="whead"><h3>You said you\'d do it</h3></div>'+(commits.length?commits.map(function(c){
    var note=noteById(c.sourceNoteId);
    var label=note?(fmtNoteDate(note.date)+' - '+note.title):'Note';
    return '<div class="wrow"><div class="wt">'+esc(c.text)+'</div><button type="button" class="chip" data-znote="'+esc(c.sourceNoteId)+'">'+esc(label)+'</button><button type="button" class="btn sm" data-commit-done="'+esc(c.id)+'">Done</button><button type="button" class="btn sm" data-commit-deck="'+esc(c.id)+'">To the deck</button>'+planBtn('commit:'+c.id,c.text,'follow_up')+'<button type="button" class="wclose" data-commit-done="'+esc(c.id)+'" aria-label="Done">\u00d7</button></div>';
  }).join(''):'<div class="wempty">No open commitments from the notes.</div>');
  var others=openItems().filter(function(it){return it.waitingOn||(it.status==='waiting'&&it.owner&&!/^chad\b/i.test(it.owner));});
  var flagForm=STATE.flagOpen?'<div class="wrow"><input id="flagItem" type="text" placeholder="Which open item" aria-label="Which open item"/><input id="flagWho" type="text" placeholder="Waiting on whom" aria-label="Waiting on whom"/><button class="btn sm pri" type="button" id="flagSave">Save flag</button></div>':'';
  them.innerHTML='<div class="whead"><h3>Waiting on others</h3><button class="btn sm" type="button" id="flagWait">Flag an item</button></div>'+flagForm+(others.length?others.map(function(it){
    var late=it.due!=null&&days(it.due)<0;
    var who=it.waitingOn||it.owner||'Someone';
    return '<div class="wrow" data-peek="them:'+esc(it.id)+'"><div class="wt">'+esc(it.title)+'</div><span class="chip">'+esc(who)+'</span>'+ageChip(ageDays(it.due),late)+planBtn('item:'+it.id,it.title,it.area)+closeBtn(it.id,'')+'</div>';
  }).join(''):'<div class="wempty">You are not blocked on anyone.</div>');
}
function renderSweep(){
  var el=document.getElementById('sweepCard');
  if(!el) return;
  var cats=(STATE.newsCategories&&STATE.newsCategories.length)?STATE.newsCategories:NEWS_SEED;
  var items=STATE.news||[];
  var filter=STATE.newsCat||'All';
  var shown=items.filter(function(item){return filter==='All'||item.category===filter;});
  var top=shown.filter(function(item){return item.isTop;})[0]||shown[0];
  var rest=shown.filter(function(item){return item!==top;});
  var chips='<button type="button" class="chip'+(filter==='All'?' on':'')+'" data-news="All">All</button>'+cats.map(function(cat){
    return '<button type="button" class="chip'+(filter===cat?' on':'')+'" data-news="'+esc(cat)+'">'+esc(cat)+'</button>';
  }).join('');
  var topHtml=top?'<div class="sweep-top"><div class="chip">'+esc(top.category)+'</div><div class="t">'+(top.url?'<a href="'+esc(top.url)+'" target="_blank" rel="noopener">'+esc(top.title)+'</a>':esc(top.title))+'</div><div class="s">'+esc(top.summary||'')+'</div></div>':'<div class="wempty">No sweep yet today.</div>';
  var list=rest.map(function(item){
    var title=item.url?'<a href="'+esc(item.url)+'" target="_blank" rel="noopener">'+esc(item.title)+'</a>':esc(item.title);
    return '<div class="news-row"><span class="chip">'+esc(item.category)+'</span><span>'+title+'</span></div>';
  }).join('');
  var editor=STATE.catEdit?'<div class="wrow"><textarea id="catBox" aria-label="Categories" style="width:100%;min-height:88px">'+esc(cats.join('\n'))+'</textarea><button class="btn sm pri" type="button" id="saveCats">Save categories</button></div>':'';
  el.innerHTML='<div class="whead"><h3>Daily sweep - news</h3><button class="btn sm" type="button" id="editCats">Edit categories</button></div>'+editor+'<div class="road-cats">'+chips+'</div>'+topHtml+list;
}
function paintPlan(){
  if(!PLAN) return;
  document.getElementById('planTitle').textContent=PLAN.title||'Plan';
  document.getElementById('planSteps').innerHTML=PLAN.steps.map(function(step,i){
    return '<div class="plan-step"><input type="checkbox" data-step-done="'+i+'"'+(step.done?' checked':'')+' aria-label="Step done"/><input type="text" data-step-text="'+i+'" value="'+esc(step.text)+'" aria-label="Step"/><button type="button" class="btn sm" data-step-up="'+i+'">Up</button><button type="button" class="btn sm" data-step-down="'+i+'">Down</button></div>';
  }).join('');
  document.getElementById('planNeeds').innerHTML=PLAN.needs.map(function(need,i){
    return '<div class="plan-need"><input type="text" data-need-text="'+i+'" value="'+esc(need)+'" aria-label="Thing needed"/></div>';
  }).join('');
  document.getElementById('planDraft').value=PLAN.draft||'';
}
function openPlan(id,title,area){
  var saved=(STATE.plans||[]).filter(function(p){return p.itemId===id;})[0];
  var steps=saved&&saved.steps&&saved.steps.length?saved.steps.map(function(step){return {text:step.text||step,done:!!step.done};}):[];
  if(String(id).indexOf('move:')===0){
    var move=((STATE.ceo&&STATE.ceo.moves)||[]).filter(function(m){return m.id===id.slice(5);})[0];
    if(!steps.length&&move&&move.how) steps=move.how.map(function(text){return {text:text,done:false};});
    if(!area&&move) area=move.area;
  }
  if(!steps.length) steps=[{text:'',done:false}];
  PLAN={itemId:id,title:title||'Plan',area:area||'other',steps:steps,needs:saved?saved.needs.slice():[],draft:saved?saved.draft||'':''};
  paintPlan();
  document.getElementById('planWin').hidden=false;
}
function closePlan(){document.getElementById('planWin').hidden=true;}
function readPlanFields(){
  if(!PLAN) return;
  document.querySelectorAll('[data-step-text]').forEach(function(input){
    var i=+input.getAttribute('data-step-text');
    if(PLAN.steps[i]) PLAN.steps[i].text=input.value;
  });
  document.querySelectorAll('[data-need-text]').forEach(function(input){
    var i=+input.getAttribute('data-need-text');
    PLAN.needs[i]=input.value;
  });
  PLAN.draft=document.getElementById('planDraft').value;
}
function openPeek(title,body,planId,planTitle,area){
  document.getElementById('drawer').innerHTML='<div class="dh"><div style="flex:1;font-weight:700;color:var(--tx)">'+esc(title)+'</div><button class="x" id="dClose" type="button">\u00d7</button></div><div class="db"><div class="v">'+esc(body)+'</div><div style="margin-top:12px"><button class="btn pri" type="button" id="peekPlan">Plan this</button></div></div>';
  openDrawer();
  document.getElementById('dClose').onclick=closeDrawer;
  document.getElementById('peekPlan').onclick=function(){openPlan(planId,planTitle,area);};
}
var _renderRoom=renderRoom;
renderRoom=function(){_renderRoom();renderWar();};
document.getElementById('v-war').addEventListener('click',function(e){
  var closeItem=e.target.closest('[data-close-item]');
  if(closeItem){resolveItem(closeItem.getAttribute('data-close-item'));return;}
  var closeKey=e.target.closest('[data-close-key]');
  if(closeKey){resolveKey(closeKey.getAttribute('data-close-key'));return;}
  var plan=e.target.closest('[data-plan]');
  if(plan){openPlan(plan.getAttribute('data-plan'),plan.getAttribute('data-ptitle'),plan.getAttribute('data-parea'));return;}
  var peek=e.target.closest('[data-peek]');
  if(peek){
    var key=peek.getAttribute('data-peek');
    if(key.indexOf('us:')===0){
      var row=(STATE._waitUs||[])[+key.slice(3)];
      if(row) openPeek(row.who,row.what,row.plan,row.what,row.area);
    } else if(key.indexOf('them:')===0){
      var it=STATE.items.filter(function(item){return item.id===key.slice(5);})[0];
      if(it) openPeek(it.waitingOn||it.owner||'Waiting',it.title,'item:'+it.id,it.title,it.area);
    }
    return;
  }
  var done=e.target.closest('[data-commit-done]');
  if(done){commitAct(done.getAttribute('data-commit-done'),'done');return;}
  var deck=e.target.closest('[data-commit-deck]');
  if(deck){commitAct(deck.getAttribute('data-commit-deck'),'deck');return;}
  var note=e.target.closest('[data-znote]');
  if(note){switchView('znotes');openZoom(note.getAttribute('data-znote'));return;}
  var chip=e.target.closest('[data-news]');
  if(chip){STATE.newsCat=chip.getAttribute('data-news');renderSweep();return;}
  if(e.target.id==='nowRoad'){openRoadmap();return;}
  if(e.target.id==='editCats'){STATE.catEdit=!STATE.catEdit;renderSweep();return;}
  if(e.target.id==='saveCats'){
    var box=document.getElementById('catBox');
    var categories=String(box?box.value:'').split('\n').map(function(line){return line.trim();}).filter(Boolean);
    authFetch('/api/news/categories',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({categories:categories})}).then(function(r){if(!r.ok)throw 0;return r.json();}).then(function(data){STATE.newsCategories=data.categories||categories;STATE.catEdit=false;renderSweep();}).catch(function(){deskFail('Could not save the categories.');});
    return;
  }
  if(e.target.id==='flagWait'){STATE.flagOpen=!STATE.flagOpen;renderWaiting();return;}
  if(e.target.id==='flagSave'){
    var q=String((document.getElementById('flagItem')||{}).value||'').trim();
    var who=String((document.getElementById('flagWho')||{}).value||'').trim();
    if(!q||!who){deskFail('Name the item and who you are waiting on.');return;}
    var hit=openItems().filter(function(it){return it.title.toLowerCase().indexOf(q.toLowerCase())>=0;})[0];
    if(!hit){deskFail('Could not find that item.');return;}
    hit.waitingOn=who;
    STATE.flagOpen=false;
    authFetch('/api/items',{method:'PATCH',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({id:hit.id,waitingOn:who})}).then(function(r){if(!r.ok)throw 0;renderWar();}).catch(function(){deskFail('Could not flag that item.');});
  }
});
function resolveItem(id){
  var hit=(STATE.items||[]).filter(function(it){return it.id===id;})[0];
  var prev=hit?hit.status:'open';
  if(hit) hit.status='done';
  renderWar();
  authFetch('/api/items/'+id,{method:'PATCH',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({status:'done'})}).then(function(r){if(!r.ok)throw 0;}).catch(function(){if(hit)hit.status=prev;renderWar();deskFail('Could not close that row.');});
}
function resolveKey(key){
  if(!key) return;
  var prev=(STATE.resolvedWaiting||[]).slice();
  STATE.resolvedWaiting=prev.concat([key]);
  renderWar();
  authFetch('/api/waiting',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({sourceKey:key})}).then(function(r){if(!r.ok)throw 0;return r.json();}).then(function(data){if(!data||data.ok!==true)throw 0;}).catch(function(){STATE.resolvedWaiting=prev;renderWar();deskFail('Could not close that row.');});
}
function commitAct(id,action){
  var prev=(STATE.commitments||[]).slice();
  STATE.commitments=prev.map(function(c){return c.id===id?Object.assign({},c,{status:action==='done'?'done':'decked'}):c;});
  renderWar();
  var done=action==='done';
  var req=done
    ? authFetch('/api/commitments/'+id,{method:'PATCH',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({status:'done'})})
    : authFetch('/api/commitments',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({id:id,action:action})});
  req.then(function(r){if(!r.ok)throw 0;return r.json();}).then(function(data){if(data&&data.commitments)STATE.commitments=data.commitments;renderWar();if(action==='deck') return loadBoard();}).catch(function(){STATE.commitments=prev;renderWar();deskFail('Could not update that commitment.');});
}
document.getElementById('planClose').onclick=closePlan;
document.getElementById('planWin').addEventListener('click',function(e){if(e.target.id==='planWin') closePlan();});
document.getElementById('planAdd').onclick=function(){readPlanFields();PLAN.steps.push({text:'',done:false});paintPlan();};
document.getElementById('planNeedAdd').onclick=function(){readPlanFields();PLAN.needs.push('');paintPlan();};
document.getElementById('planSteps').addEventListener('click',function(e){
  var up=e.target.closest('[data-step-up]');
  var down=e.target.closest('[data-step-down]');
  if(!up&&!down) return;
  readPlanFields();
  var i=+(up?up.getAttribute('data-step-up'):down.getAttribute('data-step-down'));
  var j=up?i-1:i+1;
  if(j<0||j>=PLAN.steps.length) return;
  var tmp=PLAN.steps[i]; PLAN.steps[i]=PLAN.steps[j]; PLAN.steps[j]=tmp;
  paintPlan();
});
document.getElementById('planSteps').addEventListener('change',function(e){
  var box=e.target.closest('[data-step-done]');
  if(!box||!PLAN) return;
  PLAN.steps[+box.getAttribute('data-step-done')].done=box.checked;
});
document.getElementById('planAsk').onclick=function(){
  if(!PLAN) return;
  readPlanFields();
  authFetch('/api/ceo/plan',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({title:PLAN.title,area:PLAN.area,steps:PLAN.steps.map(function(step){return step.text;}),itemId:PLAN.itemId})}).then(function(r){if(!r.ok)throw 0;return r.json();}).then(function(data){
    PLAN.steps=(data.steps||[]).map(function(step){return {text:step.text||step,done:!!step.done};});
    PLAN.needs=data.needs||[];
    PLAN.draft=data.draft||'';
    paintPlan();
  }).catch(function(){deskFail('Could not build that plan.');});
};
document.getElementById('planSave').onclick=function(){
  if(!PLAN) return;
  readPlanFields();
  var steps=PLAN.steps.filter(function(step){return String(step.text||'').trim();});
  authFetch('/api/plans',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({itemId:PLAN.itemId,title:PLAN.title,area:PLAN.area,steps:steps,needs:PLAN.needs.filter(Boolean),draft:PLAN.draft,push:true})}).then(function(r){if(!r.ok)throw 0;return r.json();}).then(function(data){
    (data.created||[]).forEach(function(row){STATE.items.push(row);});
    STATE.plans=(STATE.plans||[]).filter(function(p){return p.itemId!==PLAN.itemId;}).concat([{itemId:PLAN.itemId,steps:steps,needs:PLAN.needs,draft:PLAN.draft}]);
    closePlan();
    renderRoom();
    deskNote((data.created||[]).length+' steps on the deck');
  }).catch(function(){deskFail('Could not save that plan.');});
};
document.getElementById('bigBoard').addEventListener('click',function(e){
  var lamp=e.target.closest('[data-lamp]');
  if(!lamp) return;
  STATE.ceoLamp=lamp.getAttribute('data-lamp');
  renderCeo();
});
renderRoom();
