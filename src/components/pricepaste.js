// ---------------- Pasted share prices: review before writing (#265) ----------------
//
// Investments → Shares → Prices → "Or paste prices by hand". Review prices reads the box into a review
// (calc/pricepaste.js) and writes nothing; the review names each holding with its current and new price,
// the exchange rate and benchmark rows, and every line left out with why. Update writes only what the
// review showed: it reads the box again against the household and, if the holdings changed meanwhile (a
// price read landed, a holding was deleted, the household was replaced), shows the new review instead.
// Success is said once the save is seen to happen; a save that doesn't is taken back out. Undo puts the
// previous prices back unless something has priced those holdings since.
//
// The panel is drawn inside the Shares page (assets.js pricePastePanelHtml), so a redraw of that page
// draws it again from the review held here.
import { reviewPricePaste, priceReviewCount, priceReviewSignature, applyPriceReview, undoPriceReview, BIG_CHANGE } from "../calc/pricepaste.js";
import { fmtCurrency2, localDateStr } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";
import { showToast, showUndoToast } from "../lib/toast.js";
import { redrawTouched } from "../lib/views.js";
import { state, commit, onSaved, onStateReplaced } from "../state.js";

var TOUCHED = ["assets", "fx", "benchmark"];
var SHOWN = 12;
// { text, data, status: "review" | "unsaved", note } — session only.
var review = null;
var saves = 0;
onSaved(function(){ saves++; });

export function pricePasteText(){ return review ? review.text : ""; }
export function pricePasteOpen(){ return !!review; }

function plural(n, one, many){ return n + " " + (n === 1 ? one : many); }
function pct(change){ return (change > 0 ? "+" : change < 0 ? "−" : "") + Math.abs(Math.round(change * 1000) / 10) + "%"; }
function priceText(v){ return v == null ? "none yet" : fmtCurrency2.format(v); }

// The review panel's contents for `r` ({ data, status, note }), or "" with no review. Pure.
export function pricePastePanelHtml(r){
  if(r === undefined) r = review;
  if(!r) return "";
  var d = r.data, n = priceReviewCount(d);
  var status = r.status === "unsaved"
    ? "<b>Not saved — no prices were changed.</b> This browser couldn't save the household just now (the status in the header says why), so the prices were put back. The review is kept: try again once saving works, or cancel."
    : n ? "<b>" + plural(n, "price", "prices") + " to update</b>" + (d.leftOut.length ? " · " + d.leftOut.length + " left out" : "") + ". Nothing changes until you update."
      : "<b>Nothing to update</b> from what's pasted" + (d.leftOut.length ? " — " + plural(d.leftOut.length, "line", "lines") + " left out, below" : "") + ".";
  var html = '<p class="ledger-note row-import-status' + (r.status === "unsaved" || !n ? " is-warn" : "") + '" role="status" tabindex="-1" data-price-review-status>' + status + "</p>";
  if(r.note) html += '<p class="ledger-note row-import-note">' + escapeAttr(r.note) + "</p>";
  var rows = [];
  d.updates.forEach(function(u){
    u.holdings.forEach(function(h){
      var big = h.change != null && Math.abs(h.change) > BIG_CHANGE;
      rows.push("<tr><td>" + escapeAttr(u.symbol) + "</td><td>" + escapeAttr(h.what || u.symbol) + (h.person ? " · " + escapeAttr(h.person) : "") + " (" + escapeAttr(h.market) + ')</td><td class="num">' + priceText(h.was) +
        '</td><td class="num">' + fmtCurrency2.format(u.price) + '</td><td class="num' + (big ? " price-review-big" : "") + '">' + (h.change == null ? "—" : pct(h.change)) + (big ? " · check" : "") + "</td></tr>");
    });
  });
  if(d.fx) rows.push('<tr><td>USDAUD</td><td>USD → AUD exchange rate</td><td class="num">' + (d.fx.was ? escapeAttr(String(d.fx.was)) : "none yet") + '</td><td class="num">' + escapeAttr(String(d.fx.price)) + '</td><td class="num">' + (d.fx.was ? pct(d.fx.price / d.fx.was - 1) : "—") + "</td></tr>");
  d.benchmarks.forEach(function(b){
    rows.push("<tr><td>" + escapeAttr(b.symbol) + "</td><td>Benchmark, " + (b.date === "now" ? "today" : escapeAttr(b.date)) + '</td><td class="num">—</td><td class="num">' + fmtCurrency2.format(b.price) + '</td><td class="num">—</td></tr>');
  });
  if(rows.length){
    html += '<div class="table-scroll row-import-table" role="region" aria-label="Prices to update; scroll sideways for every column" tabindex="0"><table class="import-preview-table"><thead><tr>' +
      '<th scope="col">Ticker</th><th scope="col">Holding</th><th scope="col" class="num">Now</th><th scope="col" class="num">New</th><th scope="col" class="num">Change</th></tr></thead><tbody>' +
      rows.slice(0, SHOWN).join("") + "</tbody></table></div>" +
      (rows.length > SHOWN ? '<p class="ledger-note row-import-more">and ' + (rows.length - SHOWN) + " more</p>" : "");
    if(d.updates.some(function(u){ return u.big; })) html += '<p class="ledger-note row-import-note">A change over ' + Math.round(BIG_CHANGE * 100) + "% is marked to check — a quantity or a price in cents pasted by mistake looks like this. It's updated all the same if you go ahead.</p>";
  }
  if(d.leftOut.length){
    html += '<div class="row-import-dups"><p class="ledger-note"><b>Left out</b></p><ul class="row-import-errors">' +
      d.leftOut.slice(0, SHOWN).map(function(l){ return "<li>Line " + l.line + (l.symbol ? " (" + escapeAttr(l.symbol) + ")" : "") + ": " + escapeAttr(l.reason) + "</li>"; }).join("") +
      (d.leftOut.length > SHOWN ? "<li>and " + (d.leftOut.length - SHOWN) + " more</li>" : "") + "</ul></div>";
  }
  html += '<div class="row-import-actions">' +
    (n ? '<button type="button" class="btn btn-sm btn-primary" data-price-review-confirm>' + (r.status === "unsaved" ? "Try again" : "Update " + plural(n, "price", "prices")) + "</button>" : "") +
    '<button type="button" class="btn btn-sm btn-ghost" data-price-review-cancel>Cancel</button></div>';
  return html;
}

function panel(){ return document.getElementById("sharesPasteReview"); }
function draw(focus){
  var p = panel();
  if(!p) return;
  p.hidden = !review;
  p.innerHTML = pricePastePanelHtml();
  if(focus){ var s = p.querySelector("[data-price-review-status]"); if(s) s.focus(); }
}
function open(text, note){
  review = { text: text, data: reviewPricePaste(text, state), status: "review", note: note || "" };
  review.signature = priceReviewSignature(review.data);
}
function cancel(){
  review = null;
  draw();
  var area = document.getElementById("sharesPasteArea");
  if(area) area.focus();
}

function confirm(){
  if(!review) return;
  var again = reviewPricePaste(review.text, state);
  if(review.data.household !== state || priceReviewSignature(again) !== review.signature){
    open(review.text, review.data.household !== state
      ? "The household changed since this review, so it was reviewed again against the one open now."
      : "Your holdings or their prices changed since this review (a price read, an edit), so it was reviewed again. Check it before updating.");
    draw(true);
    return;
  }
  if(!priceReviewCount(review.data)) return;
  var before = saves;
  var record = applyPriceReview(review.data, state, localDateStr());
  commit(TOUCHED);
  if(saves === before){
    undoPriceReview(record, state);
    redrawTouched(TOUCHED);
    review.status = "unsaved";
    draw(true);
    return;
  }
  var d = review.data, res = record.result;
  review = null;
  var area = document.getElementById("sharesPasteArea");
  if(area) area.value = "";
  draw();
  // The same count the review gave: holdings, the rate and benchmark prices together.
  var parts = [];
  if(res.updated) parts.push(plural(res.updated, "holding", "holdings"));
  if(res.fxUpdated) parts.push("USD/AUD rate");
  if(res.benchmarks) parts.push(plural(res.benchmarks, "benchmark", "benchmarks"));
  showUndoToast(plural(res.updated + (res.fxUpdated ? 1 : 0) + res.benchmarks, "price", "prices") + " updated" +
      (parts.length > 1 ? " (" + parts.join(", ") + ")" : "") + (d.leftOut.length ? " · " + d.leftOut.length + " left out" : ""),
    function(){
      var undone = undoPriceReview(record, state);
      if(!undone.ok){
        showToast(undone.reason === "replaced" ? "Can't undo — the household has been replaced since"
          : "Can't undo — " + plural(undone.changed, "price has", "prices have") + " been updated again since. The newer prices stay.");
        return;
      }
      commit(TOUCHED);
    });
}

export function wirePricePaste(){
  onStateReplaced(function(){
    if(!review) return;
    open(review.text, "The household changed since this review, so it was reviewed again against the one open now.");
    draw();
  });
  document.addEventListener("click", function(e){
    var t = e.target;
    if(!t.closest) return;
    if(t.closest("#sharesPasteApply")){
      var area = document.getElementById("sharesPasteArea");
      var text = area ? area.value : "";
      if(!text.trim()){ showToast("Paste a Symbol and a Price on each line first"); if(area) area.focus(); return; }
      open(text);
      draw(true);
      return;
    }
    if(t.closest("[data-price-review-cancel]")){ cancel(); return; }
    if(t.closest("[data-price-review-confirm]")) confirm();
  });
  // A review is of the text it read: typing in the box puts it away until it's reviewed again.
  document.addEventListener("input", function(e){
    if(review && e.target && e.target.id === "sharesPasteArea"){ review = null; draw(); }
  });
}
