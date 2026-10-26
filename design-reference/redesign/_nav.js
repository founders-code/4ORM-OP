const NAV=[["Today"],["News"],["Playbook"],["Planner"],["Calendar"],["Email"],["People"],["Contacts"],["Spaces"],["Pipeline"],["Library"],["Links"],["Notes"],["Documents"],["Recordings"],["Zoom"],["Signals"],["Completed"],["Financials"],["Integrations"]];
const GROUPS=["Today","People","Library","Signals"];
const crumb=(document.querySelector('.crumb')||{}).textContent||'';
const onName=crumb==='War Room'||crumb==='Timeline'?'Planner':crumb;
document.getElementById('side').innerHTML=NAV.map(n=>GROUPS.includes(n[0])?`<div class="grp">${n[0]}</div>`:`<div class="nav${n[0]==onName?' on':''}">${n[0]}</div>`).join('');
