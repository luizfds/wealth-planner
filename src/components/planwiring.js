// ---------------- Plan, wired (v3.206.1, item 237) ----------------
//
// Projections' assumptions and sliders, life events, the projection as CSV, what-ifs you can drag and Plan →
// Retirement.
// Moved out of app.js as it was, listener for listener; app.js calls each wire…() where its listeners used to be
// added, so they're added in the same order.
import { recalcComputedItems, currentScenario } from "../calc/engine.js";
import { whatIfMoved, keepWhatIf } from "../calc/whatif.js";
import { exportProjectionCsv } from "../lib/backup.js";
import { fmtCurrency0 } from "../lib/format.js";
import { showToast } from "../lib/toast.js";
import { state, persist, genId } from "../state.js";
import { renderGoalsTab } from "./accountswiring.js";
import { renderDetail } from "./dashboard.js";
import { lifeEventsHtml, addLifeEvent, setLifeEventField, removeLifeEvent } from "./lifeevents.js";
import { showPage, showAssetsSubpage, showPlanSubpage } from "./nav.js";
import { renderProjectionOutputs, renderWhatIfDrag, projectionSeriesShown } from "./projections.js";
import { renderAll } from "./redraw.js";
import { retirementHtml, retireLevers } from "./retirement.js";
import { whatIfValues, resetWhatIf, wiFromSlider, wiValueText } from "./whatif.js";
import { defineSection } from "../lib/sections.js";
import { renderHomeListModern, modernHomeRowOpen } from "./scenarios.js";
import { renderSharedGroups } from "./expenses.js";
import { scenarioActions } from "./scenariowiring.js";
import { readInput } from "../lib/validate.js";

var leBody, whatIfStrip, wiFrame, retireBody, RT_FMT;

// ---------------- A scenario's home costs, registered (v3.206.2, item 237b) ----------------
// "home:<scenario>": the scenario's home rows. Today's — the household's own scenario — are Budget lines too.
defineSection("home", {
  qualified: true,
  rows: function(name){ return state.home[name]; },
  redraw: function(name){
    renderHomeListModern(name, state.scenarios.indexOf(name));
    // The active scenario's housing is also listed on the Budget tab (see budgetLineSources),
    // so it has two renderers to keep in step — the Scenarios block above and the budget list.
    if(name === currentScenario()) renderSharedGroups();
  },
  inBudget: function(name){ return name === currentScenario(); },
  editor: { container: "homeBody", openState: modernHomeRowOpen },
  homeTotals: true
});


// Pairs each projection number input with a same-range slider: dragging the slider
// writes into the number input and fires its native "input" event so the existing
// handler above stays the single source of truth for updating state; typing in the
// number input keeps the slider's thumb in sync going the other way.
// ---------------- Reading the projection's number fields (#263) ----------------
// Each assumption is saved only when it reads as a value its rule allows (lib/validate.js, docs/design/validation.md):
// a cleared rate isn't 0%, and a horizon outside 1–50 or a negative shock is said, not clamped. Rates may be negative.
var PROJ_RULES = {
  projHorizon: { empty: "Enter how many years to project.", min: 1, max: 50, range: "Enter from 1 to 50 years." },
  projInvestRate: { empty: "Enter a return — 0 for none." },
  projPropertyRate: { empty: "Enter a growth rate — 0 for none." },
  projInflationRate: { empty: "Enter an inflation rate — 0 for none." },
  projIncomeGrowth: { empty: "Enter a growth rate — 0 for none." },
  projRateShock: { empty: "Enter the shock — 0 for none.", min: 0, range: "A shock can't be negative." },
  projInvestVol: { empty: "Enter the spread — 0 for none.", min: 0, range: "A spread can't be negative." },
  projPropertyVol: { empty: "Enter the spread — 0 for none.", min: 0, range: "A spread can't be negative." }
};
function readProj(input){ return readInput(input, PROJ_RULES[input.id]); }
// A life event's figures: the year it starts and how many years it runs are needed; the amount may be negative.
var LIFE_RULES = {
  year: { empty: "Enter the year it starts." },
  years: { empty: "Enter how many years — at least 1.", min: 1, range: "At least 1 year." },
  amount: { empty: "Enter the amount — 0 if none." }
};

function pairSlider(numberId, sliderId){
  var numberInput = document.getElementById(numberId);
  var slider = document.getElementById(sliderId);
  if(!numberInput || !slider) return;
  slider.value = numberInput.value;
  slider.addEventListener("input", function(){
    numberInput.value = slider.value;
    numberInput.dispatchEvent(new Event("input", { bubbles: true }));
  });
  // The slider follows only a figure that's saved: one that doesn't read leaves it where the saved value is.
  numberInput.addEventListener("input", function(){
    if(numberInput.getAttribute("aria-invalid") !== "true") slider.value = numberInput.value;
  });
}
// v3.126.0: life events under the projection's assumptions.
function renderLifeEvents(){ var el = document.getElementById("lifeEventsBody"); if(el) el.innerHTML = lifeEventsHtml(); }
// Both halves of the basis control in one place: the segmented button's pressed state, and the
// sentence next to it that says what the choice actually means. Called on load and on every
// change, rather than rebuilt inside renderProjectionOutputs(), because the control is static
// markup in index.html — only its state moves.
function syncProjBasisControl(){
  var real = state.projection.realTerms !== false;
  var group = document.getElementById("projBasis");
  if(group){
    group.querySelectorAll("[data-proj-basis]").forEach(function(btn){
      var on = (btn.getAttribute("data-proj-basis") === "real") === real;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-pressed", String(on));
    });
  }
  var note = document.getElementById("projBasisNote");
  if(note){
    note.textContent = real
      ? "Deflated " + (Number(state.projection.inflationRate) || 0) + "% a year."
      : "Not adjusted for inflation.";
  }
}
// ---------------- Plan → Retirement (v3.73.0) ----------------
function renderRetirement(){
  var el = document.getElementById("retirementBody");
  if(el) el.innerHTML = retirementHtml();
}

export function wireProjections(){
  // ---------------- Long-term projection ----------------
  document.getElementById("projHorizon").addEventListener("input", function(e){
    var h = readProj(e.target);
    if(!h) return;
    state.projection.horizonYears = Math.floor(h.value);
    renderProjectionOutputs();
    persist();
  });
  document.getElementById("projInvestRate").addEventListener("input", function(e){
    var r = readProj(e.target);
    if(!r) return;
    state.projection.investReturnRate = r.value;
    renderProjectionOutputs();
    persist();
  });
  document.getElementById("projPropertyRate").addEventListener("input", function(e){
    var r = readProj(e.target);
    if(!r) return;
    state.projection.propertyAppreciationRate = r.value;
    renderProjectionOutputs();
    persist();
  });
  document.getElementById("projInflationRate").addEventListener("input", function(e){
    var r = readProj(e.target);
    if(!r) return;
    state.projection.inflationRate = r.value;
    // The basis note quotes this rate ("deflated by 3% a year"), so it goes stale otherwise.
    syncProjBasisControl();
    renderProjectionOutputs();
    persist();
  });
  document.getElementById("projIncomeGrowth").addEventListener("input", function(e){
    var r = readProj(e.target);
    if(!r) return;
    state.projection.incomeGrowthRate = r.value;
    renderProjectionOutputs();
    persist();
  });  // Not an assumption but a unit — it doesn't change the plan, only which dollars it's reported
  // in, so it re-renders the outputs without touching anything the model computes from.
  document.getElementById("projBasis").addEventListener("click", function(e){
    var btn = e.target.closest("[data-proj-basis]");
    if(!btn) return;
    state.projection.realTerms = btn.getAttribute("data-proj-basis") === "real";
    syncProjBasisControl();
    renderProjectionOutputs();
    persist();
  });
  document.getElementById("projSourceRow").addEventListener("click", function(e){
    var btn = e.target.closest("[data-proj-source]");
    if(!btn || btn.disabled) return;
    state.projection.source = btn.getAttribute("data-proj-source") === "actuals" ? "actuals" : "plan";
    renderProjectionOutputs();
    renderDetail();
    persist();
  });
  document.getElementById("projRateShock").addEventListener("input", function(e){
    var r = readProj(e.target);
    if(!r) return;
    state.projection.rateShockPct = r.value;
    renderProjectionOutputs();
    persist();
  });
  pairSlider("projInvestRate", "projInvestRateRange");
  pairSlider("projPropertyRate", "projPropertyRateRange");
  pairSlider("projInflationRate", "projInflationRateRange");
  pairSlider("projIncomeGrowth", "projIncomeGrowthRange");
  pairSlider("projRateShock", "projRateShockRange");
  leBody = document.getElementById("lifeEventsBody");
  leBody.addEventListener("click", function(e){
    var add = e.target.closest("[data-le-add]");
    if(add){ var ev = addLifeEvent(add.getAttribute("data-le-add")); persist(); renderLifeEvents(); renderProjectionOutputs();
      var f = leBody.querySelector('[data-le-id="' + ev.id + '"] [data-le-field="what"]'); if(f){ f.focus(); f.select(); } return; }
    var rm = e.target.closest("[data-le-remove]");
    if(rm){ removeLifeEvent(rm.getAttribute("data-le-remove")); persist(); renderLifeEvents(); renderProjectionOutputs(); }
  });
  leBody.addEventListener("change", function(e){
    var k = e.target.getAttribute("data-le-field"), row = e.target.closest("[data-le-id]");
    if(!k || !row) return;
    if(LIFE_RULES[k] && !readInput(e.target, LIFE_RULES[k])) return;
    if(setLifeEventField(row.getAttribute("data-le-id"), k, e.target.value)){
      persist(); renderProjectionOutputs();
      // Re-sorted by year — after this event finishes, since a click elsewhere can fire this change
      // (on the blur) in the middle of its own redraw.
      if(k === "year") setTimeout(renderLifeEvents, 0);
    }
  });
  pairSlider("projInvestVol", "projInvestVolRange");
  pairSlider("projPropertyVol", "projPropertyVolRange");  // v3.125.0: the spread of returns behind the shaded range.
  ["projInvestVol", "projPropertyVol"].forEach(function(id){
    document.getElementById(id).addEventListener("input", function(e){
      var r = readProj(e.target);
      if(!r) return;
      state.projection[id === "projInvestVol" ? "investVolatility" : "propertyVolatility"] = r.value;
      renderProjectionOutputs(); renderRetirement();
      persist();
    });
  });
}

export function wireProjectionCsv(){  // v3.34.0: the projection, every year, as a CSV.
  document.addEventListener("click", function(e){
    if(e.target.closest("#projCsvBtn")) exportProjectionCsv(projectionSeriesShown(), state.projection.realTerms !== false);
  });
}

export function wireWhatIfs(){
  // ---------------- What-ifs you can drag (v3.177.0, item 204) ----------------
  whatIfStrip = document.getElementById("whatIfStrip");
  wiFrame = 0;
  whatIfStrip.addEventListener("input", function(e){
    var k = e.target.getAttribute && e.target.getAttribute("data-wi");
    if(!k) return;
    var w = whatIfValues();
    w[k] = wiFromSlider(k, e.target.value);
    var lab = whatIfStrip.querySelector('[data-wi-val="' + k + '"]');
    if(lab) lab.textContent = wiValueText(k, w[k], w);
    var moved = whatIfMoved(w);
    whatIfStrip.querySelectorAll("[data-wi-keep], [data-wi-reset]").forEach(function(b){ b.disabled = !moved; });
    // #255: the view's one primary, and only while there is something to keep.
    whatIfStrip.querySelectorAll("[data-wi-keep]").forEach(function(b){ b.classList.toggle("btn-primary", moved); });
    if(wiFrame) return;
    wiFrame = requestAnimationFrame(function(){ wiFrame = 0; renderWhatIfDrag(); });
  });  // Let go: the table, milestones and the rest catch up.
  whatIfStrip.addEventListener("change", function(e){ if(e.target.getAttribute && e.target.getAttribute("data-wi")) renderProjectionOutputs(); });
  whatIfStrip.addEventListener("click", function(e){
    if(e.target.closest("[data-wi-reset]")){ resetWhatIf(); whatIfStrip.innerHTML = ""; renderProjectionOutputs(); return; }
    if(!e.target.closest("[data-wi-keep]")) return;
    var w = whatIfValues();
    if(!whatIfMoved(w)) return;
    var made = keepWhatIf(currentScenario(), w, function(){ return genId("chg"); });
    resetWhatIf();
    whatIfStrip.innerHTML = "";
    recalcComputedItems();
    scenarioActions.afterScenarioChange();
    showToast('Kept as "' + made + '" — it\'s on Plan → Scenarios, and on the chart');
  });
}

export function wireRetirement(){  retireBody = document.getElementById("retirementBody");
  RT_FMT = { retireAge: function(v){ return v; } };
  retireBody.addEventListener("input", function(e){
    var k = e.target.getAttribute("data-rt");
    if(!k) return;
    var out = retireBody.querySelector('[data-rt-out="' + k + '"]');
    if(out) out.textContent = RT_FMT[k] ? RT_FMT[k](Number(e.target.value)) : fmtCurrency0.format(Number(e.target.value));
  });
  retireBody.addEventListener("change", function(e){
    var k = e.target.getAttribute("data-rt");
    if(k){
      retireLevers[k] = Number(e.target.value);
      renderRetirement();
      var again = retireBody.querySelector('[data-rt="' + k + '"]');
      if(again) again.focus();
      return;
    }
    var fk = e.target.getAttribute("data-rt-fire");
    if(fk){
      if(!state.fire) state.fire = {};
      state.fire[fk] = e.target.value === "" ? null : Number(e.target.value);
      persist(); renderAll();
    }
  });
  retireBody.addEventListener("click", function(e){
    var g = e.target.closest("[data-rt-go]");
    if(!g) return;
    if(g.getAttribute("data-rt-go") === "super"){ showPage("assets"); showAssetsSubpage("Super", { replace: true }); }
    else { showPage("plan"); showPlanSubpage("goals", { replace: true }); renderGoalsTab(); }
  });
}

export { renderLifeEvents, renderRetirement, syncProjBasisControl };
