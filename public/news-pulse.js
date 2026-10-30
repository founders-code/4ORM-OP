(function(){
const PULSE={
 gauges:[
  {k:'reg',t:'Regulation heat',chip:'Compliance',v:82,d:+19,building:false,buildingN:5,w:[38,44,41,52,47,58,63,82],why:['FINTRAC','fined four credit unions $816,750 for missed client reviews'],
   story:{chip:'Payments / FINTRAC',img:'/news-images/Court-ruling_sm.jpg',imp:'reg',h:'FINTRAC fines four credit unions $816,750',dek:'Penalties for failing to apply compliance procedures, assess risk and monitor clients. At one, 46 of 118 high-risk client files went more than a year without review.',wim:'regulators are penalising missed reviews and undocumented risk assessments - exactly the record a 4orm session produces automatically.'}},
  {k:'fraud',t:'Fraud heat',chip:'Fraud',v:71,d:+12,building:false,buildingN:5,w:[40,46,51,49,55,57,59,71],why:['Equifax','says AI-forged income letters are slipping past underwriting'],
   story:{chip:'Fraud',img:'/news-images/Mortgage-fraud2_sm.jpg',imp:'opp',h:'AI is making mortgage fraud harder to spot, Equifax warns',dek:'AI-forged income letters and employment records are getting past first-line underwriting. Equifax says brokers should flag suspect files earlier.',wim:'a broker who can show what was checked, and when, is the broker a lender trusts. That is the record 4orm keeps.'}},
  {k:'ai',t:'AI and governance heat',chip:'AI & governance',v:64,d:+6,building:false,buildingN:5,w:[30,33,41,45,52,50,58,64],why:['OSFI','says AI governance and testing must keep pace with adoption'],
   story:{chip:'AI & governance',img:'/news-images/Peter-Routledge_med.jpg',imp:'reg',h:'OSFI warns AI could amplify cyber and technology risks for lenders',dek:'OSFI says governance and testing must keep pace with AI adoption, and boards stay accountable for the outcome.',wim:'every AI-assisted step needs a reviewable record. That is the auditable-AI line in the deck.'}},
  {k:'mtg',t:'Mortgage market heat',chip:'Mortgage / brokerage',v:47,d:-8,building:false,buildingN:5,w:[61,58,55,57,52,50,55,47],why:['Renewals','volume steady; fixed rates flat for a third week'],
   story:{chip:'Mortgage / brokerage',img:'/news-images/Northguard-500x267.png',imp:'threat',h:'AI-powered mortgage lender Northguard Financial to launch in 2027',dek:'A new digital lender plans to launch next year with automated underwriting for prime borrowers.',wim:'new automated lenders raise the bar for suitability evidence. A design-partner conversation for brokers.'}}
 ],
 consumer:[
  {k:'fear',t:'Consumer fear index',chip:'Housing market',v:68,d:+9,building:false,buildingN:5,w:[44,47,52,50,55,58,59,68],why:['Renewals','payment shock is the top worry in searches and complaints'],
   story:{chip:'Housing market',img:'/news-images/OREA-calls-on-government-to-increase-housing-supply_med-500x336.jpg',imp:'threat',h:'Renewal payment shock is the top household worry this fall',dek:'More borrowers renewing into higher payments are searching for help and calling their lender before the renewal date.',wim:'a consumer facing a renewal decision is exactly who 4ormIQ walks through the suitability questions, on the record.'}},
  {k:'unc',t:'Uncertainty index',chip:'Housing market',v:74,d:+5,building:false,buildingN:5,w:[60,62,66,63,69,70,69,74],why:['Trade','tariff talk and rate-path doubt keep households waiting'],
   story:{chip:'Housing market',img:'/news-images/OREA-calls-on-government-to-increase-housing-supply_med-500x336.jpg',imp:'threat',h:'Households hold off on big decisions as uncertainty stays high',dek:'Trade and rate uncertainty are keeping buyers and renewers on the sidelines, waiting for clearer signals.',wim:'uncertain consumers want a second opinion before they sign. That is the 4ormIQ moment.'}},
  {k:'cmp',t:'Complaints heat',chip:'Compliance',v:58,d:+11,building:false,buildingN:5,w:[36,39,41,44,40,47,47,58],why:['OBSI','banking complaints up; unsuitable advice is a leading reason'],
   story:{chip:'Compliance',img:'/news-images/Court-ruling_sm.jpg',imp:'reg',h:'Complaints about unsuitable advice keep climbing',dek:'The ombudsman reports more consumers saying a product was not right for them, and firms struggling to show what was explained.',wim:'the firm that can show what the consumer was told wins the complaint. That record is what 4orm keeps.'}},
  {k:'scam',t:'Scam reports',chip:'Fraud',v:77,d:+14,building:false,buildingN:5,w:[48,51,55,53,58,62,63,77],why:['CAFC','investment and impersonation scams lead reported losses'],
   story:{chip:'Fraud',img:'/news-images/Mortgage-fraud2_sm.jpg',imp:'opp',h:'AI is making mortgage fraud harder to spot, Equifax warns',dek:'AI-forged income letters and employment records are getting past first-line underwriting.',wim:'4ormIQ checks who a consumer is dealing with before they send money. Scam season is when it matters most.'}}
 ],
 fear:[
  {n:'Renewals and payments',p:31,tr:'up',why:'"mortgage renewal payment increase" searches up week on week'},
  {n:'Scams and fraud',p:24,tr:'up',why:'impersonation and investment scam stories, CAFC alerts'},
  {n:'Jobs and income',p:19,tr:'fl',why:'layoff headlines steady'},
  {n:'Trade and tariffs',p:16,tr:'dn',why:'fewer tariff headlines than last week'},
  {n:'Home prices',p:10,tr:'dn',why:'prices flat in most markets'}
 ],
 cmkt:[
  {k:'Consumer confidence (weekly)',v:'49.8',d:'-0.6',dir:'up',s:[51.2,50.9,50.7,50.9,50.4,50.3,50.4,49.8]},
  {k:'Consumer confidence (monthly)',v:'78.4',d:'-1.9',dir:'up',s:[82.1,81.6,80.9,80.3,80.3,79.6,80.3,78.4]},
  {k:'Mortgages 90+ days late',v:'0.24%',d:'+0.02',dir:'up',s:[0.2,0.2,0.21,0.21,0.22,0.22,0.22,0.24]},
  {k:'Fraud losses reported, YTD',v:'$512M',d:'+9%',dir:'up',s:[300,330,360,390,420,450,480,512]}
 ],
 weeks:['14 Sep','21 Sep','28 Sep','5 Oct','12 Oct','19 Oct','26 Oct','Now'],
 regs:[
  {n:'FINTRAC',c:[1,0,2,1,3,1,2,4],last:'Penalty: four credit unions, $816,750'},
  {n:'OSFI',c:[0,1,1,0,2,1,1,2],last:'Speech: AI, cyber and technology risk'},
  {n:'FSRA',c:[1,1,0,2,1,0,2,1],last:'Licence refusal: mortgage agent'},
  {n:'BCFSA',c:[0,0,1,1,0,2,1,1],last:'Consultation: mortgage broker conduct'},
  {n:'CSA',c:[1,0,0,1,1,0,1,0],last:'Notice: crypto trading platform terms'},
  {n:'AMF',c:[0,1,0,0,1,1,0,1],last:'Guideline: third-party risk'},
  {n:'FCAC',c:[0,0,1,0,0,1,0,1],last:'Report: complaint handling review'},
  {n:'CIRO',c:[0,1,0,1,0,0,1,0],last:'Bulletin: suitability reminders'},
  {n:'Bank of Canada',c:[0,0,0,1,0,0,1,0],last:'Rate announcement'}
 ],
 mkt:[
  {k:'Bank of Canada rate',v:'2.25%',d:'0.00',dir:'fl',s:[2.25,2.25,2.25,2.25,2.25,2.25,2.25,2.25]},
  {k:'5-year Canada bond',v:'2.94%',d:'+0.06',dir:'up',s:[2.81,2.84,2.83,2.88,2.86,2.9,2.91,2.94]},
  {k:'5-year posted mortgage',v:'Loading',d:'',dir:'fl',s:[4.45,4.45,4.45,4.45,4.45,4.45,4.45,4.45]},
  {k:'CAD per USD',v:'1.382',d:'-0.004',dir:'dn',s:[1.391,1.389,1.387,1.388,1.385,1.384,1.386,1.382]}
 ]};

window.__NEWS_PULSE_FIXTURE = PULSE;
window.__NEWS_PULSE = PULSE;
function q(root, sel){ return (root.querySelector && root.querySelector(sel)) || null; }
function qa(root, sel){ return root.querySelectorAll ? Array.from(root.querySelectorAll(sel)) : []; }
const GCOL={reg:'#3b82ff',fraud:'#ff4d6d',ai:'#a173ff',mtg:'#19d38a',fear:'#ff8a3d',unc:'#f5c443',cmp:'#ff5fa8',scam:'#22d3c5'};
/* Compact dial (design 28): same drawing as the control-room dial, sized ~118px wide for the old gauge card. */
function dialSVG(v,c){
  const cx=59,cy=56,r=44,vv=Math.max(0,Math.min(100,Number(v)||0));
  const a=t=>Math.PI*(1-t/100),P=t=>[cx+r*Math.cos(a(t)),cy-r*Math.sin(a(t))];
  const arc=(t0,t1,col,w,ex)=>{const p0=P(t0),p1=P(t1);return `<path d="M${p0[0].toFixed(1)} ${p0[1].toFixed(1)} A${r} ${r} 0 0 1 ${p1[0].toFixed(1)} ${p1[1].toFixed(1)}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round"${ex||''}/>`;};
  let ticks='';
  for(let i=0;i<=10;i++){const t=i*10,ang=a(t),r1=r+6,r2=r+(i%5===0?12:9);
    ticks+=`<line x1="${(cx+r1*Math.cos(ang)).toFixed(1)}" y1="${(cy-r1*Math.sin(ang)).toFixed(1)}" x2="${(cx+r2*Math.cos(ang)).toFixed(1)}" y2="${(cy-r2*Math.sin(ang)).toFixed(1)}" stroke="rgba(163,176,210,.5)" stroke-width="1"/>`;}
  const na=a(vv),nx=cx+(r-8)*Math.cos(na),ny=cy-(r-8)*Math.sin(na);
  return `<svg viewBox="0 0 118 66" aria-hidden="true">${arc(0,100,'#23252c',7)}${arc(0,50,'rgba(25,211,138,.3)',2.5)}${arc(50,75,'rgba(255,181,71,.45)',2.5)}${arc(75,100,'rgba(255,77,109,.55)',2.5)}${vv>0.01?arc(0.01,vv,c,7,` style="filter:drop-shadow(0 0 5px ${c}aa)" class="arc"`):''}${ticks}<line class="ndl" x1="${cx}" y1="${cy}" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}" stroke="#fff" stroke-width="2" stroke-linecap="round"/><circle cx="${cx}" cy="${cy}" r="4.5" fill="#0a0b0e" stroke="${c}" stroke-width="2"/></svg>`;
}
window.bindNewsPulse = function(root, pulse){
  if(!root) return;
  const PULSE = pulse || window.__NEWS_PULSE || window.__NEWS_PULSE_FIXTURE;
  if(!PULSE || !q(root,'#pz')) return;
  const reduce = (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  let VIEW='market', FOCUS=window.__newsFocus || null;
  try {
    const t = new URLSearchParams(location.search).get('topic');
    if (t) FOCUS = t;
  } catch (e) {}
  window.__newsFocus = FOCUS;
  const GA=()=>VIEW==='market'?PULSE.gauges:PULSE.consumer;
  function drawGauges(anim){const g=q(root,'#gg'); if(!g) return;
   g.innerHTML=GA().map(x=>{
    const c=GCOL[x.k]||'#3b82ff';
    const mx=Math.max.apply(null,x.w.concat([1]));
    const nWeeks=x.buildingN!=null?x.buildingN:0;
    const building=!!x.building;
    const val=building||x.v==null?null:x.v;
    const shown=val==null?'-':(anim?0:val);
    let delta;
    if(building) delta='building a baseline, '+nWeeks+' of 4 weeks';
    else if(!x.d) delta='<span class="fl">level</span>';
    else delta='<span class="'+(x.d>=0?'up':'dn')+'">'+(x.d>=0?'+':'')+x.d+'</span> vs normal';
    const lead=(x.story&&x.story.h)||(Array.isArray(x.why)?x.why.join(' '):(x.why||'No story this week'));
    return `<button class="gc${FOCUS===x.k?' on':''}" style="--c:${c}" data-g="${x.k}" data-action="news-heat-focus" aria-pressed="${FOCUS===x.k}">
      ${dialSVG(anim?0:(val||0),c)}
      <h5 class="gt">${x.t}</h5>
      <div class="num"><b data-to="${val==null?'':val}">${shown}</b><small class="gd">${delta}</small></div>
      <div class="sp">${(x.w||[]).map((n,i)=>`<i class="${i===(x.w.length-1)?'now':''}" style="height:${Math.max(3,(n/mx)*18)}px" data-tip="<b>${x.t}</b><br>${(PULSE.weeks&&PULSE.weeks[i])||''}: ${n}"></i>`).join('')}</div>
      <div class="lead why">${lead}</div>
    </button>`;
   }).join('');
   if(anim&&!reduce){GA().forEach((x,gi)=>{if(x.building||x.v==null)return;const el=g.children[gi];if(!el)return;const c=GCOL[x.k]||'#3b82ff';const t0=performance.now();const D=1100+gi*120;
    (function step(t){const p=Math.min(1,(t-t0)/D);const e=1-Math.pow(1-p,3);const v=x.v*e;const svg=el.querySelector('svg'); if(svg) svg.outerHTML=dialSVG(v,c);const b=el.querySelector('.num b'); if(b) b.textContent=Math.round(v);if(p<1)requestAnimationFrame(step)})(t0)})}
  }
  function drawRadar(){const g=q(root,'#rrg'); if(!g) return;
   const ramp=window.heatRampD||function(n){return {bg:n?('#3b82ff'):'rgba(255,255,255,.04)',text:n?String(n):'',n:n||0};};
   let h='<span></span>'+PULSE.weeks.map(w=>`<span class="wk">${w}</span>`).join('')+'<span class="wk" style="text-align:left;padding-left:6px">Latest</span>';
   PULSE.regs.forEach(r=>{h+=`<span class="rn">${r.n}</span>`+r.c.map((n,i)=>{const c=ramp(n);return `<span class="c" style="background:${c.bg};color:rgba(255,255,255,.85)" data-action="news-reg-week" data-tip="<b>${r.n}</b> &middot; week of ${PULSE.weeks[i]}<br>${n} ${n===1?'item':'items'}">${c.text}</span>`;}).join('')+`<span class="la"><b>${r.c[7]?'This week':'Earlier'}:</b> ${r.last}</span>`});
   g.innerHTML=h}
  function tiles(list){return (list||[]).map(m=>{const mn=Math.min.apply(null,m.s||[0]),mx=Math.max.apply(null,m.s||[0]),rg=(mx-mn)||1;
    const pts=(m.s||[]).map((v,i)=>`${(i/Math.max(1,m.s.length-1)*100).toFixed(1)},${(18-((v-mn)/rg)*14).toFixed(1)}`).join(' ');
    return `<div class="mt" data-tip="<b>${m.k}</b><br>${m.v}, ${m.d}"><div class="k">${m.k}</div><div class="v"><b>${m.v}</b><span class="${m.dir}">${m.d}</span></div>
    <svg viewBox="0 0 100 22" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="#2e6bf2" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/></svg></div>`}).join('')}
  function drawMkt(){const el=q(root,'#mkg'); if(el) el.innerHTML=tiles(PULSE.mkt||[])}
  const FXC=['#2e6bf2','#e8642c','#12a36a','#6b4fd8','#c98408'];
  function drawConsumer(){
    const fx=q(root,'#fxBar'); if(fx) fx.innerHTML=(PULSE.fear||[]).map((f,i)=>`<i style="flex:${f.p};background:${FXC[i]}" data-tip="<b>${f.n}</b><br>${f.p}% of worry this week">${f.p>=12?f.p+'%':''}</i>`).join('');
    const fl=q(root,'#fxList'); if(fl) fl.innerHTML=(PULSE.fear||[]).map((f,i)=>`<div class="fxr"><span class="sw" style="background:${FXC[i]}"></span><b>${f.n}</b><span class="pc">${f.p}%</span><span class="tr ${f.tr}">${f.tr==='up'?'Rising':f.tr==='dn'?'Easing':'Steady'}</span><small>${f.why}</small></div>`).join('');
    const ck=q(root,'#ckg'); if(ck) ck.innerHTML=tiles(PULSE.cmkt||[])}
  function setHero(s,top){
    const ntop=q(root,'.hero .ntop, #hTop'); if(ntop) ntop.textContent=top||'Top release today';
    const h=q(root,'.hero h2, #hH'); if(h && s && s.h) h.textContent=s.h;
    const dek=q(root,'.hero .sum, .hero .dek, #hDek'); if(dek && s) dek.textContent=s.dek||'';
    const wim=q(root,'.hero .take, #hWim'); if(wim && s){ const w=String(s.wim||'').replace(/<[^>]*>/g,'').replace(/Why it matters to 4orm:?/i,'').trim(); wim.style.display = w ? '' : 'none'; if(w) wim.innerHTML = (String(s.wim).indexOf('<b>')===0)?s.wim:('<b>Why it matters to 4orm:</b> '+s.wim); }
    const im=q(root,'.hero img, #hImg'); if(im && s && s.img){ im.style.visibility=''; im.src=s.img; }
    const chip=q(root,'.hero .chipc, .hero .cat, #hChip'); if(chip && s && s.chip) chip.textContent=s.chip;
  }
  function applyTopic(){
    const g=GA().find(x=>x.k===FOCUS);
    const pz=q(root,'#pz'); if(pz) pz.classList.toggle('focus',!!FOCUS);
    const clr=q(root,'#pzClr'); if(clr) clr.classList.toggle('on',!!FOCUS);
    qa(root,'.gc').forEach(b=>{b.classList.toggle('on',b.getAttribute('data-g')===FOCUS);b.setAttribute('aria-pressed',String(b.getAttribute('data-g')===FOCUS))});
    qa(root,'.chips .chip').forEach(c=>c.classList.toggle('on', g ? c.textContent.trim()===g.chip.replace('&','&') : /^(All|Show everything)$/.test(c.textContent.trim())));
    const cards=qa(root,'.grid .card, .grid .story');
    const keep=[];
    cards.forEach(c=>{
      const ch=((c.querySelector('.chipc, .cat')||{}).textContent||'').trim();
      const hit=!g || ch===((g.story&&g.story.chip)||g.chip);
      c.hidden=!!g && !hit;
      c.classList.remove('dim');
      if(hit) keep.push(c);
    });
    if(g && keep.length){
      keep.sort(function(a,b){ return String(b.getAttribute('data-at')||'').localeCompare(String(a.getAttribute('data-at')||'')); });
      const parent=keep[0].parentNode;
      keep.forEach(function(c){ parent.appendChild(c); });
    }
    if(g) setHero(g.story,'Top release in '+g.t.replace(' heat','').toLowerCase());
    else setHero({h:q(root,'.hero h2')&&q(root,'.hero h2').textContent},'Top release today');
  }
  function focus(k){
    FOCUS = (FOCUS===k) ? null : k;
    window.__newsFocus = FOCUS;
    try {
      const u=new URL(location.href);
      if(FOCUS) u.searchParams.set('topic', FOCUS); else u.searchParams.delete('topic');
      history.replaceState(null, '', u.pathname + u.search + u.hash);
    } catch(e) {}
    applyTopic();
  }
  const gg=q(root,'#gg'); if(gg && !gg._pz){ gg._pz=1; gg.addEventListener('click',e=>{const b=e.target.closest('.gc'); if(b){ e.preventDefault(); focus(b.getAttribute('data-g')); }}); }
  const clr=q(root,'#pzClr'); if(clr && !clr._pz){ clr._pz=1; clr.addEventListener('click',()=>{ if(FOCUS) focus(FOCUS); }); }
  const pzs=q(root,'.pzs'); if(pzs && !pzs._pz){ pzs._pz=1; pzs.addEventListener('click',e=>{const b=e.target.closest('[data-pv]'); if(!b)return; const v=b.getAttribute('data-pv'); if(VIEW===v)return; if(FOCUS)focus(FOCUS); VIEW=v; const band=q(root,'#pz'); if(band) band.classList.toggle('consumer', v==='consumer');
    qa(root,'.pzs button').forEach(x=>x.setAttribute('aria-pressed',String(x.getAttribute('data-pv')===v)));
    const t=q(root,'#pzT'); if(t) t.textContent=v==='market'?'Market pulse':'Consumer pulse';
    const s=q(root,'#pzS'); if(s) s.innerHTML=v==='market'?'This week against the last 8 weeks &middot; Canadian sources &middot; updated with every sweep':'How Canadian households feel this week &middot; news, searches, complaints and scam reports';
    const m=q(root,'#pzMarket'); if(m) m.hidden=v!=='market';
    const c=q(root,'#pzConsumer'); if(c) c.hidden=v==='market';
    drawGauges(true);}); }
  let tip=q(root,'#ztip'); if(!tip){ tip=document.createElement('div'); tip.id='ztip'; tip.className='ztip'; tip.setAttribute('role','tooltip'); (root.appendChild?root.appendChild(tip):document.body.appendChild(tip)); }
  const pz=q(root,'#pz');
  if(pz && !pz._tip){ pz._tip=1;
    pz.addEventListener('pointermove',e=>{const t=e.target.closest('[data-tip]'); if(!t){tip.classList.remove('on');return}
      tip.innerHTML=t.getAttribute('data-tip'); tip.classList.add('on'); const w=tip.offsetWidth||180; tip.style.left=Math.min(innerWidth-w-12,e.clientX+14)+'px'; tip.style.top=(e.clientY+16)+'px';});
    pz.addEventListener('pointerleave',()=>tip.classList.remove('on'));
  }
  const sig = JSON.stringify((GA()||[]).map(function(g){ return g.k+':'+g.v; }));
  const first = root._pulseSig !== sig;
  root._pulseSig = sig;
  const upd = q(root,'#pzUpd');
  if (upd) upd.textContent = PULSE.updated ? ('Updated '+PULSE.updated) : '';
  drawGauges(!(window.fixtureMockup) && first); drawRadar(); drawMkt(); drawConsumer();
  applyTopic();
};
window.newsPulseBandHtml = function(sample){
  let min=false; try{ min = localStorage.getItem('cr_pulse_min')==='1'; }catch(e){}
  const tog = `<button type="button" class="pzmin" onclick="var z=this.closest('.pz');z.classList.toggle('min');var m=z.classList.contains('min');this.textContent=m?'Expand':'Collapse';try{localStorage.setItem('cr_pulse_min',m?'1':'0')}catch(e){}" style="font:inherit;font-size:12.5px;font-weight:700;border-radius:999px;padding:4px 12px;border:1px solid rgba(255,255,255,.35);background:rgba(255,255,255,.08);color:#e6eaf2!important;cursor:pointer;margin-left:auto">${min?'Expand':'Collapse'}</button>`;
  return `<style>.pz.min .gg,.pz.min .pzb,.pz.min #pzClr{display:none!important}.pz.min{padding-bottom:10px}</style><section class="pz${min?' min':''}" id="pz" aria-label="Market pulse">
  <div class="pzh"><h3 id="pzT">Market pulse</h3><div class="pzs" role="group" aria-label="Pulse view"><button type="button" data-pv="market" aria-pressed="true" data-action="news-pulse-view">Market</button><button type="button" data-pv="consumer" aria-pressed="false" data-action="news-pulse-view">Consumer</button></div><span class="s" id="pzS">This week against the last 8 weeks &middot; Canadian sources</span><span class="s" id="pzUpd"></span>
    <div class="r"><span class="clr" id="pzClr" data-action="news-heat-clear">Show everything</span>${sample?'<span class="samp">Sample data</span>':''}${tog}</div></div>
  <div class="gg" id="gg"></div>
  <div class="pzb" id="pzMarket">
    <div class="rr"><h4>Regulator radar <span>what each regulator published, week by week</span></h4><div class="rrg" id="rrg"></div>
      <div class="rkey">Items per week <i class="h0"></i>0 <i class="h1"></i>1 <i class="h2"></i>2 <i class="h3"></i>3 <i class="h4"></i>4 or more</div></div>
    <div class="mk"><h4>Market numbers <span>what moves mortgages and lenders</span></h4><div class="mkg" id="mkg"></div>
      <div class="src2">Bank of Canada Valet, daily close &middot; 30-day line</div></div>
  </div>
  <div class="pzb" id="pzConsumer" hidden>
    <div class="rr"><h4>What is driving the fear <span>share of consumer worry, from news, searches and complaints this week</span></h4>
      <div class="fx" id="fxBar"></div><div class="fxl" id="fxList"></div></div>
    <div class="mk"><h4>Consumer numbers <span>how households are actually doing</span></h4><div class="mkg" id="ckg"></div>
      <div class="src2">Bloomberg Nanos (weekly) &middot; Conference Board (monthly) &middot; Equifax Canada (quarterly) &middot; CAFC (monthly)</div></div>
  </div>
</section><div class="ztip" id="ztip" role="tooltip"></div>`;
};
})();
