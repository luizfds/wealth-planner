import { state } from "../state.js";
import { sacrificeModeToLabel } from "../constants.js";
import { showToast } from "./toast.js";

function isoDateStamp(){
  var d = new Date();
  var mm = String(d.getMonth() + 1).padStart(2, "0");
  var dd = String(d.getDate()).padStart(2, "0");
  var hh = String(d.getHours()).padStart(2, "0");
  var mi = String(d.getMinutes()).padStart(2, "0");
  var ss = String(d.getSeconds()).padStart(2, "0");
  return d.getFullYear() + "-" + mm + "-" + dd + "_" + hh + "-" + mi + "-" + ss;
}
// Encryption is entirely client-side (Web Crypto API): a passphrase derives an
// AES-256-GCM key via PBKDF2 (250k iterations, random salt), which encrypts the
// backup JSON. Nothing is sent anywhere — same privacy promise as the rest of the
// app — this only protects the exported *file* if it ends up somewhere less trusted
// than this browser (cloud sync, email, a shared drive). Forgetting the passphrase
// means the backup is unrecoverable; there's no reset path by design.
function bufToBase64(buf){
  var bytes = new Uint8Array(buf), binary = "";
  for(var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
function base64ToBuf(b64){
  var binary = atob(b64), bytes = new Uint8Array(binary.length);
  for(var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
function deriveBackupKey(passphrase, saltBytes){
  var enc = new TextEncoder();
  return crypto.subtle.importKey("raw", enc.encode(passphrase), {name: "PBKDF2"}, false, ["deriveKey"])
    .then(function(keyMaterial){
      return crypto.subtle.deriveKey(
        {name: "PBKDF2", salt: saltBytes, iterations: 250000, hash: "SHA-256"},
        keyMaterial, {name: "AES-GCM", length: 256}, false, ["encrypt", "decrypt"]
      );
    });
}
function encryptBackup(payloadStr, passphrase){
  var salt = crypto.getRandomValues(new Uint8Array(16));
  var iv = crypto.getRandomValues(new Uint8Array(12));
  return deriveBackupKey(passphrase, salt).then(function(key){
    var enc = new TextEncoder();
    return crypto.subtle.encrypt({name: "AES-GCM", iv: iv}, key, enc.encode(payloadStr)).then(function(ciphertextBuf){
      return JSON.stringify({
        wealthPlannerEncrypted: true, v: 1,
        salt: bufToBase64(salt), iv: bufToBase64(iv), ciphertext: bufToBase64(ciphertextBuf)
      }, null, 2);
    });
  });
}
export function decryptBackup(envelope, passphrase){
  var salt = new Uint8Array(base64ToBuf(envelope.salt));
  var iv = new Uint8Array(base64ToBuf(envelope.iv));
  return deriveBackupKey(passphrase, salt).then(function(key){
    return crypto.subtle.decrypt({name: "AES-GCM", iv: iv}, key, base64ToBuf(envelope.ciphertext)).then(function(plainBuf){
      return new TextDecoder().decode(plainBuf);
    });
  });
}

export function doExport(){
  var passphrase = prompt("Optional: encrypt this backup with a passphrase (leave blank for a plain, unencrypted backup as before). You'll need this exact passphrase to import it again — it can't be recovered if you forget it.");
  if(passphrase === null) return;
  var payload = JSON.stringify(state, null, 2);
  var filename = "wealth-planner-backup-" + isoDateStamp() + (passphrase ? "-encrypted" : "") + ".json";
  if(passphrase){
    encryptBackup(payload, passphrase).then(function(encPayload){
      finishExport(encPayload, filename);
    }).catch(function(){
      showToast("Encryption failed — nothing was exported. Try again.");
    });
  } else {
    finishExport(payload, filename);
  }
}
function finishExport(payload, filename, mime, savedMsg){
  mime = mime || "application/json";
  savedMsg = savedMsg || "Backup saved";
  if(window.claude && window.claude.use){
    window.claude.use("downloads").then(function(downloads){
      if(!downloads){ shareExport(payload, filename, mime, savedMsg); return; }
      downloads.save({filename: filename, data: payload}).then(function(){
        showToast(savedMsg);
      }).catch(function(err){
        if(err && err.code === "declined") return;
        shareExport(payload, filename, mime, savedMsg);
      });
    }).catch(function(){ shareExport(payload, filename, mime, savedMsg); });
  } else {
    shareExport(payload, filename, mime, savedMsg);
  }
}
// On iPad/Android, a plain download link just dumps the file into Downloads with no
// choice of where it goes — the same friction Import avoids by using the OS's native
// file picker. navigator.canShare() lets us check, synchronously and before ever
// calling .share(), whether this browser can hand a File to the OS share sheet (Save
// to Files, Drive, AirDrop, etc.) instead. Desktop browsers mostly don't support
// sharing files this way, so canShare() correctly returns false there and we fall
// straight through to the existing download-link behavior, unchanged.
function shareExport(payload, filename, mime, savedMsg){
  try{
    var file = new File([payload], filename, {type: mime});
    if(navigator.canShare && navigator.canShare({files: [file]})){
      navigator.share({files: [file], title: filename}).then(function(){
        showToast(savedMsg.replace("saved", "shared"));
      }).catch(function(err){
        if(err && err.name === "AbortError") return; // user dismissed the share sheet — not a failure
        fallbackExport(payload, filename, mime, savedMsg);
      });
      return;
    }
  }catch(e){ /* fall through to the direct download */ }
  fallbackExport(payload, filename, mime, savedMsg);
}
function fallbackExport(payload, filename, mime, savedMsg){
  try{
    var blob = new Blob([payload], {type: mime});
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
    showToast(savedMsg);
  }catch(e){
    showToast("Couldn't save a file here — copy is in your clipboard? Try again from a full browser tab.");
  }
}

// ---------------- Per-section CSV export ----------------
// A lighter-weight sibling to the full JSON backup above: one section's rows as a plain CSV,
// for opening in a spreadsheet, sharing with an accountant, or a quick sanity check — not a
// backup/restore format, so there's no matching CSV import (yet).
function csvCell(v){
  var s = v == null ? "" : String(v);
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function buildCsv(headers, rows){
  var lines = [headers.map(csvCell).join(",")];
  rows.forEach(function(row){ lines.push(row.map(csvCell).join(",")); });
  return lines.join("\r\n");
}
function exportCsv(filename, headers, rows){
  if(!rows.length){ showToast("Nothing to export yet"); return; }
  finishExport(buildCsv(headers, rows), filename, "text/csv", "CSV saved");
}

export function exportIncomeCsv(){
  var headers = ["What", "Person", "Type", "Amount", "Frequency", "Super", "Sacrifice mode", "Sacrifice value", "Account"];
  var rows = state.income.filter(function(i){ return !i.computed; }).map(function(i){
    return [i.what, i.person || "", i.incomeType || "Net", i.amount, i.freq, i.superMode || "", sacrificeModeToLabel(i.sacrificeMode), i.sacrificeValue || "", i.account || ""];
  });
  exportCsv("income-" + isoDateStamp() + ".csv", headers, rows);
}
export function exportExpensesCsv(){
  var headers = ["What", "Classification", "Amount", "Frequency", "Account"];
  var rows = state.shared.map(function(i){
    return [i.what, i.classification || "", i.amount, i.freq, i.account || ""];
  });
  exportCsv("expenses-" + isoDateStamp() + ".csv", headers, rows);
}
export function exportAssetsCsv(){
  var headers = ["What", "Category", "Amount", "Symbol", "Market", "Quantity", "Avg cost", "Price", "Person", "Purchase price", "Purchase date", "Depreciation %/yr"];
  var rows = state.assets.map(function(a){
    return [a.what, a.category || "", a.amount, a.symbol || "", a.market || "", a.quantity != null ? a.quantity : "", a.avgCost != null ? a.avgCost : "", a.price != null ? a.price : "", a.person || "", a.purchasePrice != null ? a.purchasePrice : "", a.purchaseDate || "", a.depreciationRate != null ? a.depreciationRate : ""];
  });
  exportCsv("assets-" + isoDateStamp() + ".csv", headers, rows);
}
export function exportPropertyLoansCsv(){
  var headers = ["Property", "What", "Balance", "Rate %", "Term (yrs)", "Type", "Repayment mode", "Manual repayment amount", "Offset balance"];
  var rows = [];
  state.properties.forEach(function(p){
    (p.loans || []).forEach(function(l){
      var rateDisplay = Math.round((Number(l.rate) || 0) * 100) / 100;
      rows.push([p.what, l.what, l.balance, rateDisplay, l.termYears, l.repaymentType, l.repaymentMode, l.repaymentMode === "manual" ? l.manualRepaymentAmount : "", l.offsetBalance]);
    });
  });
  exportCsv("property-loans-" + isoDateStamp() + ".csv", headers, rows);
}
