// Page smoke check (v3.43.0) — opens every page and subtab in a headless browser, at a phone and a
// desktop width, light and dark, and fails on anything a unit test can't see:
//   - an uncaught page error or console error (a function imported from the wrong module, a
//     variable out of scope — both have shipped past a green `npm test` in this repo)
//   - a page that renders nothing
//   - the page scrolling sideways
//   - NaN / undefined / [object Object] / Infinity in the rendered text
//   - a %-width bar that measures 0 inside a parent that doesn't (the account bars never drew)
//   - on a phone, a control smaller than 44px each way (v3.167.0)
//
// Run: npm i --no-save playwright && npx playwright install chromium && node scripts/smoke.mjs
// Not part of `npm test` on purpose — the suite stays dependency-free; CI runs this beside it.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

// v3.130.0: SMOKE_ROOT serves another checkout (the PR's base, for screenshot comparison), and
// SHOTS_DIR saves a full-page screenshot of every view in light mode, at a fixed date and time so
// two runs of the same code take the same pictures. In that mode a view the checkout doesn't have
// is skipped rather than failed, and failures don't fail the run — scripts/shotdiff.mjs reports.
const root = process.env.SMOKE_ROOT ? path.resolve(process.env.SMOKE_ROOT) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = process.env.SHOTS_DIR ? path.resolve(process.env.SHOTS_DIR) : null;
if(SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
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
  ["dashboard", "dashboard-sub", ["overview", "insights", "benchmarks", "review"]],
  ["expenses", "expenses-sub", ["budget", "income", "spending", "bills"]],
  ["networth", null, [null]],
  ["accounts", null, [null]],
  ["assets", "assets-sub", ["summary", "Cash", "Shares", "Super", "Vehicle", "Other", "Offsets"]],
  ["properties", null, [null]],
  ["tax", "tax-sub", ["year", "returns", "documents", "people"]],
  ["plan", "plan-sub", ["scenarios", "projections", "goals", "retirement"]],
  ["reports", "report", ["cashflow", "categories", "income", "flow", "budget", "trends", "month", "networth", "nwcheck", "invest", "dividends", "cgt",
    "propreturns", "property", "debts", "super", "tax", "review", "lender", "yearend"]],
  ["settings", "accounts-sub", ["categories", "preferences", "rules"]]
];
const failures = [];
const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
for (const [scheme, width] of SHOTS ? [["light", 390], ["light", 1280]] : [["light", 390], ["light", 1280], ["dark", 390], ["dark", 1280]]) {
  const ctx = await browser.newContext({ viewport: { width, height: 844 }, colorScheme: scheme });
  await ctx.addInitScript(() => localStorage.setItem("wealthPlanner.hasSeenIntro", "1"));
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  const page = await ctx.newPage();
  if(SHOTS) await page.clock.setFixedTime(new Date("2026-10-27T10:00:00"));
  const errors = [];
  page.on("pageerror", e => errors.push("page error: " + e.message));
  page.on("console", m => { if(m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push("console: " + m.text()); });
  await page.goto(base + "/index.html?mock=1");
  await page.waitForFunction(() => ((JSON.parse(localStorage.getItem("wealthPlanner.v1") || "{}").income) || []).length > 0, null, { timeout: 15000 });
  await page.waitForTimeout(800);
  // Open every collapsible section so its contents render and get measured too.
  for (const [pg, attr, subs] of VIEWS) {
    const hasPage = await page.evaluate(p => { const b = document.querySelector('[data-page="' + p + '"]'); if(b) b.click(); return !!b; }, pg);
    if(!hasPage && SHOTS) continue;
    await page.waitForTimeout(250);
    for (const sub of subs) {
      if(sub) {
        const hasSub = await page.evaluate(([a, s]) => { const b = document.querySelector('[data-' + a + '="' + s + '"]'); if(b) b.click(); return !!b; }, [attr, sub]);
        if(!hasSub && SHOTS) continue;
        await page.waitForTimeout(250);
      }
      await page.evaluate(() => document.querySelectorAll(".app-page:not([hidden]) details").forEach(d => { d.open = true; }));
      await page.waitForTimeout(250);
      const where = scheme + " " + width + "px " + pg + (sub ? "/" + sub : "");
      const r = await page.evaluate((w) => {
        const pageEl = document.querySelector(".app-page:not([hidden])");
        const text = pageEl ? pageEl.innerText : "";
        const bad = ["NaN", "undefined", "[object Object]", "Infinity"].filter(t => text.includes(t));
        const zeroBars = [...pageEl.querySelectorAll('[style*="width:"]')].filter(e => e.style.width.endsWith("%") && parseFloat(e.style.width) > 0.5 &&
          e.getBoundingClientRect().width === 0 && e.parentElement.getBoundingClientRect().width > 0 && e.offsetParent !== null).map(e => e.className);
        // v3.167.0 (item 197): on a phone, every control is at least 44px each way — its own box, or the
        // invisible ::before catch area the phone CSS gives a small mark. Inline links in a sentence are
        // exempt (WCAG 2.5.8), and so is anything inside a closed row's editor (not on screen).
        const small = [];
        if(w < 880){
          const roots = [pageEl, document.querySelector(".app-topbar"), document.querySelector(".mobile-tabbar, .mobile-tabs")].filter(Boolean);
          roots.forEach(root => root.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, summary, [role=button], [tabindex="0"]').forEach(el => {
            let t = el;
            if(el.matches("input[type=checkbox], input[type=radio]")){ const l = el.closest("label"); if(l) t = l; }
            const r = t.getBoundingClientRect();
            if(!r.width || !r.height || t.closest("[hidden]") || getComputedStyle(t).visibility === "hidden") return;
            const cs = getComputedStyle(t), par = t.parentElement;
            if(cs.display === "inline" && par && /^(P|LI|SPAN|SMALL|EM)$/.test(par.tagName) && par.textContent.trim().length > t.textContent.trim().length + 12) return;
            let h = r.height, wd = r.width;
            const pb = getComputedStyle(t, "::before");
            if(pb.content !== "none" && pb.position === "absolute"){
              h = Math.max(h, r.height - parseFloat(pb.top) - parseFloat(pb.bottom) || 0);
              wd = Math.max(wd, r.width - parseFloat(pb.left) - parseFloat(pb.right) || 0);
            }
            if(h < 43.5 || wd < 43.5) small.push((t.className && typeof t.className === "string" ? t.tagName.toLowerCase() + "." + t.className.trim().split(/\s+/)[0] : t.tagName.toLowerCase()) + " " + Math.round(wd) + "×" + Math.round(h));
          }));
        }
        return { overflow: document.documentElement.scrollWidth > w ? document.documentElement.scrollWidth : 0, textLen: text.trim().length, bad, zeroBars, small };
      }, width);
      if(r.textLen < 40) failures.push(where + ": page rendered almost nothing (" + r.textLen + " chars)");
      if(r.overflow) failures.push(where + ": scrolls sideways (" + r.overflow + "px wide)");
      if(r.bad.length) failures.push(where + ": text shows " + r.bad.join(", "));
      if(r.zeroBars.length) failures.push(where + ": bars that don't draw: " + [...new Set(r.zeroBars)].join(", "));
      if(r.small.length) failures.push(where + ": tap targets under 44px: " + [...new Set(r.small)].slice(0, 6).join(", ") + (r.small.length > 6 ? " (" + r.small.length + " in all)" : ""));
      errors.splice(0).forEach(e => failures.push(where + ": " + e));
      if(SHOTS){
        await page.evaluate(() => document.querySelectorAll("#toastWrap .toast").forEach(t => t.remove()));
        await page.screenshot({ path: path.join(SHOTS, width + "-" + pg + (sub ? "-" + sub : "") + ".png"), fullPage: true, animations: "disabled" });
      }
    }
  }
  // v3.139.1: the navigation itself, tapped the way a person does — the views above are reached by
  // script, which is how the mobile More menu went unnoticed when it stopped opening.
  if(!SHOTS){
    const where = scheme + " " + width + "px navigation";
    const nav = await page.evaluate(async (w) => {
      const wait = ms => new Promise(r => setTimeout(r, ms));
      const current = () => document.body.getAttribute("data-current-page");
      const out = [];
      if(w < 880){
        // v3.140.0: Home · Cash flow · Net worth · Tax · Plan, and the avatar's menu for the rest.
        const tax = document.querySelector('.mobile-tab[data-page="tax"]');
        if(!tax) out.push("no Tax tab"); else { tax.click(); await wait(600); if(current() !== "tax") out.push("the Tax tab didn't open it"); }
        const tab = document.querySelector('.mobile-tab[data-page="networth"]');
        if(tab){ tab.click(); await wait(600); if(current() !== "networth") out.push("the Net worth tab didn't open it"); }
      }
      // The avatar menu, at every width: it opens, and Reports in it opens Reports and closes it.
      const avatar = document.getElementById("avatarBtn"), menu = document.querySelector(".avatar-menu");
      if(!avatar || !avatar.getClientRects().length) out.push("no avatar in the header");
      else {
        avatar.click(); await wait(200);
        if(menu.hidden) out.push("the avatar doesn't open its menu");
        const rep = menu.querySelector('[data-avatar-go="reports"]');
        if(rep){ rep.click(); await wait(600); if(current() !== "reports") out.push("avatar → Reports didn't open it"); if(!menu.hidden) out.push("the avatar's menu stays open after choosing"); }
      }
      if(w >= 880){
        const item = document.querySelector('.nav-item[data-page="tax"]');
        if(item){ item.click(); await wait(600); if(current() !== "tax") out.push("the sidebar's Tax didn't open it"); }
      }
      return out;
    }, width);
    nav.forEach(f => failures.push(where + ": " + f));
    errors.splice(0).forEach(e => failures.push(where + ": " + e));
  }
  await ctx.close();
}
// v3.161.0 (item 191): a household with nothing in it — the parts it doesn't have (a property, shares)
// keep out of the way, and the way back in works. The all-on demo above covers everything else.
if(!SHOTS){
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => localStorage.setItem("wealthPlanner.hasSeenIntro", "1"));
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push("page error: " + e.message));
  page.on("console", m => { if(m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push("console: " + m.text()); });
  await page.goto(base + "/index.html");
  await page.waitForTimeout(1500);
  await page.evaluate(() => { const c = document.querySelector("[data-fr-close]"); if(c) c.click(); });
  await page.waitForTimeout(300);
  const where = "minimal household 390px";
  const r = await page.evaluate(async () => {
    const wait = ms => new Promise(res => setTimeout(res, ms));
    const out = [], go = p => { document.querySelector('[data-page="' + p + '"]').click(); return wait(500); };
    const visible = sel => [...document.querySelectorAll(sel)].some(e => e.getClientRects().length);
    const page = () => document.querySelector(".app-page:not([hidden])");
    const checkPage = name => { const t = page().innerText; ["NaN", "undefined", "[object Object]"].forEach(b => { if(t.includes(b)) out.push(name + " shows " + b); }); if(document.documentElement.scrollWidth > 390) out.push(name + " scrolls sideways"); };
    for(const p of ["dashboard", "expenses", "tax", "plan"]){ await go(p); checkPage(p); }
    await go("networth"); checkPage("networth");
    if(visible('.nw-rail-item[data-page="properties"]')) out.push("the Property tab shows with no property");
    await go("assets");
    if(visible('[data-assets-sub="Shares"]')) out.push("the Shares tab shows with no shares");
    await go("reports"); checkPage("reports");
    if(/Property P&L|Capital gains/.test(page().innerText)) out.push("property or share reports offered");
    document.querySelector('[data-page="dashboard"]').click(); await wait(400);
    const bm = document.querySelector('[data-dashboard-sub="benchmarks"]'); if(bm){ bm.click(); await wait(400); }
    if(/Property against its suburb|Your shares against the market/.test(page().innerText)) out.push("property or share Benchmarks shown");
    await go("settings"); const pref = document.querySelector('[data-accounts-sub="preferences"]'); if(pref){ pref.click(); await wait(400); }
    if(!document.querySelector('[data-part-set="property"]')) out.push("no What this household has in Preferences");
    await go("networth");
    const add = document.querySelector('[data-part-show="property"]');
    if(!add) out.push("no way back in from Net worth"); else { add.click(); await wait(700);
      if(document.body.getAttribute("data-current-page") !== "properties") out.push("Add a property didn't open Property");
      if(!visible('.nw-rail-item[data-page="properties"]')) out.push("the Property tab stayed hidden after Add a property"); }
    return out;
  });
  r.forEach(f => failures.push(where + ": " + f));
  errors.splice(0).forEach(e => failures.push(where + ": " + e));
  await ctx.close();
}
// v3.181.0 (item 212): a scenario on its own page — opened from its card, changed, saved.
if(!SHOTS){
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => localStorage.setItem("wealthPlanner.hasSeenIntro", "1"));
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push("page error: " + e.message));
  page.on("console", m => { if(m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push("console: " + m.text()); });
  await page.goto(base + "/index.html?mock=1");
  await page.waitForTimeout(1500);
  const where = "scenario editor 390px";
  const r = await page.evaluate(async () => {
    const wait = ms => new Promise(res => setTimeout(res, ms));
    const out = [];
    document.querySelector('[data-page="plan"]').click(); await wait(400);
    document.querySelector('[data-plan-sub="scenarios"]').click(); await wait(400);
    const edits = [...document.querySelectorAll("#cards [data-edit-scenario]")];
    const edit = edits[edits.length - 1];
    if(!edit){ out.push("no Edit on the scenario cards"); return out; }
    const name = edit.getAttribute("data-edit-scenario");
    edit.click(); await wait(700);
    if(document.body.getAttribute("data-current-page") !== "scenario") { out.push("Edit didn't open the scenario's page"); return out; }
    const pg = document.getElementById("page-scenario");
    const t = pg.innerText;
    if(t.trim().length < 50) out.push("the scenario's page is empty");
    ["NaN", "undefined", "[object Object]"].forEach(b => { if(t.includes(b)) out.push("the scenario's page shows " + b); });
    if(document.documentElement.scrollWidth > 390) out.push("the scenario's page scrolls sideways");
    const save = pg.querySelector("[data-sc-save]");
    if(!save || !save.disabled) out.push("Save isn't there, or is on before anything changed");
    const add = pg.querySelector('[data-sc-new="cost"]');
    if(!add){ out.push("no way to add a change"); return out; }
    add.click(); await wait(500);
    const save2 = document.querySelector("#page-scenario [data-sc-save]");
    if(!save2 || save2.disabled) { out.push("Save stayed off after a change"); return out; }
    save2.click(); await wait(700);
    if(document.body.getAttribute("data-current-page") !== "plan") out.push("Save didn't go back to the scenarios");
    return out;
  });
  r.forEach(f => failures.push(where + ": " + f));
  errors.splice(0).forEach(e => failures.push(where + ": " + e));
  await ctx.close();
}
await browser.close();
server.close();
if(failures.length && SHOTS){
  console.log("Screenshots saved; " + failures.length + " smoke failure(s) noted but not failed in screenshot mode.");
  process.exit(0);
}
if(failures.length){
  console.error("Smoke check failed:\n  " + failures.join("\n  "));
  process.exit(1);
}
console.log("Smoke check passed: every page and subtab, 390px and 1280px, light and dark.");
