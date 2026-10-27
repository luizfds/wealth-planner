import { state } from "../state.js";
import { folderBackupSupported, savedFolder, passcodeSet } from "../lib/safekeeping.js";
import { syncLocal } from "../lib/foldersync.js";
import { escapeAttr } from "../lib/html.js";
import { localDateStr, fmtDate } from "../lib/format.js";

// ---------------- Settings → Preferences → Keeping your data safe (v3.63.0) ----------------
export function safekeepingHtml(folderName, today){
  today = today || localDateStr();
  var last = state.lastBackupDate;
  var age = last ? Math.round((Date.parse(today) - Date.parse(last)) / 86400000) : null;
  var backup = '<div class="sk-block"><b>Backups</b><p class="ledger-note" style="margin:2px 0 8px">' +
    (last ? "Last backup " + escapeAttr(fmtDate(last)) + (age > 30 ? " — " + age + " days ago, worth making a new one." : ".") : "No backup yet. Everything lives only in this browser; a backup file is how it survives a cleared browser or a new device.") + '</p>' +
    '<button type="button" class="btn btn-sm" data-sk="export">Back up now</button></div>';
  var folder = folderBackupSupported()
    ? '<div class="sk-block"><b>Automatic backups to a folder</b><p class="ledger-note" style="margin:2px 0 8px">' +
        (folderName ? 'Saving a backup to <b>' + escapeAttr(folderName) + '</b> once a week when you open the app' + (state.lastFolderBackup ? " (last " + escapeAttr(state.lastFolderBackup) + ")" : "") + '. Pick a synced folder (Dropbox, OneDrive, iCloud Drive) and it\'s off this computer too. The browser may ask again for permission after a restart.'
          : 'Pick a folder and a backup is written there once a week, without you having to remember. A synced folder (Dropbox, OneDrive, iCloud Drive) keeps it off this computer too.') + '</p>' +
        (folderName ? '<button type="button" class="btn btn-sm" data-sk="folder-now">Back up to the folder now</button> <button type="button" class="btn btn-sm btn-ghost" data-sk="folder-open">Open the newest from the folder</button> <button type="button" class="btn btn-sm btn-ghost" data-sk="folder-change">Change folder</button> <button type="button" class="btn btn-sm btn-ghost" data-sk="folder-stop">Stop</button>'
          : '<button type="button" class="btn btn-sm" data-sk="folder-pick">Choose a folder</button>') + '</div>'
    : '<div class="sk-block"><b>Automatic backups to a folder</b><p class="ledger-note" style="margin:2px 0 0">Needs Chrome or Edge on a computer — this browser can\'t write to a folder. Use Back up now instead.</p></div>';
  var lock = '<div class="sk-block"><b>Passcode</b><p class="ledger-note" style="margin:2px 0 8px">' +
    (passcodeSet() ? "On — the app asks for it each time it's opened in a new tab or window, on this device." : "Off. A passcode asks before showing anything each time the app is opened on this device.") +
    ' It keeps a casual look out on a shared computer; it doesn\'t encrypt what\'s stored in the browser. For that, use a passphrase on your backups.</p>' +
    (passcodeSet() ? '<button type="button" class="btn btn-sm btn-ghost" data-sk="pass-change">Change passcode</button> <button type="button" class="btn btn-sm btn-ghost" data-sk="pass-off">Turn off</button> <button type="button" class="btn btn-sm btn-ghost" data-sk="lock-now">Lock now</button>'
      : '<button type="button" class="btn btn-sm" data-sk="pass-set">Set a passcode</button>') + '</div>';
  // v3.71.0: two devices. A computer with the folder offers the newest copy in it (and says when
  // another device's is newer, on opening); a phone opens the file from its Files app, where a
  // synced Dropbox/OneDrive/iCloud folder shows up. Either way the newer copy is named before
  // anything is replaced.
  var twoDevices = '<div class="sk-block"><b>Using it on another device</b><p class="ledger-note" style="margin:2px 0 8px">Back up here, then open that backup on the other device — on a phone, from the Files app, where a synced folder shows up. ' +
    'Before replacing anything the app says which copy changed last' + (state.savedAt ? ' (this one: ' + escapeAttr(new Date(state.savedAt).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })) + ')' : '') + '.</p>' +
    '<button type="button" class="btn btn-sm btn-ghost" data-sk="file-open">Open a backup file</button></div>';
  // v3.134.0: keeping devices in step through the same folder (item 163, the first way).
  var sl = syncLocal();
  var sync = folderBackupSupported() ? '<div class="sk-block"><b>Keep your computers in sync</b><p class="ledger-note" style="margin:2px 0 8px">' +
      (sl.on ? 'On' + (folderName ? ' — through <b>' + escapeAttr(folderName) + '</b>' : '') + '. A few seconds after each change this computer writes an encrypted copy there; opening the app on another computer with the same folder loads it. If both changed since they last synced, you choose which to keep — they\'re never merged.' +
          (sl.lastAt ? ' Last synced ' + escapeAttr(new Date(sl.lastAt).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })) + '.' : '')
        : 'Point the folder above at Dropbox, OneDrive or iCloud Drive on each computer, turn this on with the same passphrase on each, and they keep one copy between them. The copy in the folder is encrypted with your passphrase — the cloud only ever stores scrambled data, and the passphrase isn\'t stored anywhere. Computers only: a phone\'s browser can\'t keep a folder.') + '</p>' +
      (sl.on ? '<button type="button" class="btn btn-sm" data-sk="sync-now">Sync now</button> <button type="button" class="btn btn-sm btn-ghost" data-sk="sync-off">Turn off</button>'
        : '<button type="button" class="btn btn-sm" data-sk="sync-on">' + (folderName ? 'Turn on sync' : 'Choose a folder and turn on sync') + '</button>') + '</div>' : '';
  return backup + folder + sync + twoDevices + lock;
}
export function renderSafekeeping(){
  var el = typeof document !== "undefined" && document.getElementById("safekeepingBody");
  if(!el) return Promise.resolve();
  el.innerHTML = safekeepingHtml(null);
  return savedFolder().then(function(h){ el.innerHTML = safekeepingHtml(h ? h.name : null); });
}
