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

// #269: two tabs. "Another tab" here is a write straight into storage, as a storage event would report it.
const otherTab = `
  function otherTabSaves(amount){
    const before = entries.get(key); const copy = JSON.parse(before);
    copy.shared = [{id:'other',what:'Example bill',amount}]; copy.savedAt = 'later';
    entries.set(key, JSON.stringify(copy)); return before;
  }
`;

test("an idle tab adopts another tab's save, and can save on top of it", () => device(otherTab + `
  let adopted=0; m.onAdopted(()=>adopted++);
  const old = otherTabSaves(320);
  assert.equal(m.takeOtherTabsSave(old),'adopted'); assert.equal(adopted,1);
  assert.equal(m.state.shared[0].amount,320);
  m.state.shared[0].amount=280; assert.equal(m.persist(),true);
  assert.equal(JSON.parse(entries.get(key)).shared[0].amount,280);
`));

test("a tab with work in progress keeps it; its save is still refused, not written over the other tab's", () => device(otherTab + `
  let busy=true; m.onPendingWork(()=>busy);
  m.state.shared.push({id:'mine',amount:95});
  const old = otherTabSaves(320); const theirs = entries.get(key);
  assert.equal(m.takeOtherTabsSave(old),'pending');
  assert.equal(m.state.shared[0].id,'mine','work in progress kept');
  assert.equal(m.persist(),false); assert.equal(entries.get(key),theirs,'the other tab\\'s save survives');
  busy=false; assert.equal(m.hasPendingWork(),true,'a refused save is itself pending work');
`));

test("a save that never saw this tab's own last save is flagged, never silently taken", () => device(otherTab + `
  let reasons=[]; m.onStorageConflict(r=>reasons.push(r));
  const base = entries.get(key);
  m.state.shared.push({id:'mine',amount:95}); assert.equal(m.persist(),true);
  // The other tab wrote from 'base' — it hadn't seen this tab's save yet.
  const copy = JSON.parse(base); copy.shared=[{id:'other',amount:320}]; entries.set(key, JSON.stringify(copy));
  assert.equal(m.takeOtherTabsSave(base),'overwritten'); assert.deepEqual(reasons,['overwritten']);
  assert.equal(m.state.shared[0].id,'mine','this tab\\'s change is kept');
  assert.equal(m.persist(),false,'and it stops saving until someone chooses');
  assert.equal(m.keepThisTabsCopy(),true); assert.equal(JSON.parse(entries.get(key)).shared[0].id,'mine');
`));

test("a background save never overwrites another tab's save, never raises the conflict, and catches up", () => device(otherTab + `
  let conflicts=0, adopted=0; m.onStorageConflict(()=>conflicts++); m.onAdopted(()=>adopted++);
  otherTabSaves(320); const theirs = entries.get(key);
  m.state.cashRate = {rate: 9};
  assert.equal(m.persist({background:true}),false);
  assert.equal(entries.get(key),theirs); assert.equal(conflicts,0); assert.equal(adopted,1);
  assert.equal(m.state.shared[0].amount,320);
  assert.equal(m.persist(),true,'and an edit afterwards saves');
`));

test("a background save that changes nothing isn't written", () => device(`
  let writes=0; const set=localStorage.setItem; localStorage.setItem=(k,v)=>{if(k===key) writes++; set(k,v);};
  assert.equal(m.persist({background:true}),true); assert.equal(writes,0);
  m.state.cashRate={rate:3}; assert.equal(m.persist({background:true}),true); assert.equal(writes,1);
`));

test("a same-tab background refresh waits for pending work without a storage conflict", () => device(`
  m.persist();
  const saved=entries.get(key);
  let busy=true; m.onPendingWork(()=>busy);
  assert.equal(m.freshForBackground(),false);
  assert.equal(entries.get(key),saved);
  busy=false;
  assert.equal(m.freshForBackground(),true);
`));

test("a background refresh starts from the saved copy, and waits while this tab is mid-edit", () => device(otherTab + `
  let busy=false; m.onPendingWork(()=>busy);
  otherTabSaves(320);
  assert.equal(m.freshForBackground(),true); assert.equal(m.state.shared[0].amount,320);
  busy=true; otherTabSaves(410);
  assert.equal(m.freshForBackground(),false); assert.equal(m.state.shared[0].amount,320);
`));

test("a tab mid-edit that hears two saves from another tab says it updated, not that it was written over", () => device(otherTab + `
  let reasons=[]; m.onStorageConflict(r=>reasons.push(r)); m.onPendingWork(()=>true);
  m.state.shared.push({id:'mine',amount:95}); m.onPendingWork(()=>false);
  const first = entries.get(key);
  const old1 = otherTabSaves(320); assert.equal(m.takeOtherTabsSave(old1, entries.get(key)),'pending');
  const old2 = otherTabSaves(330); assert.equal(m.takeOtherTabsSave(old2, entries.get(key)),'pending');
  assert.deepEqual(reasons,[]); assert.equal(old1, first);
`));

test("this tab's save, missed by a tab that saved from an older copy, is flagged even after earlier saves were heard", () => device(otherTab + `
  let reasons=[]; m.onStorageConflict(r=>reasons.push(r));
  const old1 = otherTabSaves(320); assert.equal(m.takeOtherTabsSave(old1, entries.get(key)),'adopted');
  const heard = entries.get(key);
  m.state.shared[0].amount=95; assert.equal(m.persist(),true);
  const copy = JSON.parse(heard); copy.shared=[{id:'other',amount:410}]; entries.set(key, JSON.stringify(copy));
  assert.equal(m.takeOtherTabsSave(heard, entries.get(key)),'overwritten'); assert.deepEqual(reasons,['overwritten']);
`));

test("a background write another tab missed isn't a conflict: the idle tab just takes the newer save", () => device(otherTab + `
  let reasons=[]; m.onStorageConflict(r=>reasons.push(r));
  const base = entries.get(key);
  m.state.cashRate={rate:4}; assert.equal(m.persist({background:true}),true);
  const copy = JSON.parse(base); copy.shared=[{id:'other',amount:320}]; entries.set(key, JSON.stringify(copy));
  assert.equal(m.takeOtherTabsSave(base, entries.get(key)),'adopted'); assert.deepEqual(reasons,[]);
  assert.equal(m.state.shared[0].amount,320); assert.equal(m.persist(),true);
`));
