// ---------------- Reports, wired (v3.206.1, item 237) ----------------
//
// Reports: choosing, pinning, printing and CSV.
// Moved out of app.js as it was, listener for listener; app.js calls each wire…() where its listeners used to be
// added, so they're added in the same order.
import { shiftMonth as mdShiftMonth } from "../calc/monthdetail.js";
import { shareTableCsv, exportTableCsv } from "../lib/backup.js";
import { localDateStr } from "../lib/format.js";
import { showToast } from "../lib/toast.js";
import { persist, commit } from "../state.js";
import { monthDetailUi, shownMonth as mdShownMonth } from "./monthdetail.js";
import { renderMonthReview } from "./monthreview.js";
import { showPage, showDashboardSubpage, showTaxSubpage } from "./nav.js";
import { renderReports, reportShown, reportPrintHtml, reportCsv, reportFrame, pinReport, openSavedReport, unpinReport, reportChooserResultsHtml, rememberReport } from "./reports.js";
import { pushActiveOverlay, requestCloseActiveOverlay } from "../lib/overlaystack.js";
import { printStatic } from "./taxwiring.js";
import { renderTaxYear } from "./taxyear.js";
import { yearEndPrintHtml, yearEndDocumentsCsv } from "./yearend.js";

var reportChooser = null;
export function openReportChooser(){
  if(reportChooser) return;
  var dialog = document.createElement('dialog');
  dialog.className = 'app-dialog report-chooser';
  dialog.setAttribute('aria-labelledby', 'reportChooserTitle');
  dialog.innerHTML = '<div class="rp-chooser-head"><h2 id="reportChooserTitle">Choose a report</h2><button type="button" class="icon-btn" data-report-chooser-close aria-label="Close report chooser">✕</button></div>' +
    '<label class="app-dialog-field"><span>Search reports</span><input type="search" class="field-control" data-report-search placeholder="Search by name or purpose"></label>' +
    '<p class="visually-hidden" role="status" data-report-search-status></p><div class="rp-chooser-results"></div>';
  var search = dialog.querySelector('[data-report-search]'), results = dialog.querySelector('.rp-chooser-results');
  function draw(){
    results.innerHTML = reportChooserResultsHtml(search.value);
    dialog.querySelector('[data-report-search-status]').textContent = results.querySelectorAll('[data-report], [data-report-saved], [data-report-recent]').length + ' choices found';
  }
  var selection = null;
  document.body.appendChild(dialog);
  reportChooser = dialog;
  pushActiveOverlay(function(){
    dialog.close(); dialog.remove(); reportChooser = null;
    if(selection){
      if(selection.saved) openSavedReport(selection.saved);
      else reportShown.key = selection.key;
      rememberReport(reportShown.key);
      renderReports();
    }
    var opener = document.querySelector('#reportsBody [data-report-choose]');
    if(opener && opener.getClientRects().length) opener.focus({preventScroll:true});
  });
  var close = function(){ requestCloseActiveOverlay(); };
  dialog.addEventListener('keydown', function(e){
    e.stopPropagation();
    if(e.key === 'Escape'){ e.preventDefault(); close(); return; }
    if(e.key !== 'Tab') return;
    var stops = Array.from(dialog.querySelectorAll('button,input,select,textarea,a[href],[tabindex]')).filter(function(el){ return !el.disabled && el.tabIndex >= 0 && el.getClientRects().length; });
    var first = stops[0], last = stops[stops.length - 1];
    if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
    else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
  });
  dialog.addEventListener('cancel', function(e){ e.preventDefault(); close(); });
  dialog.addEventListener('input', function(e){ if(e.target === search) draw(); });
  dialog.addEventListener('click', function(e){
    if(e.target.closest('[data-report-chooser-close]')){ close(); return; }
    if(e.target.closest('[data-report-search-clear]')){ search.value = ''; draw(); search.focus(); return; }
    var pick = e.target.closest('[data-report], [data-report-recent], [data-report-saved]');
    if(pick){ selection = pick.hasAttribute('data-report-saved') ? {saved:pick.getAttribute('data-report-saved')} : {key:pick.getAttribute('data-report') || pick.getAttribute('data-report-recent')}; close(); return; }
    var unpin = e.target.closest('[data-report-unpin]');
    if(unpin){ unpinReport(unpin.getAttribute('data-report-unpin')); commit(['savedReports']); draw(); search.focus(); return; }
    var rect = dialog.getBoundingClientRect();
    if(e.target === dialog && (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom)) close();
  });
  draw(); dialog.showModal(); search.focus();
}


export function wireReports(){
  // ---------------- Reports (v3.62.0) ----------------
  // v3.118.0: the frame — period, comparison, grouping.
  document.getElementById("reportsBody").addEventListener("change", function(e){
    var k = e.target.getAttribute && e.target.getAttribute("data-rf");
    if(!k) return;
    reportFrame[k] = e.target.value;
    if(k === "group" || k === "range") reportFrame.open = {};
    if(k === "range" && e.target.value === "custom" && !reportFrame.from){ var t0 = localDateStr(); reportFrame.to = t0; reportFrame.from = (Number(t0.slice(0, 4)) - 1) + t0.slice(4); }
    renderReports();
  });
  document.getElementById("reportsBody").addEventListener("click", function(e){
    if(e.target.closest('[data-report-choose]')){ openReportChooser(); return; }
    var pick = e.target.closest("[data-report]");
    if(pick){ reportShown.key = pick.getAttribute("data-report"); rememberReport(reportShown.key); renderReports(); return; }
    // v3.124.0: pinned reports.
    var saved = e.target.closest("[data-report-saved]");
    if(saved){ if(openSavedReport(saved.getAttribute("data-report-saved"))){ rememberReport(reportShown.key); renderReports(); } return; }
    var unpin = e.target.closest("[data-report-unpin]");
    if(unpin){ unpinReport(unpin.getAttribute("data-report-unpin")); persist(); renderReports(); return; }
    if(e.target.closest("[data-report-pin]")){ var pinned = pinReport(); if(pinned){ persist(); showToast("Pinned: " + pinned.name); } else showToast("Already pinned."); renderReports(); return; }
    // v3.118.0: a group row opens (or closes) the transactions behind it.
    var drill = e.target.closest("[data-rf-drill]");
    if(drill){ var dk = drill.getAttribute("data-rf-drill"); reportFrame.open[dk] = !reportFrame.open[dk]; renderReports(); return; }
    // v3.81.0: Month in detail.
    var mdOpen = e.target.closest("[data-md-open]");
    if(mdOpen){ monthDetailUi.ym = mdOpen.getAttribute("data-md-open"); monthDetailUi.open = {}; reportShown.key = "month"; renderReports(); return; }
    var mdStep = e.target.closest("[data-md-step]");
    if(mdStep){ monthDetailUi.ym = mdShiftMonth(mdShownMonth(), Number(mdStep.getAttribute("data-md-step"))); monthDetailUi.open = {}; renderReports(); return; }
    var mdCat = e.target.closest("[data-md-cat]");
    if(mdCat){ var cn = mdCat.getAttribute("data-md-cat"); monthDetailUi.open[cn] = !monthDetailUi.open[cn]; renderReports(); return; }
    if(e.target.closest("[data-report-print]")){ printStatic(reportPrintHtml()); return; }
    if(e.target.closest("[data-report-share]")){ var shared = reportCsv(); shareTableCsv(shared.filename, shared.headers, shared.rows); return; }
    if(e.target.closest("[data-report-csv]")){ var c = reportCsv(); exportTableCsv(c.filename, c.headers, c.rows); return; }
    // Year-end pack (v3.68.0)
    if(e.target.closest("[data-ye-print]")){ printStatic(yearEndPrintHtml()); return; }
    if(e.target.closest("[data-ye-tx]")){ document.getElementById("exportYearTransactionsBtn").click(); return; }
    if(e.target.closest("[data-ye-docs]")){ var d = yearEndDocumentsCsv(); exportTableCsv(d.filename, d.headers, d.rows); return; }
    var go = e.target.closest("[data-ye-go]");
    if(go){
      var where = go.getAttribute("data-ye-go");
      if(where === "review"){ showPage("dashboard"); showDashboardSubpage("review"); renderMonthReview(); return; }
      showPage("tax");
      showTaxSubpage(where === "documents" ? "documents" : "returns", { replace: true });
      renderTaxYear();
      if(where === "close"){
        var close = document.querySelector("#taxYearBody .ty-close");
        if(close){ close.open = true; setTimeout(function(){ close.scrollIntoView({ behavior: "smooth", block: "start" }); }, 80); }
        else showToast("Close the year appears on Returns once the year is over");
      }
    }
  });
}
