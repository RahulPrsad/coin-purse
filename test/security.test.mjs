import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Ledger} from '../src/ledger.mjs';
import {Buyer,tool} from '../src/buyer.mjs';
import {units,NETWORK,ASSET,validateQuote} from '../src/policy.mjs';
import {quote,startSeller,endpoints} from '../src/sellers.mjs';
import {encode} from '../src/http.mjs';
import {research} from '../src/agent.mjs';
const policy=Object.freeze({network:NETWORK,asset:ASSET,payTo:'0x0000000000000000000000000000000000000001',perCall:'250000',budget:'5000000'});
function setup(t,patch={}){const dir=mkdtempSync(join(tmpdir(),'coin-purse-')); const path=join(dir,'ledger.sqlite'); const ledger=new Ledger(path,'test',{...policy,...patch},'test-identity'); t.after(()=>{try{ledger.close();}catch{}rmSync(dir,{recursive:true,force:true});}); return {ledger,path};}
function harness(ledger,q,options={}){
 let signatures=0,requests=0;
 const signer={sign:async()=>{signatures++;if(options.signError)throw new Error('SIGN_FAILED');return {};},confirm:async()=>{if(options.confirmError)throw new Error('INVALID_SETTLEMENT');return 'verified-by-test-double';}};
 const transport=async()=>{requests++;if(requests%2===1)return new Response('{}',{status:402,headers:{'payment-required':encode({x402Version:2,accepts:[q]})}});if(options.timeout)throw new Error('TIMEOUT');return new Response('{}',{status:options.secondStatus||200,headers:{'payment-response':encode({})}});};
 return {buyer:new Buyer({ledger,signer,endpoints:{rainfall:'http://127.0.0.1/rainfall'},transport}),signatures:()=>signatures,requests:()=>requests};
}
for(const [route,reason] of [['rogue-expensive','PER_CALL_LIMIT'],['rogue-asset','ASSET_NOT_ALLOWED'],['rogue-network','NETWORK_NOT_ALLOWED'],['rogue-injection','PER_CALL_LIMIT'],['rogue-malformed','INVALID_AMOUNT'],['rogue-recipient','RECIPIENT_NOT_ALLOWED']]){
 test(route+' refuses before signing',async t=>{const {ledger}=setup(t);const h=harness(ledger,quote(policy.payTo,route));assert.equal((await h.buyer.paidFetch({endpoint:'rainfall'})).reason,reason);assert.equal(h.signatures(),0);assert.equal(ledger.committed(),0n);assert.equal(ledger.rows()[0].status,'refused');});
}
test('honest quote is reserved before signer runs',async t=>{const {ledger}=setup(t);const h=harness(ledger,quote(policy.payTo,'rainfall'));const sign=h.buyer.signer.sign;h.buyer.signer.sign=async(...a)=>{assert.equal(ledger.committed(),50000n);assert.equal(ledger.rows()[0].status,'reserved');return sign(...a);};assert.equal((await h.buyer.paidFetch({endpoint:'rainfall'})).ok,true);assert.equal(h.signatures(),1);assert.equal(ledger.rows()[0].status,'paid');});
test('run budget checked before subsequent signature',async t=>{const {ledger}=setup(t,{budget:'75000'});const h=harness(ledger,quote(policy.payTo,'rainfall'));assert.equal((await h.buyer.paidFetch({endpoint:'rainfall'})).ok,true);assert.equal((await h.buyer.paidFetch({endpoint:'rainfall'})).reason,'RUN_BUDGET_EXCEEDED');assert.equal(h.signatures(),1);assert.equal(ledger.committed(),50000n);});
test('reservation survives restart and blocks overspend',t=>{const {ledger,path}=setup(t,{budget:'75000'});ledger.reserve('rainfall',quote(policy.payTo,'rainfall'));ledger.close();const restarted=new Ledger(path,'test',{...policy,budget:'75000'},'test-identity');try{assert.equal(restarted.committed(),50000n);assert.throws(()=>restarted.reserve('prices',quote(policy.payTo,'prices')),/RUN_BUDGET_EXCEEDED/);}finally{restarted.close();}});
test('same run cannot change policy or wallet',t=>{const {path}=setup(t);assert.throws(()=>new Ledger(path,'test',{...policy,budget:'9999999'},'test-identity'),/RUN_CONFIG_CHANGED/);assert.throws(()=>new Ledger(path,'test',policy,'different-wallet'),/RUN_CONFIG_CHANGED/);});
test('concurrent calls across database connections cannot exceed allowance',async t=>{const {ledger,path}=setup(t,{budget:'75000'});const other=new Ledger(path,'test',{...policy,budget:'75000'},'test-identity');try{const a=harness(ledger,quote(policy.payTo,'rainfall'));const b=harness(other,quote(policy.payTo,'rainfall'));const result=await Promise.all([a.buyer.paidFetch({endpoint:'rainfall'}),b.buyer.paidFetch({endpoint:'rainfall'})]);assert.equal(result.filter(r=>r.ok).length,1);assert.equal(a.signatures()+b.signatures(),1);assert.equal(ledger.committed(),50000n);}finally{other.close();}});
for(const options of [{timeout:true},{signError:true},{secondStatus:402},{confirmError:true}])test('uncertain payment retains budget '+JSON.stringify(options),async t=>{const {ledger}=setup(t);const h=harness(ledger,quote(policy.payTo,'rainfall'),options);assert.equal((await h.buyer.paidFetch({endpoint:'rainfall'})).ok,false);assert.equal(ledger.committed(),50000n);assert.equal(ledger.rows()[0].status,'uncertain');assert.equal(h.signatures(),1);assert.ok(h.requests()<=2);});
test('tool cannot change limits or supply arbitrary URL',async t=>{const {ledger}=setup(t);const h=harness(ledger,quote(policy.payTo,'rainfall'));for(const args of [{endpoint:'rainfall',budget:'99999999'},{endpoint:'http://evil.invalid'},null])assert.equal((await h.buyer.paidFetch(args)).reason,'TOOL_ARGUMENTS_NOT_ALLOWED');assert.equal(h.signatures(),0);assert.equal(h.requests(),0);assert.deepEqual(Object.keys(tool.input_schema.properties),['endpoint']);});
test('amount parser rejects decimals, signs, scientific notation and numbers',()=>{for(const amount of ['0.05','-1','1e6','01','+5',' 1',1,null,'9'.repeat(79)])assert.throws(()=>units(amount),/INVALID_AMOUNT/);assert.equal(units('9007199254740993'),9007199254740993n);});
test('exact integer ceiling boundary above JS safe integers',()=>{const q={...quote(policy.payTo,'rainfall'),amount:'9007199254740993'};const p={...policy,perCall:'9007199254740993'};assert.equal(validateQuote(q,p),9007199254740993n);assert.throws(()=>validateQuote({...q,amount:'9007199254740994'},p),/PER_CALL_LIMIT/);});
test('reject untrusted EIP712 domain, scheme and timeout',()=>{const q=quote(policy.payTo,'rainfall');for(const patch of [{scheme:'upto'},{maxTimeoutSeconds:9999},{extra:{name:'Evil',version:'2'}},{extra:{name:'USDC',version:'2',assetTransferMethod:'permit2'}}])assert.throws(()=>validateQuote({...q,...patch},policy));});
test('invalid challenge fails closed',async t=>{const {ledger}=setup(t);let signed=false;const buyer=new Buyer({ledger,signer:{sign:()=>{signed=true;}},endpoints:{rainfall:'http://127.0.0.1/'},transport:async()=>new Response('{}',{status:402,headers:{'payment-required':'not-json'}})});assert.equal((await buyer.paidFetch({endpoint:'rainfall'})).ok,false);assert.equal(signed,false);assert.equal(ledger.rows()[0].status,'refused');});
test('real HTTP integration: honest data and all hostile quotes',async t=>{const {ledger}=setup(t);const honest=await startSeller({kind:'honest',payTo:policy.payTo,simulation:true});const rogue=await startSeller({kind:'rogue',payTo:policy.payTo,simulation:true});try{let signatures=0;const buyer=new Buyer({ledger,simulation:true,endpoints:endpoints(honest.address().port,rogue.address().port),signer:{sign:async(q)=>{signatures++;return {x402Version:2,accepted:q,payload:{simulation:true}};}}});for(const endpoint of Object.keys(buyer.endpoints)){const result=await buyer.paidFetch({endpoint});assert.equal(result.ok,!endpoint.startsWith('rogue-'));}assert.equal(signatures,3);assert.equal(ledger.committed(),150000n);assert.equal(ledger.rows().filter(r=>r.status==='refused').length,6);}finally{await Promise.all([honest,rogue].map(s=>new Promise(resolve=>{s.close(resolve);s.closeAllConnections();})));}});
test('LLM chooses tool and receives result in next turn',async()=>{let turn=0,called=false;const buyer={paidFetch:async args=>{assert.deepEqual(args,{endpoint:'rainfall'});called=true;return {ok:true,data:'fixture'};}};const transport=async(url,init)=>{const req=JSON.parse(init.body);assert.equal(req.tools[0].name,'paid_fetch');turn++;if(turn===1)return Response.json({content:[{type:'tool_use',id:'call-1',name:'paid_fetch',input:{endpoint:'rainfall'}}]});assert.equal(req.messages.at(-1).content[0].tool_use_id,'call-1');return Response.json({content:[{type:'text',text:'Evidence-based synthesis'}]});};const r=await research(buyer,'Question',{LLM_PROVIDER:'anthropic',LLM_API_KEY:'placeholder'},transport);assert.equal(called,true);assert.equal(r.text,'Evidence-based synthesis');assert.equal(r.evidence.length,1);});

test('exact per-call and total boundary succeeds; next unit is refused before signing',async t=>{
 const {ledger}=setup(t,{perCall:'250000',budget:'250000'});
 const h=harness(ledger,{...quote(policy.payTo,'rainfall'),amount:'250000'});
 assert.equal((await h.buyer.paidFetch({endpoint:'rainfall'})).ok,true);
 const next=harness(ledger,{...quote(policy.payTo,'rainfall'),amount:'1'});
 assert.equal((await next.buyer.paidFetch({endpoint:'rainfall'})).reason,'RUN_BUDGET_EXCEEDED');
 assert.equal(next.signatures(),0);assert.equal(ledger.committed(),250000n);
});
test('large cumulative totals remain exact after reopening SQLite',t=>{
 const limits={perCall:'9007199254740993',budget:'9007199254740994'};
 const {ledger,path}=setup(t,limits);
 ledger.reserve('rainfall',{...quote(policy.payTo,'rainfall'),amount:limits.perCall});
 ledger.close();const resumed=new Ledger(path,'test',{...policy,...limits},'test-identity');
 try{assert.equal(resumed.committed(),9007199254740993n);resumed.reserve('prices',{...quote(policy.payTo,'prices'),amount:'1'});assert.equal(resumed.committed(),9007199254740994n);assert.throws(()=>resumed.reserve('satellite',{...quote(policy.payTo,'satellite'),amount:'1'}),/RUN_BUDGET_EXCEEDED/);}finally{resumed.close();}
});
