import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
// Exercise the actual wiring module with IO/render boundaries replaced, without a cloud account.
function run(code){
 const setup=`
 import assert from 'node:assert/strict';
 import {registerHooks} from 'node:module';
 const noop=()=>{};const calls=[];let applied=null,release;
 const gate=new Promise(r=>release=r);
 const stubs=new Proxy({state:{},syncNow:async opts=>{calls.push(opts);return {status:'pull',text:'{"income":[],"home":{},"example":true}',rev:7};},
 whenDialogsClosed:()=>gate,setState:v=>applied=v,migrateState:v=>v,takeReceiptFiles:()=>[],unpackReceipts:async()=>{},
 pulled:noop,recalcComputedItems:noop,renderAll:noop,persist:noop,showToast:noop,renderSafekeeping:noop},
 {get:(o,k)=>k in o?o[k]:()=>{throw new Error('Unexpected boundary '+String(k));}});
 globalThis.reviewStubs=stubs;
 registerHooks({load(url,context,next){const r=next(url,context);if(!url.endsWith('/components/safekeepingwiring.js'))return r;
 const source=String(r.source).replace(/import\\s*\\{([^}]+)\\}\\s*from\\s*"[^"]+";/g,(_,names)=>names.split(',').map(part=>{const [key,alias]=part.trim().split(/\\s+as\\s+/);const name=alias||key;return key==='state'?'const state=globalThis.reviewStubs.state;':'function '+name+'(...args){return globalThis.reviewStubs.'+key+'(...args);}';}).join('\\n'));

 return {...r,source,shortCircuit:true};}});
 const m=await import('./src/components/safekeepingwiring.js');
 `;
 const r=spawnSync(process.execPath,['--input-type=module','-e',setup+code],{cwd:new URL('..',import.meta.url),encoding:'utf8'});
 assert.equal(r.status,0,r.stderr||r.stdout);
}
test('sync retains permission/manual/force options and its response while a question is open',()=>run(`
 const options={interactive:true,manual:true,force:'pull'};
 const pending=m.runSync(options);await new Promise(r=>setImmediate(r));
 assert.deepEqual(calls,[options]);assert.equal(applied,null);
 release();await pending;assert.equal(applied.example,true);assert.equal(calls.length,1);
`));
test('a last-chance network push does not wait for a question or deferred redraw',()=>run(`
 stubs.syncNow=async opts=>{calls.push(opts);return {status:'pushed'};};
 const first=m.runSync({manual:true});const chosen=m.runSync({interactive:true,manual:true,force:'pull'});const hidden=m.runSync({});
 await new Promise(r=>setImmediate(r));assert.equal(calls.length,3);
 release();await Promise.all([first,chosen,hidden]);assert.deepEqual(calls,[{manual:true},{interactive:true,manual:true,force:'pull'},{}]);
`));
for(const existing of [true,false])test('sync setup '+(existing?'unlocks once':'confirms a new secret')+' without mutating on Cancel',()=>run(`
 const elements=new Map();globalThis.document={documentElement:{classList:{contains:()=>false}},addEventListener:noop,getElementById:id=>{if(!elements.has(id))elements.set(id,{addEventListener:(k,fn)=>elements.get(id)[k]=fn});return elements.get(id);}};
 stubs.syncOn=()=>false;stubs.onSaved=noop;stubs.finishDropboxRedirect=async()=>null;
 stubs.checkInbox=async()=>{};stubs.newestFolderBackup=async()=>({none:true});stubs.maybeAutoBackup=async()=>({ok:false});
 stubs.inspectSyncCopy=async()=>({ok:true,existing:${existing}});
 let asked=null,unlocks=0;stubs.textDialog=async(msg,v,o)=>{asked=o;return null;};stubs.unlockSync=async()=>{unlocks++;};
 m.wireSafekeeping();await elements.get('safekeepingBody').click({target:{closest:()=>({getAttribute:()=> 'dbx-pass'})}});
 await new Promise(r=>setImmediate(r));assert.equal(asked.repeat,${!existing});assert.equal(asked.accept,${JSON.stringify(existing?'Unlock sync':'Create synced copy')});assert.equal(unlocks,0);
`));
