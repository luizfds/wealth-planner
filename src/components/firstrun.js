import { COMMON_COSTS } from "../calc/firstrun.js";
import { escapeAttr } from "../lib/html.js";

// ---------------- The first-run setup sheet (v3.74.0) ----------------
// Five short steps in the app's usual bottom sheet. Answers are held here until Finish; nothing is
// written before then, so closing half-way leaves the app as it was.
export var firstRun = { open: false, step: 0, answers: null };
export function startFirstRun(){
  firstRun.open = true; firstRun.step = 0;
  firstRun.answers = { people: [{ name: "", age: "", pay: "", payFreq: "Yearly" }], accounts: [{ name: "Everyday", type: "everyday", balance: "" }, { name: "Savings", type: "savings", balance: "" }, { name: "Credit card", type: "credit", balance: "" }],
    housing: { kind: "rent", amount: "", freq: "Weekly" }, own: { property: false, shares: false }, costs: COMMON_COSTS.map(function(c){ return { what: c.what, amount: "" }; }) };
}
var STEPS = ["Who's in the household?", "Your accounts", "Your pay", "Home and everyday costs", "Bring in your spending"];

function field(label, attr, value, type, extra){
  return '<label class="fr-field"><span>' + label + '</span><input type="' + (type || "text") + '" ' + attr + ' value="' + escapeAttr(value == null ? "" : value) + '"' + (extra || "") + '></label>';
}
export function firstRunHtml(){
  var a = firstRun.answers, st = firstRun.step, body = "";
  if(st === 0){
    body = '<p class="fr-lede">The people whose money this is. Their pay comes next; tax and super are worked out from it.</p>' +
      a.people.map(function(p, i){
        return '<div class="fr-row">' + field("Name", 'data-fr="people.' + i + '.name"', p.name, "text", ' placeholder="' + (i === 0 ? "You" : "Partner") + '"') + field("Age", 'data-fr="people.' + i + '.age"', p.age, "number", ' min="16" max="100"') + '</div>';
      }).join("") + (a.people.length < 2 ? '<button type="button" class="btn btn-sm btn-ghost" data-fr-add-person>+ Add a partner</button>' : '');
  } else if(st === 1){
    body = '<p class="fr-lede">Where your money sits, and roughly what\'s in each today — rename or remove any. For a card, what it owes.</p>' +
      a.accounts.map(function(x, i){
        return '<div class="fr-row fr-acct">' + field("Name", 'data-fr="accounts.' + i + '.name"', x.name) +
          '<label class="fr-field"><span>Type</span><select data-fr="accounts.' + i + '.type">' + [["everyday", "Everyday"], ["savings", "Savings"], ["offset", "Offset"], ["credit", "Credit card"]].map(function(o){ return '<option value="' + o[0] + '"' + (x.type === o[0] ? " selected" : "") + '>' + o[1] + '</option>'; }).join("") + '</select></label>' +
          field(x.type === "credit" ? "Owes $" : "Balance $", 'data-fr="accounts.' + i + '.balance"', x.balance, "number", ' step="1"') +
          '<button type="button" class="btn btn-danger btn-sm" data-fr-del-acct="' + i + '" aria-label="Remove this account">✕</button></div>';
      }).join("") + '<button type="button" class="btn btn-sm btn-ghost" data-fr-add-acct>+ Another account</button>';
  } else if(st === 2){
    body = '<p class="fr-lede">Pay before tax. Leave it blank to fill in later on Cash flow → Income.</p>' +
      a.people.filter(function(p){ return String(p.name || "").trim(); }).map(function(p){
        var i = a.people.indexOf(p);
        return '<div class="fr-row">' + field(escapeAttr(p.name) + "'s pay before tax $", 'data-fr="people.' + i + '.pay"', p.pay, "number", ' step="100"') +
          '<label class="fr-field"><span>Per</span><select data-fr="people.' + i + '.payFreq">' + ["Yearly", "Monthly", "Fortnightly", "Weekly"].map(function(f){ return '<option' + (p.payFreq === f ? " selected" : "") + '>' + f + '</option>'; }).join("") + '</select></label></div>';
      }).join("") || '<p class="ledger-note">Go back and add a name first.</p>';
  } else if(st === 3){
    var h = a.housing;
    body = '<p class="fr-lede">Roughly what each costs. Blank ones are skipped; everything can be changed on Cash flow → Budget.</p>' +
      '<div class="fr-row"><label class="fr-field"><span>Home</span><select data-fr="housing.kind"><option value="rent"' + (h.kind === "rent" ? " selected" : "") + '>Rent</option><option value="loan"' + (h.kind === "loan" ? " selected" : "") + '>Home loan</option><option value="none"' + (h.kind === "none" ? " selected" : "") + '>Neither</option></select></label>' +
        field("$", 'data-fr="housing.amount"', h.amount, "number") +
        '<label class="fr-field"><span>Per</span><select data-fr="housing.freq">' + ["Weekly", "Fortnightly", "Monthly"].map(function(f){ return '<option' + (h.freq === f ? " selected" : "") + '>' + f + '</option>'; }).join("") + '</select></label></div>' +
      '<div class="fr-costs">' + a.costs.map(function(c, i){ return field(escapeAttr(c.what) + " — a month $", 'data-fr="costs.' + i + '.amount"', c.amount, "number"); }).join("") + '</div>' +
      // v3.161.0 (item 191): what else the household has — a part left unticked stays out of the way until one is added.
      '<div class="fr-own"><span>Do you also have</span>' +
        '<label class="pref-check"><input type="checkbox" data-fr="own.property"' + (a.own && a.own.property ? " checked" : "") + '> An investment property (or own your home)</label>' +
        '<label class="pref-check"><input type="checkbox" data-fr="own.shares"' + (a.own && a.own.shares ? " checked" : "") + '> Shares, ETFs or crypto</label></div>';
  } else {
    // v3.117.0: statements are the main path — three months of them and the budget builds itself.
    body = '<p class="fr-lede">The quickest way in: download your last three months of statements (CSV or PDF — most banks have "Export" or "Download transactions") and import them. Well-known shops file themselves, the budget is proposed from what you actually spent (Cash flow → Budget), and a payslip on Tax fills in pay and tax so far.</p>' +
      '<p class="ledger-note">After that, a monthly review on Home keeps it current in about ten minutes.</p>';
  }
  var last = st === STEPS.length - 1;
  return '<div class="review-backdrop" data-fr-backdrop><div class="review-panel fr-panel" role="dialog" aria-modal="true" aria-label="Set up Wealth Planner">' +
    '<div class="review-head"><h4>' + STEPS[st] + '</h4><button type="button" class="icon-btn" data-fr-close aria-label="Close">✕</button></div>' +
    '<div class="fr-progress" aria-hidden="true">' + STEPS.map(function(_, i){ return '<i class="' + (i <= st ? "on" : "") + '"></i>'; }).join("") + '</div>' +
    '<div class="fr-step-k">Step ' + (st + 1) + ' of ' + STEPS.length + '</div>' + body +
    '<div class="fr-foot">' + (st > 0 ? '<button type="button" class="btn btn-ghost" data-fr-back>Back</button>' : '<span></span>') +
      (last ? '<div class="fr-finish"><button type="button" class="btn btn-ghost" data-fr-finish="home">Finish</button><button type="button" class="btn btn-primary" data-fr-finish="import">Finish and import statements</button></div>'
        : '<button type="button" class="btn btn-primary" data-fr-next>Next</button>') + '</div></div></div>';
}
