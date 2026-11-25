import { wireFurnishing } from "./furnishing.js";
// ---------------- Money → Trips: its listeners (November 2026) ----------------
//
// Plan a trip, change or remove one, and answer the purchases on its days. Every edit commits what it touched — trips,
// and transactions for an answer — and that commit is the redraw (decision 0007).
import { state, commit } from "../state.js";
import { withUndo } from "./redraw.js";
import { removeTrip, answerTrips } from "../calc/trips.js";
import { renderTrips, tripsUi, tripToConfirm } from "./trips.js";
import { showToast } from "../lib/toast.js";

export function wireTrips(){
  var body = document.getElementById("tripsBody");
  wireFurnishing(body, renderTrips);
  body.addEventListener("click", function(e){
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
