import assert from 'node:assert/strict';
import {test} from 'node:test';
import {handleApi,validatePlan} from './worker.js';
import {agreement,sample} from './web/sample.js';

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
  const body={reference:'CP-EXAMPLE',kind:'worker',cents:100000,attempt:1,confirmed:true};
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
    attempt:2,previousId:'PAID1',confirmed:true}),env);
  assert.equal(result.status,409);
  assert.equal(writes,0);
});
