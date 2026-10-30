// ---------------- Receipts on a transaction (v3.170.0, item 201) ----------------
//
// For an Australian return a deduction needs its receipt, and the shoebox was the only place for it.
// A photo or PDF can now be attached to any transaction, budget line, deduction row on the tax-year
// worksheet, or a document on Tax → Documents. The file itself lives in IndexedDB on the device
// (lib/receipts.js) — localStorage is a few megabytes, a phone photo is several — and what the row
// carries is a reference: owner.receipts = [{ id, name, type, size, added }]. That keeps every list
// drawable without waiting on the database, and it's what syncs and merges like any other field.
//
// The files travel with the data: a backup or sync file carries them as `receiptFiles`
// ({ id: { name, type, size, added, data (base64) } }), packed when it's written and unpacked into
// IndexedDB when it's read (withReceiptFiles / takeReceiptFiles). Only receipts something still
// refers to are packed. Pure: no DOM, no IndexedDB.

export var MAX_FILE_BYTES = 4 * 1024 * 1024;   // a PDF over this is turned away
export var IMAGE_MAX_SIDE = 1600;              // photos are shrunk to this, as JPEG, on the device

// Every receipt reference in the household's data, wherever it's attached.
export function receiptRefs(st){
  st = st || {};
  var out = [];
  var take = function(holder){ (holder && Array.isArray(holder.receipts) ? holder.receipts : []).forEach(function(r){ if(r && r.id) out.push(r); }); };
  (st.transactions || []).forEach(take);
  (st.shared || []).forEach(take);
  Object.keys(st.home || {}).forEach(function(k){ (st.home[k] || []).forEach(take); });
  Object.keys(st.taxYears || {}).forEach(function(fy){
    var rec = st.taxYears[fy] || {};
    Object.keys(rec.people || {}).forEach(function(p){ ((rec.people[p] || {}).deductions || []).forEach(take); });
    Object.keys(rec.evidenceReceipts || {}).forEach(function(k){ take({ receipts: rec.evidenceReceipts[k] }); });
  });
  return out;
}
export function receiptIds(st){
  var seen = {};
  receiptRefs(st).forEach(function(r){ seen[r.id] = true; });
  return Object.keys(seen);
}

// Attach and detach: the reference only — the caller stores or forgets the file.
export function attachReceipt(holder, ref){
  if(!holder || !ref || !ref.id) return null;
  if(!Array.isArray(holder.receipts)) holder.receipts = [];
  if(!holder.receipts.some(function(r){ return r.id === ref.id; })) holder.receipts.push({ id: ref.id, name: ref.name || "Receipt", type: ref.type || "", size: Number(ref.size) || 0, added: ref.added || "" });
  return holder.receipts;
}
export function detachReceipt(holder, id){
  if(!holder || !Array.isArray(holder.receipts)) return null;
  var i = holder.receipts.findIndex(function(r){ return r.id === id; });
  if(i === -1) return null;
  var gone = holder.receipts.splice(i, 1)[0];
  if(!holder.receipts.length) delete holder.receipts;
  return gone;
}

// Whether a file can be kept: an image (any size — it's shrunk first) or a PDF under the cap.
export function receiptAccepts(file){
  var type = String(file && file.type || ""), name = String(file && file.name || "");
  var isImage = /^image\//.test(type) || /\.(jpe?g|png|gif|webp|heic|heif)$/i.test(name);
  var isPdf = type === "application/pdf" || /\.pdf$/i.test(name);
  if(!isImage && !isPdf) return { ok: false, reason: "A receipt has to be a photo or a PDF." };
  if(isPdf && (Number(file.size) || 0) > MAX_FILE_BYTES) return { ok: false, reason: "That PDF is over 4 MB — a receipt that size is usually a scan at too high a setting." };
  return { ok: true, image: isImage };
}
// The size to shrink a photo to, keeping its shape.
export function shrunkSize(w, h, max){
  max = max || IMAGE_MAX_SIDE;
  var scale = Math.min(1, max / Math.max(w || 1, h || 1));
  return { w: Math.max(1, Math.round(w * scale)), h: Math.max(1, Math.round(h * scale)) };
}

// A copy of the data with the files it refers to — what a backup or sync file holds. `files` is
// { id: { name, type, size, added, data } } as read from IndexedDB; unreferenced ones stay behind.
export function withReceiptFiles(st, files){
  var ids = receiptIds(st), packed = {};
  ids.forEach(function(id){ if(files && files[id]) packed[id] = files[id]; });
  var out = Object.assign({}, st);
  if(Object.keys(packed).length) out.receiptFiles = packed; else delete out.receiptFiles;
  return out;
}
// The other way: the files, taken out of a loaded backup or sync copy (which is left without them).
export function takeReceiptFiles(obj){
  if(!obj || typeof obj !== "object") return {};
  var files = obj.receiptFiles && typeof obj.receiptFiles === "object" ? obj.receiptFiles : {};
  delete obj.receiptFiles;
  return files;
}

// Tax → Documents: every deduction for the year, and whether it has its receipt. Two kinds: a
// transaction logged against a deductible budget line in the year (its own receipt, or one on the
// line — an annual invoice covers the year's payments), and a deduction typed on the worksheet.
// opts: { lines (every budget line), window ({ start, end }), fy, nameOf(t) }.
export function deductionReceipts(st, opts){
  opts = opts || {};
  var win = opts.window || {};
  var byId = {};
  (opts.lines || []).forEach(function(l){ if(l && l.id) byId[l.id] = l; });
  var out = [];
  (st.transactions || []).forEach(function(t, i){
    var line = t && t.linkedExpenseId ? byId[t.linkedExpenseId] : null;
    if(!line || !line.deductible || !t.date || t.date < win.start || t.date > win.end) return;
    var own = (t.receipts || []).length, onLine = (line.receipts || []).length;
    out.push({ kind: "tx", key: "tx:" + (t.id || i), index: i, date: t.date, what: opts.nameOf ? opts.nameOf(t) : (t.what || line.what), line: line.what,
      person: line.claimProperty ? "" : (line.deductiblePerson || ""), amount: Number(t.amount) || 0, receipts: t.receipts || [], hasReceipt: own > 0 || onLine > 0, viaLine: !own && onLine > 0 });
  });
  var rec = (st.taxYears || {})[opts.fy] || {};
  Object.keys(rec.people || {}).forEach(function(p){
    ((rec.people[p] || {}).deductions || []).forEach(function(d, i){
      if(!(Number(d.amount) > 0) && !d.what) return;
      out.push({ kind: "ded", key: "ded:" + opts.fy + ":" + p + ":" + i, person: p, index: i, date: "", what: d.what || (d.label || "D5") + " deduction", line: d.label || "D5",
        amount: Number(d.amount) || 0, receipts: d.receipts || [], hasReceipt: (d.receipts || []).length > 0, viaLine: false });
    });
  });
  return out.sort(function(a, b){ return (a.hasReceipt === b.hasReceipt ? 0 : a.hasReceipt ? 1 : -1) || (a.date < b.date ? 1 : a.date > b.date ? -1 : 0); });
}
