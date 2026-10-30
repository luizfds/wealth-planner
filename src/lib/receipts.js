// ---------------- Receipts' files on this device (v3.170.0, item 201) — calc/receipts.js decides ----------------
//
// The bytes of each receipt, in IndexedDB (its own database, so clearing it never touches sync's or
// the backup folder's). A photo is shrunk here before it's kept; a PDF is kept as it is, under the cap.
// packReceipts / unpackReceipts turn the store into the `receiptFiles` a backup or sync file carries.

import { receiptAccepts, shrunkSize, receiptIds, IMAGE_MAX_SIDE } from "../calc/receipts.js";
import { bufToBase64, base64ToBuf } from "./backup.js";

var DB = "wealthPlanner.receipts", STORE = "files";

function store(mode, fn){
  return new Promise(function(resolve, reject){
    if(typeof indexedDB === "undefined"){ reject(new Error("no-indexeddb")); return; }
    var req = indexedDB.open(DB, 1);
    req.onupgradeneeded = function(){ req.result.createObjectStore(STORE, { keyPath: "id" }); };
    req.onerror = function(){ reject(req.error); };
    req.onsuccess = function(){
      var tx = req.result.transaction(STORE, mode);
      var r = fn(tx.objectStore(STORE));
      tx.oncomplete = function(){ req.result.close(); resolve(r && r.result); };
      tx.onerror = function(){ req.result.close(); reject(tx.error); };
    };
  });
}
function newId(){ return "rc" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

// A photo, redrawn no larger than IMAGE_MAX_SIDE as a JPEG; anything that can't be drawn is kept as it is.
function shrinkImage(file){
  if(typeof createImageBitmap !== "function" || typeof document === "undefined") return Promise.resolve(file);
  return createImageBitmap(file).then(function(bmp){
    var size = shrunkSize(bmp.width, bmp.height, IMAGE_MAX_SIDE);
    var c = document.createElement("canvas");
    c.width = size.w; c.height = size.h;
    c.getContext("2d").drawImage(bmp, 0, 0, size.w, size.h);
    return new Promise(function(resolve){ c.toBlob(function(b){ resolve(b && b.size < file.size ? b : file); }, "image/jpeg", 0.82); });
  }).catch(function(){ return file; });
}

// Keeps a chosen file and resolves to the reference a row stores: { id, name, type, size, added }.
// Rejects with { reason } for anything that isn't a photo or a PDF under the cap.
export function saveReceiptFile(file, today){
  var ok = receiptAccepts(file);
  if(!ok.ok) return Promise.reject({ reason: ok.reason });
  return (ok.image ? shrinkImage(file) : Promise.resolve(file)).then(function(blob){
    var name = String(file.name || "Receipt");
    if(blob !== file && !/\.jpe?g$/i.test(name)) name = name.replace(/\.[^.]+$/, "") + ".jpg";
    var rec = { id: newId(), name: name, type: blob.type || file.type || "", size: blob.size, added: today || "", blob: blob };
    return store("readwrite", function(s){ return s.put(rec); }).then(function(){ return { id: rec.id, name: rec.name, type: rec.type, size: rec.size, added: rec.added }; });
  });
}
export function getReceiptFile(id){ return store("readonly", function(s){ return s.get(id); }).catch(function(){ return null; }); }
export function deleteReceiptFile(id){ return store("readwrite", function(s){ return s.delete(id); }).catch(function(){}); }
function allFiles(){ return store("readonly", function(s){ return s.getAll(); }).catch(function(){ return []; }); }

// How much the receipts on this device take — for Settings → Preferences beside localStorage's use.
export function receiptsStorageUse(){
  return allFiles().then(function(all){ return { count: all.length, bytes: all.reduce(function(n, r){ return n + (Number(r.size) || 0); }, 0) }; });
}
// Opens a receipt to look at, in a new tab (a phone's viewer for a PDF).
export function openReceipt(id){
  var w = typeof window !== "undefined" ? window.open("", "_blank") : null;
  return getReceiptFile(id).then(function(rec){
    if(!rec || !rec.blob){ if(w) w.close(); return false; }
    var url = URL.createObjectURL(rec.blob);
    if(w) w.location.href = url; else window.location.href = url;
    setTimeout(function(){ URL.revokeObjectURL(url); }, 60000);
    return true;
  });
}

// For a backup or sync file: the files the data refers to, as base64.
export function packReceipts(st){
  var want = {};
  receiptIds(st).forEach(function(id){ want[id] = true; });
  if(!Object.keys(want).length) return Promise.resolve({});
  return allFiles().then(function(all){
    var out = {};
    return Promise.all(all.filter(function(r){ return want[r.id] && r.blob; }).map(function(r){
      return r.blob.arrayBuffer().then(function(buf){ out[r.id] = { name: r.name, type: r.type, size: r.size, added: r.added || "", data: bufToBase64(buf) }; });
    })).then(function(){ return out; });
  });
}
// From a loaded backup or sync copy: each file this device doesn't have yet goes into the store.
export function unpackReceipts(files){
  var ids = Object.keys(files || {});
  if(!ids.length) return Promise.resolve(0);
  return allFiles().then(function(all){
    var have = {};
    all.forEach(function(r){ have[r.id] = true; });
    var add = ids.filter(function(id){ return !have[id] && files[id] && files[id].data; });
    if(!add.length) return 0;
    return store("readwrite", function(s){
      add.forEach(function(id){
        var f = files[id];
        s.put({ id: id, name: f.name || "Receipt", type: f.type || "", size: Number(f.size) || 0, added: f.added || "", blob: new Blob([base64ToBuf(f.data)], { type: f.type || "" }) });
      });
    }).then(function(){ return add.length; });
  });
}
// Files nothing refers to any more (a deleted transaction's, a removed receipt's) — dropped at startup.
export function pruneReceipts(st){
  var want = {};
  receiptIds(st).forEach(function(id){ want[id] = true; });
  return allFiles().then(function(all){
    var gone = all.filter(function(r){ return !want[r.id]; }).map(function(r){ return r.id; });
    if(!gone.length) return 0;
    return store("readwrite", function(s){ gone.forEach(function(id){ s.delete(id); }); }).then(function(){ return gone.length; });
  });
}
