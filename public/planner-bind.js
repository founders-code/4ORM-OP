window.__plannerBody = "<div class=\"page\">\n\n      \n      <div class=\"cmd\">\n        <h1>Planner</h1>\n        <div class=\"vseg\" role=\"group\" aria-label=\"View\"><button data-view=\"timeline\" aria-pressed=\"true\">Timeline</button><button data-view=\"lists\" aria-pressed=\"false\">Lists</button></div>\n        <form class=\"capture capForm\">\n          <input class=\"capText\" placeholder=\"Capture a task or idea, so you don't lose focus\" autocomplete=\"off\" aria-label=\"Capture\">\n          <select class=\"capPipe\" aria-label=\"Where it goes\"></select>\n          <button type=\"submit\">Add</button>\n        </form>\n      </div>\n      <div class=\"focusbar\">\n        <div class=\"fb move2\">\n          <span class=\"k\">One move</span>\n          <select class=\"movePick\" aria-label=\"Today's one move\"></select>\n          <button class=\"tgo\" data-act=\"focus\"><span class=\"flab\">Start</span><span class=\"timerTxt\">25:00</span></button>\n        </div>\n        <button class=\"fb\" data-pop=\"due\"><span class=\"k\">Due 7 days</span><span class=\"n\" id=\"nDue\">0</span></button>\n        <button class=\"fb red\" data-pop=\"red\"><span class=\"k\">Red</span><span class=\"n\" id=\"nRed\">0</span></button>\n        <button class=\"fb gold\" id=\"nextGoal\"><span class=\"k\">Next milestone</span><b></b><span class=\"sm\"></span></button>\n        <div class=\"pop\" id=\"pop-due\" hidden></div>\n        <div class=\"pop\" id=\"pop-red\" hidden></div>\n      </div>\n\n      <section class=\"card\" id=\"boardCard\">\n        <div class=\"bhead\">\n          <nav class=\"chips\" id=\"chipsB\" aria-label=\"Pipelines, drag to reorder\"></nav>\n          <div class=\"bctrl\">\n            <div class=\"seg zseg\" role=\"group\" aria-label=\"Zoom\"><button data-zlv=\"day\">Day</button><button data-zlv=\"week\">Week</button><button data-zlv=\"month\">Month</button><button data-zlv=\"quarter\">Quarter</button><button data-zlv=\"year\">Year</button></div><span class=\"zhint\">Pinch to zoom</span>\n            <button class=\"lbtn\" data-act=\"today\">Today</button>\n            <button class=\"lbtn\" data-view=\"lists\">Back to lists</button>\n            <button class=\"lbtn\" data-pop=\"more\">More</button>\n            <div class=\"pop\" id=\"pop-more\" hidden>\n              <div class=\"menu\">\n                <button data-act=\"links\" id=\"mLinks\">Hide dependency lines</button>\n                <button data-act=\"open\">Open all pipelines</button>\n                <button data-act=\"close\">Close all pipelines</button>\n                              </div>\n              <div class=\"legend\">\n                <span><i class=\"lg ink\"></i>In motion</span><span><i class=\"lg pen\"></i>Pencilled in</span><span><i class=\"lg fade\"></i>Done</span><span><i class=\"lg red\"></i>Overdue or slipping</span><span><i class=\"lg dmd\"></i>Key date</span><span><i class=\"lg dmd\" style=\"--c:var(--gold)\"></i>Milestone</span>\n              </div>\n            </div>\n          </div>\n        </div>\n        <div class=\"addtip\">Pinch to zoom from hours to a year. Drag across an empty part of any pipeline to add a step with those dates; click once for a key date.</div>\n        <div class=\"scroller\" id=\"scroller\"><div class=\"canvas\" id=\"canvas\"></div></div>\n      </section>\n\n      <section class=\"card\" id=\"listCard\">\n        <div class=\"cardhead\"><h2>Lists</h2><div class=\"gseg\" role=\"group\" aria-label=\"Group by\"><button data-group=\"pipe\" aria-pressed=\"true\">By pipeline</button><button data-group=\"date\" aria-pressed=\"false\">By date</button></div><div class=\"legend\">Every row is a bar on the Timeline. Edit here and the Timeline moves.</div></div>\n        <p class=\"hint\">Click any date to pick it from a calendar, or type <b>MMDD</b> (1030 is 30 Oct). Leave Start empty for a key date. Pick a <b>Milestone</b> on any row to make it feed that milestone. Try it: change <b>Speer MSA signed</b> to <b>1204</b> and watch the MVP milestone turn red.</p>\n        <div class=\"lwrap\" id=\"list\"></div>\n      </section>\n    </div>\n<div id=\"scrim\" hidden></div>\n<aside id=\"drawer\" hidden aria-live=\"polite\"></aside>\n<div class=\"dpk\" id=\"dp\" role=\"dialog\" aria-label=\"Pick a date\"><div class=\"dph\"><button data-dp=\"prev\">Prev</button><b id=\"dpM\"></b><button data-dp=\"next\">Next</button></div><div class=\"dpg\" id=\"dpG\"></div><div class=\"dpf\"><button data-dp=\"today\">Today</button><button data-dp=\"clear\" id=\"dpClear\">Clear</button><span class=\"lab\" id=\"dpL\"></span></div>";
window.bindPlannerPage = function (root, liveItems, livePrefs) {
  if (!root) return;
  try {
  var qs = Element.prototype.querySelector.bind(root);
  var qsa = Element.prototype.querySelectorAll.bind(root);
  var on = EventTarget.prototype.addEventListener.bind(root);
  var document = root;
  document.getElementById = function (id) { return qs('#' + id); };
  document.querySelector = qs;
  document.querySelectorAll = qsa;
  document.addEventListener = on;
  document.createElement = function (t) { return window.document.createElement(t); };
  document.createTextNode = function (t) { return window.document.createTextNode(t); };
  root.__pageBound = true;


(function(){
const DAY=864e5;
const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const WD=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const dn=s=>{const[a,b,c]=s.split('-').map(Number);return Math.round(Date.UTC(a,b-1,c)/DAY)};
const START=dn('2026-10-01'); let END=dn('2027-06-30'); let DAYS=END-START+1;
const now=new Date();
const vanIso=(typeof window.vancouverTodayIso==='function'&&window.vancouverTodayIso())||'';
const TODAY=vanIso&&/^\d{4}-\d{2}-\d{2}$/.test(vanIso)?dn(vanIso):Math.round(Date.UTC(now.getFullYear(),now.getMonth(),now.getDate())/DAY);
const D=d=>new Date(d*DAY);
const fmt=d=>D(d).getUTCDate()+' '+MON[D(d).getUTCMonth()];
const fmtY=d=>fmt(d)+' '+D(d).getUTCFullYear();
const fmtW=d=>WD[D(d).getUTCDay()]+' '+fmt(d);
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const rel=n=>n===0?'today':n===1?'tomorrow':n===-1?'yesterday':n>0?'in '+n+' days':Math.abs(n)+' days ago';
(document.getElementById('clock')||{}).textContent=WD[now.getDay()]+', '+MON[now.getMonth()]+' '+now.getDate();
const $$=s=>document.querySelectorAll(s);

function monthly(day){const o=[];let y=2026,m=9;for(;;){const d=Math.round(Date.UTC(y,m,day)/DAY);if(d>END)break;if(d>=START)o.push(d);m++;if(m>11){m=0;y++}}return o}
function weekly(){const o=[];let d=START;while(D(d).getUTCDay()!==1)d++;for(;d<=END;d+=7)o.push(d);return o}

const PIPES=[
 {id:'corporate',name:'Corporate',c:'--p1'},{id:'capital',name:'Capital',c:'--p2'},{id:'revenue',name:'Revenue',c:'--p3'},{id:'marketing',name:'Marketing',c:'--p4'},
 {id:'development',name:'Development',c:'--p5'},{id:'partnership',name:'Partnership',c:'--p6'},{id:'regulators',name:'Regulators',c:'--p7'},{id:'team',name:'Team',c:'--p8'}];
const GOALS={id:'goals',name:'Milestones',c:'--gold'};
const pipe=id=>id==='goals'?GOALS:PIPES.find(p=>p.id===id);
const pc=id=>pipe(id).c;

const RAW=[
 {id:'g-preseed',p:'goals',n:'Pre-seed closed',m:'2026-10-30',o:'Bruce, Chad',note:'The raise window closes. Everything feeding this has to land by then.'},
 {id:'g-1000',p:'goals',n:'1,000 people using 4ormIQ',m:'2027-01-29',o:'Chad'},
 {id:'g-seed',p:'goals',n:'Seed round open',m:'2027-05-03',o:'Bruce'},
 {id:'g-mvp',p:'goals',n:'MVP demo-ready',m:'2027-05-28',o:'Mathew'},
 {id:'g-pilot',p:'goals',n:'First paid pilot live',m:'2027-06-07',o:'Kevin'},
 {id:'cim',p:'corporate',t:'Documents',n:'CIM draft',s:'2026-10-01',e:'2026-11-13',o:'Chad',g:'g-seed',note:'Confidential information memorandum.',tasks:[['Executive summary',1],['Market and challenge pages',1],['Financial pages',0],['Team pages',0],['Counsel read-through',0]]},
 {id:'cimsend',p:'corporate',t:'Documents',n:'CIM ready to send',m:'2026-11-20',o:'Chad',g:'g-seed',dep:['cim']},
 {id:'plan27',p:'corporate',t:'Planning',n:'2027 operating plan',s:'2026-11-30',e:'2026-12-18',o:'Chad',g:'g-seed',dep:['cimsend']},
 {id:'q4rev',p:'corporate',t:'Planning',n:'Q4 founders review',m:'2026-12-21',o:'Founders',dep:['plan27']},
 {id:'q1board',p:'corporate',t:'Governance',n:'Q1 board pack',s:'2027-01-11',e:'2027-01-22',o:'Chad',dep:['q4rev']},
 {id:'q2board',p:'corporate',t:'Governance',n:'Q2 board pack',s:'2027-04-05',e:'2027-04-16',o:'Chad'},
 {id:'preseed',p:'capital',t:'Pre-seed',n:'Pre-seed raise window',s:'2026-08-01',e:'2026-10-30',o:'Bruce, Chad',g:'g-preseed',note:'90-day window that opened 1 Aug 2026.',tasks:[['Close friends-and-family to $250,000',0],['Open Zahar, BJ and Daryl, one $25,000 chunk each',0],['Widen the round past one cheque',0]]},
 {id:'angels',p:'capital',t:'Angels',n:'Angel outreach, asking for advice',s:'2026-10-14',e:'2026-12-18',o:'Chad',g:'g-seed',note:'LinkedIn template approved. Ask for perspective, not money.'},
 {id:'ycdec',p:'capital',t:'Accelerators',n:'Y Combinator decision',m:'2026-12-11',o:'Chad',g:'g-seed'},
 {id:'invq4',p:'capital',t:'Investor relations',n:'Q4 investor letter',m:'2027-01-15',o:'Chad',g:'g-seed',dep:['q4rev']},
 {id:'invq1',p:'capital',t:'Investor relations',n:'Q1 investor letter',m:'2027-04-15',o:'Chad'},
 {id:'seedprep',p:'capital',t:'Seed',n:'Seed round preparation',s:'2027-02-01',e:'2027-04-30',o:'Bruce, Chad',g:'g-seed',dep:['dpconv','invq4']},
 {id:'dppack',p:'revenue',t:'Design partners',n:'Design partner package',s:'2026-10-19',e:'2026-11-13',o:'Kevin, Chad',g:'g-pilot',tasks:[['One-page offer',1],['Pilot terms outline',0],['Short list of 20 firms',0]]},
 {id:'dpconv',p:'revenue',t:'Design partners',n:'First design partner conversations',s:'2026-11-16',e:'2026-12-18',o:'Kevin',g:'g-pilot',dep:['dppack']},
 {id:'loi',p:'revenue',t:'Pilots',n:'Pilot terms and letters of intent',s:'2027-01-11',e:'2027-03-12',o:'Kevin',g:'g-pilot',dep:['dpconv']},
 {id:'brokerfree',p:'revenue',t:'4ormIQ for Brokers',n:'Free tier: brokerage sign-ups',s:'2026-12-14',e:'2027-03-31',o:'Kevin',g:'g-pilot',dep:['brokers1']},
 {id:'testers',p:'marketing',t:'4ormIQ users',n:'100 consumer testers from the trader group',s:'2026-10-26',e:'2026-11-27',o:'Chad',g:'g-1000'},
 {id:'k1000',p:'marketing',t:'4ormIQ users',n:'1,000-user push',s:'2026-11-02',e:'2027-01-29',o:'Chad',g:'g-1000',dep:['iqready']},
 {id:'video',p:'marketing',t:'Content',n:'LinkedIn video, five days a week',s:'2026-10-26',e:'2027-06-30',o:'Chad'},
 {id:'paper',p:'marketing',t:'Research',n:'Research paper, monthly',dates:monthly(28),o:'Chad'},
 {id:'news',p:'marketing',t:'Research',n:'Newsletter, monthly',dates:monthly(15),o:'Chad'},
 {id:'medium',p:'marketing',t:'Public',n:'Medium package',s:'2026-11-02',e:'2026-11-20',o:'Chad',g:'g-1000'},
 {id:'counsel',p:'development',t:'4ormIQ',n:'4ormIQ counsel conversation',s:'2026-10-05',e:'2026-10-30',o:'Chad',g:'g-1000'},
 {id:'iqready',p:'development',t:'4ormIQ',n:'4ormIQ open for 1,000 users',m:'2026-10-30',o:'Chad',g:'g-1000',dep:['counsel']},
 {id:'brokers1',p:'development',t:'4ormIQ for Brokers',n:'BC first release',s:'2026-10-22',e:'2026-12-11',o:'Chad',g:'g-pilot',note:'Find the scenario fast, understand the trade-offs, verify the official source. Everything cited.'},
 {id:'ops',p:'development',t:'4orm Ops',n:'Timeline page in 4ormop',s:'2026-10-26',e:'2026-11-13',o:'Chad'},
 {id:'disc',p:'development',t:'Platform build',n:'Speer phase 1: discovery and architecture',s:'2026-11-16',e:'2027-01-15',o:'Mathew, Zed',g:'g-mvp',dep:['msa']},
 {id:'mvp',p:'development',t:'Platform build',n:'Speer phase 2: MVP design and build',s:'2027-01-18',e:'2027-05-28',o:'Mathew',g:'g-mvp',dep:['disc']},
 {id:'redline',p:'partnership',t:'Speer',n:'MSA redline with Speer',s:'2026-10-01',e:'2026-11-06',o:'Chad',g:'g-mvp',tasks:[['Send redone MSA to Speer',1],['Speer comments back',0],['Ontario-law review',0]]},
 {id:'msa',p:'partnership',t:'Speer',n:'Speer MSA signed',m:'2026-11-13',o:'Chad',g:'g-mvp',dep:['redline']},
 {id:'sred',p:'partnership',t:'Speer',n:'SR&ED and grant sourcing',s:'2027-01-04',e:'2027-02-26',o:'Chad',dep:['msa']},
 {id:'brokerage',p:'partnership',t:'Channels',n:'BC brokerage partner outreach',s:'2026-12-14',e:'2027-02-26',o:'Kevin',g:'g-pilot',dep:['brokers1']},
 {id:'regpack',p:'regulators',t:'Package',n:'Regulator outreach package',s:'2026-10-19',e:'2026-11-13',o:'Chad'},
 {id:'fasken',p:'regulators',t:'Introductions',n:'Introductions through Mike Stevens',s:'2026-11-16',e:'2027-01-29',o:'Mike Stevens (Fasken)',dep:['regpack']},
 {id:'reg1',p:'regulators',t:'Introductions',n:'First regulator meeting',m:'2027-02-05',o:'Chad',g:'g-seed',dep:['fasken']},
 {id:'direct',p:'regulators',t:'Direct',n:'Fraud Prevention Forum, CCIR, CLHIA',s:'2026-11-16',e:'2026-12-18',o:'Chad',dep:['regpack']},
 {id:'sync',p:'team',t:'Founders',n:'Founders sync, weekly',dates:weekly(),o:'Chad, Bruce, Kevin'},
 {id:'advisors',p:'team',t:'Advisors',n:'Advisor onboarding, six-month clock',s:'2026-11-02',e:'2027-04-30',o:'Chad'},
 {id:'arch',p:'team',t:'Technology',n:'Architecture review with Zed',s:'2026-11-23',e:'2026-12-04',o:'Zed',g:'g-mvp',dep:['msa']},
 {id:'hire',p:'team',t:'Technology',n:'Technology hire decision',m:'2027-01-22',o:'Founders',g:'g-mvp',dep:['disc']}
];
function hydrate(){return RAW.map(r=>{const it={id:r.id,p:r.p,t:r.t||'',n:r.n,o:r.o||'',note:r.note||'',dep:(r.dep||[]).slice(),g:r.g||'',st:'',tasks:(r.tasks||[]).map(([n,d])=>({n,d:!!d}))};
  if(r.dates){it.kind='series';it.dates=r.dates;it.s=r.dates[0];it.e=r.dates[r.dates.length-1]}
  else if(r.p==='goals'){it.kind='goal';it.s=it.e=dn(r.m)}
  else if(r.m){it.kind='ms';it.s=it.e=dn(r.m)}
  else{it.kind='span';it.s=dn(r.s);it.e=dn(r.e)}
  return it})}

const KEY='4ormop-timeline-mock-v2';
let ITEMS,state;
function defaults(){return {hidden:[],open:['goals','capital','development'],zoom:'11',links:true,move:'',tx:{},order:PIPES.map(p=>p.id),top:'b',view:'timeline',group:'pipe'}}

if(!ITEMS){ITEMS=(liveItems&&liveItems.length)?liveItems:hydrate();state=defaults()}
if(livePrefs){
  if(livePrefs.zoom!=null&&livePrefs.zoom!=='')state.zoom=String(livePrefs.zoom);
  if(livePrefs.view)state.view=String(livePrefs.view);
  if(livePrefs.group_by||livePrefs.group)state.group=String(livePrefs.group_by||livePrefs.group);
  if(Array.isArray(livePrefs.hidden))state.hidden=livePrefs.hidden;
  if(Array.isArray(livePrefs.open)&&livePrefs.open.length)state.open=livePrefs.open;
  if(Array.isArray(livePrefs.pipeline_order)&&livePrefs.pipeline_order.length)state.order=livePrefs.pipeline_order;
}
/* /planner always lands on Timeline; Lists stays one click away (prompt 13). */
try{
  var landPath=String(location.pathname||'');
  var landQ=String(location.search||'');
  var onPlanner=/\/planner\/?$/.test(landPath)||/[?&]view=planner(?:&|$)/.test(landQ);
  if(onPlanner&&!/[?&]view=lists(?:&|$)/.test(landQ)) state.view='timeline';
}catch(eLand){}
state.hidden=new Set(state.hidden);state.open=new Set(state.open);
PIPES.forEach(p=>{if(!state.order.includes(p.id))state.order.push(p.id)});
function isoOf(d){if(d==null||Number.isNaN(d))return '';const x=D(d);return x.getUTCFullYear()+'-'+String(x.getUTCMonth()+1).padStart(2,'0')+'-'+String(x.getUTCDate()).padStart(2,'0')}
function liveOk(){try{return !/(?:^|[?&])fixture=mockup(?:&|$)/.test(String(location.search||'')) && typeof window.authFetch==='function'}catch(e){return false}}
function save(){
  if(!liveOk())return;
  window.authFetch('/api/timeline/prefs',{method:'PATCH',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({
    pipeline_order:state.order,hidden:[...state.hidden],open:[...state.open],zoom:state.zoom,show_links:!!state.links,one_move_id:state.move||null,view:state.view||'timeline',group_by:state.group||'pipe'
  })}).catch(function(){});
}
function persistItem(i){
  if(!liveOk()||!i||!i.id||String(i.id).indexOf('n')===0&&String(i.id).length<20)return;
  var body={n:i.n,o:i.o,st:i.st,start_date:i.kind==='ms'?'':i.kind==='goal'?(i.s<i.e?isoOf(i.s):''):isoOf(i.s),due_date:isoOf(i.e)};
  body.plan_date=i.ps!=null?isoOf(i.ps):'';
  if(i.kind!=='goal'){body.t=i.t||'';body.g=i.g||''}
  if(i.kind==='span')body.kind='span';else if(i.kind==='ms')body.kind='key_date';
  body.note=i.note||'';
  window.authFetch('/api/timeline/items/'+encodeURIComponent(i.id),{method:'PATCH',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(body)}).catch(function(){});
}
const ordered=()=>state.order.map(id=>pipe(id)).filter(Boolean);
/* View: Timeline (landing) or Lists. Saved in prefs (view). Group: by pipeline (default) or by date. */
function applyView(){const pg=document.querySelector('.page');if(!pg)return;const v=state.view==='timeline'?'timeline':'lists';pg.classList.toggle('v-lists',v==='lists');pg.classList.toggle('v-timeline',v==='timeline');pg.classList.toggle('g-date',(state.group||'pipe')==='date');
  $$('[data-view]').forEach(b=>{if(b.closest('.vseg'))b.setAttribute('aria-pressed',String(b.dataset.view===v))});
  $$('[data-group]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.group===(state.group||'pipe'))))}
const visPipes=()=>ordered().filter(p=>!state.hidden.has(p.id));
const GL=()=>ITEMS.filter(i=>i.kind==='goal').sort((a,b)=>a.e-b.e);
const WORK=()=>ITEMS.filter(i=>i.kind!=='goal');
/* Milestone dates: planning (faint lead-in), start, complete. Without a saved start, the work starts when its first feeder does (or 3 weeks out); planning defaults to 2 weeks before the start. */
function gStart(g){if(g.s!=null&&g.s<g.e)return g.s;const f=(typeof feeders==='function'?feeders(g):[]).map(i=>i.s).filter(v=>v!=null&&v<g.e);return f.length?Math.min.apply(null,f):g.e-21}
function gPlan(g){return g.ps!=null&&g.ps<=gStart(g)?g.ps:gStart(g)-14}

let byId={},rev={};
function index(){byId={};rev={};ITEMS.forEach(i=>byId[i.id]=i);ITEMS.forEach(i=>{i.dep=i.dep.filter(d=>byId[d]&&byId[d].kind!=='goal');if(i.g&&!byId[i.g])i.g='';i.dep.forEach(d=>(rev[d]=rev[d]||[]).push(i.id))})}

function phase(i){if(i.kind==='series')return 'ongoing';if(i.st==='done')return 'done';if(i.e<TODAY)return 'overdue';if(i.s<=TODAY)return i.kind==='goal'?'planned':'active';return 'planned'}
function badDeps(i){if(i.kind==='series'||i.kind==='goal'||i.st==='done')return [];return i.dep.filter(d=>byId[d].kind!=='series'&&byId[d].st!=='done'&&byId[d].e>i.s)}
function feeders(g){return ITEMS.filter(i=>i.g===g.id)}
function lateFor(g){return feeders(g).filter(i=>i.kind!=='series'&&i.st!=='done'&&(i.e>g.e||phase(i)==='overdue'||badDeps(i).length))}
function risky(i){if(i.kind==='goal')return i.st!=='done'&&lateFor(i).length>0;return i.st==='risk'||badDeps(i).length>0}
function attention(i){return phase(i)==='overdue'||risky(i)}
function nextOf(i){return i.dates.find(d=>d>=TODAY)}
function prog(i,s){if(i.st==='done')return 100;if(i.tasks&&i.tasks.length)return Math.max(4,i.tasks.filter(t=>t.d).length/i.tasks.length*100);return Math.max(4,Math.min(100,(TODAY-s+1)/(i.e-s+1)*100))}
function itemPct(i){if(i.st==='done')return 100;const ph=phase(i);if(ph==='planned')return i.tasks.length?i.tasks.filter(t=>t.d).length/i.tasks.length*100:0;if(i.kind==='ms')return ph==='overdue'?90:0;return Math.min(99,prog(i,Math.max(i.s,START)))}
function goalPct(g){const f=feeders(g).filter(i=>i.kind!=='series');if(!f.length)return 0;return Math.round(f.reduce((a,i)=>a+itemPct(i),0)/f.length)}
function cls(i){return phase(i)+(risky(i)?' risk':'')+(i.g?' g':'')}

const ZOOM={3:20,6:11,9:7};
const canvas=document.getElementById('canvas'),scroller=document.getElementById('scroller');
let ppd=11,W=0,LW=252,pinned=null;
const x=d=>(d-START)*ppd;
function months(){const o=[];let y=D(START).getUTCFullYear(),m=D(START).getUTCMonth();for(;;){const s=Math.round(Date.UTC(y,m,1)/DAY);if(s>END)break;const e=Math.round(Date.UTC(y,m+1,1)/DAY)-1;o.push({s:Math.max(s,START),e:Math.min(e,END),m,y});m++;if(m>11){m=0;y++}}return o}
function pack(lv,x0,x1,gap){let L=lv.findIndex(e=>x0>e+gap);if(L<0){L=lv.length;lv.push(-1e9)}lv[L]=x1;return L}
const tw=s=>s.length*6.9+18;

/* Controls and tops */
function chipsHtml(){let c=`<button class="chip" data-all="1">All<span class="ct">${WORK().length}</span></button>`;
  ordered().forEach(p=>{const off=state.hidden.has(p.id);const n=ITEMS.filter(i=>i.p===p.id).length;
    c+=`<button class="chip${off?' off':''}" data-chip="${p.id}" data-drag="${p.id}" draggable="true" aria-pressed="${!off}" title="Click to show or hide. Drag to reorder." style="--c:var(${p.c})"><span class="sw"></span>${p.name}<span class="ct">${n}</span></button>`});return c}
function renderControls(){
  
  $$('[data-top]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.top===state.top));
  $$('[data-zlv]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.zlv===levelName())));
  $$('[data-act="links"]').forEach(b=>b.setAttribute('aria-pressed',state.links));
  document.getElementById('mLinks').textContent=state.links?'Hide dependency lines':'Show dependency lines';
  const ch=chipsHtml();(document.getElementById('chipsA')||{}).innerHTML=ch;document.getElementById('chipsB').innerHTML=ch;
  $$('.capPipe').forEach(cp=>{const v=cp.value;cp.innerHTML=`<option value="goals">Milestones</option>`+ordered().map(p=>`<option value="${p.id}">${p.name}</option>`).join('');cp.value=v||ordered()[0].id});
}
function dueItems(){const lim=TODAY+7;return ITEMS.filter(i=>(i.kind==='goal'||!state.hidden.has(i.p))&&i.kind!=='series'&&i.st!=='done'&&i.e<=lim).sort((a,b)=>a.e-b.e)}
function redItems(){return ITEMS.filter(i=>(i.kind==='goal'||!state.hidden.has(i.p))&&attention(i)).sort((a,b)=>a.e-b.e)}
function drow(i){const p=pipe(i.p);const late=i.e<TODAY&&i.st!=='done';const nLate=i.kind==='goal'?lateFor(i).length:0;const why=i.kind==='goal'&&risky(i)?`${nLate} feeding item${nLate===1?'':'s'} late`:badDeps(i).length?'Slipping':late?'Overdue':fmtW(i.e);
  return `<button class="drow" data-open="${i.id}" data-reveal="1" style="--c:var(${p.c})"><span class="w${late||risky(i)?' late':''}">${why}</span><b>${esc(i.n)}</b><span class="pp">${p.name}</span></button>`}
function renderTop(){
  const vis=WORK().filter(i=>!state.hidden.has(i.p));
  const act=vis.filter(i=>phase(i)==='active').length,red=redItems(),due=dueItems();
  const ng=GL().find(g=>g.e>=TODAY&&g.st!=='done');
  (document.getElementById('stats')||{}).innerHTML=`<span><b>${vis.length}</b> items</span><span><b>${act}</b> in motion</span>${red.length?`<span><em>${red.length} overdue or slipping</em></span>`:'<span>nothing slipping</span>'}`+(ng?`<span>next milestone <b>${esc(ng.n)}</b> ${rel(ng.e-TODAY)}</span>`:'');
  document.getElementById('nDue').textContent=due.length;document.getElementById('nRed').textContent=red.length;
  const nb=document.getElementById('nextGoal');
  if(ng){nb.dataset.open=ng.id;nb.dataset.reveal='1';nb.querySelector('b').textContent=ng.n;nb.querySelector('.sm').textContent=`${rel(ng.e-TODAY)} · ${goalPct(ng)}% done`}
  else{nb.querySelector('b').textContent='None set';nb.querySelector('.sm').textContent=''}
  document.getElementById('pop-due').innerHTML=`<h4>Due in the next 7 days</h4>`+(due.length?due.map(drow).join(''):'<p class="none" style="padding:8px">Nothing due this week.</p>');
  document.getElementById('pop-red').innerHTML=`<h4>Overdue or slipping</h4>`+(red.length?red.map(drow).join(''):'<p class="none" style="padding:8px">Nothing is red. Good.</p>');
  const lim=TODAY+7;(document.getElementById('dueRange')||{}).textContent=fmt(TODAY)+' to '+fmt(lim);
  (document.getElementById('dueList')||{}).innerHTML=due.length?due.slice(0,6).map(drow).join('')+(due.length>6?`<div class="more">${due.length-6} more in the list below</div>`:''):'<p class="none" style="padding:8px">Nothing due this week.</p>';
  const cand=WORK().filter(i=>i.kind!=='series'&&i.st!=='done'&&i.s<=TODAY+7&&i.e>=TODAY-30).sort((a,b)=>a.e-b.e);
  $$('.movePick').forEach(pk=>pk.innerHTML='<option value="">Pick today\'s one move</option>'+cand.map(i=>`<option value="${i.id}"${state.move===i.id?' selected':''}>${esc(i.n)} · due ${fmt(i.e)}</option>`).join(''));
  const mv=byId[state.move];
  (document.getElementById('moveName')||{}).textContent=mv?mv.n:"Pick today's one move";
  (document.getElementById('moveSub')||{}).textContent=mv?`${pipe(mv.p).name} · due ${fmtW(mv.e)}, ${rel(mv.e-TODAY)}`:'Choose from what is in motion or due this week.';
}

/* Board */
function ppdOf(z){const n=Number(z);if(Number.isFinite(n)&&n>0.4)return n;return ZOOM[z]||11}
function trackW(){return Math.max(400,(scroller.clientWidth||1100)-LW)}
const LV={day:()=>trackW()/1.2,week:()=>trackW()/8,month:()=>trackW()/32,quarter:()=>trackW()/95,year:()=>trackW()/370};
function levelName(){const p=ppdOf(state.zoom);let best='month',bd=1e9;for(const k in LV){const d=Math.abs(Math.log(p/LV[k]()));if(d<bd){bd=d;best=k}}return best}
function extendYear(){DAYS=END-START+1; if(ppdOf(state.zoom)<=LV.year()*1.2){const need=START+370; if(END<need){END=need;DAYS=END-START+1}}}
function renderBoard(){
  extendYear();
  ppd=ppdOf(state.zoom);W=DAYS*ppd;LW=innerWidth<640?150:252;
  const vis=visPipes();
  let h=`<div class="bands" style="left:${LW}px;width:${W}px">`;
  months().forEach((m,k)=>{h+=`<div class="band${k%2?' alt':''}" style="left:${x(m.s)}px;width:${(m.e-m.s+1)*ppd}px"></div>`});
  if(ppd>=34){const v0=Math.floor((scroller.scrollLeft||0)/ppd)+START-3,v1=v0+Math.ceil(trackW()/ppd)+6;for(let d=Math.max(START,v0);d<=Math.min(END,v1);d++){h+=`<div class="hl d" style="left:${x(d)}px"></div>`;if(ppd>=320){const st=ppd>=1600?1:ppd>=700?2:6;for(let q=st;q<24;q+=st)h+=`<div class="hl" style="left:${x(d)+q/24*ppd}px"></div>`}}}
  GL().forEach(g=>{h+=`<div class="gline" style="left:${x(g.e)+ppd/2-1}px"></div>`});
  if(TODAY>=START&&TODAY<=END)h+=`<div class="today" style="left:${x(TODAY)+ppd/2-1}px"></div>`;
  h+=`</div><svg class="links" id="links" style="left:${LW}px" width="${W}" height="10"></svg>`;
  h+=hdrRow()+goalRow()+loadRow(vis)+msRow(vis);
  vis.forEach(p=>{h+=laneRow(p);if(state.open.has(p.id))h+=trackRows(p)});
  if(!vis.length)h+=`<div class="row"><div class="lab"><span class="ltitle">Nothing shown</span></div><div class="trk empty" style="width:${W}px">Turn a pipeline on above.</div></div>`;
  h+=`<div style="height:18px"></div>`;
  canvas.style.setProperty('--lw',LW+'px');canvas.style.width=(LW+W)+'px';
  canvas.innerHTML=h;
  requestAnimationFrame(()=>{drawLinks();if(pinned)applyFocus(pinned);if(typeof stickGoalLabels==='function')stickGoalLabels()});
}
function hdrRow(){let t='';const vis0=Math.floor((scroller.scrollLeft||0)/ppd)+START-3,vis1=vis0+Math.ceil(trackW()/ppd)+6;
  if(ppd<4){months().forEach((m,k)=>{t+=`<div class="mo" style="left:${x(m.s)}px">${m.m%3===0?'Q'+(m.m/3+1)+' ':''}${MON[m.m]}${(k===0||m.m===0)?`<span>${m.y}</span>`:''}</div>`})}
  else{months().forEach((m,k)=>{t+=`<div class="mo" style="left:${x(m.s)}px">${MON[m.m]}${(k===0||m.m===0)?`<span>${m.y}</span>`:''}</div>`})}
  if(ppd>=4&&ppd<18){let d=START;while(D(d).getUTCDay()!==1)d++;for(;d<=END;d+=7)t+=`<span class="wk" style="left:${x(d)}px">${D(d).getUTCDate()}</span>`}
  if(ppd>=18&&ppd<140){for(let d=Math.max(START,vis0);d<=Math.min(END,vis1);d++){const w=D(d).getUTCDay();if(ppd<34&&w!==1)continue;t+=`<span class="hh${w===1?' dy':''}" style="left:${x(d)}px">${ppd>=60?WD[w]+' ':''}${D(d).getUTCDate()}</span>`}}
  if(ppd>=140){const step=ppd>=1600?1:ppd>=700?2:ppd>=320?6:12;
    for(let d=Math.max(START,vis0);d<=Math.min(END,vis1);d++){t+=`<span class="hh dy" style="left:${x(d)}px;bottom:24px">${WD[D(d).getUTCDay()]} ${D(d).getUTCDate()} ${MON[D(d).getUTCMonth()]}</span>`;
      for(let q=step;q<24;q+=step)t+=`<span class="hh" style="left:${x(d)+q/24*ppd}px">${q}:00</span>`}}
  if(TODAY>=START&&TODAY<=END)t+=`<span class="todaytag" style="left:${x(TODAY)+ppd/2}px">Today ${fmt(TODAY)}</span>`;
  return `<div class="row hdr"><div class="lab corner"><span class="kick">Pipeline</span></div><div class="trk" style="width:${W}px">${t}</div></div>`}
function goalRow(){const gs=GL();const lv=[];let o='';
  gs.forEach(g=>{const ps=Math.max(START,gPlan(g)),st=Math.max(START,gStart(g)),en=g.e;const xp=x(ps),xs=x(st),xe=x(en)+ppd;const pct=goalPct(g);
    const lbl=`${g.n}`;const L=pack(lv,xp,Math.max(xe,xs+tw(lbl)+150)+14,10);const top=10+L*36;
    o+=`<div class="gspan${g.st==='done'?' done':''}${risky(g)?' risk':''}" data-id="${g.id}" data-open="${g.id}" style="left:${xp}px;top:${top}px;width:${Math.max(xe-xp,24)}px">`
      +`<i class="gplan" style="width:${Math.max(xs-xp,0)}px"></i><i class="grun" style="left:${xs-xp}px"><b style="width:${pct}%"></b></i><i class="gdia"></i>`
      +`<span class="glab" style="left:${xs-xp+8}px">${esc(lbl)}<small>${fmt(st)} to ${fmt(en)}${pct?' · '+pct+'%':''}</small></span></div>`});
  const red=gs.filter(risky).length;
  return `<div class="row goalrow master"><div class="lab"><span class="ltitle">Milestones</span><span class="lmeta">${gs.length} big goals${red?` &middot; <em>${red} at risk</em>`:''}</span></div><div class="trk" style="width:${W}px;height:${Math.max(56,16+lv.length*36)}px">${o}</div></div>`}
function loadRow(vis){
  const spans=WORK().filter(i=>i.kind==='span');let max=1,peak=null;const weeks=[];
  for(let w=START;w<=END;w+=7){const we=Math.min(w+6,END);const seg=vis.map(p=>({p,n:spans.filter(i=>i.p===p.id&&i.s<=we&&i.e>=w).length}));
    const tot=seg.reduce((a,b)=>a+b.n,0);if(tot>max)max=tot;if(!peak||tot>peak.tot)peak={w,tot};weeks.push({w,we,seg})}
  const H=96,unit=Math.min(11,(H-8)/max);
  let s=`<svg class="load" width="${W}" height="${H}" role="img" aria-label="Items running per week">`;
  weeks.forEach(wk=>{let y=H-2;const bw=Math.max(2,(wk.we-wk.w+1)*ppd-3);
    wk.seg.forEach(g=>{if(!g.n)return;const hh=g.n*unit;y-=hh;const rh=Math.max(hh-2.5,1.5);s+=`<rect x="${x(wk.w)+2}" y="${y.toFixed(1)}" width="${Math.max(bw-1,2)}" height="${rh.toFixed(1)}" rx="${Math.min(6,rh/2,bw/2).toFixed(1)}" style="fill:var(${g.p.c});fill-opacity:.92"><title>Week of ${fmt(wk.w)}: ${g.n} ${g.p.name}</title></rect>`})});
  s+='</svg>';
  return `<div class="row master"><div class="lab"><span class="ltitle">Workload</span><span class="lmeta">${peak&&peak.tot?`peak ${peak.tot} running, week of ${fmt(peak.w)}`:'no running items'}</span></div><div class="trk" style="width:${W}px;padding-top:4px">${s}</div></div>`}
function msRow(vis){
  const ms=WORK().filter(i=>i.kind==='ms'&&!state.hidden.has(i.p)).sort((a,b)=>a.s-b.s);const lv=[];let o='';
  ms.forEach(i=>{const x0=x(i.s)+ppd/2-6;const L=pack(lv,x0,x0+18+tw(i.n)+40,8);
    o+=`<button class="msi ${cls(i)}" data-open="${i.id}" style="left:${x0}px;top:${10+L*28}px;--c:var(${pc(i.p)})"><i class="dia"></i>${esc(i.n)}<small>${fmt(i.s)}</small></button>`});
  return `<div class="row master"><div class="lab"><span class="ltitle">Key dates</span><span class="lmeta">${ms.length} across ${vis.length} pipeline${vis.length===1?'':'s'}</span></div><div class="trk" style="width:${W}px;height:${Math.max(48,16+lv.length*28)}px">${o}</div></div>`}
function laneRow(p){
  const its=ITEMS.filter(i=>i.p===p.id);const open=state.open.has(p.id);
  const act=its.filter(i=>phase(i)==='active').length,att=its.filter(attention).length;
  const nx=its.filter(i=>i.kind==='ms'&&i.s>=TODAY&&i.st!=='done').sort((a,b)=>a.s-b.s)[0];
  let trk='',H=84;
  if(open){const sp=its.filter(i=>i.kind!=='series');if(sp.length){const a=Math.max(START,Math.min(...sp.map(i=>i.s))),b=Math.max(...sp.map(i=>i.e));
    const pct=Math.max(0,Math.min(100,(TODAY-a+1)/(b-a+1)*100));trk=`<div class="range" style="left:${x(a)}px;width:${(b-a+1)*ppd}px;top:${H/2-4}px"><i style="width:${pct}%"></i></div>`}}
  else{const lv=[];const ent=[];const ts=s=>s.length*6.3+16;
    its.filter(i=>i.kind!=='series').sort((a,b)=>a.s-b.s).forEach(i=>{const s=Math.max(i.s,START);
      if(i.kind==='ms'){const x0=x(s)+ppd/2-5;ent.push({i,x0,L:pack(lv,x0,x0+16+ts(i.n),8)})}
      else{const bx=x(s),bw=Math.max((i.e-s+1)*ppd,8),w2=ts(i.n),nar=bw<w2;ent.push({i,x0:bx,w:bw,nar,pr:prog(i,s),L:pack(lv,bx,nar?bx+bw+7+w2:bx+bw,8)})}});
    const n=lv.length;H=Math.max(84,n*29+22);const top=(H-n*29)/2+2;
    ent.forEach(e=>{const tp=top+e.L*29;
      trk+=e.i.kind==='ms'?`<button class="msi sm ${cls(e.i)}" data-id="${e.i.id}" data-open="${e.i.id}" style="left:${e.x0}px;top:${tp}px"><i class="dia anchor"></i>${esc(e.i.n)}</button>`
        :`<button class="bar sm ${cls(e.i)}${e.nar?' narrow':''} anchor" data-id="${e.i.id}" data-open="${e.i.id}" style="left:${e.x0}px;top:${tp}px;width:${e.w}px;--p:${e.pr.toFixed(1)}%"><span>${esc(e.i.n)}</span></button>`})}
  return `<div class="row lane" data-pipe="${p.id}" style="--c:var(${p.c})"><div class="lab" draggable="true" data-drag="${p.id}"><button class="lanebtn" data-toggle="${p.id}" aria-expanded="${open}"><span class="l1"><span class="nm">${p.name}</span><span class="oc">${open?'Close':'Open'}</span></span><span class="lmeta">${its.length} items &middot; ${act} in motion${att?` &middot; <em>${att} red</em>`:''}</span>${nx?`<span class="nx">Next: <b>${esc(nx.n)}</b> ${fmt(nx.s)}</span>`:''}</button><button class="solo" data-solo="${p.id}">Show only ${p.name}</button></div><div class="trk can-add" style="width:${W}px;height:${H}px">${trk}</div></div>`}
function tracksOf(pid){const t=[];ITEMS.forEach(i=>{if(i.p===pid&&!t.includes(i.t))t.push(i.t)});return t}
function trackRows(p){
  return tracksOf(p.id).map((t,k)=>{
    const its=ITEMS.filter(i=>i.p===p.id&&i.t===t).sort((a,b)=>a.s-b.s);const lv=[];let o='';
    its.forEach(i=>{const s=Math.max(i.s,START);
      if(i.kind==='series'){const L=pack(lv,x(i.s),W+1,0);const nd=nextOf(i)??i.dates[0];
        o+=`<div class="series" data-id="${i.id}" style="top:${12+L*38}px;width:${W}px">`+i.dates.map(d=>`<i class="dot${d<TODAY?' past':''}" style="left:${x(d)+ppd/2-4}px"></i>`).join('')+`<button class="sname" data-open="${i.id}" style="left:${x(nd)+ppd/2+9}px">${esc(i.n)}</button></div>`}
      else if(i.kind==='ms'){const x0=x(s)+ppd/2-6;const L=pack(lv,x0,x0+18+tw(i.n)+40,8);
        o+=`<button class="msi ${cls(i)}" data-id="${i.id}" data-open="${i.id}" style="left:${x0}px;top:${12+L*38}px"><i class="dia anchor"></i>${esc(i.n)}<small>${fmt(i.s)}</small></button>`}
      else{const bx=x(s),bw=Math.max((i.e-s+1)*ppd,8),w2=tw(i.n),nar=bw<w2;const L=pack(lv,bx,nar?bx+bw+7+w2:bx+bw,6);
        o+=`<button class="bar ${cls(i)}${nar?' narrow':''} anchor" data-id="${i.id}" data-open="${i.id}" style="left:${bx}px;top:${12+L*38}px;width:${bw}px;--p:${prog(i,s).toFixed(1)}%"><span>${esc(i.n)}</span></button>`}});
    return `<div class="row trackrow" data-pipe="${p.id}" data-stream="${esc(t)}" style="--c:var(${p.c});animation-delay:${k*45}ms"><div class="lab"><span class="tn">${esc(t)}</span><small>${its.length} item${its.length===1?'':'s'}</small></div><div class="trk can-add" style="width:${W}px;height:${Math.max(56,18+lv.length*38)}px">${o}</div></div>`}).join('')}
function anchor(id){const el=canvas.querySelector(`[data-id="${id}"]`);if(!el)return null;return el.classList.contains('anchor')?el:el.querySelector('.anchor')}
function drawLinks(){
  const svg=document.getElementById('links');if(!svg)return;svg.setAttribute('height',canvas.scrollHeight);
  if(!state.links){svg.innerHTML='';return}
  const cr=canvas.getBoundingClientRect();let s='';
  ITEMS.forEach(it=>{const bad=badDeps(it);it.dep.forEach(d=>{const a=anchor(d),b=anchor(it.id);if(!a||!b)return;
    const ra=a.getBoundingClientRect(),rb=b.getBoundingClientRect();
    const sx=ra.right-cr.left-LW,sy=ra.top+ra.height/2-cr.top,tx=rb.left-cr.left-LW,ty=rb.top+rb.height/2-cr.top;
    const dx=Math.max(28,Math.abs(tx-sx)*.45);const b2=bad.includes(d)?' class="bad"':'';
    s+=`<path${b2} data-a="${d}" data-b="${it.id}" style="--c:var(${pc(it.p)})" d="M${sx.toFixed(1)},${sy.toFixed(1)} C${(sx+dx).toFixed(1)},${sy.toFixed(1)} ${(tx-dx).toFixed(1)},${ty.toFixed(1)} ${tx.toFixed(1)},${ty.toFixed(1)}"/><circle${b2} data-a="${d}" data-b="${it.id}" style="--c:var(${pc(it.p)})" cx="${tx.toFixed(1)}" cy="${ty.toFixed(1)}" r="3"/>`})});
  svg.innerHTML=s}
function chain(id){const it=byId[id];const set=new Set([id]);
  if(it.kind==='goal'){feeders(it).forEach(i=>set.add(i.id));return set}
  const up=i=>byId[i].dep.forEach(d=>{if(!set.has(d)){set.add(d);up(d)}});const down=i=>(rev[i]||[]).forEach(d=>{if(!set.has(d)){set.add(d);down(d)}});up(id);down(id);
  if(it.g)set.add(it.g);return set}
function applyFocus(id){if(!byId[id])return;const set=chain(id);canvas.classList.add('hfocus');
  canvas.querySelectorAll('[data-id]').forEach(el=>el.classList.toggle('lit',set.has(el.dataset.id)));
  canvas.querySelectorAll('.links path,.links circle').forEach(el=>el.classList.toggle('lit',set.has(el.dataset.a)&&set.has(el.dataset.b)))}
function clearFocus(){if(pinned){applyFocus(pinned);return}canvas.classList.remove('hfocus');canvas.querySelectorAll('.lit').forEach(el=>el.classList.remove('lit'))}
let hov=null;
/* Hover highlight. Uses its own class (hfocus): the plain .focus class is also the Focus strip, which adds padding and margin, so every hover used to shift the board. A short dwell stops the board flashing as the pointer crosses gaps and link lines. */
let hovT=null;
canvas.addEventListener('pointerover',e=>{if(mv&&mv.on)return;const el=e.target.closest('[data-id]');const id=el?el.dataset.id:null;if(id===hov)return;
  if(!id&&e.target.closest('.links'))return;
  hov=id;clearTimeout(hovT);hovT=setTimeout(()=>{if(mv&&mv.on)return;hov?applyFocus(hov):clearFocus()},id?90:380)});
canvas.addEventListener('pointerleave',()=>{hov=null;clearTimeout(hovT);hovT=setTimeout(clearFocus,260)});

/* Grab any item on the timeline and drag it left or right. It moves by whole days, keeps its length,
   pushes anything that depends on it forward if they would now overlap, saves every changed item, and offers Undo. */
let mv=null,mvBlock=0;
function mvToast(msg,undo){let t=window.document.getElementById('mvToast');if(!t){t=window.document.createElement('div');t.id='mvToast';t.style.cssText='position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:90;background:#0e1430;color:#e9eefa;border:1px solid rgba(120,150,255,.3);border-radius:10px;padding:9px 14px;font:600 13px Inter,system-ui,sans-serif;display:flex;gap:12px;align-items:center;box-shadow:0 12px 30px rgba(0,0,0,.5)';window.document.body.appendChild(t)}
  t.innerHTML='<span></span><button type="button" style="font:inherit;font-weight:800;color:#8dbaff;background:none;border:0;cursor:pointer">Undo</button>';t.firstChild.textContent=msg;t.style.display='flex';
  t.lastChild.onclick=()=>{t.style.display='none';undo()};clearTimeout(t._h);t._h=setTimeout(()=>{t.style.display='none'},6000)}
canvas.addEventListener('pointerdown',e=>{
  if(dg||(e.button!=null&&e.button!==0))return;const el=e.target.closest('[data-id]');if(!el||el.classList.contains('series'))return;
  const it=byId[el.dataset.id];if(!it||it.kind==='series')return;
  mv={el,it,x0:e.clientX,on:false,d:0,id:e.pointerId,base:parseFloat(el.style.left)||0};
});
canvas.addEventListener('pointermove',e=>{if(!mv||e.pointerId!==mv.id)return;const dx=e.clientX-mv.x0;
  if(!mv.on){if(Math.abs(dx)<5)return;mv.on=true;clearTimeout(hovT);clearFocus();try{canvas.setPointerCapture(e.pointerId)}catch(_){}mv.el.classList.add('moving');
    mv.tag=window.document.createElement('div');mv.tag.className='mvtag';mv.el.parentNode.appendChild(mv.tag)}
  const d=Math.round(dx/ppd);const lo=START-mv.it.s,hi=END-mv.it.e;mv.d=Math.max(lo,Math.min(hi,d));
  mv.el.style.transform='translateX('+(mv.d*ppd)+'px)';
  const s=mv.it.s+mv.d,en=mv.it.e+mv.d;mv.tag.textContent=(s===en?fmt(s):fmt(s)+' to '+fmt(en))+(mv.d?'  ('+(mv.d>0?'+':'')+mv.d+'d)':'');
  mv.tag.style.left=(mv.base+mv.d*ppd)+'px';mv.tag.style.top=((parseFloat(mv.el.style.top)||0)-24)+'px';e.preventDefault()});
function endMove(e){if(!mv)return;const m=mv;mv=null;if(!m.on)return;
  mvBlock=Date.now();m.el.classList.remove('moving');m.el.style.transform='';m.tag&&m.tag.remove();if(!m.d)return;
  const before=new Map();const keep=i=>{if(!before.has(i.id))before.set(i.id,{s:i.s,e:i.e})};
  keep(m.it);m.it.s+=m.d;m.it.e+=m.d;
  const push=(id)=>{const p=byId[id];(rev[id]||[]).forEach(cid=>{const c=byId[cid];if(!c||c.kind==='series'||c.kind==='goal'||c.st==='done')return;
    if(c.s<=p.e){const by=p.e+1-c.s;if(c.e+by>END)return;keep(c);c.s+=by;c.e+=by;push(cid)}})};
  push(m.it.id);
  before.forEach((_,id)=>persistItem(byId[id]));index();renderAll();
  const moved=before.size-1;
  mvToast('Moved '+m.it.n+' to '+(m.it.s===m.it.e?fmt(m.it.s):fmt(m.it.s)+' to '+fmt(m.it.e))+(moved?' · '+moved+' after it moved too':''),()=>{before.forEach((v,id)=>{const i=byId[id];if(!i)return;i.s=v.s;i.e=v.e;persistItem(i)});index();renderAll()});
}
canvas.addEventListener('pointerup',endMove);canvas.addEventListener('pointercancel',endMove);
canvas.addEventListener('click',e=>{if(Date.now()-mvBlock<300){e.stopPropagation();e.preventDefault()}},true);

/* List */
function wouldCycle(item,cand){const seen=new Set();const up=i=>{if(i===item)return true;if(seen.has(i))return false;seen.add(i);return byId[i].dep.some(up)};return up(cand)}
function depOptions(i){let o='<option value="">+ Add</option>';
  ordered().forEach(p=>{const c=ITEMS.filter(j=>j.p===p.id&&j.id!==i.id&&j.kind!=='series'&&!i.dep.includes(j.id)&&!wouldCycle(i.id,j.id));
    if(c.length)o+=`<optgroup label="${p.name}">`+c.map(j=>`<option value="${j.id}">${esc(j.n)}</option>`).join('')+'</optgroup>'});return o}
function statusSel(i){const ph=phase(i);const auto={planned:'Pencilled in',active:'In motion',overdue:'Overdue',done:'Done'}[ph]||'Recurring';
  const shown=i.st==='done'?'done':i.st==='risk'?'risk':(risky(i)?'risk':ph);
  return `<select class="st ph-${shown}" id="f-${i.id}-st" data-item="${i.id}" data-f="st" aria-label="Status"><option value=""${!i.st?' selected':''}>${risky(i)&&!i.st?'Slipping':auto}</option><option value="risk"${i.st==='risk'?' selected':''}>At risk</option><option value="done"${i.st==='done'?' selected':''}>Done</option></select>`}
function goalSel(i){return `<select class="gsel${i.g?' on':''}" id="f-${i.id}-g" data-item="${i.id}" data-f="g" aria-label="Feeds milestone"><option value="">None</option>${GL().map(g=>`<option value="${g.id}"${i.g===g.id?' selected':''}>${esc(g.n)}</option>`).join('')}</select>`}
let armed=null;
function renderGoals(){const gs=GL();const open=state.open.has('goals');
  let h=`<section class="lgroup goals"><div class="lghead"><button class="lgt" data-toggle="goals" aria-expanded="${open}"><b>Milestones</b><span class="lmeta">${gs.length} big goals${gs.filter(risky).length?` &middot; <em>${gs.filter(risky).length} at risk</em>`:''}</span><span class="oc">${open?'Hide':'Show'}</span></button></div>`;
  if(open){h+=`<div class="cols"><span>Milestone</span><span>Owner</span><span>Plan · Start · Complete</span><span>Status</span><span>Fed so far</span><span>Feeding it</span><span></span></div>`;
    gs.forEach(g=>{h+=goalRowHTML(g)});
    h+=`<div class="addrow"><input id="f-add-goals" data-add="goals" placeholder="Add a milestone, press Return"></div>`}
  return h+'</section>'}
function rowHTML(i,opt){opt=opt||{};let h='';const bd=badDeps(i);const nt=i.tasks.length,dt=i.tasks.filter(t=>t.d).length;const ser=i.kind==='series';
        h+=`<div class="lrow${opt.dated?' drow2':''}" data-row="${i.id}" style="--c:var(${pc(i.p)})">
          <div class="cname">${opt.dated?`<span class="ptag">${pipe(i.p).name}</span>`:''}<i class="kd ${i.kind==='ms'?'ms':ser?'series':''}"></i><input class="fi nm" id="f-${i.id}-n" data-item="${i.id}" data-f="n" value="${esc(i.n)}" aria-label="Name"></div>
          <input class="fi" id="f-${i.id}-t" data-item="${i.id}" data-f="t" value="${esc(i.t)}" list="dl-${i.p}" aria-label="Stream">
          <input class="fi" id="f-${i.id}-o" data-item="${i.id}" data-f="o" value="${esc(i.o)}" aria-label="Owner">
          ${ser?`<span class="fixed">Every</span><span class="fixed">${i.n.includes('weekly')?'week':'month'}</span>`:
          `<input class="fi dt" id="f-${i.id}-s" data-item="${i.id}" data-f="s" value="${i.kind==='span'?fmt(i.s):''}" placeholder="${i.kind==='ms'?'Key date':'MMDD'}" aria-label="Start">
          <input class="fi dt" id="f-${i.id}-e" data-item="${i.id}" data-f="e" value="${fmt(i.e)}" placeholder="MMDD" aria-label="Due">`}
          ${ser?'<span class="fixed">Recurring</span>':statusSel(i)}
          ${goalSel(i)}
          <div class="deps">${i.dep.map(d=>`<button class="dchip${bd.includes(d)?' bad':''}" data-rmdep="${i.id}|${d}" style="--c:var(${pc(byId[d].p)})" title="Remove">${esc(byId[d].n)}</button>`).join('')}${ser?'':`<select class="adddep" id="f-${i.id}-dep" data-adddep="${i.id}" aria-label="Add a dependency">${depOptions(i)}</select>`}</div>
          <button class="tbtn${nt?' has':''}" data-tasks="${i.id}" aria-expanded="${!!state.tx[i.id]}">${nt?dt+'/'+nt:'+ tasks'}</button>
          <button class="rm${armed===i.id?' arm':''}" data-rm="${i.id}">${armed===i.id?'Confirm':'Remove'}</button>
          ${bd.length?`<div class="slipnote">Slipping: waits on ${bd.map(d=>`${esc(byId[d].n)} (${fmt(byId[d].e)})`).join(', ')}, which lands after this ${i.kind==='ms'?'date':'starts'} (${fmt(i.s)}).</div>`:''}
          ${i.g&&i.kind!=='series'&&i.st!=='done'&&i.e>byId[i.g].e?`<div class="slipnote">Lands ${fmt(i.e)}, after the ${esc(byId[i.g].n)} milestone (${fmt(byId[i.g].e)}).</div>`:''}
          ${state.tx[i.id]?`<div class="tasks">${i.tasks.map((t,ti)=>`<label class="${t.d?'dn':''}"><input type="checkbox" id="f-${i.id}-k${ti}" data-task="${i.id}|${ti}"${t.d?' checked':''}><span>${esc(t.n)}</span></label>`).join('')}<input class="addt" id="f-${i.id}-addt" data-addtask="${i.id}" placeholder="Add a task, press Return"></div>`:''}
        </div>`;return h}
function goalRowHTML(g){let h='';const f=feeders(g);const late=lateFor(g);const pct=goalPct(g);
      const st=g.st==='done'?'<span class="gst done">Done</span>':phase(g)==='overdue'?'<span class="gst risk">Missed</span>':late.length?`<span class="gst risk">At risk: ${late.length} late</span>`:'<span class="gst">On track</span>';
      h+=`<div class="lrow" data-row="${g.id}" style="--c:var(--gold-ink)">
        <div class="cname"><i class="kd ms" style="background:var(--gold)"></i><input class="fi nm" id="f-${g.id}-n" data-item="${g.id}" data-f="n" value="${esc(g.n)}" aria-label="Milestone name"></div>
        <input class="fi" id="f-${g.id}-o" data-item="${g.id}" data-f="o" value="${esc(g.o)}" aria-label="Owner">
        <div class="g3d"><input class="fi dt" id="f-${g.id}-ps" data-item="${g.id}" data-f="ps" value="${fmt(gPlan(g))}" placeholder="Plan" title="Planning from" aria-label="Planning from"><input class="fi dt" id="f-${g.id}-gs" data-item="${g.id}" data-f="gs" value="${fmt(gStart(g))}" placeholder="Start" title="Start" aria-label="Start"><input class="fi dt" id="f-${g.id}-e" data-item="${g.id}" data-f="e" value="${fmt(g.e)}" placeholder="Complete" title="Complete by" aria-label="Complete by"></div>
        <div style="display:flex;gap:4px;min-width:0">${st}<button class="tbtn" data-gdone="${g.id}">${g.st==='done'?'Reopen':'Mark done'}</button></div>
        <div class="gprog"><i><b style="width:${pct}%"></b></i>${pct}%</div>
        <div class="feed">${f.length?f.map(i=>`<button class="dchip${late.includes(i)?' bad':''}" data-open="${i.id}" data-reveal="1" style="--c:var(${pc(i.p)})">${esc(i.n)}</button>`).join(''):'<span class="none">Nothing yet. Pick this milestone on any row below.</span>'}</div>
        <button class="rm${armed===g.id?' arm':''}" data-rm="${g.id}">${armed===g.id?'Confirm':'Remove'}</button>
      </div>`;return h}
/* Lists, by date: real dates instead of Now / Week / Later. Overdue first, then each of the next 14 days,
   then weeks, then months. Recurring items show their next date. Click a row to open it. */
function dLabel(d){const x=D(d);return WD[x.getUTCDay()]+' '+x.getUTCDate()+' '+MON[x.getUTCMonth()]}
function bucketOf(d){if(d<TODAY)return {k:'over',t:'Overdue',o:-1};const off=d-TODAY;
  const wk0=TODAY-((D(TODAY).getUTCDay()+6)%7);if(d<wk0+14)return {k:'d'+d,t:off===0?'Today':off===1?'Tomorrow':dLabel(d),sub:off<2?dLabel(d):'',o:d,today:off===0};
  if(off<63){const x=D(d);const mon=d-((x.getUTCDay()+6)%7);return {k:'w'+mon,t:'Week of '+dLabel(mon),o:mon}}
  const x=D(d);return {k:'m'+x.getUTCFullYear()+'-'+x.getUTCMonth(),t:MON[x.getUTCMonth()]+' '+x.getUTCFullYear(),o:Date.UTC(x.getUTCFullYear(),x.getUTCMonth(),1)/864e5}}
function renderByDate(){/* Lists always show every pipeline; the timeline chips only filter the timeline. */const vis=new Set(ordered().map(p=>p.id).concat(['goals']));const rows=[];
  ITEMS.forEach(i=>{if(!vis.has(i.p))return;let d=i.e;if(i.kind==='series'){d=nextOf(i);if(d==null)return}
    if(i.st==='done'&&d<TODAY)return;const late=i.kind!=='series'&&i.st!=='done'&&d<TODAY;rows.push({i,d:late?d:d,b:bucketOf(late?d:(d<TODAY?TODAY:d))})});
  const groups={};rows.forEach(r=>{(groups[r.b.k]=groups[r.b.k]||{b:r.b,rows:[]}).rows.push(r)});
  const order=Object.values(groups).sort((a,b)=>a.b.o-b.b.o);
  if(!order.length)return '<p class="hint">Nothing dated yet. Add an item above, or open the Timeline.</p>';
  return order.map(g=>{g.rows.sort((a,b)=>a.d-b.d||(a.i.kind==='goal'?-1:1));
    return `<div class="dgrp"><div class="dgh ${g.b.k==='over'?'dover':g.b.today?'dtdy':''}"><b>${g.b.t}</b><span>${g.b.sub?g.b.sub+' &middot; ':''}${g.rows.length} ${g.rows.length===1?'item':'items'}</span></div>`+
    g.rows.map(({i,d})=>{const p=pipe(i.p);const ph=phase(i);const rk=attention(i);
      const st=i.st==='done'?'<span class="dst done">Done</span>':rk?`<span class="dst red">${ph==='overdue'?'Overdue':'Slipping'}</span>`:ph==='active'?'<span class="dst go">In motion</span>':i.kind==='series'?'<span class="dst">Recurring</span>':i.kind==='goal'?'<span class="dst">Milestone</span>':'<span class="dst">Pencilled in</span>';
      const span=i.kind==='span'?`${fmt(i.s)} to ${fmt(i.e)}`:i.kind==='series'?'repeats':i.kind==='goal'?'milestone':'key date';
      const g=i.g&&byId[i.g]?`<span class="dgm">Feeds ${esc(byId[i.g].n)}</span>`:'';
      return `<div class="drw${i.kind==='goal'?' dgl':''}${i.st==='done'?' ddone':''}" data-open="${i.id}" style="--c:var(${pc(i.p)})"><span class="ddt">${dLabel(d)}<small>${span}</small></span><span class="dmk${i.kind==='goal'||i.kind==='ms'?' dia2':''}"></span><span class="dnm">${esc(i.n)}<small>${[esc(i.t||''),g,i.tasks.length?i.tasks.filter(t=>t.d).length+'/'+i.tasks.length+' tasks':''].filter(Boolean).join(' &middot; ')}</small></span><span class="dpp">${p.name}</span><span class="dow">${esc(i.o||'')}</span>${st}</div>`}).join('')+'</div>'}).join('')}
function renderList(){
  if((state.group||'pipe')==='date'){document.getElementById('list').innerHTML=renderByDate();return}
  const vis=ordered();let h=renderGoals();
  vis.forEach(p=>{const its=ITEMS.filter(i=>i.p===p.id).sort((a,b)=>a.s-b.s||a.e-b.e);const open=state.open.has(p.id);
    const att=its.filter(attention).length;
    h+=`<section class="lgroup" style="--c:var(${p.c})"><div class="lghead" draggable="true" data-drag="${p.id}"><button class="lgt" data-toggle="${p.id}" aria-expanded="${open}"><b>${p.name}</b><span class="lmeta">${its.length} items${att?` &middot; <em>${att} red</em>`:''}</span><span class="oc">${open?'Hide':'Show'}</span></button><button class="mv" data-mv="${p.id}|-1" aria-label="Move ${p.name} up">Up</button><button class="mv" data-mv="${p.id}|1" aria-label="Move ${p.name} down">Down</button></div>`;
    if(open){
      h+=`<div class="cols"><span>Name</span><span>Stream</span><span>Owner</span><span>Start</span><span>Due</span><span>Status</span><span>Milestone</span><span>Waits on</span><span>Tasks</span><span></span></div>`;
      h+=`<datalist id="dl-${p.id}">${tracksOf(p.id).map(t=>`<option value="${esc(t)}">`).join('')}</datalist>`;
      its.forEach(i=>{h+=rowHTML(i)});
      h+=`<div class="addrow step"><input id="f-add-${p.id}" data-add="${p.id}" placeholder="New step in ${p.name}" aria-label="New step name"><input class="fi dt nd" id="f-add-${p.id}-s" data-newdate="s" placeholder="Start" aria-label="Start date"><input class="fi dt nd" id="f-add-${p.id}-e" data-newdate="e" placeholder="Due" aria-label="Due date"><button class="addbtn" data-addstep="${p.id}" data-action="tl-add-step">Add step</button></div>`}
    h+='</section>'});
  document.getElementById('list').innerHTML=h;
}

/* Date entry */
function parseDate(str){const s=str.trim();if(!s)return null;
  const yr=m=>m>=9?2026:2027;let m;
  if(/^\d{3,4}$/.test(s)){m=s.match(/^(\d{1,2})(\d{2})$/);const mo=+m[1],d=+m[2];return mk(yr(mo-1),mo-1,d)}
  m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);if(m)return mk(+m[1],+m[2]-1,+m[3]);
  m=s.match(/^(\d{1,2})[\s\/.-]*([A-Za-z]{3})/);if(m){const mo=MON.findIndex(x=>x.toLowerCase()===m[2].toLowerCase());if(mo>=0)return mk(yr(mo),mo,+m[1])}
  m=s.match(/^([A-Za-z]{3})[a-z]*[\s.]*(\d{1,2})/);if(m){const mo=MON.findIndex(x=>x.toLowerCase()===m[1].toLowerCase());if(mo>=0)return mk(yr(mo),mo,+m[2])}
  return NaN}
function mk(y,mo,d){if(mo<0||mo>11||d<1||d>31)return NaN;const t=Math.round(Date.UTC(y,mo,d)/DAY);if(D(t).getUTCDate()!==d)return NaN;return Math.min(END,Math.max(START,t))}

function rerender(){const a=document.activeElement&&document.activeElement.id;index();renderAll();if(a){const el=document.getElementById(a);el&&el.focus()}}

document.getElementById('list').addEventListener('change',e=>{
  const t=e.target;
  if(t.dataset.adddep){const i=byId[t.dataset.adddep];if(t.value){i.dep.push(t.value);save();rerender()}return}
  if(t.dataset.task){const[id,k]=t.dataset.task.split('|');byId[id].tasks[+k].d=t.checked;save();rerender();return}
  if(!t.dataset.f)return;const i=byId[t.dataset.item];const f=t.dataset.f;const v=t.value;
  if(f==='n'){if(!v.trim()){t.value=i.n;return}i.n=v.trim()}
  else if(f==='t'){i.t=v.trim()||'General'}
  else if(f==='o'){i.o=v.trim()}
  else if(f==='st'){i.st=v}
  else if(f==='g'){i.g=v}
  else if(f==='ps'||f==='gs'){const d=parseDate(v);if(d==null||Number.isNaN(d)){t.classList.add('bad');setTimeout(()=>{t.classList.remove('bad');t.value=fmt(f==='ps'?gPlan(i):gStart(i))},1300);return}
    if(f==='ps'){i.ps=Math.min(d,gStart(i))}else{i.s=Math.min(d,i.e);if(i.ps!=null&&i.ps>i.s)i.ps=i.s}}
  else if(f==='s'||f==='e'){const d=parseDate(v);
    if(Number.isNaN(d)){t.classList.add('bad');setTimeout(()=>{t.classList.remove('bad');t.value=f==='s'?(i.kind==='span'?fmt(i.s):''):fmt(i.e)},1300);return}
    if(f==='s'){if(d===null){i.kind='ms';i.s=i.e}else{const len=i.kind==='span'?i.e-i.s:7;i.kind='span';i.s=d;if(i.e<d)i.e=Math.min(END,d+len)}}
    else{if(d===null){t.value=fmt(i.e);return}if(i.kind==='ms'){i.s=i.e=d}else if(i.kind==='goal'){const keep=gStart(i)<i.e?gStart(i):null;i.e=d;if(keep!=null&&keep<d)i.s=keep;else i.s=d}else{i.e=d;if(i.s>d)i.s=d}}}
  save();persistItem(i);rerender();
});
document.getElementById('list').addEventListener('keydown',e=>{
  const t=e.target;if(e.key!=='Enter'||t.tagName!=='INPUT')return;e.preventDefault();
  if(t.dataset.add){addStep(t.dataset.add);return}
  if(t.dataset.addtask){const n=t.value.trim();if(!n)return;byId[t.dataset.addtask].tasks.push({n,d:false});save();rerender();const el=document.getElementById(t.id);el&&el.focus();return}
  t.blur();
});
function addItem(pid,n,keepFocus,dates){const id='n'+Date.now().toString(36);
  const it=pid==='goals'?{id,p:'goals',t:'',n,o:'Chad',note:'',dep:[],g:'',st:'',tasks:[],kind:'goal',s:Math.min(END,TODAY+30),e:Math.min(END,TODAY+30)}
    :{id,p:pid,t:'Inbox',n,o:'Chad',note:'',dep:[],g:'',st:'',tasks:[],kind:'span',s:TODAY,e:Math.min(END,TODAY+7)};
  if(dates){if(typeof dates.e==='number'&&!Number.isNaN(dates.e)){it.e=dates.e;if(typeof dates.s==='number'&&!Number.isNaN(dates.s)){it.kind='span';it.s=Math.min(dates.s,dates.e)}else{it.kind='ms';it.s=dates.e}}
    else if(typeof dates.s==='number'&&!Number.isNaN(dates.s)){it.kind='span';it.s=dates.s}}
  ITEMS.push(it);
  state.hidden.delete(pid);state.open.add(pid);save();index();renderAll();
  if(liveOk()){
    window.authFetch('/api/timeline/items',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({title:n,pipeline:pid,kind:it.kind==='ms'?'key_date':'span',start_date:it.kind==='ms'?'':isoOf(it.s),due_date:isoOf(it.e)})}).then(function(r){return r&&r.ok?r.json():null}).then(function(row){if(row&&row.id){it.id=String(row.id);index();renderAll();}}).catch(function(){});
  }
  if(keepFocus){const el=document.getElementById('f-add-'+pid);el&&el.focus()}
  const row=document.querySelector(`[data-row="${it.id}"]`);row&&row.classList.add('flashrow');
  return it.id}

/* Drawer */
const drawer=document.getElementById('drawer'),scrim=document.getElementById('scrim');
function linkBtn(id,bad){const i=byId[id];const p=pipe(i.p);return `<button class="dlink" data-open="${id}" data-reveal="1" style="--c:var(${bad?'--bad':p.c})"><i></i>${esc(i.n)}<small>${p.name} &middot; ${fmt(i.e)}</small></button>`}
function openDrawer(id){const i=byId[id];if(!i)return;const p=pipe(i.p);const ph=phase(i);const bd=badDeps(i);
  let when,big,sub,pg='',extra='';
  if(i.kind==='goal'){const f=feeders(i),late=lateFor(i),pct=goalPct(i);when='Target '+fmtW(i.e)+' '+D(i.e).getUTCFullYear();
    big=i.st==='done'?'Milestone hit':ph==='overdue'?'Milestone missed':late.length?`At risk: ${late.length} feeding item${late.length===1?'':'s'} late`:'On track';
    sub=`${rel(i.e-TODAY)} · ${pct}% of the work feeding it is done`;pg=`<div class="prog"><i style="width:${pct}%;background:var(--gold)"></i></div>`;
    extra=`<h3>Feeding this milestone</h3>`+(f.length?f.map(j=>linkBtn(j.id,late.includes(j))).join(''):'<p class="none">Nothing yet. In the list, pick this milestone on any row.</p>');
    drawer.style.setProperty('--c','var(--gold-ink)');
    drawer.innerHTML=`<div class="dtop"><button class="ed" data-dsave="${id}">Save changes</button><button id="dClose">Close</button></div><div class="dp">Milestone</div><h2>${esc(i.n)}</h2><div class="dd">${when}</div>
      <div class="stbig${late.length||ph==='overdue'?' bad':''}" style="${late.length?'':'background:var(--gold-soft)'}"><b>${big}</b><span>${sub}</span>${pg}</div>
      ${drawEdit(i)}<div class="dlist">${extra}</div>`;
    drawer.hidden=false;scrim.hidden=false;pinned=id;applyFocus(id);return}
  if(i.kind==='ms'){when=fmtW(i.s)+' '+D(i.s).getUTCFullYear();big=ph==='done'?'Key date done':ph==='overdue'?'Key date missed':'Key date';sub=rel(i.s-TODAY)}
  else if(i.kind==='series'){const n=nextOf(i);when=i.n.includes('weekly')?'Every week':'Every month';big='Recurring';sub=n!=null?'Next on '+fmtW(n)+', '+rel(n-TODAY):'No more dates in this plan'}
  else{const len=i.e-i.s+1;when=fmtY(i.s)+' to '+fmtY(i.e);
    if(ph==='active'){const dd=TODAY-i.s+1;big='In motion';sub=`Day ${dd} of ${len} · due ${rel(i.e-TODAY)}`}
    else if(ph==='planned'){big='Pencilled in';sub=`Starts ${rel(i.s-TODAY)} · runs ${len} days`}
    else if(ph==='overdue'){big='Overdue';sub=`Was due ${rel(i.e-TODAY)}`}else{big='Done';sub=''}
    if(ph==='active'||i.tasks.length)pg=`<div class="prog"><i style="width:${prog(i,Math.max(i.s,START)).toFixed(1)}%"></i></div>`}
  if(bd.length){big='Slipping';sub=`Waits on something that lands after ${fmt(i.s)}`}
  drawer.style.setProperty('--c',`var(${p.c})`);
  drawer.innerHTML=`<div class="dtop"><button class="ed" data-dsave="${id}">Save changes</button><button id="dClose">Close</button></div>
   <div class="dp">${p.name} &middot; ${esc(i.t)}</div><h2>${esc(i.n)}</h2><div class="dd">${when}</div>
   <div class="stbig${bd.length||ph==='overdue'?' bad':''}"><b>${big}</b><span>${sub}</span>${pg}</div>
   ${drawEdit(i)}
   <div class="dlist">${i.tasks.length?`<h3>Tasks ${i.tasks.filter(t=>t.d).length}/${i.tasks.length}</h3>`+i.tasks.map(t=>`<div class="dtask${t.d?' dn':''}">${esc(t.n)}</div>`).join(''):''}
   <h3>Waits on</h3>${i.dep.length?i.dep.map(d=>linkBtn(d,bd.includes(d))).join(''):'<p class="none">Nothing. This can move on its own.</p>'}
   <h3>Unlocks</h3>${(rev[id]||[]).length?rev[id].map(d=>linkBtn(d)).join(''):'<p class="none">Nothing downstream yet.</p>'}</div>`;
  drawer.hidden=false;scrim.hidden=false;pinned=id;applyFocus(id)}
/* Edit right in the drawer: name, owner, stream, dates, status, milestone and notes. Save writes it everywhere. */
function drawEdit(i){const g=i.kind==='goal',ser=i.kind==='series';
  const f=(lab,html)=>`<label class="def"><span>${lab}</span>${html}</label>`;
  const inp=(k,v,ph)=>`<input class="fi" data-de="${k}" data-orig="${esc(v==null?'':v)}" value="${esc(v==null?'':v)}" placeholder="${ph||''}">`;
  let h=`<div class="dedit">`+f('Name',inp('n',i.n))+`<div class="dgrid">`+f('Owner',inp('o',i.o,'Who'));
  if(!g)h+=f('Stream',inp('t',i.t,'Stream'));
  if(g)h+=f('Planning from',inp('ps',fmt(gPlan(i)),'MMDD'))+f('Start',inp('gs',fmt(gStart(i)),'MMDD'))+f('Complete by',inp('e',fmt(i.e),'MMDD'));
  else if(i.kind==='ms')h+=f('Planning from',inp('ps',i.ps!=null?fmt(i.ps):'','MMDD'))+f('Start',inp('s',fmt(i.e),'MMDD'))+f('Complete by',inp('e',fmt(i.e),'MMDD'));
  else h+=f('Planning from',inp('ps',i.ps!=null?fmt(i.ps):'','MMDD'))+f('Start',inp('s',fmt(i.s),'MMDD'))+f('Complete by',inp('e',fmt(i.e),'MMDD'));
  h+=f('Status',`<select class="fi" data-de="st"><option value=""${!i.st?' selected':''}>Automatic</option><option value="risk"${i.st==='risk'?' selected':''}>At risk</option><option value="done"${i.st==='done'?' selected':''}>Done</option></select>`);
  if(!g)h+=f('Feeds milestone',`<select class="fi" data-de="g"><option value="">None</option>${GL().map(m=>`<option value="${m.id}"${i.g===m.id?' selected':''}>${esc(m.n)}</option>`).join('')}</select>`);
  h+=`</div>`+f('Notes',`<textarea class="fi" data-de="note" rows="3" placeholder="What this is, what was agreed">${esc(i.note||'')}</textarea>`)+`<div class="derr" id="deErr"></div></div>`;
  return h}
function saveDrawer(id){const i=byId[id];if(!i)return;const v={};
  /* Dates are only re-read when they were changed, so an untouched date keeps its exact year. */
  drawer.querySelectorAll('[data-de]').forEach(el=>{const k=el.dataset.de;const dateKey=/^(s|e|ps|gs)$/.test(k);v[k]=dateKey&&el.value===el.getAttribute('data-orig')?null:el.value});
  const bad=m=>{const e=document.getElementById('deErr');if(e)e.textContent=m};
  const pd=s=>{if(s==null||!String(s).trim())return null;const d=parseDate(String(s));return Number.isNaN(d)?NaN:d};
  if(!String(v.n||'').trim())return bad('Give it a name.');
  i.n=String(v.n).trim();i.o=String(v.o||'').trim();if(v.t!=null)i.t=String(v.t).trim()||'General';
  i.st=v.st||'';if(v.g!=null)i.g=v.g||'';i.note=String(v.note||'');
  if(i.kind==='goal'){const ps=pd(v.ps),gs=pd(v.gs),e=pd(v.e);if([ps,gs,e].some(Number.isNaN))return bad('Dates are MMDD, like 1030, or 30 Oct.');
    if(e!=null)i.e=e;if(gs!=null)i.s=Math.min(gs,i.e);if(ps!=null)i.ps=Math.min(ps,gStart(i))}
  else{const ps=pd(v.ps),s0=pd(v.s),e0=pd(v.e);if([ps,s0,e0].some(Number.isNaN))return bad('Dates are MMDD, like 1030, or 30 Oct.');
    if(i.kind==='ms'){/* a key date that gains a different start becomes a span */
      if(e0!=null){i.e=e0;i.s=e0}if(s0!=null&&s0<i.e){i.s=s0;i.kind='span'}else if(s0!=null&&e0==null){i.s=i.e=s0}}
    else{if(s0!=null)i.s=s0;if(e0!=null)i.e=e0;if(i.e<i.s)i.e=i.s}
    if(v.ps!=null){i.ps=ps==null?null:Math.min(ps,i.s)}}
  save();persistItem(i);rerender();openDrawer(id);
  const b=drawer.querySelector('[data-dsave]');if(b){b.textContent='Saved';setTimeout(()=>{if(b.isConnected)b.textContent='Save changes'},1400)}}
drawer.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.matches&&e.target.matches('input[data-de]')){e.preventDefault();const b=drawer.querySelector('[data-dsave]');if(b)saveDrawer(b.dataset.dsave)}});
function closeDrawer(){drawer.hidden=true;scrim.hidden=true;pinned=null;clearFocus()}
function reveal(id){const i=byId[id];let ch=false;
  if(i.kind!=='goal'){if(state.hidden.has(i.p)){state.hidden.delete(i.p);ch=true}if(!state.open.has(i.p)){state.open.add(i.p);ch=true}}
  if(ch){save();renderAll()}
  requestAnimationFrame(()=>{const el=canvas.querySelector(`[data-id="${id}"]`);if(!el)return;
    const cr=canvas.getBoundingClientRect(),er=el.getBoundingClientRect();
    scroller.scrollTo({left:Math.max(0,x(Math.max(i.s,START))-180),top:Math.max(0,er.top-cr.top-160),behavior:'smooth'});
    el.classList.remove('flash');void el.offsetWidth;el.classList.add('flash');
    const sr=scroller.getBoundingClientRect();if(sr.top<0||sr.top>innerHeight*.6)scroller.scrollIntoView({behavior:'smooth',block:'start'})})}
function editInList(id){closeDrawer();const i=byId[id];state.hidden.delete(i.p);state.open.add(i.p);save();renderAll();
  const row=document.querySelector(`[data-row="${id}"]`);if(!row)return;row.scrollIntoView({behavior:'smooth',block:'center'});row.classList.add('flashrow');
  const nm=document.getElementById(`f-${id}-n`);nm&&setTimeout(()=>nm.focus({preventScroll:true}),350)}

/* Focus timer */
let tLeft=25*60,tRun=null;
function drawTimer(){const m=Math.floor(tLeft/60),s=tLeft%60;$$('.timerTxt').forEach(e=>e.textContent=`${m}:${String(s).padStart(2,'0')}`);(document.getElementById('ring')||{style:{setProperty(){}}}).style.setProperty('--deg',(tLeft/(25*60)*360)+'deg')}
function setFocusLabels(t){$$('[data-act="focus"] .flab').forEach(e=>{const big=e.closest('.go');e.textContent=t==='run'?'Pause':t==='paused'?'Resume':(big?'Start 25-min focus':'Start')})}
function toggleFocus(){if(tRun){clearInterval(tRun);tRun=null;setFocusLabels('paused');return}
  if(tLeft<=0)tLeft=25*60;setFocusLabels('run');
  tRun=setInterval(()=>{tLeft--;drawTimer();if(tLeft<=0){clearInterval(tRun);tRun=null;setFocusLabels('idle')}},1000)}
document.addEventListener('change',e=>{if(e.target.classList.contains('movePick')){state.move=e.target.value;save();renderTop()}});
$$('.capForm').forEach(f=>f.addEventListener('submit',e=>{e.preventDefault();const t=f.querySelector('.capText');const n=t.value.trim();if(!n)return;
  const id=addItem(f.querySelector('.capPipe').value,n,false);t.value='';const row=document.querySelector(`[data-row="${id}"]`);row&&row.scrollIntoView({behavior:'smooth',block:'center'})}));

/* Reorder */
let dragId=null;
function moveTo(a,b){if(a===b||!b)return;const ai=state.order.indexOf(a),bi=state.order.indexOf(b);if(ai<0||bi<0)return;const o=state.order.filter(x=>x!==a);o.splice(o.indexOf(b)+(ai<bi?1:0),0,a);state.order=o;save();renderAll()}
document.addEventListener('dragstart',e=>{const el=e.target.closest&&e.target.closest('[data-drag]');if(!el)return;dragId=el.dataset.drag;e.dataTransfer.effectAllowed='move';try{e.dataTransfer.setData('text/plain',dragId)}catch(_){}el.classList.add('dragging')});
document.addEventListener('dragover',e=>{if(!dragId)return;const el=e.target.closest&&e.target.closest('[data-drag]');if(!el)return;e.preventDefault();$$('.dragover').forEach(x=>x!==el&&x.classList.remove('dragover'));el.classList.add('dragover')});
document.addEventListener('drop',e=>{if(!dragId)return;const el=e.target.closest&&e.target.closest('[data-drag]');if(!el)return;e.preventDefault();const a=dragId;dragId=null;moveTo(a,el.dataset.drag)});
document.addEventListener('dragend',()=>{dragId=null;$$('.dragover,.dragging').forEach(x=>x.classList.remove('dragover','dragging'))});

/* Popovers */
function closePops(except){$$('.pop').forEach(p=>{if(p!==except)p.hidden=true})}
document.addEventListener('click',e=>{if(!e.target.closest('.pop')&&!e.target.closest('[data-pop]'))closePops()});

/* Clicks */
document.addEventListener('click',e=>{const r=e.target.closest('.drw');if(r&&byId[r.dataset.open])openDrawer(r.dataset.open)});
document.addEventListener('click',e=>{
  const t=e.target.closest('button');if(!t)return;const act=t.dataset.act;
  if(t.dataset.view){state.view=t.dataset.view;save();applyView();window.scrollTo(0,0);if(state.view==='timeline'){renderBoard();drawLinks();goToday(false)}return}
  if(t.dataset.group){state.group=t.dataset.group;save();renderList();applyView();return}
  if(t.dataset.pop){const p=document.getElementById('pop-'+t.dataset.pop);const show=p.hidden;closePops();p.hidden=!show;
    if(!p.hidden&&t.closest('.focusbar')){const fb=t.closest('.focusbar').getBoundingClientRect(),br=t.getBoundingClientRect();p.style.left=Math.max(0,Math.min(br.left-fb.left,fb.width-p.offsetWidth))+'px'}return}
  if(t.dataset.top){state.top=t.dataset.top;save();renderControls();requestAnimationFrame(drawLinks);return}
  if(t.id==='dClose'){closeDrawer();return}
  if(t.dataset.edit){editInList(t.dataset.edit);return}
  if(t.dataset.dsave){saveDrawer(t.dataset.dsave);return}
  if(t.dataset.open){const id=t.dataset.open;closePops();if(t.dataset.reveal)reveal(id);openDrawer(id);return}
  if(t.dataset.toggle){const id=t.dataset.toggle;state.open.has(id)?state.open.delete(id):state.open.add(id);save();renderAll();return}
  if(t.dataset.solo){state.hidden=new Set(PIPES.filter(p=>p.id!==t.dataset.solo).map(p=>p.id));state.open.add(t.dataset.solo);save();renderAll();return}
  if(t.dataset.chip){const id=t.dataset.chip;state.hidden.has(id)?state.hidden.delete(id):state.hidden.add(id);save();renderAll();return}
  if(t.dataset.all){state.hidden.clear();save();renderAll();return}
  if(t.dataset.mv){const[id,dir]=t.dataset.mv.split('|');const o=state.order;const k=o.indexOf(id),j=k+(+dir);if(j<0||j>=o.length)return;[o[k],o[j]]=[o[j],o[k]];save();renderAll();return}
  if(t.dataset.gdone){const g=byId[t.dataset.gdone];g.st=g.st==='done'?'':'done';save();rerender();return}
  if(t.dataset.rmdep){const[id,d]=t.dataset.rmdep.split('|');byId[id].dep=byId[id].dep.filter(x=>x!==d);save();rerender();return}
  if(t.dataset.tasks){const id=t.dataset.tasks;state.tx[id]=!state.tx[id];save();renderList();if(state.tx[id]&&byId[id].tasks.length===0){const el=document.getElementById(`f-${id}-addt`);el&&el.focus()}return}
  if(t.dataset.rm){const id=t.dataset.rm;if(armed!==id){armed=id;renderList();setTimeout(()=>{if(armed===id){armed=null;renderList()}},3000);return}
    armed=null;ITEMS=ITEMS.filter(i=>i.id!==id);ITEMS.forEach(i=>{i.dep=i.dep.filter(d=>d!==id);if(i.g===id)i.g=''});if(state.move===id)state.move='';save();index();renderAll();return}
  if(t.dataset.zoom){const fx=(scroller.scrollLeft+scroller.clientWidth/2-LW)/ppd;state.zoom=t.dataset.zoom;save();renderControls();renderBoard();scroller.scrollLeft=Math.max(0,fx*ppd-scroller.clientWidth/2+LW);return}
  if(act==='focus'){toggleFocus();return}
  if(act==='moveopen'){if(state.move&&byId[state.move]){reveal(state.move);openDrawer(state.move)}return}
  if(act==='links'){state.links=!state.links;save();renderControls();drawLinks();return}
  if(act==='open'){PIPES.forEach(p=>state.open.add(p.id));state.open.add('goals');save();closePops();renderAll();return}
  if(act==='close'){PIPES.forEach(p=>state.open.delete(p.id));save();closePops();renderAll();return}
  if(act==='today'){goToday(true);return}
  if(act==='reset'){if(t.dataset.arm){const top=state.top;ITEMS=hydrate();state=defaults();state.top=top;state.hidden=new Set();state.open=new Set(state.open);index();save();closePops();renderAll();goToday(false);t.textContent=t.dataset.orig;delete t.dataset.arm;return}
    t.dataset.arm='1';t.dataset.orig=t.textContent;t.textContent='Confirm reset';setTimeout(()=>{if(t.dataset.arm){delete t.dataset.arm;t.textContent=t.dataset.orig}},3000);return}
});

scrim.addEventListener('click',closeDrawer);
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closePops();if(!drawer.hidden)closeDrawer()}});
addEventListener('resize',()=>{const nl=innerWidth<640?150:252;if(nl!==LW)renderBoard();else drawLinks()});
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(drawLinks);

function goToday(smooth){const left=Math.max(0,x(TODAY)-Math.min(160,scroller.clientWidth*.18));smooth?scroller.scrollTo({left,behavior:'smooth'}):(scroller.scrollLeft=left)}
function renderAll(){renderControls();renderTop();renderBoard();renderList();applyView()}
index();renderAll();drawTimer();goToday(false);


/* ===== Zoom, scroll and drag-to-add (18) ===== */
const ZMIN=2,ZMAX=2400;
function zoomTo(np,clientX){const r=scroller.getBoundingClientRect();const px=(clientX==null?r.left+LW+trackW()/2:clientX)-r.left-LW;
  const day=(scroller.scrollLeft+px)/ppd;state.zoom=String(Math.min(ZMAX,Math.max(ZMIN,np)));if(canvas)canvas.setAttribute('data-zoom',state.zoom);renderControls();renderBoard();scroller.scrollLeft=Math.max(0,day*ppd-px)}
let zq=null,zpend=null;function zoomSoon(np,cx){zpend=[np,cx];if(zq)return;zq=requestAnimationFrame(()=>{zq=null;const [a,b]=zpend;zoomTo(a,b);saveSoon()})}
let stz;function saveSoon(){clearTimeout(stz);stz=setTimeout(save,400)}
var ctrlHeld=false;
addEventListener('keydown',e=>{if(e.key==='Control'||e.key==='Meta')ctrlHeld=true},true);
addEventListener('keyup',e=>{if(e.key==='Control'||e.key==='Meta')ctrlHeld=false},true);
function zoomWheel(e){
  if(!(e.ctrlKey||e.metaKey||ctrlHeld))return;
  e.preventDefault();
  zoomSoon(ppdOf(state.zoom)*Math.exp(-e.deltaY*0.008),e.clientX);
}
scroller.addEventListener('wheel',e=>{
  if(e.ctrlKey||e.metaKey||ctrlHeld){zoomWheel(e);return}
  if(Math.abs(e.deltaX)>Math.abs(e.deltaY))return;
  if(e.shiftKey)return;
},{passive:false});
root.addEventListener('wheel',e=>{
  if(!(e.ctrlKey||e.metaKey||ctrlHeld))return;
  var t=e.target&&e.target.closest&&e.target.closest('#scroller,.scroller,#canvas,.canvas');
  if(!t)return;
  zoomWheel(e);
},{passive:false,capture:true});
let gs0=null;scroller.addEventListener('gesturestart',e=>{e.preventDefault();gs0=ppdOf(state.zoom)});
scroller.addEventListener('gesturechange',e=>{e.preventDefault();if(gs0)zoomSoon(gs0*e.scale,e.clientX)});
scroller.addEventListener('gestureend',e=>{e.preventDefault();gs0=null});
document.addEventListener('click',e=>{const b=e.target.closest('[data-zlv]');if(!b)return;zoomTo(LV[b.dataset.zlv](),null);save()});
scroller.tabIndex=0;scroller.addEventListener('keydown',e=>{if(e.key==='+'||e.key==='='){zoomTo(ppdOf(state.zoom)*1.4,null);save()}if(e.key==='-'){zoomTo(ppdOf(state.zoom)/1.4,null);save()}});
/* Milestone names stay in view: when a milestone starts left of the visible area, its label slides along the bar. */
function stickGoalLabels(){const sl=scroller.scrollLeft||0;canvas.querySelectorAll('.gspan').forEach(g=>{const lab=g.querySelector('.glab');const run=g.querySelector('.grun');if(!lab||!run)return;const base=parseFloat(run.style.left)||0;const left=parseFloat(g.style.left)||0;const want=Math.max(base+8,sl-left+12);lab.style.left=Math.min(want,Math.max(base+8,g.offsetWidth-lab.offsetWidth-14))+'px'})}
scroller.addEventListener('scroll',()=>requestAnimationFrame(stickGoalLabels),{passive:true});
let sq;scroller.addEventListener('scroll',()=>{if(ppd<18)return;clearTimeout(sq);sq=setTimeout(()=>{const l=scroller.scrollLeft;renderBoard();scroller.scrollLeft=l},90)});
let dg=null;
function startDragAdd(e){
  if(dg)return;
  const t=e.target;if(!t||!t.closest)return;
  const trk=t.closest('.trk.can-add');if(!trk||(t!==trk&&!(t.classList&&t.classList.contains('range')))||(e.button!=null&&e.button!==0))return;
  const row=trk.closest('.row');if(!row)return;
  const r=trk.getBoundingClientRect();const d0=START+Math.floor((e.clientX-r.left)/ppd);
  const g=window.document.createElement('div');g.className='ghost';g.style.setProperty('--c',getComputedStyle(row).getPropertyValue('--c'));g.style.top=Math.max(6,e.clientY-r.top-13)+'px';trk.appendChild(g);
  dg={trk,row,r,d0,d1:d0,g};updG();
  try{trk.setPointerCapture(e.pointerId)}catch(err){}
  e.preventDefault();
}
canvas.addEventListener('pointerdown',startDragAdd);
root.addEventListener('pointerdown',startDragAdd,true);
function updG(){const a=Math.min(dg.d0,dg.d1),b=Math.max(dg.d0,dg.d1);dg.g.style.left=x(a)+'px';dg.g.style.width=Math.max(ppd,(b-a+1)*ppd)+'px';dg.g.innerHTML=`<b>${a===b?'Key date '+fmt(a):fmt(a)+' to '+fmt(b)}</b>`}
canvas.addEventListener('pointermove',e=>{if(!dg)return;dg.d1=Math.max(START,Math.min(END,START+Math.floor((e.clientX-dg.r.left)/ppd)));updG()});
canvas.addEventListener('pointerup',e=>{if(!dg)return;const a=Math.min(dg.d0,dg.d1),b=Math.max(dg.d0,dg.d1);const {row,g,trk}=dg;dg=null;askName(row,trk,g,a,b)});
function askName(row,trk,g,a,b){const pid=row.dataset.pipe||row.getAttribute('data-pipe'),stream=row.dataset.stream||row.getAttribute('data-stream')||'Inbox';const P=pipe(pid)||{name:'Pipeline'};
  const box=window.document.createElement('div');box.className='newbox';box.style.left=Math.min(parseFloat(g.style.left)||0,W-460)+'px';box.style.top=((parseFloat(g.style.top)||0)+32)+'px';
  box.innerHTML=`<input id="f-newstep" placeholder="Name this step, press Return"><small>${P.name} · ${a===b?fmt(a):fmt(a)+' to '+fmt(b)}</small><button data-nb="ok">Add</button><button class="x2" data-nb="x">Cancel</button>`;
  trk.appendChild(box);const inp=box.querySelector('input');inp.focus();
  const done=ok=>{const n=inp.value.trim();box.remove();g.remove();if(!ok||!n)return;
    const id=addItem(pid,n,false,{s:a,e:b});const it=byId[id]||ITEMS[ITEMS.length-1];it.t=stream;if(a===b){it.kind='ms';it.s=it.e=a}else{it.kind='span';it.s=a;it.e=b}
    save();index();renderAll();const bar=canvas.querySelector(`[data-id="${it.id}"]`);bar&&bar.classList.add('flash')};
  inp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();done(true)}if(e.key==='Escape')done(false)});
  box.addEventListener('click',e=>{const t=e.target.closest('[data-nb]');if(t)done(t.dataset.nb==='ok')})}

/* Date picker for every Start, Due and Target field (list rows, add-step row, drawer).
   Picking a day writes the date and fires the field's change, so the bar moves on the Timeline at once. Typing MMDD still works. */
(function(){const dp=document.getElementById('dp');let field=null,view=null;
 const val=f=>{const v=parseDate(f.value||'');return (v===null||Number.isNaN(v))?null:v};
 function draw(){const x=D(view);const y=x.getUTCFullYear(),m=x.getUTCMonth();document.getElementById('dpM').textContent=MON[m]+' '+y;
  const first=Math.round(Date.UTC(y,m,1)/DAY);const lead=(D(first).getUTCDay()+6)%7;const sel=val(field);let h=['Mo','Tu','We','Th','Fr','Sa','Su'].map(d=>`<span>${d}</span>`).join('');
  for(let k=0;k<42;k++){const d=first-lead+k;const dd=D(d);h+=`<button data-day="${d}" class="${dd.getUTCMonth()!==m?'out ':''}${d===TODAY?'tdy ':''}${d===sel?'sel':''}">${dd.getUTCDate()}</button>`}
  document.getElementById('dpG').innerHTML=h;
  const isStart=field.dataset.f==='s'||field.dataset.newdate==='s';document.getElementById('dpClear').textContent=isStart?'No start (key date)':'Clear';
  document.getElementById('dpL').textContent=field.getAttribute('aria-label')||''}
 function open(f){field=f;const v=val(f);const base=v==null?TODAY:v;const x=D(base);view=Math.round(Date.UTC(x.getUTCFullYear(),x.getUTCMonth(),1)/DAY);draw();
  const r=f.getBoundingClientRect();dp.classList.add('on');const w=dp.offsetWidth,h=dp.offsetHeight;let left=r.left+window.scrollX,top=r.bottom+window.scrollY+6;
  if(left+w>window.scrollX+window.innerWidth-12)left=window.scrollX+window.innerWidth-w-12;if(r.bottom+h+12>window.innerHeight)top=r.top+window.scrollY-h-6;dp.style.left=left+'px';dp.style.top=top+'px'}
 function close(){dp.classList.remove('on');field=null}
 function commit(text){const f=field;f.value=text;close();if(f.dataset.f){f.dispatchEvent(new Event('change',{bubbles:true}))}}
 document.addEventListener('click',e=>{const f=e.target.closest('input.dt');if(f){open(f);return}
  if(!dp.contains(e.target)){close();return}
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.day){const d=+b.dataset.day;commit(fmt(d));return}
  const a=b.dataset.dp;const x=D(view);
  if(a==='prev')view=Math.round(Date.UTC(x.getUTCFullYear(),x.getUTCMonth()-1,1)/DAY);
  if(a==='next')view=Math.round(Date.UTC(x.getUTCFullYear(),x.getUTCMonth()+1,1)/DAY);
  if(a==='today'){commit(fmt(TODAY));return}
  if(a==='clear'){commit('');return}
  draw()});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&field)close()});
})();
/* Add a step: name plus optional start and due. Lands in the pipeline, flashes, and shows on the Timeline. */
function addStep(pid){const nm=document.getElementById('f-add-'+pid);const n=(nm.value||'').trim();if(!n){nm.focus();return}
 const s=parseDate(document.getElementById('f-add-'+pid+'-s').value||''),e=parseDate(document.getElementById('f-add-'+pid+'-e').value||'');
 addItem(pid,n,true,{s:s,e:e});const it=ITEMS[ITEMS.length-1];
 const row=document.querySelector(`[data-row="${it.id}"]`);row&&row.classList.add('flashrow');const f=document.getElementById('f-add-'+pid);f&&f.focus()}
document.addEventListener('click',e=>{const b=e.target.closest('[data-addstep]');if(b)addStep(b.dataset.addstep)});
try {
  var qst = String(location.search || '');
  if (/[?&]view=timeline(?:&|$)/.test(qst) || /\/timeline\/?$/.test(String(location.pathname || ''))) {
    state.view = 'timeline';
    applyView();
    renderBoard();
    drawLinks();
  }
  if (/state=item/.test(qst)) openDrawer('msa');
  if (/state=milestone/.test(qst)) openDrawer('g-mvp');
} catch (eOpen) {}

})();

  } catch (err) {}
};
