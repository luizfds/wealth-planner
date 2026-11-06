// Descriptive, local-only category comparisons. Never infer why spending changed.
function monthBefore(ym){
  const y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7));
  return new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
}
export function categorySpendingChanges(transactions, currentMonth){
  if(!/^\d{4}-\d{2}$/.test(currentMonth)) return [];
  const previous = monthBefore(currentMonth), groups = new Map();
  (transactions || []).forEach(function(tx){
    if(!tx || typeof tx.date !== "string" || !Number.isFinite(Number(tx.amount)) || Number(tx.amount) <= 0) return;
    const month = tx.date.slice(0, 7);
    if(month !== currentMonth && month !== previous) return;
    const name = String(tx.category || "Uncategorised").trim() || "Uncategorised";
    const row = groups.get(name) || { category: name, current: 0, previous: 0, currentCount: 0, previousCount: 0 };
    if(month === currentMonth){ row.current += Number(tx.amount); row.currentCount++; }
    else { row.previous += Number(tx.amount); row.previousCount++; }
    groups.set(name, row);
  });
  return [...groups.values()].map(function(row){
    const delta = Math.round((row.current - row.previous) * 100) / 100;
    return { ...row, current: Math.round(row.current * 100) / 100,
      previous: Math.round(row.previous * 100) / 100, delta,
      changePct: row.previous > 0 ? Math.round(delta / row.previous * 100) : null,
      incompleteMonth: true };
  }).sort(function(a, b){ return Math.abs(b.delta) - Math.abs(a.delta); });
}
