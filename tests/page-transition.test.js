import test from 'node:test';
import assert from 'node:assert/strict';
import { pageTransitionDone } from '../src/lib/pagetransition.js';

for(const name of ['AbortError', 'TimeoutError']){
  test(name + ' does not fail a successful page update', async()=>{
    let complete;
    const updateCallbackDone = new Promise(resolve=>{ complete=resolve; });
    const error = new DOMException('Animation skipped', name), reports=[];
    const done=pageTransitionDone({ready:Promise.reject(error),finished:Promise.reject(error),updateCallbackDone},e=>reports.push(e));
    complete(); await done; await Promise.resolve();
    assert.deepEqual(reports,[]);
  });
  test(name + ' from the page update still rejects navigation', async()=>{
    const error=new DOMException('Render failed', name), reports=[];
    const done=pageTransitionDone({ready:Promise.reject(error),finished:Promise.reject(error),updateCallbackDone:Promise.reject(error)},e=>reports.push(e));
    await assert.rejects(done,e=>e===error);
    assert.deepEqual(reports,[]);
  });
}
test('unexpected animation failures remain reported',async()=>{
  const error=new Error('Unexpected animation failure'), reports=[];
  await pageTransitionDone({ready:Promise.reject(error),finished:Promise.resolve(),updateCallbackDone:Promise.resolve()},e=>reports.push(e));
  await Promise.resolve(); assert.deepEqual(reports,[error]);
});
