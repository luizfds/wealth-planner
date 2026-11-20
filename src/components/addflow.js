// ---------------- Adding something, one question at a time: drawing a question (November 2026) ----------------
//
// One question a screen, a big answer, Next; the answers so far under it; Skip on what can wait; a last screen to check
// everything, any line of it going back to its question. The order and the sums are calc/addflow.js; the dialog and
// its listeners addflowwiring.js. Adding only — editing is the floating-label form.
import { escapeAttr } from "../lib/html.js";
import { fieldHtml, pillsHtml, formatMoney } from "../lib/field.js";
import { fmtCurrency0, fmtDate } from "../lib/format.js";
import { flowSteps, liveLine, stepSkippable, suggestedLoan, repaymentEstimate } from "../calc/addflow.js";

// The dialog's session: which flow, which question, what's been answered. Context the flow needs from the household
// (a scenario's purchase plans, the loans an offset can sit against) is read when it opens.
export var addFlowUi = { flow: "", step: 0, answers: {}, error: "", returnToCheck: false, plans: [], loans: [], anyLoan: false };

var PROPERTY_KINDS = [
  { value: "PPOR", title: "A home I live in", sub: "Its value, its loan, when it's paid off", icon: "⌂", tone: "home" },
  { value: "IP", title: "An investment property", sub: "Plus rent, costs and tax", icon: "⌂", tone: "invest" },
  { value: "buying", title: "One I'm buying now", sub: "Deposit, costs and settlement, until it's yours", icon: "✎", tone: "buying" }
];
var ACCOUNT_KINDS = [
  { value: "everyday", title: "Everyday", sub: "Where your pay lands and bills go out", icon: "$", tone: "home" },
  { value: "savings", title: "Savings", sub: "Money put aside", icon: "↑", tone: "good" },
  { value: "offset", title: "Offset", sub: "Linked to a home loan", icon: "⇄", tone: "buying" },
  { value: "credit", title: "Credit card", sub: "What you owe on it", icon: "−", tone: "bad" }
];

function money(v){ return fmtCurrency0.format(Number(String(v == null ? "" : v).replace(/[\s,$]/g, "")) || 0); }
function has(v){ return v != null && String(v).trim() !== ""; }

function choicesHtml(key, list, value, disabled){
  return '<div class="af-choices" role="radiogroup" aria-labelledby="addFlowQ">' + list.map(function(c, i){
    var off = disabled && disabled[c.value];
    return '<label class="af-choice' + (off ? " is-off" : "") + '"><input type="radio" name="af-' + key + '" id="af-' + key + "-" + i + '" value="' + escapeAttr(c.value) + '" data-af="' + key + '"' +
      (String(value) === String(c.value) ? " checked" : "") + (off ? " disabled" : "") + '>' +
      (c.icon ? '<span class="af-ic af-ic-' + c.tone + '" aria-hidden="true">' + c.icon + '</span>' : '') +
      '<span class="af-choice-text"><b>' + escapeAttr(c.title) + '</b>' + (off || c.sub ? '<small>' + escapeAttr(off || c.sub) + '</small>' : '') + '</span></label>';
  }).join("") + '</div>';
}
// The one big answer: a name, or an amount with "$" before it (or a unit after).
function bigHtml(key, value, o){
  o = o || {};
  var isMoney = o.money;
  return '<div class="af-big-wrap' + (o.pre ? " has-pre" : "") + '">' + (o.pre ? '<span class="af-pre" aria-hidden="true">' + escapeAttr(o.pre) + '</span>' : '') +
    '<input type="text" id="af-' + key + '" class="field-control af-big' + (isMoney || o.number ? " af-num" : "") + '" data-af="' + key + '" value="' + escapeAttr(isMoney ? formatMoney(value == null ? "" : value) : (value == null ? "" : value)) + '"' +
    (isMoney || o.number ? ' inputmode="decimal" autocomplete="off"' : ' autocomplete="off"') + (isMoney ? " data-money" : "") +
    (o.placeholder ? ' placeholder="' + escapeAttr(o.placeholder) + '"' : '') + ' aria-labelledby="addFlowQ" aria-describedby="addFlowSub addFlowError addFlowLive">' +
    (o.unit ? '<span class="af-unit" aria-hidden="true">' + escapeAttr(o.unit) + '</span>' : '') + '</div>';
}
function chipsHtml(list){
  return list.length ? '<div class="af-chips">' + list.map(function(c){
    return '<button type="button" class="af-chip" data-af-chip="' + escapeAttr(c.key) + '" data-af-value="' + escapeAttr(c.value) + '">' + escapeAttr(c.label) + '</button>';
  }).join("") + '</div>' : "";
}
function box(key, label, value, o){
  return fieldHtml(Object.assign({ id: "af-" + key, label: label, box: true, value: value == null ? "" : value, attrs: { "data-af": key } }, o || {}));
}

// What a question asks: { title, sub, body } — body the control(s).
function questionFor(flow, step, a, ui){
  if(flow === "account"){
    if(step === "kind"){
      var noLoan = ui.loans.length ? null : { offset: ui.anyLoan ? "Every loan has its offset account already" : "Add a home loan first — an offset sits against one" };
      return { title: "What kind of account?", sub: "So it's counted in the right place.", body: choicesHtml("kind", ACCOUNT_KINDS, a.kind, noLoan) };
    }
    if(step === "name") return { title: "What's it called?", sub: "The bank and the account, as you'd say it.", body: bigHtml("name", a.name, { placeholder: "e.g. Bank One Everyday" }) };
    if(step === "loan") return { title: "Which loan is it against?", sub: "Its balance comes off the interest on this loan.",
      body: choicesHtml("loanId", ui.loans.map(function(l){ return { value: l.id, title: l.label, sub: l.sub }; }), a.loanId) };
    return { title: a.kind === "credit" ? "What do you owe on it?" : "What's in it today?", sub: "Importing its statements later keeps it up to date.",
      body: bigHtml("balance", a.balance, { money: true, pre: "$", placeholder: "0" }) };
  }
  var buying = a.kind === "buying";
  if(step === "kind") return { title: "What kind of property?", sub: "It changes what the app works out for you — rent and tax only for an investment.", body: choicesHtml("kind", PROPERTY_KINDS, a.kind) };
  if(step === "name"){
    var chips = a.kind === "PPOR" ? ["Home", "Our place"] : a.kind === "IP" ? ["Investment property"] : ["New home"];
    return { title: "What do you call it?", sub: "Just for you — a street, a suburb, or \"Home\".", body: bigHtml("name", a.name, { placeholder: "e.g. 1 Example St" }) +
      chipsHtml(chips.map(function(c){ return { key: "name", value: c, label: c }; })) };
  }
  if(step === "use") return { title: "Is it to live in, or an investment?", sub: "An investment gets rent, costs and tax once it's settled.",
    body: choicesHtml("use", [PROPERTY_KINDS[0], PROPERTY_KINDS[1]], a.use || "PPOR") };
  if(step === "bought") return { title: "When did you buy it, and for how much?", sub: "For its capital gain and how it's grown. Skip it if you'd rather add it later.",
    body: '<div class="fgrid">' + box("price", "Price paid", a.price, { type: "money" }) + box("bought", "Bought on", a.bought, { type: "date" }) + '</div>' };
  if(step === "value") return { title: "What's it worth today?", sub: "A rough figure is fine — a recent sale nearby, or a bank's estimate. You can update it any time.",
    body: bigHtml("value", a.value, { money: true, pre: "$", placeholder: "0" }) + chipsHtml(has(a.price) ? [{ key: "value", value: a.price, label: "Same as I paid" }] : []) };
  if(step === "hasLoan") return { title: "Is there a loan on it?", sub: "Yes asks three things about it.",
    body: choicesHtml("hasLoan", [{ value: "yes", title: "Yes" }, { value: "no", title: "No, it's paid off" }], a.hasLoan === true ? "yes" : a.hasLoan === false ? "no" : "") };
  if(step === "loanBalance") return { title: "How much is owing?", sub: "Today's balance, from your banking app.", body: bigHtml("balance", a.balance, { money: true, pre: "$", placeholder: "0" }) };
  if(step === "loanRate") return { title: "What's the interest rate?", sub: "It's on your statement or in your banking app. A fixed rate's end date goes on the loan once it's added.",
    body: bigHtml("rate", a.rate, { number: true, unit: "% a year", placeholder: "0.00" }) };
  if(step === "loanRepay") return { title: "How do you pay it off?", sub: "The repayment is worked out for you — you can type your own on the loan later.",
    body: pillsHtml({ id: "af-repaymentType", label: "Repayments", name: "af-repaymentType", value: a.repaymentType || "PI", attrs: { "data-af": "repaymentType" },
      options: [{ value: "PI", label: "Principal & interest" }, { value: "IO", label: "Interest only" }] }) +
      '<div class="fgrid af-gap">' + box("termYears", "Years left", has(a.termYears) ? a.termYears : 30, { type: "text", unit: "yrs", attrs: { "data-af": "termYears", inputmode: "numeric" } }) + '</div>' +
      pillsHtml({ id: "af-freq", label: "Paid", name: "af-freq", value: a.freq || "Monthly", attrs: { "data-af": "freq" },
        options: [{ value: "Weekly", label: "Weekly" }, { value: "Fortnightly", label: "Fortnightly" }, { value: "Monthly", label: "Monthly" }] }) };
  if(buying && step === "priceDeposit") return { title: "What's the price, and the deposit you've paid?", sub: "Then: when it settles, and the loan.",
    body: '<div class="fgrid">' + box("price", "Price", a.price, { type: "money" }) + box("deposit", "Deposit paid", a.deposit, { type: "money" }) + '</div>' +
      chipsHtml(ui.plans.map(function(x){ return { key: "plan", value: x.name, label: "Start from " + x.name }; })) };
  if(step === "settlement") return { title: "When does it settle?", sub: "The day it becomes yours. Skip it if there's no date yet.",
    body: '<div class="fgrid">' + box("settlementDate", "Settlement", a.settlementDate, { type: "date", wide: true }) + '</div>' };
  if(step === "buyLoan") return { title: "How much are you borrowing, and at what rate?", sub: "From the loan offer. Its fees go on the purchase's costs once it's added.",
    body: '<div class="fgrid">' + box("loanAmount", "Loan", has(a.loanAmount) ? a.loanAmount : (suggestedLoan(a) || ""), { type: "money" }) +
      box("rate", "Rate", a.rate, { unit: "%", attrs: { "data-af": "rate", inputmode: "decimal" } }) + '</div>' };
  return { title: "Ready to add", sub: "Tap anything to change it.", body: checkHtml(a) };
}

// The last screen: every answer, grouped, each a way back to its question.
function checkHtml(a){
  var row = function(step, k, v){ return has(v) ? '<button type="button" class="af-sum-row" data-af-goto="' + step + '"><span>' + k + '</span><b>' + escapeAttr(v) + '</b></button>' : ''; };
  var kind = { PPOR: "A home I live in", IP: "An investment property", buying: "Buying it now" }[a.kind] || "";
  if(a.kind === "buying"){
    return '<p class="af-sum-h">The purchase</p><div class="af-sum">' +
      row("kind", "Kind", kind + (a.use === "IP" ? " · to invest" : " · to live in")) + row("name", "Name", a.name) +
      row("priceDeposit", "Price", has(a.price) ? money(a.price) : "") + row("priceDeposit", "Deposit paid", has(a.deposit) ? money(a.deposit) : "") +
      row("priceDeposit", "Plan", a.plan || "") + row("settlement", "Settles", has(a.settlementDate) ? fmtDate(a.settlementDate, { year: true }) : "") +
      row("buyLoan", "Loan", has(a.loanAmount) ? money(a.loanAmount) + (has(a.rate) ? " at " + a.rate + "%" : "") : "") + '</div>' +
      '<p class="af-note">Its costs — stamp duty, the conveyancer, the lender\'s fees — are on its card once it\'s added.</p>';
  }
  var est = repaymentEstimate(a);
  return '<p class="af-sum-h">The property</p><div class="af-sum">' + row("kind", "Kind", kind) + row("name", "Name", a.name) +
      row("value", "Worth", has(a.value) ? money(a.value) : "") +
      row("bought", "Bought", has(a.price) || has(a.bought) ? [has(a.price) ? money(a.price) : "", has(a.bought) ? fmtDate(a.bought, { year: true }) : ""].filter(Boolean).join(" · ") : "") + '</div>' +
    (a.hasLoan === true ? '<p class="af-sum-h">Its loan</p><div class="af-sum">' + row("loanBalance", "Owing", money(a.balance)) +
      row("loanRate", "Rate", has(a.rate) ? a.rate + "%" : "") +
      row("loanRepay", "Repayments", (a.repaymentType === "IO" ? "Interest only" : "Principal & interest") + (est > 0 ? " · ≈ " + money(est) + "/mo" : "")) + '</div>' +
      '<p class="af-note">An offset, a fixed term and its tax details go on the loan once it\'s added.</p>'
    : '<div class="af-sum">' + row("hasLoan", "Loan", a.hasLoan === false ? "None" : "") + '</div>');
}

// The answers so far, small, under a question — not on the first question or the last.
function soFarHtml(flow, step, a){
  if(step === "kind" || step === "check") return "";
  var lines = [];
  var add = function(k, v){ if(has(v)) lines.push('<div><span>' + k + '</span><b>' + escapeAttr(v) + '</b></div>'); };
  if(flow === "account") add("Kind", (ACCOUNT_KINDS.find(function(k){ return k.value === a.kind; }) || {}).title);
  else add("Kind", (PROPERTY_KINDS.find(function(k){ return k.value === a.kind; }) || {}).title);
  if(step !== "name") add("Name", a.name);
  if(step !== "value" && step !== "bought" && has(a.value)) add("Worth", money(a.value));
  if(step !== "loanBalance" && has(a.balance) && flow !== "account") add("Owing", money(a.balance));
  if(step !== "loanRate" && step !== "buyLoan" && has(a.rate)) add("Rate", a.rate + "%");
  if(step !== "priceDeposit" && step !== "bought" && has(a.price)) add("Price", money(a.price));
  return lines.length ? '<div class="af-ans">' + lines.join("") + '</div>' : "";
}

// The whole of the dialog's content for the current question.
export function addFlowHtml(ui){
  ui = ui || addFlowUi;
  var a = ui.answers || {}, steps = flowSteps(ui.flow, a), i = Math.max(0, Math.min(ui.step, steps.length - 1)), step = steps[i];
  var q = questionFor(ui.flow, step, a, ui);
  // A loan's three questions count on their own ("Its loan · 1 of 3"); the property's count stays as it was.
  var isLoan = /^loan[A-Z]/.test(step), loanSteps = steps.filter(function(s){ return /^loan[A-Z]/.test(s); });
  var counted = steps.filter(function(s){ return s !== "check" && !/^loan[A-Z]/.test(s); }), n = counted.length, at = counted.indexOf(step);
  var last = i === steps.length - 1;
  var heading = ui.flow === "account" ? (has(a.name) && step !== "name" ? a.name : "New account")
    : (has(a.name) && step !== "name" ? a.name : a.kind === "buying" ? "Buying a home" : "New property");
  var live = liveLine(step, a, function(x){ return fmtCurrency0.format(x); });
  var nextLabel = last ? (ui.flow === "account" ? "Add account" : a.kind === "buying" ? "Add the purchase" : "Add " + (a.name || "property")) : ui.returnToCheck ? "Done" : "Next";
  return '<div class="af-top"><span class="af-what">' + escapeAttr(heading) + '</span><button type="button" class="af-x" data-af-close aria-label="Close">✕</button></div>' +
    '<div class="af-prog" aria-hidden="true">' + (isLoan ? loanSteps : counted).map(function(s, k){
      return '<i' + (k <= (isLoan ? loanSteps.indexOf(step) : at === -1 ? n - 1 : at) ? ' class="on"' : '') + '></i>'; }).join("") + '</div>' +
    '<form class="af-form" data-af-form data-af-step="' + step + '" novalidate>' +
      (isLoan ? '<p class="af-step">Its loan · ' + (loanSteps.indexOf(step) + 1) + ' of ' + loanSteps.length + '</p>' : at !== -1 ? '<p class="af-step">' + (at + 1) + ' of ' + n + '</p>' : '') +
      '<h2 class="af-q" id="addFlowQ" tabindex="-1">' + escapeAttr(q.title) + '</h2>' +
      '<p class="af-sub" id="addFlowSub">' + escapeAttr(q.sub) + '</p>' +
      q.body +
      '<p class="af-error field-error" id="addFlowError" aria-live="polite">' + escapeAttr(ui.error || "") + '</p>' +
      '<p class="af-live" id="addFlowLive" aria-live="polite">' + escapeAttr(live) + '</p>' +
      soFarHtml(ui.flow, step, a) +
      '<div class="af-nav">' + (i > 0 ? '<button type="button" class="btn af-back" data-af-back>Back</button>' : '') +
        (stepSkippable(step) && !last ? '<button type="button" class="btn btn-ghost af-skip" data-af-skip>Skip</button>' : '') +
        '<button type="submit" class="btn btn-primary af-next" data-af-next>' + escapeAttr(nextLabel) + '</button></div>' +
    '</form>';
}
