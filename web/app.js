import {agreement} from './sample.js';
import {laneState,releaseable,retryable,terminal} from './workflow.js';

const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = cents => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(cents/100);
const kindName = kind => kind==='worker'?'Contractor compensation':'Employer-funded benefit';
const formatDate = date => new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(date+'T00:00:00Z'));
const today = () => new Date().toISOString().slice(0,10);
const runDate = () => $('run-date').value;
const sandboxMode = () => $('mode').value==='sandbox';

let config = {ai:false,sandbox:false};
let plan = null;
let results = {};
let approved = false;
let busy = false;
let inspected = '';
let schedule;
let poll;

function notice(text,error=false) {
  $('notice').textContent=text;
  $('notice').classList.toggle('error',error);
}

async function api(path,data) {
  const response=await fetch('/api/'+path,data===undefined?{}:{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)
  });
  const result=await response.json();
  if(!response.ok) throw new Error(result.error||'Service unavailable.');
  return result;
}

function evidence(row) {
  const signal=plan.decisions?.[row.kind];
  const terms=signal?.signals?.map(word=>'<span class="signal">'+esc(word)+'</span>').join('')||'';
  const model=signal ? '<div class="evidence-signals"><span>Model signals</span>'+terms+
    '<small title="Score difference between the top two classes. This is not a probability.">Margin '+esc(signal.margin)+'</small></div>' :
    '<div class="evidence-signals"><span>Model extraction</span><span class="signal">Quote checked</span></div>';
  return '<article class="review-row" id="clause-'+row.kind+'"><div class="term-top"><div><strong>'+kindName(row.kind)+
    '</strong><small>'+esc(row.payee)+' · Due '+formatDate(row.due)+'</small></div><span class="amount">'+money(row.cents)+'</span></div>'+
    '<blockquote>'+esc(row.evidence)+'</blockquote>'+model+
    (row.amendment?'<p class="amendment"><strong>Amendment applied</strong> '+
      (row.originalDue?'<del>'+formatDate(row.originalDue)+'</del> → <strong>'+formatDate(row.due)+'</strong><br>':'')+esc(row.amendment)+'</p>':'')+
    '</article>';
}

function payment(row) {
  const result=results[row.kind];
  const status=result?.status;
  const tone=status==='SUCCESS'?'paid':terminal.has(status)?'failed':status?'processing':'pending';
  const recipient=sandboxMode()?' · '+esc(config.recipients?.[row.kind]):'';
  const observed=result?.observedAt?' <span class="stamp">Last checked '+esc(new Date(result.observedAt).toLocaleTimeString())+'</span>':'';
  const identifiers=result?.id?'<p class="payment-meta">'+(sandboxMode()?'PayPal batch ':'Simulation ')+esc(result.id)+
    (result.itemId?' · Item '+esc(result.itemId):'')+observed+'</p>':'';
  const retry=retryable(status)&&result.attempt<5&&row.due<=runDate()?'<button class="secondary" data-retry="'+row.kind+'" '+
    (busy?'disabled':'')+'>Retry '+(row.kind==='worker'?'worker payout':'benefit only')+'</button>':'';
  return '<article class="payout-row '+tone+'"><div class="payout-top"><div><strong>'+esc(row.payee)+' · '+money(row.cents)+
    '</strong><small>'+formatDate(row.due)+recipient+'</small></div><span class="badge '+tone+'">'+
    esc(laneState(row,result,approved,runDate()))+'</span></div>'+identifiers+retry+'</article>';
}

function nextDate(rows) {
  return rows.filter(row=>!results[row.kind]?.id&&row.due>runDate()).map(row=>row.due).sort()[0];
}

function pending() {
  return Object.values(results).some(result=>result.id&&!terminal.has(result.status));
}

function render() {
  const rows=plan?.obligations??[];
  const isSandbox=sandboxMode();
  const started=Object.keys(results).length>0;
  const due=releaseable(rows,results,runDate());
  $('analyze').disabled=busy||!$('contract').value.trim();
  $('sample').disabled=busy;
  $('contract').disabled=busy;
  $('upload').disabled=busy;
  $('mode').disabled=busy||started;
  $('run-date').disabled=busy;
  $('next-due').disabled=busy||!nextDate(rows);
  $('fit').disabled=!schedule||!rows.length;
  $('scenario').disabled=busy||started;
  $('scenario').hidden=isSandbox;
  $('scenario-wrap').hidden=isSandbox;
  $('environment').textContent=isSandbox?'◆ PayPal Sandbox':'◆ Simulation mode';
  $('ledger-source').textContent=isSandbox?'PayPal Sandbox':'Simulated clearing';
  $('analysis-mode').textContent=config.ai
    ? 'Analysis sends synthetic agreement text to the configured AI model.'
    : 'The built-in classifier identifies clauses. Rules validate amounts, dates and evidence.';
  const cleared=rows.filter(row=>results[row.kind]?.status==='SUCCESS');
  $('metrics').innerHTML=[
    ['01  INFERRED',rows.length,'Obligations with evidence'],
    ['02  SCHEDULED',approved?money(rows.reduce((sum,row)=>sum+row.cents,0)):'—',approved?due.length+' ready for this run':'Awaiting approval'],
    ['03  CLEARED',cleared.length+' / '+rows.length,isSandbox?'PayPal Sandbox item status':'Simulated item status']
  ].map(([label,value,hint])=>'<div class="metric"><small>'+label+'</small><strong>'+value+'</strong><span>'+hint+'</span></div>').join('');
  $('source').innerHTML=plan?'<span class="badge">'+esc(plan.source)+'</span>':'';
  $('obligations').innerHTML=!plan?'<div class="empty"><strong>Start with a signed agreement</strong><p>Analyze the text to see each inferred obligation and its supporting quote.</p></div>':
    '<div class="review-title">'+esc(plan.reference)+' · '+esc(plan.name)+'</div>'+
    rows.map(evidence).join('')+
    (plan.concerns.length?'<div class="concerns"><strong>Needs separate review</strong><ul>'+
      plan.concerns.map(note=>'<li>'+esc(note)+'</li>').join('')+'</ul></div>':'')+
    (!rows.length?'<p>No supported payment terms were identified.</p>':'');
  const focus=rows.find(row=>row.kind===inspected);
  $('inspect').hidden=!focus;
  $('inspect').innerHTML=focus?'<strong>'+esc(focus.payee)+' · '+money(focus.cents)+'</strong>'+
    '<span>'+esc(laneState(focus,results[focus.kind],approved,runDate()))+' · '+formatDate(focus.due)+'</span>'+
    '<p>'+esc(focus.amendment||focus.evidence)+'</p><a href="#clause-'+focus.kind+'">View source clause ↑</a>'+
    '<a href="#clearing">View clearing ledger ↓</a>':'';
  if(schedule&&runDate()) schedule.update({rows,today:runDate(),results,
    state:row=>laneState(row,results[row.kind],approved,runDate()),amount:money});
  $('timeline').innerHTML=rows.length?rows.map(payment).join(''):'<div class="empty">Payout status and transaction references appear here.</div>';
  $('actions').innerHTML=!rows.length?'':'<div class="action-line"><label class="ack"><input type="checkbox" id="approve" '+
    (approved?'checked ':'')+(busy||started?'disabled':'')+'> I checked the clauses, amounts and recipients.</label>'+
    '<button class="primary" id="send" '+(approved&&due.length&&!busy?'':'disabled')+'>'+
    (isSandbox?'Release due PayPal sandbox payouts':'Release due simulated payouts')+'</button></div>'+
    '<p class="hint">'+(isSandbox?'Releasing sends test funds immediately. The sandbox run date selects which obligations are due.':
      'Simulation shows the same schedule, clearing and retry flow using test scenarios.')+'</p>';
  $('refresh')?.remove();
  if(pending()){
    const check=document.createElement('button');
    check.className='secondary';
    check.id='refresh';
    check.disabled=busy;
    check.textContent='Refresh clearing status';
    check.addEventListener('click',()=>refresh());
    $('timeline').after(check);
  }
  $('approve')?.addEventListener('change',event=>{approved=event.target.checked;render();$('approve')?.focus();});
  $('send')?.addEventListener('click',()=>run());
  for(const button of $('timeline').querySelectorAll('[data-retry]')) button.addEventListener('click',()=>run(button.dataset.retry));
}

async function analyze() {
  if(busy) return;
  resetPlan();
  busy=true;
  notice('Analyzing the agreement…');
  render();
  try {
    plan=await api('analyze',{text:$('contract').value});
    plan.obligations=plan.obligations.map(row=>({...row,originalDue:row.amendment?
      row.evidence.match(/\bdue (\d{4}-\d{2}-\d{2})/i)?.[1]:undefined}));
    notice(plan.obligations.length+' obligation'+(plan.obligations.length===1?'':'s')+' ready for review.');
  } catch(error){notice(error.message,true);}
  finally{busy=false;render();}
}

function queueRefresh(count=4) {
  clearTimeout(poll);
  if(!pending()||count<1) return;
  poll=setTimeout(async()=>{if(!busy) await refresh();queueRefresh(count-1);},sandboxMode()?5000:1200);
}

async function run(retryKind) {
  if(!approved||busy||!plan) return;
  const date=runDate();
  const rows=releaseable(plan.obligations,results,date,retryKind);
  if(!rows.length) return;
  busy=true;
  notice('Submitting due obligations…');
  render();
  const errors=[];
  const sandbox=sandboxMode();
  for(const row of rows){
    const previous=results[row.kind];
    const attempt=retryKind?previous.attempt+1:1;
    try {
      const result=sandbox?await api('payout',{reference:plan.reference,kind:row.kind,cents:row.cents,
        attempt,previousId:previous?.id,confirmed:true,due:row.due,runDate:date}):{
        id:'DEMO-'+row.kind.toUpperCase()+'-'+String(attempt).padStart(2,'0'),status:'PENDING'
      };
      results[row.kind]={...result,attempt,runDate:date,observedAt:new Date().toISOString()};
    }catch(error){errors.push(kindName(row.kind)+'. '+error.message);}
    render();
  }
  busy=false;
  notice(errors.join(' ')||(sandbox?'PayPal accepted the request. Checking item status.':'Simulation accepted the request. Checking the clearing ledger.'),Boolean(errors.length));
  render();
  queueRefresh();
}

async function refresh() {
  if(busy||!pending()) return;
  busy=true;
  render();
  const errors=[];
  for(const [kind,result] of Object.entries(results)){
    if(terminal.has(result.status)) continue;
    try {
      const update=sandboxMode()?await api('status',{id:result.id}):
        {status:$('scenario').value==='failure'&&kind==='benefit'&&result.attempt===1?'FAILED':'SUCCESS'};
      results[kind]={...result,...update,observedAt:new Date().toISOString()};
    }catch(error){errors.push(error.message);}
  }
  busy=false;
  notice(errors.join(' ')||(pending()?'Payouts are still processing.':'Clearing statuses updated.'),Boolean(errors.length));
  render();
}

function resetPlan() {
  clearTimeout(poll);
  plan=null;
  approved=false;
  results={};
  inspected='';
}

function resetText(value) {
  $('contract').value=value;
  resetPlan();
  notice('');
  render();
}

$('sample').addEventListener('click',()=>{$('run-date').value='2026-11-10';resetText(agreement);});
$('contract').addEventListener('input',()=>resetText($('contract').value));
$('upload').addEventListener('change',async event=>{
  const file=event.target.files[0];
  event.target.value='';
  if(!file) return;
  if(!file.name.toLowerCase().endsWith('.txt')||file.size>48000){notice('Choose a plain-text file under 48 KB.',true);return;}
  try {
    const value=await file.text();
    if(value.length>12000){notice('Agreement text must be under 12,000 characters.',true);return;}
    if(!busy) resetText(value);
  }catch{notice('The text file could not be read.',true);}
});
$('analyze').addEventListener('click',analyze);
$('mode').addEventListener('change',()=>{approved=false;render();});
$('run-date').addEventListener('change',()=>{if(!runDate()) $('run-date').value=today();render();});
$('next-due').addEventListener('click',()=>{const next=nextDate(plan?.obligations??[]);if(next){$('run-date').value=next;render();}});
$('fit').addEventListener('click',()=>schedule?.fit());
for(const link of document.querySelectorAll('nav a')) link.addEventListener('click',()=>{
  document.querySelector('nav .active')?.classList.remove('active');
  link.classList.add('active');
});
$('run-date').value='2026-11-10';
resetText(agreement);
api('config').then(value=>{
  config=value;
  $('mode').options[1].disabled=!value.sandbox;
  render();
}).catch(()=>notice('Unable to check the sandbox connection.',true));
import('./schedule.js').then(({createSchedule})=>{
  schedule=createSchedule($('scheduler'),kind=>{inspected=kind;render();});
  render();
}).catch(()=>{
  $('scheduler').innerHTML='<div class="empty">Bryntum Scheduler could not load. Run npm ci to install the required trial package.</div>';
});
