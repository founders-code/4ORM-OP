/* Port of 10-calendar.html page script. Runs against a shadow root. */
window.mountRedesignCalendar = function (root, opts) {
  opts = opts || {};
  var document = root;
  var windowRef = window;
  var innerWidth = window.innerWidth, innerHeight = window.innerHeight;
  var fixture = !!opts.fixture;
  var liveWrite = opts.write || function () {};
  var liveUndo = opts.undo || function () {};
  function gid(id) { return root.getElementById(id); }

let TODAY=opts.today||new Date(2026,9,19);
const C={meet:'var(--meet)',inv:'var(--inv)',pay:'var(--pay)',mile:'var(--mile)',hol:'var(--hol)'};
const ymd=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const add=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
const same=(a,b)=>ymd(a)==ymd(b);
const MON=['January','February','March','April','May','June','July','August','September','October','November','December'];
const DOW=['SUN','MON','TUE','WED','THU','FRI','SAT'];
// ---------- EVENTS (from Chad's Fantastical) ----------
const E=[];
const ev=(d,s,e,t,c)=>E.push({d,s,e,t,c});const ad=(d,t,c)=>E.push({d,t,c,all:1});
if(!opts.live){
// one-offs
[['2026-10-02',9,10,'Zed and Chad 1on1'],['2026-10-02',12,13,'Dean and Chad'],['2026-10-02',16,17,"4orm's first investor call",'inv'],
 ['2026-10-05',9,10,'4orm Dev'],['2026-10-05',14,15,'Bruce and Chad 1on1'],['2026-10-06',11,12,'Zed and Chad 1on1'],['2026-10-06',14.75,15.5,'Kevin and Chad'],
 ['2026-10-08',15,16,'Speer and 4orm'],['2026-10-09',11.5,12.5,'Jeff intro | Bruce'],['2026-10-13',12,13,'Content Posting Run'],['2026-10-14',9,10,'Mike Stephens | Bruce'],
 ['2026-10-15',10,11,'Development End to End'],['2026-10-15',11,12,'Dean and Chad 1on1'],['2026-10-16',9.5,10.5,'Call the Fraud Prevention Centre'],
 ['2026-10-16',13,14,'Quinton and Chad'],['2026-10-16',14,15,'Kevin Zahar | 4orm','inv'],['2026-10-17',10.5,12,'Shawn and Chad | Meet at home'],['2026-10-17',14,15,'Bruce and Chad 1on1'],
 ['2026-10-19',12,13,'Chad Fournier | 4orm Investment review','inv']
].forEach(a=>ev(a[0],a[1],a[2],a[3],a[4]||'meet'));
[['2026-10-09','Hack a thon','hol'],['2026-10-12','Thanksgiving','hol'],['2026-10-20','Marketing drop','mile'],['2026-10-23','4ormIQ launch','mile'],
 ['2026-10-30','F&F close - $250K','inv'],['2026-10-31','Newsletter + paper + update','mile'],['2026-10-31','Halloween','hol'],['2026-11-01','Daylight Saving ends','hol'],
 ['2026-11-03','Marketing drop','mile'],['2026-11-11','Remembrance Day','hol'],['2026-11-17','Marketing drop','mile'],['2026-11-30','Newsletter + paper + update','mile'],
 ['2026-12-01','Marketing drop','mile'],['2026-12-15','Marketing drop','mile'],['2026-12-25','Christmas','hol'],['2026-12-29','Marketing drop','mile'],['2026-12-31','Q4 investor letter','mile']
].forEach(a=>ad(a[0],a[1],a[2]));
// recurring
for(let d=new Date(2026,8,27);d<=new Date(2027,0,31);d=add(d,1)){
 const k=ymd(d),w=d.getDay(),m=d.getDate();
 if(w==1){ev(k,9,10,"Executive Advisor's | War Room",'meet');ev(k,11,12,'Dean and Chad Weekly Call','meet');}
 if(w==3&&d>=new Date(2026,9,7))ev(k,10,10.5,'Kevin and Chad | 1on1 GTM','meet');
 if(w==5&&d>=new Date(2026,9,23))ev(k,10,11,'Don and Chad 1on1','inv');
 if(m==14||m==28)ad(k,'Car Payment $285.21','pay');
 if(m==7)ad(k,'Zoom $22.56','pay');if(m==8)ad(k,'Canva $16','pay');if(m==22)ad(k,'Quick Books $53.76','pay');
 if(w==0&&Math.round((d-new Date(2026,8,27))/864e5)%14==0)ad(k,'Delayed communication','hol');
}
}
// ---------- SUGGESTED PLAYS (4orm Intelligence) ----------
const S=[];const sp=(d,s,e,t,c)=>S.push({d,s,e,t,c});
const busy=k=>E.filter(x=>x.d==k&&!x.all);
function planDay(k,w){
 const b=busy(k);const free=(s,e)=>!b.some(x=>x.s<e&&x.e>s);
 const place=(len,from,to,t,c)=>{for(let s=from;s+len<=to;s+=.25){if(free(s,s+len)&&!S.some(x=>x.d==k&&x.s<s+len&&x.e>s)){sp(k,s,s+len,t,c);return}}};
 place(.5,8,9,'Video','var(--red)');place(.5,8,10,'Inbox zero','var(--violet)');
 place(1.25,9,13,'Focus - one move','var(--blue2)');
 if(w==2)place(.5,11,14,'Chase cold','var(--amber)');
 if(w==3)place(.5,13,15,'Speer sync','var(--teal)');
 if(w==4)place(.5,11,14,'Metrics snapshot','var(--sky)');
 if(w==5)place(.5,13,15,'Check 4ormIQ - launch','var(--lime)');
 place(1,15,17,'Outreach: reach 5 + raise touch','var(--green)');
 if(w==5)place(.5,16,17.5,'Weekly review','#ffffff');
 place(.25,16,17.5,'Post clip + engage','var(--pink)');
 place(.25,17.5,18.5,'Shutdown + snapshot','var(--slate)');
}
if(!opts.live){for(let d=new Date(2026,9,19);d<=new Date(2027,0,31);d=add(d,1)){const w=d.getDay();if(w>0&&w<6)planDay(ymd(d),w);}}
if(opts.events){E.length=0;opts.events.forEach(function(x){E.push(x);});S.length=0;if(!opts.live){for(let d=new Date(2026,9,19);d<=new Date(2027,0,31);d=add(d,1)){const w=d.getDay();if(w>0&&w<6)planDay(ymd(d),w);}}}
if(opts.live&&opts.events){const startPlan=opts.today||new Date();for(let d=new Date(startPlan.getFullYear(),startPlan.getMonth(),startPlan.getDate());d<=add(startPlan,21);d=add(d,1)){const w=d.getDay();if(w>0&&w<6)planDay(ymd(d),w);}}
// ---------- STATE ----------
let view='week',focus=opts.focus||opts.today||new Date(2026,9,19);
if(opts.today){ /* TODAY may be reassigned below */ }
const H0=7,H1=20,PX=46;
const fmt=h=>{const hh=Math.floor(h),mm=Math.round((h-hh)*60);const ap=hh>=12?'p':'a';const h12=hh%12||12;return h12+(mm?':'+String(mm).padStart(2,'0'):'')+ap};
const weekStart=d=>add(d,-d.getDay());
function isoWeek(d){const t=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));const n=t.getUTCDay()||7;t.setUTCDate(t.getUTCDate()+4-n);const y=new Date(Date.UTC(t.getUTCFullYear(),0,1));return Math.ceil(((t-y)/864e5+1)/7)}
// ---------- RAIL ----------
function mini(){const m=gid('mini');if(!m)return;let h='';DOW.forEach((x,i)=>h+=`<div class="h${i==6?' sat':''}">${x}</div>`);
 const first=new Date(focus.getFullYear(),focus.getMonth(),1),start=add(first,-first.getDay());const ws=weekStart(focus);
 for(let i=0;i<42;i++){const d=add(start,i),k=ymd(d);const evs=E.filter(x=>x.d==k);const cols=[...new Set(evs.map(x=>C[x.c]))].slice(0,3);
  const wk=d>=ws&&d<add(ws,7);h+=`<div class="d${d.getMonth()!=focus.getMonth()?' o':''}${wk?' wk':''}${same(d,TODAY)?' td':''}" data-action="cal-mini-day" data-d="${k}"><span>${d.getDate()}</span>${cols.length?'<i>'+cols.map(c=>`<b style="background:${c}"></b>`).join('')+'</i>':''}</div>`;}
 m.innerHTML=h;
 const mh=root.querySelector&&root.querySelector('.mtitle h2');
 if(mh) mh.innerHTML=MON[focus.getMonth()]+' <span>'+focus.getFullYear()+'</span>';}
function ribbon(){const r=gid('ribbon');const k=ymd(TODAY);const span=13;let h='';
 E.filter(x=>x.d==k&&!x.all).forEach(x=>h+=`<div class="seg" style="left:${(x.s-7)/span*100}%;width:${(x.e-x.s)/span*100}%;background:${C[x.c]}"></div>`);
 h+=`<div class="now" style="left:99%"></div>`;r.innerHTML=h;}
// ---------- VIEWS ----------
const body=gid('body'),title=gid('title');
function timeGrid(days,showSug){
 let h=`<div class="whead" style="grid-template-columns:repeat(${days.length},1fr)">`;
 days.forEach(d=>h+=`<div class="dh${same(d,TODAY)?' td':''}"><div class="dn">${DOW[d.getDay()]}</div><div class="dd"><span>${d.getDate()}</span></div></div>`);
 h+=`</div><div class="allday" style="grid-template-columns:repeat(${days.length},1fr)"><span class="lab">all-day</span>`;
 days.forEach(d=>{h+=`<div class="c">`+E.filter(x=>x.d==ymd(d)&&x.all).map(x=>`<div class="pill" data-action="cal-allday" data-id="${x.id||''}" style="background:${C[x.c]}">${x.t}</div>`).join('')+`</div>`});
 h+=`</div><div class="tgrid" style="grid-template-columns:52px repeat(${days.length},1fr)"><div class="hours">`;
 for(let i=H0;i<H1;i++)h+=`<div class="hl">${i==H0?'':fmt(i)}</div>`;h+=`</div>`;
 days.forEach(d=>{const k=ymd(d);h+=`<div class="col${same(d,TODAY)?' today':''}" data-k="${k}">`;for(let i=H0;i<H1;i++)h+='<div class="line"></div>';
  E.filter(x=>x.d==k&&!x.all).forEach(x=>h+=`<div class="ev real${(x.e-x.s)*PX-3<26?' short':''}${SEL===x?' sel':''}" data-action="cal-event" data-id="${x.id||''}" data-i="${E.indexOf(x)}" data-t="${String(x.t||'').replace(/"/g,'&quot;')}" data-d="${x.d}" data-s="${x.s}" data-e="${x.e}" style="top:${(x.s-H0)*PX+1}px;height:${(x.e-x.s)*PX-3}px;background:${C[x.c]}"><div class="tt">${x.t}</div><div class="tm">${fmt(x.s)} - ${fmt(x.e)}</div>${x.ppl&&x.ppl.length?`<div class="tm">&#128101; ${x.ppl.length}</div>`:''}<span class="rz"></span></div>`);
  if(showSug)S.filter(x=>x.d==k).forEach(x=>{const ht=(x.e-x.s)*PX-3;h+=`<div class="ev sug${ht<26?' short':''}" data-action="cal-sug" data-si="${S.indexOf(x)}" style="top:${(x.s-H0)*PX+1}px;height:${ht}px;border-color:${x.c};background:color-mix(in srgb,${x.c} 14%,transparent)"><div class="tt" style="color:${x.c}">${x.t}</div>${ht>22?`<div class="tm">${fmt(x.s)} - ${fmt(x.e)}</div>`:''}<span class="ok"><b data-action="cal-keep" style="background:var(--green);color:#06210f">&#10003;</b><b data-action="cal-drop" style="background:#2a3556;color:#cfd8f0">&#10005;</b></span></div>`});
  h+=`</div>`;});
 return h+`</div>`;
}
function aiBanner(n,f){return `<div class="ai"><span class="sp">&#10022;</span><div><b>4orm Intelligence planned next week around your ${n} meetings</b> - ${S.length} plays placed in the gaps, ${f}h of protected focus. Dashed = suggested. Hover a block to keep or drop it.</div><div class="acts"><button data-action="cal-accept" style="background:var(--blue);color:#fff">Accept all</button><button data-action="cal-replan" style="background:#1d2b55;color:#cfd8f0">Re-plan</button></div></div>`}
function wkPill(ws,we,tws){const n=Math.round((ws-tws)/6048e5);let p='';
 if(n==0)p='<em class="now">this week</em>';else if(n==1)p='<em>next week</em>';else if(n>1)p=`<em>${n} weeks out</em>`;else if(n==-1)p='<em class="past">last week</em>';else p=`<em class="past">${-n} weeks ago</em>`;
 for(let k=1;k<=3;k++){const t=new Date(TODAY.getFullYear(),TODAY.getMonth()+k,TODAY.getDate());if(t>=ws&&t<=we)p+=`<em class="mo">${k} month${k>1?'s':''} out</em>`;}
 return p;}
function render(){
 root.querySelectorAll('#views span').forEach(s=>s.classList.toggle('on',s.dataset.v==view));
 if(view=='week'){
  const first=new Date(2026,8,27),focusWs=ymd(weekStart(focus));let h=aiBanner(E.filter(x=>!x.all&&x.d>='2026-10-18'&&x.d<='2026-10-24').length,9)+'<div class="wk">';
  const tws=weekStart(TODAY);for(let w=0;w<18;w++){const ws=add(first,7*w),we=add(ws,6),days=[...Array(7)].map((_,i)=>add(ws,i));
   const lab=`${MON[ws.getMonth()].slice(0,3)} ${ws.getDate()} - ${ws.getMonth()!=we.getMonth()?MON[we.getMonth()].slice(0,3)+' ':''}${we.getDate()}`;
   h+=`<section class="wkb" data-ws="${ymd(ws)}" data-cw="${isoWeek(add(ws,1))}" data-m="${MON[add(ws,3).getMonth()]}"><div class="wklab"><span>CW ${isoWeek(add(ws,1))}</span>${lab}${wkPill(ws,we,tws)}</div>${timeGrid(days,true)}</section>`;}
  body.innerHTML=h+'</div>';
  const tgt=body.querySelector(`.wkb[data-ws="${focusWs}"]`);if(tgt)body.scrollTop=tgt.offsetTop-70;
  const upd=()=>{const bs=[...body.querySelectorAll('.wkb')];let cur=bs[0];bs.forEach(b=>{if(b.offsetTop-90<=body.scrollTop)cur=b});title.innerHTML=`<span class="cw">CW ${cur.dataset.cw}</span>${cur.dataset.m} <span>2026</span>`;};
  body.onscroll=upd;upd();}
 else body.onscroll=null;
 if(view=='day'){const d=focus;title.innerHTML=`<span class="cw">CW ${isoWeek(d)}</span><span style="color:var(--blue2)">${['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d.getDay()]}</span> ${MON[d.getMonth()]} ${d.getDate()}, <span>${d.getFullYear()}</span>`;
  const k=ymd(d);const items=[...E.filter(x=>x.d==k&&!x.all).map(x=>({...x,col:C[x.c],real:1})),...S.filter(x=>x.d==k).map(x=>({...x,col:x.c}))].sort((a,b)=>a.s-b.s);
  body.innerHTML=`<div class="wk dayw"><div>${timeGrid([d],true)}</div><div class="c-side"><h3>Day plan</h3><div class="c-s">${items.filter(i=>i.real).length} meetings &middot; ${items.filter(i=>!i.real).length} plays fitted around them</div>${items.map(i=>`<div class="gap"><span class="tm">${fmt(i.s)} - ${fmt(i.e)}</span><em style="background:${i.col};${i.real?'':'outline:1.5px dashed '+i.col+';background:transparent'}"></em><span style="${i.real?'font-weight:700':''}">${i.real?'':'✦ '}${i.t}</span></div>`).join('')}</div></div>`;}
 if(view=='month'||view=='quarter'){
  const q=view=='quarter';const m0=new Date(2026,9,1);const end=q?new Date(2026,11,31):new Date(2026,9,31);
  title.innerHTML=q?`Q4 <span>2026</span> &nbsp;<span style="color:var(--mut);font-size:15px;font-weight:600">Oct - Dec</span>`:`October <span>2026</span>`;
  let s=add(m0,-m0.getDay());let h=`<div class="q"><div class="qhead"><div></div>${DOW.map(x=>`<div>${x}</div>`).join('')}</div>`;
  while(s<=end){h+=`<div class="qrow"><div class="cwl">CW ${isoWeek(add(s,1))}</div>`;
   for(let i=0;i<7;i++){const d=add(s,i),k=ymd(d);const oth=q?(d<m0||d>end):d.getMonth()!=9;const first=d.getDate()==1;
    const alls=E.filter(x=>x.d==k&&x.all),tim=E.filter(x=>x.d==k&&!x.all).sort((a,b)=>a.s-b.s);
    const lbl=first?`<span>${MON[d.getMonth()].slice(0,3)} 1</span>`:(same(d,TODAY)?`<span>Oct 19</span>`:d.getDate());
    h+=`<div class="qc${q?'':' mc'}${oth?' oth':''}${first?' first':''}${same(d,TODAY)?' td':''}" data-action="cal-cell" data-d="${k}"><div class="c-n">${lbl}</div>`;
    if(q){h+=alls.map(x=>`<div class="stripe" style="background:${C[x.c]}"></div>`).join('');h+=`<div class="dots">${tim.map(x=>`<b style="background:${C[x.c]}"></b>`).join('')}</div>`;
     const wd=d.getDay()>0&&d.getDay()<6;if(wd&&d>TODAY)h+=`<div class="play"><i style="background:var(--red)"></i><i style="background:var(--violet)"></i><i style="background:var(--blue2)"></i><i style="background:var(--green)"></i><i style="background:var(--pink)"></i></div>`;}
    else{const items=[...alls.map(x=>`<div class="mp ad" style="color:${C[x.c]}">${x.t}</div>`),...tim.map(x=>`<div class="mp"><em style="background:${C[x.c]}"></em>${x.t}<span class="tm">${fmt(x.s)}</span></div>`)];
     h+=items.slice(0,4).join('')+(items.length>4?`<div class="more" data-action="cal-more">${items.length-4} more...</div>`:'');}
    h+=`</div>`;}
   h+=`</div>`;s=add(s,7);}
  body.innerHTML=h+(q?`<div style="padding:0 20px 20px;font-size:11px;color:var(--mut)">Stripes = all-day &middot; dots = meetings &middot; the thin rainbow bar on future weekdays = today's Playbook plays, already fitted in.</div>`:'')+'</div>';}
 if(view=='year'){title.innerHTML=`<span>2026</span>`;let h='<div class="yr">';
  for(let mo=0;mo<12;mo++){const f=new Date(2026,mo,1);let g=DOW.map(x=>`<div class="h">${x[0]}</div>`).join('');for(let i=0;i<f.getDay();i++)g+='<div></div>';
   const dim=new Date(2026,mo+1,0).getDate();
   for(let dd=1;dd<=dim;dd++){const d=new Date(2026,mo,dd),k=ymd(d);const has=E.some(x=>x.d==k&&!x.all);const mil=E.some(x=>x.d==k&&x.c=='mile');
    g+=`<div class="x${has?' e':''}${mil?' m':''}${same(d,TODAY)?' t':''}${d<new Date(2026,8,27)?' p':''}" data-action="cal-year-day" data-d="${k}">${dd}</div>`;}
   h+=`<div class="ym"><h4 class="${mo==9?'cur':''}">${MON[mo]}</h4><div class="g">${g}</div></div>`;}
  body.innerHTML=h+'</div>';}
 if(typeof window.stampDeskControls==='function') window.stampDeskControls(root);
}
gid('views').onclick=e=>{const v=e.target.dataset.v;if(v){view=v;render()}};
let SEL=null;mini();ribbon();render();
// ===== Fantastical-style interactions =====
const hist=[];
const snap=h=>Math.round(h*4)/4;
const toast=t=>{const u=gid('undo');gid('undoT').textContent=t;u.classList.add('show');clearTimeout(u._t);u._t=setTimeout(()=>u.classList.remove('show'),4500)};
const save=()=>hist.push(JSON.stringify(E));
gid('undoB').onclick=()=>{if(!hist.length)return;const prev=JSON.parse(hist.pop());const now=E.slice();E.length=0;prev.forEach(x=>E.push(x));SEL=null;render();gid('undo').classList.remove('show');liveUndo({prev:prev,now:now});};
const dayName=k=>{const d=new Date(k+'T12:00');return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()]+' '+MON[d.getMonth()].slice(0,3)+' '+d.getDate()};
const colAt=(x,y)=>{
  function fromList(list){return (list||[]).find(e=>e.classList&&e.classList.contains('col')&&e.dataset&&e.dataset.k);}
  var hit=fromList(root.elementsFromPoint?root.elementsFromPoint(x,y):[]);
  if(hit) return hit;
  var light=window.document.elementsFromPoint(x,y)||[];
  hit=fromList(light);
  if(hit) return hit;
  for(var i=0;i<light.length;i++){
    var sr=light[i]&&light[i].shadowRoot;
    if(sr&&sr.elementsFromPoint){hit=fromList(sr.elementsFromPoint(x,y));if(hit) return hit;}
  }
  return null;
};
const hourAt=(col,y)=>{const r=col.getBoundingClientRect();const sc=r.height/col.offsetHeight||1;return H0+((y-r.top)/sc)/PX};
const tip=gid('dtip');const showTip=(x,y,t)=>{tip.style.display='block';tip.style.left=(x+14)+'px';tip.style.top=(y+10)+'px';tip.textContent=t};
let drag=null;
function paintGhost(){const a=Math.min(drag.h0,drag.h1),b=Math.max(drag.h0,drag.h1,a+0.25);drag.g.style.top=((a-H0)*PX+1)+'px';drag.g.style.height=((b-a)*PX-3)+'px';drag.g.textContent='New event  '+fmt(a)+' - '+fmt(b)}
if(!root.__calMiniBound){root.__calMiniBound=true;root.addEventListener('click',e=>{
  const d=e.target.closest&&e.target.closest('[data-action="cal-mini-day"]');
  if(d&&d.dataset.d) focusTo(d.dataset.d);
});}
root.addEventListener('mousedown',e=>{
  if(e.button!==0||e.target.closest('.pop')||e.target.closest('.undo'))return;
  const ev=e.target.closest('.ev.real');const col=e.target.closest('.col[data-k]');
  if(ev){e.preventDefault();const x=E[+ev.dataset.i];const resize=e.target.classList.contains('rz');
    drag={mode:resize?'resize':'move',x,ev,startY:e.clientY,startX:e.clientX,h0:hourAt(ev.closest('.col'),e.clientY),s:x.s,e:x.e,d:x.d,moved:false,dup:e.altKey};return}
  if(col&&!e.target.closest('.ev')){e.preventDefault();const h=Math.floor(hourAt(col,e.clientY)*4)/4;drag={mode:'create',col,h0:h,h1:h+0.5,moved:false};
    const g=window.document.createElement('div');g.className='ghost';col.appendChild(g);drag.g=g;paintGhost()}
});
window.addEventListener('mousemove',e=>{if(!drag)return;
  if(drag.mode==='create'){drag.h1=Math.max(drag.h0+0.25,snap(hourAt(drag.col,e.clientY)));paintGhost();showTip(e.clientX,e.clientY,dayName(drag.col.dataset.k)+'  '+fmt(drag.h0)+' - '+fmt(drag.h1));return}
  if(Math.abs(e.clientY-drag.startY)>3||Math.abs(e.clientX-drag.startX)>3)drag.moved=true;
  if(!drag.moved)return;
  if(drag.mode==='move'){const c=colAt(e.clientX,e.clientY)||drag.ev.closest('.col');const h=hourAt(c,e.clientY);let ns=e.shiftKey?drag.s+(h-drag.h0):snap(drag.s+(h-drag.h0));
    ns=Math.max(H0,Math.min(H1-(drag.e-drag.s),ns));drag.ns=ns;drag.ne=ns+(drag.e-drag.s);drag.nd=c.dataset.k;
    drag.ev.classList.add('dragging');if(drag.ev.parentNode!==c)c.appendChild(drag.ev);drag.ev.style.top=((ns-H0)*PX+1)+'px';
    showTip(e.clientX,e.clientY,(drag.dup?'Copy to ':'')+dayName(drag.nd)+'  '+fmt(ns)+' - '+fmt(drag.ne))}
  else{let ne=snap(drag.e+(hourAt(drag.ev.closest('.col'),e.clientY)-drag.h0));ne=Math.max(drag.s+0.25,Math.min(H1,ne));drag.ne=ne;drag.ev.style.height=((ne-drag.s)*PX-3)+'px';showTip(e.clientX,e.clientY,'Ends '+fmt(ne)+'  ('+Math.round((ne-drag.s)*60)+' min)')}
});
window.addEventListener('mouseup',e=>{if(!drag)return;tip.style.display='none';const d=drag;drag=null;
  if(d.mode==='create'){d.g.remove();openPop({d:d.col.dataset.k,s:d.h0,e:d.h1,t:'',c:'meet',isNew:true},e.clientX,e.clientY);return}
  if(!d.moved){SEL=d.x;render();openPop(d.x,e.clientX,e.clientY);return}
  save();
  if(d.mode==='move'){if(d.dup){var copy=Object.assign({},d.x,{d:d.nd,s:d.ns,e:d.ne,ppl:[...(d.x.ppl||[])],id:''});E.push(copy);toast('Duplicated "'+d.x.t+'" to '+dayName(d.nd)+' '+fmt(d.ns));liveWrite({type:'create',event:copy});}
    else{d.x.d=d.nd;d.x.s=d.ns;d.x.e=d.ne;toast('Moved "'+d.x.t+'" to '+dayName(d.nd)+' '+fmt(d.ns)+' — Google Calendar updated, invitees notified');liveWrite({type:'patch',event:d.x});}}
  else{d.x.e=d.ne;toast('"'+d.x.t+'" now ends '+fmt(d.ne));liveWrite({type:'patch',event:d.x});}
  SEL=d.x;render();
});
// suggested plays: keep / drop
function keepSug(i,keep){
  const x=S[i];if(!x)return;save();S.splice(S.indexOf(x),1);
  if(keep){var kept={d:x.d,s:x.s,e:x.e,t:x.t,c:'mile'};E.push(kept);toast('Kept "'+x.t+'" — added to your calendar');liveWrite({type:'create',event:kept});}else toast('Dropped "'+x.t+'"');render();
}
document.addEventListener('click',e=>{
  const path=e.composedPath?e.composedPath():[e.target];
  const hit=path.find(n=>n.matches&&n.matches('.ev.sug .ok b'));
  if(!hit)return;
  const sug=hit.closest('.ev.sug');if(!sug)return;
  keepSug(+sug.dataset.si, hit===hit.parentNode.firstElementChild);
});
// popover editor
const pop=gid('pop');let cur=null;
const t2h=t=>{const m=String(t).trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(a|p|am|pm)?$/);if(!m)return null;let h=+m[1];const mm=+(m[2]||0);if(m[3]&&m[3][0]=='p'&&h<12)h+=12;if(m[3]&&m[3][0]=='a'&&h==12)h=0;return h+mm/60};
const CONTACTS=[['Bruce Fair','Advisor'],['Kevin Wong','Investor'],['Don Hickling','Investor'],['Dean Hesse','Investor'],['Joe Canavan','VC'],['Zed','Speer'],['Keegan Poulton','Speer'],['Mike Stephens','Advisor']];
const DOCS=['Business Overview | 2026.pptx','4orm VC and Design Partner Resources.pdf','Raise tracker - F&F.xlsx','RPAA note - independent review.pdf'];
const KEYS={pPpl:'ppl',pLoc:'loc',pLinks:'links',pDocs:'docs'};
function paint(){const x=cur;gid('pSw').style.background=C[x.c];
  [['pPpl','','pPplIn'],['pLoc','lk','pLocIn'],['pLinks','lk','pLinkIn'],['pDocs','doc',null]].forEach(([id,cls,inp])=>{const el=gid(id);const keepIn=inp?gid(inp):null;const z=id=='pLoc'?gid('pZoom'):null;
    el.innerHTML=x[KEYS[id]].map((a,i)=>`<span class="pc ${cls}">${a}<i data-k="${id}" data-n="${i}">&times;</i></span>`).join('');if(keepIn)el.appendChild(keepIn);if(z)el.appendChild(z)})}
function openPop(x,cx,cy){cur=x;['ppl','loc','links','docs'].forEach(k=>x[k]=x[k]||[]);
  gid('pTitle').value=x.t||'';gid('pDate').value=x.d;gid('pS').value=fmt(x.s);gid('pE').value=fmt(x.e);gid('pCal').value=C[x.c]?x.c:'meet';gid('pNotes').value=x.notes||'';
  paint();pop.classList.add('open');const w=pop.offsetWidth,h=pop.offsetHeight;let L=cx+16,T=cy-40;if(L+w>innerWidth-10)L=cx-w-16;if(T+h>innerHeight-10)T=innerHeight-h-10;if(T<10)T=10;pop.style.left=L+'px';pop.style.top=T+'px';
  gid('pDel').style.display=x.isNew?'none':'';gid('pDup').style.display=x.isNew?'none':'';setTimeout(()=>gid('pTitle').focus(),30)}
const closePop=()=>{pop.classList.remove('open');cur=null;gid('pSug').style.display='none'};
document.addEventListener('mousedown',e=>{
  if(!pop.classList.contains('open'))return;
  const path=e.composedPath?e.composedPath():[e.target];
  if(path.some(n=>n===pop||(n.classList&&n.classList.contains('ev'))))return;
  closePop();
});
pop.addEventListener('click',e=>{const i=e.target.closest('.pc i');if(i){cur[KEYS[i.dataset.k]].splice(+i.dataset.n,1);paint()}});
const enter=(id,key)=>gid(id).addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.value.trim()){cur[key].push(e.target.value.trim());e.target.value='';paint();gid(id).focus()}});
enter('pLocIn','loc');enter('pLinkIn','links');enter('pPplIn','ppl');
const pin=gid('pPplIn'),sug=gid('pSug');
pin.addEventListener('input',()=>{const q=pin.value.toLowerCase();const m=CONTACTS.filter(c=>q&&c[0].toLowerCase().includes(q));sug.innerHTML=m.map(c=>`<div data-n="${c[0]}">${c[0]} <span>&middot; ${c[1]}</span></div>`).join('');sug.style.display=m.length?'block':'none'});
sug.addEventListener('mousedown',e=>{const d=e.target.closest('div[data-n]');if(!d)return;e.preventDefault();cur.ppl.push(d.dataset.n);pin.value='';sug.style.display='none';paint()});
gid('pZoom').onclick=()=>{cur.loc=cur.loc.filter(l=>!l.startsWith('Zoom'));cur.loc.push('Zoom · link created on save');paint()};
gid('pPick').onclick=()=>{const next=DOCS.find(d=>!cur.docs.includes(d));if(next){cur.docs.push(next);paint()}};
const dz=gid('pDrop');['dragenter','dragover'].forEach(t=>dz.addEventListener(t,e=>{e.preventDefault();dz.classList.add('over')}));dz.addEventListener('dragleave',()=>dz.classList.remove('over'));
dz.addEventListener('drop',e=>{e.preventDefault();dz.classList.remove('over');[...e.dataTransfer.files].forEach(f=>cur.docs.push(f.name));paint()});
gid('pSave').onclick=()=>{const x=cur;save();x.t=gid('pTitle').value.trim()||'New event';x.d=gid('pDate').value||x.d;const s1=t2h(gid('pS').value),e1=t2h(gid('pE').value);if(s1!=null){const dur=x.e-x.s;x.s=s1;x.e=s1+dur}if(e1!=null&&e1>x.s)x.e=e1;x.c=gid('pCal').value;x.notes=gid('pNotes').value;
  const isNew=x.isNew;delete x.isNew;if(isNew)E.push(x);SEL=x;closePop();render();toast((isNew?'Created "':'Saved "')+x.t+'"'+(x.ppl.length?' — invites sent to '+x.ppl.join(', '):''));liveWrite({type:isNew?'create':'patch',event:x});};
function askRemoveOrDecline(ev){
  if(ev && ev.id){
    if(window.confirm('Decline "'+(ev.t||'this event')+'" so the organizer knows?')) return 'decline';
    if(window.confirm('Remove event "'+(ev.t||'')+'" from your calendar?')) return 'delete';
    return '';
  }
  if(!window.confirm('Remove event "'+(ev.t||'')+'" from your calendar?')) return '';
  return 'delete';
}
gid('pDel').onclick=()=>{const kind=askRemoveOrDecline(cur);if(!kind)return;save();const t=cur.t;const gone=cur;E.splice(E.indexOf(cur),1);SEL=null;closePop();render();toast(kind==='decline'?'Declined "'+t+'"':'Removed "'+t+'"');liveWrite({type:kind,event:gone});};
gid('pDup').onclick=()=>{save();const c=Object.assign({},cur,{ppl:[...cur.ppl],loc:[...cur.loc],links:[...cur.links],docs:[...cur.docs],d:ymd(add(new Date(cur.d+'T12:00'),1))});E.push(c);closePop();render();toast('Duplicated to '+dayName(c.d))};
gid('pCal').onchange=e=>{cur.c=e.target.value;paint()};
window.addEventListener('keydown',e=>{if(e.target&&e.target.matches&&e.target.matches('input,textarea,select'))return;
  if((e.key==='Delete'||e.key==='Backspace')&&SEL&&E.includes(SEL)){const kind=askRemoveOrDecline(SEL);if(!kind)return;save();const t=SEL.t;const gone=SEL;E.splice(E.indexOf(SEL),1);SEL=null;render();toast(kind==='decline'?'Declined "'+t+'"':'Removed "'+t+'"');liveWrite({type:kind,event:gone});}
  if((e.metaKey||e.ctrlKey)&&e.key==='z'){e.preventDefault();gid('undoB').click()}
  if(e.key==='Escape')closePop()});
// natural-language quick add
gid('nlIn').addEventListener('keydown',e=>{if(e.key!=='Enter')return;const v=e.target.value.trim();if(!v)return;
  const days=['sun','mon','tue','wed','thu','fri','sat'];let base=new Date(TODAY);const low=v.toLowerCase();
  const dm=low.match(/\b(sun|mon|tue|wed|thu|fri|sat)[a-z]*\b/);if(/\btomorrow\b/.test(low))base=add(base,1);else if(dm){let diff=(days.indexOf(dm[1])-base.getDay()+7)%7;if(diff===0)diff=7;base=add(base,diff)}
  const tm=low.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm|a|p)\b/);const s=tm?t2h(tm[0].replace(/\s/g,'')):10;const dur=/\b(\d+)\s*min/.exec(low);const e1=s+(dur?+dur[1]/60:1);
  const title=v.replace(/\b(tomorrow|(sun|mon|tue|wed|thu|fri|sat)[a-z]*)\b/ig,'').replace(/\b\d{1,2}(:\d{2})?\s*(am|pm|a|p)\b/ig,'').replace(/\bfor \d+\s*min[a-z]*\b/ig,'').replace(/\s+/g,' ').trim();
  const who=CONTACTS.filter(c=>low.includes(c[0].split(' ')[0].toLowerCase())).map(c=>c[0]);
  save();const x={d:ymd(base),s,e:e1,t:title||'New event',c:'meet',ppl:who,loc:[],links:[],docs:[]};E.push(x);SEL=x;e.target.value='';
  render();toast('Created "'+x.t+'" — '+dayName(x.d)+' '+fmt(s)+(who.length?' with '+who.join(', '):''));liveWrite({type:'create',event:x});});

  function setView(v){ if(!v) return; view=v; render(); }
  function nav(dir){
    if(dir==='today') focus=TODAY;
    else {
      var n = dir==='prev' ? -1 : 1;
      if(view==='day') focus=add(focus,n);
      else if(view==='week') focus=add(focus,7*n);
      else if(view==='month') focus=new Date(focus.getFullYear(), focus.getMonth()+n, 1);
      else if(view==='quarter') focus=new Date(focus.getFullYear(), focus.getMonth()+3*n, 1);
      else focus=new Date(focus.getFullYear()+n, focus.getMonth(), 1);
    }
    mini(); render();
  }
  function focusTo(k){ if(!k) return; focus=new Date(k+'T12:00'); mini(); render(); }
  function navMonth(dir){
    var n = dir==='prev' ? -1 : 1;
    focus=new Date(focus.getFullYear(), focus.getMonth()+n, 1);
    mini(); render();
  }
  window.__redesignCal = { E: E, S: S, render: render, ymd: ymd, fmt: fmt, TODAY: function(){return TODAY;}, sel: function(){return SEL;}, setSel: function(x){SEL=x;}, setView: setView, nav: nav, navMonth: navMonth, focusTo: focusTo, keepSug: keepSug, focusYmd: function(){return ymd(focus);} };
};
