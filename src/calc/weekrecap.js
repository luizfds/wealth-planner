// ---------------- Your week, in one card (v3.166.0, item 196) ----------------
//
// The app only spoke when it was opened and looked through. From the first open of a Monday, Home
// has a "Your week" card about the week just finished (Monday to Sunday): what was spent against
// your usual week, the three biggest, the bills due in the week ahead, rows waiting for review and
// one notice. Dismissing it is kept in state.weekRecaps[monday] = "dismissed", so it syncs and the
// other device doesn't show it again; the last four weeks can still be stepped back through.
//
// Spent is counted the way Spending counts it: every transaction dated in those seven days, refunds
// netted, transfers and money received never in it. The usual week is the median of the eight weeks
// before that had anything logged (needing at least three of them), so one holiday week doesn't
// make every other week look thrifty. Pure: everything comes in as arguments.

export var KEEP_WEEKS = 4;

function utc(iso){ return Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))); }
function iso(ms){ return new Date(ms).toISOString().slice(0, 10); }
export function addDays(d, n){ return iso(utc(d) + n * 86400000); }
// The Monday of the week `d` falls in.
export function mondayOf(d){
  var dow = new Date(utc(d)).getUTCDay(); // 0 = Sunday
  return addDays(d, -((dow + 6) % 7));
}
// The week the card is about on `today`: the last whole Monday-to-Sunday before it.
export function recapWeek(today, back){
  var start = addDays(mondayOf(today), -7 * (1 + (back || 0)));
  return { start: start, end: addDays(start, 6) };
}

function r2(n){ return Math.round(n * 100) / 100; }
function median(xs){
  var a = xs.slice().sort(function(p, q){ return p - q; });
  if(!a.length) return 0;
  var m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

// The transactions dated start..end (inclusive) — Spending's rows for those days.
export function transactionsBetween(transactions, start, end){
  return (transactions || []).filter(function(t){ return t && typeof t.date === "string" && t.date >= start && t.date <= end; });
}
export function spentBetween(transactions, start, end){
  return r2(transactionsBetween(transactions, start, end).reduce(function(s, t){ return s + (Number(t.amount) || 0); }, 0));
}

// The usual week before `start`: the median of up to eight earlier weeks with spending logged.
export function usualWeek(transactions, start){
  var weeks = [];
  for(var i = 1; i <= 8; i++){
    var s = addDays(start, -7 * i), e = addDays(s, 6);
    if(transactionsBetween(transactions, s, e).length) weeks.push(spentBetween(transactions, s, e));
  }
  return weeks.length >= 3 ? { amount: r2(median(weeks)), weeks: weeks.length } : null;
}

// The recap of the week `back` weeks before the last one (0 = the week just finished).
// opts: { bills: upcomingBills-shaped rows due from today on, toReview: number, notice: { title, … } }.
export function weekRecap(transactions, today, opts){
  opts = opts || {};
  var w = recapWeek(today, opts.back);
  var rows = transactionsBetween(transactions, w.start, w.end);
  var spent = spentBetween(transactions, w.start, w.end);
  var usual = usualWeek(transactions, w.start);
  var biggest = rows.filter(function(t){ return (Number(t.amount) || 0) > 0; })
    .sort(function(a, b){ return (Number(b.amount) || 0) - (Number(a.amount) || 0) || (a.date < b.date ? -1 : 1); }).slice(0, 3);
  // The week ahead, from today: bills only on the latest recap (an old week's "next week" has been).
  var ahead = opts.back ? [] : (opts.bills || []).filter(function(b){ return !b.overdue && b.due >= today && b.due <= addDays(today, 6); });
  return {
    start: w.start, end: w.end, back: opts.back || 0,
    spent: spent, count: rows.length,
    usual: usual ? usual.amount : null, vsUsual: usual ? r2(spent - usual.amount) : null,
    biggest: biggest,
    bills: ahead, billsTotal: r2(ahead.reduce(function(s, b){ return s + (Number(b.amount) || 0); }, 0)),
    toReview: opts.back ? 0 : (opts.toReview || 0),
    notice: opts.back ? null : (opts.notice || null)
  };
}

// Whether Home shows the card on `today`: that week has spending logged (a week whose statement
// isn't in yet would read "$0 spent") and its recap hasn't been dismissed here or on another device.
export function showWeekRecap(st, today){
  st = st || {};
  var w = recapWeek(today);
  if((st.weekRecaps || {})[w.start] === "dismissed") return false;
  return transactionsBetween(st.transactions, w.start, w.end).length > 0;
}
export function dismissWeekRecap(st, today){
  var w = recapWeek(today);
  st.weekRecaps = st.weekRecaps || {};
  st.weekRecaps[w.start] = "dismissed";
  return pruneWeekRecaps(st, today);
}
// Only the last four weeks' answers are worth keeping.
export function pruneWeekRecaps(st, today){
  var oldest = recapWeek(today, KEEP_WEEKS - 1).start;
  Object.keys(st.weekRecaps || {}).forEach(function(k){ if(k < oldest) delete st.weekRecaps[k]; });
  return st;
}
