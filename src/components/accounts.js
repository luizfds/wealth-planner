import { state } from "../state.js";
import { ACCOUNT_TYPES, accountTypeLabel, accountSourceOptions, accountBalance, accountsOverview, isOwedType, isAgentType, rolledBalance } from "../calc/accounts.js";
import { transactionAccount } from "./expenses.js";
import { currentStatementCycle } from "../calc/ledger.js";
import { sparklineHtml, renderLineChart, dateAxisFormat } from "../lib/charts.js";
import { fmtCurrency0, fmtCurrency2, localDateStr } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";
import { detailLinkHtml } from "./detail.js";
import { accountAutoPaysHtml } from "./autopay.js";

// ---------------- Accounts → Accounts (v3.56.0) ----------------
// Every place money sits, grouped the way a bank app groups them — cash, cards, loans — each with
// its balance, when it was last updated, and its history. calc/accounts.js says where each balance
// is stored; this lays them out. Rows open to edit (name, type, where the balance comes from, the
// card's cycle and limit); "Update balance" is on the row itself because it's the thing done most.
export var openAccounts = {};
export var balanceEditing = {};

var GROUPS = [
  { key: "cash", title: "Bank accounts", types: ["everyday", "savings", "offset"] },
  { key: "cards", title: "Credit cards", types: ["credit"] },
  { key: "loans", title: "Loans", types: ["loan"] },
  { key: "agents", title: "Property managers", types: ["agent"] }
];
var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function shortDate(iso){ return iso ? Number(iso.slice(8, 10)) + " " + MONTHS[Number(iso.slice(5, 7)) - 1] + (iso.slice(0, 4) !== localDateStr().slice(0, 4) ? " " + iso.slice(0, 4) : "") : ""; }
function daysSince(iso, today){ return iso ? Math.round((Date.parse(today) - Date.parse(iso)) / 86400000) : null; }

function sourceSelectHtml(a, idx){
  var opts = accountSourceOptions(a);
  if(isAgentType(a.type)){
    return '<label class="acct-field acct-field-wide"><span>Manages</span><select class="acct-mgmt-link" data-acct-index="' + idx + '">' +
      '<option value="">— pick the property —</option>' +
      opts.map(function(o){ return '<option value="' + escapeAttr(o.key) + '"' + (a.link === o.key ? " selected" : "") + '>' + escapeAttr(o.label) + (o.usedBy ? " (also on " + escapeAttr(o.usedBy) + ")" : "") + '</option>'; }).join("") + '</select></label>';
  }
  var none = a.type === "offset" ? "— pick the loan it offsets —" : isOwedType(a.type) ? "Nothing yet — the first balance adds a debt" : "Nothing yet — the first balance adds it to Cash";
  return '<label class="acct-field acct-field-wide"><span>Balance comes from</span><select class="acct-mgmt-link" data-acct-index="' + idx + '">' +
    '<option value="">' + escapeAttr(none) + '</option>' +
    opts.map(function(o){
      return '<option value="' + escapeAttr(o.key) + '"' + (a.link === o.key ? " selected" : "") + '>' + escapeAttr(o.label) + (o.usedBy ? " (also on " + escapeAttr(o.usedBy) + ")" : "") + '</option>';
    }).join("") + '</select></label>';
}

export function accountRowHtml(a, idx, today){
  today = today || localDateStr();
  var bal = accountBalance(a);
  var rolled = rolledBalance(a, { today: today, accountOf: transactionAccount });
  if(rolled.count) bal = Object.assign({}, bal, { balance: rolled.balance });
  var open = !!openAccounts[a.id];
  var editing = !!balanceEditing[a.id];
  var owed = bal.owed;
  var agent = isAgentType(a.type);
  var amount = agent
    ? '<span class="acct-bal muted">pays from the rent</span>'
    : bal.balance == null
    ? '<span class="acct-bal muted">no balance</span>'
    : '<span class="acct-bal' + (owed && bal.balance > 0 ? " owed" : "") + '">' + (owed && bal.balance > 0 ? "−" : "") + fmtCurrency0.format(Math.abs(bal.balance)) + '</span>';
  var age = daysSince(bal.date, today);
  var sub = [accountTypeLabel(a.type)];
  if(agent && bal.source) sub.push(bal.source.label);
  // v3.112.0: "18 Oct balance + 19 since" when what's been logged since has moved it.
  if(bal.date) sub.push(rolled.count ? shortDate(bal.date) + " balance + " + rolled.count + " since" : "updated " + shortDate(bal.date));
  if(a.type === "credit"){
    var c = currentStatementCycle(a.statementStartDay || 1, today);
    sub.push("cycle " + shortDate(c.start) + "–" + shortDate(c.end));
    if(Number(a.limit) > 0) sub.push(fmtCurrency0.format(Math.max(0, Number(a.limit) - (bal.balance || 0))) + " of " + fmtCurrency0.format(Number(a.limit)) + " available");
  }
  var stale = bal.balance != null && age != null && age > 35;
  // v3.128.0: its own page — beside the toggle, since a button can't sit inside another.
  var actions = (a.id && !editing ? detailLinkHtml("account", a.id, "Details", "acct-card-detail btn btn-sm btn-ghost") : '') + (editing || agent ? '' : '<button type="button" class="btn btn-sm btn-ghost acct-card-update" data-acct-bal="' + escapeAttr(a.id) + '"' +
        (a.type === "offset" && !bal.source ? ' disabled title="Pick the loan it offsets first"' : '') + ' aria-label="Update ' + escapeAttr(a.name || "account") + ' balance">Update</button>');
  var summary = '<div class="acct-card-main">' +
      '<button type="button" class="acct-card-toggle" data-acct-toggle="' + escapeAttr(a.id) + '" aria-expanded="' + open + '">' +
        '<span class="acct-card-name">' + escapeAttr(a.name || "Unnamed account") + '</span>' +
        '<span class="acct-card-sub' + (stale ? " warn" : "") + '">' + escapeAttr(sub.join(" · ")) + (stale ? " — " + age + " days ago" : "") + '</span>' +
      '</button>' +
      '<span class="acct-card-spark">' + sparklineHtml(bal.history.slice(-12), { width: 56, height: 20 }) + '</span>' +
      amount + actions +
    '</div>';
  var balanceRow = editing
    ? '<div class="acct-bal-edit"><label><span>' + (owed ? "Owed today" : "Balance today") + ' $</span><input type="number" step="0.01" class="acct-bal-input" data-acct-index="' + idx + '" value="' + (bal.balance != null ? bal.balance : "") + '" aria-label="' + escapeAttr((a.name || "Account") + (owed ? " amount owed" : " balance")) + '"></label>' +
        '<button type="button" class="btn btn-sm btn-primary" data-acct-bal-save="' + idx + '">Save</button>' +
        '<button type="button" class="btn btn-sm btn-ghost" data-acct-bal-cancel="' + escapeAttr(a.id) + '">Cancel</button></div>'
    : '';
  var edit = open
    ? '<div class="acct-card-edit">' +
        // v3.67.0: the balance over time, drawn after render (renderAccountCharts).
        (agent ? '' : '<div class="acct-field-wide acct-chart" data-acct-chart="' + escapeAttr(a.id) + '"></div>') +
        '<label class="acct-field acct-field-wide"><span>Name</span><input type="text" class="acct-mgmt-name" data-acct-index="' + idx + '" value="' + escapeAttr(a.name || "") + '" placeholder="Account name" aria-label="Account name"></label>' +
        '<label class="acct-field"><span>Type</span><select class="acct-mgmt-type" data-acct-index="' + idx + '" aria-label="Account type">' +
          ACCOUNT_TYPES.map(function(t){ return '<option value="' + t.key + '"' + (a.type === t.key ? " selected" : "") + '>' + t.label + '</option>'; }).join("") + '</select></label>' +
        (a.type === "credit"
          ? '<label class="acct-field"><span>Cycle starts on day</span><input type="number" min="1" max="28" step="1" class="acct-mgmt-day" data-acct-index="' + idx + '" value="' + (a.statementStartDay || 1) + '" aria-label="Statement start day (1-28)"></label>' +
            '<label class="acct-field"><span>Limit $</span><input type="number" min="0" step="100" class="acct-mgmt-limit" data-acct-index="' + idx + '" value="' + (a.limit != null ? a.limit : "") + '" placeholder="optional" aria-label="Credit limit"></label>' +
            // v3.139.0: paid in full by direct debit — the repayment is then taken as made on its day.
            '<label class="acct-field"><span>Paid in full by direct debit from</span><select class="acct-mgmt-autopay" data-acct-index="' + idx + '" aria-label="Paid in full by direct debit from">' +
              '<option value="">— not set: I log each repayment —</option>' + (state.accounts || []).filter(function(x){ return x && x.name && x !== a && ["everyday", "savings", "offset"].indexOf(x.type) !== -1; }).map(function(x){ return '<option value="' + escapeAttr(x.name) + '"' + (a.autoPayFrom === x.name ? " selected" : "") + '>' + escapeAttr(x.name) + '</option>'; }).join("") +
              (a.autoPayFrom && !(state.accounts || []).some(function(x){ return x.name === a.autoPayFrom; }) ? '<option value="' + escapeAttr(a.autoPayFrom) + '" selected>' + escapeAttr(a.autoPayFrom) + ' (deleted)</option>' : '') + '</select></label>' +
            '<label class="acct-field"><span>Repayment on day</span><input type="number" min="1" max="31" step="1" class="acct-mgmt-payday" data-acct-index="' + idx + '" value="' + (a.payDay || "") + '" placeholder="from your repayments" aria-label="Repayment day of the month"></label>'
          : '') +
        sourceSelectHtml(a, idx) +
        '<p class="ledger-note acct-field-wide" style="margin:0">' + (a.type === "credit"
          ? "The limit is only for “available” — what counts against net worth is what the card owes."
          : a.type === "offset" ? "An offset's balance is the one on its loan — it lowers the interest that loan charges."
          : agent ? "The bills the agent pays out of the rent — on a statement — are tagged with this account, so they never show as a debit to chase or money leaving your accounts. It has no balance of its own."
          : bal.source ? "Stored on " + escapeAttr(bal.source.label) + " — the same figure net worth and the projections use." : "Spending tagged with this account still works without a balance.") + '</p>' +
        accountAutoPaysHtml(a, today) +
        '<div class="acct-field-wide acct-card-del"><button type="button" class="btn btn-danger btn-sm row-del" data-acct-del="' + idx + '" aria-label="Delete account">Delete account</button></div>' +
      '</div>'
    : '';
  return '<div class="acct-card' + (open ? " is-open" : "") + '" data-acct-index="' + idx + '">' + summary + balanceRow + edit + '</div>';
}

export function accountsPageHtml(today){
  today = today || localDateStr();
  if(!state.accounts.length && !accountsOverview().loose.length){
    return '<p class="ledger-note" style="margin:0">No accounts yet. Add your everyday account, savings, cards and loans — each with its balance — and tag spending with the account it came out of.</p>';
  }
  var ov = accountsOverview({ accountOf: transactionAccount });
  var head = '<div class="acct-totals"><div><span>Cash held</span><b>' + fmtCurrency0.format(ov.held) + '</b></div>' +
    '<div><span>Owed on cards and loans</span><b class="' + (ov.owed > 0 ? "owed" : "") + '">' + (ov.owed > 0 ? "−" : "") + fmtCurrency0.format(ov.owed) + '</b></div></div>';
  var groups = GROUPS.map(function(g){
    var rows = state.accounts.map(function(a, i){ return { a: a, i: i }; }).filter(function(x){ return g.types.indexOf(x.a.type) !== -1; });
    if(!rows.length) return "";
    return '<div class="acct-group"><div class="acct-group-title">' + g.title + '</div>' + rows.map(function(x){ return accountRowHtml(x.a, x.i, today); }).join("") + '</div>';
  }).join("");
  var loose = ov.loose.length
    ? '<div class="acct-group acct-loose"><div class="acct-group-title">Balances with no account yet</div>' +
        '<p class="ledger-note" style="margin:0 0 6px">These already count in net worth. Make each an account so it\'s updated here with the rest.</p>' +
        ov.loose.map(function(l){
          return '<div class="acct-loose-row"><span>' + escapeAttr(l.label) + '</span><b class="' + (l.owed ? "owed" : "") + '">' + (l.owed && l.value > 0 ? "−" : "") + fmtCurrency0.format(Math.abs(l.value)) + '</b>' +
            '<button type="button" class="btn btn-sm btn-ghost" data-acct-adopt="' + escapeAttr(l.link) + '" data-acct-adopt-type="' + l.suggest + '">Make it an account</button></div>';
        }).join("") + '</div>'
    : '';
  return head + groups + loose;
}

export function renderAccountsPage(){
  var el = typeof document !== "undefined" && document.getElementById("accountsTable");
  if(el){ el.innerHTML = accountsPageHtml(); renderAccountCharts(el); }
}
// An account's recorded balances as chart points, carried to today. Owed balances stay positive —
// the chart is "what it owes", read with the card's own label.
export function accountChartPoints(a, today){
  today = today || localDateStr();
  var b = accountBalance(a);
  var pts = (b.history || []).filter(function(h){ return h && h.date; }).map(function(h){ return { x: Date.parse(h.date + "T00:00:00"), y: Number(h.value) || 0, dateLabel: h.date }; });
  if(b.balance != null && (!pts.length || pts[pts.length - 1].dateLabel < today)) pts.push({ x: Date.parse(today + "T00:00:00"), y: b.balance, dateLabel: today });
  return pts;
}
function renderAccountCharts(root){
  Array.prototype.forEach.call(root.querySelectorAll("[data-acct-chart]"), function(host){
    var a = state.accounts.find(function(x){ return x.id === host.getAttribute("data-acct-chart"); });
    if(!a) return;
    var pts = accountChartPoints(a);
    if(pts.length < 2){ host.innerHTML = '<p class="ledger-note" style="margin:0">Update the balance now and then and its history draws here.</p>'; return; }
    renderLineChart(host, [{ label: a.name, colorClass: "series-color-0", points: pts }], {
      height: 160, yFormat: function(v){ return fmtCurrency0.format(v); }, xFormat: dateAxisFormat(pts),
      xTickCount: Math.min(5, pts.length), ariaLabel: (a.name || "Account") + " balance over time", baseline: "auto", stepped: true, alwaysLegend: false });
  });
}
