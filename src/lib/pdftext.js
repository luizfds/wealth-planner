// ---------------- Text out of a PDF statement (v3.92.0) ----------------
//
// pdf.js (vendored under vendor/pdfjs, loaded only when a PDF is chosen) hands back text runs with
// positions. A statement is a table, so the runs are put back into lines — same baseline, left to
// right — keeping each run's x so the parser can tell a Debit column from a Credit column.
// Returns [{ page, y, cells: [{ x, x2, s }] }], top of the first page first.
var lib = null;
export function loadPdfJs(){
  if(lib) return Promise.resolve(lib);
  var base = new URL("../../vendor/pdfjs/", import.meta.url);
  return import(new URL("pdf.min.mjs", base).href).then(function(m){
    m.GlobalWorkerOptions.workerSrc = new URL("pdf.worker.min.mjs", base).href;
    lib = m;
    return m;
  });
}
export function pdfLines(data, pdfjs){
  var getLib = pdfjs ? Promise.resolve(pdfjs) : loadPdfJs();
  return getLib.then(function(m){ return m.getDocument({ data: data, isEvalSupported: false }).promise; }).then(function(doc){
    var pages = [];
    for(var i = 1; i <= doc.numPages; i++) pages.push(i);
    return pages.reduce(function(p, n){
      return p.then(function(acc){
        return doc.getPage(n).then(function(page){ return page.getTextContent(); }).then(function(tc){
          return acc.concat(linesOf(tc.items, n));
        });
      });
    }, Promise.resolve([]));
  });
}
// Runs on (about) the same baseline make a line; a run that starts right where the last ended is
// the same word continued.
export function linesOf(items, page){
  var runs = (items || []).filter(function(it){ return it && typeof it.str === "string" && it.str.trim(); }).map(function(it){
    var x = it.transform[4], y = it.transform[5];
    return { x: x, x2: x + (it.width || 0), y: y, s: it.str };
  });
  runs.sort(function(a, b){ return b.y - a.y || a.x - b.x; });
  var lines = [];
  runs.forEach(function(r){
    var line = lines.length ? lines[lines.length - 1] : null;
    if(!line || Math.abs(line.y - r.y) > 2.5) lines.push(line = { page: page, y: r.y, cells: [] });
    line.cells.push(r);
  });
  return lines.map(function(l){
    l.cells.sort(function(a, b){ return a.x - b.x; });
    var merged = [];
    l.cells.forEach(function(c){
      var last = merged[merged.length - 1];
      if(last && c.x - last.x2 < 2.2){ last.s += (c.x - last.x2 > 0.8 ? " " : "") + c.s; last.x2 = Math.max(last.x2, c.x2); }
      else merged.push({ x: c.x, x2: c.x2, s: c.s });
    });
    function tidy(c){ return { x: Math.round(c.x * 10) / 10, x2: Math.round(c.x2 * 10) / 10, s: c.s.trim() }; }
    // raw: the runs before joining, for when a margin note was printed flush against the date.
    return { page: l.page, y: l.y, cells: merged.map(tidy), raw: l.cells.map(tidy) };
  });
}
