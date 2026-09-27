import {execFileSync} from 'node:child_process';
import {existsSync,readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const git=process.platform==='win32' && existsSync('C:/Program Files/Git/cmd/git.exe')?'C:/Program Files/Git/cmd/git.exe':'git';
const run=(args)=>execFileSync(git,['-c','safe.directory='+root.replaceAll('\\','/'),'-C',root,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
const files=[...new Set(run(['ls-files','--cached','--others','--exclude-standard','-z']).split('\0').filter(Boolean))];
// Compare current local secrets without printing their values or reading .env into logs.
const local=existsSync(root+'/.env')?readFileSync(root+'/.env','utf8'):'';
const secrets=[...local.matchAll(/^(?:BUYER_PRIVATE_KEY|LLM_API_KEY)\s*=\s*(.+)$/gm)].flatMap(m=>{const v=m[1].trim().replace(/^['"]|['"]$/g,'');return v.length>=16?[v,...(v.startsWith('0x')?[v.slice(2)]:[])]:[];});
const failures=[];
for(const file of files){
 const text=readFileSync(resolve(root,file),'utf8');
 if(file==='.env'||/\.env\.(?!example$)/.test(file))failures.push(file+': environment file included');
 if(secrets.some(s=>text.includes(s)))failures.push(file+': matches a local secret');
 if(/(?:sk-ant-|gsk_)[A-Za-z0-9_-]{20,}|-----BEGIN (?:RSA |EC )?PRIVATE KEY-----|https?:\/\/[^\s/]+:[^\s/@]+@/i.test(text))failures.push(file+': credential pattern');
 if(/(?:private[_ -]?key|mnemonic|seed[_ -]?phrase)\s*[:=]\s*['"](?:0x)?[a-f0-9]{64}['"]/i.test(text))failures.push(file+': hardcoded wallet secret');
 if(file==='.env.example'&&/^(?:BUYER_PRIVATE_KEY|LLM_API_KEY)=\S+/m.test(text))failures.push(file+': example secret must be blank');
}
if(failures.length){console.error(failures.join('\n'));process.exitCode=1;}else console.log('PASS: '+files.length+' tracked/submission-candidate files scanned; no detected credentials. Secret values were not printed.');
