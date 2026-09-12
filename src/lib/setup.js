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

// The five things the Dashboard's own figures depend on, in the order they build on each other:
// income before expenses (a savings rate needs both), housing before a comparison (the thing being
// compared), assets before a net worth, and a second scenario before any of it is a comparison at
// all. Deliberately five and not eight — Accounts and Categories are refinements of data you have
// already entered, not gaps that leave a figure blank.
export function setupSteps(s){
  s = s || {};
  var scenarios = s.scenarios || [];
  var active = s.activeScenario;
  var homeBlock = (s.home || {})[active] || [];
  return [
    {
      key: "income", label: "Add your income", page: "income",
      hint: "Gross or net pay — tax and super are worked out for you.",
      done: (s.income || []).length > 0
    },
    {
      key: "expenses", label: "Add your everyday expenses", page: "expenses",
      hint: "Rent, groceries, subscriptions — what you plan to spend.",
      done: (s.shared || []).length > 0
    },
    {
      // A home block always exists (migrateState seeds one), so "has a row with a cost" is the
      // honest test rather than "the block exists".
      key: "housing", label: "Set your housing costs", page: "scenarios",
      hint: "Rent, or the loan and running costs of a place you'd buy.",
      done: homeBlock.some(function(row){ return row && Number(row.amount) > 0; })
    },
    {
      key: "assets", label: "Add what you own", page: "assets",
      hint: "Cash, shares, super, a car — this is what net worth counts.",
      done: (s.assets || []).length + (s.properties || []).length > 0
    },
    {
      key: "compare", label: "Add a second scenario to compare", page: "scenarios",
      hint: "Renting against buying, or one suburb against another.",
      done: scenarios.length > 1
    }
  ];
}

// {done, total, complete, next} — `next` is the first unfinished step, which is the only one worth
// pointing at: a list of five "do this" links is a chore, one is a next move.
export function setupProgress(s){
  var steps = setupSteps(s);
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
export function shouldShowSetup(s){
  if(!s || s.setupDismissed) return false;
  return !setupProgress(s).complete;
}
