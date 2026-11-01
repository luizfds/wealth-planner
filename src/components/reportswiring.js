// ---------------- Reports, wired (v3.206.1, item 237) ----------------
//
// Reports: choosing, pinning, printing and CSV.
// Moved out of app.js as it was, listener for listener; app.js calls each wire…() where its listeners used to be
// added, so they're added in the same order. What it shares with app.js it reaches through `app` (lib/appctx.js).
import { shiftMonth as mdShiftMonth } from "../calc/monthdetail.js";
import { exportTableCsv } from "../lib/backup.js";
import { localDateStr } from "../lib/format.js";
import { showToast } from "../lib/toast.js";
import { persist } from "../state.js";
import { monthDetailUi, shownMonth as mdShownMonth } from "./monthdetail.js";
import { renderMonthReview } from "./monthreview.js";
import { showPage, showDashboardSubpage, showTaxSubpage } from "./nav.js";
import { renderReports, reportShown, reportPrintHtml, reportCsv, reportFrame, pinReport, openSavedReport, unpinReport } from "./reports.js";
import { printStatic } from "./taxwiring.js";
import { renderTaxYear } from "./taxyear.js";
import { yearEndPrintHtml, yearEndDocumentsCsv } from "./yearend.js";



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
    var pick = e.target.closest("[data-report]");
    if(pick){ reportShown.key = pick.getAttribute("data-report"); renderReports(); return; }
    // v3.124.0: pinned reports.
    var saved = e.target.closest("[data-report-saved]");
    if(saved){ if(openSavedReport(saved.getAttribute("data-report-saved"))) renderReports(); return; }
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
