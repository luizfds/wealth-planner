import { state } from "../state.js";
import { folderBackupSupported, savedFolder, passcodeSet } from "../lib/safekeeping.js";
import { syncLocal, syncVia } from "../lib/foldersync.js";
import { appKey, dropboxConnected, keyIsBuiltIn, redirectUri } from "../lib/dropbox.js";
import { escapeAttr } from "../lib/html.js";
import { localDateStr, fmtDate } from "../lib/format.js";
import { storageUsedChars, storageLineText } from "../lib/storageuse.js";

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
  // v3.136.0: or through Dropbox (the second way), which works on a phone too.
  var sl = syncLocal(), via = syncVia();
  var when = sl.lastAt ? ' Last synced ' + escapeAttr(new Date(sl.lastAt).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })) + '.' : '';
  var sync;
  if(sl.on){
    sync = '<div class="sk-block"><b>Keep your devices in sync</b><p class="ledger-note" style="margin:2px 0 8px">On — through <b>' + (via === "dropbox" ? "Dropbox" : escapeAttr(folderName || "the folder")) + '</b>. ' +
      'A few seconds after each change this device writes an encrypted copy there; opening the app on another device ' + (via === "dropbox" ? "connected to the same Dropbox" : "with the same folder") + ' loads it. If both changed since they last synced, you choose which to keep — they\'re never merged.' + when + '</p>' +
      '<button type="button" class="btn btn-sm" data-sk="sync-now">Sync now</button> <button type="button" class="btn btn-sm btn-ghost" data-sk="sync-off">Turn off</button></div>';
  } else {
    var key = appKey(), connected = dropboxConnected();
    var dbx = '<div class="sk-way"><b>Through Dropbox</b> <small>— computers and phones</small><p class="ledger-note" style="margin:2px 0 8px">The app gets its own folder in your Dropbox (under Apps, named after the Dropbox app) and nothing else. What it stores there is encrypted with your passphrase.</p>' +
      (!key ? '<p class="ledger-note" style="margin:0 0 6px">This copy of the app has no Dropbox app key yet. Create one in the Dropbox App Console (Scoped access, App folder, permissions files.content.read and files.content.write, redirect URI <code>' + escapeAttr(redirectUri()) + '</code>) and paste its App key here:</p>' +
          '<label class="sk-key"><input type="text" data-dbx-key placeholder="App key" aria-label="Dropbox app key" autocomplete="off" spellcheck="false"> <button type="button" class="btn btn-sm" data-sk="dbx-key">Save key</button></label>'
        : connected ? '<button type="button" class="btn btn-sm" data-sk="dbx-pass">Set the passphrase and turn on</button> <button type="button" class="btn btn-sm btn-ghost" data-sk="dbx-disconnect">Disconnect Dropbox</button>'
        : '<button type="button" class="btn btn-sm" data-sk="dbx-connect">Connect Dropbox</button>' + (keyIsBuiltIn() ? '' : ' <button type="button" class="btn btn-sm btn-ghost" data-sk="dbx-key-forget">Change app key</button>')) + '</div>';
    var fld = folderBackupSupported() ? '<div class="sk-way"><b>Through a synced folder</b> <small>— computers only</small><p class="ledger-note" style="margin:2px 0 8px">Point the folder above at Dropbox, OneDrive or iCloud Drive on each computer and turn this on with the same passphrase on each.</p>' +
      '<button type="button" class="btn btn-sm btn-ghost" data-sk="sync-on">' + (folderName ? 'Turn on sync through ' + escapeAttr(folderName) : 'Choose a folder and turn on sync') + '</button></div>' : '';
    sync = '<div class="sk-block"><b>Keep your devices in sync</b><p class="ledger-note" style="margin:2px 0 8px">One copy shared between your devices, encrypted with a passphrase you choose — the cloud only ever stores scrambled data, and the passphrase isn\'t stored anywhere. Use the same passphrase on each device.</p>' + dbx + fld + '</div>';
  }
  return backup + folder + sync + twoDevices + lock;
}
export function renderSafekeeping(){
  var el = typeof document !== "undefined" && document.getElementById("safekeepingBody");
  if(!el) return Promise.resolve();
  // v3.138.0: and how full this browser's storage is.
  var storage = function(){ var t = storageLineText(storageUsedChars(localStorage)); return t ? '<p class="ledger-note sk-storage" style="margin:12px 0 0">' + t + '</p>' : ''; };
  el.innerHTML = safekeepingHtml(null) + storage();
  return savedFolder().then(function(h){ el.innerHTML = safekeepingHtml(h ? h.name : null) + storage(); });
}
