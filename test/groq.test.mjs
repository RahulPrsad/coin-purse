import test from 'node:test';
import assert from 'node:assert/strict';
import {research} from '../src/agent.mjs';
const env={LLM_API_KEY:'placeholder'};
const call=(args='{"endpoint":"rainfall"}',name='paid_fetch')=>({id:'call-1',type:'function',function:{name,arguments:args}});
const response=tool_calls=>Response.json({choices:[{message:{role:'assistant',content:null,tool_calls}}]});
test('Groq default chooses paid tool and receives results',async()=>{
 let turn=0;
 const buyer={paidFetch:async args=>{assert.deepEqual(args,{endpoint:'rainfall'});return {ok:true,data:'synthetic fixture'};}};
 const transport=async(url,init)=>{
  assert.equal(url,'https://api.groq.com/openai/v1/chat/completions');
  assert.equal(init.headers.Authorization,'Bearer placeholder');
  const body=JSON.parse(init.body);assert.equal(body.model,'qwen/qwen3.8-27b');
  assert.equal(body.tools[0].function.name,'paid_fetch');
  assert.deepEqual(Object.keys(body.tools[0].function.parameters.properties),['endpoint']);
  if(++turn===1)return response([call()]);
  assert.equal(body.messages.at(-1).role,'tool');assert.equal(body.messages.at(-1).tool_call_id,'call-1');
  return Response.json({choices:[{message:{role:'assistant',content:'Research based on synthetic fixtures'}}]});
 };
 const result=await research(buyer,'Research monsoon',env,transport);
 assert.equal(result.evidence.length,1);assert.equal(result.text,'Research based on synthetic fixtures');
});
test('malformed Groq arguments go through rejecting tool handler; unknown tools never execute',async()=>{
 let turn=0,calls=0;
 const buyer={paidFetch:async args=>{calls++;assert.equal(args,null);return {ok:false,reason:'TOOL_ARGUMENTS_NOT_ALLOWED'};}};
 const result=await research(buyer,'Question',env,async()=>++turn===1?response([call('{'),{...call('{}','raise_budget'),id:'call-2'}]):Response.json({choices:[{message:{role:'assistant',content:'Requests refused'}}]}));
 assert.equal(calls,1);assert.deepEqual(result.evidence.map(x=>x.reason),['TOOL_ARGUMENTS_NOT_ALLOWED','UNKNOWN_TOOL']);
});
test('Groq quota errors do not retry tools or leak provider response',async()=>{
 let called=false;
 await assert.rejects(()=>research({paidFetch:()=>{called=true;}},'Question',env,async()=>new Response('sensitive provider diagnostic',{status:429})),/free-plan rate limit/);
 assert.equal(called,false);
});
test('missing Groq key fails before any request',async()=>{
 await assert.rejects(()=>research({},'Question',{},()=>assert.fail('No request expected')),/Groq API key/);
});
test('Groq rejects insecure provider URL',async()=>{
 await assert.rejects(()=>research({},'Question',{...env,LLM_BASE_URL:'http://api.groq.com'},()=>assert.fail('No request expected')),/HTTPS/);
});
