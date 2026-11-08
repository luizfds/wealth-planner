import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

// Each case loads the real state singleton in a fresh device, including its hydration path.
function device(code){
  const setup = `
    import assert from 'node:assert/strict';
    const entries = new Map();
    globalThis.localStorage = { getItem: k => entries.get(k) ?? null, setItem: (k,v) => entries.set(k,String(v)) };
    const elements = new Map();
    globalThis.document = {getElementById: id => {if(!elements.has(id)) elements.set(id,{}); return elements.get(id)}};
    const m = await import('./src/state.js');
    const key = 'wealthPlanner.v1';
  `;
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", setup + code], { cwd: new URL("..", import.meta.url), encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

test("saving is durable before persist returns, without waiting for a timer", () => device(`
  m.state.shared.push({id:'synthetic',what:'Example bill',amount:80,freq:'Monthly'});
  assert.equal(m.persist(),true);
  assert.equal(JSON.parse(entries.get(key)).shared[0].amount,80);
  assert.match(elements.get('statusText').textContent,/Saved/);
`));

test("an older tab cannot overwrite a newer copy, even before the storage event arrives", () => device(`
  const latest = JSON.parse(entries.get(key)); latest.shared = [{id:'new',what:'Example bill',amount:260}];
  entries.set(key,JSON.stringify(latest));
  const expected=entries.get(key); let conflicts=0, saved=0;
  m.onStorageConflict(()=>conflicts++); m.onSaved(()=>saved++);
  m.state.shared.push({id:'local',what:'Local draft',amount:95});
  assert.equal(m.persist(),false); assert.equal(entries.get(key),expected);
  assert.equal(m.state.shared[0].id,'local','unsaved copy remains recoverable');
  assert.equal(m.persist(),false); assert.equal(conflicts,1); assert.equal(saved,0);
`));

test("clearing storage in another tab blocks stale saves and keeps that tab's copy intact", () => device(`
  m.state.shared.push({id:'local',amount:85}); entries.delete(key);
  assert.equal(m.checkStorageRevision(),false); assert.equal(m.persist(),false);
  assert.equal(entries.has(key),false); assert.equal(m.state.shared[0].amount,85);
`));

test("quota failure reports unsaved and never notifies successful-save listeners", () => device(`
  let saved=0; m.onSaved(()=>saved++);
  localStorage.setItem=()=>{throw new Error('quota')};
  assert.equal(m.persist(),false); assert.equal(saved,0); assert.equal(m.storageAvailable,false);
  assert.match(elements.get('statusText').textContent,/Not saved/);
  assert.equal(m.persist(),false,'further edits must remain visibly unsaved');
`));
