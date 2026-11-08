import { textDialog, confirmDialog, choiceDialog, dialogOpen } from "../lib/dialogs.js";
// ---------------- Safekeeping and sync, wired (v3.206.1, item 237) ----------------
//
// The passcode, folder backups and sync through the folder or Dropbox.
// Moved out of app.js as it was, listener for listener; app.js calls each wire…() where its listeners used to be
// added, so they're added in the same order.
import { recalcComputedItems, totalNetWorthValue } from "../calc/engine.js";
import { recordNetWorth, isAutoPoint } from "../calc/nwauto.js";
import { thinPriceHistory } from "../calc/pricesheet.js";
import { takeReceiptFiles } from "../calc/receipts.js";
import { mergeStates } from "../calc/syncmerge.js";
import { setAppKey, connectDropbox, finishDropboxRedirect, disconnectDropbox } from "../lib/dropbox.js";
import { syncOn, unlockSync, syncNow, pulled, merged as syncMerged, markChanged, stopSync } from "../lib/foldersync.js";
import { localDateStr } from "../lib/format.js";
import { unpackReceipts } from "../lib/receipts.js";
import { chooseFolder, backupToFolder, forgetFolder, maybeAutoBackup, setPasscode, clearPasscode, checkPasscode, newestFolderBackup, savedFolder } from "../lib/safekeeping.js";
import { showToast, showPersistentToast } from "../lib/toast.js";
import { state, setState, persist, migrateState, onSaved } from "../state.js";
import { importBackupText } from "./datawiring.js";
import { renderHomeSummary } from "./home.js";
import { checkInbox } from "./importwiring.js";
import { showAccountsSubpage } from "./nav.js";
import { renderAll } from "./redraw.js";
import { renderSafekeeping } from "./safekeeping.js";
import { mergeDialogHtml } from "./syncmerge.js";

var lockScreen, syncBusy, syncTimer, mergeAskedAt, initialSync;

function showLock(){
  document.documentElement.classList.add("is-locked");
  lockScreen.hidden = false;
  document.getElementById("lockError").hidden = true;
  var inp = document.getElementById("lockInput"); inp.value = ""; setTimeout(function(){ inp.focus(); }, 30);
}
function unlock(){
  try{ sessionStorage.setItem("wealthPlanner.unlocked", "1"); }catch(e){}
  document.documentElement.classList.remove("is-locked");
  lockScreen.hidden = true;
}
async function askNewPasscode(){
  var pass = await textDialog("Choose a passcode for this device. This hides the app on a shared screen; it does not encrypt browser storage.", "", {title:"Set device passcode",label:"Passcode",password:true,repeat:true,required:true,minLength:4,accept:"Set passcode"});
  if(pass === null) return false;
  await setPasscode(pass);
  try{ sessionStorage.setItem("wealthPlanner.unlocked", "1"); }catch(e){}
  return true;
}

function folderResult(r){
  if(r.ok) showToast("Backed up to " + r.folder + " (" + r.name + ")");
  else if(r.reason === "permission") showToast("The browser didn't allow writing to " + r.folder);
  renderSafekeeping(); renderHomeSummary();
}
// ---------------- Sync through the folder (v3.134.0) — lib/foldersync.js ----------------
// v3.136.0: Dropbox's passphrase step, after connecting (or on a new device).
async function dropboxPassphrase(){
  var pass = (await textDialog("The passphrase for the synced copy. Use the same one on each device — it isn't stored anywhere, so keep it somewhere safe:", "", {"title":"Protect your data","label":"Passphrase","accept":"Unlock sync","password":true,"repeat":true,"required":true}));
  if(!pass) return Promise.resolve();
  return unlockSync(pass, true, "dropbox").then(function(r){
    if(!r.ok){ showToast(r.reason === "wrong-passphrase" ? "That passphrase doesn't open the copy already in Dropbox" : r.reason === "not-connected" ? "Connect Dropbox first" : "Couldn't reach Dropbox"); return; }
    showToast(r.existing ? "Sync on — checking the copy in Dropbox" : "Sync on");
    renderSafekeeping();
    return runSync({ interactive: true });
  }).catch(function(){ showToast("Couldn't reach Dropbox"); });
}
function whenText(iso){ try{ return new Date(iso).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }catch(e){ return iso || ""; } }
function runSync(opts){
  opts = opts || {};
  // Native questions used to pause JS. Shared dialogs are asynchronous: a background sync must
  // not redraw the records or forms the person is currently deciding about.
  function deferSync(){ clearTimeout(syncTimer); syncTimer = setTimeout(function(){ runSync({}); }, 3000); }
  if(dialogOpen()){ deferSync(); return Promise.resolve(); }
  if(syncBusy) return Promise.resolve();
  syncBusy = true;
  return syncNow(opts).then(function(r){
    syncBusy = false;
    if(dialogOpen()){ deferSync(); return r; }
    if(r.status === "pull"){
      try { var pulledObj = JSON.parse(r.text); unpackReceipts(takeReceiptFiles(pulledObj)).catch(function(){}); setState(migrateState(pulledObj)); } catch(e){ showToast("The synced copy couldn't be read"); return r; }
      pulled(r.rev);
      recalcComputedItems(); renderAll(); persist();
      showToast("Loaded the newer copy from " + r.folder + " (" + whenText(r.savedAt) + ")");
    } else if(r.status === "pushed"){ if(opts.manual) showToast("Synced"); renderSafekeeping(); }
    else if(r.status === "same"){ if(opts.manual) showToast("Already in sync"); }
    else if(r.status === "paused") showPersistentToast("Sync is paused until the browser is allowed to use " + r.folder + " again.", "Allow", function(){ runSync({ interactive: true }); });
    else if(r.status === "not-connected") showPersistentToast("Sync needs Dropbox connecting again on this device.", "Connect", function(){ connectDropbox(); });
    else if(r.status === "locked") showPersistentToast("Sync needs its passphrase on this computer.", "Type it", async function(){ var p = (await textDialog("Sync passphrase:", "", {"title":"Protect your data","label":"Passphrase","accept":"Unlock sync","password":true})); if(p) unlockSync(p, true).then(function(u){ if(u.ok) runSync({ interactive: true }); else showToast("That passphrase doesn't open the synced copy"); }); });
    else if(r.status === "other-key") showPersistentToast("The copy in " + r.folder + " was started again with a different passphrase (" + whenText(r.savedAt) + ").", "Type it", async function(){ var p = (await textDialog("That copy's passphrase:", "", {"title":"Protect your data","label":"Passphrase","accept":"Unlock sync","password":true})); if(p) unlockSync(p, true).then(function(u){ if(u.ok) runSync({ interactive: true }); else showToast("That passphrase doesn't open it"); }); });
    else if(r.status === "conflict" && r.text && r.base && !opts.force) mergeSync(r);
    else if(r.status === "conflict") showPersistentToast("This device and " + (r.fromThisDevice ? "an earlier session here" : "another one") + " both changed since they last synced (the copy in " + r.folder + ": " + whenText(r.savedAt) + ").", "Choose", async function(){
      var choice = await choiceDialog("Both copies have changes. Loading the synced copy replaces this device's changes. Using this device's copy replaces the synced changes. Cancel leaves both copies untouched.", {title:"Choose which copy to keep",accept:"Load synced copy",alternative:"Use this device’s copy"});
      if(choice === null) return;
      runSync({ interactive: true, manual: true, force: choice === "accept" ? "pull" : "push" });
    });
    return r;
  }).catch(function(){ syncBusy = false; if(opts.manual) showToast("Sync couldn't reach the folder"); });
}
function mergeSync(r){
  var base, theirs;
  try {
    base = JSON.parse(r.base); takeReceiptFiles(base);
    var theirsObj = JSON.parse(r.text);
    unpackReceipts(takeReceiptFiles(theirsObj)).catch(function(){});
    theirs = migrateState(theirsObj);
  } catch(e){ showToast("The synced copy couldn't be read"); return; }
  var theirsText = JSON.stringify(theirs);
  // This device's copy as it is when combined — edits made while the question waited included.
  var ours = function(){ return JSON.parse(JSON.stringify(state)); };
  var apply = function(res){
    mergeAskedAt = 0;
    try { setState(migrateState(res.merged)); } catch(e){ showToast("Couldn't combine the two copies"); return; }
    recalcComputedItems(); renderAll(); persist();
    syncMerged(r.rev, theirsText).then(function(){ runSync({}); });
    var n = res.fromTheirs;
    showToast("Combined with the copy in " + r.folder + (n ? " — " + n + " change" + (n === 1 ? "" : "s") + " from there" : ""));
  };
  var first = mergeStates(base, ours(), JSON.parse(theirsText));
  if(!first.conflicts.length){ apply(first); return; }
  // Asked already and not answered yet: the next save's sync doesn't ask again for a while.
  if(Date.now() - mergeAskedAt < 10 * 60 * 1000) return;
  mergeAskedAt = Date.now();
  // v3.171.0: the other copy says whose device it came from, inside the encrypted data.
  var otherWho = r.fromThisDevice ? "an earlier session here" : theirs.savedByName ? theirs.savedByName + "'s device" : "another one";
  showPersistentToast("This device and " + otherWho + " both changed " +
    (first.conflicts.length === 1 ? "the same thing" : first.conflicts.length + " of the same things") + ". Everything else combines by itself.", "Choose", function(){
    var d = document.getElementById("mergeDialog");
    if(!d){ d = document.createElement("dialog"); d.id = "mergeDialog"; d.className = "shortcuts-dialog merge-dialog"; d.setAttribute("aria-label", "Combine two copies"); document.body.appendChild(d); }
    d.innerHTML = mergeDialogHtml(first.conflicts, r.folder, whenText(r.savedAt), theirs.savedByName);
    d.onclose = function(){
      if(d.returnValue !== "ok") return;
      var choices = {};
      d.querySelectorAll("input[data-merge-id]:checked").forEach(function(i){ choices[i.getAttribute("data-merge-id")] = i.value; });
      apply(mergeStates(base, ours(), JSON.parse(theirsText), choices));
    };
    d.showModal();
  });
}
// v3.139.0 (item 171): net worth keeps its own history — the day's figure as the app saves,
// thinned as it ages. Recorded after a save, so it rides along with the next one.
function keepNetWorthHistory(){
  if(!Array.isArray(state.netWorthLog)) state.netWorthLog = [];
  // Nothing owned or owed yet: no history of zeroes.
  if(!(state.assets || []).length && !(state.properties || []).length && !(state.debts || []).length) return false;
  var today = localDateStr();
  var changed = recordNetWorth(state.netWorthLog, totalNetWorthValue(), today);
  if(thinPriceHistory(state.netWorthLog, today, isAutoPoint)) changed = true;
  return changed;
}

export function wireSafekeeping(){
  // ---------------- Safekeeping (v3.63.0): folder backups and the passcode ----------------
  lockScreen = document.getElementById("lockScreen");
  document.getElementById("lockForm").addEventListener("submit", function(e){
    e.preventDefault();
    checkPasscode(document.getElementById("lockInput").value).then(function(ok){
      if(ok) unlock(); else { document.getElementById("lockError").hidden = false; document.getElementById("lockInput").select(); }
    });
  });
  if(document.documentElement.classList.contains("is-locked")) showLock();
  document.getElementById("safekeepingBody").addEventListener("click", async function(e){
    var b = e.target.closest("[data-sk]");
    if(!b) return;
    var act = b.getAttribute("data-sk");
    if(act === "export"){ document.getElementById("exportBtn").click(); setTimeout(renderSafekeeping, 400); return; }
    if(act === "folder-pick" || act === "folder-change"){
      chooseFolder().then(function(){ return backupToFolder(true); }).then(folderResult).catch(function(err){ if(err && err.name !== "AbortError") showToast("Couldn't use that folder"); });
      return;
    }
    if(act === "folder-now"){ backupToFolder(true).then(folderResult).catch(function(){ showToast("Couldn't write the backup"); }); return; }
    if(act === "folder-open"){
      newestFolderBackup(true).then(function(r){
        if(!r || r.permission === false){ showToast("The browser didn't allow reading the folder"); return; }
        if(r.none){ showToast("No backups in " + r.folder + " yet"); return; }
        importBackupText(r.text);
      }).catch(function(){ showToast("Couldn't read the folder"); });
      return;
    }
    if(act === "file-open"){ document.getElementById("importFile").click(); return; }
    // v3.134.0: sync through the folder.
    if(act === "sync-on"){
      savedFolder().then(function(h){ return h ? h : chooseFolder(); }).then(async function(){
        var pass = (await textDialog("A passphrase for the synced copy. Use the same one on each computer — it isn't stored anywhere, so keep it somewhere safe:", "", {"title":"Protect your data","label":"Passphrase","accept":"Unlock sync","password":true,"repeat":true,"required":true}));
        if(!pass) return;
        return unlockSync(pass, true, "folder").then(function(r){
          if(!r.ok){ showToast(r.reason === "wrong-passphrase" ? "That passphrase doesn't open the copy already in the folder" : "Couldn't use the folder"); return; }
          showToast(r.existing ? "Sync on — checking the copy in the folder" : "Sync on");
          renderSafekeeping();
          return runSync({ interactive: true });
        });
      }).catch(function(err){ if(err && err.name !== "AbortError") showToast("Couldn't turn on sync"); });
      return;
    }
    if(act === "sync-now"){ runSync({ interactive: true, manual: true }); return; }
    // v3.136.0: through Dropbox.
    if(act === "dbx-key"){ var ki = document.querySelector("[data-dbx-key]"); var kv = ki && ki.value.trim(); if(!kv){ showToast("Paste the app key first"); return; } setAppKey(kv); renderSafekeeping(); return; }
    if(act === "dbx-key-forget"){ setAppKey(""); renderSafekeeping(); return; }
    if(act === "dbx-connect"){ connectDropbox().catch(function(){ showToast("Couldn't start the Dropbox sign-in"); }); return; }
    if(act === "dbx-disconnect"){ disconnectDropbox().then(function(){ showToast("Dropbox disconnected"); renderSafekeeping(); }); return; }
    if(act === "dbx-pass"){ dropboxPassphrase(); return; }
    if(act === "sync-off"){ if((await confirmDialog("Stop syncing on this device? The synced copy stays where it is.", {"title":"Stop sync","accept":"Stop sync"}))) stopSync().then(function(){ showToast("Sync off on this device"); renderSafekeeping(); }); return; }
    if(act === "folder-stop"){ forgetFolder().then(function(){ showToast("Stopped backing up to the folder"); renderSafekeeping(); }); return; }
    if(act === "pass-set" || act === "pass-change"){ askNewPasscode().then(function(done){ if(done){ showToast("Passcode set"); renderSafekeeping(); } }); return; }
    if(act === "pass-off"){
      var cur = (await textDialog("Current passcode:", "", {"title":"Turn off passcode","label":"Passcode","accept":"Turn off passcode","password":true}));
      if(cur == null) return;
      checkPasscode(cur).then(function(ok){ if(!ok){ showToast("That isn't the passcode"); return; } clearPasscode(); showToast("Passcode off"); renderSafekeeping(); });
      return;
    }
    if(act === "lock-now"){ try{ sessionStorage.removeItem("wealthPlanner.unlocked"); }catch(err){} showLock(); }
  });
  syncBusy = false;
  syncTimer = null;  // v3.143.0 (item 182): both devices changed since they last synced — combine them. Everything
  // changed on one side only is taken from that side; only the same thing changed both ways is asked,
  // one choice each. Without the agreed copy (synced last on an older version) it's still a choice.
  mergeAskedAt = 0;
  onSaved(keepNetWorthHistory);
  onSaved(function(){
    if(!markChanged()) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(function(){ runSync({}); }, 8000);
  });
  document.addEventListener("visibilitychange", function(){ if(document.visibilityState === "hidden" && syncOn()){ clearTimeout(syncTimer); runSync({}); } });  // A quiet weekly backup into the chosen folder, if the browser still allows it.
  // v3.71.0: first, is there a newer copy from another device in the folder? Then offer it, and
  // don't back up over the top of it until the person has chosen.
  // v3.134.0: with sync on, the encrypted sync copy does both jobs — no unencrypted weekly file.
  // Before the day's price check (below), so a copy changed elsewhere is loaded before this device
  // makes changes of its own.
  // v3.136.0: back from Dropbox's sign-in first — then straight to the passphrase.
  initialSync = finishDropboxRedirect().then(function(r){
    if(r && r.connected){
      showAccountsSubpage("preferences"); renderSafekeeping();
      if(!syncOn()) showPersistentToast("Dropbox connected. Set the passphrase to start syncing.", "Set it", dropboxPassphrase);
      else return runSync({ interactive: true });
      return;
    }
    if(r && !r.connected) showToast(r.reason === "access_denied" ? "Dropbox wasn't connected" : "Couldn't connect Dropbox");
    return syncOn() ? runSync({}) : null;
  }).catch(function(){});  // v3.142.0 (item 181): then the statements waiting in the Statements folder.
  initialSync.then(function(){ return checkInbox(true); });
  if(!syncOn()) newestFolderBackup(false).then(function(r){
    if(r && r.newerThanHere && !r.fromThisDevice && !r.none && r.permission !== false){
      var when = new Date(r.savedAt).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
      showPersistentToast("A newer copy from another device (" + when + ") is in " + r.folder + ".", "Open it", function(){ importBackupText(r.text); });
      return;
    }
    return maybeAutoBackup().then(function(res){ if(res && res.ok){ showToast("Weekly backup saved to " + res.folder); renderSafekeeping(); } });
  }).catch(function(){});
}

export { initialSync, keepNetWorthHistory, runSync };
