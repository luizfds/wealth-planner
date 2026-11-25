// Page smoke check (v3.43.0) — opens every page and subtab in a headless browser, at a phone and a
// desktop width, light and dark (and 320px and 768px light), and fails on anything a unit test can't see:
//   - an uncaught page error or console error (a function imported from the wrong module, a
//     variable out of scope — both have shipped past a green `npm test` in this repo)
//   - a page that renders nothing
//   - the page scrolling sideways
//   - NaN / undefined / [object Object] / Infinity in the rendered text
//   - a %-width bar that measures 0 inside a parent that doesn't (the account bars never drew)
//   - on a phone, a control smaller than 44px each way (v3.167.0)
//   - a floating button on a desktop, or more than one 56px circle on a phone (#304)
//   - more than one primary button in a view, or a view with no About this page (#255)
//   - an add button not worded "+ Add thing", or a delete that isn't .btn-danger (#255)
//   - more than one line of notices above a page's content (#305)
//   - a region inside a page that scrolls sideways, unless LOCAL_SCROLL lists it — and then it must be reachable by
//     keyboard and named (#267); 768px joins the widths for the same issue
//
// Run: npm i --no-save playwright && npx playwright install chromium && node scripts/smoke.mjs
// Not part of `npm test` on purpose — the suite stays dependency-free; CI runs this beside it.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

// v3.130.0: SMOKE_ROOT serves another checkout (the PR's base, for screenshot comparison), and
// SHOTS_DIR saves two full-page screenshots of every view in light mode — as it opens (<view>.png) and with every
// disclosure open (<view>.expanded.png), #267 — at a fixed date and time so
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
await new Promise(r => server.listen(0, "127.0.0.1", r));
const base = "http://127.0.0.1:" + server.address().port;

const VIEWS = [
  ["dashboard", "dashboard-sub", ["overview", "insights", "benchmarks", "review"]],
  ["expenses", "expenses-sub", ["budget", "spending", "bills", "income", "trips"]],   // November 2026: Income is its own tab again; Trips its own
  ["networth", null, [null]],
  ["accounts", null, [null]],
  ["assets", "assets-sub", ["Cash", "Shares", "Super", "Vehicle", "Other", "Offsets"]],   // #413: no Summary
  ["properties", null, [null]],
  ["tax", "tax-sub", ["year", "returns", "documents", "people"]],
  ["plan", "plan-sub", ["scenarios", "projections", "goals", "retirement"]],
  ["calc", null, [null]], // v3.189.0: opened from the avatar menu
  ["reports", "report", ["cashflow", "categories", "income", "flow", "budget", "trends", "month", "networth", "nwcheck", "invest", "dividends", "cgt",
    "propreturns", "property", "debts", "super", "tax", "taxpack", "review", "lender", "yearend"]],
  ["settings", "accounts-sub", ["categories", "preferences", "rules"]],
  ["more", null, [null]]   // #412: a phone's More tab
];
// #267: the regions meant to scroll sideways, and why. Anything else that does is a failure.
const LOCAL_SCROLL = [
  ".range-strip",                          // Shares' change window: every period stays a 44px button (the owner's Shares choice, #259)
  ".md-strip",                             // Reports → Month: twelve 44px months, so neighbours can't take each other's taps (#255)
  ".rp-scroll",                            // a report's full table: rows and columns both matter (#258's optional Full table)
  ".scenario-tradeoffs [role=region]",     // Home's scenario comparison table, every column a figure (#266)
  ".table-scroll",                         // an import's review table (#265)
  ".cf-kinds"                              // Transactions' period chips, each a 44px filter, one row so the list starts in the top half
];
const failures = [];
const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
// #257: 320px too (light only — the colour scheme doesn't change layout). The narrowest phone is where a
// grid track's content floor shows: at 390px there is room to hide it, and two such overflows shipped.
// #267: 768px too, light only — a tablet, and the width where the phone layout gives way.
// November 2026: CI runs this as two parallel jobs — SMOKE_PASSES names the scheme-width passes a job runs
// ("light-320,light-390"), and SMOKE_EXTRAS=0 leaves the empty household, the scenario page and Simple mode to the other.
const ALL_PASSES = SHOTS ? [["light", 390], ["light", 1280]] : [["light", 320], ["light", 390], ["light", 768], ["light", 1280], ["dark", 390], ["dark", 1280]];
const PASSES = process.env.SMOKE_PASSES ? ALL_PASSES.filter(([sc, w]) => process.env.SMOKE_PASSES.split(",").includes(sc + "-" + w)) : ALL_PASSES;
const EXTRAS = process.env.SMOKE_EXTRAS !== "0";
for (const [scheme, width] of PASSES) {
  const ctx = await browser.newContext({ viewport: { width, height: width >= 1280 ? 800 : 844 }, colorScheme: scheme });
  await ctx.addInitScript(() => { localStorage.setItem("wealthPlanner.hasSeenIntro", "1"); localStorage.setItem("wealthPlanner.tour", "skipped"); localStorage.setItem("wealthPlanner.modeOffer", "done"); if(!window.__simple) localStorage.setItem("wealthPlanner.mode", "advanced"); });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await ctx.addInitScript(list => { window.__LOCAL_SCROLL = list; }, LOCAL_SCROLL);
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
    // #428: Bank accounts, Investments and Property are behind Accounts' list, with no button of their own.
    const hasPage = await page.evaluate(async p => { const b = document.querySelector('[data-page="' + p + '"]') || document.querySelector('[data-avatar-go="' + p + '"]'); if(b){ b.click(); return true; }
      if(["accounts", "assets", "properties"].includes(p)){ (await import('/src/components/nav.js')).showPage(p); return true; } return false; }, pg);
    if(!hasPage && SHOTS) continue;
    await page.waitForTimeout(250);
    for (const sub of subs) {
      if(sub) {
        // #412: Today's views open from links, with no tab for its first view — chosen through nav.js.
        const hasSub = await page.evaluate(async ([a, s]) => { if(a === 'dashboard-sub'){ (await import('/src/components/nav.js')).showDashboardSubpage(s); return true; } if(a === 'assets-sub'){ (await import('/src/components/nav.js')).showAssetsSubpage(s); return true; } if(a === 'report'){ const chooser = document.querySelector('[data-report-choose]'); if(chooser) chooser.click(); } const b = document.querySelector('[data-' + a + '="' + s + '"]'); if(b) b.click(); return !!b; }, [attr, sub]);
        if(!hasSub && SHOTS) continue;
        if(attr === 'report') await page.waitForFunction(key => !document.querySelector('[data-report-choose]') || (!!document.querySelector('[data-current-report="' + key + '"]') && !document.querySelector('.report-chooser')), sub);
        await page.waitForTimeout(250);
      }
      // #306: measure the ordinary list before the expanded-state checks open every disclosure.
      if(width === 390 || width === 1280){
        const position = await page.evaluate(([pg, sub]) => {
          const selector = pg === 'assets' && (sub === 'Shares' || sub === 'Super') ? '#assetsSub-' + sub + ' .m-row' :
            pg === 'expenses' && sub === 'spending' ? '#transactionsTable .m-row' : pg === 'properties' ? '#buyingBody .buy-card, #propertiesBody .property-card' : '';
          const first = selector && document.querySelector(selector);
          return first ? { y: first.getBoundingClientRect().top, limit: innerHeight / 2 } : null;
        }, [pg, sub]);
        if(position){
          console.log(scheme + ' ' + width + 'px ' + pg + '/' + (sub || '') + ': first record y=' + Math.round(position.y) + ', limit=' + position.limit);
          if(position.y > position.limit) failures.push(scheme + ' ' + width + 'px ' + pg + '/' + (sub || '') + ': first record starts below the top half (' + Math.round(position.y) + 'px)');
        }
      }
      if(pg === 'reports' && sub === 'cashflow' && width <= 390){
        const visibleResult = await page.evaluate(() => {
          if(!document.querySelector('[data-report-choose]')) return true; // Photographing an older base checkout.
          const sheet = document.querySelector('#reportSheet'), title = sheet && sheet.querySelector('h2');
          const result = sheet && (sheet.querySelector('svg') || sheet.querySelector('tbody tr'));
          const tabs = document.getElementById('mobileTabbar');
          const limit = innerHeight - (tabs ? tabs.getBoundingClientRect().height : 0);
          return !!(title && result && title.getBoundingClientRect().top >= 0 && result.getBoundingClientRect().bottom <= limit);
        });
        if(!visibleResult) failures.push(scheme + ' ' + width + 'px Reports: current title and meaningful result are not visible in the initial viewport');
      }
      // #267: the view as it opens, photographed before the expanded-state checks open every disclosure — a change to
      // a page's default state was otherwise only ever compared inside its expanded one.
      const shotName = width + "-" + pg + (sub ? "-" + sub : "");
      if(SHOTS){
        await page.evaluate(() => document.querySelectorAll("#toastWrap .toast").forEach(t => t.remove()));
        await page.screenshot({ path: path.join(SHOTS, shotName + ".png"), fullPage: true, animations: "disabled" });
      }
      await page.evaluate(() => document.querySelectorAll(".app-page:not([hidden]) details").forEach(d => { d.open = true; }));
      await page.waitForTimeout(250);
      const where = scheme + " " + width + "px " + pg + (sub ? "/" + sub : "");
      const r = await page.evaluate((w) => {
        const pageEl = document.querySelector(".app-page:not([hidden])");
        const text = pageEl ? pageEl.innerText : "";
        // The synthetic household has no literal date names. Inputs, source filenames and
        // diagnostic/source text deliberately retain machine-readable values.
        const rawDates = [], walker = document.createTreeWalker(pageEl, NodeFilter.SHOW_TEXT);
        for(let node=walker.nextNode();node;node=walker.nextNode()){
          if(!/\b\d{4}-\d{2}-\d{2}\b/.test(node.textContent)) continue;
          const parent=node.parentElement;
          if(!parent || parent.closest('input,textarea,pre,code,.el-log,.bank-import-source,[hidden]') || getComputedStyle(parent).visibility==='hidden') continue;
          const range=document.createRange();range.selectNodeContents(node);
          if(range.getClientRects().length) rawDates.push(node.textContent.trim().slice(0,120));
        }
        const bad = ["NaN", "undefined", "[object Object]", "Infinity"].filter(t => text.includes(t));
        const zeroBars = [...pageEl.querySelectorAll('[style*="width:"]')].filter(e => e.style.width.endsWith("%") && parseFloat(e.style.width) > 0.5 &&
          e.getBoundingClientRect().width === 0 && e.parentElement.getBoundingClientRect().width > 0 && e.offsetParent !== null).map(e => e.className);
        // v3.167.0 (item 197): on a phone, every control is at least 44px each way — its own box, or the
        // invisible ::before catch area the phone CSS gives a small mark. Inline links in a sentence are
        // exempt (WCAG 2.5.8), and so is anything inside a closed row's editor (not on screen).
        const small = [];
        // #259: document overflow alone misses sideways navigation inside a rail.
        //  Money tabs, financial range strips and Investments' pills (#422) deliberately scroll on narrow screens (the owner's choices).
        const navigationOverflow = [...pageEl.querySelectorAll('.subnav:not(#expensesSubnav), .time-range-control:not(.range-strip)')]
          .filter(el => el.getClientRects().length && el.scrollWidth > el.clientWidth + 1)
          .map(el => el.getAttribute('aria-label') || el.id);
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
        // #304: nothing floats over the figures on a desktop (the page's action is the header's button), and a
        // phone has one round button no bigger than 56px — not a labelled pill with a second button above it.
        const fw = document.getElementById("quickFabWrap"), fr = fw ? fw.getBoundingClientRect() : { width: 0, height: 0 };
        const hb = document.getElementById("headerAddBtn"), hr = hb ? hb.getBoundingClientRect() : { width: 0 };
        let fab = "";
        if(document.body.getAttribute("data-current-page") !== "scenario"){
          if(w >= 881 && (fr.width || !hr.width)) fab = fr.width ? "a floating button shows on a desktop" : "the header has no action button";
          if(w < 881 && (fr.width > 57 || fr.height > 57 || !fr.width || hr.width)) fab = "the floating button is " + Math.round(fr.width) + "×" + Math.round(fr.height) + " (one 56px circle expected)";
          if(!fab && !((w >= 881 ? hb : document.getElementById("quickFab")).getAttribute("aria-label") || "").trim()) fab = "the page's action button has no name";
        }
        // #255: one primary button per view (the header's counts; a phone's round button is the same action
        // and doesn't), and every view has its "About this page".
        const primaries = [...pageEl.querySelectorAll(".btn-primary"), ...document.querySelectorAll(".app-topbar .btn-primary")].filter(e => e.getClientRects().length)
          .map(e => (e.innerText.trim() || e.getAttribute("aria-label") || "?").slice(0, 28));
        // #255 step 2: an add button reads "+ Add" and the thing, lower case and with no article; every
        // delete or remove control is .btn-danger. (A heading or a menu item isn't a button on the page.)
        const wording = [];
        pageEl.querySelectorAll("button").forEach(b => {
          if(!b.getClientRects().length || b.closest("[role=menu], .page-overflow-menu")) return;
          const t = b.textContent.replace(/\s+/g, " ").trim(), name = (b.getAttribute("aria-label") || t).trim();
          if(/^\+? ?Add\b/.test(t) && !/^Add (to|with|from)\b/.test(t) && !/^\+ Add (?!an? |the )[a-z]/.test(t)) wording.push('"' + t.slice(0, 30) + '" (add wording)');
          if(/^(Delete|Remove)\b/.test(name) && !/^Remove (filter|from this)/.test(name) && !b.classList.contains("btn-danger")) wording.push('"' + name.slice(0, 30) + '" (not .btn-danger)');
        });
        // #255 step 4 rolls out view by view. Migrated views keep explanatory help behind ⓘ.
        // Exact chart values may keep hover titles when the figure or month button has the same accessible name.
        const tooltipHelp = [];
        document.querySelectorAll("#expensesSub-spending, #expensesSub-income, .money-head-actions:has(#incomeExportCsvBtn), #planSub-projections, #taxSub-year, #reportsBody .md, #page-properties, #assetsSub-summary, #assetsSub-Cash, #assetsSub-Super, #assetsSub-Vehicle, #assetsSub-Other").forEach(view => {
          if(!view.getClientRects().length) return;
          view.querySelectorAll("[title]").forEach(el => {
            const title = el.getAttribute("title");
            if(!el.getClientRects().length || title.length <= 40 || (el.matches("input, select, textarea") && !el.closest("#page-properties"))) return;
            if(el.getAttribute("role") === "img" && el.getAttribute("aria-label") === title) return;
            if(el.matches("button.md-bar[data-md-open]") && el.getAttribute("aria-label") === title) return;
            if(el.parentElement && el.parentElement.closest('[role="img"][aria-label]')) return;
            if(title === el.textContent.trim()) return; // the same full name, also written on screen
            tooltipHelp.push(el.tagName.toLowerCase() + ": " + title.slice(0, 60));
          });
        });
        // #305: a page carries at most one line of notices above its content — no strip of cards.
        const line = document.getElementById("attentionLine"), lineH = line && !line.hidden ? Math.round(line.getBoundingClientRect().height) : 0;
        let notices = pageEl.querySelectorAll(".adv-strip").length ? "a strip of notice cards is back" : lineH > 62 ? "the notices line is " + lineH + "px tall (one line expected)" : "";
        if(!notices && line && !line.hidden && !pageEl.contains(line)) notices = "the notices line is on another page";
        const helpBtn = document.getElementById("pageHelpBtn"), about = !!helpBtn && !helpBtn.hidden;
        // #267: a region inside the page that scrolls sideways. Document overflow misses it, and a person on a phone
        // meets it as a panel that slides. Only the regions in LOCAL_SCROLL are meant to (a two-dimensional table,
        // a range strip); each must be reachable by keyboard and say what it holds.
        const localScroll = [];
        pageEl.querySelectorAll("*").forEach(el => {
          if(el.scrollWidth <= el.clientWidth + 1 || !el.getClientRects().length || el.closest("[hidden]")) return;
          const cs = getComputedStyle(el);
          if(!/auto|scroll/.test(cs.overflowX) || cs.visibility === "hidden") return;
          const name = el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (typeof el.className === "string" && el.className.trim() ? "." + el.className.trim().split(/\s+/).join(".") : "");
          const allowed = window.__LOCAL_SCROLL.some(sel => el.matches(sel));
          const reachable = el.tabIndex >= 0 || !!el.querySelector('button, a[href], input, select, textarea, [tabindex="0"]');
          const named = !!(el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") || el.querySelector("caption"));
          if(!allowed) localScroll.push(name + " (" + el.scrollWidth + " in " + el.clientWidth + "px)");
          else if(!reachable || !named) localScroll.push(name + " scrolls but is " + [!reachable && "not reachable by keyboard", !named && "not named"].filter(Boolean).join(" and "));
        });
        return { localScroll, overflow: document.documentElement.scrollWidth > w ? document.documentElement.scrollWidth : 0, textLen: text.trim().length, rawDates: [...new Set(rawDates)], bad, zeroBars, small, navigationOverflow, fab, primaries, about, tooltipHelp, wording: [...new Set(wording)], notices };
      }, width);
      if(r.textLen < 40) failures.push(where + ": page rendered almost nothing (" + r.textLen + " chars)");
      if(r.overflow) failures.push(where + ": scrolls sideways (" + r.overflow + "px wide)");
      if(r.localScroll.length) failures.push(where + ": a region scrolls sideways: " + [...new Set(r.localScroll)].join("; "));
      if(r.navigationOverflow.length) failures.push(where + ": sideways navigation: " + r.navigationOverflow.join(', '));
      if(r.rawDates.length) failures.push(where + ": raw display dates: " + r.rawDates.join("; "));
      if(r.bad.length) failures.push(where + ": text shows " + r.bad.join(", "));
      if(r.zeroBars.length) failures.push(where + ": bars that don't draw: " + [...new Set(r.zeroBars)].join(", "));
      if(r.fab) failures.push(where + ": " + r.fab);
      if(r.primaries.length > 1) failures.push(where + ": " + r.primaries.length + " primary buttons (" + r.primaries.join(", ") + ")");
      if(!r.about) failures.push(where + ": no About this page");
      if(r.tooltipHelp.length) failures.push(where + ": tooltip-only help: " + r.tooltipHelp.join(", "));
      if(r.notices) failures.push(where + ": " + r.notices);
      if(r.wording.length) failures.push(where + ": " + r.wording.slice(0, 6).join(", "));
      if(r.small.length) failures.push(where + ": tap targets under 44px: " + [...new Set(r.small)].slice(0, 6).join(", ") + (r.small.length > 6 ? " (" + r.small.length + " in all)" : ""));
      // #254: every field is the shared one (.field-control) or a variant docs/design/fields.md names — the headline
      // amount, a search box, an inline name, the property-kind badge, a section picker. Not in SHOTS mode, which also
      // photographs an older base checkout.
      if(!SHOTS){
        const offSkin = await page.evaluate(() => [...document.querySelectorAll(".app-page:not([hidden]) input, .app-page:not([hidden]) select, .app-page:not([hidden]) textarea")]
          .filter(e => e.getClientRects().length && !["checkbox", "radio", "range", "file", "hidden", "color"].includes(e.type) &&
            !e.matches(".field-control, .inline-name, .cat-mgmt-name, .prop-kind, .cf-search-input, .qlog-search, #quickLogAmount, #rcvAmount"))
          .map(e => e.tagName.toLowerCase() + (e.className ? "." + String(e.className).trim().split(/\s+/)[0] : "") +
            ([...e.attributes].filter(a => a.name.indexOf("data-") === 0).map(a => "[" + a.name + "]")[0] || "")));
        if(offSkin.length) failures.push(where + ": fields off the shared skin: " + [...new Set(offSkin)].slice(0, 6).join(", "));
      }
      // The whole-app assessment (A1): a switch is a small track beside its words — one stretched by a page's
      // "input { width:100% }" was drawn over its own label (Calculators' First home buyer).
      const overSwitch = await page.evaluate(() => [...document.querySelectorAll(".app-page:not([hidden]) .switch-row")].filter(r => r.getClientRects().length).flatMap(r => {
        const i = r.querySelector(".switch-input"), t = r.querySelector(".switch-text");
        if(!i || !t) return [];
        const a = i.getBoundingClientRect(), b = t.getBoundingClientRect();
        const overlaps = a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
        return a.width > 80 || overlaps ? [(t.textContent || "").trim().slice(0, 40) + " (" + Math.round(a.width) + "px)"] : [];
      }));
      if(overSwitch.length) failures.push(where + ": a switch drawn over its label: " + overSwitch.slice(0, 4).join(", "));
      errors.splice(0).forEach(e => failures.push(where + ": " + e));
      if(SHOTS){
        await page.evaluate(() => document.querySelectorAll("#toastWrap .toast").forEach(t => t.remove()));
        await page.screenshot({ path: path.join(SHOTS, shotName + ".expanded.png"), fullPage: true, animations: "disabled" });
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
        // #412: Today · Money · Net worth · Plan · More; Tax is in More (checked below).
        const plan = document.querySelector('.mobile-tab[data-page="plan"]');
        if(!plan) out.push("no Plan tab"); else { plan.click(); await wait(600); if(current() !== "plan") out.push("the Plan tab didn't open it"); }
        const tab = document.querySelector('.mobile-tab[data-page="networth"]');
        if(tab){ tab.click(); await wait(600); if(current() !== "networth") out.push("the Net worth tab didn't open it"); }
      }
      // #412: a phone's More tab opens More, and its Tax row opens Tax (Tax left the bar for it).
      if(w < 880){
        const more = document.querySelector('.mobile-tab[data-page="more"]');
        if(!more) out.push("no More tab");
        else {
          more.click(); await wait(600); if(current() !== "more") out.push("the More tab didn't open More");
          const taxRow = document.querySelector('#moreList [data-page="tax"]');
          if(taxRow){ taxRow.click(); await wait(600); if(current() !== "tax") out.push("More → Tax didn't open it"); if(!more.classList.contains("active")) out.push("the More tab isn't lit on Tax"); }
          else out.push("More has no Tax row");
        }
      }
      // The avatar menu, at every width: it opens, and Backup & sync in it opens Settings and closes it.
      const avatar = document.getElementById("avatarBtn"), menu = document.querySelector(".avatar-menu");
      if(!avatar || !avatar.getClientRects().length) out.push("no avatar in the header");
      else {
        avatar.click(); await wait(200);
        if(menu.hidden) out.push("the avatar doesn't open its menu");
        const rep = menu.querySelector('[data-avatar-go="backup"]');
        if(!rep) out.push("the avatar's menu has no Backup & sync");
        else { rep.click(); await wait(600); if(current() !== "settings") out.push("avatar → Backup & sync didn't open Settings"); if(!menu.hidden) out.push("the avatar's menu stays open after choosing"); }
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
if(!SHOTS && EXTRAS){
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => { localStorage.setItem("wealthPlanner.hasSeenIntro", "1"); localStorage.setItem("wealthPlanner.tour", "skipped"); localStorage.setItem("wealthPlanner.modeOffer", "done"); if(!window.__simple) localStorage.setItem("wealthPlanner.mode", "advanced"); });
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
    const out = [], go = async p => { const b = document.querySelector('[data-page="' + p + '"]'); if(b) b.click(); else (await import('/src/components/nav.js')).showPage(p); return wait(500); };
    const available = sel => [...document.querySelectorAll(sel)].some(e => {
      if(e.getClientRects().length) return true;
      const picker = e.parentElement.querySelector('select.section-picker');
      return picker && picker.getClientRects().length && [...picker.options].some(o => o.textContent === e.textContent.trim());
    });
    const page = () => document.querySelector(".app-page:not([hidden])");
    const checkPage = name => { const t = page().innerText; ["NaN", "undefined", "[object Object]"].forEach(b => { if(t.includes(b)) out.push(name + " shows " + b); }); if(document.documentElement.scrollWidth > 390) out.push(name + " scrolls sideways"); };
    for(const p of ["dashboard", "expenses", "tax", "plan"]){ await go(p); checkPage(p); }
    await go("networth"); checkPage("networth");
    // #428: no rail — Accounts' list offers a Property chip only once there is a property.
    if(available('#netWorthBody [data-nw-filter="property"]')) out.push("the Property chip shows with no property");
    // Accounts' chips are the one switcher: no Investments group (nor its heading to that page) without shares.
    if(available('#netWorthBody [data-go="assets/Shares"]')) out.push("Investments shows with no shares");
    await go("reports"); checkPage("reports");
    if(/Property P&L|Capital gains/.test(page().innerText)) out.push("property or share reports offered");
    document.querySelector('[data-page="dashboard"]').click(); await wait(400);
    const bm = document.querySelector('[data-dashboard-sub="benchmarks"]'); if(bm){ bm.click(); await wait(400); }
    if(/Property against its suburb|Your shares against the market/.test(page().innerText)) out.push("property or share Benchmarks shown");
    await go("settings"); const pref = document.querySelector('[data-accounts-sub="preferences"]'); if(pref){ pref.click(); await wait(400); }
    if(!document.querySelector('[data-part-set="property"]')) out.push("no What this household has in Preferences");
    await go("networth");
    const add = document.querySelector('[data-part-show="property"]');
    if(!add) out.push("no way back in from Accounts"); else { add.click(); await wait(700);
      if(document.body.getAttribute("data-current-page") !== "properties") out.push("Add a property didn't open Property");
      if(!available('#addPropertyBtn')) out.push("Property offers no way to add the property after Add a property"); }
    return out;
  });
  r.forEach(f => failures.push(where + ": " + f));
  errors.splice(0).forEach(e => failures.push(where + ": " + e));
  await ctx.close();
}
// v3.181.0 (item 212): a scenario on its own page — opened from its card, changed, saved.
if(!SHOTS && EXTRAS){
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => { localStorage.setItem("wealthPlanner.hasSeenIntro", "1"); localStorage.setItem("wealthPlanner.tour", "skipped"); localStorage.setItem("wealthPlanner.modeOffer", "done"); if(!window.__simple) localStorage.setItem("wealthPlanner.mode", "advanced"); });
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
// #255 step 3 (pages.md §4): every view of an empty household, every empty state with its next step. One made with
// lib/empty.js (.empty-state) has a control in it, controls straight after it (data-empty="beside") or says there's
// nothing to do (data-empty="done"). A sentence that reads as an empty state but was written by hand fails, unless
// the row it's in has its own button (a checklist step) — an intro or a setting's value isn't one.
if(!SHOTS && EXTRAS){
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => { localStorage.setItem("wealthPlanner.hasSeenIntro", "1"); localStorage.setItem("wealthPlanner.tour", "skipped"); localStorage.setItem("wealthPlanner.modeOffer", "done"); if(!window.__simple) localStorage.setItem("wealthPlanner.mode", "advanced"); });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  const page = await ctx.newPage();
  await page.goto(base + "/index.html");
  await page.waitForFunction(() => document.documentElement.hasAttribute("data-wp-settled"), null, { timeout: 15000 });
  await page.evaluate(() => { const c = document.querySelector("[data-fr-close]"); if(c) c.click(); });
  await page.waitForTimeout(300);
  for (const [pg, attr, subs] of VIEWS) {
    await page.evaluate(async p => { const b = document.querySelector('[data-page="' + p + '"]') || document.querySelector('[data-avatar-go="' + p + '"]'); if(b) b.click(); else (await import('/src/components/nav.js')).showPage(p); }, pg);
    await page.waitForTimeout(300);
    for (const sub of subs) {
      if(sub){
        await page.evaluate(async ([a, s]) => { if(a === 'dashboard-sub'){ (await import('/src/components/nav.js')).showDashboardSubpage(s); return; } if(a === 'report'){ const c = document.querySelector('[data-report-choose]'); if(c) c.click(); } const b = document.querySelector('[data-' + a + '="' + s + '"]'); if(b) b.click(); }, [attr, sub]);
        await page.waitForTimeout(300);
      }
      await page.evaluate(() => document.querySelectorAll(".app-page:not([hidden]) details").forEach(d => { d.open = true; }));
      await page.waitForTimeout(150);
      const where = "empty household 390px " + pg + (sub ? "/" + sub : "");
      const bad = await page.evaluate(() => {
        const out = [], shown = e => e.getClientRects().length && !e.closest("[hidden]");
        const pageEl = document.querySelector(".app-page:not([hidden])");
        const control = el => !!el && !!el.querySelector('button:not([disabled]), a[href], input, select, textarea, [role="button"]');
        pageEl.querySelectorAll(".empty-state").forEach(e => {
          if(!shown(e)) return;
          const kind = e.getAttribute("data-empty"), text = e.textContent.trim().slice(0, 60);
          if(kind === "done") return;
          if(kind === "beside"){ const next = e.nextElementSibling; if(!(next && (next.matches('button, a[href], input, select, form') || control(next)))) out.push('"' + text + '" says its controls follow, and none do'); return; }
          if(!control(e)) out.push('"' + text + '" has no next step');
        });
        const EMPTY = /\b(no|nothing|none)\b[^.]{0,80}\b(yet|here|to (show|report|flag|fix|suggest))\b|appears? here once|will (appear|show) (here )?once|\bnot (set|entered) yet\b|nothing (to|in|logged|planned|expected)/i;
        [...pageEl.querySelectorAll("p, li, small, span, div")].filter(shown).forEach(e => {
          if(e.closest(".empty-state, .page-intro, .parts-auto") || !EMPTY.test(e.textContent) || e.textContent.trim().length > 260) return;
          if([...e.children].some(c => EMPTY.test(c.textContent) && shown(c))) return;
          const row = e.closest("li, .sk-block, tr");
          if(row && control(row)) return;
          out.push('"' + e.textContent.trim().replace(/\s+/g, " ").slice(0, 60) + '" is an empty state not made with emptyStateHtml');
        });
        return out;
      });
      bad.forEach(f => failures.push(where + ": " + f));
    }
  }
  await ctx.close();
}
const SIMPLE_CONTROL_CAP = 55;
// #414: Simple mode, on the sample household at 390px. On every view nothing marked advanced shows; where a page has
// some put away, it ends with "Show more on this page", and that brings every one of them back. Only data-level hides
// anything, so the views themselves are the Advanced ones above.
if(!SHOTS && EXTRAS){
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => { localStorage.setItem("wealthPlanner.hasSeenIntro", "1"); localStorage.setItem("wealthPlanner.tour", "skipped"); localStorage.setItem("wealthPlanner.modeOffer", "done"); localStorage.setItem("wealthPlanner.mode", "simple"); });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push("page error: " + e.message));
  await page.goto(base + "/index.html?mock=1");
  await page.waitForFunction(() => ((JSON.parse(localStorage.getItem("wealthPlanner.v1") || "{}").income) || []).length > 0, null, { timeout: 15000 });
  await page.waitForTimeout(800);
  if(await page.evaluate(() => document.documentElement.getAttribute("data-mode")) !== "simple") failures.push("simple mode: the page isn't in Simple mode");
  for (const [pg, attr, subs] of VIEWS) {
    if(pg === "reports") continue;   // one report page; its chooser is the journey's
    await page.evaluate(async p => { const b = document.querySelector('[data-page="' + p + '"]'); if(b) b.click(); else (await import('/src/components/nav.js')).showPage(p); }, pg);
    await page.waitForTimeout(300);
    for (const sub of subs) {
      if(sub) await page.evaluate(async ([a, s]) => { if(a === 'dashboard-sub'){ (await import('/src/components/nav.js')).showDashboardSubpage(s); return; } const b = document.querySelector('[data-' + a + '="' + s + '"]'); if(b) b.click(); }, [attr, sub]);
      // What Show more brought back on this page's last tab stays for the visit; each view starts put away again.
      await page.evaluate(async () => { (await import('/src/lib/mode.js')).hideShownAgain(); (await import('/src/components/showmore.js')).renderShowMore(); });
      await page.waitForTimeout(300);
      const where = "simple mode 390px " + pg + (sub ? "/" + sub : "");
      const r = await page.evaluate(async () => {
        // A tab in a rail too narrow for its tabs shows as an option of the rail's section picker, not as a box.
        const inPicker = e => { const rail = e.closest(".has-section-picker"); const sel = rail && rail.getClientRects().length && rail.querySelector(":scope > .section-picker");
          return !!sel && [...sel.options].some(o => o.textContent === e.textContent.trim()); };
        const vis = e => e.getClientRects().length > 0 || inPicker(e);
        const pageEl = document.querySelector(".app-page:not([hidden])");
        const advanced = () => [...document.querySelectorAll('[data-level="advanced"]')].filter(vis).map(e => (e.id || e.getAttribute("data-page") || e.textContent.trim()).slice(0, 30));
        const shownNow = advanced();
        const away = [...pageEl.querySelectorAll('[data-level="advanced"]')].filter(e => !e.parentElement.closest("[hidden]")).length;
        // #414: what's on screen to operate, counted as a person sees it — checkVisibility, since a closed <details>'s
        // contents keep a layout box (Categories' folded pickers once read as 591 controls; it is 51).
        const controls = [...pageEl.querySelectorAll('button, a[href], input:not([type=hidden]), select, summary, textarea')]
          .filter(e => e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) && e.getBoundingClientRect().width > 0 && !e.closest("#showMoreHere")).length;
        const more = document.getElementById("showMoreHere");
        const offered = !!more && !more.hidden && more.parentElement === pageEl;
        let after = null;
        // The picker re-measures in the next frame (lib/sectionpicker.js); two frames, then read.
        if(offered){ more.querySelector("[data-show-more]").click(); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); await new Promise(r => setTimeout(r, 50));
          after = [...pageEl.querySelectorAll('[data-level="advanced"]')].filter(e => !e.parentElement.closest("[hidden]") && !vis(e)).length; }
        return { shownNow, away, offered, after, controls };
      });
      if(r.shownNow.length) failures.push(where + ": advanced parts show: " + r.shownNow.join(", "));
      if(r.away && !r.offered) failures.push(where + ": " + r.away + " part(s) put away and no Show more on this page");
      if(!r.away && r.offered) failures.push(where + ": Show more on this page with nothing put away");
      if(r.offered && r.after) failures.push(where + ": Show more left " + r.after + " part(s) hidden");
      // Before Show more: the page as Simple shows it. The busiest today is Settings → Categories, at 51.
      if(r.controls > SIMPLE_CONTROL_CAP) failures.push(where + ": " + r.controls + " controls on screen in Simple (at most " + SIMPLE_CONTROL_CAP + ")");
    }
  }
  errors.forEach(e => failures.push("simple mode: " + e));
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
console.log("Smoke check passed: every page and subtab, 320px and 768px (light), 390px and 1280px (light and dark).");
