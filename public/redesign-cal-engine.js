/* Port of 10-calendar.html page script. Runs against a shadow root.
   Every window / document / root listener is registered through on() and removed
   by root.__calCleanup() at the start of the next mount, so a repaint never
   stacks listeners (one Keep = one Google event, one drag = one PATCH). */
window.mountRedesignCalendar = function (root, opts) {
  opts = opts || {};
  if (typeof root.__calCleanup === 'function') { try { root.__calCleanup(); } catch (e) {} }
  var LISTENERS = [];
  function on(target, type, fn, o) { if (!target) return; target.addEventListener(type, fn, o); LISTENERS.push([target, type, fn, o]); }
  root.__calCleanup = function () {
    LISTENERS.forEach(function (l) { try { l[0].removeEventListener(l[1], l[2], l[3]); } catch (e) {} });
    LISTENERS.length = 0;
  };
  var document = root;
  var fixture = !!opts.fixture;
  var liveWrite = opts.write || function () { return Promise.resolve(); };
  var liveUndo = opts.undo || function () {};
  function gid(id) { return root.getElementById(id); }
  function escH(v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

let TODAY=opts.today||new Date();
const C={meet:'var(--meet)',inv:'var(--inv)',pay:'var(--pay)',mile:'var(--mile)',hol:'var(--hol)'};
const ymd=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const add=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
const same=(a,b)=>ymd(a)==ymd(b);
const MON=['January','February','March','April','May','June','July','August','September','October','November','December'];
const DOW=['SUN','MON','TUE','WED','THU','FRI','SAT'];
// ---------- EVENTS ----------
const E=[];
const ev=(d,s,e,t,c)=>E.push({d,s,e,t,c});const ad=(d,t,c)=>E.push({d,t,c,all:1});
if(fixture&&!opts.events){
 const FX=(window.REDESIGN_FIXTURE_C||{}).CAL_FIXTURE||{events:[],allDay:[]};
 FX.events.forEach(a=>ev(a[0],a[1],a[2],a[3],a[4]||'meet'));
 FX.allDay.forEach(a=>ad(a[0],a[1],a[2]));
 /* The rest of design 10-calendar's sample set: later all-day dates and the recurring meetings / bills. */
 const haveAd=k=>E.some(x=>x.all&&(x.d+'|'+x.t)===k);
 [['2026-10-31','Halloween','hol'],['2026-11-01','Daylight Saving ends','hol'],['2026-11-03','Marketing drop','mile'],['2026-11-11','Remembrance Day','hol'],
  ['2026-11-17','Marketing drop','mile'],['2026-11-30','Newsletter + paper + update','mile'],['2026-12-01','Marketing drop','mile'],['2026-12-15','Marketing drop','mile'],
  ['2026-12-25','Christmas','hol'],['2026-12-29','Marketing drop','mile'],['2026-12-31','Q4 investor letter','mile']].forEach(a=>{if(!haveAd(a[0]+'|'+a[1]))ad(a[0],a[1],a[2])});
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
if(opts.events){E.length=0;opts.events.forEach(function(x){E.push(x);});}
// ---------- SUGGESTED PLAYS (4orm Intelligence) ----------
const S=[];const sp=(d,s,e,t,c)=>S.push({d,s,e,t,c});
function droppedMap(){try{return JSON.parse(localStorage.getItem('cr_cal_dropped')||'{}')||{}}catch(e){return {}}}
function remember(k,t){const m=droppedMap();m[k]=m[k]||[];if(m[k].indexOf(t)<0)m[k].push(t);const keep={};Object.keys(m).filter(x=>x>=ymd(add(TODAY,-14))).forEach(x=>keep[x]=m[x]);try{localStorage.setItem('cr_cal_dropped',JSON.stringify(keep))}catch(e){}}
const busy=k=>E.filter(x=>x.d==k&&!x.all);
function planDay(k,w){
 const b=busy(k);const free=(s,e)=>!b.some(x=>x.s<e&&x.e>s);
 const gone=(droppedMap()[k]||[]);
 const kept=t=>gone.indexOf(t)>=0||E.some(x=>x.d==k&&(x.play===t||x.t==='Play · '+t));
 const place=(len,from,to,t,c)=>{if(kept(t))return;for(let s=from;s+len<=to;s+=.25){if(free(s,s+len)&&!S.some(x=>x.d==k&&x.s<s+len&&x.e>s)){sp(k,s,s+len,t,c);return}}};
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
function planRange(from,days){for(let d=new Date(from.getFullYear(),from.getMonth(),from.getDate()),i=0;i<days;d=add(d,1),i++){const w=d.getDay();if(w>0&&w<6&&ymd(d)>=ymd(TODAY))planDay(ymd(d),w);}}
planRange(TODAY,21);
// ---------- STATE ----------
let view=opts.view||'week',focus=opts.focus||opts.today||new Date();
/* Live: the full day, 00:00-24:00 (MASTER_CHECKLIST C43). Fixture: design 10-calendar's 07:00-20:00 window. */
const H0=fixture?7:0,H1=fixture?20:24;
let PX=(function(){const v=+(localStorage.getItem('cr_cal_px')||46);return Number.isFinite(v)?Math.max(24,Math.min(160,v)):46})();
const HIDE={};
const FOURM_ZOOM_URL='https://us06web.zoom.us/j/7783632424';
const ZOOM_CHIP='Zoom · us06web.zoom.us/j/7783632424';
const fmt=h=>{h=Math.max(0,Math.min(24,h));const hh=Math.floor(h),mm=Math.round((h-hh)*60);return String(mm==60?hh+1:hh).padStart(2,'0')+':'+String(mm==60?0:mm).padStart(2,'0')};
const t2h=t=>{let v=String(t).trim().toLowerCase().replace(/\./g,':');if(/^\d{3,4}$/.test(v))v=v.slice(0,-2)+':'+v.slice(-2);const m=v.match(/^(\d{1,2})(?::(\d{2}))?\s*(a|p|am|pm)?$/);if(!m)return null;let h=+m[1];const mm=+(m[2]||0);if(h>23||mm>59)return null;if(m[3]&&m[3][0]=='p'&&h<12)h+=12;if(m[3]&&m[3][0]=='a'&&h==12)h=0;return h+mm/60};
function hasZoom(loc){return asList(loc).some(function(l){return /7783632424|us06web\.zoom\.us/i.test(String(l));});}
function ensureZoom(x){x.loc=x.loc||[];if(!hasZoom(x.loc))x.loc.push(ZOOM_CHIP);return x;}
function asList(v){return Array.isArray(v)?v:(v==null?[]:[v]);}
function label(v){if(v&&typeof v==='object')return String(v.name||v.title||v.email||'');return String(v==null?'':v).replace(/\s*<[^>]+>\s*$/,'');}
/* Midnight-based: a focus date carried over as noon (repaints) must not shift the week by half a day. */
const weekStart=d=>{const x=add(d,-d.getDay());x.setHours(0,0,0,0);return x};
function isoWeek(d){const t=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));const n=t.getUTCDay()||7;t.setUTCDate(t.getUTCDate()+4-n);const y=new Date(Date.UTC(t.getUTCFullYear(),0,1));return Math.ceil(((t-y)/864e5+1)/7)}
const visible=x=>!HIDE[x.c];
// ---------- RAIL ----------
function mini(){const m=gid('mini');if(!m)return;let h='';DOW.forEach((x,i)=>h+=`<div class="h${i==6?' sat':''}">${x}</div>`);
 const first=new Date(focus.getFullYear(),focus.getMonth(),1),start=add(first,-first.getDay());const ws=weekStart(focus);
 for(let i=0;i<42;i++){const d=add(start,i),k=ymd(d);const evs=E.filter(x=>x.d==k&&visible(x));const cols=[...new Set(evs.map(x=>C[x.c]))].slice(0,3);
  const wk=d>=ws&&d<add(ws,7);h+=`<div class="d${d.getMonth()!=focus.getMonth()?' o':''}${wk?' wk':''}${same(d,TODAY)?' td':''}" data-action="cal-mini-day" data-d="${k}"><span>${d.getDate()}</span>${cols.length?'<i>'+cols.map(c=>`<b style="background:${c}"></b>`).join('')+'</i>':''}</div>`;}
 m.innerHTML=h;
 const mh=root.querySelector&&root.querySelector('.mtitle h2');
 if(mh) mh.innerHTML=MON[focus.getMonth()]+' <span>'+focus.getFullYear()+'</span>';
 const lab=gid('calTodayLab');
 if(lab){
   const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Vancouver',weekday:'short',month:'short',day:'numeric'}).formatToParts(TODAY);
   function part(t){for(var i=0;i<parts.length;i++)if(parts[i].type===t)return parts[i].value;return '';}
   lab.textContent='Today · '+part('weekday')+' '+part('month')+' '+part('day');
 }
}
function nowHour(){const p=new Intl.DateTimeFormat('en-GB',{timeZone:'America/Vancouver',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date()).split(':');return +p[0]+(+p[1])/60}
function ribbon(){const r=gid('ribbon');if(!r)return;const k=ymd(TODAY);const a=fixture?7:6,span=fixture?13:16;let h='';
 E.filter(x=>x.d==k&&!x.all&&visible(x)).forEach(x=>{const s=Math.max(a,x.s),e=Math.min(a+span,x.e);if(e>s)h+=`<div class="seg" style="left:${(s-a)/span*100}%;width:${(e-s)/span*100}%;background:${C[x.c]}"></div>`});
 h+=`<div class="now" style="left:${fixture?99:Math.max(0,Math.min(99,(nowHour()-a)/span*100))}%"></div>`;r.innerHTML=h;
 const t=root.querySelector&&root.querySelector('.rticks');if(t)t.innerHTML=fixture?'<span>07</span><span>10</span><span>13</span><span>16</span><span>19</span><span>20</span>':'<span>06</span><span>10</span><span>14</span><span>18</span><span>22</span>';
}
function nextCard(){const card=root.querySelector&&root.querySelector('.nextcard');if(!card||fixture)return;
 const now=Date.now();const list=(opts.upcoming||[]).filter(x=>x.start>now).sort((a,b)=>a.start-b.start);const n=list[0];
 const k=card.querySelector('.k'),t=card.querySelector('.t'),cs=card.querySelector('.c-s');
 if(!n){if(k)k.textContent='NEXT UP';if(t)t.textContent='Nothing booked';if(cs)cs.textContent='';return;}
 const f=new Intl.DateTimeFormat('en-GB',{timeZone:'America/Vancouver',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(n.start)).toUpperCase();
 if(k)k.textContent='NEXT UP · '+f;if(t)t.textContent=n.title||'Meeting';if(cs)cs.textContent=n.join?'Join link on the event':'';
 const prep=card.querySelector('[data-action="cal-prep"]');if(prep){prep.setAttribute('data-title',n.title||'');prep.setAttribute('data-id',n.id||'');}
}
function shape(){const box=root.querySelector&&root.querySelector('.shape');const leg=root.querySelector&&root.querySelector('.slegend');if(!box||!leg||fixture)return;
 const ws=add(weekStart(TODAY),7);const keys=[...Array(7)].map((_,i)=>ymd(add(ws,i)));
 let meet=0,focusH=0,plays=0;E.forEach(x=>{if(!x.all&&keys.indexOf(x.d)>=0)meet+=x.e-x.s});S.forEach(x=>{if(keys.indexOf(x.d)<0)return;if(/^Focus/.test(x.t))focusH+=x.e-x.s;else plays+=x.e-x.s});
 const free=Math.max(0,5*10-meet-focusH-plays);const r=v=>Math.round(v*10)/10;
 box.innerHTML=`<i style="flex:${meet||0.01};background:var(--meet)"></i><i style="flex:${focusH||0.01};background:var(--blue)"></i><i style="flex:${plays||0.01};background:var(--green)"></i><i style="flex:${free||0.01};background:#26324f"></i>`;
 leg.innerHTML=`<span><em style="background:var(--meet)"></em>Meetings <b>${r(meet)}h</b></span><span><em style="background:var(--blue)"></em>Focus <b>${r(focusH)}h</b></span><span><em style="background:var(--green)"></em>Plays <b>${r(plays)}h</b></span><span><em style="background:#26324f"></em>Free <b>${r(free)}h</b></span>`;
}
// ---------- VIEWS ----------
const body=gid('body'),title=gid('title');
let SEL=null,SELSUG=null;
function timeGrid(days,showSug){
 let h=`<div class="whead" style="grid-template-columns:repeat(${days.length},1fr)">`;
 days.forEach(d=>h+=`<div class="dh${same(d,TODAY)?' td':''}"><div class="dn">${DOW[d.getDay()]}</div><div class="dd"><span>${d.getDate()}</span></div></div>`);
 h+=`</div><div class="allday" style="grid-template-columns:repeat(${days.length},1fr)"><span class="lab">all-day</span>`;
 days.forEach(d=>{h+=`<div class="c">`+E.filter(x=>x.d==ymd(d)&&x.all&&visible(x)).map(x=>`<div class="pill" data-action="cal-allday" data-i="${E.indexOf(x)}" style="background:${C[x.c]}">${escH(x.t)}</div>`).join('')+`</div>`});
 h+=`</div><div class="tgrid" style="grid-template-columns:52px repeat(${days.length},1fr)"><div class="hours">`;
 for(let i=H0;i<H1;i++)h+=`<div class="hl" style="height:${PX}px">${i==H0?'':fmt(i)}</div>`;h+=`</div>`;
 days.forEach(d=>{const k=ymd(d);h+=`<div class="col${same(d,TODAY)?' today':''}" data-k="${k}" style="height:${(H1-H0)*PX}px">`;for(let i=H0;i<H1;i++)h+=`<div class="line" style="height:${PX}px"></div>`;
  E.filter(x=>x.d==k&&!x.all&&visible(x)).forEach(x=>h+=`<div class="ev real${(x.e-x.s)*PX-3<26?' short':''}${SEL===x?' sel':''}" data-action="cal-event" data-id="${escH(x.id||'')}" data-i="${E.indexOf(x)}" data-d="${x.d}" style="top:${(x.s-H0)*PX+1}px;height:${Math.max(10,(x.e-x.s)*PX-3)}px;background:${C[x.c]}"><div class="tt">${escH(x.t)}</div><div class="tm">${fmt(x.s)} - ${fmt(x.e)}</div>${x.ppl&&x.ppl.length?`<div class="tm">${x.ppl.length} invited</div>`:''}<span class="rz"></span></div>`);
  if(showSug&&!HIDE.plays)S.filter(x=>x.d==k).forEach(x=>{const ht=(x.e-x.s)*PX-3;h+=`<div class="ev sug${ht<26?' short':''}${SELSUG===x?' sel':''}" data-action="cal-sug" data-si="${S.indexOf(x)}" style="top:${(x.s-H0)*PX+1}px;height:${Math.max(10,ht)}px;border-color:${x.c};background:color-mix(in srgb,${x.c} 14%,transparent)"><div class="tt" style="color:${x.c}">${escH(x.t)}</div>${ht>22?`<div class="tm">${fmt(x.s)} - ${fmt(x.e)}</div>`:''}<span class="ok"><b class="k" data-action="cal-keep">Keep</b><b class="l" data-action="cal-later">Later</b><b class="x" data-action="cal-drop">Drop</b></span><span class="rz"></span></div>`});
  h+=`</div>`;});
 return h+`</div>`;
}
function aiBanner(ws){const keys=[...Array(7)].map((_,i)=>ymd(add(ws,i)));const n=E.filter(x=>!x.all&&keys.indexOf(x.d)>=0).length;const plays=S.filter(x=>keys.indexOf(x.d)>=0);const f=plays.filter(x=>/^Focus/.test(x.t)).reduce((a,x)=>a+x.e-x.s,0);
 return `<div class="ai"><span class="sp"></span><div><b>4orm Intelligence planned this week around your ${n} meeting${n==1?'':'s'}</b> - ${plays.length} plays placed in the gaps, ${Math.round(f*10)/10}h of protected focus. Dashed = suggested. Hover a play for Keep / Later / Drop, drag it to another time, or click it to edit before keeping. Enter keeps, Delete drops.</div><div class="acts"><button data-action="cal-accept" style="background:var(--blue);color:#fff">Accept all</button><button data-action="cal-replan" style="background:#1d2b55;color:#cfd8f0">Re-plan</button></div></div>`}
function wkPill(ws,we,tws){const n=Math.round((ws-tws)/6048e5);let p='';
 if(n==0)p='<em class="now">this week</em>';else if(n==1)p='<em>next week</em>';else if(n>1)p=`<em>${n} weeks out</em>`;else if(n==-1)p='<em class="past">last week</em>';else p=`<em class="past">${-n} weeks ago</em>`;
 for(let k=1;k<=3;k++){const t=new Date(TODAY.getFullYear(),TODAY.getMonth()+k,TODAY.getDate());if(t>=ws&&t<=we)p+=`<em class="mo">${k} month${k>1?'s':''} out</em>`;}
 return p;}
function firstHour(keys){const hs=E.filter(x=>!x.all&&keys.indexOf(x.d)>=0&&visible(x)).map(x=>x.s);const f=hs.length?Math.min.apply(null,hs):7;return Math.max(0,Math.min(7,Math.floor(f)))}
function render(){
 root.querySelectorAll('#views span').forEach(s=>s.classList.toggle('on',s.dataset.v==view));
 body.onscroll=null;
 if(view=='week'){
  const fws=weekStart(focus);const first=add(fws,-7*8);let h=aiBanner(fws)+'<div class="wk">';
  const tws=weekStart(TODAY);for(let w=0;w<18;w++){const ws=add(first,7*w),we=add(ws,6),days=[...Array(7)].map((_,i)=>add(ws,i));
   const lab=`${MON[ws.getMonth()].slice(0,3)} ${ws.getDate()} - ${ws.getMonth()!=we.getMonth()?MON[we.getMonth()].slice(0,3)+' ':''}${we.getDate()}`;
   h+=`<section class="wkb" data-ws="${ymd(ws)}" data-cw="${isoWeek(add(ws,1))}" data-m="${MON[add(ws,3).getMonth()]}" data-y="${add(ws,3).getFullYear()}"><div class="wklab"><span>CW ${isoWeek(add(ws,1))}</span>${lab}${wkPill(ws,we,tws)}</div>${timeGrid(days,true)}</section>`;}
  body.innerHTML=h+'</div>';
  const tgt=body.querySelector(`.wkb[data-ws="${ymd(fws)}"]`);
  if(tgt&&fixture)body.scrollTop=tgt.offsetTop-70;
  else if(tgt){const keys=[...Array(7)].map((_,i)=>ymd(add(fws,i)));const grid=tgt.querySelector('.tgrid');body.scrollTop=(grid?grid.offsetTop:tgt.offsetTop)+firstHour(keys)*PX-40;}
  const upd=()=>{const bs=[...body.querySelectorAll('.wkb')];let cur=bs[0];bs.forEach(b=>{if(b.offsetTop-90<=body.scrollTop)cur=b});if(cur)title.innerHTML=`<span class="cw">CW ${cur.dataset.cw}</span>${cur.dataset.m} <span>${cur.dataset.y}</span>`;};
  body.onscroll=upd;upd();}
 if(view=='day'){const d=focus;title.innerHTML=`<span class="cw">CW ${isoWeek(d)}</span><span style="color:var(--blue2)">${['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d.getDay()]}</span> ${MON[d.getMonth()]} ${d.getDate()}, <span>${d.getFullYear()}</span>`;
  const k=ymd(d);const items=[...E.filter(x=>x.d==k&&!x.all&&visible(x)).map(x=>({...x,col:C[x.c],real:1})),...(HIDE.plays?[]:S.filter(x=>x.d==k).map(x=>({...x,col:x.c})))].sort((a,b)=>a.s-b.s);
  body.innerHTML=`<div class="wk dayw"><div>${timeGrid([d],true)}</div><div class="c-side"><h3>Day plan</h3><div class="c-s">${items.filter(i=>i.real).length} meetings &middot; ${items.filter(i=>!i.real).length} plays fitted around them</div>${items.map(i=>`<div class="gap"><span class="tm">${fmt(i.s)} - ${fmt(i.e)}</span><em style="background:${i.col};${i.real?'':'outline:1.5px dashed '+i.col+';background:transparent'}"></em><span style="${i.real?'font-weight:700':''}">${i.real?'':'Play · '}${escH(i.t)}</span></div>`).join('')}</div></div>`;
  const grid=body.querySelector('.tgrid');body.scrollTop=(grid?grid.offsetTop:0)+firstHour([k])*PX-40;}
 if(view=='month'||view=='quarter'){
  const q=view=='quarter';const qm=Math.floor(focus.getMonth()/3)*3;
  const m0=q?new Date(focus.getFullYear(),qm,1):new Date(focus.getFullYear(),focus.getMonth(),1);
  const end=q?new Date(focus.getFullYear(),qm+3,0):new Date(focus.getFullYear(),focus.getMonth()+1,0);
  title.innerHTML=q?`Q${qm/3+1} <span>${m0.getFullYear()}</span> &nbsp;<span style="color:var(--mut);font-size:15px;font-weight:600">${MON[qm].slice(0,3)} - ${MON[qm+2].slice(0,3)}</span>`:`${MON[m0.getMonth()]} <span>${m0.getFullYear()}</span>`;
  let s=add(m0,-m0.getDay());let h=`<div class="q"><div class="qhead"><div></div>${DOW.map(x=>`<div>${x}</div>`).join('')}</div>`;
  while(s<=end){h+=`<div class="qrow"><div class="cwl">CW ${isoWeek(add(s,1))}</div>`;
   for(let i=0;i<7;i++){const d=add(s,i),k=ymd(d);const oth=q?(d<m0||d>end):d.getMonth()!=m0.getMonth();const first=d.getDate()==1;
    const alls=E.filter(x=>x.d==k&&x.all&&visible(x)),tim=E.filter(x=>x.d==k&&!x.all&&visible(x)).sort((a,b)=>a.s-b.s);
    const lbl=first?`<span>${MON[d.getMonth()].slice(0,3)} 1</span>`:(same(d,TODAY)?`<span>${MON[d.getMonth()].slice(0,3)} ${d.getDate()}</span>`:d.getDate());
    h+=`<div class="qc${q?'':' mc'}${oth?' oth':''}${first?' first':''}${same(d,TODAY)?' td':''}" data-action="cal-cell" data-d="${k}"><div class="c-n">${lbl}</div>`;
    if(q){h+=alls.map(x=>`<div class="stripe" style="background:${C[x.c]}"></div>`).join('');h+=`<div class="dots">${tim.map(x=>`<b style="background:${C[x.c]}"></b>`).join('')}</div>`;}
    else{const items=[...alls.map(x=>`<div class="mp ad" style="color:${C[x.c]}">${escH(x.t)}</div>`),...tim.map(x=>`<div class="mp"><em style="background:${C[x.c]}"></em>${escH(x.t)}<span class="tm">${fmt(x.s)}</span></div>`)];
     h+=items.slice(0,4).join('')+(items.length>4?`<div class="more" data-action="cal-more" data-d="${k}">${items.length-4} more...</div>`:'');}
    h+=`</div>`;}
   h+=`</div>`;s=add(s,7);}
  body.innerHTML=h+(q?`<div style="padding:0 20px 20px;font-size:11px;color:var(--mut)">Stripes = all-day &middot; dots = meetings.</div>`:'')+'</div>';}
 if(view=='year'){const Y=focus.getFullYear();title.innerHTML=`<span>${Y}</span>`;let h='<div class="yr">';
  for(let mo=0;mo<12;mo++){const f=new Date(Y,mo,1);let g=DOW.map(x=>`<div class="h">${x[0]}</div>`).join('');for(let i=0;i<f.getDay();i++)g+='<div></div>';
   const dim=new Date(Y,mo+1,0).getDate();
   for(let dd=1;dd<=dim;dd++){const d=new Date(Y,mo,dd),k=ymd(d);const has=E.some(x=>x.d==k&&!x.all&&visible(x));const mil=E.some(x=>x.d==k&&x.c=='mile'&&visible(x));
    g+=`<div class="x${has?' e':''}${mil?' m':''}${same(d,TODAY)?' t':''}${d<TODAY&&!same(d,TODAY)?' p':''}" data-action="cal-year-day" data-d="${k}">${dd}</div>`;}
   h+=`<div class="ym"><h4 class="${mo==TODAY.getMonth()&&Y==TODAY.getFullYear()?'cur':''}">${MON[mo]}</h4><div class="g">${g}</div></div>`;}
  body.innerHTML=h+'</div>';}
 shape();
 if(typeof window.stampDeskControls==='function') window.stampDeskControls(root);
}
gid('views').onclick=e=>{const v=e.target.dataset.v;if(v){view=v;render()}};
mini();ribbon();nextCard();render();
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
/* mini-month day clicks go through desk-actions.js 'cal-mini-day' only */
on(root,'mousedown',e=>{
  if(e.button!==0||e.target.closest('.pop')||e.target.closest('.undo')||e.target.closest('.calconfirm'))return;
  if(e.target.closest('.ev.sug .ok'))return;
  const sugEl=e.target.closest('.ev.sug');
  if(sugEl){e.preventDefault();const x=S[+sugEl.dataset.si];if(!x)return;const resize=e.target.classList.contains('rz');
    drag={sug:true,mode:resize?'resize':'move',x,ev:sugEl,startY:e.clientY,startX:e.clientX,h0:hourAt(sugEl.closest('.col'),e.clientY),s:x.s,e:x.e,d:x.d,moved:false};return}
  const evEl=e.target.closest('.ev.real');const col=e.target.closest('.col[data-k]');
  if(evEl){e.preventDefault();const x=E[+evEl.dataset.i];if(!x)return;const resize=e.target.classList.contains('rz');
    drag={mode:resize?'resize':'move',x,ev:evEl,startY:e.clientY,startX:e.clientX,h0:hourAt(evEl.closest('.col'),e.clientY),s:x.s,e:x.e,d:x.d,moved:false,dup:e.altKey};return}
  if(col&&!e.target.closest('.ev')){e.preventDefault();const h=Math.floor(hourAt(col,e.clientY)*4)/4;drag={mode:'create',col,h0:h,h1:h+0.5,moved:false};
    const g=window.document.createElement('div');g.className='ghost';col.appendChild(g);drag.g=g;paintGhost()}
});
on(window,'mousemove',e=>{if(!drag)return;
  if(drag.mode==='create'){drag.h1=Math.max(drag.h0+0.25,snap(hourAt(drag.col,e.clientY)));paintGhost();showTip(e.clientX,e.clientY,dayName(drag.col.dataset.k)+'  '+fmt(drag.h0)+' - '+fmt(drag.h1));return}
  if(Math.abs(e.clientY-drag.startY)>3||Math.abs(e.clientX-drag.startX)>3)drag.moved=true;
  if(!drag.moved)return;
  if(drag.mode==='move'){const c=colAt(e.clientX,e.clientY)||drag.ev.closest('.col');const h=hourAt(c,e.clientY);let ns=e.shiftKey?drag.s+(h-drag.h0):snap(drag.s+(h-drag.h0));
    ns=Math.max(H0,Math.min(H1-(drag.e-drag.s),ns));drag.ns=ns;drag.ne=ns+(drag.e-drag.s);drag.nd=c.dataset.k;
    drag.ev.classList.add('dragging');if(drag.ev.parentNode!==c)c.appendChild(drag.ev);drag.ev.style.top=((ns-H0)*PX+1)+'px';
    showTip(e.clientX,e.clientY,(drag.dup?'Copy to ':'')+dayName(drag.nd)+'  '+fmt(ns)+' - '+fmt(drag.ne))}
  else{let ne=snap(drag.e+(hourAt(drag.ev.closest('.col'),e.clientY)-drag.h0));ne=Math.max(drag.s+0.25,Math.min(H1,ne));drag.ne=ne;drag.ev.style.height=((ne-drag.s)*PX-3)+'px';showTip(e.clientX,e.clientY,'Ends '+fmt(ne)+'  ('+Math.round((ne-drag.s)*60)+' min)')}
});
on(window,'mouseup',e=>{if(!drag)return;tip.style.display='none';const d=drag;drag=null;
  if(d.mode==='create'){d.g.remove();openPop({d:d.col.dataset.k,s:d.h0,e:d.h1,t:'',c:'meet',isNew:true},e.clientX,e.clientY);return}
  if(d.sug){
    if(!d.moved){SELSUG=d.x;SEL=null;render();openPop(Object.assign({},d.x,{c:'mile',isNew:true,play:d.x.t,sugRef:d.x,t:'Play · '+d.x.t}),e.clientX,e.clientY);return}
    if(d.mode==='move'){d.x.d=d.nd||d.x.d;d.x.s=d.ns;d.x.e=d.ne;}else d.x.e=d.ne;
    SELSUG=d.x;render();return}
  if(!d.moved){SEL=d.x;SELSUG=null;render();openPop(d.x,e.clientX,e.clientY);return}
  save();
  if(d.mode==='move'){if(d.dup){var copy=Object.assign({},d.x,{d:d.nd,s:d.ns,e:d.ne,ppl:[...(d.x.ppl||[])],id:''});E.push(copy);toast('Duplicated "'+d.x.t+'" to '+dayName(d.nd)+' '+fmt(d.ns));liveWrite({type:'create',event:copy});}
    else{d.x.d=d.nd;d.x.s=d.ns;d.x.e=d.ne;toast('Moved "'+d.x.t+'" to '+dayName(d.nd)+' '+fmt(d.ns)+' — Google Calendar updated, invitees notified');liveWrite({type:'patch',event:d.x});}}
  else{d.x.e=d.ne;toast('"'+d.x.t+'" now ends '+fmt(d.ne));liveWrite({type:'patch',event:d.x});}
  SEL=d.x;render();
});
// zoom the time grid: ctrl/pinch wheel and Cmd/Ctrl + / -, 24-160 px per hour, remembered
function setPx(v){const next=Math.max(24,Math.min(160,Math.round(v)));if(next===PX)return;const b=body;const ratio=b.scrollTop/(PX||1);PX=next;try{localStorage.setItem('cr_cal_px',String(PX))}catch(e){}if(view=='day'||view=='week'){render();b.scrollTop=ratio*PX;}}
/* A pinch over the calendar never zooms the page: the event is always swallowed, even at the 24 or 160 limit and in month/quarter/year views. */
on(root,'wheel',e=>{if(!e.ctrlKey&&!e.metaKey)return;e.preventDefault();e.stopPropagation();if(view=='day'||view=='week')setPx(PX-e.deltaY*0.25)},{passive:false});
/* Safari sends trackpad pinch as gesture events, not ctrl+wheel. */
let gesturePx=PX;
on(root,'gesturestart',e=>{e.preventDefault();gesturePx=PX},{passive:false});
on(root,'gesturechange',e=>{e.preventDefault();if(view=='day'||view=='week')setPx(gesturePx*(e.scale||1))},{passive:false});
on(root,'gestureend',e=>{e.preventDefault()},{passive:false});
// suggested plays: keep / later / drop (the only path; DA cal-keep/later/drop call keepSug)
function nextFree(d,s,len){const busyL=E.filter(v=>v.d===d&&!v.all).concat(S.filter(v=>v.d===d)).map(v=>[v.s,v.e]).sort((a,b)=>a[0]-b[0]);let t=s+0.5;for(let i=0;i<96;i++){const clash=busyL.some(([a,b])=>t<b&&t+len>a);if(!clash&&t+len<=H1)return t;t+=0.25}return null}
function keepPlay(x,extra){var kept=Object.assign({d:x.d,s:x.s,e:x.e,t:'Play · '+x.t,c:'mile',play:x.t,ppl:x.ppl||[],loc:x.loc||[],links:x.links||[],docs:x.docs||[],notes:x.notes||''},extra||{});E.push(kept);liveWrite({type:'create',event:kept});return kept;}
function keepSug(i,keep,later){
  const x=S[i];if(!x)return;save();
  if(later){const len=x.e-x.s;const t=nextFree(x.d,x.s,len);if(t!=null){x.s=t;x.e=t+len;toast('Later — "'+x.t+'" moved to '+fmt(t));}else toast('No free slot later that day');render();return;}
  S.splice(S.indexOf(x),1);if(SELSUG===x)SELSUG=null;
  if(keep){keepPlay(x);toast('Kept "'+x.t+'" — added to your calendar');}else{remember(x.d,x.t);toast('Dropped "'+x.t+'"');}render();
}
function keepAll(){const list=S.slice();if(!list.length)return 0;save();S.length=0;SELSUG=null;list.forEach(x=>keepPlay(x));render();toast('Kept '+list.length+' plays — added to your calendar');return list.length}
function replan(){const ws=weekStart(focus);S.length=0;SELSUG=null;planRange(ws,7*3);render();toast('Re-planned plays around your meetings')}
// popover editor
const pop=gid('pop');let cur=null;
function contacts(){return (opts.contacts||[]).filter(c=>c&&c.email)}
function docsList(){return (opts.documents||[]).filter(d=>d&&(d.name||d.title))}
const KEYS={pPpl:'ppl',pLoc:'loc',pLinks:'links',pDocs:'docs'};
function syncDur(){
  const Sx=gid('pS'),Ex=gid('pE'),D=gid('pDur'),sv=gid('pSave');
  if(!Sx||!Ex)return true;
  const a=t2h(Sx.value),b=t2h(Ex.value);
  Sx.classList.toggle('bad',Sx.value!==''&&a===null);
  Ex.classList.toggle('bad',Ex.value!==''&&b===null);
  const ok=a!==null&&b!==null&&b>a;
  if(D)D.textContent=ok?(Math.round((b-a)*60)>=60?(((b-a)%1)?((b-a).toFixed(1)+' h'):((b-a)+' h')):Math.round((b-a)*60)+' min'):'';
  if(sv)sv.disabled=!ok;
  return ok;
}
function paint(){const x=cur;gid('pSw').style.background=C[x.c]||C.meet;
  [['pPpl','','pPplIn'],['pLoc','lk','pLocIn'],['pLinks','lk','pLinkIn'],['pDocs','doc',null]].forEach(([id,cls,inp])=>{const el=gid(id);const keepIn=inp?gid(inp):null;const z=id=='pLoc'?gid('pZoom'):null;
    el.innerHTML=x[KEYS[id]].map((a,i)=>`<span class="pc ${cls}" title="${escH(typeof a==='object'?(a.url||a.name||''):a)}">${escH(label(a))}<i data-k="${id}" data-n="${i}">&times;</i></span>`).join('');if(keepIn)el.appendChild(keepIn);if(z)el.appendChild(z)})}
const ALERTS=[10,30,-1];
function alertIndex(min){if(min===null||min===-1)return 2;if(min==null)return 0;return min>=30?1:0}
function openPop(x,cx,cy){cur=x;['ppl','loc','links','docs'].forEach(k=>x[k]=x[k]||[]);
  if(x.isNew&&!x.play)ensureZoom(x);
  gid('pTitle').value=x.t||'';gid('pDate').value=x.d;gid('pS').value=fmt(x.s);gid('pE').value=fmt(x.e);gid('pCal').value=C[x.c]?x.c:'meet';gid('pNotes').value=x.notes||'';
  const al=gid('pAlert');if(al)al.selectedIndex=alertIndex(x.alertMin);
  paint();syncDur();pop.classList.add('open');const w=pop.offsetWidth,h=pop.offsetHeight;let L=cx+16,T=cy-40;if(L+w>window.innerWidth-10)L=cx-w-16;if(T+h>window.innerHeight-10)T=window.innerHeight-h-10;if(T<10)T=10;if(L<10)L=10;pop.style.left=L+'px';pop.style.top=T+'px';
  gid('pDel').style.display=x.isNew?'none':'';gid('pDup').style.display=x.isNew?'none':'';setTimeout(()=>gid('pTitle').focus(),30)}
const closePop=()=>{pop.classList.remove('open');cur=null;gid('pSug').style.display='none'};
on(window.document,'mousedown',e=>{
  if(!pop.classList.contains('open'))return;
  const path=e.composedPath?e.composedPath():[e.target];
  if(path.some(n=>n===pop||(n.classList&&(n.classList.contains('ev')||n.classList.contains('calconfirm')))))return;
  closePop();
});
pop.onclick=e=>{const i=e.target.closest('.pc i');if(i){cur[KEYS[i.dataset.k]].splice(+i.dataset.n,1);paint()}};
function addPerson(raw){raw=String(raw||'').trim();if(!raw)return false;
  if(/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(raw)){cur.ppl.push(raw);return true}
  const m=contacts().filter(c=>String(c.name||'').toLowerCase()===raw.toLowerCase())[0];
  if(m){cur.ppl.push((m.name||m.email)+' <'+m.email+'>');return true}
  toast('No email on file for "'+raw+'" — type their email address');return false}
const enter=(id,key)=>{gid(id).onkeydown=e=>{if(e.key==='Enter'&&e.target.value.trim()){e.preventDefault();const v=e.target.value.trim();if(key==='ppl'){if(!addPerson(v))return;gid('pSug').style.display='none';}else cur[key].push(v);e.target.value='';paint();gid(id).focus()}}};
enter('pLocIn','loc');enter('pLinkIn','links');enter('pPplIn','ppl');
const pin=gid('pPplIn'),sug=gid('pSug');
pin.oninput=()=>{const q=pin.value.toLowerCase();const m=q?contacts().filter(c=>String(c.name||'').toLowerCase().includes(q)||String(c.email).toLowerCase().includes(q)).slice(0,8):[];sug.innerHTML=m.map(c=>`<div data-n="${escH(c.name||c.email)}" data-e="${escH(c.email)}">${escH(c.name||c.email)} <span>&middot; ${escH(c.role||c.company||c.email)}</span></div>`).join('');sug.dataset.mode='ppl';sug.style.display=m.length?'block':'none'};
sug.onmousedown=e=>{const d=e.target.closest('div[data-n]');if(!d)return;e.preventDefault();
  if(sug.dataset.mode==='doc'){cur.docs.push({name:d.dataset.n,url:d.dataset.u||'',driveFileId:d.dataset.f||''});}
  else cur.ppl.push(d.dataset.n+' <'+d.dataset.e+'>');
  pin.value='';sug.style.display='none';paint()};
gid('pZoom').onclick=()=>{cur.loc=cur.loc.filter(l=>!/zoom|7783632424/i.test(String(l)));cur.loc.push(ZOOM_CHIP);paint()};
gid('pPick').onclick=()=>{const list=docsList().slice(0,14);if(!list.length){toast('No documents to attach yet — drop a file instead');return}
  sug.innerHTML=list.map(d=>`<div data-n="${escH(d.name||d.title)}" data-u="${escH(d.url||d.webViewLink||'')}" data-f="${escH(d.driveFileId||d.drive_file_id||'')}">${escH(d.name||d.title)}</div>`).join('');sug.dataset.mode='doc';sug.style.display='block'};
const dz=gid('pDrop');dz.ondragenter=dz.ondragover=e=>{e.preventDefault();dz.classList.add('over')};dz.ondragleave=()=>dz.classList.remove('over');
dz.ondrop=e=>{e.preventDefault();e.stopPropagation();dz.classList.remove('over');const x=cur;[...e.dataTransfer.files].forEach(f=>{
  const entry={name:f.name,url:'',driveFileId:'',uploading:true};x.docs.push(entry);paint();
  if(typeof opts.upload!=='function'){entry.uploading=false;return}
  opts.upload(f).then(d=>{entry.uploading=false;if(d&&d.saved===false)throw new Error('upload');entry.driveFileId=(d&&(d.driveFileId||d.fileId||d.id))||'';entry.url=(d&&(d.url||d.webViewLink))||'';toast(f.name+' uploaded');if(cur===x)paint()})
   .catch(()=>{entry.uploading=false;x.docs.splice(x.docs.indexOf(entry),1);toast('Could not upload '+f.name);if(cur===x)paint()});
})};
gid('pSave').onclick=()=>{if(!syncDur())return;const x=cur;save();x.t=gid('pTitle').value.trim()||'New event';x.d=gid('pDate').value||x.d;const s1=t2h(gid('pS').value),e1=t2h(gid('pE').value);if(s1!=null){const dur=x.e-x.s;x.s=s1;x.e=s1+dur}if(e1!=null&&e1>x.s)x.e=e1;x.c=gid('pCal').value;x.notes=gid('pNotes').value;
  const al=gid('pAlert');x.alertMin=al?ALERTS[al.selectedIndex]:10;
  const isNew=x.isNew;delete x.isNew;
  if(x.sugRef){const i=S.indexOf(x.sugRef);if(i>=0)S.splice(i,1);delete x.sugRef;SELSUG=null;}
  if(isNew)E.push(x);SEL=x;closePop();render();
  toast((isNew?'Created "':'Saved "')+x.t+'"'+(x.ppl.length?' — invites sent to '+x.ppl.map(label).join(', '):''));liveWrite({type:isNew?'create':'patch',event:x});};
(function(){const Sx=gid('pS'),Etm=gid('pE'),X=gid('pX');if(!Sx||!Etm)return;
  const norm=el=>{const v=t2h(el.value);el.classList.toggle('bad',el.value!==''&&v===null);if(v!==null)el.value=fmt(v);return v};
  Sx.onblur=()=>{const a=norm(Sx);if(a!==null&&(t2h(Etm.value)===null||t2h(Etm.value)<=a)){Etm.value=fmt(Math.min(a+1,23.98));}syncDur();};
  Etm.onblur=()=>{norm(Etm);syncDur();};
  [Sx,Etm].forEach(el=>{el.oninput=syncDur;el.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();el.blur();(el===Sx?Etm:gid('pSave')).focus();}};});
  if(X)X.onclick=()=>closePop();
})();
/* One in-page dialog instead of two confirm() boxes. Decline is offered only
   when someone else organised the event; Enter never silently declines. */
function askRemoveOrDecline(evx){
  return new Promise(res=>{
    const old=root.querySelector('.calconfirm');if(old)old.remove();
    const other=!!(evx&&evx.id&&evx.organizer&&!evx.organizerSelf);
    const box=window.document.createElement('div');box.className='calconfirm';
    box.style.cssText='position:fixed;inset:0;z-index:90;display:flex;align-items:center;justify-content:center;background:rgba(5,10,28,.5)';
    box.innerHTML='<div style="background:#fff;color:#101a33;border-radius:14px;padding:18px 20px;min-width:300px;max-width:420px;box-shadow:0 18px 40px rgba(0,0,0,.35);font-size:14px"><b style="display:block;margin-bottom:12px">'+escH(evx&&evx.t||'This event')+'</b><div style="display:flex;gap:8px;flex-wrap:wrap">'
      +'<button data-k="delete" style="height:34px;border-radius:9px;border:0;background:#e0364f;color:#fff;padding:0 12px;font-weight:700">Remove event</button>'
      +(other?'<button data-k="decline" style="height:34px;border-radius:9px;border:1px solid #e8ecf3;background:#fff;padding:0 12px;font-weight:700">Decline</button>':'')
      +'<button data-k="" style="height:34px;border-radius:9px;border:1px solid #e8ecf3;background:#fff;padding:0 12px;font-weight:700">Cancel</button></div></div>';
    const done=k=>{box.remove();res(k)};
    box.addEventListener('click',e=>{const b=e.target.closest('button');if(b)done(b.getAttribute('data-k')||'');else if(e.target===box)done('')});
    box.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();done('')}});
    (root.querySelector('.calwrap')||root).appendChild(box);
    const cancel=box.querySelector('button[data-k=""]');if(cancel)cancel.focus();
  });
}
function removeEvent(target){askRemoveOrDecline(target).then(kind=>{if(!kind||!E.includes(target))return;save();const t=target.t;E.splice(E.indexOf(target),1);if(SEL===target)SEL=null;if(cur===target)closePop();render();toast(kind==='decline'?'Declined "'+t+'"':'Removed "'+t+'"');liveWrite({type:kind,event:target});})}
gid('pDel').onclick=()=>{if(cur)removeEvent(cur)};
gid('pDup').onclick=()=>{if(!cur)return;save();const c=Object.assign({},cur,{ppl:[...cur.ppl],loc:[...cur.loc],links:[...cur.links],docs:[...cur.docs],d:ymd(add(new Date(cur.d+'T12:00'),1))});delete c.id;delete c.isNew;delete c.organizer;delete c.organizerSelf;E.push(c);closePop();SEL=c;render();toast('Duplicated to '+dayName(c.d));liveWrite({type:'create',event:c})};
gid('pCal').onchange=e=>{cur.c=e.target.value;paint()};
on(window,'keydown',e=>{
  const inField=e.target&&e.target.matches&&e.target.matches('input,textarea,select');
  const host=root.host;if(host&&host.offsetParent===null&&!(host.getClientRects&&host.getClientRects().length))return;
  if((e.metaKey||e.ctrlKey)&&(e.key==='='||e.key==='+'||e.key==='-'||e.key==='_')&&(view=='day'||view=='week')){e.preventDefault();setPx(PX+((e.key==='-'||e.key==='_')?-12:12));return}
  if(inField){if(e.key==='Escape')closePop();return}
  if(root.querySelector('.calconfirm'))return;
  if(e.key==='['){e.preventDefault();setRail(!railClosed());return}
  if(SELSUG&&S.includes(SELSUG)&&!pop.classList.contains('open')){
    if(e.key==='Enter'){e.preventDefault();keepSug(S.indexOf(SELSUG),true);return}
    if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();keepSug(S.indexOf(SELSUG),false);return}
  }
  if((e.key==='Delete'||e.key==='Backspace')&&SEL&&E.includes(SEL)&&!pop.classList.contains('open')){e.preventDefault();removeEvent(SEL);return}
  if((e.metaKey||e.ctrlKey)&&e.key==='z'){e.preventDefault();gid('undoB').click();return}
  if(e.key==='Escape')closePop();
});
// natural-language quick add
gid('nlIn').onkeydown=e=>{if(e.key!=='Enter')return;const v=e.target.value.trim();if(!v)return;
  const days=['sun','mon','tue','wed','thu','fri','sat'];let base=new Date(TODAY);const low=v.toLowerCase();
  const dm=low.match(/\b(sun|mon|tue|wed|thu|fri|sat)[a-z]*\b/);if(/\btomorrow\b/.test(low))base=add(base,1);else if(dm){let diff=(days.indexOf(dm[1])-base.getDay()+7)%7;if(diff===0)diff=7;base=add(base,diff)}
  const tm=low.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm|a|p)?\b/)||low.match(/\b(\d{3,4})\b/);const s=tm?t2h(tm[0].replace(/\s/g,'')):10;const dur=/\b(\d+)\s*min/.exec(low);const e1=s+(dur?+dur[1]/60:1);
  const ttl=v.replace(/\b(tomorrow|(sun|mon|tue|wed|thu|fri|sat)[a-z]*)\b/ig,'').replace(/\b\d{1,2}(:\d{2})?\s*(am|pm|a|p)\b/ig,'').replace(/\b\d{3,4}\b/g,'').replace(/\bfor \d+\s*min[a-z]*\b/ig,'').replace(/\s+/g,' ').trim();
  const who=contacts().filter(c=>{const f=String(c.name||'').split(' ')[0].toLowerCase();return f.length>1&&new RegExp('\\b'+f.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b').test(low)}).map(c=>(c.name||c.email)+' <'+c.email+'>');
  save();const x=ensureZoom({d:ymd(base),s:s==null?10:s,e:(s==null?10:s)+(e1-(s==null?10:s)),t:ttl||'New event',c:'meet',ppl:who,loc:[],links:[],docs:[]});E.push(x);SEL=x;e.target.value='';
  render();toast('Created "'+x.t+'" — '+dayName(x.d)+' '+fmt(x.s)+(who.length?' with '+who.map(label).join(', '):''));liveWrite({type:'create',event:x});};

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
    if(typeof opts.onFocus==='function') opts.onFocus(focus);
  }
  function focusTo(k){ if(!k) return; focus=new Date(k+'T12:00'); mini(); render(); if(typeof opts.onFocus==='function') opts.onFocus(focus); }
  function navMonth(dir){
    var n = dir==='prev' ? -1 : 1;
    focus=new Date(focus.getFullYear(), focus.getMonth()+n, 1);
    mini(); render();
  }
  function setRail(closed){
    var wrap=root.querySelector&&root.querySelector('.calwrap');
    if(!wrap)return;
    wrap.classList.toggle('rail-closed',!!closed);
    try{localStorage.setItem('cr_cal_rail',closed?'closed':'open');}catch(e){}
  }
  function railClosed(){var wrap=root.querySelector&&root.querySelector('.calwrap');return !!(wrap&&wrap.classList.contains('rail-closed'));}
  function toggleCal(key){ if(!key) return false; HIDE[key]=!HIDE[key]; mini(); ribbon(); render(); return !HIDE[key]; }
  function openEvent(i){ var x=E[+i]; if(!x) return; SEL=x; render(); openPop(x, window.innerWidth/2-200, 160); }
  if(opts.railClosed)setRail(true);
  else if(!fixture){try{if(localStorage.getItem('cr_cal_rail')==='closed')setRail(true);}catch(e){}}
  window.__redesignCal = { E: E, S: S, render: render, ymd: ymd, fmt: fmt, TODAY: function(){return TODAY;}, sel: function(){return SEL;}, setSel: function(x){SEL=x;}, setView: setView, view: function(){return view;}, nav: nav, navMonth: navMonth, focusTo: focusTo, keepSug: keepSug, keepAll: keepAll, replan: replan, toggleCal: toggleCal, openEvent: openEvent, openPop: openPop, closePop: closePop, setRail: setRail, railClosed: railClosed, ensureZoom: ensureZoom, ZOOM_CHIP: ZOOM_CHIP, FOURM_ZOOM_URL: FOURM_ZOOM_URL, focusYmd: function(){return ymd(focus);}, root: root };
};
