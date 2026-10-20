// ---------------- Reading a spreadsheet's cells (v3.96.0) ----------------
//
// Some brokers only export Excel (Stake's Investment Activity report is an .xlsx with a sheet per
// market). An .xlsx is a zip of XML files; this reads the zip's directory, inflates the parts it
// needs with the browser's own DecompressionStream, and pulls out each sheet's cells as a grid of
// strings. Values only — no formulas, styles or dates-as-serials beyond the number itself, which
// is all a trade list needs. No library, no network.
// Returns Promise<[{ name, grid: [[cell]] }]>.
function u16(b, o){ return b[o] | (b[o + 1] << 8); }
function u32(b, o){ return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0; }

function zipEntries(bytes){
  // End of central directory: the last "PK\x05\x06".
  var eocd = -1;
  for(var i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--){
    if(u32(bytes, i) === 0x06054b50){ eocd = i; break; }
  }
  if(eocd < 0) throw new Error("not a zip");
  var count = u16(bytes, eocd + 10), off = u32(bytes, eocd + 16), out = {};
  for(var n = 0; n < count; n++){
    if(u32(bytes, off) !== 0x02014b50) break;
    var method = u16(bytes, off + 10), csize = u32(bytes, off + 20);
    var nameLen = u16(bytes, off + 28), extraLen = u16(bytes, off + 30), commentLen = u16(bytes, off + 32);
    var local = u32(bytes, off + 42);
    var name = new TextDecoder().decode(bytes.subarray(off + 46, off + 46 + nameLen));
    var dataStart = local + 30 + u16(bytes, local + 26) + u16(bytes, local + 28);
    out[name] = { method: method, data: bytes.subarray(dataStart, dataStart + csize) };
    off += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}
function inflate(entry){
  if(entry.method === 0) return Promise.resolve(entry.data);
  if(entry.method !== 8) return Promise.reject(new Error("unsupported compression"));
  var stream = new Blob([entry.data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Response(stream).arrayBuffer().then(function(b){ return new Uint8Array(b); });
}
function text(entries, name){
  var e = entries[name];
  return e ? inflate(e).then(function(b){ return new TextDecoder().decode(b); }) : Promise.resolve(null);
}
function unxml(s){
  return String(s).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, function(_, d){ return String.fromCharCode(+d); }).replace(/&#x([0-9a-f]+);/gi, function(_, h){ return String.fromCharCode(parseInt(h, 16)); })
    .replace(/&amp;/g, "&");
}
function colIndex(ref){
  var m = /^([A-Z]+)/.exec(ref || ""), n = 0;
  if(!m) return -1;
  for(var i = 0; i < m[1].length; i++) n = n * 26 + (m[1].charCodeAt(i) - 64);
  return n - 1;
}
function runsText(xml){
  var out = "", re = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g, m;
  while((m = re.exec(xml))) out += unxml(m[1]);
  return out;
}
export function sheetGrid(xml, shared){
  var rows = [], rowRe = /<row\b[^>]*>([\s\S]*?)<\/row>/g, rm;
  while((rm = rowRe.exec(xml))){
    var row = [], cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, cm;
    while((cm = cellRe.exec(rm[1]))){
      var attrs = cm[1], body = cm[2] || "";
      var ref = (/\br="([A-Z]+\d+)"/.exec(attrs) || [])[1];
      var type = (/\bt="([^"]+)"/.exec(attrs) || [])[1];
      var v = (/<v>([\s\S]*?)<\/v>/.exec(body) || [])[1];
      var val = type === "s" ? (v != null ? shared[Number(v)] : "") : type === "inlineStr" ? runsText(body) : v != null ? unxml(v) : "";
      var ci = ref ? colIndex(ref) : row.length;
      while(row.length < ci) row.push("");
      row[ci] = val == null ? "" : val;
    }
    rows.push(row);
  }
  return rows;
}
export function readXlsx(buffer){
  var bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  var entries;
  try { entries = zipEntries(bytes); } catch(e){ return Promise.reject(e); }
  return Promise.all([text(entries, "xl/workbook.xml"), text(entries, "xl/_rels/workbook.xml.rels"), text(entries, "xl/sharedStrings.xml")]).then(function(parts){
    var wb = parts[0] || "", rels = parts[1] || "", ss = parts[2] || "";
    var shared = [], siRe = /<si>([\s\S]*?)<\/si>/g, m;
    while((m = siRe.exec(ss))) shared.push(runsText(m[1]));
    var target = {};
    var relRe = /<Relationship\b[^>]*\bId="([^"]+)"[^>]*\bTarget="([^"]+)"/g;
    while((m = relRe.exec(rels))) target[m[1]] = m[2].replace(/^\/?xl\//, "").replace(/^\//, "");
    var sheets = [], shRe = /<sheet\b([^>]*)\/?>/g, k = 0;
    while((m = shRe.exec(wb))){
      k++;
      var name = unxml((/\bname="([^"]*)"/.exec(m[1]) || [])[1] || "Sheet" + k);
      var rid = (/\br:id="([^"]+)"/.exec(m[1]) || [])[1];
      var path = "xl/" + (rid && target[rid] ? target[rid] : "worksheets/sheet" + k + ".xml");
      sheets.push({ name: name, path: path });
    }
    return Promise.all(sheets.map(function(s){ return text(entries, s.path).then(function(x){ return { name: s.name, grid: x ? sheetGrid(x, shared) : [] }; }); }));
  });
}
