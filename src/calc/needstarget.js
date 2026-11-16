// ---------------- The take-home it would take for Needs to be a target share (#389) ----------------
//
// The scenario comparison (components/budgetcomparison.js, from scenarioBudgetComposition) shows a normal month's
// take-home and what goes to Needs. This answers the question a purchase raises: how much take-home would it take
// for Needs to be at most a target share of it again — 50% by default, Home's 50/30/20 benchmark, or the
// household's own (state.needsTarget).
//
// The share is of regular monthly take-home, the comparison's own figure: annual income (a bonus, a tax refund) is
// left out, and loan repayments count as Needs once. Needs stay as they are; more take-home is room for Wants,
// savings and what's left over. It's take-home, after tax — a pay rise before tax would have to be larger.
//
// needsTargetFor({ needs, income }, targetPct) →
//   { target, needs, income, share (Needs ÷ take-home, or null), required, more, increase (more ÷ take-home, or
//     null), state }
//   state: "met"      — Needs are within the target; more is 0
//          "short"    — more take-home is needed
//          "over"     — Needs are more than the whole take-home; `cover` is what it takes just to pay them
//          "noIncome" — no take-home to measure against; required is the whole take-home needed
//          "noNeeds"  — nothing classed as Needs; there's nothing to measure
export var NEEDS_TARGET_DEFAULT = 50;

// A target as the household saved it, or the default: a percentage above 0 and at most 100.
export function needsTargetPct(st){
  var t = Number(st && st.needsTarget);
  return t > 0 && t <= 100 ? t : NEEDS_TARGET_DEFAULT;
}

// Sets the household's target; the caller saves it with commit(["needsTarget"]). Returns whether it changed.
export function setNeedsTarget(st, pct){
  var t = Number(pct);
  if(!(t > 0 && t <= 100) || st.needsTarget === t) return false;
  st.needsTarget = t;
  return true;
}

function r2(n){ return Math.round(n * 100) / 100 || 0; }

export function needsTargetFor(comp, targetPct){
  var target = Number(targetPct) > 0 && Number(targetPct) <= 100 ? Number(targetPct) : NEEDS_TARGET_DEFAULT;
  var needs = Number(comp && comp.needs) || 0, income = Number(comp && comp.income) || 0;
  var out = { target: target, needs: r2(needs), income: r2(income), share: null, required: 0, more: 0, increase: null, cover: 0, state: "met" };
  if(!(needs > 0)){ out.state = "noNeeds"; return out; }
  out.required = r2(needs / (target / 100));
  if(!(income > 0)){
    out.state = "noIncome";
    out.more = out.required;
    return out;
  }
  out.share = needs / income;
  out.more = r2(Math.max(0, out.required - income));
  out.increase = out.more / income;
  if(needs > income){ out.state = "over"; out.cover = r2(needs - income); }
  else out.state = out.more > 0 ? "short" : "met";
  return out;
}
