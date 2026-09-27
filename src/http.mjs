export const encode = value=>Buffer.from(JSON.stringify(value)).toString('base64');
export function decode(value){if(typeof value!=='string'||value.length>24000) throw new Error('INVALID_PAYMENT_HEADER'); return JSON.parse(Buffer.from(value,'base64').toString('utf8'));}
export async function limitedText(response,max=65536){
 const reader=response.body?.getReader(); if(!reader)return ''; let size=0; const chunks=[];
 try {while(true){const {done,value}=await reader.read(); if(done)break; size+=value.length; if(size>max)throw new Error('RESPONSE_TOO_LARGE'); chunks.push(Buffer.from(value));}} finally {await reader.cancel().catch(()=>{});}
 return Buffer.concat(chunks).toString('utf8');
}
export async function jsonFetch(url,body){const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(45000),redirect:'error'}); if(!r.ok)throw new Error('FACILITATOR_HTTP_'+r.status);return JSON.parse(await limitedText(r));}
