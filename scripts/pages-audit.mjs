// Page-structure audit for #255 (docs/design/pages.md). Drives every view the smoke run covers — the demo household at
// 390px and 1280px, and an empty household at 390px — and records what a page is made of: its primary buttons, its
// "Add" and delete controls (wording and class), help left in title tooltips, tab rails, section and card kinds, and
// every empty-state message with the controls near it. It measures; it doesn't judge — the doc classifies.
//
// Run: node scripts/pages-audit.mjs out.json   (Playwright as for scripts/smoke.mjs)
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
const OUT = process.argv[2] || "pages-audit.json";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".webmanifest": "application/manifest+json", ".png": "image/png", ".svg": "image/svg+xml" };
const server = http.createServer((req, res) => {
  let file = path.join(root, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if(!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, "index.html");
  res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(0, r));
const base = "http://127.0.0.1:" + server.address().port;
const VIEWS = [
  ["dashboard", "dashboard-sub", ["overview", "insights", "benchmarks", "review"]],
  ["expenses", "expenses-sub", ["budget", "income", "spending", "bills"]],
  ["networth", null, [null]], ["accounts", null, [null]],
  ["assets", "assets-sub", ["summary", "Cash", "Shares", "Super", "Vehicle", "Other", "Offsets"]],
  ["properties", null, [null]],
  ["tax", "tax-sub", ["year", "returns", "documents", "people"]],
  ["plan", "plan-sub", ["scenarios", "projections", "goals", "retirement"]],
  ["calc", null, [null]],
  ["reports", "report", ["cashflow", "categories", "income", "flow", "budget", "trends", "month", "networth", "nwcheck", "invest", "dividends", "cgt",
    "propreturns", "property", "debts", "super", "tax", "taxpack", "review", "lender", "yearend"]],
  ["settings", "accounts-sub", ["categories", "preferences", "rules"]]
];
const b = await chromium.launch();
const results = [];
for (const [mode, width] of [["demo", 390], ["demo", 1280], ["empty", 390]]) {
  const ctx = await b.newContext({ viewport: { width, height: 844 } });
  await ctx.addInitScript(() => localStorage.setItem("wealthPlanner.hasSeenIntro", "1"));
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  const p = await ctx.newPage();
  await p.goto(base + "/index.html" + (mode === "demo" ? "?mock=1" : ""));
  await p.waitForTimeout(1800);
  await p.evaluate(() => { const c = document.querySelector("[data-fr-close]"); if(c) c.click(); });
  await p.waitForTimeout(300);
  for (const [pg, attr, subs] of VIEWS) {
    await p.evaluate(async x => (await import("/src/components/nav.js")).showPage(x), pg);
    await p.waitForTimeout(450);
    for (const sub of subs) {
      if(sub) { await p.evaluate(([a, s]) => { const el = document.querySelector('[data-' + a + '="' + s + '"]'); if(el) el.click(); }, [attr, sub]); await p.waitForTimeout(350); }
      const r = await p.evaluate(() => {
        const root = document.querySelector(".app-page:not([hidden])");
        const vis = el => !!el.getClientRects().length && !el.closest("[hidden]") && getComputedStyle(el).visibility !== "hidden";
        const all = sel => [...root.querySelectorAll(sel)].filter(vis);
        const label = el => (el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 48);
        const cls = el => (typeof el.className === "string" ? el.className.trim().split(/\s+/).slice(0, 3).join(".") : "");
        const buttons = all("button, a.btn, [role=button]");
        const intro = all(".page-intro").map(e => e.textContent.trim().slice(0, 90));
        const primary = buttons.filter(e => e.classList.contains("btn-primary")).map(label);
        const adds = buttons.filter(e => /^\+|^add\b|^new\b/i.test(label(e))).map(e => label(e) + " {" + cls(e) + "}");
        const dels = buttons.filter(e => /delete|remove|✕|×|discard/i.test(label(e)) && !/undo/i.test(label(e))).map(e => label(e).slice(0, 30) + " {" + (e.classList.contains("btn-danger") ? "danger" : cls(e)) + "}");
        const info = buttons.filter(e => /^ⓘ$|^ⓘ/.test(e.textContent.trim()) || /^(about|how |what |why )/i.test(e.getAttribute("aria-label") || "")).length;
        const titleHelp = [...root.querySelectorAll("[title]")].filter(e => vis(e) && !/^(INPUT|SELECT|TEXTAREA)$/.test(e.tagName) && e.title.length > 40).length;
        const rails = all(".subnav, [role=tablist], .seg, .segmented").length;
        const sectionTitles = [...new Set(all("h2, h3, h4, .section-title, .property-section-title, .card-title").map(e => e.tagName.toLowerCase() + "." + (e.classList[0] || "")))];
        const cardKinds = [...new Set(all(".card, .panel, details.ledger, .m-card, .home-block, .bm-card, .tax-person, .pp-card").map(e => e.classList[0]))];
        const disclosures = all("details").length;
        const empties = all("p, div.empty, .ledger-note, .m-empty, .empty-state").filter(e => /^(nothing|no |none|not yet|add (a|your)|there (are|is) no)/i.test(e.textContent.trim()) && e.textContent.trim().length < 220)
          .map(e => { const box = e.closest(".card, .panel, details, .ledger-body, section, .bm-card") || e.parentElement; const act = box && [...box.querySelectorAll("button, a[href]")].filter(vis).map(label).slice(0, 2);
            return e.textContent.trim().replace(/\s+/g, " ").slice(0, 80) + (act && act.length ? " → [" + act.join(" | ") + "]" : " → (no action)"); });
        return { intro, primary, adds: [...new Set(adds)], dels: [...new Set(dels)].slice(0, 8), delCount: dels.length, info, titleHelp, rails, sectionTitles, cardKinds, disclosures, empties: [...new Set(empties)].slice(0, 6), h: Math.round(document.documentElement.scrollHeight) };
      });
      results.push({ mode, width, view: pg + (sub ? "/" + sub : ""), ...r });
    }
  }
  await ctx.close();
}
fs.writeFileSync(OUT, JSON.stringify(results, null, 1));
console.log(results.length);
await b.close(); server.close();
