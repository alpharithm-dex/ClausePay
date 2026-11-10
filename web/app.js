import {agreement} from './sample.js';

const $ = id => document.getElementById(id);
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dollars = cents => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(cents/100);
const kindName = kind => kind === 'worker' ? 'Contractor compensation' : 'Employer-funded benefit';
const formatDate = date => new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(date+'T00:00:00Z'));
const settled = new Set(['SUCCESS','FAILED','RETURNED','REFUNDED','REVERSED','DENIED']);
const canRetry = status => ['FAILED','RETURNED'].includes(status);
let config = {ai:false,sandbox:false};
let plan = null;
let results = {};
let approved = false;
let busy = false;

function notice(text, error = false) {
  $('notice').textContent = text;
  $('notice').classList.toggle('error',error);
}

async function api(path, data) {
  const response = await fetch('/api/'+path, data === undefined ? {} : {
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Service unavailable.');
  return result;
}

function render() {
  const rows = plan?.obligations ?? [];
  const mode = $('mode').value;
  const started = Object.keys(results).length > 0;
  const approvedReady = rows.length > 0 && approved && !busy;
  $('analyze').disabled = busy || !$('contract').value.trim();
  $('sample').disabled = busy;
  $('contract').disabled = busy;
  $('upload').disabled = busy;
  $('mode').disabled = busy || started;
  $('scenario').disabled = busy || started;
  $('scenario').hidden = mode !== 'demo';
  $('scenario-wrap').hidden = mode !== 'demo';
  $('environment').textContent = mode === 'sandbox' ? '◆ PayPal Sandbox' : '◆ Simulation mode';
  $('analysis-mode').textContent = config.ai
    ? 'Analysis sends the pasted text to the configured AI model. Use a synthetic agreement.'
    : 'Built-in classification runs on text with explicit USD amounts and due dates.';
  $('metrics').innerHTML = [
    ['Approved plan total', approved ? dollars(rows.reduce((sum,row)=>sum+row.cents,0)) : '—'],
    ['Obligations identified', rows.length],
    ['Payouts confirmed', rows.filter(row=>results[row.kind]?.status === 'SUCCESS').length+' / '+rows.length]
  ].map(([label,value])=>'<div class="metric"><small>'+label+'</small><strong>'+value+'</strong></div>').join('');
  $('source').innerHTML = plan ? '<span class="badge">'+escape(plan.source)+'</span>' : '';
  $('obligations').innerHTML = !plan ? '<div class="empty"><strong>Payment terms appear here</strong><p>Analyze the agreement to see each obligation and its supporting clause.</p></div>' :
    '<div class="review-title">'+escape(plan.reference)+' · '+escape(plan.name)+'</div>'+
    rows.map(row => '<article class="review-row"><div class="term-top"><div><strong>'+kindName(row.kind)+'</strong><small>'+
      escape(row.payee)+' · Due '+formatDate(row.due)+'</small></div><span class="amount">'+dollars(row.cents)+'</span></div>'+
      '<blockquote>'+escape(row.evidence)+'</blockquote>'+
      (row.amendment ? '<p class="amendment"><strong>Amendment applied</strong> '+escape(row.amendment)+'</p>' : '')+'</article>').join('')+
    (plan.concerns.length ? '<div class="concerns"><strong>Needs separate review</strong><ul>'+
      plan.concerns.map(note=>'<li>'+escape(note)+'</li>').join('')+'</ul></div>' : '')+
    (!rows.length ? '<p>No supported payment terms were identified.</p>' : '');
  $('timeline').innerHTML = !rows.length ? '<div class="empty">Approved obligations appear on the timeline.</div>' :
    [...rows].sort((a,b)=>a.due.localeCompare(b.due)).map(row=>{
      const result = results[row.kind];
      const status = result?.status;
      const tone = status === 'SUCCESS' ? 'paid' : settled.has(status) ? 'failed' : 'pending';
      const label = status === 'SUCCESS' ? 'Paid' : status ? status[0]+status.slice(1).toLowerCase() : approved ? 'Approved' : 'Awaiting review';
      const recipient = mode === 'sandbox' ? ' · '+escape(config.recipients?.[row.kind]) : '';
      return '<article class="payout-row '+tone+'"><div class="payout-top"><div><strong>'+escape(row.payee)+
        ' · '+dollars(row.cents)+'</strong><small>'+formatDate(row.due)+recipient+'</small></div><span class="badge '+tone+'">'+escape(label)+
        '</span></div>'+(result?.id ? '<p class="payment-meta">'+(mode === 'sandbox' ? 'PayPal batch ' : 'Simulation ')+escape(result.id)+
        (result.itemId ? ' · Item '+escape(result.itemId) : '')+'</p>' : '')+
        (canRetry(status) && result.attempt < 5 ? '<button class="secondary" data-retry="'+row.kind+'" '+(busy?'disabled':'')+'>Retry '+(row.kind==='worker'?'worker payout':'benefit only')+'</button>' : '')+'</article>';
    }).join('');
  const pending = rows.some(row=>results[row.kind]?.id && !settled.has(results[row.kind]?.status));
  const unsent = rows.some(row=>!results[row.kind]?.id);
  $('actions').innerHTML = !rows.length ? '' : '<div class="action-line"><label class="ack"><input type="checkbox" id="approve" '+
    (approved?'checked ':'')+(busy||started?'disabled':'')+'> I checked the clauses, amounts and recipients.</label>'+
    '<div><button class="primary" id="send" '+(approvedReady&&unsent?'':'disabled')+'>'+
    (mode==='sandbox'?'Send PayPal sandbox payouts':'Run payout simulation')+'</button> '+
    (mode==='sandbox'&&pending?'<button class="secondary" id="refresh" '+(busy?'disabled':'')+'>Refresh status</button>':'')+'</div></div>'+
    '<p class="hint">'+(mode==='sandbox'?'This sends test payouts now. Dates show agreement obligations.':'Simulated statuses and references are generated inside ClausePay.')+'</p>';
  $('approve')?.addEventListener('change',event=>{approved=event.target.checked;render();$('approve')?.focus();});
  $('send')?.addEventListener('click',()=>run());
  $('refresh')?.addEventListener('click',refresh);
  for (const button of $('timeline').querySelectorAll('[data-retry]')) button.addEventListener('click',()=>run(button.dataset.retry));
}

async function analyze() {
  if (busy) return;
  busy=true;
  plan=null;
  results={};
  approved=false;
  notice('Analyzing the agreement…');
  render();
  try {
    plan=await api('analyze',{text:$('contract').value});
    notice(plan.obligations.length+' payment term'+(plan.obligations.length===1?'':'s')+' ready for review.');
  } catch (error) {notice(error.message,true);}
  finally {busy=false;render();}
}

async function run(retryKind) {
  if (!approved || busy || !plan) return;
  busy=true;
  notice('Processing payouts…');
  render();
  const sandbox=$('mode').value==='sandbox';
  const rows = plan.obligations.filter(row=>retryKind ? row.kind===retryKind && canRetry(results[row.kind]?.status) : !results[row.kind]?.id);
  const errors=[];
  for (const row of rows) {
    const previous = results[row.kind];
    const attempt = retryKind ? (previous.attempt||1)+1 : 1;
    try {
      const result = sandbox ? await api('payout',{reference:plan.reference,kind:row.kind,cents:row.cents,
        attempt,previousId:previous?.id,confirmed:true}) : {
        id:'DEMO-'+row.kind.toUpperCase()+'-'+String(attempt).padStart(2,'0'),
        status:$('scenario').value==='failure' && row.kind==='benefit' && attempt===1 ? 'FAILED' : 'SUCCESS'
      };
      results[row.kind]={...result,attempt};
    } catch (error) {errors.push(kindName(row.kind)+'. '+error.message);}
    render();
  }
  busy=false;
  notice(errors.length ? errors.join(' ') : sandbox ? 'PayPal accepted the request. Refresh for the item status.' :
    retryKind ? 'Simulated retry complete. The other obligation was untouched.' : 'Simulation complete. Review the individual payout outcomes.',Boolean(errors.length));
  render();
}

async function refresh() {
  if (busy) return;
  busy=true;
  render();
  const errors=[];
  for (const [kind,result] of Object.entries(results)) {
    if (settled.has(result.status)) continue;
    try {results[kind]={...result,...await api('status',{id:result.id})};}
    catch (error) {errors.push(error.message);}
  }
  busy=false;
  notice(errors.join(' ') || 'PayPal item statuses updated.',Boolean(errors.length));
  render();
}

function resetText(value) {
  $('contract').value=value;
  plan=null;
  approved=false;
  results={};
  notice('');
  render();
}

$('sample').addEventListener('click',()=>resetText(agreement));
$('contract').addEventListener('input',()=>resetText($('contract').value));
$('upload').addEventListener('change',async event=>{
  const file=event.target.files[0];
  event.target.value='';
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.txt') || file.size>48000) {
    notice('Choose a plain-text file under 48 KB.',true); return;
  }
  try {
    const value=await file.text();
    if(value.length>12000) {notice('Agreement text must be under 12,000 characters.',true);return;}
    if (!busy) resetText(value);
  } catch {notice('The text file could not be read.',true);}
});
$('analyze').addEventListener('click',analyze);
$('mode').addEventListener('change',()=>{approved=false;render();});
for (const link of document.querySelectorAll('nav a')) link.addEventListener('click',()=>{
  document.querySelector('nav .active')?.classList.remove('active');
  link.classList.add('active');
});
resetText(agreement);
api('config').then(value=>{
  config=value;
  $('mode').options[1].disabled=!value.sandbox;
  render();
}).catch(()=>notice('Unable to check the sandbox connection.',true));
