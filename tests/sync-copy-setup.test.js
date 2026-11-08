import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
test('sync copy inspection is read-only; create/unlock and copy races use real encryption safely',()=>{
 const code=`
 import assert from 'node:assert/strict';
 import {registerHooks} from 'node:module';
 import './tests/_env.js';
 globalThis.syncStore=new Map();globalThis.remoteSync=null;
 globalThis.fakeFolder={name:'Example folder',queryPermission:async()=>'granted',getFileHandle:async(name,opts)=>{
   if(!globalThis.remoteSync&&!opts?.create)throw new Error('Not found');
   return {getFile:async()=>({text:async()=>globalThis.remoteSync}),createWritable:async()=>({write:async s=>{globalThis.remoteSync=s;},close:async()=>{}})};
 }};
 registerHooks({load(url,context,next){if(!url.endsWith('/lib/safekeeping.js'))return next(url,context);
 return {format:'module',shortCircuit:true,source:
 'export async function savedFolder(){return globalThis.fakeFolder;} export async function idb(mode,fn){const m=globalThis.syncStore;return fn({get:k=>({result:m.get(k)}),put:(v,k)=>{m.set(k,v);return {result:k};},delete:k=>{m.delete(k);return {};}})?.result;}'};
 }});
 const m=await import('./src/lib/foldersync.js');
 assert.deepEqual(await m.inspectSyncCopy(true,'folder'),{ok:true,existing:false});
 assert.equal(syncStore.size,0);assert.equal(m.syncOn(),false);
 const made=await m.unlockSync('invented-copy-secret',true,'folder',false);
 assert.equal(made.existing,false);assert.equal(made.ok,true);
 assert.equal((await m.syncNow({force:'push'})).status,'pushed');
 const envelope=remoteSync;assert.ok(envelope);await m.stopSync();
 assert.equal((await m.inspectSyncCopy(true,'folder')).existing,true);assert.equal(m.syncOn(),false);
 assert.equal((await m.unlockSync('wrong-example-secret',true,'folder',true)).ok,false);
 assert.equal(m.syncOn(),false);assert.equal(syncStore.has('syncKey'),false);
 assert.equal((await m.unlockSync('invented-copy-secret',true,'folder',true)).existing,true);
 await m.stopSync();
 // A copy appearing or disappearing after inspection cannot silently create a new key.
 assert.equal((await m.unlockSync('invented-copy-secret',true,'folder',false)).reason,'copy-changed');
 assert.equal(syncStore.has('syncKey'),false);
 globalThis.remoteSync=null;
 assert.equal((await m.unlockSync('invented-copy-secret',true,'folder',true)).reason,'copy-changed');
 assert.equal(syncStore.has('syncKey'),false);assert.equal(m.syncOn(),false);
 `;
 const r=spawnSync(process.execPath,['--input-type=module','-e',code],{cwd:new URL('..',import.meta.url),encoding:'utf8'});
 assert.equal(r.status,0,r.stderr||r.stdout);
});
