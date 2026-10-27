import { state, deviceId } from "../state.js";
import { savedFolder, idb } from "./safekeeping.js";
import { deriveBackupKey, bufToBase64, base64ToBuf } from "./backup.js";
import { SYNC_FILE, syncDecision, makeEnvelope, readEnvelope, contentHash } from "../calc/syncfile.js";

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

function permitted(handle, interactive){
  var opts = { mode: "readwrite" };
  return handle.queryPermission(opts).then(function(p){ return p === "granted" ? p : (interactive ? handle.requestPermission(opts) : p); });
}
function readFile(handle){
  return handle.getFileHandle(SYNC_FILE).then(function(fh){ return fh.getFile(); }).then(function(f){ return f.text(); })
    .then(readEnvelope).catch(function(){ return null; });
}
function writeFile(handle, envelope){
  return handle.getFileHandle(SYNC_FILE, { create: true }).then(function(fh){ return fh.createWritable(); })
    .then(function(w){ return w.write(JSON.stringify(envelope)).then(function(){ return w.close(); }); });
}
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

// Turning it on (or on a new device): the passphrase becomes this device's key. If the folder already
// holds a sync file, the passphrase has to open it. Resolves { ok, reason }.
export function unlockSync(passphrase, interactive){
  return savedFolder().then(function(handle){
    if(!handle) return { ok: false, reason: "no-folder" };
    return permitted(handle, interactive).then(function(p){
      if(p !== "granted") return { ok: false, reason: "permission" };
      return readFile(handle).then(function(env){
        var salt = env ? env.salt : bufToBase64(crypto.getRandomValues(new Uint8Array(16)));
        return deriveBackupKey(passphrase, new Uint8Array(base64ToBuf(salt))).then(function(key){
          var rec = { key: key, salt: salt };
          var check = env ? decrypt(rec, env).then(function(){ return true; }, function(){ return false; }) : Promise.resolve(true);
          return check.then(function(ok){
            if(!ok) return { ok: false, reason: "wrong-passphrase" };
            return putKey(rec).then(function(){ setSyncLocal({ on: true }); return { ok: true, existing: !!env }; });
          });
        });
      });
    });
  });
}

// One round. opts.interactive may ask for folder permission (needs a click); opts.force "push" or
// "pull" settles a conflict. Resolves { status, … }: "no-folder" | "paused" | "locked" | "same" |
// "pushed" | "pull" (with `text`, the decrypted state, and `rev` — the caller applies it, then calls
// pulled(rev)) | "conflict" (with the file's savedAt/savedBy) | "other-key" (the file was started
// again with another passphrase).
export function syncNow(opts){
  opts = opts || {};
  var local = syncLocal();
  if(!local.on) return Promise.resolve({ status: "off" });
  return savedFolder().then(function(handle){
    if(!handle) return { status: "no-folder" };
    return permitted(handle, !!opts.interactive).then(function(p){
      if(p !== "granted") return { status: "paused", folder: handle.name };
      return getKey().then(function(keyRec){
        if(!keyRec) return { status: "locked", folder: handle.name };
        return readFile(handle).then(function(env){
          if(env && env.salt !== keyRec.salt) return { status: "other-key", folder: handle.name, savedAt: env.savedAt, savedBy: env.savedBy };
          var d = opts.force || syncDecision(local, env);
          if(d === "same") return { status: "same", folder: handle.name, rev: local.base };
          if(d === "conflict") return { status: "conflict", folder: handle.name, savedAt: env.savedAt, savedBy: env.savedBy, fromThisDevice: env.savedBy === deviceId() };
          if(d === "pull") return decrypt(keyRec, env).then(function(text){ return { status: "pull", folder: handle.name, text: text, rev: Number(env.rev) || 0, savedAt: env.savedAt }; });
          var rev = Math.max(env ? Number(env.rev) || 0 : 0, Number(local.base) || 0) + 1;
          var meta = { rev: rev, savedAt: new Date().toISOString(), savedBy: deviceId() };
          return encrypt(keyRec, JSON.stringify(state)).then(function(c){ return writeFile(handle, makeEnvelope(meta, c)); }).then(function(){
            setSyncLocal({ base: rev, dirty: false, hash: contentHash(state), lastAt: meta.savedAt });
            return { status: "pushed", folder: handle.name, rev: rev };
          });
        });
      });
    });
  });
}
// After the caller has applied a pulled copy.
// After the caller has applied a pulled copy (and migrated it): this content is where the device now is.
export function pulled(rev){ setSyncLocal({ base: rev, dirty: false, hash: contentHash(state), lastAt: new Date().toISOString() }); }
// Called after each save: this device has changes to send only when the content differs from what it
// last sent or loaded — not every save is an edit.
export function markChanged(){
  var l = syncLocal();
  if(!l.on) return false;
  var dirty = contentHash(state) !== l.hash;
  if(dirty !== !!l.dirty) setSyncLocal({ dirty: dirty });
  return dirty;
}
export function stopSync(){ setSyncLocal({ on: false, base: 0, dirty: false }); return forgetSyncKey(); }
