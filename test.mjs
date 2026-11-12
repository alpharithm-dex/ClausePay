import assert from 'node:assert/strict';
import {test} from 'node:test';
import {handleApi,validatePlan} from './worker.js';
import {agreement,sample} from './web/sample.js';
import {laneState,releaseable} from './web/workflow.js';

const request = (path,body) => new Request('http://localhost/api/'+path,{
  method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)
});
const env = {PAYPAL_CLIENT_ID:'id',PAYPAL_CLIENT_SECRET:'secret',
  PAYPAL_WORKER_EMAIL:'worker@example.com',PAYPAL_BENEFIT_EMAIL:'benefit@example.com'};

test('extracts separate fixed obligations and applies the amendment',async()=>{
  const response=await handleApi(request('analyze',{text:agreement}),{});
  const data=await response.json();
  assert.equal(response.status,200,JSON.stringify(data));
  assert.deepEqual(data.obligations,sample.obligations);
  assert.equal(data.source,'Built-in ML classifier');
  assert.ok(data.decisions.worker.signals.includes('design'));
  assert.ok(data.decisions.benefit.margin>0);
});

test('uses new input, and flags conditional payment',async()=>{
  const text=agreement.replace('CP-2026-014','CP-2026-099').replace('1,000.00','1,345.50')
    .replace('due 2026-11-12. This amount','due 2026-11-12 if approved. This amount');
  const response=await handleApi(request('analyze',{text}),{});
  const data=await response.json();
  assert.equal(response.status,200,JSON.stringify(data));
  assert.equal(data.reference,'CP-2026-099');
  assert.deepEqual(data.obligations.map(row=>row.cents),[134550]);
  assert.equal(data.concerns.length,1);
});

test('rejects extracted values without matching evidence',()=>{
  const invalid=structuredClone(sample);
  invalid.obligations[0].cents=200000;
  assert.throws(()=>validatePlan(invalid,agreement),/explicit USD/);
});

test('payout retry uses the same sandbox attempt after an ambiguous failure',async t=>{
  const calls=[];
  t.mock.method(globalThis,'fetch',async (url,options)=>{
    assert.match(url,/^https:\/\/api-m\.sandbox\.paypal\.com\//);
    if (url.endsWith('/token')) return Response.json({access_token:'sandbox-test'});
    const body=JSON.parse(options.body);
    calls.push(body);
    if(calls.length===1) throw new Error('Transport failure');
    return Response.json({batch_header:{payout_batch_id:'CP123'}},{status:201});
  });
  const body={reference:'CP-EXAMPLE',kind:'worker',cents:100000,attempt:1,confirmed:true,
    due:'2026-11-12',runDate:'2026-11-12'};
  assert.equal((await handleApi(request('payout',body),env)).status,502);
  const result=await handleApi(request('payout',body),env);
  assert.equal(result.status,200);
  assert.equal((await result.json()).status,'PENDING');
  assert.deepEqual(calls[0],calls[1]);
});

test('a successful prior payout cannot be retried as a new attempt',async t=>{
  let writes=0;
  t.mock.method(globalThis,'fetch',async (url,options)=>{
    if(url.endsWith('/token')) return Response.json({access_token:'test'});
    if(options.method==='POST') writes+=1;
    return Response.json({batch_header:{payout_batch_id:'PAID1'},items:[{transaction_status:'SUCCESS'}]});
  });
  const result=await handleApi(request('payout',{reference:'CP-TEST',kind:'benefit',cents:10000,
    attempt:2,previousId:'PAID1',confirmed:true,due:'2026-11-16',runDate:'2026-11-16'}),env);
  assert.equal(result.status,409);
  assert.equal(writes,0);
});

test('the amended benefit stays scheduled until its new date and worker pay is independent',()=>{
  const rows=sample.obligations;
  const results={worker:{id:'WORKER1',status:'SUCCESS'}};
  assert.deepEqual(releaseable(rows,{},'2026-11-12').map(row=>row.kind),['worker']);
  assert.equal(laneState(rows[1],null,true,'2026-11-12'),'Scheduled');
  assert.equal(laneState(rows[0],results.worker,true,'2026-11-16'),'Cleared');
  assert.deepEqual(releaseable(rows,results,'2026-11-16').map(row=>row.kind),['benefit']);
  assert.deepEqual(releaseable(rows,{...results,benefit:{id:'BENEFIT1',status:'FAILED'}},'2026-11-16','benefit').map(row=>row.kind),['benefit']);
});

test('the payout endpoint refuses future obligations before contacting PayPal',async t=>{
  const fetchSpy=t.mock.method(globalThis,'fetch',async()=>{throw new Error('PayPal should not be called');});
  const response=await handleApi(request('payout',{reference:'CP-DEMO',kind:'benefit',cents:10000,
    attempt:1,confirmed:true,due:'2026-11-16',runDate:'2026-11-12'}),env);
  assert.equal(response.status,409);
  assert.equal(fetchSpy.mock.callCount(),0);
});
