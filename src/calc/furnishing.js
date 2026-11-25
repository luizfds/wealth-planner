// Work in cents so a purchase at the buffer does not show a rounding shortfall.
export function furnishingDecision(budget, spent, cash, buffer, price){
  var cents = [budget, spent, cash, buffer, price].map(function(n){ return Math.round(n * 100); });
  var remaining = cents[0] - cents[1];
  var margin = cents[2] - cents[3];
  return {
    remaining: remaining / 100,
    available: Math.max(0, Math.min(remaining, margin)) / 100,
    after: (cents[2] - cents[4]) / 100,
    bufferMargin: (margin - cents[4]) / 100,
    budgetMargin: (remaining - cents[4]) / 100
  };
}
