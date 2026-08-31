import { state } from "../state.js";
import { sacrificeModeToLabel } from "../constants.js";
import { showToast, showPersistentToast } from "./toast.js";

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
// ---------------- Share: hand the backup straight to another device ----------------
// Same underlying data as Export, but framed as a device-to-device transfer instead of a backup —
// the OS share sheet (AirDrop, Messages, email, whatever's installed) gets the file *and* a short
// explanation of what to do with it, so the "why am I looking at a .json file" confusion a bare
// Export never addressed doesn't happen on the receiving end.
//
// Unlike Export (where the passphrase is optional — the user controls where that downloaded file
// ends up), a passphrase here is mandatory: a share sheet is one fat-fingered tap from going to
// the wrong contact instead of AirDrop-to-self, and this is a full financial profile (income,
// tax, assets, super, property). Cancelling or leaving it blank aborts the share entirely rather
// than falling back to plaintext.
export function canShareFiles(){
  if(!navigator.canShare) return false;
  try{
    return navigator.canShare({ files: [new File(["x"], "x.json", { type: "application/json" })] });
  }catch(e){
    return false;
  }
}
// Mirrors nav.js's own BASE_PATH detection (GitHub Pages serves this project under a fixed
// /wealth-planner path; local dev and any custom domain serve it from root) — duplicated rather
// than imported so this lib file doesn't take on a dependency on a UI component module.
function appRootUrl(){
  var base = location.hostname.indexOf("github.io") !== -1 ? "/wealth-planner" : "";
  return location.origin + base + "/";
}
// A recipient who's never seen this app before landing straight on the Dashboard (empty, with no
// obvious connection to "someone just sent me a file") is a worse first impression than a short
// explainer page — welcome.html is a static page (not part of the SPA's client routing) that
// walks through saving the file, opening the app, and importing it.
function welcomeUrl(){
  return appRootUrl() + "welcome.html";
}
export function doShare(){
  if(!canShareFiles()){
    showToast("Sharing files isn't supported in this browser — use Export instead, then send the file yourself.");
    return;
  }
  var passphrase = prompt("Set a passphrase to protect this share (required — whoever you send this to will need it to open it). Choose one you can tell them separately, e.g. in person or by text.");
  if(!passphrase){
    if(passphrase !== null) showToast("A passphrase is required to share — nothing was sent.");
    return;
  }
  var payload = JSON.stringify(state, null, 2);
  var filename = "wealth-planner-backup-" + isoDateStamp() + "-encrypted.json";
  var text = "My Wealth Planner data (password-protected). Open " + welcomeUrl() + " for how to load it, or go straight to Import and enter the passphrase I gave you.";
  encryptBackup(payload, passphrase).then(function(encPayload){
    var file = new File([encPayload], filename, { type: "application/json" });
    // navigator.share() only works when it's the direct, synchronous result of a user gesture —
    // encryption above is async (Web Crypto), so by the time it resolves, the click that started
    // this has gone stale as far as some browsers are concerned. A persistent toast with its own
    // action button gives us a fresh, guaranteed-synchronous click to hang the real share() call
    // off of, instead of triggering it from inside this .then().
    showPersistentToast("Ready to share (encrypted)", "Send", function(){
      navigator.share({ files: [file], title: "Wealth Planner backup", text: text }).then(function(){
        showToast("Shared");
      }).catch(function(err){
        if(err && err.name === "AbortError") return; // user dismissed the share sheet — not a failure
        // The share sheet itself can still fail for reasons outside our control (confirmed: at
        // least one real Android device rejects this outright, even from a fresh synchronous
        // gesture — most likely no installed app declares it can receive an application/json
        // file). Rather than dead-end there, fall back to a direct download of the same encrypted
        // file — the user can still hand it over manually — and surface the real error (not just
        // a generic message) so a report of this actually says what the browser said.
        console.error("navigator.share() failed:", err);
        showToast("Couldn't open the share sheet" + (err && err.name ? " (" + err.name + ")" : "") + " — downloading the file instead.");
        fallbackExport(encPayload, filename, "application/json", "Backup saved");
      });
    });
  }).catch(function(){
    showToast("Encryption failed — nothing was shared. Try again.");
  });
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
// The exchange-qualified ticker GOOGLEFINANCE expects, matching the manual convention already
// documented in the "Paste prices" hint text (assets.js): ASX needs an "ASX:" prefix, US tickers
// take no prefix (GOOGLEFINANCE defaults to US exchanges), and crypto is a currency pair against
// USD, e.g. "BTCUSD".
function googleFinanceTicker(a){
  var symbol = (a.symbol || "").trim().toUpperCase();
  if(!symbol) return "";
  if(a.market === "ASX") return "ASX:" + symbol;
  if(a.market === "Crypto") return symbol + "USD";
  return symbol;
}
// Shared by both the file-download export and the clipboard copy below — every current
// Shares/Crypto holding, with a live GOOGLEFINANCE formula already written for it, so a
// first-time setup means paste-this-in rather than hand-typing one formula per holding. Symbol
// and Price are adjacent columns (matching what the paste-back box expects) so after Sheets
// evaluates the formulas, selecting and copying those two columns is a single drag.
function sharesPriceTemplateTable(){
  var headers = ["What", "Market", "Symbol", "Price"];
  var rows = state.assets.filter(function(a){ return a.category === "Shares"; }).map(function(a){
    var ticker = googleFinanceTicker(a);
    var formula = ticker ? '=GOOGLEFINANCE("' + ticker + '","price")' : "";
    return [a.what, a.market || "ASX", a.symbol || "", formula];
  });
  return { headers: headers, rows: rows };
}
// The formula text (leading "=", embedded commas/quotes) round-trips correctly through CSV
// import in both Sheets and Excel, which treat a leading "=" in an imported cell as a live
// formula — the same mechanism spreadsheet CSV exports commonly rely on for this.
export function exportSharesPriceTemplateCsv(){
  var t = sharesPriceTemplateTable();
  exportCsv("shares-price-template-" + isoDateStamp() + ".csv", t.headers, t.rows);
}
// Tab-separated instead of comma — matches what a real spreadsheet range copies as, so pasting
// directly into a Google Sheets cell lands each field in its own column (a comma-separated paste
// would just dump the whole row as literal text into one cell). Same leading-"=" formula
// behavior applies on a plain paste as it does on CSV import.
function tsvCell(v){
  var s = v == null ? "" : String(v);
  return s.replace(/[\t\r\n]/g, " ");
}
function buildTsv(headers, rows){
  var lines = [headers.map(tsvCell).join("\t")];
  rows.forEach(function(row){ lines.push(row.map(tsvCell).join("\t")); });
  return lines.join("\r\n");
}
// navigator.clipboard.writeText needs a secure context (https:, or localhost) and is only
// reliably grantable from a direct user-gesture click handler — both true here. Falls back to
// the hidden-textarea + execCommand("copy") trick for anything older/unsupported, same pattern
// browsers have used for clipboard writes since before the async Clipboard API existed.
function copyTextToClipboard(text){
  if(navigator.clipboard && navigator.clipboard.writeText){
    return navigator.clipboard.writeText(text);
  }
  return new Promise(function(resolve, reject){
    try{
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus(); ta.select();
      var ok = document.execCommand("copy");
      ta.remove();
      ok ? resolve() : reject(new Error("execCommand copy failed"));
    }catch(e){ reject(e); }
  });
}
export function copySharesPriceTemplateToClipboard(){
  var t = sharesPriceTemplateTable();
  if(!t.rows.length){ showToast("Nothing to copy yet"); return; }
  copyTextToClipboard(buildTsv(t.headers, t.rows)).then(function(){
    showToast("Copied — paste straight into a Google Sheets cell");
  }).catch(function(){
    showToast("Couldn't copy automatically — try the download button instead");
  });
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
