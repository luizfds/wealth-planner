import './_env.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { rateHistoryHtml, rateChangeNote } from '../src/components/properties.js';
import { reportDisclosureHtml } from '../src/components/reports.js';
import { reportDisclosure, reportDisclosureRows } from '../src/calc/planningreadiness.js';

test('loan history dates are readable while inputs and the loan remain ISO',()=>{
  const loan={id:'example-loan',balance:300000,rate:6,termYears:30,repaymentType:'PI',settlementDate:'2025-07-01',rateHistory:[{date:'2025-07-01',rate:5},{date:'2026-07-01',rate:6}]};
  const before=JSON.stringify(loan),html=rateHistoryHtml(loan,'2026-11-03');
  assert.match(html,/from 1 Jul 2025/);assert.match(html,/from 1 Jul 2026/);
  assert.match(rateChangeNote(loan),/Last change 1 Jul 2026:/);
  assert.match(html,/value="2026-11-03"/);
  assert.equal(JSON.stringify(loan),before);
});

test('report display dates are readable without changing ISO exports or literal notes',()=>{
  const info=reportDisclosure({savedAt:'2025-07-01T10:00:00Z'},'2026-11-03',{note:'Example note 2026-01-01'});
  const before=JSON.stringify(info),html=reportDisclosureHtml(info,true);
  assert.match(html,/As of 3 Nov 2026/);assert.match(html,/Last saved: 1 Jul 2025/);
  assert.match(html,/Example note 2026-01-01/);
  assert.deepEqual(reportDisclosureRows(info).slice(1,4),[['As of','2026-11-03'],['Profile sections entered','0/5'],['Last saved','2025-07-01']]);
  assert.equal(JSON.stringify(info),before);
});

test('tax evidence names the sale date without changing its stored checklist key',async()=>{
  const {state}=await import('../src/state.js'),{evidenceItems}=await import('../src/components/taxyear.js');
  const original={assets:state.assets,income:state.income,properties:state.properties};
  try{
    state.income=[];state.properties=[];
    state.assets=[{what:'Example holding',category:'Shares',sales:[{date:'2026-10-01',units:1,proceeds:100,costBase:50}]}];
    const before=JSON.stringify(state.assets),item=evidenceItems(2026).find(x=>x.key.startsWith('sale:'));
    assert.equal(item.key,'sale:Example holding:2026-10-01');
    assert.match(item.text,/sold 1 Oct 2026$/);
    assert.equal(JSON.stringify(state.assets),before);
  }finally{Object.assign(state,original);}
});
