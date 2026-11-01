// ---------------- Your data, wired (v3.206.1, item 237) ----------------
//
// Export, share, import and backups, a tax year file, Reset, sample data, the setup checklist, the theme and the
// first-run setup.
// Moved out of app.js as it was, listener for listener; app.js calls each wire…() where its listeners used to be
// added, so they're added in the same order. What it shares with app.js it reaches through `app` (lib/appctx.js).
import { demoHousehold, demoReceipts } from "../calc/demo.js";
import { recalcComputedItems } from "../calc/engine.js";
import { applyFirstRun, shouldOfferFirstRun } from "../calc/firstrun.js";
import { fyLabel } from "../calc/property.js";
import { takeReceiptFiles } from "../calc/receipts.js";
import { incomeTargets } from "../calc/received.js";
import { getTaxPeople, computePersonTax } from "../calc/tax.js";
import { mergeTaxYearFile, matchPerson, taxYearRecord, TAX_YEAR_FILE_KIND } from "../calc/taxyear.js";
import { app } from "../lib/appctx.js";
import { decryptBackup, doExport, doShare, canShareFiles } from "../lib/backup.js";
import { localDateStr } from "../lib/format.js";
import { unpackReceipts } from "../lib/receipts.js";
import { compareCopies } from "../lib/safekeeping.js";
import { showToast, showPersistentToast } from "../lib/toast.js";
import { state, setState, persist, defaultState, migrateState, genId } from "../state.js";
import { renderDashboardStats } from "./dashboard.js";
import { firstRun, startFirstRun } from "./firstrun.js";
import { showPage, showAssetsSubpage, showExpensesSubpage, showTaxSubpage } from "./nav.js";
import { setPart } from "./parts.js";
import { renderAll } from "./redraw.js";
import { firstRunRoot, renderFirstRun } from "./spendingwiring.js";
import { renderTaxYear, setTaxYearSelected, lodgedSnapshot } from "./taxyear.js";

// Sample data (v3.104.0): one fixed, invented household with about eighteen months of history —
// calc/demo.js. Pay and rent received are added once recalc has made the take-home rows.
function buildDemoState(){
  var today = localDateStr();
  setState(migrateState(demoHousehold(today)));
  recalcComputedItems();
  demoReceipts(state, today, incomeTargets());
}// "Have they actually started using the app" — not just "does localStorage have an entry",
// since state.js's own load path writes a fresh defaultState() back to STORAGE_KEY on first
// run, before the user has touched anything. A genuinely untouched install has none of these
// (home's own default scenario block doesn't count — that always exists).
function hasRealUserData(){
  return !!(state.income.length || state.shared.length || state.assets.length ||
    state.properties.length || state.transactions.length || state.debts.length);
}// v3.40.0: a tax year file merges one year into the plan — see calc/taxyear.js mergeTaxYearFile().
function applyTaxYearFile(parsed){
  var people = getTaxPeople();
  var names = Object.keys(parsed.people || {});
  if(!confirm("Merge " + fyLabel(Number(parsed.fy)) + " figures for " + (names.join(" and ") || "nobody") +
    " into this plan? That year's income statements, interest, deductions and rental schedule are replaced by the file's; nothing else changes.")) return;
  var report;
  try{ report = mergeTaxYearFile(parsed, people, { genId: genId }); }
  catch(err){ showToast(err.message || "That file couldn't be read"); return; }
  if(parsed.markLodged){
    var rec = taxYearRecord(report.fy, true);
    Object.keys(parsed.people || {}).forEach(function(n){
      var to = matchPerson(n, people) || n;
      if(people.indexOf(to) !== -1) rec.lodged[to] = lodgedSnapshot(computePersonTax(to, { fy: report.fy }));
    });
  }
  setTaxYearSelected(report.fy);
  renderAll();
  persist();
  var bits = [];
  if(report.people.length) bits.push("people: " + report.people.join(", "));
  if(report.rental.length) bits.push("rent: " + report.rental.join(", "));
  if(report.statements.length) bits.push("statements: " + report.statements.join(", "));
  if(report.sales.length) bits.push("sales: " + report.sales.join(", "));
  if(report.addedHoldings.length) bits.push("added sold-out holdings: " + report.addedHoldings.join(", "));
  if(report.unmatchedPeople.length) bits.push("not in this plan yet (add a Gross income row for them): " + report.unmatchedPeople.join(", "));
  if(report.skipped.length) bits.push("skipped: " + report.skipped.join("; "));
  showPersistentToast(fyLabel(report.fy) + " imported — " + bits.join(" · "), "Open worksheet", function(){
    showPage("tax");
    showTaxSubpage("returns", { replace: true });
    renderTaxYear();
  });
}function applyImportedBackupJson(jsonStr){
  try{
    var parsed = JSON.parse(jsonStr);
    // A tax year file picked from the main Import merges instead of replacing everything.
    if(parsed && parsed.kind === TAX_YEAR_FILE_KIND){ applyTaxYearFile(parsed); return; }
    if(!parsed || !parsed.income || !parsed.home) throw new Error("bad shape");
    // v3.71.0: say which copy is newer, so restoring on a second device can't quietly put an
    // older copy over a newer one.
    var when = function(iso){ try{ return new Date(iso).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }catch(e){ return iso; } };
    var cmp = compareCopies(parsed.savedAt);
    if(hasRealUserData()){
      var msg = cmp === "here"
        ? "This backup is OLDER than what's on this device — it was last changed " + when(parsed.savedAt) + ", this device's copy " + when(state.savedAt) + ". Replace this device's newer copy with it?"
        : cmp === "incoming"
        ? "Replace this device's copy (last changed " + when(state.savedAt) + ") with this backup (last changed " + when(parsed.savedAt) + ")?"
        : "You already have data in Wealth Planner on this device. Importing will replace it — this can't be undone unless you've exported a backup first. Continue?";
      if(!confirm(msg)) return;
    }
    // v3.170.0: the receipts' files the backup carries go back into this device's store.
    unpackReceipts(takeReceiptFiles(parsed)).catch(function(){ showToast("The backup's receipts couldn't be stored on this device"); });
    setState(migrateState(parsed));
    renderAll();
    persist();
    showToast("Backup imported");
  }catch(err){
    showToast("That file doesn't look like a valid backup");
  }
}// A backup's text, plain or encrypted — from a picked file or the backup folder (v3.71.0).
function importBackupText(raw){
  var envelope;
  try{ envelope = JSON.parse(raw); }catch(err){ showToast("That file doesn't look like a valid backup"); return; }
  if(envelope && envelope.wealthPlannerEncrypted){
    var passphrase = prompt("This backup is encrypted. Enter its passphrase to unlock it:");
    if(passphrase == null) return;
    decryptBackup(envelope, passphrase).then(function(plainStr){ applyImportedBackupJson(plainStr); })
      .catch(function(){ showToast("Wrong passphrase, or this backup is corrupted."); });
  } else applyImportedBackupJson(raw);
}
function loadSampleData(){
  if(!confirm("Fill in a sample household so you can try the tool? This replaces everything currently entered — export a backup first if you want to keep it.")) return;
  buildDemoState();
  renderAll();
  persist();
  showToast("Sample data generated");
}
function updateThemeButtonLabel(){
  var mode = app.getThemePref();
  var label = mode === "light" ? "Theme: Light" : mode === "dark" ? "Theme: Dark" : "Theme: System";
  document.getElementById("themeToggleBtn").textContent = label;
}function openFirstRun(){
  startFirstRun(); renderFirstRun();
  app.pushActiveOverlay(closeFirstRunUi);
  var f = firstRunRoot.querySelector("input"); if(f) f.focus();
}function closeFirstRunUi(){
  if(firstRun.open && !state.firstRunDone){ state.firstRunSkipped = true; persist(); }
  firstRun.open = false; renderFirstRun();
}function readFirstRunFields(){
  firstRunRoot.querySelectorAll("[data-fr]").forEach(function(el){
    var path = el.getAttribute("data-fr").split("."), o = firstRun.answers;
    for(var i = 0; i < path.length - 1; i++) o = o[path[i]];
    o[path[path.length - 1]] = el.type === "checkbox" ? el.checked : el.value;
  });
}

export function wireData(){
  // The skip link moves focus, not just the scroll position. An href="#id" alone scrolls a <div>
  // into view and leaves focus where it was, so the very next Tab goes back to the nav item after
  // the link — which is exactly the 22 stops the user was trying to skip. tabindex="-1" makes the
  // container focusable without adding it to the tab order, and preventDefault keeps "#appContent"
  // out of the URL, where nav.js's route parsing would have to reason about it.
  document.querySelector(".skip-link").addEventListener("click", function(e){
    e.preventDefault();
    var target = document.getElementById("appContent");
    if(!target) return;
    target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: "start" });
  });
  document.getElementById("exportBtn").addEventListener("click", doExport);  document.getElementById("exportLink2").addEventListener("click", doExport);
  // Only shown where the browser can actually hand a file to the OS share sheet — everywhere
  // else (most desktop browsers, notably) it stays hidden and Export remains the only path.
  if(canShareFiles()){
    document.getElementById("shareBtn").hidden = false;
  }  document.getElementById("shareBtn").addEventListener("click", doShare);
  document.getElementById("importBtn").addEventListener("click", function(){
    document.getElementById("importFile").click();
  });  document.getElementById("taxYearImportFile").addEventListener("change", function(e){
    var file = e.target.files[0];
    e.target.value = "";
    if(!file) return;
    var reader = new FileReader();
    reader.onload = function(){
      var parsed;
      try{ parsed = JSON.parse(reader.result); }catch(err){ showToast("That file isn't JSON"); return; }
      if(!parsed || parsed.kind !== TAX_YEAR_FILE_KIND){ showToast("That isn't a tax year file — a full backup goes through Import backup"); return; }
      applyTaxYearFile(parsed);
    };
    reader.readAsText(file);
  });  document.getElementById("importFile").addEventListener("change", function(e){
    var file = e.target.files[0];
    if(!file) return;
    var reader = new FileReader();
    reader.onload = function(){ importBackupText(reader.result); };
    reader.readAsText(file);
    e.target.value = "";
  });
  document.getElementById("resetBtn").addEventListener("click", function(){
    if(!confirm("Clear everything back to a blank slate? This replaces everything currently entered — export a backup first if you want to keep it.")) return;
    setState(defaultState());
    renderAll();
    persist();
    showToast("Cleared");
  });  document.getElementById("mockDataBtn").addEventListener("click", loadSampleData);
  // The Dashboard's first-run actions. Same handler as the toolbar button above — the point of
  // these is only that they are reachable on a phone, where that button isn't rendered at all.
  document.getElementById("dashboardSetup").addEventListener("click", function(e){
    if(e.target.closest("[data-dash-start]")){ loadSampleData(); return; }
    var go = e.target.closest("[data-setup-go]");
    if(go){
      // v3.162.0: straight to the place — the tab, and the card on it, opened and in view.
      var gp = go.getAttribute("data-setup-go"), gs = go.getAttribute("data-setup-sub"), gopen = go.getAttribute("data-setup-open");
      showPage(gp);
      if(gs && gp === "expenses") showExpensesSubpage(gs, { replace: true });
      if(gopen){ var card = document.getElementById(gopen); if(card){ card.open = true; setTimeout(function(){ card.scrollIntoView({ behavior: "smooth", block: "start" }); }, 120); } }
      return;
    }
    if(e.target.closest("[data-setup-dismiss]")){
      // Remembered, not session-only: re-offering a dismissed checklist every morning in a
      // daily-use app is its own small annoyance.
      state.setupDismissed = true;
      persist();
      renderDashboardStats();
      showToast("Hidden — every page stays in the menu");
    }
  });  document.getElementById("themeToggleBtn").addEventListener("click", function(){
    var current = app.getThemePref();
    var next = app.THEME_MODES[(app.THEME_MODES.indexOf(current) + 1) % app.THEME_MODES.length];
    try{ localStorage.setItem(app.THEME_KEY, next); }catch(e){}
    app.applyTheme(next);
    updateThemeButtonLabel();
  });  updateThemeButtonLabel();
}

export function wireFirstRun(){  document.addEventListener("click", function(e){ if(e.target.closest("[data-firstrun-open]")) openFirstRun(); });  // v3.161.0 (item 191): Settings → What this household has, and Net worth's "Add a property" while it's hidden.
  document.addEventListener("click", function(e){
    var set = e.target.closest("[data-part-set]");
    if(set){ setPart(set.getAttribute("data-part-set"), set.getAttribute("data-part-value")); renderAll(); persist(); return; }
    var show = e.target.closest("[data-part-show]");
    if(show){
      var key = show.getAttribute("data-part-show");
      setPart(key, "on"); renderAll(); persist();
      if(key === "property") showPage("properties");
      else { showPage("assets"); showAssetsSubpage("Shares", { replace: true }); }
    }
  });  firstRunRoot.addEventListener("change", function(e){
    if(e.target.matches("select[data-fr]")){ readFirstRunFields(); renderFirstRun(); }
  });  firstRunRoot.addEventListener("click", function(e){
    if(e.target.closest("[data-fr-close]") || e.target === e.target.closest("[data-fr-backdrop]")){ app.requestCloseActiveOverlay(); return; }
    var a = firstRun.answers;
    if(!a) return;
    readFirstRunFields();
    if(e.target.closest("[data-fr-add-person]")){ a.people.push({ name: "", age: "", pay: "", payFreq: "Yearly" }); renderFirstRun(); return; }
    if(e.target.closest("[data-fr-add-acct]")){ a.accounts.push({ name: "", type: "savings", balance: "" }); renderFirstRun(); return; }
    var del = e.target.closest("[data-fr-del-acct]");
    if(del){ a.accounts.splice(Number(del.getAttribute("data-fr-del-acct")), 1); renderFirstRun(); return; }
    // v3.162.0 (item 192): straight to a statement — pay and the rest wait as Home's next steps.
    if(e.target.closest("[data-fr-statement]")){
      state.firstRunSkipped = true; persist();
      firstRun.open = false; app.activeOverlayClose = null; renderFirstRun();
      showPage("expenses", { replace: true }); showExpensesSubpage("spending", { replace: true });
      var ic = document.getElementById("bankImportCard");
      if(ic){ ic.open = true; setTimeout(function(){ ic.scrollIntoView({ behavior: "smooth", block: "start" }); }, 80); }
      return;
    }
    if(e.target.closest("[data-fr-back]")){ firstRun.step = Math.max(0, firstRun.step - 1); renderFirstRun(); return; }
    if(e.target.closest("[data-fr-next]")){ firstRun.step++; renderFirstRun(); var f = firstRunRoot.querySelector("input,select"); if(f) f.focus(); return; }
    var fin = e.target.closest("[data-fr-finish]");
    if(fin){
      var made = applyFirstRun(a, localDateStr());
      recalcComputedItems();
      persist();
      // Like a search result: the sheet's history entry is replaced by the destination, not popped.
      firstRun.open = false; app.activeOverlayClose = null; renderFirstRun();
      renderAll();
      showToast("Set up: " + made.people + (made.people === 1 ? " person, " : " people, ") + made.accounts + (made.accounts === 1 ? " account, " : " accounts, ") + made.lines + " budget lines");
      if(fin.getAttribute("data-fr-finish") === "import"){
        showPage("expenses", { replace: true }); showExpensesSubpage("spending", { replace: true });
        var card = document.getElementById("bankImportCard");
        if(card){ card.open = true; setTimeout(function(){ card.scrollIntoView({ behavior: "smooth", block: "start" }); }, 80); }
      } else showPage("dashboard", { replace: true });
    }
  });  document.addEventListener("keydown", function(e){ if(e.key === "Escape" && firstRun.open) app.requestCloseActiveOverlay(); });  if(shouldOfferFirstRun()) setTimeout(openFirstRun, 300);
}

export { buildDemoState, importBackupText };
