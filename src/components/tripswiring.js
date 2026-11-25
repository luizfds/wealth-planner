// ---------------- Money → Trips: its listeners (November 2026) ----------------
//
// Plan a trip, change or remove one, and answer the purchases on its days. Every edit commits what it touched — trips,
// and transactions for an answer — and that commit is the redraw (decision 0007).
import { state, commit, genId } from "../state.js";
import { parseAmountInput } from "../lib/format.js";
import { showToast } from "../lib/toast.js";
import { withUndo } from "./redraw.js";
import { addTrip, updateTrip, removeTrip, answerTrips, tripStatus } from "../calc/trips.js";
import { renderTrips, tripsUi, tripToConfirm } from "./trips.js";
import { localDateStr } from "../lib/format.js";

function readForm(form){
  var q = function(sel){ var x = form.querySelector(sel); return x ? x.value.trim() : ""; };
  var from = q("[data-trip-from]"), to = q("[data-trip-to]");
  var budget = parseAmountInput(q("[data-trip-budget]"));
  return { name: q("[data-trip-name]"), from: from, to: to || from, month: from ? "" : q("[data-trip-month]"), budget: budget == null ? 0 : budget, lineId: q("[data-trip-line]") };
}
function check(fields, form){
  if(!fields.name){ showToast("Give the trip a name"); var n = form.querySelector("[data-trip-name]"); if(n) n.focus(); return false; }
  if(!fields.lineId){ showToast("Pick the line the trip is paid from"); return false; }
  if(!(fields.budget >= 0)){ showToast("A budget can't be negative"); return false; }
  return true;
}

export function wireTrips(){
  var body = document.getElementById("tripsBody");
  body.addEventListener("click", function(e){
    var save = e.target.closest("[data-trip-save]");
    if(save){
      var form = save.closest("[data-trip-form]"), key = save.getAttribute("data-trip-save");
      var fields = readForm(form);
      if(!check(fields, form)) return;
      if(key === "new"){
        var trip = addTrip(state, fields, function(){ return genId("trip"); });
        commit(["trips"]);
        var n = tripStatus(trip, localDateStr()) === "planning" ? 0 : tripToConfirm(trip).length;
        if(n){ tripsUi.confirming = trip.id; renderTrips(); }
        showToast("Planned " + trip.name + (n ? " — " + n + " purchase" + (n === 1 ? "" : "s") + " on its days to confirm" : ""));
      } else {
        updateTrip(state, key, fields);
        tripsUi.editing = "";
        commit(["trips"]);
        showToast("Saved " + fields.name);
      }
      return;
    }
    if(e.target.closest("[data-trip-cancel]")){ tripsUi.editing = ""; renderTrips(); return; }
    var edit = e.target.closest("[data-trip-edit]");
    if(edit){
      var eid = edit.getAttribute("data-trip-edit");
      tripsUi.editing = tripsUi.editing === eid ? "" : eid;
      renderTrips();
      var first = tripsUi.editing && body.querySelector('[data-trip-form="' + CSS.escape(eid) + '"] [data-trip-name]');
      if(first) first.focus();
      return;
    }
    var conf = e.target.closest("[data-trip-confirm]");
    if(conf){
      var cid = conf.getAttribute("data-trip-confirm");
      tripsUi.confirming = tripsUi.confirming === cid ? "" : cid;
      renderTrips();
      return;
    }
    var yes = e.target.closest("[data-trip-yes]"), no = e.target.closest("[data-trip-no]"), all = e.target.closest("[data-trip-all]");
    if(yes || no){
      var b = yes || no, tid = b.getAttribute(yes ? "data-trip-yes" : "data-trip-no");
      answerTrips(state, tid, [b.getAttribute("data-trip-tx")], !!yes);
      commit(["transactions"]);
      return;
    }
    if(all){
      var aid = all.getAttribute("data-trip-all");
      var t = state.trips.find(function(x){ return x.id === aid; });
      if(!t) return;
      var ids = tripToConfirm(t).map(function(x){ return x.id; });
      answerTrips(state, aid, ids, true);
      tripsUi.confirming = "";
      commit(["transactions"]);
      showToast(ids.length + " filed to " + t.name);
      return;
    }
    var del = e.target.closest("[data-trip-del]");
    if(del){
      var id = del.getAttribute("data-trip-del");
      var trip2 = state.trips.find(function(x){ return x.id === id; });
      if(!trip2) return;
      withUndo("Removed the trip “" + trip2.name + "” — its purchases stay on their lines", function(){ removeTrip(state, id); renderTrips(); });
    }
  });
  renderTrips();
}
