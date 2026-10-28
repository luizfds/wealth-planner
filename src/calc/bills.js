import { freqStepMonths, periodsOf, isActiveOn } from "./ledger.js";

// ---------------- The bills calendar (v3.60.0) ----------------
//
// When each regular bill lands in a month, worked out from the last time it was paid: a monthly
// line paid on 3 September is due 3 October, a quarterly one paid 20 July is due 20 October. Each
// occurrence says whether it's been paid (a transaction on that line within a few days of it) so
// the month reads as a checklist. Lines never logged have no day to put them on — they're listed
// separately rather than guessed. Pure: everything comes in as arguments.
var PAID_WINDOW_DAYS = 6;
function iso(d){ return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function parse(s){ var p = String(s).split("-"); return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2])); }
function daysBetween(a, b){ return Math.round((parse(a) - parse(b)) / 86400000); }

// Every date the line falls on within [start, end], stepping from `anchor` in both directions.
// Month steps keep the anchor's day, clamped to short months (31 Jan → 28 Feb → 31 Mar, not 3 Mar).
export function occurrencesBetween(anchor, freq, start, end){
  var out = [];
  var a = parse(anchor);
  if(isNaN(a.getTime())) return out;
  if(freq === "Weekly" || freq === "Fortnightly"){
    var step = freq === "Weekly" ? 7 : 14;
    var k = Math.floor(daysBetween(start, anchor) / step) - 1;
    for(var guard = 0; guard < 80; guard++, k++){
      var d = new Date(a.getFullYear(), a.getMonth(), a.getDate() + k * step);
      var s = iso(d);
      if(s > end) break;
      if(s >= start) out.push(s);
    }
    return out;
  }
  var months = freqStepMonths(freq);
  var startD = parse(start);
  var diff = (startD.getFullYear() - a.getFullYear()) * 12 + (startD.getMonth() - a.getMonth());
  var m = Math.floor(diff / months) * months - months;
  for(var g = 0; g < 40; g++, m += months){
    var y = a.getFullYear(), mo = a.getMonth() + m;
    var last = new Date(y, mo + 1, 0).getDate();
    var dd = iso(new Date(y, mo, Math.min(a.getDate(), last)));
    if(dd > end) break;
    if(dd >= start) out.push(dd);
  }
  return out;
}

// ---------------- A bill, or a spending budget? (v3.83.0) ----------------
//
// Every regular line used to be a bill, so a weekly groceries budget sat on the calendar four times
// a month as if it were a direct debit. What's logged tells them apart: a bill is about one payment
// a period, on a steady rhythm or for a steady amount (the electricity varies but comes monthly; the
// gym comes twice a week but is always the same). A spending budget is many purchases of varying
// size — groceries, petrol, the pet, online shopping. line.billKind ("bill" | "spending") overrides.
var PERIOD_DAYS = { Weekly: 7, Fortnightly: 14, Monthly: 30.44, Quarterly: 91.31, "Half-yearly": 182.62, Yearly: 365.25 };
export function lineKindFeatures(payments, freq){
  var pays = (payments || []).filter(function(p){ return p.date && Number(p.amount) > 0; }).sort(function(a, b){ return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  if(!pays.length) return null;
  // The last twelve months of it: an old habit isn't today's line.
  var last = pays[pays.length - 1].date;
  var from = String(Number(last.slice(0, 4)) - 1) + last.slice(4);
  pays = pays.filter(function(p){ return p.date > from; });
  var per = PERIOD_DAYS[freq] || 30.44;
  var span = daysBetween(pays[pays.length - 1].date, pays[0].date);
  var gaps = [];
  for(var i = 1; i < pays.length; i++) gaps.push(daysBetween(pays[i].date, pays[i - 1].date));
  var regular = gaps.length ? gaps.filter(function(g){ return Math.abs(g - per) <= Math.max(3, per * 0.2); }).length / gaps.length : 1;
  var amts = pays.map(function(p){ return Number(p.amount); });
  var mean = amts.reduce(function(s, a){ return s + a; }, 0) / amts.length;
  var sd = Math.sqrt(amts.reduce(function(s, a){ return s + (a - mean) * (a - mean); }, 0) / amts.length);
  return { count: pays.length, perPeriod: pays.length / (span / per + 1), regular: regular, spread: mean ? sd / mean : 0 };
}
export function lineKind(line, payments){
  if(line && (line.billKind === "bill" || line.billKind === "spending")) return line.billKind;
  return inferredLineKind(line, payments);
}
export function inferredLineKind(line, payments){
  var f = lineKindFeatures(payments, line && line.freq);
  if(!f || f.count < 3) return "bill";
  if(f.perPeriod >= 2.5 && f.spread >= 0.2) return "spending";
  // A quarterly or yearly line is paid when the invoice comes, which wanders — an uneven rhythm
  // there is still one bill a period. Only several payments a period make it spending.
  if(freqStepMonths(line && line.freq) >= 3) return f.perPeriod >= 2 && f.spread >= 0.35 ? "spending" : "bill";
  if(f.spread >= 0.35 && (f.perPeriod > 1.3 || f.regular < 0.8)) return "spending";
  return "bill";
}

// ---------------- Card bills on the card repayment (v3.83.0) ----------------
//
// A bill charged to a credit card doesn't leave the bank on its own day: it goes out with the card
// repayment. The repayment day is read from the repayments already logged as transfers to the card
// (the most common day of the month); the amount, until it's been paid, is what was charged in the
// statement cycle that closed before it (cycle from account.statementStartDay).
function clampDay(ym, day){
  var y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7));
  var dim = new Date(y, m, 0).getDate();
  return ym + "-" + String(Math.min(day, dim)).padStart(2, "0");
}
function addMonths(ym, n){ var d = new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1 + n, 1); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); }
function addDays(isoStr, n){ var d = parse(isoStr); d.setDate(d.getDate() + n); return iso(d); }
// v3.139.0: a card can carry its repayment day (`payDay`) — needed when it's paid by direct debit and
// nothing is logged to read the day from. Set, it wins over the logged repayments' day.
export function cardRepaymentDay(card, transfers){
  if(card && Number(card.payDay) >= 1) return Math.min(31, Math.round(Number(card.payDay)));
  var days = (transfers || []).filter(function(t){ return t.to === card.name && t.date && Number(t.amount) > 0; })
    .sort(function(a, b){ return a.date < b.date ? 1 : -1; }).slice(0, 6).map(function(t){ return Number(t.date.slice(8, 10)); });
  if(!days.length) return null;
  days.sort(function(a, b){ return a - b; });
  return days[Math.floor((days.length - 1) / 2)];
}
// The statement cycle a charge on `date` falls in, given the cycle's start day: { start, end }.
export function cycleFor(date, startDay){
  startDay = Math.min(28, Math.max(1, Number(startDay) || 1));
  var ym = date.slice(0, 7);
  var start = Number(date.slice(8, 10)) >= startDay ? clampDay(ym, startDay) : clampDay(addMonths(ym, -1), startDay);
  var end = addDays(clampDay(addMonths(start.slice(0, 7), 1), startDay), -1);
  return { start: start, end: end };
}
// The repayment that pays a charge made on `date`: the first repayment day after its cycle closes.
export function repaymentFor(date, startDay, payDay){
  var end = cycleFor(date, startDay).end;
  var ym = end.slice(0, 7), d = clampDay(ym, payDay);
  return d > end ? d : clampDay(addMonths(ym, 1), payDay);
}
// The repayments due in a month for each credit card: { card, date, amount, paid, estimated,
// cycle: {start,end}, charges }.
// kindOf(lineId) → "bill" | "spending" | null splits the charges: everything on the card goes out
// in the one repayment, bills and groceries and one-offs alike.
export function cardPaymentsForMonth(accounts, transactions, transfers, ym, today, kindOf){
  var out = [];
  (accounts || []).filter(function(a){ return a && a.type === "credit" && a.name; }).forEach(function(card){
    var payDay = cardRepaymentDay(card, transfers);
    if(!payDay) return;
    var date = clampDay(ym, payDay);
    var paidTx = (transfers || []).filter(function(t){ return t.to === card.name && t.date && Math.abs(daysBetween(t.date, date)) <= PAID_WINDOW_DAYS; });
    // The cycle this repayment settles: the one that closed most recently before it.
    var cycle = cycleFor(addDays(date, -1), card.statementStartDay);
    if(cycle.end >= date) cycle = cycleFor(addDays(cycle.start, -1), card.statementStartDay);
    var split = { bill: 0, spending: 0, other: 0 };
    var charges = (transactions || []).reduce(function(s, t){
      if(t.account !== card.name || !(t.date >= cycle.start && t.date <= cycle.end)) return s;
      var k = kindOf && t.linkedExpenseId ? kindOf(t.linkedExpenseId) : null;
      split[k === "bill" || k === "spending" ? k : "other"] += Number(t.amount) || 0;
      return s + (Number(t.amount) || 0);
    }, 0);
    var paid = paidTx.reduce(function(s, t){ return s + Number(t.amount); }, 0);
    // v3.139.0: a card paid in full by direct debit (`autoPayFrom`, an account name) is taken as paid
    // once its day has come, until the real repayment is logged — never "overdue" for want of logging.
    var autoPaid = !paidTx.length && !!card.autoPayFrom && !!today && date <= today;
    out.push({ card: card.name, date: date, payDay: payDay, cycle: cycle, autoPayFrom: card.autoPayFrom || "", assumed: autoPaid,
      charges: Math.round(charges * 100) / 100,
      split: { bills: Math.round(split.bill * 100) / 100, spending: Math.round(split.spending * 100) / 100, other: Math.round(split.other * 100) / 100 },
      amount: Math.round((paidTx.length ? paid : charges) * 100) / 100,
      paid: paidTx.length > 0 || autoPaid, overdue: !paidTx.length && !autoPaid && !!today && date < today,
      // Charges still being made: the cycle hasn't closed yet, so this is "so far".
      open: !!today && cycle.end >= today });
  });
  return out;
}

// { days: { "YYYY-MM-DD": [bill] }, undated: [line], spending: [line], cardPayments: [payment],
//   total, paidTotal, directTotal, cardTotal } for one month.
// bill: { id, what, amount, date, paid, overdue, estimated, card, payOn, agent }. agent: the property
// manager account that pays it out of the rent (never overdue, never upcoming). card: the credit card it's
// charged to (from its latest payment), payOn: that card's repayment the charge goes out with.
// opts: { accounts, transfers } — without them nothing is grouped on a card.
export function billsForMonth(items, transactions, ym, today, opts){
  opts = opts || {};
  var y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7));
  var start = ym + "-01", end = ym + "-" + String(new Date(y, m, 0).getDate()).padStart(2, "0");
  var byLine = {};
  (transactions || []).forEach(function(t){ if(t.linkedExpenseId && t.date) (byLine[t.linkedExpenseId] = byLine[t.linkedExpenseId] || []).push(t); });
  var cards = {};
  (opts.accounts || []).forEach(function(a){ if(a && a.type === "credit" && a.name) cards[a.name] = { card: a, payDay: cardRepaymentDay(a, opts.transfers) }; });
  // v3.101.0: bills a property manager pays out of the rent — never a debit from the household.
  var agents = {};
  (opts.accounts || []).forEach(function(a){ if(a && a.type === "agent" && a.name) agents[a.name] = true; });
  var days = {}, undated = [], spending = [], kinds = [], stopped = [], kindById = {}, total = 0, paidTotal = 0, cardTotal = 0, agentTotal = 0;
  (items || []).forEach(function(i){
    if(!i.id || i.irregular || i.computed) return;
    // Ended before the month began, or not started by its end: not this month's business.
    if((i.endDate && i.endDate < start) || (i.startDate && i.startDate > end)) return;
    var logged = (byLine[i.id] || []).slice().sort(function(a, b){ return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    var kind = lineKind(i, logged);
    kindById[i.id] = kind;
    kinds.push({ id: i.id, what: i.what || "Line", kind: kind, setting: i.billKind === "bill" || i.billKind === "spending" ? i.billKind : "", auto: inferredLineKind(i, logged) });
    if(kind === "spending"){
      var spent = logged.reduce(function(s, t){ return t.date >= start && t.date <= end ? s + (Number(t.amount) || 0) : s; }, 0);
      spending.push({ id: i.id, what: i.what || "Spending", budget: Math.round(periodsOf(i.amount, i.freq).monthly * 100) / 100, spent: Math.round(spent * 100) / 100, overridden: !!i.billKind });
      return;
    }
    var dates = logged.map(function(t){ return t.date; });
    var lastAcct = logged.length ? logged[logged.length - 1].account : (i.account || "");
    var onCard = cards[lastAcct] || null;
    var byAgent = !!agents[lastAcct];
    var anchor, estimated = false;
    if(dates.length) anchor = dates[dates.length - 1];
    else if(i.dueMonth >= 1 && i.dueMonth <= 12 && freqStepMonths(i.freq) > 1){
      // v3.72.0: a renewal with a due month (and day) gets its date before it's ever paid.
      var dim = new Date(y, Number(i.dueMonth), 0).getDate();
      anchor = y + "-" + String(i.dueMonth).padStart(2, "0") + "-" + String(Math.min(Number(i.dueDay) || 1, dim)).padStart(2, "0");
      estimated = true;
    } else { undated.push({ id: i.id, what: i.what || "Bill", amount: Number(i.amount) || 0, freq: i.freq, overridden: !!i.billKind }); return; }
    // A bill that stopped being paid (a cancelled membership) without an end date: once today is
    // well past two and a half periods since the last payment, its later dates are noise, not
    // overdue bills. Listed once as "stopped?" with the last payment, to end it there.
    var quietAfter = null;
    if(dates.length && today && !i.endDate){
      var q = addDays(anchor, Math.round((PERIOD_DAYS[i.freq] || 30.44) * 2.5) + 7);
      if(today > q){ quietAfter = q; if(end >= q) stopped.push({ id: i.id, what: i.what || "Bill", last: anchor }); }
    }
    occurrencesBetween(anchor, i.freq, start, end).forEach(function(d){
      if(!isActiveOn(i, d) || (quietAfter && d > quietAfter)) return;
      var paid = dates.some(function(x){ return Math.abs(daysBetween(x, d)) <= PAID_WINDOW_DAYS; });
      var bill = { id: i.id, what: i.what || "Bill", amount: Number(i.amount) || 0, date: d, paid: paid, overdue: !byAgent && !paid && today && d < today, estimated: estimated, overridden: !!i.billKind,
        card: onCard ? lastAcct : "", payOn: onCard && onCard.payDay ? repaymentFor(d, onCard.card.statementStartDay, onCard.payDay) : "",
        agent: byAgent ? lastAcct : "" };
      (days[d] = days[d] || []).push(bill);
      total += bill.amount;
      if(bill.card) cardTotal += bill.amount;
      if(bill.agent) agentTotal += bill.amount;
      if(paid) paidTotal += bill.amount;
    });
  });
  Object.keys(days).forEach(function(d){ days[d].sort(function(a, b){ return b.amount - a.amount; }); });
  spending.sort(function(a, b){ return b.budget - a.budget; });
  // Lines outside this month still classify card charges (an ended line's last charges, say).
  (items || []).forEach(function(i){
    if(i.id && !kindById[i.id] && !i.irregular && !i.computed) kindById[i.id] = lineKind(i, byLine[i.id] || []);
  });
  var cardPayments = opts.accounts ? cardPaymentsForMonth(opts.accounts, transactions, opts.transfers, ym, today, function(id){ return kindById[id] || null; }) : [];
  var r2 = function(n){ return Math.round(n * 100) / 100; };
  kinds.sort(function(a, b){ return a.what.localeCompare(b.what); });
  return { start: start, end: end, days: days, undated: undated, spending: spending, cardPayments: cardPayments, kinds: kinds, stopped: stopped,
    total: r2(total), paidTotal: r2(paidTotal), cardTotal: r2(cardTotal), agentTotal: r2(agentTotal), directTotal: r2(total - cardTotal - agentTotal) };
}

// ---------------- Bills coming up, for Home and the bell (v3.94.1) ----------------
//
// Home's "Bills — next 2 weeks", the dashboard's upcoming panel and the due-bill notifications each
// projected every regular line forward from its last payment on their own, so they kept flagging
// what the calendar had learnt to leave out: an ended line (a cancelled membership), a spending
// budget (groceries are not due on a day), a bill charged to the card (it goes out with the card
// payment), a bill that stopped being paid. They read the calendar's own month now, so the four
// can't disagree: bills paid from an account and each card's repayment, unpaid, from a week ago to
// `days` ahead. Pure apart from its arguments.
function ymOf(iso){ return iso.slice(0, 7); }
export function upcomingBills(items, transactions, today, days, opts){
  var horizon = days == null ? 14 : days;
  var from = addDays(today, -7), to = addDays(today, horizon);
  var months = [ymOf(from), ymOf(today), ymOf(to)].filter(function(m, i, a){ return a.indexOf(m) === i; });
  var out = [];
  months.forEach(function(m){
    var r = billsForMonth(items, transactions, m, today, opts);
    Object.keys(r.days).forEach(function(d){
      if(d < from || d > to) return;
      r.days[d].forEach(function(b){
        if(b.paid || b.card || b.agent) return;
        out.push({ id: b.id, what: b.what, due: d, days: daysBetween(d, today), amount: b.amount, overdue: d < today, estimated: !!b.estimated });
      });
    });
    r.cardPayments.forEach(function(p){
      if(p.paid || p.date < from || p.date > to || !(p.amount > 0)) return;
      out.push({ id: "card:" + p.card, what: p.card + " payment", due: p.date, days: daysBetween(p.date, today), amount: p.amount, overdue: p.date < today, card: true });
    });
  });
  return out.sort(function(a, b){ return a.due < b.due ? -1 : a.due > b.due ? 1 : b.amount - a.amount; });
}
// Why a line isn't a bill to chase today: "ended", "spending", "stopped" — or "bill" when it is.
export function billLineStatus(item, transactions, today){
  if(!item || !isActiveOn(item, today)) return "ended";
  var logged = (transactions || []).filter(function(t){ return t.linkedExpenseId === item.id && t.date; })
    .sort(function(a, b){ return a.date < b.date ? -1 : 1; });
  if(lineKind(item, logged) === "spending") return "spending";
  if(logged.length && !item.endDate){
    var last = logged[logged.length - 1].date;
    if(today > addDays(last, Math.round((PERIOD_DAYS[item.freq] || 30.44) * 2.5) + 7)) return "stopped";
  }
  return "bill";
}

// v3.113.0: the bills that have fallen due and not been logged — what "Catch up" offers to
// confirm in one go. Bills paid from an account only: a bill on a card arrives with the card's
// statement, and one the property manager pays with theirs. From up to `back` days ago (default 62)
// to today; a missed monthly bill appears once per month it was missed. Each: { id, what, due, amount,
// estimated }, oldest first.
export function billsToConfirm(items, transactions, today, opts){
  opts = opts || {};
  var from = addDays(today, -(opts.back || 62));
  var months = [];
  for(var m = ymOf(from); m <= ymOf(today); m = ymOf(addDays(m + "-28", 7))) months.push(m);
  // Not before a line's first logged payment: the calendar projects a bill backwards from it, but
  // months before you started tracking it aren't bills you missed.
  var first = {};
  (transactions || []).forEach(function(t){ if(t.linkedExpenseId && t.date && (!first[t.linkedExpenseId] || t.date < first[t.linkedExpenseId])) first[t.linkedExpenseId] = t.date; });
  var out = [];
  months.forEach(function(ym){
    var r = billsForMonth(items, transactions, ym, today, opts);
    Object.keys(r.days).forEach(function(d){
      if(d < from || d > today) return;
      r.days[d].forEach(function(b){
        if(b.paid || b.card || b.agent || !(b.amount > 0)) return;
        if(first[b.id] && d < first[b.id]) return;
        out.push({ id: b.id, what: b.what, due: d, amount: b.amount, estimated: !!b.estimated });
      });
    });
  });
  return out.sort(function(a, b){ return a.due < b.due ? -1 : a.due > b.due ? 1 : 0; });
}

// ---------------- Card repayments from the wrong kind of account (v3.144.0) ----------------
// A repayment logged from a loan or another card: almost always the wrong account picked (an offset
// and its loan often share most of a name), and it reads as borrowing more to pay the card. `usual` is
// what it most likely came from: the card's direct-debit account, else where its other repayments came from.
var NOT_A_SOURCE = { loan: 1, credit: 1 };
export function usualCardSource(card, accounts, transfers){
  if(card.autoPayFrom) return card.autoPayFrom;
  var typeOf = {}; (accounts || []).forEach(function(a){ typeOf[a.name] = a.type; });
  var counts = {};
  (transfers || []).forEach(function(t){ if(t.to === card.name && t.from && typeOf[t.from] && !NOT_A_SOURCE[typeOf[t.from]]) counts[t.from] = (counts[t.from] || 0) + 1; });
  var best = Object.keys(counts).sort(function(a, b){ return counts[b] - counts[a]; })[0];
  return best || "";
}
export function oddCardRepayments(accounts, transfers){
  var byName = {}; (accounts || []).forEach(function(a){ byName[a.name] = a; });
  return (transfers || []).filter(function(t){
    var to = byName[t.to], from = byName[t.from];
    return to && to.type === "credit" && from && NOT_A_SOURCE[from.type];
  }).map(function(t){
    var card = byName[t.to];
    return { transfer: t, card: card.name, fromType: byName[t.from].type, usual: usualCardSource(card, accounts, transfers) };
  });
}
