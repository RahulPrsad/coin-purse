import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {policyFromEnv,NETWORK,ASSET} from './policy.mjs';
import {Ledger} from './ledger.mjs';
import {Buyer} from './buyer.mjs';
import {startSeller,endpoints} from './sellers.mjs';
import {liveSigner} from './signer.mjs';
import {research} from './agent.mjs';
import {report} from './report.mjs';
const root=dirname(dirname(fileURLToPath(import.meta.url)));
const command=process.argv[2]||'help';
async function main(){
 if(!['demo','agent','testnet','sellers','audit'].includes(command)){console.log('Coin Purse: npm run demo | sellers | agent | testnet | audit');return;}
 const demo=command==='demo';
 const policy=demo?Object.freeze({network:NETWORK,asset:ASSET,payTo:'0x0000000000000000000000000000000000000001',perCall:'250000',budget:'5000000'}):policyFromEnv();
 const runId=demo?'demo-'+randomUUID():process.env.RUN_ID;
 if(!runId||!/^[-a-zA-Z0-9_]{1,100}$/.test(runId))throw new Error('Set RUN_ID to 1-100 letters, digits, hyphens or underscores');
 const hp=Number(process.env.HONEST_PORT||4021),rp=Number(process.env.ROGUE_PORT||4022);
 if(![hp,rp].every(p=>Number.isInteger(p)&&p>0&&p<=65535)||hp===rp)throw new Error('Invalid seller ports');
 const facilitator=process.env.FACILITATOR_URL||'https://x402.org/facilitator';
 const servers=[]; let ledger;
 try{
  if(demo||command==='testnet'||command==='sellers'){
   servers.push(await startSeller({port:demo?0:hp,kind:'honest',payTo:policy.payTo,facilitator,simulation:demo}));
   servers.push(await startSeller({port:demo?0:rp,kind:'rogue',payTo:policy.payTo,facilitator,simulation:demo}));
  }
  if(command==='sellers'){
   console.log('Honest stall: http://127.0.0.1:'+hp+' | Rogue stall: http://127.0.0.1:'+rp);
   await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});return;
  }
  const db=join(root,'data',demo?'demo.sqlite':'testnet.sqlite');
  const directory=join(root,demo?'examples/offline-demo':'reports/'+runId);
  if(command==='audit'){
   const {DatabaseSync}=await import('node:sqlite'); const view=new DatabaseSync(db,{readOnly:true});
   const run=view.prepare('SELECT identity FROM runs WHERE id=?').get(runId);view.close();
   if(!run)throw new Error('Run does not exist'); ledger=new Ledger(db,runId,policy,run.identity);
   let prior;try{prior=JSON.parse(await readFile(directory+'/decisions.json','utf8')).research;}catch{}
   await report(ledger,directory,prior);console.log(directory+'/audit.html');return;
  }
  if(!demo&&!process.env.LLM_API_KEY)throw new Error('Set LLM_API_KEY in .env');
  const signer=demo?{address:'simulation-only',sign:async(q,url)=>({x402Version:2,resource:{url},accepted:q,payload:{simulation:true}})}:await liveSigner(process.env.BUYER_PRIVATE_KEY,process.env.RPC_URL||'https://sepolia.base.org');
  ledger=new Ledger(db,runId,policy,signer.address.toLowerCase());
  const addresses=endpoints(servers[0]?.address().port||hp,servers[1]?.address().port||rp);
  const buyer=new Buyer({ledger,signer,endpoints:addresses,simulation:demo});
  let result={text:'Research did not complete. See the decision ledger.',evidence:[]};
  try{
   if(demo){
    for(const endpoint of Object.keys(addresses))result.evidence.push(await buyer.paidFetch({endpoint}));
    result.text='OFFLINE DEMONSTRATION — deterministic synthesis, no LLM call.\n\nThe synthetic rainfall fixture projects an 18% positive anomaly. The price fixture shows rice at INR 3,020 versus 3,100 per quintal and maize at INR 2,180 versus 2,250. The satellite fixture reports above-baseline soil moisture. These examples suggest a hypothesis that improved expected supply might coincide with softer prices, while transport disruption could work in the opposite direction. Two illustrative observations cannot establish causality.\n\nNext research step: join dated forecast revisions to daily mandi prices, control for arrivals and seasonality, and compare exposed districts. No conclusion about actual monsoon conditions follows from these synthetic fixtures.\n\nSources: rainfall, prices, satellite. See the ledger for simulated purchases and hostile quote refusals; confirmed real spend is zero.';
   }else{
    if(command==='testnet')for(const endpoint of Object.keys(addresses).filter(k=>k.startsWith('rogue-')))await buyer.paidFetch({endpoint});
    result=await research(buyer,process.argv.slice(3).join(' ')||'Research how a wetter monsoon forecast could affect Karnataka rice and maize mandi prices. Purchase rainfall, prices and satellite evidence, then write a careful research note.');
   }
  }finally{await report(ledger,directory,result,demo?'simulation':'testnet');console.log('Audit: '+directory+'/audit.html');}
  if(command==='testnet'&&(!ledger.rows().some(r=>r.status==='paid')||!ledger.rows().some(r=>r.status==='refused')))throw new Error('Testnet evidence incomplete: need confirmed purchase and refusal. Inspect audit.');
  if(command==='testnet'){await report(ledger,join(root,'examples/testnet'),result,'testnet');console.log('Verified testnet evidence exported to examples/testnet');}
 }finally{ledger?.close();await Promise.all(servers.map(s=>new Promise(resolve=>{s.close(resolve);s.closeAllConnections();})));}
}
main().catch(e=>{console.error(e.message.startsWith('Set ')||e.message.startsWith('RUN_CONFIG_CHANGED')?e.message:'Run failed: '+e.message.replace(/0x[0-9a-fA-F]{64}/g,'[redacted]'));process.exitCode=1;});
