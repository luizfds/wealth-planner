// ---------------- Screenshots for the landing page and the README (November 2026) ----------------
//
// The landing page (docs/design/landing-page.md, step L3) shows the app as it is, not as it was when someone last took
// pictures: this drives the sample household — invented people (Alex and Sam), an invented address, invented figures —
// at a fixed date, phone and desktop, light and dark, and writes one PNG a screen. Re-run it after a release that
// changes what these screens look like. Nothing here reads a real household; it never loads a saved one.
//
//   node scripts/landing-shots.mjs [out-dir]        (default: about/img)
//   SHOTS_ONLY=today,money node scripts/landing-shots.mjs     (some screens)
//
// Needs Playwright (as for scripts/smoke.mjs): npm i --no-save playwright@1.56.0 && npx playwright install chromium.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.resolve(process.argv[2] || path.join(root, "about", "img"));
// The date every picture is taken on: mid-month, so "this month" has a few weeks in it, and a weekday.
const WHEN = "2026-11-18T10:00:00";
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".webmanifest": "application/manifest+json", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon" };

// Each screen: its file name, its page and tab (nav.js), and what to wait for.
const SCREENS = [
  { name: "today", page: "dashboard", ready: "#page-dashboard [data-home-card]" },
  { name: "money", page: "expenses", sub: "budget", ready: "#expensesSub-budget" },
  { name: "transactions", page: "expenses", sub: "spending", ready: "#transactionsTable" },
  { name: "trips", page: "expenses", sub: "trips", ready: "#tripsBody" },
  { name: "accounts", page: "networth", ready: "#page-networth" },
  { name: "property", page: "properties", ready: "#page-properties" },
  { name: "plan", page: "plan", sub: "scenarios", ready: "#page-plan" },
  { name: "tax", page: "tax", sub: "year", ready: "#page-tax" }
];
const SIZES = [
  { name: "phone", viewport: { width: 390, height: 844 }, scale: 2 },
  { name: "desktop", viewport: { width: 1280, height: 800 }, scale: 1 }
];
const SCHEMES = ["light", "dark"];
const only = process.env.SHOTS_ONLY ? process.env.SHOTS_ONLY.split(",") : null;

const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let file = path.join(root, p);
  if(!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, "index.html");
  res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const base = "http://127.0.0.1:" + server.address().port;

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const written = [], problems = [];
for(const size of SIZES) for(const scheme of SCHEMES){
  // Australian English, so dates read 18/11/2026 in the date fields, as an Australian visitor's would.
  const ctx = await browser.newContext({ viewport: size.viewport, deviceScaleFactor: size.scale, colorScheme: scheme, locale: "en-AU" });
  // A visitor who has been here before, everything on screen (not Simple), no tour.
  await ctx.addInitScript(() => {
    localStorage.setItem("wealthPlanner.hasSeenIntro", "1"); localStorage.setItem("wealthPlanner.tour", "skipped");
    localStorage.setItem("wealthPlanner.modeOffer", "done"); localStorage.setItem("wealthPlanner.mode", "advanced");
  });
  // Live prices, exchange rates and fonts from elsewhere would make two runs differ.
  await ctx.route(/fonts\.(googleapis|gstatic)\.com|frankfurter|coingecko|dropboxapi|docs\.google\.com|anthropic/, r => r.abort());
  const page = await ctx.newPage();
  page.on("pageerror", e => problems.push(size.name + " " + scheme + ": " + e.message));
  await page.clock.setFixedTime(new Date(WHEN));
  await page.goto(base + "/index.html?mock=1");
  await page.waitForFunction(() => ((JSON.parse(localStorage.getItem("wealthPlanner.v1") || "{}").income) || []).length > 0, null, { timeout: 20000 });
  await page.waitForSelector("html[data-wp-ready]", { timeout: 20000 });
  // The sample's "Sample data generated" note goes before any picture is taken.
  await page.waitForTimeout(600);
  for(const s of SCREENS){
    if(only && !only.includes(s.name)) continue;
    await page.evaluate(async ([pg, sub]) => {
      const n = await import("/src/components/nav.js");
      n.showPage(pg);
      if(sub && pg === "expenses") n.showExpensesSubpage(sub);
      if(sub && pg === "tax") n.showTaxSubpage(sub);
      if(sub && pg === "plan") document.querySelector('[data-plan-sub="' + sub + '"]').click();
    }, [s.page, s.sub || ""]);
    await page.waitForSelector(s.ready, { state: "attached", timeout: 10000 }).catch(() => problems.push(s.name + ": never ready"));
    await page.evaluate(() => { document.querySelectorAll("#toastWrap .toast").forEach(t => t.remove()); scrollTo(0, 0); });
    await page.waitForTimeout(500);
    const file = path.join(OUT, s.name + "-" + size.name + "-" + scheme + ".png");
    await page.screenshot({ path: file });
    written.push(path.relative(root, file));
  }
  await ctx.close();
}
await browser.close();
server.close();
console.log("Wrote " + written.length + " screenshots to " + path.relative(root, OUT) + "/");
if(problems.length){ console.error(problems.join("\n")); process.exit(1); }
