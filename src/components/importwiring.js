// ---------------- Bringing data in, wired (v3.206.1, item 237) ----------------
//
// A payslip, spreadsheets for expenses, income and assets, a bank CSV or PDF, and statements from a folder.
// Moved out of app.js as it was, listener for listener; app.js calls each wire…() where its listeners used to be
// added, so they're added in the same order.
import { inboxMessage } from "../calc/inbox.js";
import { periodsOf } from "../calc/ledger.js";
import { parsePayslip, payFrequency } from "../calc/payslip.js";
import { payslipCheck } from "../calc/payslipcheck.js";
import { statementFromLines, statementCsv } from "../calc/pdfstatement.js";
import { logIncomeReceived, deleteIncomeReceived } from "../calc/received.js";
import { getTaxPeople, personTaxSettings } from "../calc/tax.js";
import { exportExpensesImportTemplateCsv, exportIncomeImportTemplateCsv, exportAssetsImportTemplateCsv } from "../lib/backup.js";
import { dropboxConnected } from "../lib/dropbox.js";
import { fmtDate } from "../lib/format.js";
import { listInbox, readInboxFile, markInboxFileImported } from "../lib/inbox.js";
import { pdfLines } from "../lib/pdftext.js";
import { savedFolder } from "../lib/safekeeping.js";
import { showToast, showUndoToast, showPersistentToast } from "../lib/toast.js";
import { state, persist } from "../state.js";
import { parseAssetsImportCsv, renderAssetsImportPreview } from "./assets.js";
import { startBankImport, reparseBankImportWith, clearBankImport, setBankImportGroupLine, setBankImportGroupCategory, renderBankImportPanel, patchBankImportPanel, setIncludePossibleDuplicates, commitBankImport, undoBankImport, setStatementAccount, setStatementBalanceOn, inboxNoteHtml, bankImport } from "./bank-import.js";
import { currentHistoryBudget, renderBudgetFromHistory, renderRecurring } from "./budgettoolswiring.js";
import { renderCards, renderDetail } from "./dashboard.js";
import { renderSharedGroups, renderTransactions, renderActualVsPlannedPanel, renderYearSpending, parseExpensesImportCsv, renderExpensesImportPreview, renderSpendCategoryChart, renderSpendingTrends } from "./expenses.js";
import { renderHomeSummary } from "./home.js";
import { withholdingCheckHtml, payslipRead, salaryRowFor, parseIncomeImportCsv, renderIncomeImportPreview } from "./income.js";
import { showPage, showExpensesSubpage, showTaxSubpage, appAssetUrl } from "./nav.js";
import { renderProjectionOutputs } from "./projections.js";
import { renderReceived } from "./received.js";
import { renderTotals, renderAll } from "./redraw.js";
import { renderTrips, renderTxReviewBanner } from "./spendingwiring.js";
import { chooseInvestmentProperty, openStatementForm, investmentProperties } from "./rentstatement.js";
import { agentStatementFromLines, isAgentStatement, propertyNamedIn } from "../calc/pdfstatement.js";

// Rows read from a spreadsheet, waiting for Import — nothing touches state.shared, state.income or state.assets
// until its confirm button (handled in assetswiring.js's click delegate).
export var pendingImport = { expenses: [], income: [], assets: [] };

var inbox;

// ---------------- A payslip, read (v3.116.0) ----------------
function redrawPayslipPanel(person){
  var host = [].find.call(document.querySelectorAll("[data-tax-person]"), function(el){ return el.getAttribute("data-tax-person") === person; });
  var d = host && host.querySelector(".tax-ytd");
  if(d){ d.outerHTML = withholdingCheckHtml(person); var again = host.querySelector(".tax-ytd"); if(again) again.open = true; }
}
function readPayslipLines(person, lines){
  var r = parsePayslip(lines);
  payslipRead[person] = r.found.length ? r : { error: "Nothing in that reads like a payslip — no Gross, Tax or Net lines with amounts." };
  if(r.found.length) applyPayslipYtd(person, r);
  redrawPayslipPanel(person);
}
// v3.149.0: a payslip with a year-to-date column sets the refund-or-bill check straight away —
// unless what's there is from a later payslip. Undo puts the old figures back.
function applyPayslipYtd(person, r){
  if(r.ytd.gross == null || r.ytd.tax == null || !r.periodEnd) return false;
  var st = personTaxSettings(person), was = st.ytd ? Object.assign({}, st.ytd) : null;
  if(was && was.asOf && was.asOf > r.periodEnd) return false;
  if(was && was.asOf === r.periodEnd && was.gross === r.ytd.gross && was.withheld === r.ytd.tax) return false;
  st.ytd = { asOf: r.periodEnd, gross: r.ytd.gross, withheld: r.ytd.tax };
  persist();
  showUndoToast("Refund-or-bill check updated from the payslip (to " + fmtDate(r.periodEnd) + ")", function(){
    if(was) st.ytd = was; else delete st.ytd;
    persist(); redrawPayslipPanel(person);
  });
  return true;
}
// One way in for a statement file, whether chosen here or shared to the app (v3.93.0).
function importBankFile(file, fromInbox){
  inbox.current = fromInbox || null;
  renderInbox();
  // v3.92.0: a PDF statement is read into the same CSV the import already understands.
  if(/\.pdf$/i.test(file.name) || file.type === "application/pdf"){
    showToast("Reading the PDF…");
    file.arrayBuffer().then(function(buf){ return pdfLines(new Uint8Array(buf)); }).then(function(lines){
      var st = statementFromLines(lines);
      // v3.148.0: a payslip, not a statement — to the payslip check instead.
      if(openAsPayslip(lines, st, fromInbox)) return;
      // v3.208.0 (item 240): a property manager's statement — to its property's statement form, filled in.
      if(openAsAgentStatement(lines, fromInbox)) return;
      if(!st.rows.length){ showToast("Couldn't find transactions in that PDF — a CSV export from your bank will work"); return; }
      startBankImport(statementCsv(st.rows), file.name);
      // v3.149.1: a card's statement (a limit, a minimum payment) with no account picked from its
      // name: the only credit card, so its payment reads as a transfer and its balance can be set.
      var cards = (state.accounts || []).filter(function(a){ return a.type === "credit" && a.name; });
      if(st.card && cards.length === 1 && bankImport && !bankImport.account) setStatementAccount(cards[0].name);
      renderBankImportPanel();
      var card = document.getElementById("bankImportCard");
      if(card) card.scrollIntoView({ behavior: "smooth", block: "start" });
    }).catch(function(){ showToast("Couldn't read that PDF"); });
    return;
  }
  var reader = new FileReader();
  reader.onload = function(){
    var text = String(reader.result);
    // startBankImport holds onto the parsed rows itself, so the date-order control can re-parse
    // without the user having to find the file again.
    startBankImport(text, file.name);
    renderBankImportPanel();
    var card = document.getElementById("bankImportCard");
    if(card) card.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  reader.onerror = function(){ showToast("Couldn't read that file"); };
  reader.readAsText(file);
}
// v3.148.0: a payslip chosen or dropped in Statements reads as one (gross, net, and tax or super,
// and next to no statement rows) — it opens on that person's tax card (Tax → This year), checked
// against the plan.
// Whose: the person it names, else the one whose pay is nearest its gross.
function openAsPayslip(lines, st, fromInbox){
  var text = lines.map(function(l){ return l.cells.map(function(c){ return c.s; }).join("   "); });
  var slip = parsePayslip(text);
  if(!(slip.gross > 0 && slip.net > 0 && (slip.tax != null || slip.super != null)) || st.rows.length > 2) return false;
  var people = getTaxPeople();
  if(!people.length) return false;
  var all = text.join(" ").toLowerCase();
  var named = people.filter(function(p){ return new RegExp("\\b" + p.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b").test(all); });
  var freq = payFrequency(slip);
  var near = function(p){ var row = salaryRowFor(p); return row && freq ? Math.abs(periodsOf(Number(row.amount) || 0, row.freq).yearly - periodsOf(slip.gross, freq).yearly) : Infinity; };
  var person = named.length === 1 ? named[0] : (named.length ? named : people).slice().sort(function(a, b){ return near(a) - near(b); })[0];
  payslipRead[person] = slip;
  applyPayslipYtd(person, slip);
  if(fromInbox) inboxFileDone(fromInbox);
  inbox.current = null; renderInbox();
  // The person's tax card, where the payslip panel lives: Tax → This year.
  showPage("tax");
  showTaxSubpage("year", { replace: true });
  setTimeout(function(){
    redrawPayslipPanel(person);
    var host = [].find.call(document.querySelectorAll("[data-tax-person]"), function(el){ return el.getAttribute("data-tax-person") === person; });
    var d = host && host.querySelector(".tax-ytd");
    if(d) d.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 300);
  showToast("A payslip — checked against " + person + "'s plan");
  return true;
}
function openAsAgentStatement(lines, fromInbox){
  var r = agentStatementFromLines(lines);
  if(!isAgentStatement(r)) return false;
  inbox.current = null; renderInbox();
  var text = lines.map(function(l){ return l.cells.map(function(c){ return c.s; }).join(" "); }).join(" ");
  var go = function(p){
    if(fromInbox) inboxFileDone(fromInbox);
    openStatementForm(p, r);
  };
  var named = propertyNamedIn(text, investmentProperties());
  if(named) go(named); else chooseInvestmentProperty("Which property is this statement for?", go);
  return true;
}
function inboxPlaces(){
  var p = [];
  if(dropboxConnected()) p.push("your Dropbox app folder");
  return savedFolder().then(function(h){ if(h) p.push("the backup folder (" + h.name + ")"); return p; }).catch(function(){ return p; });
}
function renderInbox(){
  var el = document.getElementById("bankInboxNote");
  if(!el) return;
  var html = inboxNoteHtml(inbox.files, inbox.places, inbox.current);
  el.innerHTML = html;
  el.hidden = !html;
}
function checkInbox(announce){
  return Promise.all([listInbox(), inboxPlaces()]).then(function(r){
    inbox.files = r[0]; inbox.places = r[1];
    renderInbox();
    if(announce && inbox.files.length) showPersistentToast(inboxMessage(inbox.files.length, inbox.files[0].label) + ".", "Review", openNextInbox);
  }).catch(function(){});
}
function openNextInbox(){
  var f = inbox.files[0];
  if(!f) return;
  showPage("expenses");
  showExpensesSubpage("spending");
  showToast("Opening " + f.name + "…");
  readInboxFile(f).then(function(file){ importBankFile(file, f); }).catch(function(){ showToast("Couldn't open " + f.name + " — try again in a moment"); });
}
function inboxFileDone(f){
  inbox.current = null;
  inbox.files = inbox.files.filter(function(x){ return x !== f; });
  renderInbox();
  markInboxFileImported(f).catch(function(){ showToast("Imported, but " + f.name + " couldn't be moved to Imported — move it yourself so it isn't offered again"); });
  if(inbox.files.length) setTimeout(function(){
    showPersistentToast(inboxMessage(inbox.files.length, inbox.files[0].label) + ".", "Next", openNextInbox);
  }, 4500);
}
// Every panel on the Spending tab reads state.transactions, and an import moves all of them at
// once — which is the point, and also why this is one named function rather than a list repeated
// at the import and undo call sites where the two could drift apart.
function refreshAfterBankImport(){
  renderRecurring();
  renderBudgetFromHistory();
  renderTrips();
  renderReceived();
  renderTransactions();
  renderActualVsPlannedPanel();
  renderSpendCategoryChart();
  renderSpendingTrends();
  renderYearSpending();
  // An import can now create budget lines, which moves the planned side too — the Budget tab's
  // list and totals, and every scenario figure derived from them.
  renderSharedGroups();
  renderCards(); renderDetail(); renderTotals();
  renderProjectionOutputs();
}

export function wirePayslip(){  document.addEventListener("change", function(e){
    var person = e.target.getAttribute && e.target.getAttribute("data-slip-file");
    if(person == null || !e.target.files || !e.target.files[0]) return;
    var file = e.target.files[0];
    file.arrayBuffer().then(function(buf){ return pdfLines(new Uint8Array(buf)); }).then(function(lines){
      readPayslipLines(person, lines.map(function(l){ return l.cells.map(function(c){ return c.s; }).join("   "); }));
    }).catch(function(){ payslipRead[person] = { error: "That PDF couldn't be read. Paste its text instead." }; redrawPayslipPanel(person); });
  });
  document.addEventListener("click", function(e){
    var read = e.target.closest("[data-slip-read]");
    if(read){
      var p0 = read.getAttribute("data-slip-read");
      var ta = read.closest(".slip-paste").querySelector("textarea");
      readPayslipLines(p0, String(ta.value || "").split(/\r?\n/));
      return;
    }
    var use = e.target.closest("[data-slip-use]");
    if(use){
      var p1 = use.getAttribute("data-slip-use"), r1 = payslipRead[p1];
      if(!r1 || r1.error) return;
      var st1 = personTaxSettings(p1);
      st1.ytd = { asOf: r1.periodEnd, gross: r1.ytd.gross, withheld: r1.ytd.tax };
      persist(); redrawPayslipPanel(p1);
      showToast("Year-to-date figures set from the payslip");
      return;
    }
    // v3.148.0: the pay itself, logged as take-home received.
    var lg = e.target.closest("[data-slip-log]");
    if(lg){
      var p3 = lg.getAttribute("data-slip-log"), r3 = payslipRead[p3], chk = r3 && payslipCheck(p3, r3);
      if(!chk || !chk.loggable) return;
      var srow = salaryRowFor(p3);
      var rec = logIncomeReceived({ target: "net:" + p3, amount: chk.loggable.amount, date: chk.loggable.date, what: "Pay (from payslip)", account: srow ? srow.account || "" : "" });
      persist(); renderAll(); redrawPayslipPanel(p3);
      if(rec) showUndoToast("Pay logged as received", function(){ deleteIncomeReceived(rec.id); persist(); renderAll(); redrawPayslipPanel(p3); });
      return;
    }
    var sal = e.target.closest("[data-slip-salary]");
    if(sal){
      var p2 = sal.getAttribute("data-slip-salary"), r2 = payslipRead[p2], row = salaryRowFor(p2), freq = payFrequency(r2 || {});
      if(!r2 || !row || !freq) return;
      var was = { amount: row.amount, freq: row.freq };
      row.amount = r2.gross; row.freq = freq;
      persist(); renderAll();
      showUndoToast("Salary set from the payslip", function(){ row.amount = was.amount; row.freq = was.freq; persist(); renderAll(); });
    }
  });
}

export function wireImports(){  document.getElementById("expenseDownloadTemplateBtn").addEventListener("click", exportExpensesImportTemplateCsv);
  document.getElementById("expenseImportBtn").addEventListener("click", function(){
    document.getElementById("expenseImportFile").click();
  });
  document.getElementById("expenseImportFile").addEventListener("change", function(e){
    var file = e.target.files[0];
    e.target.value = "";
    if(!file) return;
    var reader = new FileReader();
    reader.onload = function(){
      var parsed = parseExpensesImportCsv(String(reader.result));
      pendingImport.expenses = renderExpensesImportPreview(parsed);
    };
    reader.onerror = function(){ showToast("Couldn't read that file"); };
    reader.readAsText(file);
  });
  // ---------------- Spending: import a bank CSV ----------------
  // Nothing here writes to state until bankImportConfirmBtn — the review panel is built entirely
  // from the module's own session-only `bankImport`, so cancelling or navigating away leaves the
  // transaction list exactly as it was.
  document.getElementById("bankImportPickBtn").addEventListener("click", function(){
    document.getElementById("bankImportFile").click();
  });
  document.getElementById("bankImportFile").addEventListener("change", function(e){
    var file = e.target.files[0];
    e.target.value = "";
    if(!file) return;
    importBankFile(file);
  });  // v3.93.0: a statement shared to the installed app from a banking app. sw.js parks the file in
  // its own cache and opens the app with ?shared=1; it's picked up once and the cache cleared.
  (function pickUpSharedStatement(){
    if(!/[?&]shared=1\b/.test(location.search) || typeof caches === "undefined") return;
    var key = new URL("shared-statement", new URL(appAssetUrl("sw.js"), location.href)).href;
    try { history.replaceState(history.state, "", location.pathname + location.hash); } catch(e){}
    caches.open("wealth-planner-share").then(function(cache){
      return cache.match(key).then(function(res){
        if(!res) return;
        var name = decodeURIComponent(res.headers.get("X-File-Name") || "statement");
        var type = res.headers.get("Content-Type") || "";
        return res.blob().then(function(blob){
          cache.delete(key);
          showPage("expenses");
          showExpensesSubpage("spending", { replace: true });
          importBankFile(new File([blob], name, { type: type }));
        });
      });
    }).catch(function(){});
  })();  // Patched, not re-rendered. A full renderBankImportPanel() here would move the row the user just
  // touched out of "Needs you" and into "Ready" — reordering the list under their finger mid-review,
  // on a phone, which is how a review screen gets abandoned. The counts and badge update in place
  // and the row stays where it is until the next file is loaded.
  document.getElementById("bankImportPanel").addEventListener("change", function(e){
    // The statement's account changes what counts as a transfer and whose balance it sets — a full render.
    if(e.target.hasAttribute("data-bank-account")){ setStatementAccount(e.target.value); renderBankImportPanel(); return; }
    if(e.target.hasAttribute("data-bank-setbalance")){ setStatementBalanceOn(e.target.checked); return; }
    var lineSel = e.target.closest(".bank-group-line");
    if(lineSel) setBankImportGroupLine(lineSel.getAttribute("data-bank-group"), lineSel.value);
    var catSel = e.target.closest(".bank-group-category");
    if(catSel) setBankImportGroupCategory(catSel.getAttribute("data-bank-group"), catSel.value);
    if(lineSel || catSel) patchBankImportPanel((lineSel || catSel).getAttribute("data-bank-group"));
  });
  document.getElementById("bankImportPanel").addEventListener("click", function(e){
    var orderBtn = e.target.closest("[data-bank-date-order]");
    if(orderBtn){
      reparseBankImportWith(orderBtn.getAttribute("data-bank-date-order"));
      renderBankImportPanel();
      return;
    }
    // v3.150.0: a row logged on the statement's account that the statement doesn't have.
    var strayDel = e.target.closest("[data-bank-stray-del]");
    if(strayDel){
      var sid = strayDel.getAttribute("data-bank-stray-del");
      var si = state.transactions.findIndex(function(t){ return t.id === sid; });
      if(si === -1) return;
      var gone = state.transactions.splice(si, 1)[0];
      persist(); renderBankImportPanel(); refreshAfterBankImport();
      showUndoToast("Deleted " + (gone.what || "the row"), function(){ state.transactions.splice(si, 0, gone); persist(); renderBankImportPanel(); refreshAfterBankImport(); });
      return;
    }
    // Folding the maybes in or out changes which rows exist, so this one does need a full render —
    // unlike assigning a group, where re-rendering would move the row out from under the finger.
    var maybesBtn = e.target.closest("[data-bank-maybes]");
    if(maybesBtn){
      setIncludePossibleDuplicates(maybesBtn.getAttribute("data-bank-maybes") === "1");
      renderBankImportPanel();
      return;
    }
    if(e.target.closest("#bankImportCancelBtn")){ clearBankImport(); inbox.current = null; renderInbox(); return; }
    if(!e.target.closest("#bankImportConfirmBtn")) return;
    var result = commitBankImport();
    clearBankImport();
    if(inbox.current) inboxFileDone(inbox.current);
    refreshAfterBankImport();
    // v3.163.0 (item 193): what was just imported waits to be reviewed — say so where it's counted.
    renderTxReviewBanner(); renderHomeSummary();
    // Transfers and a statement balance reach Accounts, Home and net worth too.
    if((result.transferIds && result.transferIds.length) || result.balanceSet || result.loanSet) renderAll();
    showUndoToast(
      (result.ids.length || !(result.reconciled && result.reconciled.length || result.loanSet) ? "Imported " + result.ids.length + " transaction" + (result.ids.length === 1 ? "" : "s") : result.loanSet ? "Loan statement recorded" : "Nothing new") +
        (result.refunds ? " · " + result.refunds + " refund" + (result.refunds === 1 ? "" : "s") : "") +
        (result.receivedIds && result.receivedIds.length ? " · " + result.receivedIds.length + " income received" : "") +
        (result.transferIds && result.transferIds.length ? " · " + result.transferIds.length + " transfer" + (result.transferIds.length === 1 ? "" : "s") : "") +
        (result.reconciled && result.reconciled.length ? " · " + result.reconciled.length + " matched to what you logged" : "") +
        (result.loanCharges ? " · " + result.loanCharges + " loan charge" + (result.loanCharges === 1 ? "" : "s") : "") +
        (result.balanceSet ? " · " + result.balanceSet.account + " balance updated" : "") +
        (result.linesCreated ? " · " + result.linesCreated + " new budget line" + (result.linesCreated === 1 ? "" : "s") : "") +
        (result.learned ? " · learned " + result.learned + " shop" + (result.learned === 1 ? "" : "s") : ""),
      function(){
        // Rules the import taught are left in place on purpose — they're a preference, not part of
        // the data being undone, and re-importing the same file is the usual reason to undo.
        undoBankImport(result.ids, result.lineIds, result.receivedIds, result.transferIds, result.balanceSet, result.reconciled, result.loanSet);
        refreshAfterBankImport();
        renderAll();
      }
    );
    // v3.162.0 (item 192): a first statement with three months in it and nothing budgeted yet goes
    // straight on to the budget it suggests — the step a new household would otherwise have to find.
    if(result.ids.length && !(state.shared || []).length){
      var pb = currentHistoryBudget();
      if(pb.ready && pb.proposals.length){
        renderBudgetFromHistory();
        showPage("expenses"); showExpensesSubpage("budget", { replace: true });
        var hb = document.getElementById("historyBudgetCard");
        if(hb){ hb.open = true; setTimeout(function(){ hb.scrollIntoView({ behavior: "smooth", block: "start" }); }, 120); }
      }
    }
  });
  // ---------------- Statements from a folder (v3.142.0, item 181) ----------------
  // What's waiting in Statements (Dropbox, or the backup folder) is listed once the app has opened
  // and synced; each goes through importBankFile like a chosen file, and moves to Statements/Imported
  // once confirmed. Cancelling leaves it where it is, for next time.
  inbox = { files: [], places: [], current: null };
  document.getElementById("bankInboxNote").addEventListener("click", function(e){
    if(e.target.closest("[data-inbox-next]")) openNextInbox();
  });
  document.getElementById("incomeDownloadTemplateBtn").addEventListener("click", exportIncomeImportTemplateCsv);
  document.getElementById("incomeImportBtn").addEventListener("click", function(){
    document.getElementById("incomeImportFile").click();
  });
  document.getElementById("incomeImportFile").addEventListener("change", function(e){
    var file = e.target.files[0];
    e.target.value = "";
    if(!file) return;
    var reader = new FileReader();
    reader.onload = function(){
      var parsed = parseIncomeImportCsv(String(reader.result));
      pendingImport.income = renderIncomeImportPreview(parsed);
    };
    reader.onerror = function(){ showToast("Couldn't read that file"); };
    reader.readAsText(file);
  });
  document.getElementById("assetsDownloadTemplateBtn").addEventListener("click", exportAssetsImportTemplateCsv);
  document.getElementById("assetsImportBtn").addEventListener("click", function(){
    document.getElementById("assetsImportFile").click();
  });
  document.getElementById("assetsImportFile").addEventListener("change", function(e){
    var file = e.target.files[0];
    e.target.value = "";
    if(!file) return;
    var reader = new FileReader();
    reader.onload = function(){
      var parsed = parseAssetsImportCsv(String(reader.result));
      pendingImport.assets = renderAssetsImportPreview(parsed);
    };
    reader.onerror = function(){ showToast("Couldn't read that file"); };
    reader.readAsText(file);
  });
}

export { checkInbox };
