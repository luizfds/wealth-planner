import { state } from "../state.js";
import { folderBackupSupported, savedFolder, passcodeSet } from "../lib/safekeeping.js";
import { escapeAttr } from "../lib/html.js";
import { localDateStr } from "../lib/format.js";

// ---------------- Settings → Preferences → Keeping your data safe (v3.63.0) ----------------
export function safekeepingHtml(folderName, today){
  today = today || localDateStr();
  var last = state.lastBackupDate;
  var age = last ? Math.round((Date.parse(today) - Date.parse(last)) / 86400000) : null;
  var backup = '<div class="sk-block"><b>Backups</b><p class="ledger-note" style="margin:2px 0 8px">' +
    (last ? "Last backup " + escapeAttr(last) + (age > 30 ? " — " + age + " days ago, worth making a new one." : ".") : "No backup yet. Everything lives only in this browser; a backup file is how it survives a cleared browser or a new device.") + '</p>' +
    '<button type="button" class="btn btn-sm" data-sk="export">Back up now</button></div>';
  var folder = folderBackupSupported()
    ? '<div class="sk-block"><b>Automatic backups to a folder</b><p class="ledger-note" style="margin:2px 0 8px">' +
        (folderName ? 'Saving a backup to <b>' + escapeAttr(folderName) + '</b> once a week when you open the app' + (state.lastFolderBackup ? " (last " + escapeAttr(state.lastFolderBackup) + ")" : "") + '. Pick a synced folder (Dropbox, OneDrive, iCloud Drive) and it\'s off this computer too. The browser may ask again for permission after a restart.'
          : 'Pick a folder and a backup is written there once a week, without you having to remember. A synced folder (Dropbox, OneDrive, iCloud Drive) keeps it off this computer too.') + '</p>' +
        (folderName ? '<button type="button" class="btn btn-sm" data-sk="folder-now">Back up to the folder now</button> <button type="button" class="btn btn-sm btn-ghost" data-sk="folder-change">Change folder</button> <button type="button" class="btn btn-sm btn-ghost" data-sk="folder-stop">Stop</button>'
          : '<button type="button" class="btn btn-sm" data-sk="folder-pick">Choose a folder</button>') + '</div>'
    : '<div class="sk-block"><b>Automatic backups to a folder</b><p class="ledger-note" style="margin:2px 0 0">Needs Chrome or Edge on a computer — this browser can\'t write to a folder. Use Back up now instead.</p></div>';
  var lock = '<div class="sk-block"><b>Passcode</b><p class="ledger-note" style="margin:2px 0 8px">' +
    (passcodeSet() ? "On — the app asks for it each time it's opened in a new tab or window, on this device." : "Off. A passcode asks before showing anything each time the app is opened on this device.") +
    ' It keeps a casual look out on a shared computer; it doesn\'t encrypt what\'s stored in the browser. For that, use a passphrase on your backups.</p>' +
    (passcodeSet() ? '<button type="button" class="btn btn-sm btn-ghost" data-sk="pass-change">Change passcode</button> <button type="button" class="btn btn-sm btn-ghost" data-sk="pass-off">Turn off</button> <button type="button" class="btn btn-sm btn-ghost" data-sk="lock-now">Lock now</button>'
      : '<button type="button" class="btn btn-sm" data-sk="pass-set">Set a passcode</button>') + '</div>';
  return backup + folder + lock;
}
export function renderSafekeeping(){
  var el = typeof document !== "undefined" && document.getElementById("safekeepingBody");
  if(!el) return Promise.resolve();
  el.innerHTML = safekeepingHtml(null);
  return savedFolder().then(function(h){ el.innerHTML = safekeepingHtml(h ? h.name : null); });
}
