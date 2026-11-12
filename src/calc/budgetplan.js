// A statement carries one balance through regular income, costs, then annual income averaged monthly.
// Keep the arithmetic outside the renderer so multiple earners and the annual bridge can be checked.
export function budgetPlanData(opts){
  var balance = 0;
  var make = function(r, sign){
    var amount = (Number(r.monthly) || 0) * sign;
    balance += amount;
    return { label: r.label, amount: amount, balance: balance };
  };
  var all = (opts.income || []).filter(function(r){ return Math.abs(Number(r.monthly) || 0) >= 0.005; });
  var income = all.filter(function(r){ return !r.oneOff; }).map(function(r){ return make(r, 1); });
  var moneyIn = balance;
  var out = (opts.groups || []).filter(function(r){ return Math.abs(Number(r.monthly) || 0) >= 0.005; }).map(function(r){ return make(r, -1); });
  if(opts.other) out.push(make({ label: "Investment loan repayments", monthly: opts.other }, -1));
  var normal = balance;
  var annual = all.filter(function(r){ return r.oneOff; }).map(function(r){ return make(r, 1); });
  return { income: income, out: out, annual: annual, moneyIn: moneyIn, moneyOut: moneyIn - normal,
    normal: normal, average: opts.net != null ? opts.net : balance, calculatedAverage: balance };
}
