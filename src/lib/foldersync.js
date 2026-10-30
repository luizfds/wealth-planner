import { state, deviceId } from "../state.js";
import { savedFolder, idb } from "./safekeeping.js";
import { packReceipts } from "./receipts.js";
import { withReceiptFiles } from "../calc/receipts.js";
import { deriveBackupKey, bufToBase64, base64ToBuf } from "./backup.js";
import { SYNC_FILE, syncDecision, makeEnvelope, readEnvelope, contentHash } from "../calc/syncfile.js";
import { dropboxConnected, readDropbox, writeDropbox, disconnectDropbox } from "./dropbox.js";

// ---------------- Sync through a synced folder (v3.134.0) — calc/syncfile.js has the rules ----------------
// The file and the crypto. The key is derived from the passphrase (PBKDF2, the same as encrypted
// backups) with the sync file's own salt, so every device typing the same passphrase gets the same
// key; it's kept on this device in IndexedDB as a non-extractable CryptoKey, so the passphrase is
// asked once per device and never stored. This device's memory of the sync (on, base rev, changed
// since) lives in localStorage, not in `state`, so it never travels inside the file.
var LOCAL = "wealthPlanner.sync", KEY_ID = "syncKey";

export function syncLocal(){ try { return JSON.parse(localStorage.getItem(LOCAL) || "null") || { on: false, base: 0, dirty: false }; } catch(e){ return { on: false, base: 0, dirty: false }; } }
export function setSyncLocal(patch){ var l = Object.assign(syncLocal(), patch); try { localStorage.setItem(LOCAL, JSON.stringify(l)); } catch(e){} return l; }
export function syncOn(){ return !!syncLocal().on; }

function getKey(){ return idb("readonly", function(s){ return s.get(KEY_ID); }).catch(function(){ return null; }); }
function putKey(rec){ return idb("readwrite", function(s){ return s.put(rec, KEY_ID); }); }
export function forgetSyncKey(){ return idb("readwrite", function(s){ return s.delete(KEY_ID); }).catch(function(){}); }
// v3.143.0 (item 182): the copy this device and the file last agreed on — what a merge measures
// both sides' changes from. Plain JSON in this device's IndexedDB, like the data in localStorage.
var BASE_ID = "syncBase";
function putBase(text){ return idb("readwrite", function(s){ return s.put(text, BASE_ID); }).catch(function(){}); }
function getBase(){ return idb("readonly", function(s){ return s.get(BASE_ID); }).catch(function(){ return null; }); }

function permitted(handle, interactive){
  var opts = { mode: "readwrite" };
  return handle.queryPermission(opts).then(function(p){ return p === "granted" ? p : (interactive ? handle.requestPermission(opts) : p); });
}

// ---- Where the file lives (v3.136.0) ----
// A transport opens (or says why it can't), reads the envelope (with its own revision, if it keeps
// one) and writes it. The folder is the first way; Dropbox the second.
var FOLDER = {
  open: function(interactive){
    return savedFolder().then(function(handle){
      if(!handle) return { ok: false, status: "no-folder" };
      return permitted(handle, interactive).then(function(p){ return p === "granted" ? { ok: true, label: handle.name, handle: handle } : { ok: false, status: "paused", label: handle.name }; });
    });
  },
  read: function(o){
    return o.handle.getFileHandle(SYNC_FILE).then(function(fh){ return fh.getFile(); }).then(function(f){ return f.text(); })
      .then(function(t){ return { env: readEnvelope(t), rev: null }; }).catch(function(){ return { env: null, rev: null }; });
  },
  write: function(o, text){
    return o.handle.getFileHandle(SYNC_FILE, { create: true }).then(function(fh){ return fh.createWritable(); })
      .then(function(w){ return w.write(text).then(function(){ return w.close(); }); });
  }
};
var DROPBOX = {
  open: function(){ return Promise.resolve(dropboxConnected() ? { ok: true, label: "Dropbox" } : { ok: false, status: "not-connected", label: "Dropbox" }); },
  read: function(){ return readDropbox().then(function(r){ return r ? { env: readEnvelope(r.text), rev: r.rev } : { env: null, rev: null }; }); },
  write: function(o, text, rev){ return writeDropbox(text, rev); }
};
export function syncVia(){ return syncLocal().via === "dropbox" ? "dropbox" : "folder"; }
function transport(via){ return (via || syncVia()) === "dropbox" ? DROPBOX : FOLDER; }

function encrypt(keyRec, text){
  var iv = crypto.getRandomValues(new Uint8Array(12));
  return crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, keyRec.key, new TextEncoder().encode(text)).then(function(buf){
    return { salt: keyRec.salt, iv: bufToBase64(iv), ciphertext: bufToBase64(buf) };
  });
}
function decrypt(keyRec, env){
  return crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(base64ToBuf(env.iv)) }, keyRec.key, base64ToBuf(env.ciphertext))
    .then(function(buf){ return new TextDecoder().decode(buf); });
}

// Turning it on (or on a new device): the passphrase becomes this device's key. If the folder (or
// Dropbox) already holds a sync file, the passphrase has to open it. `via` is "folder" or "dropbox".
// Resolves { ok, reason, existing }.
export function unlockSync(passphrase, interactive, via){
  via = via || syncVia();
  var t = transport(via);
  return t.open(interactive).then(function(o){
    if(!o.ok) return { ok: false, reason: o.status === "no-folder" ? "no-folder" : o.status === "not-connected" ? "not-connected" : "permission" };
    return t.read(o).then(function(r){
      var env = r.env;
      var salt = env ? env.salt : bufToBase64(crypto.getRandomValues(new Uint8Array(16)));
      return deriveBackupKey(passphrase, new Uint8Array(base64ToBuf(salt))).then(function(key){
        var rec = { key: key, salt: salt };
        var check = env ? decrypt(rec, env).then(function(){ return true; }, function(){ return false; }) : Promise.resolve(true);
        return check.then(function(ok){
          if(!ok) return { ok: false, reason: "wrong-passphrase" };
          // A different way than before starts this device afresh against what's there.
          var was = syncLocal();
          return putKey(rec).then(function(){ setSyncLocal(was.via === via ? { on: true, via: via } : { on: true, via: via, base: 0, dirty: false, hash: null }); return { ok: true, existing: !!env }; });
        });
      });
    });
  });
}

// One round. opts.interactive may ask for folder permission (needs a click); opts.force "push" or
// "pull" settles a conflict. Resolves { status, folder (where: a folder's name or "Dropbox"), … }:
// "no-folder" | "paused" | "not-connected" | "locked" | "same" | "pushed" | "pull" (with `text`, the
// decrypted state, and `rev` — the caller applies it, then calls pulled(rev)) | "conflict" (with the
// file's savedAt/savedBy) | "other-key" (the file was started again with another passphrase).
// A Dropbox write that lost a race to another device reads again, once.
export function syncNow(opts, retried){
  opts = opts || {};
  var local = syncLocal();
  if(!local.on) return Promise.resolve({ status: "off" });
  var t = transport();
  return t.open(!!opts.interactive).then(function(o){
    if(!o.ok) return { status: o.status, folder: o.label };
    return getKey().then(function(keyRec){
      if(!keyRec) return { status: "locked", folder: o.label };
      return t.read(o).then(function(r){
        var env = r.env;
        if(env && env.salt !== keyRec.salt) return { status: "other-key", folder: o.label, savedAt: env.savedAt, savedBy: env.savedBy };
        var d = opts.force || syncDecision(local, env);
        if(d === "same") return { status: "same", folder: o.label, rev: local.base };
        // v3.143.0: with the agreed copy and theirs, the caller can merge rather than ask.
        if(d === "conflict") return Promise.all([decrypt(keyRec, env).catch(function(){ return null; }), getBase()]).then(function(x){
          return { status: "conflict", folder: o.label, savedAt: env.savedAt, savedBy: env.savedBy, fromThisDevice: env.savedBy === deviceId(),
            text: x[0], base: x[1] || null, rev: Number(env.rev) || 0 };
        });
        if(d === "pull") return decrypt(keyRec, env).then(function(text){ return { status: "pull", folder: o.label, text: text, rev: Number(env.rev) || 0, savedAt: env.savedAt }; });
        var rev = Math.max(env ? Number(env.rev) || 0 : 0, Number(local.base) || 0) + 1;
        var meta = { rev: rev, savedAt: new Date().toISOString(), savedBy: deviceId() };
        var plain = JSON.stringify(state);
        // v3.170.0: the file carries the receipts' files too; the agreed copy kept here doesn't need them.
        return packReceipts(state).then(function(files){ return encrypt(keyRec, JSON.stringify(withReceiptFiles(state, files))); })
          .then(function(c){ return t.write(o, JSON.stringify(makeEnvelope(meta, c)), r.rev); }).then(function(){
          setSyncLocal({ base: rev, dirty: false, hash: contentHash(state), lastAt: meta.savedAt });
          putBase(plain);
          return { status: "pushed", folder: o.label, rev: rev };
        }, function(e){
          if(e && e.message === "conflict" && !retried) return syncNow(Object.assign({}, opts, { force: null }), true);
          throw e;
        });
      });
    });
  }).catch(function(e){ if(e && e.message === "not-connected") return { status: "not-connected", folder: "Dropbox" }; throw e; });
}
// After the caller has applied a pulled copy (and migrated it): this content is where the device now is.
export function pulled(rev){ setSyncLocal({ base: rev, dirty: false, hash: contentHash(state), lastAt: new Date().toISOString() }); putBase(JSON.stringify(state)); }
// v3.143.0: after the caller has merged the file's copy (rev, `theirs` as loaded) into this device's:
// that copy is the new agreed one, and the merged result is a change to send.
export function merged(rev, theirsText){ setSyncLocal({ base: rev, dirty: true, hash: null }); return putBase(theirsText); }
// Called after each save: this device has changes to send only when the content differs from what it
// last sent or loaded — not every save is an edit.
export function markChanged(){
  var l = syncLocal();
  if(!l.on) return false;
  var dirty = contentHash(state) !== l.hash;
  if(dirty !== !!l.dirty) setSyncLocal({ dirty: dirty });
  return dirty;
}
export function stopSync(){
  var via = syncVia();
  setSyncLocal({ on: false, base: 0, dirty: false, hash: null });
  return forgetSyncKey().then(function(){ return via === "dropbox" ? disconnectDropbox() : null; });
}
