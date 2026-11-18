// ---------------- Settings → Preferences: screens you rarely open (#426) ----------------
// Drawn from lib/pageuse.js's count, kept on this device only, when Preferences is shown.
import { readUse, rarelyOpened } from "../lib/pageuse.js";
import { escapeAttr } from "../lib/html.js";
import { fmtDate } from "../lib/format.js";
import { emptyStateHtml } from "../lib/empty.js";

// The screens worth knowing about — what a household might not need — named as the menu names them.
export var KNOWN_SCREENS = [
  { key: "dashboard/insights", label: "Today → Insights" }, { key: "dashboard/benchmarks", label: "Today → How you compare" },
  { key: "dashboard/review", label: "Today → Monthly review" },
  { key: "expenses/budget", label: "Money → Budget" },
  { key: "expenses/spending", label: "Money → Transactions" }, { key: "expenses/bills", label: "Money → Bills" },
  { key: "networth", label: "Net worth" }, { key: "accounts", label: "Net worth → Accounts" },
  { key: "assets", label: "Net worth → Investments" }, { key: "properties", label: "Net worth → Property" },
  { key: "plan/scenarios", label: "Plan → Scenarios" }, { key: "plan/projections", label: "Plan → Projections" },
  { key: "plan/goals", label: "Plan → Goals" }, { key: "plan/retirement", label: "Plan → Retirement" },
  { key: "tax/year", label: "Tax → This year" }, { key: "tax/returns", label: "Tax → Returns" },
  { key: "tax/documents", label: "Tax → Documents" }, { key: "tax/people", label: "Tax → People" },
  { key: "reports", label: "Reports" }, { key: "calc", label: "Calculators" }, { key: "settings/rules", label: "Settings → Import rules" }
];

export function renderPageUse(){
  var body = document.getElementById("pageUseBody");
  if(!body) return;
  var use = readUse();
  var rare = rarelyOpened(KNOWN_SCREENS, use, { minTotal: 50, atMost: 1 });
  var since = use.since ? " since " + escapeAttr(fmtDate(use.since)) : "";
  // Nothing to do either way: it fills itself as the app is used.
  body.innerHTML = rare === null
    ? emptyStateHtml("Not enough counted yet" + (use.since ? " since " + fmtDate(use.since) : "") + ". As you use the app, the screens you hardly ever open show here — candidates for Simple mode to put away.", { done: true })
    : !rare.length
      ? emptyStateHtml("You have opened every screen more than once" + (use.since ? " since " + fmtDate(use.since) : "") + ".", { done: true })
      : '<p class="ledger-note" style="margin:0 0 8px">Opened once or never' + since + ':</p><ul class="page-use-list">' +
        rare.map(function(k){ return '<li>' + escapeAttr(k.label) + '</li>'; }).join("") + '</ul>';
}
