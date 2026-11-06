// Pure recurrence previews for explicitly configured rules. No persistence, import or network I/O.
// The caller must obtain user approval before recording any suggested occurrence.
const DAY = 86400000;
function dateParts(value){
  if(typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const year = Number(value.slice(0, 4)), month = Number(value.slice(5, 7)), day = Number(value.slice(8, 10));
  if(year < 1900 || year > 9999 || month < 1 || month > 12) return null;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if(day < 1 || day > last) return null;
  return { year, month, day, last, stamp: Date.UTC(year, month - 1, day) };
}
function iso(stamp){ return new Date(stamp).toISOString().slice(0, 10); }
function monthOccurrence(start, offset){
  const idx = start.year * 12 + start.month - 1 + offset;
  const year = Math.floor(idx / 12), month = idx % 12 + 1;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = start.day === start.last ? last : Math.min(start.day, last);
  return iso(Date.UTC(year, month - 1, day));
}
export function recurrenceDates(rule, from, through){
  if(!rule || rule.enabled === false) return [];
  const start = dateParts(rule.startDate), begin = dateParts(from), end = dateParts(through);
  if(!start || !begin || !end || begin.stamp > end.stamp) return [];
  // Bound each preview to one year to avoid huge accidental catch-up batches.
  if(end.stamp - begin.stamp > 366 * DAY) return [];
  const stop = rule.endDate ? dateParts(rule.endDate) : null;
  if(rule.endDate && !stop) return [];
  const freq = rule.frequency;
  const every = freq === "Weekly" ? 7 : freq === "Fortnightly" ? 14 : freq === "Custom" ? Number(rule.intervalDays) : null;
  if(freq !== "Monthly" && (!Number.isSafeInteger(every) || every < 1 || every > 366)) return [];
  const dates = [];
  if(freq === "Monthly"){
    const firstIndex = start.year * 12 + start.month - 1;
    const lastIndex = end.year * 12 + end.month - 1;
    for(let idx = firstIndex; idx <= lastIndex; idx++){
      const date = monthOccurrence(start, idx - firstIndex);
      if(date >= from && date <= through && (!stop || date <= rule.endDate)) dates.push(date);
    }
  } else {
    const first = Math.max(0, Math.ceil((begin.stamp - start.stamp) / (every * DAY)));
    for(let i = first; ; i++){
      const stamp = start.stamp + i * every * DAY;
      if(stamp > end.stamp) break;
      const date = iso(stamp);
      if(!stop || date <= rule.endDate) dates.push(date);
    }
  }
  return dates;
}
export function recurringCandidates(rule, existing, from, through){
  if(!rule || typeof rule.id !== "string" || !rule.id.trim()) return [];
  const used = new Set((existing || []).filter(Boolean).filter(function(tx){
    return tx.recurringRuleId === rule.id && typeof tx.recurringOccurrenceDate === "string";
  }).map(function(tx){ return tx.recurringOccurrenceDate; }));
  return recurrenceDates(rule, from, through).filter(function(date){ return !used.has(date); })
    .map(function(date){ return { recurringRuleId: rule.id, recurringOccurrenceDate: date, date: date }; });
}
