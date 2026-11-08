import { confirmDialog, textDialog } from "../lib/dialogs.js";
// ---------------- Your data, wired (v3.206.1, item 237) ----------------
//
// Export, share, import and backups, a tax year file, Reset, sample data, the setup checklist, the theme and the
// first-run setup.
// Moved out of app.js as it was, listener for listener; app.js calls each wire…() where its listeners used to be
// added, so they're added in the same order.
import { STORAGE_KEY } from "../constants.js";
import { demoHousehold, demoReceipts } from "../calc/demo.js";
import { recalcComputedItems } from "../calc/engine.js";
import { applyFirstRun, shouldOfferFirstRun } from "../calc/firstrun.js";
import { fyLabel } from "../calc/property.js";
import { takeReceiptFiles } from "../calc/receipts.js";
import { incomeTargets } from "../calc/received.js";
import { getTaxPeople, computePersonTax } from "../calc/tax.js";
import { mergeTaxYearFile, matchPerson, taxYearRecord, TAX_YEAR_FILE_KIND } from "../calc/taxyear.js";
import { downloadBackupCopy, decryptBackup, doExport, doShare, canShareFiles } from "../lib/backup.js";
import { localDateStr } from "../lib/format.js";
import { unpackReceipts } from "../lib/receipts.js";
import { compareCopies } from "../lib/safekeeping.js";
import { showToast, showPersistentToast } from "../lib/toast.js";
import { state, setState, persist, defaultState, migrateState, genId, onStorageConflict, onPendingWork, onAdopted, onSaved, onCommit, takeOtherTabsSave, adoptStoredCopy, keepThisTabsCopy, hasPendingWork, setStatus } from "../state.js";
import { renderDashboardStats } from "./dashboard.js";
import { firstRun, startFirstRun } from "./firstrun.js";
import { showPage, showAssetsSubpage, showExpensesSubpage, showTaxSubpage, showPlanSubpage } from "./nav.js";
import { setPart } from "./parts.js";
import { renderAll } from "./redraw.js";
import { firstRunRoot, renderFirstRun } from "./spendingwiring.js";
import { renderTaxYear, setTaxYearSelected, lodgedSnapshot } from "./taxyear.js";
import { pushActiveOverlay, requestCloseActiveOverlay, forgetActiveOverlay } from "../lib/overlaystack.js";
import { THEME_KEY, THEME_MODES, applyTheme, getThemePref } from "../lib/theme.js";

// Sample data (v3.104.0): one fixed, invented household with about eighteen months of history —
// calc/demo.js. Pay and rent received are added once recalc has made the take-home rows.
function buildDemoState(){
  var today = localDateStr();
  setState(migrateState(demoHousehold(today)));
  recalcComputedItems();
  demoReceipts(state, today, incomeTargets());
}
// "Have they actually started using the app" — not just "does localStorage have an entry",
// since state.js's own load path writes a fresh defaultState() back to STORAGE_KEY on first
// run, before the user has touched anything. A genuinely untouched install has none of these
// (home's own default scenario block doesn't count — that always exists).
export function hasRealUserData(){
  return ["income", "shared", "assets", "properties", "transactions", "debts", "accounts", "incomeLog", "transfers", "savingsGoals", "recurringRules"].some(function(k){ return (state[k] || []).length > 0; }) ||
    Object.keys(state.taxYears || {}).length > 0 ||
    Object.values(state.home || {}).some(function(rows){ return rows.some(function(r){ return Number(r.amount) !== 0 || r.account || (r.history || []).length; }); }) ||
    Object.values(state.purchase || {}).some(function(p){ return p.enabled; }) || !!state.firstRunDone || (state.scenarios || []).length > 1;
}
// v3.40.0: a tax year file merges one year into the plan — see calc/taxyear.js mergeTaxYearFile().
async function applyTaxYearFile(parsed){
  var people = getTaxPeople();
  var names = Object.keys(parsed.people || {});
  if(!(await confirmDialog("Merge " + fyLabel(Number(parsed.fy)) + " figures for " + (names.join(" and ") || "nobody") +
    " into this plan? That year's income statements, interest, deductions and rental schedule are replaced by the file's; nothing else changes.", {"title":"Import tax year","accept":"Merge tax year"}))) return;
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
}
async function applyImportedBackupJson(jsonStr){
  try{
    var parsed = JSON.parse(jsonStr);
    // A tax year file picked from the main Import merges instead of replacing everything.
    if(parsed && parsed.kind === TAX_YEAR_FILE_KIND){ return await applyTaxYearFile(parsed); }
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
      if(!(await confirmDialog(msg, {"title":"Restore backup","accept":"Replace household","danger":true}))) return;
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
}
// A backup's text, plain or encrypted — from a picked file or the backup folder (v3.71.0).
async function importBackupText(raw){
  var envelope;
  try{ envelope = JSON.parse(raw); }catch(err){ showToast("That file doesn't look like a valid backup"); return; }
  if(envelope && envelope.wealthPlannerEncrypted){
    var passphrase = (await textDialog("This backup is encrypted. Enter its passphrase to unlock it:", "", {"title":"Unlock backup","label":"Passphrase","accept":"Unlock backup","password":true}));
    if(passphrase == null) return;
    return decryptBackup(envelope, passphrase).then(function(plainStr){ return applyImportedBackupJson(plainStr); })
      .catch(function(){ showToast("Wrong passphrase, or this backup is corrupted."); });
  } else return applyImportedBackupJson(raw);
}
async function loadSampleData(){
  if(!(await confirmDialog("Fill in a sample household so you can try the tool? This replaces everything currently entered — export a backup first if you want to keep it.", {"title":"Use sample data","accept":"Replace with sample","danger":true}))) return;
  buildDemoState();
  renderAll();
  persist();
  showToast("Sample data generated");
}
function updateThemeButtonLabel(){
  var mode = getThemePref();
  var label = mode === "light" ? "Theme: Light" : mode === "dark" ? "Theme: Dark" : "Theme: System";
  document.getElementById("themeToggleBtn").textContent = label;
}
function openFirstRun(){
  startFirstRun(); renderFirstRun();
  pushActiveOverlay(closeFirstRunUi);
  var f = firstRunRoot.querySelector("input"); if(f) f.focus();
}
function closeFirstRunUi(){
  if(firstRun.open && !state.firstRunDone){ state.firstRunSkipped = true; persist(); }
  firstRun.open = false; renderFirstRun();
}
function readFirstRunFields(){
  firstRunRoot.querySelectorAll("[data-fr]").forEach(function(el){
    var path = el.getAttribute("data-fr").split("."), o = firstRun.answers;
    for(var i = 0; i < path.length - 1; i++) o = o[path[i]];
    o[path[path.length - 1]] = el.type === "checkbox" ? el.checked : el.value;
  });
}

export function wireData(){
  // #269: two tabs. Another tab's save is adopted here when this tab has nothing in progress; when it has, the work
  // stays and this banner offers the choice. A save the guard refused, or one another tab wrote over, says so too.
  var BANNERS = {
    updated: ["Another tab updated this household.", "You have changes in progress here, so this tab hasn’t loaded it. Finish or download them, then load the latest — or keep this tab’s version instead."],
    stale: ["Another tab saved a newer household.", "Changes in this tab are not being saved. Download this tab’s copy to keep your edits, then reload the latest saved household — or keep this tab’s version instead."],
    overwritten: ["Another tab saved over this tab’s last change.", "It’s still here, and this tab has stopped saving until you choose: keep this tab’s version, or download it and reload the latest."]
  };
  function showStorageBanner(kind){
    var banner = document.getElementById("storageConflict");
    if(banner && kind === "updated") return; // never soften a stronger message
    if(!banner){
      banner = document.createElement("section");
      banner.id = "storageConflict";
      banner.className = "storage-conflict";
      banner.setAttribute("role", "alert");
      document.getElementById("appContent").prepend(banner);
      banner.addEventListener("click", async function(e){
        if(e.target.closest("[data-storage-copy]")) downloadBackupCopy();
        if(e.target.closest("[data-storage-reload]") && (await confirmDialog("Reload the saved household? Changes made in this tab will be replaced. Download this tab’s copy first if you need them.", {"title":"Reload latest household","accept":"Reload latest"}))) location.reload();
        if(e.target.closest("[data-storage-keep]") && (await confirmDialog("Save this tab’s version over the household another tab saved? That tab’s changes since will be lost.", {"title":"Replace saved household","accept":"Keep this version","danger":true}))){
          if(keepThisTabsCopy()){ banner.remove(); showToast("Saved this tab’s version"); }
        }
      });
    }
    banner.setAttribute("data-kind", kind);
    banner.innerHTML = '<b>' + BANNERS[kind][0] + '</b><p>' + BANNERS[kind][1] + '</p>' +
      '<button type="button" class="btn btn-sm" data-storage-copy>Download this tab’s copy</button> ' +
      '<button type="button" class="btn btn-sm btn-primary" data-storage-reload>Reload latest</button> ' +
      '<button type="button" class="btn btn-sm" data-storage-keep>Keep this tab’s version</button>';
  }
  onStorageConflict(function(reason){ showStorageBanner(reason === "overwritten" ? "overwritten" : "stale"); });
  onAdopted(function(){
    var banner = document.getElementById("storageConflict");
    if(banner) banner.remove();
    typed.clear();
    renderAll();
    setStatus(true, "Updated from another tab " + new Date().toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"}));
  });
  // Work in progress: a field typed into since the last save that still differs from what was drawn, the setup
  // wizard, or an open dialog or sheet (it may hold a form, or point at rows by position). Search boxes don't count.
  var typed = new Set();
  function noteTyping(e){
    var t = e.target;
    if(t && t.matches && t.matches("input, textarea, select") && t.type !== "search" && !t.closest("#storageConflict")) typed.add(t);
  }
  // On input only (every control fires it, selects and checkboxes too): a field that saves as you type would
  // otherwise be noted again by the change event after its save, and look unsaved for good.
  document.addEventListener("input", noteTyping, true);
  onSaved(function(){ typed.clear(); });
  onCommit(function(){ typed.clear(); });
  function changedFromDrawn(el){
    if(el.type === "checkbox" || el.type === "radio") return el.checked !== el.defaultChecked;
    if(el.tagName === "SELECT") return Array.prototype.some.call(el.options, function(o){ return o.selected !== o.defaultSelected; });
    return el.value !== el.defaultValue;
  }
  onPendingWork(function(){
    var busy = false;
    typed.forEach(function(el){ if(!el.isConnected) typed.delete(el); else if(changedFromDrawn(el)) busy = true; });
    if(busy || firstRun.open) return true;
    return Array.prototype.some.call(document.querySelectorAll("dialog[open], [role=dialog]:not([hidden])"), function(d){ return d.getClientRects().length > 0; });
  });
  window.addEventListener("storage", function(e){
    if(e.key !== STORAGE_KEY && e.key !== null) return;
    if(takeOtherTabsSave(e.key === STORAGE_KEY ? e.oldValue : undefined, e.key === STORAGE_KEY ? e.newValue : undefined) === "pending") showStorageBanner("updated");
  });
  // A tab that held back (work in progress) catches up once the work is saved or let go, when it next gets focus.
  window.addEventListener("focus", function(){
    var banner = document.getElementById("storageConflict");
    if(banner && banner.getAttribute("data-kind") === "updated" && !hasPendingWork()) adoptStoredCopy();
  });
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
  document.getElementById("exportBtn").addEventListener("click", doExport);
  document.getElementById("exportLink2").addEventListener("click", doExport);
  // Only shown where the browser can actually hand a file to the OS share sheet — everywhere
  // else (most desktop browsers, notably) it stays hidden and Export remains the only path.
  if(canShareFiles()){
    document.getElementById("shareBtn").hidden = false;
  }
  document.getElementById("shareBtn").addEventListener("click", doShare);
  document.getElementById("importBtn").addEventListener("click", function(){
    document.getElementById("importFile").click();
  });
  document.getElementById("taxYearImportFile").addEventListener("change", function(e){
    var file = e.target.files[0];
    e.target.value = "";
    if(!file) return;
    var reader = new FileReader();
    reader.onload = async function(){
      var parsed;
      try{ parsed = JSON.parse(reader.result); }catch(err){ showToast("That file isn't JSON"); return; }
      if(!parsed || parsed.kind !== TAX_YEAR_FILE_KIND){ showToast("That isn't a tax year file — a full backup goes through Import backup"); return; }
      try{ await applyTaxYearFile(parsed); }catch(err){ showToast("That tax year file could not be imported. Check it and try again."); }
    };
    reader.readAsText(file);
  });
  document.getElementById("importFile").addEventListener("change", function(e){
    var file = e.target.files[0];
    if(!file) return;
    var reader = new FileReader();
    reader.onload = function(){ importBackupText(reader.result); };
    reader.readAsText(file);
    e.target.value = "";
  });
  document.getElementById("resetBtn").addEventListener("click", async function(){
    if(!(await confirmDialog("Clear everything back to a blank slate? This replaces everything currently entered — export a backup first if you want to keep it.", {"title":"Reset household","accept":"Clear household","danger":true}))) return;
    setState(defaultState());
    renderAll();
    persist();
    showToast("Cleared");
  });
  document.getElementById("mockDataBtn").addEventListener("click", loadSampleData);
  // The Dashboard's first-run actions. Same handler as the toolbar button above — the point of
  // these is only that they are reachable on a phone, where that button isn't rendered at all.
  document.addEventListener("click", function(e){
    if(e.target.closest("[data-dash-start]")){ loadSampleData(); return; }
    var go = e.target.closest("[data-setup-go]");
    if(go){
      // v3.162.0: straight to the place — the tab, and the card on it, opened and in view.
      var gp = go.getAttribute("data-setup-go"), gs = go.getAttribute("data-setup-sub"), gopen = go.getAttribute("data-setup-open");
      showPage(gp);
      if(gs && gp === "expenses") showExpensesSubpage(gs, { replace: true });
      if(gs && gp === "plan") showPlanSubpage(gs, { replace: true });
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
  });
  document.getElementById("themeToggleBtn").addEventListener("click", function(){
    var current = getThemePref();
    var next = THEME_MODES[(THEME_MODES.indexOf(current) + 1) % THEME_MODES.length];
    try{ localStorage.setItem(THEME_KEY, next); }catch(e){}
    applyTheme(next);
    updateThemeButtonLabel();
  });
  updateThemeButtonLabel();
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
  });
  firstRunRoot.addEventListener("change", function(e){
    if(e.target.matches("select[data-fr]")){ readFirstRunFields(); renderFirstRun(); }
  });
  firstRunRoot.addEventListener("click", function(e){
    if(e.target.closest("[data-fr-close]") || e.target === e.target.closest("[data-fr-backdrop]")){ requestCloseActiveOverlay(); return; }
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
      firstRun.open = false; forgetActiveOverlay(); renderFirstRun();
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
      firstRun.open = false; forgetActiveOverlay(); renderFirstRun();
      renderAll();
      showToast("Set up: " + made.people + (made.people === 1 ? " person, " : " people, ") + made.accounts + (made.accounts === 1 ? " account, " : " accounts, ") + made.lines + " budget lines");
      if(fin.getAttribute("data-fr-finish") === "import"){
        showPage("expenses", { replace: true }); showExpensesSubpage("spending", { replace: true });
        var card = document.getElementById("bankImportCard");
        if(card){ card.open = true; setTimeout(function(){ card.scrollIntoView({ behavior: "smooth", block: "start" }); }, 80); }
      } else showPage("dashboard", { replace: true });
    }
  });
  document.addEventListener("keydown", function(e){
    if(!firstRun.open) return;
    if(e.key === "Escape"){ e.preventDefault(); requestCloseActiveOverlay(); return; }
    if(e.key !== "Tab") return;
    var dialog = firstRunRoot.querySelector('[role="dialog"]');
    var stops = Array.from(dialog.querySelectorAll('button,input,select,textarea,a[href],[tabindex]')).filter(function(el){
      return !el.disabled && el.tabIndex >= 0 && el.getClientRects().length > 0;
    });
    var first = stops[0], last = stops[stops.length - 1];
    if(e.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))){ e.preventDefault(); last.focus(); }
    else if(!e.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))){ e.preventDefault(); first.focus(); }
  });
  if(shouldOfferFirstRun()) setTimeout(function(){ if(shouldOfferFirstRun()) openFirstRun(); }, 300);
}

export { buildDemoState, importBackupText };
