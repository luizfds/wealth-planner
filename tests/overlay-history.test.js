import test from 'node:test';
import assert from 'node:assert/strict';
let serial=0;
async function fresh(pushFails=false){
  globalThis.location={href:'https://example.test/plan'};
  globalThis.history={state:{page:'plan'},backs:0,pushState(s){if(pushFails)throw new Error('Denied');this.state=s;},replaceState(s){this.state=s;},back(){this.backs++;}};
  return import('../src/lib/overlaystack.js?test='+serial++);
}
test('failed history insertion closes directly without leaving the page',async()=>{
  const m=await fresh(true);let closed=0;m.pushActiveOverlay(()=>closed++);
  assert.equal(await m.requestCloseActiveOverlay(),true);assert.equal(closed,1);assert.equal(history.backs,0);
});
test('a replacement cancels old close waiters and survives their delayed Back',async()=>{
  const m=await fresh();let old=0,newer=0;
  m.pushActiveOverlay(()=>old++);const waiting=m.requestCloseActiveOverlay();
  m.pushActiveOverlay(()=>newer++);assert.equal(await waiting,false);
  assert.equal(m.handleOverlayHistory({state:{page:'plan'}}),true);
  assert.equal(old,0);assert.equal(newer,0);assert.equal(m.overlayOpen(),true);
  m.closeActiveOverlayNow();assert.equal(newer,1);
});
test('a missing popstate cannot leave a close waiter pending indefinitely',async()=>{
  const m=await fresh();let closed=0;m.pushActiveOverlay(()=>closed++);
  assert.equal(await m.requestCloseActiveOverlay(),false);assert.equal(closed,1);assert.equal(m.overlayOpen(),false);
});
test('Forward onto a dismissed question and its return preserve the underlying editor',async()=>{
  const m=await fresh();let stopped=0,closed=0;
  m.pushActiveOverlay(()=>closed++);const closeQuestion=m.pushModalOverlay(()=>{});
  closeQuestion();m.handleModalHistory({state:{overlayOpen:true},stopImmediatePropagation(){stopped++;}});
  m.handleModalHistory({state:{appDialog:true},stopImmediatePropagation(){stopped++;}});
  m.handleModalHistory({state:{overlayOpen:true},stopImmediatePropagation(){stopped++;}});
  assert.equal(stopped,3);assert.equal(closed,0);assert.equal(m.overlayOpen(),true);
  m.closeActiveOverlayNow();
});
