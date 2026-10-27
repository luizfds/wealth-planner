// Screenshot comparison (v3.130.0) — what a pull request changes on screen.
//
// Run: node scripts/shotdiff.mjs <base shots> <head shots> <out dir>
// Compares the PNGs scripts/smoke.mjs saved for the base branch and for the PR (SHOTS_DIR), pixel by
// pixel in headless Chromium (no image library: the browser decodes and diffs them on a canvas), and
// writes <out>/index.html — every view that changed, base beside head beside the difference marked
// in red — and <out>/summary.md for the job summary. New and removed views are listed. Never fails:
// a visual change isn't an error, it's something for a person to look at.
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const [baseDir, headDir, outDir] = process.argv.slice(2).map(p => path.resolve(p || "."));
fs.mkdirSync(outDir, { recursive: true });
const list = d => fs.existsSync(d) ? fs.readdirSync(d).filter(f => f.endsWith(".png")).sort() : [];
const base = list(baseDir), head = list(headDir);
const added = head.filter(f => !base.includes(f)), removed = base.filter(f => !head.includes(f));
const both = head.filter(f => base.includes(f));
const THRESHOLD = 0.001; // under a tenth of a percent of pixels is rendering noise

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const page = await browser.newPage();
await page.setContent("<canvas id=a></canvas>");
const changed = [];
for (const f of both) {
  const a = "data:image/png;base64," + fs.readFileSync(path.join(baseDir, f)).toString("base64");
  const b = "data:image/png;base64," + fs.readFileSync(path.join(headDir, f)).toString("base64");
  const r = await page.evaluate(async ([a, b]) => {
    const load = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
    const [ia, ib] = await Promise.all([load(a), load(b)]);
    const w = Math.max(ia.width, ib.width), h = Math.max(ia.height, ib.height);
    const draw = img => { const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, w, h); x.drawImage(img, 0, 0); return x.getImageData(0, 0, w, h); };
    const da = draw(ia), db = draw(ib);
    const out = document.createElement("canvas"); out.width = w; out.height = h;
    const ox = out.getContext("2d"); const od = ox.createImageData(w, h);
    let n = 0;
    for (let i = 0; i < da.data.length; i += 4) {
      const d = Math.abs(da.data[i] - db.data[i]) + Math.abs(da.data[i + 1] - db.data[i + 1]) + Math.abs(da.data[i + 2] - db.data[i + 2]);
      if (d > 48) { n++; od.data[i] = 230; od.data[i + 1] = 30; od.data[i + 2] = 30; od.data[i + 3] = 255; }
      else { const g = (db.data[i] + db.data[i + 1] + db.data[i + 2]) / 3; od.data[i] = od.data[i + 1] = od.data[i + 2] = 200 + g / 5; od.data[i + 3] = 255; }
    }
    ox.putImageData(od, 0, 0);
    return { ratio: n / (w * h), sizeChanged: ia.width !== ib.width || ia.height !== ib.height, diff: n ? out.toDataURL("image/png") : null };
  }, [a, b]);
  if (r.ratio > THRESHOLD || r.sizeChanged) {
    const stem = f.replace(/\.png$/, "");
    fs.copyFileSync(path.join(baseDir, f), path.join(outDir, stem + ".base.png"));
    fs.copyFileSync(path.join(headDir, f), path.join(outDir, stem + ".head.png"));
    if (r.diff) fs.writeFileSync(path.join(outDir, stem + ".diff.png"), Buffer.from(r.diff.split(",")[1], "base64"));
    changed.push({ f, stem, pct: Math.round(r.ratio * 10000) / 100, sizeChanged: r.sizeChanged, diff: !!r.diff });
  }
}
await browser.close();
added.forEach(f => fs.copyFileSync(path.join(headDir, f), path.join(outDir, f.replace(/\.png$/, ".head.png"))));
changed.sort((x, y) => y.pct - x.pct);

const name = f => f.replace(/\.png$/, "").replace(/^(\d+)-/, "$1px · ").replace(/-/g, " / ");
const md = ["### Screens", "",
  both.length + " views compared, " + changed.length + " changed" + (added.length ? ", " + added.length + " new" : "") + (removed.length ? ", " + removed.length + " gone" : "") + ".", ""]
  .concat(changed.length ? ["| View | Pixels changed |", "|---|---|"].concat(changed.map(c => "| " + name(c.f) + " | " + c.pct + "%" + (c.sizeChanged ? " (page length changed)" : "") + " |")) : [])
  .concat(added.length ? ["", "New: " + added.map(name).join(", ")] : [])
  .concat(removed.length ? ["", "Gone: " + removed.map(name).join(", ")] : [])
  .concat(changed.length || added.length ? ["", "Side by side in the **screens** artifact (open index.html)."] : []);
fs.writeFileSync(path.join(outDir, "summary.md"), md.join("\n") + "\n");
const esc = s => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
fs.writeFileSync(path.join(outDir, "index.html"), "<!doctype html><meta charset=utf-8><title>Screens</title><style>body{font:14px system-ui;margin:16px}figure{margin:0}.row{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:8px 0 28px}img{width:100%;border:1px solid #ccc}h2{font-size:16px}</style>" +
  "<h1>Screens</h1><p>" + esc(md[2]) + "</p>" +
  changed.map(c => "<h2>" + esc(name(c.f)) + " — " + c.pct + "%</h2><div class=row><figure><figcaption>Base</figcaption><img src='" + c.stem + ".base.png'></figure><figure><figcaption>This PR</figcaption><img src='" + c.stem + ".head.png'></figure>" +
    (c.diff ? "<figure><figcaption>Difference</figcaption><img src='" + c.stem + ".diff.png'></figure>" : "") + "</div>").join("") +
  (added.length ? "<h2>New views</h2>" + added.map(f => "<h3>" + esc(name(f)) + "</h3><img style='max-width:640px' src='" + f.replace(/\.png$/, ".head.png") + "'>").join("") : ""));
console.log(md.join("\n"));
