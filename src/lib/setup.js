// What's still empty, and where to go to fill it in.
//
// The app is eight independent pages. Nothing has ever connected them: you enter income, and the
// app says nothing about expenses; you enter expenses, and nothing points at assets. Every figure
// on the Dashboard is derived from data spread across four tabs, so until all four have something
// in them the Dashboard is a wall of zeroes with no indication of which tab is the missing one.
//
// This turns that into a path. It is not a wizard — every page stays reachable in any order, and
// the whole thing is dismissible — it just answers "what next" for someone who has entered one
// thing and doesn't know there are three more that matter.
//
// Pure: takes the state it needs as an argument, returns data. No DOM, no state writes.

// v3.162.0 (item 192): the first month, four steps, in the order a new household does them — pay, a
// statement, the budget that statement suggests, then what you own. A comparison of scenarios and the
// housing rows used to be steps too; the first-run setup asks about housing now, and a comparison is
// planning, not setting up. opts.budget is proposeBudget()'s answer ({ ready, months, proposals }),
// passed in so this stays pure.
export function setupSteps(s, opts){
  s = s || {};
  opts = opts || {};
  var hasStatement = (s.transactions || []).length > 0;
  var b = opts.budget || null;
  var pending = b && b.ready ? (b.proposals || []).length : null;
  var monthsShort = b && !b.ready ? Math.max(1, 3 - (b.months || 0)) : 0;
  return [
    {
      key: "income", label: "Add your pay", page: "expenses", sub: "income",
      hint: "Before tax — tax and super are worked out for you.",
      done: (s.income || []).length > 0
    },
    {
      key: "statement", label: "Import a bank statement", page: "expenses", sub: "spending", open: "bankImportCard",
      hint: "Three months of CSV or PDF statements, and the budget builds itself from them.",
      done: hasStatement
    },
    {
      key: "budget", label: "Check the budget your spending suggests", page: "expenses", sub: "budget", open: "historyBudgetCard",
      hint: monthsShort ? "Import " + monthsShort + " more month" + (monthsShort === 1 ? "" : "s") + " of statements and a budget is proposed from them."
        : pending ? pending + " line" + (pending === 1 ? "" : "s") + " suggested from what you actually spend — keep, change or skip each."
        : "Nothing left to suggest.",
      done: hasStatement && pending === 0
    },
    {
      key: "assets", label: "Add what you own", page: "networth",
      hint: "Account balances, super, a car — this is what net worth counts.",
      done: (s.assets || []).length + (s.properties || []).length > 0
    }
  ];
}

// {done, total, complete, next} — `next` is the first unfinished step, which is the only one worth
// pointing at: a list of five "do this" links is a chore, one is a next move.
export function setupProgress(s, opts){
  var steps = setupSteps(s, opts);
  var done = steps.filter(function(x){ return x.done; }).length;
  return {
    steps: steps,
    done: done,
    total: steps.length,
    complete: done === steps.length,
    next: steps.find(function(x){ return !x.done; }) || null
  };
}

// Whether to show the panel at all. Hidden once every step is done — a permanent "5 of 5" badge is
// clutter — and once the user has dismissed it, which is remembered rather than session-only: it is
// a daily-use app and re-offering a dismissed checklist every morning would be its own annoyance.
export function shouldShowSetup(s, opts){
  if(!s || s.setupDismissed) return false;
  return !setupProgress(s, opts).complete;
}
