import { state } from "../state.js";
import { getTaxPeople, personTaxSettings, todayTaxFy, wfhRateForFy, computePersonTax } from "../calc/tax.js";
import { fyLabel } from "../calc/property.js";
import { personReferences, ageOn } from "../calc/people.js";
import { localDateStr } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";

// ---------------- Accounts → People (v3.44.0) ----------------
//
// The details the app needs about each person, in one place: their name (renamed everywhere at
// once), date of birth, HELP balance, super cap and carry-forward, capital losses brought forward
// and working-from-home hours per year. These used to sit behind "Adjust…" on each tax card, which
// is a planning view; they're facts about the person, so they live here and the tax card links to
// them. Salary sacrifice and the top-up stay on the tax card — those are this year's choices.

function field(label, inner, title){
  return '<div class="proj-field"><label' + (title ? ' title="' + escapeAttr(title) + '"' : '') + '>' + label + '</label>' + inner + '</div>';
}
function numInput(cls, person, value, aria, step){
  return '<input type="number" min="0" step="' + (step || 500) + '" class="pp-in ' + cls + '" data-pp-person="' + escapeAttr(person) + '" aria-label="' + escapeAttr(aria) + '" value="' + (Number(value) || 0) + '">';
}

function usesText(ref){
  var bits = [];
  bits.push(ref.incomeRows + " income row" + (ref.incomeRows === 1 ? "" : "s"));
  ref.properties.forEach(function(p){ bits.push(p.pct + "% of " + escapeAttr(p.what)); });
  if(ref.assets) bits.push(ref.assets + " asset" + (ref.assets === 1 ? "" : "s"));
  if(ref.deductibleLines) bits.push(ref.deductibleLines + " deductible line" + (ref.deductibleLines === 1 ? "" : "s"));
  if(ref.taxYears.length) bits.push("returns for " + ref.taxYears.map(fyLabel).join(", "));
  return bits.join(" · ");
}

export function personCardHtml(person, index, today){
  var st = personTaxSettings(person);
  var pid = escapeAttr(person);
  var age = ageOn(st.dateOfBirth, today);
  var thisFy = todayTaxFy(today);
  var hours = [];
  for(var fy = thisFy - 3; fy <= thisFy; fy++){
    var rate = wfhRateForFy(fy);
    var h = st.wfhHours && st.wfhHours[fy] != null ? st.wfhHours[fy] : "";
    hours.push('<div class="proj-field pp-hours"><label for="pp-wfh-' + index + '-' + fy + '">' + fyLabel(fy) + ' <small>' + Math.round(rate.rate * 100) + 'c/h</small></label>' +
      '<input type="number" min="0" step="1" id="pp-wfh-' + index + '-' + fy + '" class="pp-in pp-wfh" data-pp-person="' + pid + '" data-fy="' + fy + '" aria-label="Hours worked from home in ' + fyLabel(fy) + ' for ' + pid + '" value="' + h + '" placeholder="0"></div>');
  }
  return '<div class="pp-card" data-pp-card="' + pid + '">' +
    '<div class="pp-head"><span class="m-avatar series-color-' + (index % 8) + '" aria-hidden="true">' + escapeAttr(person.charAt(0).toUpperCase()) + '</span>' +
      '<input type="text" class="pp-name" data-pp-person="' + pid + '" value="' + pid + '" aria-label="Name" title="Renaming updates every income row, holding, property share, budget line and tax year that names them">' +
      (age != null ? '<span class="pp-age">' + age + '</span>' : '') +
      '<button type="button" class="icon-btn icon-del" data-pp-remove="' + pid + '" aria-label="Remove ' + pid + ' from tax" title="Remove from tax — their income rows go back to Net">✕</button></div>' +
    '<p class="pp-uses">' + usesText(personReferences(person)) + '</p>' +
    '<div class="tax-inputs pp-fields">' +
      field("Date of birth", '<input type="date" class="pp-in pp-dob" data-pp-person="' + pid + '" aria-label="Date of birth for ' + pid + '" value="' + escapeAttr(st.dateOfBirth || "") + '">',
        "Used for the private health rebate (higher from 65 and 70), preservation age, and comparing super and net worth with people the same age on Home → Benchmarks.") +
      field("HELP/HECS owing $", numInput("pp-help", person, st.helpBalance, "HELP/HECS owing for " + person),
        "What's still owed on a study loan. The compulsory repayment is worked out from this and comes out of take-home.") +
      field("Concessional cap $/yr", numInput("pp-cap", person, st.concessionalCap, "Concessional cap per year for " + person)) +
      field("Carry-forward available $", numInput("pp-carry", person, st.carryForward, "Carry-forward available for " + person),
        "Unused cap from the last five years, available while the total super balance was under $500,000 on 30 June last year — myGov shows it.") +
      field("Capital losses b/f $", numInput("pp-losses", person, st.capitalLossCarriedForward, "Capital losses carried forward for " + person, 100),
        "Net capital losses from earlier years, as on the last notice of assessment.") +
      field("Hours worked a week", '<input type="number" min="0" max="168" step="0.5" class="pp-in pp-week" data-pp-person="' + pid + '" aria-label="Hours worked a week for ' + pid + '" value="' + (st.hoursPerWeek != null && st.hoursPerWeek !== "" ? st.hoursPerWeek : "") + '" placeholder="38">',
        "What Cash flow → Income divides by when it's shown per hour. Empty counts as 38.") +
    '</div>' +
    // v3.145.0: only for someone a rental's loss saves tax for — whether their pay already has it.
    (ownsRentalLoss(person) ? '<label class="pp-variation"><input type="checkbox" class="pp-in pp-var" data-pp-person="' + pid + '"' + (st.withholdingVariation ? " checked" : "") + '> ' +
      '<span>Pay already allows for the rental’s loss <small>— a PAYG withholding variation, so less tax comes out of each pay. Unticked, the tax it saves is planned as a refund after lodging, not in the monthly take-home.</small></span></label>' : '') +
    '<div class="pp-hours-wrap"><div class="tax-inputs-label">Hours worked from home</div><div class="pp-hours-row">' + hours.join("") + '</div></div>' +
  '</div>';
}

function ownsRentalLoss(person){ try { return computePersonTax(person).ipTaxEffect > 0.5; } catch(e){ return false; } }

export function peopleHtml(today){
  today = today || localDateStr();
  var people = getTaxPeople();
  if(!people.length) return '<p class="ledger-note" style="margin:0">Nobody yet. A person appears once an income row is marked Gross and names them — or add one below.</p>';
  return '<div class="pp-list">' + people.map(function(p, i){ return personCardHtml(p, i, today); }).join("") + '</div>';
}

export function renderPeople(){
  var el = document.getElementById("peopleTable");
  if(el) el.innerHTML = peopleHtml();
}

// Field → setting. Number fields are clamped at zero; the date of birth is kept as typed.
export function setPersonField(person, cls, value, fy){
  var st = personTaxSettings(person);
  var n = Math.max(0, parseFloat(value) || 0);
  if(cls === "pp-dob") st.dateOfBirth = value || "";
  else if(cls === "pp-help") st.helpBalance = n;
  else if(cls === "pp-cap") st.concessionalCap = n;
  else if(cls === "pp-carry") st.carryForward = n;
  else if(cls === "pp-losses") st.capitalLossCarriedForward = n;
  // v3.138.0: hours a week, for income per hour; empty goes back to the 38 it's read as.
  else if(cls === "pp-var"){ if(value === true || value === "true") st.withholdingVariation = true; else delete st.withholdingVariation; }
  else if(cls === "pp-week"){ if(value === "" || value == null) delete st.hoursPerWeek; else st.hoursPerWeek = Math.min(168, n); }
  else if(cls === "pp-wfh"){
    if(!st.wfhHours || typeof st.wfhHours !== "object") st.wfhHours = {};
    if(value === "" || value == null) delete st.wfhHours[fy]; else st.wfhHours[fy] = n;
  }
  else return false;
  return true;
}

// The household-level total the People tab heads with: who's in it and how many dates of birth are
// still missing (Benchmarks and the rebate need them).
export function peopleSummaryText(){
  var people = getTaxPeople();
  var missing = people.filter(function(p){ return !(state.tax.settings[p] && state.tax.settings[p].dateOfBirth); });
  return people.length + " " + (people.length === 1 ? "person" : "people") + (missing.length ? " · " + missing.length + " without a date of birth" : "");
}
