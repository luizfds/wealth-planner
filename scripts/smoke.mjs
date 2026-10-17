// Page smoke check (v3.43.0) — opens every page and subtab in a headless browser, at a phone and a
// desktop width, light and dark, and fails on anything a unit test can't see:
//   - an uncaught page error or console error (a function imported from the wrong module, a
//     variable out of scope — both have shipped past a green `npm test` in this repo)
//   - a page that renders nothing
//   - the page scrolling sideways
//   - NaN / undefined / [object Object] / Infinity in the rendered text
//   - a %-width bar that measures 0 inside a parent that doesn't (the account bars never drew)
//
// Run: npm i --no-save playwright && npx playwright install chromium && node scripts/smoke.mjs
// Not part of `npm test` on purpose — the suite stays dependency-free; CI runs this beside it.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".webmanifest": "application/manifest+json", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let file = path.join(root, p);
  if(!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, "index.html");
  res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(0, r));
const base = "http://127.0.0.1:" + server.address().port;

const VIEWS = [
  ["dashboard", "dashboard-sub", ["overview", "insights", "benchmarks"]],
  ["income", null, [null]],
  ["expenses", "expenses-sub", ["budget", "spending"]],
  ["accounts", "accounts-sub", ["accounts", "categories", "preferences"]],
  ["assets", "assets-sub", ["summary", "Cash", "Shares", "Super", "Vehicle", "Other", "Offsets"]],
  ["properties", null, [null]],
  ["scenarios", null, [null]],
  ["projections", null, [null]]
];
const failures = [];
const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
for (const [scheme, width] of [["light", 390], ["light", 1280], ["dark", 390], ["dark", 1280]]) {
  const ctx = await browser.newContext({ viewport: { width, height: 844 }, colorScheme: scheme });
  await ctx.addInitScript(() => localStorage.setItem("wealthPlanner.hasSeenIntro", "1"));
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push("page error: " + e.message));
  page.on("console", m => { if(m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push("console: " + m.text()); });
  await page.goto(base + "/index.html?mock=1");
  await page.waitForFunction(() => ((JSON.parse(localStorage.getItem("wealthPlanner.v1") || "{}").income) || []).length > 0, null, { timeout: 15000 });
  await page.waitForTimeout(800);
  // Open every collapsible section so its contents render and get measured too.
  for (const [pg, attr, subs] of VIEWS) {
    await page.evaluate(p => document.querySelector('[data-page="' + p + '"]').click(), pg);
    await page.waitForTimeout(250);
    for (const sub of subs) {
      if(sub) { await page.evaluate(([a, s]) => document.querySelector('[data-' + a + '="' + s + '"]').click(), [attr, sub]); await page.waitForTimeout(250); }
      await page.evaluate(() => document.querySelectorAll(".app-page:not([hidden]) details").forEach(d => { d.open = true; }));
      await page.waitForTimeout(250);
      const where = scheme + " " + width + "px " + pg + (sub ? "/" + sub : "");
      const r = await page.evaluate((w) => {
        const pageEl = document.querySelector(".app-page:not([hidden])");
        const text = pageEl ? pageEl.innerText : "";
        const bad = ["NaN", "undefined", "[object Object]", "Infinity"].filter(t => text.includes(t));
        const zeroBars = [...pageEl.querySelectorAll('[style*="width:"]')].filter(e => e.style.width.endsWith("%") && parseFloat(e.style.width) > 0.5 &&
          e.getBoundingClientRect().width === 0 && e.parentElement.getBoundingClientRect().width > 0 && e.offsetParent !== null).map(e => e.className);
        return { overflow: document.documentElement.scrollWidth > w ? document.documentElement.scrollWidth : 0, textLen: text.trim().length, bad, zeroBars };
      }, width);
      if(r.textLen < 40) failures.push(where + ": page rendered almost nothing (" + r.textLen + " chars)");
      if(r.overflow) failures.push(where + ": scrolls sideways (" + r.overflow + "px wide)");
      if(r.bad.length) failures.push(where + ": text shows " + r.bad.join(", "));
      if(r.zeroBars.length) failures.push(where + ": bars that don't draw: " + [...new Set(r.zeroBars)].join(", "));
      errors.splice(0).forEach(e => failures.push(where + ": " + e));
    }
  }
  await ctx.close();
}
await browser.close();
server.close();
if(failures.length){
  console.error("Smoke check failed:\n  " + failures.join("\n  "));
  process.exit(1);
}
console.log("Smoke check passed: every page and subtab, 390px and 1280px, light and dark.");
