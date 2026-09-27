import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { units, validateQuote } from './policy.mjs';
export class Ledger {
  constructor(path,runId,policy,identity) {
    mkdirSync(dirname(path),{recursive:true});
    this.db=new DatabaseSync(path); this.runId=runId;
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS runs (id TEXT PRIMARY KEY, policy TEXT NOT NULL, identity TEXT NOT NULL); CREATE TABLE IF NOT EXISTS decisions (id TEXT PRIMARY KEY, run_id TEXT NOT NULL, time TEXT NOT NULL, endpoint TEXT NOT NULL, amount TEXT NOT NULL, status TEXT NOT NULL, reason TEXT NOT NULL, tx TEXT);');
    const encoded=JSON.stringify(policy);
    this.db.prepare('INSERT OR IGNORE INTO runs VALUES (?,?,?)').run(runId,encoded,identity);
    const old=this.db.prepare('SELECT * FROM runs WHERE id=?').get(runId);
    if(old.policy!==encoded || old.identity!==identity) {this.db.close(); throw new Error('RUN_CONFIG_CHANGED: use the original wallet and policy for this run');}
    this.policy=Object.freeze(JSON.parse(old.policy));
  }
  rows(){return this.db.prepare('SELECT * FROM decisions WHERE run_id=? ORDER BY rowid').all(this.runId);}
  committed(){return this.rows().filter(r=>r.status!=='refused' && r.status!=='free').reduce((n,r)=>n+units(r.amount),0n);}
  record(endpoint,amount,status,reason) {
    const id=randomUUID(); this.db.prepare('INSERT INTO decisions VALUES (?,?,?,?,?,?,?,NULL)').run(id,this.runId,new Date().toISOString(),endpoint,amount,status,reason); return id;
  }
  reserve(endpoint,q){
    this.db.exec('BEGIN IMMEDIATE'); let active=true;
    try {
      let reason, amount;
      try {amount=validateQuote(q,this.policy); if(this.committed()+amount>units(this.policy.budget)) throw new Error('RUN_BUDGET_EXCEEDED');} catch(e){reason=e.message;}
      if(reason){this.record(endpoint,'0','refused',reason + (typeof q?.amount==='string' ? '; quoted='+q.amount.slice(0,80):'')); this.db.exec('COMMIT'); active=false; throw Object.assign(new Error(reason),{recorded:true});}
      const id=this.record(endpoint,amount.toString(),'reserved','Budget reserved durably before signing');
      this.db.exec('COMMIT'); active=false; return id;
    } catch(e){if(active) this.db.exec('ROLLBACK'); throw e;}
  }
  finish(id,status,reason,tx=null){
    if(!['paid','uncertain','simulated'].includes(status)) throw new Error('Invalid status');
    this.db.prepare('UPDATE decisions SET status=?,reason=?,tx=? WHERE id=? AND run_id=?').run(status,reason,tx,id,this.runId);
  }
  close(){this.db.close();}
}
