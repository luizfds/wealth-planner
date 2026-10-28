import { dropboxConnected, listDropboxFolder, downloadDropboxFile, moveDropboxFile } from "./dropbox.js";
import { savedFolder } from "./safekeeping.js";
import { INBOX_DIR, DONE_DIR, statementFiles } from "../calc/inbox.js";

// ---------------- Statements from a folder (v3.142.0, item 181) — calc/inbox.js has the rules ----------------
// Where the files are: Dropbox's Statements folder when Dropbox is connected on this device, and the
// Statements folder inside the backup folder when the browser still has permission for it (never
// asked for on opening — a prompt nobody requested is worse than a statement left for later).
// Each file comes back as { name, modified, size, via, label, ref }; `ref` is what that place needs.

function fromDropbox(){
  if(!dropboxConnected()) return Promise.resolve([]);
  return listDropboxFolder("/" + INBOX_DIR).then(function(list){
    return list.map(function(f){ return Object.assign(f, { via: "dropbox", label: "Dropbox", ref: f.path }); });
  }).catch(function(){ return []; });
}
function fromFolder(){
  return savedFolder().then(function(handle){
    if(!handle || typeof handle.queryPermission !== "function") return [];
    return handle.queryPermission({ mode: "readwrite" }).then(function(p){
      if(p !== "granted") return [];
      return handle.getDirectoryHandle(INBOX_DIR).then(function(dir){
        var out = [];
        var it = dir.values();
        var step = function(){
          return it.next().then(function(n){
            if(n.done) return out;
            if(n.value.kind !== "file") return step();
            return n.value.getFile().then(function(f){
              out.push({ name: f.name, modified: new Date(f.lastModified).toISOString(), size: f.size, via: "folder", label: handle.name, ref: { dir: dir, name: f.name } });
              return step();
            });
          });
        };
        return step();
      }, function(){ return []; });
    });
  }).catch(function(){ return []; });
}

// Everything waiting, oldest first.
export function listInbox(){
  return Promise.all([fromDropbox(), fromFolder()]).then(function(r){ return statementFiles(r[0].concat(r[1])); });
}

// The file itself, as a File the importer takes.
export function readInboxFile(f){
  if(f.via === "dropbox") return downloadDropboxFile(f.ref).then(function(blob){ return new File([blob], f.name, { type: blob.type || "" }); });
  return f.ref.dir.getFileHandle(f.ref.name).then(function(h){ return h.getFile(); });
}

// Out of the way, into Statements/Imported — kept, not deleted, so nothing is ever lost.
export function markInboxFileImported(f){
  if(f.via === "dropbox") return moveDropboxFile(f.ref, "/" + INBOX_DIR + "/" + DONE_DIR + "/" + f.name);
  var dir = f.ref.dir;
  return dir.getDirectoryHandle(DONE_DIR, { create: true }).then(function(done){
    return dir.getFileHandle(f.ref.name).then(function(h){
      if(typeof h.move === "function") return h.move(done).catch(function(){ return copyThenRemove(h, done, dir, f.ref.name); });
      return copyThenRemove(h, done, dir, f.ref.name);
    });
  });
}
function copyThenRemove(h, done, dir, name){
  return h.getFile().then(function(file){
    return done.getFileHandle(name, { create: true }).then(function(nh){ return nh.createWritable(); })
      .then(function(w){ return w.write(file).then(function(){ return w.close(); }); })
      .then(function(){ return dir.removeEntry(name); });
  });
}
