import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

function backup(code){
  const setup = `
    import assert from 'node:assert/strict';
    const entries=new Map();
    globalThis.localStorage={getItem:k=>entries.get(k)??null,setItem:(k,v)=>entries.set(k,String(v))};
    const element=()=>({classList:{add(){},remove(){}},appendChild(){},remove(){},setAttribute(){}});
    const elements=new Map();
    globalThis.document={createElement:element,getElementById:id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id)}};
    globalThis.requestAnimationFrame=fn=>fn();
    const timeout=globalThis.setTimeout; globalThis.setTimeout=(fn,ms)=>{const t=timeout(fn,ms);t.unref();return t;};
    let payload=null;
    globalThis.window={claude:{use:async()=>({save:async data=>{payload=data;}})}};
    globalThis.dialogAnswer='';
    const {registerHooks}=await import('node:module');
    registerHooks({load(url,context,next){
      if(url.endsWith('/lib/dialogs.js'))return {format:'module',shortCircuit:true,source:'export async function textDialog(){return globalThis.dialogAnswer;}'};
      return next(url,context);
    }});
    const m=await import('./src/state.js');
    const b=await import('./src/lib/backup.js');
  `;
  const r=spawnSync(process.execPath,["--input-type=module","-e",setup+code],{cwd:new URL("..",import.meta.url),encoding:"utf8"});
  assert.equal(r.status,0,r.stderr||r.stdout);
}

test("cancelling backup does not change its reminder or produce a file",()=>backup(`
  globalThis.dialogAnswer=null;
  await b.doExport(); assert.equal(payload,null); assert.ok(!m.state.lastBackupDate);
`));

test("a declined download does not clear the backup reminder",()=>backup(`
  window.claude.use=async()=>({save:async()=>{throw {code:'declined'}}});
  assert.equal(await b.doExport(),false); assert.ok(!m.state.lastBackupDate);
`));

test("a successful plain backup records completion in the file and saved household",()=>backup(`
  assert.equal(await b.doExport(),true);
  const exported=JSON.parse(payload.data);
  assert.ok(exported.lastBackupDate); assert.equal(exported.lastBackupDate,m.state.lastBackupDate);
  assert.equal(JSON.parse(entries.get('wealthPlanner.v1')).lastBackupDate,exported.lastBackupDate);
`));

test("a successful encrypted backup round-trips and records completion",()=>backup(`
  globalThis.dialogAnswer='invented-regression-passphrase';
  assert.equal(await b.doExport(),true);
  const envelope=JSON.parse(payload.data); assert.equal(envelope.wealthPlannerEncrypted,true);
  const restored=JSON.parse(await b.decryptBackup(envelope,'invented-regression-passphrase'));
  assert.equal(restored.lastBackupDate,m.state.lastBackupDate);
`));

test("an encryption failure does not clear the reminder or attempt a download",()=>backup(`
  globalThis.dialogAnswer='invented-regression-passphrase';
  crypto.subtle.encrypt=async()=>{throw new Error('Synthetic encryption failure')};
  assert.equal(await b.doExport(),false); assert.equal(payload,null); assert.ok(!m.state.lastBackupDate);
`));

test("a recovery export keeps unsaved edits without marking the household as backed up",()=>backup(`
  const before=entries.get('wealthPlanner.v1');
  m.state.shared.push({id:'draft',what:'Example bill',amount:95});
  await b.downloadBackupCopy();
  assert.equal(JSON.parse(payload.data).shared[0].amount,95);
  assert.equal(entries.get('wealthPlanner.v1'),before); assert.ok(!m.state.lastBackupDate);
`));
