import test from "node:test";
import assert from "node:assert/strict";
import { budgetPlanData } from "../src/calc/budgetplan.js";

test('two incomes accumulate; spending and annual adjustments carry the same balance',()=>{
  const b = budgetPlanData({income:[{label:'Alex pay',monthly:5000},{label:'Sam pay',monthly:3000},
    {label:'Bonus',monthly:500,oneOff:true},{label:'Tax bill',monthly:-100,oneOff:true}],groups:[{label:'Needs',monthly:4000},{label:'Wants',monthly:1000}],other:500});
  assert.deepEqual(b.income.map(r=>r.balance),[5000,8000]);
  assert.deepEqual(b.out.map(r=>r.balance),[4000,3000,2500]);
  assert.deepEqual(b.annual.map(r=>r.balance),[3000,2900]);
  assert.deepEqual([b.moneyIn,b.moneyOut,b.normal,b.average],[8000,5500,2500,2900]);
});
test('expense credits and negative income retain their signs',()=>{
  const b=budgetPlanData({income:[{label:'Pay',monthly:2000},{label:'Adjustment',monthly:-100}],groups:[{label:'Cost',monthly:1000},{label:'Credit',monthly:-200}],other:-100});
  assert.deepEqual(b.out.map(r=>r.amount),[-1000,200,100]);
  assert.equal(b.normal,1200);
});
test('an empty or deficit plan stays finite without resetting sections',()=>{
  assert.equal(budgetPlanData({}).normal,0);
  const b=budgetPlanData({income:[{monthly:1000},{monthly:100,oneOff:true}],groups:[{monthly:2000}]});
  assert.equal(b.normal,-1000);assert.equal(b.average,-900);
});
