/* Lists tab from 20-outreach-lists.html */
(function () {
  window.bindOutreachLists = function (root) {
    if (!root || !window.OUTREACH_LISTS_DATA) return;
    var DATA = window.OUTREACH_LISTS_DATA;
    var document = {
      querySelector: function (sel) { return root.querySelector(sel); },
      querySelectorAll: function (sel) { return root.querySelectorAll(sel); },
      getElementById: function (id) { return root.querySelector('#' + id); },
      createElement: function (t) { return window.document.createElement(t); },
      addEventListener: function (t, fn) { root.addEventListener(t, fn); }
    };
    function toast(m) {
      var t = root.querySelector('#toast') || root.querySelector('#tmsg');
      if (root.querySelector('#tmsg')) root.querySelector('#tmsg').textContent = m;
      var box = root.querySelector('#toast');
      if (box) { box.classList.add('show'); setTimeout(function () { box.classList.remove('show'); }, 2500); }
    }
    function closeModal() { var m = root.querySelector('#modal'); if (m) m.classList.remove('open'); }
    function modal(h) {
      var box = root.querySelector('#mbox'); var wrap = root.querySelector('#modal');
      if (box) box.innerHTML = h; if (wrap) wrap.classList.add('open');
    }
    function openSpace(id) { toast('Space for that row'); }
    function markSent(x, v) { x.sent = !!v; if (typeof renderList === 'function') renderList(); if (typeof renderNav === 'function') renderNav(); }
    const TODAY='Tue 27 Oct';
const ALL=[...DATA.inv,...DATA.ent];
ALL.forEach(x=>{x.sent=false;x.log=[];});
const LISTS=[
 {id:'inv-w',name:'Pre-seed investors · this week',sub:'25 funds · 5 a day',k:'inv',f:x=>x.k=='inv'},
 {id:'ent-w',name:'Enterprise BC · this week',sub:'#26–50 · 5 a day',k:'ent',f:x=>x.k=='ent'&&x.rank>25},
 {id:'ent-p',name:'Enterprise BC · protected',sub:'#1–25 · after we learn',k:'ent',f:x=>x.k=='ent'&&x.rank<=25}];
const COLS={
 inv:[['rank','#',1],['name','Fund',1],['reach','Phone and email',1],['route','Reach by',1],['stage','Stage',1],['day','Day',1],['cheque','First cheque',1],['base','Base',0],['sector','Sector fit',0],['recent','Most recent deal',0]],
 ent:[['rank','#',1],['name','Company',1],['reach','Phone and email',1],['route','Reach by',1],['stage','Stage',1],['day','Day',1],['segment','Segment',1],['foot','B.C. footprint',0],['scale','Scale',0]]};
let curList=LISTS[0],group='day',filt='all',q='';
const $=s=>document.querySelector(s);
const fact=(x,k)=>((x.facts.find(f=>f[0]==k)||[])[1])||'-';
function cell(x,c){
 switch(c){case'rank':return '<td class="mut">'+x.rank+'</td>';
 case'name':return '<td class="nm"><b>'+x.n+'</b><small>'+(x.p||'No named contact yet')+'</small></td>';
 case'route':return '<td>'+routePill(x)+'</td>';
 case'stage':return '<td><span class="pill '+stCls(x.st)+'">'+x.st+'</span></td>';
 case'day':return '<td class="mut nw">'+(x.day||'-')+'</td>';
 case'cheque':return '<td class="mut">'+fact(x,'First cheque')+'</td>';
 case'base':return '<td class="mut">'+fact(x,'Base')+'</td>';
 case'sector':return '<td class="mut">'+fact(x,'Sector fit')+'</td>';
 case'recent':return '<td class="mut">'+fact(x,'Most recent deal')+'</td>';
 case'segment':return '<td class="mut">'+fact(x,'Segment')+'</td>';
 case'foot':return '<td class="mut">'+fact(x,'B.C. footprint')+'</td>';
 case'scale':return '<td class="mut">'+fact(x,'Scale')+'</td>';
 case'phone':return '<td class="mut">'+fact(x,'Phone')+'</td>';
 case'email':return '<td class="mut">'+(x.em||'-')+'</td>';
 case'reach':return '<td class="reach"><div class="ph">'+(fact(x,'Phone')||'-')+'</div><div class="em">'+(x.em||'-')+'</div></td>';}}
function routePill(x){const m={Email:'p-blue',Form:'p-violet',Apply:'p-violet',Intro:'p-amber',Call:'p-green','Find contact':'p-red'};return '<span class="pill '+(m[x.r]||'p-gray')+'">'+x.r+'</span>';}
function stCls(s){return /Storage/.test(s)?'p-gray':/Cold/.test(s)?'p-blue':/reach out|Send/.test(s)?'p-amber':/Lost|Pass|Not now/.test(s)?'p-red':'p-green';}
function renderNav(){
 $('#listnav').innerHTML=LISTS.map(l=>{const r=ALL.filter(l.f),s=r.filter(x=>x.sent).length;return '<div class="li'+(l==curList?' on':'')+'" data-l="'+l.id+'"><b>'+l.name+'</b><span>'+l.sub+' · '+s+' of '+r.length+' sent</span><div class="bar2"><i style="width:'+(r.length?s/r.length*100:0)+'%"></i></div></div>';}).join('');
 document.querySelectorAll('.li').forEach(e=>e.onclick=()=>{curList=LISTS.find(l=>l.id==e.dataset.l);group=curList.id=='ent-p'?'none':'day';syncChips();renderList();renderNav();});}
function syncChips(){document.querySelectorAll('[data-g]').forEach(c=>c.classList.toggle('on',c.dataset.g==group));document.querySelectorAll('[data-f]').forEach(c=>c.classList.toggle('on',c.dataset.f==filt));}
const shut={};
function renderList(){
 const cols=COLS[curList.k].filter(c=>c[2]);
 let rows=ALL.filter(curList.f);
 const tot=rows.length,s=rows.filter(x=>x.sent).length;
 $('#lname').textContent=curList.name;$('#lstat').textContent=s+' of '+tot+' sent · '+rows.filter(x=>/Replied|Call booked|Meeting/.test(x.st)).length+' replies';
 $('#lprog').style.width=(tot?s/tot*100:0)+'%';
 if(filt=='todo')rows=rows.filter(x=>!x.sent);if(filt=='sent')rows=rows.filter(x=>x.sent);
 if(q)rows=rows.filter(x=>(x.n+' '+x.p).toLowerCase().includes(q));
 let h='<tr><th style="width:44px">Sent</th>'+cols.map(c=>'<th>'+c[1]+'</th>').join('')+'</tr>';
 const line=x=>'<tr class="row'+(x.sent?' sent':'')+'" data-id="'+x.id+'"><td><span class="ck'+(x.sent?' on':'')+'" data-ck="'+x.id+'">'+(x.sent?'Y':'')+'</span></td>'+cols.map(c=>cell(x,c[0])).join('')+'</tr>';
 let groups=[];
 if(group=='day')groups=DATA.days.map(d=>[d,rows.filter(x=>x.day==d)]);
 else if(group=='stage')groups=DATA.stages[curList.k].map(st=>[st,rows.filter(x=>x.st==st)]);
 else groups=[['',rows]];
 groups.forEach(([g,r])=>{
  if(g){const key=curList.id+g,sn=r.filter(x=>x.sent).length;
   h+='<tr class="gh'+(g==TODAY?' today':'')+'" data-g="'+key+'"><td colspan="'+(cols.length+1)+'">'+g+(g==TODAY?' · today':'')+'<span class="x">'+r.length+(group=='day'?' to send · '+sn+' sent':'')+'</span><span class="tg">'+(shut[key]?'Open':'Close')+'</span></td></tr>';
   if(shut[key])return;}
  h+=r.length?r.map(line).join(''):'<tr><td colspan="'+(cols.length+1)+'" class="empty">Nothing here yet</td></tr>';});
 $('#ltable').innerHTML=h;
 document.querySelectorAll('#ltable tr.gh').forEach(e=>e.onclick=()=>{shut[e.dataset.g]=!shut[e.dataset.g];renderList();});
 document.querySelectorAll('#ltable tr.row').forEach(e=>e.onclick=ev=>{if(ev.target.dataset.ck)return;openSpace(e.dataset.id,[...document.querySelectorAll('#ltable tr.row')].map(r=>r.dataset.id));});
 document.querySelectorAll('[data-ck]').forEach(e=>e.onclick=ev=>{ev.stopPropagation();const x=ALL.find(y=>y.id==e.dataset.ck);markSent(x,!x.sent);});
 renderColMenu();}
function renderColMenu(){$('#colmenu').innerHTML='<div class="h">Show columns</div>'+COLS[curList.k].map((c,i)=>'<label><input type="checkbox" data-c="'+i+'"'+(c[2]?' checked':'')+(i<2?' disabled':'')+'>'+c[1]+'</label>').join('');
 document.querySelectorAll('[data-c]').forEach(e=>e.onchange=()=>{COLS[curList.k][+e.dataset.c][2]=e.checked?1:0;renderList();});}
$('#colBtn').onclick=e=>{e.stopPropagation();$('#colmenu').classList.toggle('open');};
document.addEventListener('click',e=>{if(!e.target.closest('#colmenu'))$('#colmenu').classList.remove('open');});
document.querySelectorAll('[data-g]').forEach(c=>c.onclick=()=>{group=c.dataset.g;syncChips();renderList();});
document.querySelectorAll('[data-f]').forEach(c=>c.onclick=()=>{filt=c.dataset.f;syncChips();renderList();});
$('#lsearch').oninput=e=>{q=e.target.value.toLowerCase();renderList();};
$('#todayBtn').onclick=()=>{const r=ALL.filter(curList.f).filter(x=>x.day==TODAY&&!x.sent);if(!r.length){toast('Nothing left for today in this list');return;}openSpace(r[0].id,r.map(x=>x.id));};
$('#newList').onclick=()=>modal('<h3>New list</h3><p>A list is a table of contacts with the columns you choose. Start it from a tag, a pipeline stage or a sheet in Documents.</p><input placeholder="Name, for example Regulators this month"><select><option>From a GoHighLevel tag</option><option>From a pipeline and stage</option><option>From a sheet in Documents</option><option>Empty, add people by hand</option></select><div class="row"><button class="btn" onclick="closeModal()">Cancel</button><button class="btn pri" onclick="closeModal();toast(\'List created\')">Create list</button></div>');
document.querySelectorAll('#cseg span').forEach(s=>s.onclick=()=>{if(s.dataset.v=='contacts')toast('Contacts table stays as it is today');});


    if (typeof renderNav === 'function') renderNav();
    if (typeof renderList === 'function') renderList();
  };
})();
