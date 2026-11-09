// Journeys and a speed budget (v3.203.1, item 234). The smoke script proves every page renders; this proves
// the things people do work, end to end, in a real browser at a phone's width, on invented data:
//
//   bills       — confirm the bills that fell due; each becomes a logged payment
//   transfer    — save a transfer that moves both balances, then Undo puts them back
//   autopay     — set up an automatic payment on an account, answer it on Home with a different amount
//                 kept for good: the transfer is recorded and the amount changes
//   scenario    — open a scenario, add a change, Save: its card moves; Make it real shows its plan
//   csv import  — a bank CSV through the review into Spending
//   loanstatement — a loan account's statement: its interest and fees go on the loan, not into Spending
//   loanguess   — the same statement with no account picked: the import asks which loan
//   pdf import  — a PDF statement read into the same review
//   cashrate    — the RBA's move, read from the site's file, recorded on the household's loans from a date
//   transitiontimeout — a skipped animation still completes navigation and its alias subpage
//   appdialogs  — shared text/password/decision dialogs, keyboard, nested Back, and scenario leave guards
//   welcomedialogs — standalone import cancellation and approval preserve/replace the saved household
//   datasafety  — a reload keeps the last edit; a tab with work in progress keeps it when another tab saves,
//                 and its own save is refused, recoverable, and reloads to the latest; sample data asks first
//   assetfields / vehiclefields — shared labels/help, category movement, snapshots, depreciation and mobile reflow
//   incomefields — income labels/help, sacrifice modes, pay schedules, pay-change drafts/history and mobile reflow
//   goals       — Plan → Goals' editor: labelled fields with help; a blank or negative target isn't saved; Tab keeps
//                 moving through a goal as it saves; Benchmarks' paste box and prices are named (#261 / #263)
//   taxlabels   — Tax's forms: every field named from its visible label, no help left in title tooltips (#261)
//   holdings    — Investments → Shares: a holding's editor named from its labels, help on screen, and it still saves (#261)
//   property    — Net worth → Property, editing, every tab: fields named from their labels, no tooltip-only help, and a
//                 label reaches its field; land value and purchase price still save (#261)
//   debts       — Net worth's debts: visible focus on the inline name, fields named for their debt, no $0 from a cleared
//                 balance (#261 / #263)
//   investvalidation — Investments' number fields (#263): a cleared quantity, price or brokerage, franking or a target
//                 share outside 0–100 is said beside the field and nothing is saved; closing the editor cancels it
//   propvalidation — Property's number fields (#263): a cleared value, land value or loan balance, a negative price, an
//                 ownership or investment share outside 0–100 is said beside the field and nothing is saved
//   taxvalidation — Tax's number fields (#263): a cleared HELP balance, SG rate, sacrifice or statement figure isn't
//                 saved as 0; hours over 168 aren't clamped; an interest account's share left blank is 100%, not 0%
//   calcvalidation — the purchase and invest calculators (#263): a cleared price, rate or initial amount isn't 0, and a
//                 deposit over 100% or a term of 0 years is said, not clamped
//   planvalidation — Plan → Projections (#263): a cleared return or inflation rate isn't 0%, a horizon of 80 isn't
//                 clamped to 50, the slider stays with the saved figure, and a life event's cleared amount isn't $0
//   cashvalidation — Cash flow → Spending (#263): a transaction's cleared amount isn't $0, and closing it cancels the draft
//   restvalidation — the last of #263: a card's limit, repayment day and cycle day, a retirement age, the benchmark's
//                 rate and a goal's target — out of range is said, not dropped, ignored or clamped
//   tabkeys     — #262: a property's tabs by keyboard (arrows, Home/End, one Tab stop, each tied to its panel); Reports'
//                 picker keeps focus through a redraw and Tab moves on from it; page subtabs say which is current
//   homecompare — #266: Home's open scenario comparison takes the whole row (no stretched neighbour), keeps its risk
//                 notes, matches the projected tile, reads a long name at 320px, and links to its assumptions
//   categories  — Settings → Categories: a rename cleared to retype keeps its lines, a taken name doesn't merge, and each
//                 delete says which category (#261 / #263)
//   validation  — a row editor's amount and claimable share save only when they read (#263): cleared, out of
//                 range or blank is said beside the field and nothing changes; a comma is explained
//   twotabs     — two tabs (#269): a second tab never stops the first saving; an idle tab takes another's save;
//                 work in progress survives; refreshes in either tab; near-simultaneous saves never pass silently
//   savings     — Home's net savings opens how it's worked out: the lines end at the tile's figure, an
//                 investment property's loan repayments among them, and the Budget's total counts them too
//
// Then the speed budget, on a large invented household at 4× CPU slowdown (about a mid-range phone):
// startup to the first full draw, saving a transfer, and adding a change to a scenario. Each has a
// limit; going over fails the run. The limits leave room for CI's slower machines — a step that
// redraws the whole app where it shouldn't (v3.200.2's transfer save, before the fix) is well over.
//
// Run: npm i --no-save playwright && npx playwright install chromium && node scripts/journeys.mjs
// JOURNEYS=transfer,csv runs some; SPEED=0 skips the budget; SPEED_ONLY=1 runs only it.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { STATEMENT_CSV, statementPdf, agentStatementPdf, LOAN_STATEMENT_CSV } from "./journeys/fixtures.mjs";

const root = process.env.SMOKE_ROOT ? path.resolve(process.env.SMOKE_ROOT) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".webmanifest": "application/manifest+json", ".png": "image/png", ".svg": "image/svg+xml" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let file = path.join(root, p);
  if(!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, "index.html");
  res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(0, r));
const base = "http://127.0.0.1:" + server.address().port;
const TODAY = "2026-11-03T10:00:00";
const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const failures = [];

function check(ok, what){ if(!ok) throw new Error(what); }
// A fresh phone-sized page on the sample household (or `stored`, a state to start from), the clock fixed.
async function fresh(opts){
  opts = opts || {};
  const ctx = await browser.newContext({ viewport: { width: opts.width || 390, height: 844 } });
  await ctx.addInitScript(([stored]) => {
    if(sessionStorage.getItem("journeyLoaded")) return;
    localStorage.setItem("wealthPlanner.hasSeenIntro", "1");
    if(stored) localStorage.setItem("wealthPlanner.v1", stored);
    sessionStorage.setItem("journeyLoaded", "1");
  }, [opts.stored || null]);
  await ctx.route(/fonts\.(googleapis|gstatic)\.com|docs\.google\.com|coingecko|frankfurter|dropboxapi|anthropic/, r => r.abort());
  if(opts.taxFailure){
    await ctx.route('**/src/components/taxyear.js*', r => {
      const source = fs.readFileSync(path.join(root,'src/components/taxyear.js'),'utf8');
      const faulty = source.replace('export function lodgedSnapshot(r){', 'export function lodgedSnapshot(r){ if(globalThis.__failLodged) throw new Error("Synthetic post-merge failure");');
      if(faulty === source) throw new Error('Tax error probe no longer matches the snapshot boundary');
      return r.fulfill({contentType:'text/javascript',body:faulty});
    });
  }
  const page = await ctx.newPage();
  // The journeys run on a fixed date (an automatic payment falls due on it); the speed budget on the real
  // clock, since Playwright's fixed clock stops performance marks.
  if(!opts.cpu) await page.clock.setFixedTime(new Date(TODAY));
  const errors = [];
  page.on("pageerror", e => errors.push("page error: " + e.message));
  page.on("console", m => { if(m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push("console: " + m.text()); });
  if(opts.cpu){ const cdp = await ctx.newCDPSession(page); await cdp.send("Emulation.setCPUThrottlingRate", { rate: opts.cpu }); }
  await page.goto(base + "/index.html" + (opts.query || (opts.stored ? "" : "?mock=1")));
  await page.waitForFunction(() => document.documentElement.hasAttribute("data-wp-ready") && document.querySelector(".app-page:not([hidden])"), null, { timeout: 60000 });
  await page.waitForTimeout(300);
  return { ctx, page, errors };
}
const st = (page, expr) => page.evaluate(new Function("return import('/src/state.js').then(function(m){ var state = m.state; return (" + expr + "); })"));
// #269: what's in storage, as opposed to the tab's own copy; a second tab on the same household, settled (its own
// startup and refreshes done); a save made in a tab; a budget line's name typed in its editor, left or not.
const stored = (page, expr) => page.evaluate(new Function("var state = JSON.parse(localStorage.getItem('wealthPlanner.v1')); return (" + expr + ");"));
async function secondTab(page){
  const other = await page.context().newPage();
  await other.goto(base + "/index.html");
  await other.waitForFunction(() => document.documentElement.hasAttribute("data-wp-ready"));
  await other.waitForLoadState("networkidle"); await other.waitForTimeout(1500);
  return other;
}
const saveIn = (page, amount) => page.evaluate(async a => { const m = await import("/src/state.js"); m.state.shared[0].amount = a; m.commit(["shared"]); }, amount);
// Work in progress for real: an account's new balance typed but not saved (it saves on its own button). Returns
// the input's selector.
async function typeBalance(page, value){
  await go(page, "accounts");
  await page.waitForSelector("#accountsTable .acct-card-update", { timeout: 10000 });
  await click(page, "#accountsTable .acct-card-update");
  const sel = "#accountsTable .acct-bal-input";
  await page.waitForSelector(sel, { timeout: 10000 });
  await page.fill(sel, String(value));
  return sel;
}
async function typeLineName(page, id, name, leave){
  if(!await page.locator('[data-line-id="' + id + '"] .f-what').isVisible().catch(() => false)){
    await go(page, "expenses", "data-expenses-sub", "budget");
    const group = await page.evaluate(i => { const r = document.querySelector('[data-line-id="' + i + '"]'); const c = r && r.closest(".m-card"); const h = c && c.querySelector("[data-budget-group-toggle]"); return h && h.getAttribute("aria-expanded") !== "true" ? h.getAttribute("data-budget-group-toggle") : null; }, id);
    if(group) await click(page, '[data-budget-group-toggle="' + group + '"]');
    await click(page, '[data-line-id="' + id + '"] [data-row-toggle]'); await page.waitForTimeout(300);
  }
  await page.fill('[data-line-id="' + id + '"] .f-what', name);
  if(leave){ await page.press('[data-line-id="' + id + '"] .f-what', "Tab"); await page.waitForTimeout(300); }
}
// Waits for what a step is waiting on, not a fixed time: a fixed wait that a busy CI runner overran failed three
// journeys (a fading toast, setup's focus, a page transition). A fixed wait stays only where a step checks that
// something did NOT happen — there's nothing to wait for — and is marked so.
async function settle(page){
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.waitForTimeout(150);
}
// Until fn (run in the page, with arg) is true, up to 10s. It doesn't fail by itself: the step's own check after it
// says what was wrong.
const until = (page, fn, arg) => page.waitForFunction(fn, arg, { timeout: 10000 }).catch(() => {});
// The same from this side: until test() (async, here) is true, up to 10s, polling every 100ms.
async function eventually(test){ for(let t0 = Date.now(); Date.now() - t0 < 10000; await new Promise(r => setTimeout(r, 100))) if(await test()) return; }
async function go(page, pageId, subAttr, sub){
  await page.evaluate(([p, a, s]) => { const b = document.querySelector('.mobile-tab[data-page="' + p + '"]') || document.querySelector('[data-page="' + p + '"]'); b.click(); if(a) setTimeout(() => document.querySelector("[" + a + '="' + s + '"]').click(), 50); }, [pageId, subAttr, sub]);
  // The page, and its subtab, showing — then a frame for what they draw.
  await page.waitForFunction(([p, a, s]) => document.body.getAttribute("data-current-page") === p &&
    (!a || !!document.querySelector("[" + a + '="' + s + '"]:is(.active, [aria-selected="true"], [aria-current="page"], [aria-current="true"])')),
    [pageId, subAttr, sub], { timeout: 10000 });
  await settle(page);
}
// Clicks the first match, once there is one (up to 10s) — a step's target can arrive after a redraw.
const click = async (page, sel) => {
  await page.waitForSelector(sel, { state: "attached", timeout: 10000 }).catch(() => {});
  return page.evaluate(s => { const el = document.querySelector(s); if(!el) throw new Error("No " + s); el.click(); }, sel);
};

// App questions are asynchronous DOM dialogs. Drive their controls rather than bypassing approval.
async function answerDialog(page, accept, value){
  const dialog = page.locator('.app-dialog');
  await dialog.waitFor({state:'visible'});
  if(value !== undefined){
    await dialog.locator('#appDialogInput').fill(value);
    if(await dialog.locator('#appDialogRepeat').count()) await dialog.locator('#appDialogRepeat').fill(value);
  }
  await dialog.locator(accept ? '[data-dialog-submit]' : '[data-dialog-cancel]').click();
  await dialog.waitFor({state:'detached'});
}
async function runBackup(page, action, value){
  await page.evaluate(async action => {
    const b = await import('/src/lib/backup.js');
    window.__backupDone = false;
    b[action]().finally(() => { window.__backupDone = true; });
  }, action);
  await answerDialog(page, true, value);
  await page.waitForFunction(() => window.__backupDone);
}

const JOURNEYS = {
  // #261 / #263: Settings → Categories — a rename cleared to retype doesn't uncategorise the lines in it, a taken name
  // doesn't merge two categories, and each delete says which category it removes.
  async categories(page){
    await page.waitForLoadState("networkidle"); await settle(page);
    await page.evaluate(async () => { const m = await import("/src/state.js"); m.state.shared[1].category = ""; m.commit(["shared"]); });
    const before = await stored(page, "({ cat: state.shared[0].category, other: state.shared[1].category, i: state.categories.indexOf(state.shared[0].category), n: state.categories.length })");
    await go(page, "settings", "data-accounts-sub", "categories");
    const field = '#categoriesTable .cat-mgmt-name[data-cat-index="' + before.i + '"]';
    await page.locator(field).waitFor({ state: "visible" });
    check(await page.getByRole("button", { name: "Delete " + before.cat, exact: true }).count() === 1, "a category's delete isn't named for it");
    check(await page.getByRole("button", { name: "Delete category", exact: true }).count() === 0, "deletes are still all named alike");
    // Cleared to retype: the lines keep their category until a new name renames them.
    await page.click(field, { clickCount: 3 }); await page.keyboard.press("Backspace");
    check(await stored(page, "state.shared[0].category") === before.cat, "clearing a category's name uncategorised its lines");
    check(await page.evaluate(f => document.querySelector(f).getAttribute("aria-invalid") === "true", field), "a blank category name isn't marked");
    await page.keyboard.type("Food shop", { delay: 10 });
    await eventually(async () => await stored(page, "state.shared[0].category") === "Food shop");
    check(await stored(page, "state.shared[0].category") === "Food shop", "the lines didn't follow the rename");
    check(await stored(page, "state.shared[1].category") === before.other, "the rename took in an uncategorised line");
    check(await page.getByRole("button", { name: "Delete Food shop", exact: true }).count() === 1, "a renamed category's delete kept its old name");
    // A name another category has: not applied, so nothing merges.
    const taken = await stored(page, "state.categories.find(function(c, k){ return k !== " + before.i + " && c; })");
    await page.click(field, { clickCount: 3 }); await page.keyboard.type(taken, { delay: 10 });
    check(await stored(page, "state.categories.filter(function(c){ return c === " + JSON.stringify(taken) + "; }).length") === 1, "typing a taken name merged two categories");
    check(await page.evaluate(f => document.querySelector(f).getAttribute("aria-invalid") === "true", field), "a taken category name isn't marked");
    // A redraw while it's being typed (the app's own price or cash-rate read can land then — it did on CI) keeps the
    // draft, its message and the caret: the replacement field is drawn from what's saved.
    await page.evaluate(async () => (await import("/src/components/redraw.js")).renderAll());
    const kept = await page.evaluate(f => { const el = document.querySelector(f), m = el && document.getElementById(el.id + "-error");
      return { value: el.value, invalid: el.getAttribute("aria-invalid"), message: m ? m.textContent : "", focused: document.activeElement === el, caret: el.selectionStart }; }, field);
    check(kept.value === taken && kept.invalid === "true" && /already/.test(kept.message) && kept.focused && kept.caret === taken.length,
      "a redraw mid-typing lost the draft (" + JSON.stringify(kept) + ")");
  },
  // #266: Home's scenario comparison, opened — the whole row (at 390px it was a 174px column 2.6 screens tall, and the
  // Tax tile beside it stretched to match), its risk notes kept, the same figures as the projection, a long name read
  // at 320px, and each outcome a way to its assumptions.
  async homecompare(page){
    await page.waitForLoadState("networkidle"); await settle(page);
    // A long scenario name (invented), to check it wraps rather than widening anything.
    const longName = "Buy the place near the park with the bigger yard and a granny flat";
    await page.evaluate(async n => { const sc = await import("/src/components/scenarios.js"); const m = await import("/src/state.js");
      const other = m.state.scenarios.find(x => x !== m.state.baselineScenario); sc.renameScenarioTo(other, n); m.commit(["scenarios", "home", "purchase", "invest", "activeScenario", "baselineScenario"]); }, longName);
    await go(page, "dashboard", "data-dashboard-sub", "overview");
    const tile = '#dashboardStats [data-home-card="scenarios"]';
    await page.locator(tile + " summary").waitFor({ state: "visible" });
    const measure = () => page.evaluate(t => { const el = document.querySelector(t), r = el.getBoundingClientRect(), g = el.parentElement.getBoundingClientRect();
      const mates = [...el.parentElement.children].filter(x => x !== el && x.getClientRects().length && Math.abs(x.getBoundingClientRect().top - r.top) < 2);
      return { w: Math.round(r.width), grid: Math.round(g.width), mates: mates.length, doc: document.documentElement.scrollWidth, vw: innerWidth }; }, tile);
    const closed = await measure();
    // Opened from the keyboard: the whole row, nothing beside it, focus still on the summary.
    await page.focus(tile + " summary"); await page.keyboard.press("Enter"); await settle(page);
    const open = await measure();
    check(open.w === open.grid && open.mates === 0, "the open comparison doesn't take the whole row: " + JSON.stringify({ closed, open }));
    check(open.doc <= open.vw, "the open comparison widened the page to " + open.doc + "px");
    check(await page.evaluate(t => document.activeElement === document.querySelector(t + " summary"), tile), "opening the comparison lost focus");
    // A redraw while it's open (an edit elsewhere, the app's own price read — it landed here on CI) keeps it open and
    // focused: Home's tiles redraw through keepUi, and arranging them doesn't move cards already in order.
    for(const how of ["renderAll", "commit", "renderDashboardStats"]){
      await page.evaluate(async h => {
        if(h === "renderAll") (await import("/src/components/redraw.js")).renderAll();
        else if(h === "commit") (await import("/src/state.js")).commit(["shared"]);
        else (await import("/src/components/dashboard.js")).renderDashboardStats();
      }, how);
      await settle(page);
      const kept = await page.evaluate(t => { const s = document.querySelector(t + " summary"); return { focused: document.activeElement === s, open: !!s && s.parentElement.open }; }, tile);
      check(kept.focused && kept.open, "a redraw (" + how + ") closed the comparison or lost its focus: " + JSON.stringify(kept));
    }
    // Its risk notes are all still there.
    const text = await page.evaluate(t => document.querySelector(t + " details").innerText, tile);
    for(const must of ["not a guaranteed outcome", "funding gap", "These are estimates, not guarantees", "Projected net worth"]){
      check(text.includes(must), "the open comparison dropped \"" + must + "\"");
    }
    // The same figure as Home's projected tile, for the scenario shown.
    const same = await page.evaluate(t => {
      const active = document.querySelector('#dashboardStats [data-home-card="projected"] b');
      const rows = [...document.querySelectorAll(t + " tbody tr")];
      const head = [...document.querySelectorAll(t + " thead th")].map(h => h.textContent);
      const col = head.findIndex(h => /^Projected net worth/.test(h));
      return { tile: active && active.getAttribute("title"), table: rows.map(r => r.children[col] && r.children[col].textContent), col };
    }, tile);
    check(same.col > 0 && same.table.includes(same.tile), "the comparison's projected net worth doesn't match Home's: " + JSON.stringify(same));
    // A long name at 320px: it wraps, the page doesn't scroll sideways.
    await page.setViewportSize({ width: 320, height: 844 }); await settle(page);
    const narrow = await measure();
    check(narrow.doc <= 320 && narrow.w === narrow.grid, "at 320px the comparison with a long name overflows: " + JSON.stringify(narrow));
    await page.setViewportSize({ width: 390, height: 844 }); await settle(page);
    // Closed again: back in its cell.
    await page.focus(tile + " summary"); await page.keyboard.press("Enter"); await settle(page);
    const again = await measure();
    check(again.w === closed.w && again.mates === closed.mates, "closing the comparison didn't put the tile back: " + JSON.stringify({ closed, again }));
    // Outcomes link to their assumptions: a scenario's page, and Projections.
    await page.focus(tile + " summary"); await page.keyboard.press("Enter"); await settle(page);
    await click(page, tile + ' [data-dashboard-jump="projections"]');
    await until(page, () => document.body.getAttribute("data-current-page") === "plan" && !!document.querySelector('[data-plan-sub="projections"][aria-current="page"]'));
    check(await page.evaluate(() => document.body.getAttribute("data-current-page") === "plan" && !!document.querySelector('[data-plan-sub="projections"][aria-current="page"]')), "the Projections link didn't open Plan → Projections");
    await go(page, "dashboard", "data-dashboard-sub", "overview");
    await page.evaluate(t => { const d = document.querySelector(t + " details"); if(d) d.open = true; }, tile);
    await click(page, tile + ' [data-edit-scenario="' + longName + '"]');
    await until(page, () => document.body.getAttribute("data-current-page") === "scenario");
    check(await page.evaluate(() => document.body.getAttribute("data-current-page") === "scenario"), "a scenario's name in the comparison didn't open its page");
    check(await page.evaluate(n => { const pg = document.querySelector(".app-page:not([hidden])"); return pg.innerText.includes(n) || [...pg.querySelectorAll("input")].some(i => i.value === n); }, longName),
      "the scenario page opened isn't the one tapped");
  },
  // #262: tabs and choosers by keyboard — a property card's tabs are ARIA tabs that work as tabs; Reports' picker is a
  // chooser that keeps focus when it redraws; page subtabs say which one is showing.
  async tabkeys(page){
    await page.waitForLoadState("networkidle"); await settle(page);
    // Property tabs.
    await go(page, "properties");
    const list = '#propertiesBody [role="tablist"]';
    await page.locator(list + ' [role="tab"]').first().waitFor({ state: "visible" });
    const state = () => page.evaluate(l => {
      const tabs = [...document.querySelector(l).querySelectorAll('[role="tab"]')].filter(t => t.getClientRects().length);
      const a = document.activeElement, sel = tabs.find(t => t.getAttribute("aria-selected") === "true");
      const panel = sel && document.getElementById(sel.getAttribute("aria-controls"));
      return { n: tabs.length, stops: tabs.filter(t => t.tabIndex === 0).length, focused: tabs.indexOf(a), selected: tabs.indexOf(sel),
        panelShown: !!panel && !panel.hidden && panel.getAttribute("role") === "tabpanel" && panel.getAttribute("aria-labelledby") === sel.id,
        othersHidden: tabs.filter(t => t !== sel).every(t => { const p = document.getElementById(t.getAttribute("aria-controls")); return p && p.hidden; }) };
    }, list);
    await page.evaluate(l => document.querySelector(l + ' [role="tab"][aria-selected="true"]').focus(), list);
    let s0 = await state();
    check(s0.n >= 3 && s0.stops === 1 && s0.panelShown && s0.othersHidden, "a property's tabs aren't one Tab stop tied to their panels: " + JSON.stringify(s0));
    const press = async (key, want, what) => {
      await page.keyboard.press(key); await settle(page);
      const st = await state();
      check(st.focused === want && st.selected === want && st.stops === 1 && st.panelShown && st.othersHidden, what + ": " + JSON.stringify(st));
    };
    await press("Home", 0, "Home didn't go to the first tab");
    await press("ArrowRight", 1, "ArrowRight didn't move to the next tab");
    await press("End", s0.n - 1, "End didn't go to the last tab");
    await press("ArrowRight", 0, "ArrowRight on the last tab didn't wrap to the first");
    await press("ArrowLeft", s0.n - 1, "ArrowLeft on the first tab didn't wrap to the last");
    await press("Home", 0, "Home didn't go back to the first tab");
    // Reports: choosing a report, or changing its period, redraws the page — focus stays on the control used.
    await go(page, "reports");
    await page.locator('[data-report="categories"]').waitFor({ state: "visible" });
    check(await page.locator('#reportsBody [role="tablist"], #reportsBody [role="tab"]').count() === 0, "Reports' picker still claims to be tabs");
    await page.focus('[data-report="categories"]'); await page.keyboard.press("Enter"); await settle(page);
    const rep = await page.evaluate(() => ({ key: document.activeElement.getAttribute("data-report"), current: document.querySelector('[data-report="categories"]').getAttribute("aria-current"),
      others: document.querySelectorAll('[data-report][aria-current]').length }));
    check(rep.key === "categories" && rep.current === "true" && rep.others === 1, "choosing a report lost focus or didn't mark it current: " + JSON.stringify(rep));
    await page.keyboard.press("Tab");
    check(await page.evaluate(() => document.activeElement && document.activeElement !== document.body && !!document.activeElement.closest("#reportsBody")), "Tab after choosing a report restarted at the page body");
    const range = '#reportsBody [data-rf="range"]';
    check(await page.locator(range).count() === 1, "the report has no period select to check");
    {
      const other = await page.evaluate(r => { const s = document.querySelector(r); return [...s.options].map(o => o.value).find(v => v !== s.value && v !== "custom"); }, range);
      await page.focus(range); await page.selectOption(range, other); await settle(page);
      check(await page.evaluate(r => document.activeElement === document.querySelector(r), range), "changing a report's period lost focus");
    }
    // Page subtabs: the current one says so.
    await go(page, "tax", "data-tax-sub", "returns");
    const cur = await page.evaluate(() => [...document.querySelectorAll("#taxSubnav [data-tax-sub]")].map(b => b.getAttribute("data-tax-sub") + ":" + (b.getAttribute("aria-current") || "")));
    check(cur.join(",") === "year:,returns:page,documents:,people:", "Tax's subtabs don't say which is current: " + cur.join(","));
    check(await page.evaluate(() => document.getElementById("taxSubnav").getAttribute("aria-label") === "Tax sections"), "Tax's subtabs aren't a named group");
  },
  // #263, the last family: fields where blank already meant "none", but a figure out of range was dropped (a negative
  // goal target erased the target), ignored, or clamped (a cycle day of 31 became 28) without a word.
  async restvalidation(page){
    await page.waitForLoadState("networkidle"); await settle(page);
    const marked = sel => page.evaluate(s => { const el = document.querySelector(s); const msg = el && document.getElementById(el.id + "-error");
      return !!el && el.getAttribute("aria-invalid") === "true" && !!msg && !!msg.textContent.trim() && (el.getAttribute("aria-describedby") || "").split(" ").includes(msg.id); }, sel);
    // No separate scroll: fill scrolls the field into view itself, and finds it again if a redraw has just replaced it
    // (a valid save redraws its panel — on CI a scroll landed mid-redraw, on an element no longer in the page).
    const tryField = async (sel, typed, expr, how) => {
      await page.locator(sel).waitFor({ state: "visible" });
      const was = await stored(page, expr);
      await page.fill(sel, typed); await page.press(sel, "Tab");
      check(await stored(page, expr) === was, how + " typed as " + JSON.stringify(typed) + " saved " + JSON.stringify(await stored(page, expr)) + " (was " + JSON.stringify(was) + ")");
      check(await marked(sel), how + " typed as " + JSON.stringify(typed) + " isn't marked with a message");
    };
    // Accounts: a credit card's cycle day, repayment day and limit.
    await go(page, "accounts");
    const card = await stored(page, "state.accounts.findIndex(function(a){ return a.type === 'credit'; })");
    check(card >= 0, "the demo household has no credit card");
    const A = '#accountsTable [data-acct-index="' + card + '"]';
    const cardId = await stored(page, "state.accounts[" + card + "].id");
    await click(page, '#accountsTable [data-acct-toggle="' + cardId + '"]');
    await page.locator(A + ".acct-mgmt-day").waitFor({ state: "visible" });
    await tryField(A + ".acct-mgmt-day", "31", "state.accounts[" + card + "].statementStartDay", "a cycle day");
    await tryField(A + ".acct-mgmt-payday", "40", "state.accounts[" + card + "].payDay", "a repayment day");
    await tryField(A + ".acct-mgmt-limit", "-500", "state.accounts[" + card + "].limit", "a card limit");
    // Home → Insights: a retirement age.
    await go(page, "dashboard", "data-dashboard-sub", "insights");
    await page.locator("#fireCurrentAge").waitFor({ state: "visible" });
    await page.fill("#fireCurrentAge", "41"); await page.press("#fireCurrentAge", "Tab");
    await eventually(async () => await stored(page, "(state.fire || {}).currentAge") === 41);
    await settle(page); // the save's own redraw of the panel, done before the next field is tried
    await tryField("#fireCurrentAge", "120", "(state.fire || {}).currentAge", "an age");
    // Home → Benchmarks: the fixed rate, and a goal's target.
    await go(page, "dashboard", "data-dashboard-sub", "benchmarks");
    await page.locator("[data-bm-rate]").waitFor({ state: "visible" });
    await tryField("[data-bm-rate]", "", "state.benchmark.fixedRate", "the benchmark's rate");
    await page.evaluate(async () => { const m = await import("/src/state.js"); m.state.goals = [{ kind: "emergencyFund", target: 6 }]; m.commit(["goals"]); (await import("/src/components/benchmarks.js")).renderBenchmarks(); });
    await page.locator("[data-goal-target]").waitFor({ state: "visible" });
    await tryField("[data-goal-target]", "-3", "state.goals[0].target", "a goal's target");
  },
  // #263: Cash flow → Spending — a transaction's cleared amount isn't saved as $0, and closing the row cancels it.
  async cashvalidation(page){
    await page.waitForLoadState("networkidle"); await settle(page);
    await go(page, "expenses", "data-expenses-sub", "spending");
    await until(page, () => [...document.querySelectorAll("#transactionsTable [data-row-toggle]")].some(t => t.getClientRects().length));
    await page.evaluate(() => { const t = [...document.querySelectorAll("#transactionsTable [data-row-toggle]")].find(t => t.getClientRects().length); if(!t) throw new Error("no transaction to open"); t.click(); });
    const row = "#transactionsTable .m-row.open", amt = row + " .tx-amount";
    await page.locator(amt).waitFor({ state: "visible" });
    const idx = Number(await page.evaluate(a => document.querySelector(a).getAttribute("data-tx-index"), amt));
    // The row itself, by its index — the amount field (and its data-tx-index) only exists while the editor is open.
    const txRow = '#transactionsTable .m-row[data-section="tx"][data-index="' + idx + '"]';
    const saved = () => stored(page, "state.transactions[" + idx + "].amount");
    const was = await saved();
    await page.fill(amt, "");
    check(await saved() === was, "clearing a transaction's amount saved " + await saved());
    check(await page.locator(amt).getAttribute("aria-invalid") === "true", "a transaction's cleared amount isn't marked");
    await page.evaluate(() => document.querySelector("#transactionsTable .m-row.open [data-row-toggle]").click());
    await until(page, () => !document.querySelector("#transactionsTable .m-row.open"));
    check(await page.evaluate(() => !document.querySelector("#transactionsTable .m-row.open")), "the transaction didn't close");
    await page.evaluate(r => document.querySelector(r + " [data-row-toggle]").click(), txRow);
    await page.locator(amt).waitFor({ state: "visible" });
    const back = await page.evaluate(a => { const f = document.querySelector(a); return { v: f.value, bad: f.getAttribute("aria-invalid") }; }, amt);
    check(Number(back.v) === was && back.bad !== "true", "closing the transaction kept the cleared amount (" + JSON.stringify(back) + ")");
    // The refund toggle flips the saved amount and shows it, so a draft's message goes with it.
    await page.fill(amt, "");
    await click(page, row + " [data-tx-sign]");
    await eventually(async () => await saved() === -was);
    const flipped = await page.evaluate(a => { const f = document.querySelector(a); return { v: f.value, bad: f.getAttribute("aria-invalid") }; }, amt);
    check(await saved() === -was && Number(flipped.v) === -was && flipped.bad !== "true", "the refund toggle left a stale draft (" + JSON.stringify(flipped) + ")");
    await click(page, row + " [data-tx-sign]");
    await eventually(async () => await saved() === was);
  },
  // #263: Plan → Projections — a cleared or out-of-range assumption is said beside the field and nothing is saved
  // (before, a cleared return saved 0% and redrew the plan on it; a horizon of 80 saved 50).
  async planvalidation(page){
    await page.waitForLoadState("networkidle"); await settle(page);
    await go(page, "plan", "data-plan-sub", "projections");
    await page.evaluate(() => document.querySelectorAll(".app-page:not([hidden]) details").forEach(d => { d.open = true; }));
    const marked = sel => page.evaluate(s => { const el = document.querySelector(s); const msg = el && document.getElementById(el.id + "-error");
      return !!el && el.getAttribute("aria-invalid") === "true" && !!msg && !!msg.textContent.trim() && (el.getAttribute("aria-describedby") || "").split(" ").includes(msg.id); }, sel);
    const proj = k => stored(page, "state.projection." + k);
    for(const [id, typed, key] of [["#projInvestRate", "", "investReturnRate"], ["#projInflationRate", "", "inflationRate"], ["#projHorizon", "80", "horizonYears"], ["#projRateShock", "-1", "rateShockPct"]]){
      await page.locator(id).scrollIntoViewIfNeeded();
      const was = await proj(key);
      await page.fill(id, typed);
      check(await proj(key) === was, key + " typed as " + JSON.stringify(typed) + " saved " + await proj(key) + " (was " + was + ")");
      check(await marked(id), key + " typed as " + JSON.stringify(typed) + " isn't marked with a message");
      if(id === "#projInvestRate") check(Number(await page.inputValue("#projInvestRateRange")) === was, "the return's slider moved to a figure that wasn't saved");
      await page.fill(id, String(was));
      check(await page.evaluate(s => !document.querySelector(s).hasAttribute("aria-invalid"), id), key + " still marked once it reads");
    }
    // A valid rate saves, and the slider follows it.
    await page.fill("#projInvestRate", "6.5");
    await eventually(async () => await proj("investReturnRate") === 6.5);
    check(await proj("investReturnRate") === 6.5 && Number(await page.inputValue("#projInvestRateRange")) === 6.5, "a valid return didn't save, or its slider didn't follow");
    // A life event: its cleared amount isn't $0.
    await page.evaluate(() => document.querySelector("[data-le-add]").click());
    const amt = '#lifeEventsBody [data-le-id] [data-le-field="amount"]';
    await page.locator(amt).first().waitFor({ state: "visible" });
    await page.locator(amt).first().fill("12000"); await page.locator(amt).first().press("Tab");
    const evId = await page.evaluate(a => document.querySelector(a).closest("[data-le-id]").getAttribute("data-le-id"), amt);
    const evAmt = () => stored(page, "(state.lifeEvents || []).find(function(e){ return e.id === " + JSON.stringify(evId) + "; }).amount");
    await eventually(async () => await evAmt() === 12000);
    await page.locator(amt).first().fill(""); await page.locator(amt).first().press("Tab");
    check(await evAmt() === 12000, "clearing a life event's amount saved " + await evAmt());
    check(await page.locator(amt).first().getAttribute("aria-invalid") === "true", "a life event's cleared amount isn't marked");
  },
  // #263: the purchase and invest calculators — a cleared or out-of-range figure is said beside the field and the
  // scenario's draft doesn't change (before, a cleared price became $0 and a 150% deposit became 100%).
  async calcvalidation(page){
    await go(page, "plan", "data-plan-sub", "scenarios");
    const name = await page.evaluate(() => [...document.querySelectorAll("#cards [data-edit-scenario]")].map(b => b.getAttribute("data-edit-scenario"))
      .find(n => { const c = document.querySelector('#cards [data-edit-scenario="' + n + '"]').closest(".card"); return c && /buy/i.test(c.innerText); }));
    check(!!name, "no buying scenario in the demo household");
    await click(page, '#cards [data-edit-scenario="' + name + '"]'); await until(page, () => document.body.getAttribute("data-current-page") === "scenario"); await settle(page);
    await click(page, "[data-sc-calc]"); await until(page, () => document.body.getAttribute("data-current-page") === "calc"); await settle(page);
    const cfg = (kind, k) => page.evaluate(async a => { const m = await import("/src/state.js"); const c = await import("/src/components/calculators.js"); return m.state[a[0]][c.calcFor.key][a[1]]; }, [kind, k]);
    const marked = sel => page.evaluate(s => { const el = document.querySelector(s); const msg = el && document.getElementById(el.id + "-error");
      return !!el && el.getAttribute("aria-invalid") === "true" && !!msg && !!msg.textContent.trim() && (el.getAttribute("aria-describedby") || "").split(" ").includes(msg.id); }, sel);
    const P = "#calcScenarioBody [data-calc-scenario] ", I = "#calcScenarioBody [data-invest-scenario] ";
    await page.locator(P + ".calc-price").waitFor({ state: "visible" });
    // A valid figure goes through.
    await page.fill(P + ".calc-price", "750000");
    await eventually(async () => await cfg("purchase", "price") === 750000);
    check(await cfg("purchase", "price") === 750000, "a valid price didn't save to the draft");
    const tries = [
      [P + ".calc-price", "", "purchase", "price"],
      [P + ".calc-depositPct", "150", "purchase", "depositPct"],
      [P + ".calc-term", "0", "purchase", "termYears"],
      [P + ".calc-rate", "", "purchase", "rate"],
      [I + ".invest-initial", "-100", "invest", "initialAmount"]
    ];
    for(const [sel, typed, kind, key] of tries){
      // The invest calculator's fields show once it's on (in the scenario's draft, instead of buying).
      if(kind === "invest" && !await page.locator(sel).count()){ await page.evaluate(s => document.querySelector(s).click(), I + ".invest-enabled"); await page.locator(sel).waitFor({ state: "visible" }); }
      if(!await page.locator(sel).count()) { check(false, sel + " isn't on the calculators page"); }
      await page.locator(sel).scrollIntoViewIfNeeded();
      const was = await cfg(kind, key);
      await page.fill(sel, typed);
      check(await cfg(kind, key) === was, key + " typed as " + JSON.stringify(typed) + " saved " + await cfg(kind, key) + " (was " + was + ")");
      check(await marked(sel), key + " typed as " + JSON.stringify(typed) + " isn't marked with a message");
      await page.fill(sel, String(was));
      check(await page.evaluate(s => !document.querySelector(s).hasAttribute("aria-invalid"), sel), key + " still marked once it reads");
    }
  },
  // #263: Tax's number fields — a cleared figure is said beside the field and nothing is saved (before, a cleared SG rate
  // saved 0 and an interest account's share left blank saved 0%, though its placeholder says 100).
  async taxvalidation(page){
    await page.waitForLoadState("networkidle"); await settle(page);
    const marked = sel => page.evaluate(s => { const el = document.querySelector(s); const msg = el && document.getElementById(el.id + "-error");
      return !!el && el.getAttribute("aria-invalid") === "true" && !!msg && !!msg.textContent.trim() && (el.getAttribute("aria-describedby") || "").split(" ").includes(msg.id); }, sel);
    // People: a cleared HELP balance isn't $0 owed; hours a week over 168 aren't clamped to 168.
    await go(page, "tax", "data-tax-sub", "people");
    const help = "#peopleTable .pp-help", week = "#peopleTable .pp-week";
    await page.locator(help).first().waitFor({ state: "visible" });
    const person = await page.evaluate(h => document.querySelector(h).getAttribute("data-pp-person"), help);
    const setting = k => stored(page, "(state.tax.settings[" + JSON.stringify(person) + "] || {})." + k);
    await page.fill(help, "15000"); await page.press(help, "Tab");
    await eventually(async () => await setting("helpBalance") === 15000);
    const owed = await setting("helpBalance");
    check(owed === 15000, "a HELP balance didn't save");
    await page.fill(help, ""); await page.press(help, "Tab");
    check(await setting("helpBalance") === owed, "clearing a HELP balance saved " + await setting("helpBalance"));
    check(await marked(help), "a cleared HELP balance isn't marked with a message");
    const hours = await setting("hoursPerWeek");
    await page.fill(week, "200"); await page.press(week, "Tab");
    check(await setting("hoursPerWeek") === hours, "200 hours a week saved " + await setting("hoursPerWeek"));
    check(await marked(week), "200 hours a week isn't marked with a message");
    // The year's household settings and this year's sacrifice.
    await go(page, "tax", "data-tax-sub", "year");
    await page.evaluate(() => document.querySelectorAll("#taxSuperBody details").forEach(d => { d.open = true; }));
    const sg = await stored(page, "state.tax.sgRate");
    await page.fill("#taxSgRate", "");
    check(await stored(page, "state.tax.sgRate") === sg, "clearing the SG rate saved " + await stored(page, "state.tax.sgRate"));
    check(await marked("#taxSgRate"), "a cleared SG rate isn't marked with a message");
    const sac = '#taxSuperBody [data-tax-person="' + person + '"] .tax-sacrifice';
    const sacWas = await setting("superSacrificeAnnual");
    await page.fill(sac, "-500");
    check(await setting("superSacrificeAnnual") === sacWas, "a negative sacrifice saved " + await setting("superSacrificeAnnual"));
    check(await marked(sac), "a negative sacrifice isn't marked with a message");
    // The year's return: a statement's gross, cleared, isn't $0; an interest account's share left blank is all of it.
    await go(page, "tax", "data-tax-sub", "returns");
    await click(page, '[data-ty-add="int"][data-ty-person="' + person + '"]');
    const yearRows = "(function(){ var y = state.taxYears || {}; var k = Object.keys(y).sort().pop(); return y[k].people[" + JSON.stringify(person) + "].interest; })()";
    // This person's interest rows only (another's can be in a closed section), in a section opened to show them.
    const mine = '.ty-row-int [data-ty-person="' + person + '"]';
    const share = mine + '[data-ty-key="sharePct"]', gross = mine + '[data-ty-key="gross"]';
    await until(page, g => document.querySelector(g), gross);
    await page.evaluate(g => { const el = [...document.querySelectorAll(g)].pop(); for(let d = el && el.closest("details"); d; d = d.parentElement && d.parentElement.closest("details")) d.open = true; }, gross);
    await page.locator(gross).last().waitFor({ state: "visible" });
    await page.locator(gross).last().fill("120"); await page.locator(gross).last().press("Tab");
    await eventually(async () => (await stored(page, yearRows + ".slice(-1)[0].gross")) === 120);
    await page.locator(gross).last().fill(""); await page.locator(gross).last().press("Tab");
    check(await stored(page, yearRows + ".slice(-1)[0].gross") === 120, "clearing a return's gross saved " + await stored(page, yearRows + ".slice(-1)[0].gross"));
    check(await page.locator(gross).last().getAttribute("aria-invalid") === "true", "a cleared gross isn't marked");
    await page.locator(share).last().fill("40"); await page.locator(share).last().press("Tab");
    await eventually(async () => (await stored(page, yearRows + ".slice(-1)[0].sharePct")) === 40);
    await page.locator(share).last().fill(""); await page.locator(share).last().press("Tab");
    await eventually(async () => (await stored(page, yearRows + ".slice(-1)[0].sharePct")) == null);
    check(await stored(page, yearRows + ".slice(-1)[0].sharePct") == null, "a blank share saved " + await stored(page, yearRows + ".slice(-1)[0].sharePct") + "%, not all of it");
  },
  // #263: Property's number fields — a cleared or out-of-range figure is said beside the field and nothing is saved
  // (before, a cleared value saved $0 and an ownership share of 150% saved 100); closing a loan cancels its draft.
  async propvalidation(page){
    await page.waitForLoadState("networkidle"); await settle(page);
    await go(page, "properties");
    await click(page, "[data-prop-edit]");
    const P = "state.properties[0].";
    const marked = sel => page.evaluate(s => { const el = document.querySelector(s); const msg = el && document.getElementById(el.id + "-error");
      return !!el && el.getAttribute("aria-invalid") === "true" && !!msg && !!msg.textContent.trim() && (el.getAttribute("aria-describedby") || "").split(" ").includes(msg.id); }, sel);
    const tab = async t => { await page.evaluate(t => document.querySelector('[data-prop-tab][data-tab="' + t + '"]').click(), t);
      await page.waitForFunction(t => { const x = document.querySelector('[data-prop-panel="' + t + '"]'); return x && !x.hidden; }, t);
      // One at a time: expanding a section redraws the card, so the rest of a list taken before it are stale.
      for(let n = 0; n < 20 && await page.evaluate(() => { const x = document.querySelector('.prop-tab-panel:not([hidden]) [data-prop-section-toggle][aria-expanded="false"]'); if(x) x.click(); return !!x; }); n++) await settle(page);
      await page.evaluate(() => document.querySelectorAll(".prop-tab-panel:not([hidden]) details").forEach(d => { d.open = true; }));
      await settle(page); };
    const panel = '.prop-tab-panel:not([hidden]) ';
    await tab("overview");
    // Current value (saved as typed): cleared isn't $0.
    const value = await stored(page, P + "value");
    await page.fill(panel + ".prop-value", "");
    check(await stored(page, P + "value") === value, "clearing a property's value saved " + await stored(page, P + "value"));
    check(await marked(panel + ".prop-value"), "a cleared property value isn't marked with a message");
    await page.fill(panel + ".prop-value", String(value));
    // Land value and purchase price (saved on change).
    const land = await stored(page, P + "landValue");
    await page.fill(panel + ".prop-land-value", ""); await page.press(panel + ".prop-land-value", "Tab");
    check(await stored(page, P + "landValue") === land, "clearing the land value saved " + await stored(page, P + "landValue"));
    check(await marked(panel + ".prop-land-value"), "a cleared land value isn't marked with a message");
    const paid = await stored(page, P + "purchasePrice");
    await page.fill(panel + ".prop-purchase-price", "-5"); await page.press(panel + ".prop-purchase-price", "Tab");
    check(await stored(page, P + "purchasePrice") === paid, "a negative purchase price saved " + await stored(page, P + "purchasePrice"));
    check(await marked(panel + ".prop-purchase-price"), "a negative purchase price isn't marked with a message");
    // Ownership: 150% isn't clamped to 100; a valid share saves.
    const own = panel + ".prop-ownership >> nth=0";
    const person = await page.evaluate(s => document.querySelector(s).getAttribute("data-ownership-person"), panel + ".prop-ownership");
    const ownWas = await stored(page, P + "ownership && " + P + "ownership[" + JSON.stringify(person) + "]");
    await page.fill(own, "150"); await page.press(own, "Tab");
    check(await stored(page, P + "ownership && " + P + "ownership[" + JSON.stringify(person) + "]") === ownWas, "an ownership share of 150% saved " + await stored(page, P + "ownership[" + JSON.stringify(person) + "]"));
    check(await marked(panel + ".prop-ownership"), "an ownership share of 150% isn't marked with a message");
    // A loan: a cleared balance and an investment share of 150% aren't saved; closing the loan cancels the draft.
    await tab("loans");
    await page.evaluate(() => [...document.querySelectorAll('.prop-tab-panel:not([hidden]) [data-loan-index] [data-row-toggle]')].find(t => t.getClientRects().length).click());
    const loan = ".m-row.open[data-loan-index]";
    await page.locator(loan + " .loan-balance").waitFor({ state: "visible" });
    const bal = await stored(page, P + "loans[0].balance");
    await page.fill(loan + " .loan-balance", "");
    check(await stored(page, P + "loans[0].balance") === bal, "clearing a loan's balance saved " + await stored(page, P + "loans[0].balance"));
    check(await marked(loan + " .loan-balance"), "a cleared loan balance isn't marked with a message");
    const inv = await stored(page, P + "loans[0].investPct");
    await page.fill(loan + " .loan-invest-pct", "150");
    check(await stored(page, P + "loans[0].investPct") === inv, "an investment share of 150% saved " + await stored(page, P + "loans[0].investPct"));
    check(await marked(loan + " .loan-invest-pct"), "an investment share of 150% isn't marked with a message");
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector(".m-row.open[data-loan-index]"));
    await page.evaluate(() => [...document.querySelectorAll('.prop-tab-panel:not([hidden]) [data-loan-index] [data-row-toggle]')].find(t => t.getClientRects().length).click());
    await page.locator(loan + " .loan-balance").waitFor({ state: "visible" });
    const back = await page.evaluate(l => { const b = document.querySelector(l + " .loan-balance"); return { v: b.value, bad: b.getAttribute("aria-invalid") }; }, loan);
    check(Number(back.v) === bal && back.bad !== "true", "closing the loan kept the cleared balance (" + JSON.stringify(back) + ")");
    await page.fill(loan + " .loan-balance", String(bal - 1000));
    await eventually(async () => await stored(page, P + "loans[0].balance") === bal - 1000);
    check(await stored(page, P + "loans[0].balance") === bal - 1000, "a valid loan balance didn't save");
    await page.keyboard.press("Escape");
    // The manager's fee, cleared: not saved as 0%.
    await tab("income");
    const fee = await stored(page, P + "pmFee.percent");
    await page.fill(panel + ".prop-pmfee-percent", "");
    check(await stored(page, P + "pmFee.percent") === fee, "clearing the manager's fee saved " + await stored(page, P + "pmFee.percent"));
    check(await marked(panel + ".prop-pmfee-percent"), "a cleared manager's fee isn't marked with a message");
  },
  // #263: Investments' number fields — a cleared or out-of-range figure is said beside the field and nothing is saved
  // (before, a cleared quantity saved 0 units and franking of 150% saved 100); closing the editor cancels the draft.
  async investvalidation(page){
    await page.waitForLoadState("networkidle"); await settle(page);
    await go(page, "assets", "data-assets-sub", "Shares");
    await page.evaluate(() => [...document.querySelectorAll(".m-asset-rows [data-row-toggle]")].find(t => t.getClientRects().length).click());
    const row = ".m-row.open";
    await page.locator(row + " .h-qty").waitFor({ state: "visible" });
    const idx = Number(await page.evaluate(r => document.querySelector(r).getAttribute("data-index"), row));
    await page.evaluate(r => document.querySelectorAll(r + " details").forEach(d => { d.open = true; }), row);
    const saved = expr => stored(page, "state.assets[" + idx + "]." + expr);
    const invalid = sel => page.evaluate(s => { const el = document.querySelector(s); const msg = el && document.getElementById(el.id + "-error");
      return !!el && el.getAttribute("aria-invalid") === "true" && !!msg && !!msg.textContent.trim() && (el.getAttribute("aria-describedby") || "").split(" ").includes(msg.id); }, sel);
    const before = { qty: await saved("quantity"), price: await saved("price"), franked: await saved("frankedPct == null ? 100 : state.assets[" + idx + "].frankedPct") };
    // Cleared quantity and price: not saved as 0.
    await page.fill(row + " .h-qty", "");
    check(await saved("quantity") === before.qty, "clearing a holding's quantity saved " + await saved("quantity"));
    check(await invalid(row + " .h-qty"), "a cleared quantity isn't marked with a message");
    await page.fill(row + " .h-price", "-3");
    check(await saved("price") === before.price, "a negative price saved " + await saved("price"));
    check(await invalid(row + " .h-price"), "a negative price isn't marked with a message");
    // Franking outside 0–100 isn't clamped into range; a valid share saves and clears the message.
    await page.fill(row + " .h-franked", "150");
    check(await saved("frankedPct == null ? 100 : state.assets[" + idx + "].frankedPct") === before.franked, "franking of 150% saved " + await saved("frankedPct"));
    check(await invalid(row + " .h-franked"), "franking of 150% isn't marked with a message");
    await page.fill(row + " .h-franked", "50");
    await eventually(async () => await saved("frankedPct") === 50);
    check(await saved("frankedPct") === 50, "a valid franked share didn't save");
    check(await page.evaluate(r => !document.querySelector(r + " .h-franked").hasAttribute("aria-invalid"), row), "a valid franked share is still marked");
    // A lot's brokerage, cleared: not saved as 0. A lot can't hold fewer units than were sold from it (before, it was
    // quietly raised to the sold count).
    check(await page.locator(row + " .lot-brokerage").count() > 0, "the demo holding has no purchase lots to edit");
    const brk = await saved("lots[0].brokerage"), units = await saved("lots[0].units");
    await page.fill(row + " .lot-brokerage >> nth=0", "");
    check(await saved("lots[0].brokerage") === brk, "clearing a lot's brokerage saved " + await saved("lots[0].brokerage"));
    await page.evaluate(async i => { const m = await import("/src/state.js"); m.state.assets[i].lots[0].soldUnits = 5; }, idx);
    await page.fill(row + " .lot-units >> nth=0", "2");
    check(await saved("lots[0].units") === units, "a lot cut below its sold units saved " + await saved("lots[0].units"));
    check(await page.evaluate(r => /sold/.test((document.getElementById(document.querySelector(r + " .lot-units").id + "-error") || {}).textContent || ""), row), "a lot cut below its sold units doesn't say why");
    // Closing the editor cancels the drafts: reopened, the quantity shows what's saved, with no message.
    await page.keyboard.press("Escape");
    await page.waitForFunction(i => !document.querySelector('.m-asset-rows .m-row.open[data-index="' + i + '"]'), idx);
    await page.evaluate(i => document.querySelector('.m-asset-rows [data-index="' + i + '"] [data-row-toggle]').click(), idx);
    await page.locator(row + " .h-qty").waitFor({ state: "visible" });
    const back = await page.evaluate(r => { const q = document.querySelector(r + " .h-qty"); return { v: q.value, bad: q.getAttribute("aria-invalid") }; }, row);
    check(Number(back.v) === before.qty && back.bad !== "true", "closing the editor kept the cleared quantity (" + JSON.stringify(back) + ")");
    await page.keyboard.press("Escape");
    // Target mix: 150% isn't clamped to 100; blank still means no target.
    const mix = "[data-mix-target] >> nth=0";
    check(await page.locator(mix).count() > 0, "Shares has no target mix to edit");
    {
      const cls = await page.evaluate(() => document.querySelector("[data-mix-target]").getAttribute("data-mix-target"));
      const was = await stored(page, "(state.targetMix || {})[" + JSON.stringify(cls) + "]");
      await page.fill(mix, "150"); await page.press(mix, "Tab");
      check(await stored(page, "(state.targetMix || {})[" + JSON.stringify(cls) + "]") === was, "a target share of 150% saved " + await stored(page, "(state.targetMix || {})[" + JSON.stringify(cls) + "]"));
      check(await invalid("[data-mix-target]"), "a target share of 150% isn't marked with a message");
      await page.fill(mix, "40"); await page.press(mix, "Tab");
      await eventually(async () => await stored(page, "(state.targetMix || {})[" + JSON.stringify(cls) + "]") === 40);
      check(await stored(page, "(state.targetMix || {})[" + JSON.stringify(cls) + "]") === 40, "a valid target share didn't save");
    }
  },
  // #261 / #263: Net worth → Investments → Summary's debts — a visible focus indicator on the inline name, fields named
  // for their debt (and kept right when it's renamed), and a cleared balance that isn't saved as $0.
  async debts(page){
    await page.waitForLoadState("networkidle"); await settle(page);
    await page.evaluate(async () => { const m = await import("/src/state.js"); m.state.debts = [{ what: "Card one", balance: 1200 }, { what: "Personal loan", balance: 8000 }]; m.commit(["debts"]); });
    await go(page, "assets", "data-assets-sub", "summary");
    await page.evaluate(() => { const d = document.getElementById("debtsTable").closest("details"); if(d) d.open = true; });
    const name = "#debtsTable .debt-what >> nth=0", bal = "#debtsTable .debt-balance >> nth=0";
    await page.locator(name).waitFor({ state: "visible" });
    // Reached from the keyboard, the name field shows it: a ring or an outline, not nothing.
    await page.focus(bal); await page.keyboard.press("Shift+Tab");
    const ring = await page.evaluate(() => { const a = document.activeElement, c = getComputedStyle(a); return { name: a.classList.contains("debt-what"), shown: c.boxShadow !== "none" || (c.outlineStyle !== "none" && parseFloat(c.outlineWidth) > 0) }; });
    check(ring.name && ring.shown, "a debt's name field shows no keyboard focus");
    // Named for their debt, and still right after a rename.
    check(await page.getByRole("spinbutton", { name: "Balance of Card one" }).count() === 1, "a debt's balance isn't named for its debt");
    check(await page.getByRole("button", { name: "Delete Personal loan" }).count() === 1, "a debt's delete isn't named for its debt");
    await page.fill(name, "Card two");
    check(await page.getByRole("spinbutton", { name: "Balance of Card two" }).count() === 1, "renaming a debt left its balance's name stale");
    // A cleared balance isn't saved as $0; a valid one is.
    const savedBal = () => stored(page, "state.debts[0].balance");
    await page.fill(bal, "");
    check(await savedBal() === 1200, "clearing a debt's balance saved " + await savedBal());
    check(await page.evaluate(() => document.querySelector("#debtsTable .debt-balance").getAttribute("aria-invalid") === "true"), "a cleared balance isn't marked invalid");
    await page.fill(bal, "950");
    await eventually(async () => await savedBal() === 950);
    check(await savedBal() === 950, "a valid balance didn't save");
  },
  // #261: Net worth → Property while editing, every tab — each field named from its visible label, no help left in a
  // title tooltip (on the field or its wrapper), every visible label tied to its field; clicking a label reaches its
  // field, and fields still save.
  async property(page){
    await page.waitForLoadState("networkidle"); await settle(page);
    await go(page, "properties");
    await click(page, "[data-prop-edit]");
    const tabs = await page.evaluate(() => [...document.querySelectorAll("[data-prop-tab]")].map(t => t.getAttribute("data-tab")));
    for(const tab of tabs){
      await page.evaluate(t => document.querySelector('[data-prop-tab][data-tab="' + t + '"]').click(), tab);
      await page.waitForFunction(t => { const p = document.querySelector('[data-prop-panel="' + t + '"]'); return p && !p.hidden; }, tab);
      await page.evaluate(() => { document.querySelectorAll('[data-prop-section-toggle][aria-expanded="false"]').forEach(x => x.click()); document.querySelectorAll(".app-page:not([hidden]) details").forEach(d => { d.open = true; }); });
      await page.evaluate(() => { const t = [...document.querySelectorAll(".prop-tab-panel:not([hidden]) [data-row-toggle]")].find(x => x.getClientRects().length && !x.closest(".m-row.open")); if(t) t.click(); });
      await settle(page);
      const bad = await page.evaluate(() => {
        const out = [];
        const text = el => { const c = el.cloneNode(true); c.querySelectorAll(".visually-hidden, input, select, textarea").forEach(x => x.remove()); return c.textContent.replace(/\s+/g, " ").trim(); };
        document.querySelectorAll(".app-page:not([hidden]) input:not([type=hidden]):not([type=file]), .app-page:not([hidden]) select, .app-page:not([hidden]) textarea, .m-row.open input, .m-row.open select").forEach(el => {
          if(!el.getClientRects().length) return;
          const who = String(el.className || el.type).split(" ")[0], label = el.labels && el.labels[0];
          const name = el.getAttribute("aria-label") || (label ? label.textContent.replace(/\s+/g, " ").trim() : "");
          if(!name) out.push(who + ": no name");
          if(el.title || el.closest(".calc-field[title], .proj-field[title], .m-edit-field[title]")) out.push(who + ": help in a title tooltip");
          if(label && !el.getAttribute("aria-label") && !label.contains(el) && !name.startsWith(text(label))) out.push(who + ": name doesn't start with its label");
        });
        document.querySelectorAll(".calc-field > label:not([for]), .proj-field > label:not([for]), .m-edit-field > label:not([for])").forEach(l => {
          if(l.getClientRects().length && !l.querySelector("input,select,textarea") && l.parentElement.querySelector("input:not([type=checkbox]):not([type=radio]), select, textarea")) out.push("label '" + l.textContent.trim() + "' not tied to its field");
        });
        return [...new Set(out)];
      });
      check(!bad.length, "property " + tab + ": " + bad.slice(0, 6).join("; "));
    }
    // Clicking a visible label reaches its field; fields still save through the tied markup.
    await page.evaluate(() => document.querySelector('[data-prop-tab][data-tab="overview"]').click());
    await page.locator('.prop-tab-panel:not([hidden]) .prop-land-value').waitFor({ state: "visible" });
    const landLabel = await page.evaluate(() => document.querySelector(".prop-tab-panel:not([hidden]) .prop-land-value").labels[0].htmlFor);
    await page.click('label[for="' + landLabel + '"]');
    check(await page.evaluate(() => document.activeElement && document.activeElement.classList.contains("prop-land-value")), "clicking Land value's label didn't reach its field");
    await page.fill(".prop-tab-panel:not([hidden]) .prop-land-value", "412000"); await page.press(".prop-tab-panel:not([hidden]) .prop-land-value", "Tab");
    await eventually(async () => await stored(page, "state.properties[0].landValue") === 412000);
    check(await stored(page, "state.properties[0].landValue") === 412000, "land value didn't save");
    await page.fill(".prop-tab-panel:not([hidden]) .prop-purchase-price", "655000"); await page.press(".prop-tab-panel:not([hidden]) .prop-purchase-price", "Tab");
    await eventually(async () => await stored(page, "state.properties[0].purchasePrice") === 655000);
    check(await stored(page, "state.properties[0].purchasePrice") === 655000, "purchase price didn't save");
  },
  // #261: Investments → Shares — a holding's editor named from its visible labels, its help on screen, and every field
  // still saving through the shared-field markup.
  async holdings(page){
    await page.waitForLoadState("networkidle"); await settle(page);
    await go(page, "assets", "data-assets-sub", "Shares");
    await page.evaluate(() => [...document.querySelectorAll(".m-asset-rows [data-row-toggle]")].find(t => t.getClientRects().length).click());
    const row = ".m-row.open";
    await page.locator(row + " .h-qty").waitFor({ state: "visible" });
    const idx = Number(await page.evaluate(r => document.querySelector(r).getAttribute("data-index"), row));
    await page.evaluate(r => document.querySelectorAll(r + " details").forEach(d => { d.open = true; }), row);
    const bad = await page.evaluate(r => {
      const out = [];
      const text = el => { const c = el.cloneNode(true); c.querySelectorAll(".visually-hidden, input, select, textarea").forEach(x => x.remove()); return c.textContent.replace(/\s+/g, " ").trim(); };
      document.querySelectorAll(r + " input:not([type=hidden]):not([type=file]), " + r + " select, " + r + " textarea, #sharesPasteArea").forEach(el => {
        if(!el.getClientRects().length && el.id !== "sharesPasteArea") return;
        const who = (el.className || el.id).split(" ")[0], label = el.labels && el.labels[0];
        const name = el.getAttribute("aria-label") || (label ? label.textContent.replace(/\s+/g, " ").trim() : "");
        if(!name) out.push(who + ": no name");
        if(el.title) out.push(who + ": help in a title tooltip");
        if(label && !el.getAttribute("aria-label") && !label.contains(el) && !name.startsWith(text(label))) out.push(who + ": name doesn't start with its label");
      });
      return out;
    }, row);
    check(!bad.length, "holding editor: " + bad.slice(0, 6).join("; "));
    const saved = expr => stored(page, "state.assets[" + idx + "]." + expr);
    await page.fill(row + " .h-qty", "123"); await page.press(row + " .h-qty", "Tab");
    await eventually(async () => await saved("quantity") === 123);
    check(await saved("quantity") === 123, "a holding's quantity didn't save");
    await page.selectOption(row + " .h-market", "US");
    await eventually(async () => await saved("market") === "US");
    check(await saved("market") === "US", "a holding's market didn't save");
    await page.fill(row + " .h-price", "77.5"); await page.press(row + " .h-price", "Tab");
    await eventually(async () => await saved("price") === 77.5);
    check(await saved("price") === 77.5, "a holding's price didn't save");
    check(await page.locator(row + " .h-price-note").count() === 1 && await page.evaluate(r => !!document.querySelector(r + " .h-price").getAttribute("aria-describedby").match(/help/), row), "the price note isn't the price's described help");
    if(await page.locator(row + " .lot-brokerage").count()){
      await page.fill(row + " .lot-brokerage >> nth=0", "19.95"); await page.press(row + " .lot-brokerage >> nth=0", "Tab");
      await eventually(async () => await saved("lots[0].brokerage") === 19.95);
      check(await saved("lots[0].brokerage") === 19.95, "a lot's brokerage didn't save");
    }
    const sales = await stored(page, "(state.assets[" + idx + "].sales || []).length");
    await page.fill(row + " .h-sale-units", "1"); await page.fill(row + " .h-sale-proceeds", "100"); await page.fill(row + " .h-sale-costbase", "80");
    await click(page, row + " [data-asset-sale]");
    await eventually(async () => await stored(page, "(state.assets[" + idx + "].sales || []).length") > sales);
    check(await stored(page, "(state.assets[" + idx + "].sales || []).length") === sales + 1, "recording a sale through the new fields didn't save it");
  },
  // #261: Tax's forms — every field named, its name starting with what's on screen (WCAG 2.5.3), no help left in a
  // title tooltip, and visible help tied to its field.
  async taxlabels(page){
    for(const sub of ["year", "returns", "people"]){
      await go(page, "tax", "data-tax-sub", sub);
      await page.evaluate(() => document.querySelectorAll(".app-page:not([hidden]) details").forEach(d => { d.open = true; }));
      await settle(page);
      const bad = await page.evaluate(() => {
        const out = [];
        const text = el => { const c = el.cloneNode(true); c.querySelectorAll(".visually-hidden, input, select, textarea").forEach(x => x.remove()); return c.textContent.replace(/\s+/g, " ").trim(); };
        document.querySelectorAll(".app-page:not([hidden]) input:not([type=hidden]):not([type=file]), .app-page:not([hidden]) select, .app-page:not([hidden]) textarea").forEach(el => {
          if(!el.getClientRects().length) return;
          const who = el.className || el.getAttribute("data-ty-key") || el.type;
          const label = el.labels && el.labels[0];
          const name = el.getAttribute("aria-label") || (label ? label.textContent.replace(/\s+/g, " ").trim() : "");
          if(!name) out.push(who + ": no accessible name");
          if(el.title) out.push(who + ": help in a title tooltip");
          if(label && !label.contains(el) && !el.getAttribute("aria-label") && !name.startsWith(text(label))) out.push(who + ": name doesn't start with its label");
          (el.getAttribute("aria-describedby") || "").split(" ").filter(Boolean).forEach(id => { if(!document.getElementById(id)) out.push(who + ": describedby points at nothing (" + id + ")"); });
        });
        document.querySelectorAll(".app-page:not([hidden]) .field-help[id]").forEach(h => {
          if(h.getClientRects().length && !document.querySelector('[aria-describedby~="' + h.id + '"]')) out.push("help #" + h.id + " describes no field");
        });
        return out;
      });
      check(!bad.length, "Tax → " + sub + ": " + bad.slice(0, 6).join("; "));
    }
  },
  // #254 / #261 / #263: Plan → Goals' editor on shared fields — labelled, validated, and keyboard-safe through its saves.
  async goals(page){
    await page.waitForLoadState("networkidle"); await settle(page);
    await go(page, "plan", "data-plan-sub", "goals");
    const toggle = "#savingsGoalsBody [data-goal-toggle]";
    const focusIs = sel => page.evaluate(s => !!document.activeElement && document.activeElement.matches(s), sel);
    // Opened from the keyboard: the redraw keeps focus on the toggle.
    await page.locator(toggle).first().focus(); await page.keyboard.press("Enter");
    await page.locator('#savingsGoalsBody [data-goal-field="name"]').waitFor({ state: "visible" });
    check(await focusIs(toggle), "opening a goal by keyboard lost focus");
    // Every field labelled, its help described.
    const fields = await page.evaluate(() => [...document.querySelectorAll("#savingsGoalsBody .sgl.is-open [data-goal-field]")].map(el => ({ f: el.getAttribute("data-goal-field"),
      label: el.labels && el.labels[0] ? el.labels[0].textContent.trim() : "", described: (el.getAttribute("aria-describedby") || "").split(" ").filter(id => document.getElementById(id) && document.getElementById(id).textContent.trim()).length })));
    check(JSON.stringify(fields.map(x => x.label)) === JSON.stringify(["Goal name", "Target", "Reach it by"]), "goal fields aren't labelled: " + JSON.stringify(fields));
    check(fields.find(x => x.f === "target").described && fields.find(x => x.f === "by").described, "goal help isn't tied to its field");
    const name = '#savingsGoalsBody [data-goal-field="name"]', target = '#savingsGoalsBody [data-goal-field="target"]', by = '#savingsGoalsBody [data-goal-field="by"]';
    const savedGoal = k => stored(page, "state.savingsGoals[0]." + k);
    // Renamed and tabbed on: saved, the card says so, and focus is on the next field — not the page body.
    await page.fill(name, "Deposit fund"); await page.press(name, "Tab");
    await until(page, () => /Deposit fund/.test(document.querySelector("#savingsGoalsBody [data-goal-toggle]").textContent));
    check(await savedGoal("name") === "Deposit fund", "the goal's new name didn't save");
    check(await focusIs(target), "Tab out of the goal's name lost focus");
    // A blank or negative target saves nothing and says why; Tab still moves on.
    const before = await savedGoal("target");
    for(const bad of ["", "-500"]){
      await page.fill(target, bad); await page.press(target, "Tab");
      check(await savedGoal("target") === before, "a target of '" + bad + "' saved " + await savedGoal("target"));
      check(await page.evaluate(t => document.querySelector(t).getAttribute("aria-invalid") === "true", target), "a target of '" + bad + "' isn't marked invalid");
      check(await focusIs(by), "Tab out of an invalid target lost focus");
    }
    await page.fill(target, "15000"); await page.press(target, "Tab");
    await eventually(async () => await savedGoal("target") === 15000);
    check(await savedGoal("target") === 15000, "a valid target didn't save");
    check(await page.evaluate(t => !document.querySelector(t).hasAttribute("aria-invalid"), target), "the target's message stayed after a valid one");
    // Home → Benchmarks: the paste box has a visible label, and each price field says what it is.
    await go(page, "dashboard", "data-dashboard-sub", "benchmarks");
    await page.evaluate(() => document.querySelectorAll(".app-page:not([hidden]) details.bm-prices").forEach(d => d.open = true));
    const bm = await page.evaluate(() => { const t = document.querySelector("[data-bm-paste]"), p = document.querySelector("[data-bm-price]");
      return { paste: t && t.labels && t.labels.length ? t.labels[0].textContent.trim() : "", price: p ? p.getAttribute("aria-label") || "" : "" }; });
    check(/^Paste .+ prices/.test(bm.paste), "the price paste box has no label");
    check(/close, /.test(bm.price), "a benchmark price field doesn't say what it is: " + bm.price);
  },
  // #263: a row editor's numbers are saved only when they read — never cleared into $0, never clamped into range.
  async validation(page){
    const row = '[data-line-id="demo-groceries"]', amt = row + " .f-amount", pct = row + " .f-deductpct";
    const saved = k => stored(page, "state.shared.find(x => x.id === 'demo-groceries')." + k);
    // The app's own startup reads (prices, then the cash rate) end in a full redraw, which closes an open editor's
    // sections; this journey runs first, so let them finish before it opens anything.
    await page.waitForLoadState("networkidle"); await settle(page);
    const err = sel => page.evaluate(s => { const i = document.querySelector(s); const id = (i.getAttribute("aria-describedby") || "").split(" ").find(x => /-error$/.test(x)); const m = id && document.getElementById(id); return { invalid: i.getAttribute("aria-invalid") === "true", text: m ? m.textContent : "", border: getComputedStyle(i).borderTopColor }; }, sel);
    await typeLineName(page, "demo-groceries", await stored(page, "state.shared.find(x => x.id === 'demo-groceries').what"), false);
    const before = await saved("amount"), headline = await page.textContent(row + ' [data-computed="amt"]');
    // Cleared to retype: nothing saved, the headline holds, and the field says why — tied to it for assistive tech.
    await page.fill(amt, "");
    check(await saved("amount") === before, "clearing the amount saved " + await saved("amount"));
    check(await page.textContent(row + ' [data-computed="amt"]') === headline, "clearing the amount changed the row's headline");
    // #276: make a same-tab background refresh land while the cleared field is pending.
    // This must not rebuild the editor from its saved value or erase its validation message.
    const refresh = await page.evaluate(async()=> (await import('/src/components/assetswiring.js')).readAutoPricesNow(false));
    check(await page.inputValue(amt)==='', 'a background refresh replaced the unfinished amount');
    check(refresh.skipped===true, 'a price refresh applied while an invalid edit was pending');
    let e1 = await err(amt);
    check(e1.invalid && /Enter an amount/.test(e1.text), "a cleared amount isn't marked invalid with a message");
    const okBorder = await page.evaluate(() => getComputedStyle(document.querySelector('[data-line-id="demo-groceries"] .f-what')).borderTopColor);
    check(e1.border !== okBorder, "an invalid amount looks the same as a valid one");
    // Retyped: saved, and the message goes.
    await page.fill(amt, "275");
    check(await saved("amount") === 275, "a retyped amount didn't save");
    e1 = await err(amt);
    check(!e1.invalid && !e1.text, "the message stayed after a valid amount");
    // A comma: the browser drops it; the field says so while it has focus.
    await page.click(amt, { clickCount: 3 }); await page.keyboard.type("1,5");
    check(await page.locator(row + " [data-comma-note]").isVisible(), "a comma in a number field says nothing");
    await page.fill(amt, "275"); await page.locator(row + " .f-what").focus();
    check(!await page.locator(row + " [data-comma-note]").count(), "the comma note stayed after leaving the field");
    // Zero and a negative are saved as themselves (a rule, not an error).
    await page.fill(amt, "0"); check(await saved("amount") === 0, "0 wasn't saved");
    await page.fill(amt, "275");
    // The claimable share: out of range or blank is said, and the saved share doesn't move.
    // Open the row's more options and tick deductible until the share shows — a redraw can close them again.
    await eventually(async () => {
      if(!await page.locator(amt).isVisible()) await click(page, row + " [data-row-toggle]");
      await page.evaluate(r => { document.querySelectorAll(r + " details").forEach(d => d.open = true); const c = document.querySelector(r + " .f-deductible"); if(c && !c.checked) c.click(); }, row);
      return page.locator(pct).isVisible();
    });
    // ...and a full redraw keeps the section open, rather than hiding the field being filled in (lib/keepui.js).
    await page.evaluate(async () => (await import("/src/components/redraw.js")).renderAll());
    check(await page.locator(pct).isVisible(), "a full redraw closed the row's More options");
    await page.fill(pct, "60"); check(await saved("deductiblePct") === 60, "a share of 60 wasn't saved");
    for(const bad of ["150", "-10", ""]){
      await page.fill(pct, bad);
      check(await saved("deductiblePct") === 60, "a share of '" + bad + "' saved " + await saved("deductiblePct"));
      check((await err(pct)).invalid, "a share of '" + bad + "' isn't marked invalid");
    }
    // Leaving with an invalid draft: the saved value stands, and the editor opens on it again.
    await page.fill(amt, "");
    await click(page, row + " [data-row-toggle]"); await page.waitForTimeout(300);
    check(await saved("amount") === 275, "closing with a blank amount saved " + await saved("amount"));
    await click(page, row + " [data-row-toggle]"); await page.locator(amt).waitFor({ state: "visible", timeout: 10000 });
    check(await page.inputValue(amt) === "275", "reopening didn't show the saved amount");
    check(!(await err(amt)).invalid, "reopening kept the old error");
    await click(page, row + ' [data-row-toggle]');
    await page.locator(amt).waitFor({state:'hidden'});
    const resumed=await page.evaluate(async()=> (await import('/src/components/assetswiring.js')).readAutoPricesNow(false));
    check(!resumed.skipped, 'prices stayed blocked after the editor closed');
    check(await saved('amount')===275, 'resuming prices changed the saved amount');
  },
  async assetfields(page){
    const indexOf=id=>page.evaluate(async id=>(await import('/src/state.js')).state.assets.findIndex(x=>x.id===id),id);
    const saved=(id,key)=>stored(page,"state.assets.find(x=>x.id==='"+id+"')."+key);
    await go(page,'assets','data-assets-sub','Cash');
    const idx=await indexOf('demo-cash-everyday');
    const row=page.locator('#assetsSub-Cash .m-row[data-index="'+idx+'"]');
    await row.locator('[data-row-toggle]').first().click();
    check(!await row.locator('.m-row-summary button').count(),'Details is nested inside the row Edit button');
    check(await page.evaluate(idx=>!!document.querySelector('#assetsSub-Cash .m-row[data-index="'+idx+'"] .a-what')?.labels?.length,idx),'Asset name has no associated visible label');
    for(const cls of ['a-what','a-amount']){
      const id=await row.locator('.'+cls).getAttribute('id');
      await row.locator('label[for="'+id+'"]').click();
      check(await page.evaluate(id=>document.activeElement.id===id,id),'Asset label did not focus '+cls);
    }
    await row.getByLabel('Asset name',{exact:true}).fill('Example cash asset');
    await row.getByLabel('Value',{exact:true}).fill('5000');
    await row.getByLabel('Person',{exact:true}).fill('Alex');
    check(await saved('demo-cash-everyday','amount')===5000 && await saved('demo-cash-everyday','person')==='Alex','Basic asset edits did not save');
    await row.getByRole('button',{name:'Record value',exact:true}).focus();
    check(await page.evaluate(()=>document.activeElement.matches('[data-asset-log]')), 'Record value could not receive keyboard focus');
    await page.keyboard.press('Enter');
    check(await saved('demo-cash-everyday',"history.some(x=>x.date==='2026-11-03' && x.value===5000)"),'Record value did not preserve the dated snapshot');
    check(await page.evaluate(()=>document.activeElement.matches('[data-asset-log]')),'Recording value lost keyboard focus: '+JSON.stringify(await page.evaluate(()=>({focus:document.activeElement.outerHTML.slice(0,350),open:!!document.querySelector('.m-row.open'),recordButtons:document.querySelectorAll('.m-row.open [data-asset-log]').length,keys:document.querySelector('.m-row.open')?.outerHTML.slice(0,150)}))));
    for(const width of [320,390,1280]){
      await page.setViewportSize({width,height:844});
      const audit=await page.evaluate(idx=>{
        const root=document.querySelector('#assetsSub-Cash .m-row[data-index="'+idx+'"]');
        const fields=[...root.querySelectorAll('.field-control')];
        return {doc:document.documentElement.scrollWidth,scroll:root.scrollWidth,width:root.clientWidth,bad:fields.filter(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return !el.labels?.length || r.width<=0 || r.height<(innerWidth<880?44:36) || s.borderRadius!=='6px' || s.padding!=='6px 8px' || document.querySelectorAll('[id="'+el.id+'"]').length!==1 || (el.getAttribute('aria-describedby')||'').split(' ').some(id=>!document.getElementById(id));}).map(el=>el.className)};
      },idx);
      check(audit.doc<=width && audit.scroll<=audit.width+1 && !audit.bad.length,'Basic asset fields failed at '+width+': '+JSON.stringify(audit));
    }
    await row.getByLabel('Category',{exact:true}).selectOption('Other');
    await page.waitForFunction(()=>!document.querySelector('.m-row.open'));
    check(await saved('demo-cash-everyday','category')==='Other' && await saved('demo-cash-everyday','amount')===5000,'Moving category changed the stored value');
    check(await page.evaluate(()=>document.activeElement.matches('#assetsSubnav .subnav-item.active')), 'Moving category lost the list focus');
    await go(page,'assets','data-assets-sub','Other');
    const moved=page.locator('#assetsSub-Other .m-row[data-index="'+idx+'"]');
    await moved.locator('[data-row-toggle]').first().click();
    await moved.getByRole('button',{name:'View details',exact:true}).click();
    await page.waitForFunction(()=>document.body.dataset.currentPage==='detail');
    check(await page.evaluate(()=>location.pathname.includes('demo-cash-everyday')),'Separate Details action opened the wrong record');
    await go(page,'assets','data-assets-sub','Super');
    const si=await indexOf('demo-super-alex'), superRow=page.locator('#assetsSub-Super .m-row[data-index="'+si+'"]');
    await superRow.locator('[data-row-toggle]').first().click();
    check(await superRow.locator('.a-amount').evaluate(el=>{const ids=el.getAttribute('aria-describedby').split(' ');return ids.some(id=>/last snapshot.*employer super/.test(document.getElementById(id)?.textContent || ''));}),'Super estimate assumptions are not described visibly');
    await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('.m-row.open'));
    await page.locator('[data-add="assets:Super"]').click();await page.locator('.m-row.open[role="dialog"]').waitFor();
    await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('.m-row.open'));
    check(await page.evaluate(()=>document.activeElement.matches('[data-add="assets:Super"]')),'Super discard did not return focus to Add');
    // The shared open-key correction must also retain existing holding editors.
    await go(page,'assets','data-assets-sub','Shares');
    const hi=await page.evaluate(async()=>(await import('/src/state.js')).state.assets.findIndex(x=>x.category==='Shares'));
    const holding=page.locator('#assetsSub-Shares .m-row[data-index="'+hi+'"]');
    await holding.locator('[data-row-toggle]').first().click();
    await holding.getByRole('button',{name:'Record value',exact:true}).focus();await page.keyboard.press('Enter');
    check(await holding.evaluate(el=>el.classList.contains('open')),'A holding snapshot still closed its editor');
    check(await page.evaluate(()=>document.activeElement.matches('[data-asset-log]')),'Holding snapshot lost keyboard focus');
    await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('.m-row.open'));
    await go(page,'assets','data-assets-sub','Cash');
    const beforeMove=await stored(page,'state.assets.length');
    await page.locator('[data-add="assets:Cash"]').click();
    await page.locator('.m-row.open').getByLabel('Category',{exact:true}).selectOption('Other');
    await page.waitForFunction(()=>!document.querySelector('.m-row.open'));
    check(await stored(page,'state.assets.length')===beforeMove+1 && await stored(page,'state.assets[state.assets.length-1].category')==='Other','Changing a new asset category discarded it');


  },
  async vehiclefields(page){
    await go(page,'assets','data-assets-sub','Vehicle');
    const idx=await page.evaluate(async()=>(await import('/src/state.js')).state.assets.findIndex(x=>x.id==='demo-car'));
    const row=page.locator('#assetsSub-Vehicle .m-row[data-index="'+idx+'"]');
    const saved=key=>stored(page,"state.assets.find(x=>x.id==='demo-car')."+key);
    await row.locator('[data-row-toggle]').first().click();
    await row.locator('.v-deprate').fill('');
    await page.evaluate(async()=> (await import('/src/components/redraw.js')).renderAll());
    // Older renderers closed the editor on redraw; reopening still must show its stored rate.
    if(!await row.evaluate(el=>el.classList.contains('open'))) await row.locator('[data-row-toggle]').first().click();
    check(await row.locator('.v-deprate').inputValue()==='', 'A blank depreciation rate reappeared as 15 despite calculating at 0');
    check(await saved('depreciationRate')===null,'A blank rate did not retain its existing null meaning');
    await row.getByLabel('Purchase price',{exact:true}).fill('20000');
    await row.getByLabel('Purchase date',{exact:true}).fill('2024-01-01');
    await row.getByLabel('Depreciation per year',{exact:true}).fill('0');
    check(await saved('amount')===20000 && await saved('computed')===true,'Zero depreciation changed the purchase value');
    await row.getByLabel('Depreciation per year',{exact:true}).fill('10');
    const depreciated=await saved('amount');
    check(depreciated>0 && depreciated<20000,'A positive rate did not update the current value');
    check(/Current value/.test(await row.locator('.v-value-cell').textContent()),'Live value update removed its label');
    await row.getByLabel('Purchase date',{exact:true}).fill('');
    check(await saved('computed')===false && await saved('amount')===depreciated,'Clearing the date did not keep the stored value');
    // #263: a cleared purchase price isn't saved as 0 any more — it's said beside the field, and the price and value stay.
    await row.getByLabel('Purchase price',{exact:true}).fill('');
    check(await saved('purchasePrice')===20000 && await saved('amount')===depreciated,'Clearing the price saved '+await saved('purchasePrice'));
    check(await row.locator('.v-purchaseprice').getAttribute('aria-invalid')==='true','A cleared purchase price is not marked');
    await row.getByLabel('Purchase price',{exact:true}).fill('20000');
    await row.getByLabel('Person',{exact:true}).fill('Sam');
    for(const width of [320,390,1280]){
      await page.setViewportSize({width,height:844});
      const audit=await page.evaluate(idx=>{const root=document.querySelector('#assetsSub-Vehicle .m-row[data-index="'+idx+'"]');return {open:root.classList.contains('open'),hidden:!!root.closest('[hidden]'),route:location.pathname,doc:document.documentElement.scrollWidth,scroll:root.scrollWidth,width:root.clientWidth,nameWidth:root.querySelector('.v-what').getBoundingClientRect().width,dateWidth:root.querySelector('.v-purchasedate').getBoundingClientRect().width,bad:[...root.querySelectorAll('.field-control')].filter(el=>!el.labels?.length || getComputedStyle(el).borderRadius!=='6px' || el.getBoundingClientRect().height<(innerWidth<880?44:36)).map(el=>el.className)};},idx);
      check(audit.doc<=width && audit.scroll<=audit.width+1 && audit.dateWidth>=audit.nameWidth-1 && !audit.bad.length,'Vehicle fields failed at '+width+': '+JSON.stringify(audit));
    }
    await row.getByRole('button',{name:'Record value',exact:true}).focus();
    check(await page.evaluate(()=>document.activeElement.matches('[data-asset-log]')), 'Record value could not receive keyboard focus');
    await page.keyboard.press('Enter');
    check(await saved("history.some(x=>x.date==='2026-11-03' && x.value==="+depreciated+")"),'Vehicle snapshot did not record its current value');
    check(await page.evaluate(()=>document.activeElement.matches('[data-asset-log]')),'Vehicle recording lost focus: '+JSON.stringify(await page.evaluate(()=>({focus:document.activeElement.outerHTML.slice(0,350),open:!!document.querySelector('.m-row.open')}))));
    await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('.m-row.open'));
    const before=await stored(page,'state.assets.length');
    await page.locator('[data-add="vehicle"]').click();await page.locator('.m-row.open[role="dialog"]').waitFor();
    await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('.m-row.open'));
    check(await stored(page,'state.assets.length')===before,'An untouched vehicle was not discarded');
  },
  async incomefields(page){
    await go(page,'expenses','data-expenses-sub','income');
    const index=await page.evaluate(async()=> (await import('/src/state.js')).state.income.findIndex(x=>x.id==='demo-pay-alex'));
    const row=page.locator('#incomeGroups .m-row[data-index="'+index+'"]');
    await row.locator('[data-row-toggle]').first().click();
    check(await page.evaluate(idx=>!!document.querySelector('#incomeGroups .m-row[data-index="'+idx+'"] .f-incometype')?.labels?.length,index),'Income type has no associated visible label');
    const saved=key=>stored(page,"state.income.find(x=>x.id==='demo-pay-alex')."+key);
    const initial=await saved('amount');
    const nameId=await row.locator('.f-what').getAttribute('id');
    await row.locator('label[for="'+nameId+'"]').click();
    check(await page.evaluate(id=>document.activeElement.id===id,nameId),'Income name label did not focus its field');
    await row.getByLabel('Amount',{exact:true}).fill('');
    check(await saved('amount')===initial,'Clearing income saved a zero');
    const error=await row.locator('.f-amount').evaluate(el=>({invalid:el.getAttribute('aria-invalid'),count:document.querySelectorAll('[id="'+el.id+'-error"]').length,text:document.getElementById(el.id+'-error')?.textContent}));
    check(error.invalid==='true' && error.count===1 && /Enter an amount/.test(error.text),'Income error association failed: '+JSON.stringify(error));
    await row.getByLabel('Amount',{exact:true}).fill('-40');
    check(await saved('amount')===-40 && await row.locator('.f-amount').evaluate(el=>el.validity.valid),'Supported negative income was rejected');
    await row.getByLabel('Amount',{exact:true}).fill(String(initial));
    const type=row.getByLabel('Income type',{exact:true});
    for(const value of ['Net','Gross']){ await type.selectOption(value); check(await saved('incomeType')===value,'Income type did not save '+value); }
    const mode=row.getByLabel('Salary sacrifice',{exact:true});
    await mode.focus();const modeId=await mode.getAttribute('id');
    await mode.selectOption('Sacrifice %');
    check(await page.evaluate(id=>document.activeElement.id===id,modeId),'Changing sacrifice mode lost focus');
    await row.getByLabel('Sacrifice percentage',{exact:true}).fill('5');
    check(await saved('sacrificeValue')===5 && await saved('sacrificeMode')==='percent','Percentage sacrifice did not save');
    await row.getByLabel('Sacrifice percentage',{exact:true}).fill('');
    check(await saved('sacrificeValue')===5 && await row.locator('.f-sacrificevalue').getAttribute('aria-invalid')==='true','Blank sacrifice saved or lost its error');
    await row.getByLabel('Sacrifice percentage',{exact:true}).fill('5');
    await mode.selectOption('Sacrifice $');
    await row.getByLabel('Sacrifice amount',{exact:true}).fill('500');
    check(await saved('sacrificeValue')===500 && await saved('sacrificeMode')==='amount','Cash sacrifice did not save');
    await mode.selectOption('Cash out');
    check(!await row.locator('.f-sacrificevalue').count(),'No-sacrifice mode left its conditional value visible');
    for(const value of ['Included','N/A','On top']){
      await row.getByLabel('Super treatment',{exact:true}).selectOption(value);
      check(await saved('superMode')===value,'Super treatment did not save '+value);
    }
    await row.locator('details.m-more-options').evaluate(el=>el.open=true);
    const freq=row.getByLabel('Frequency',{exact:true});await freq.focus();const freqId=await freq.getAttribute('id');
    await freq.selectOption('Weekly');
    check(await page.evaluate(id=>document.activeElement.id===id,freqId),'Changing frequency lost focus');
    check(await row.locator('details.m-more-options').evaluate(el=>el.open),'Frequency change closed More options');
    await row.getByLabel('Pay weekday',{exact:true}).selectOption('0');
    check(await saved('payWeekday')===0,'Sunday was lost as an empty weekday');
    await freq.selectOption('Monthly');
    await row.getByLabel('Pay day of month',{exact:true}).selectOption('last');
    check(await saved('payDay')==='last','Last day of month did not save');
    await freq.selectOption('Fortnightly');
    await row.getByLabel('A recent pay date',{exact:true}).fill('2026-10-01');
    check(await saved('payAnchor')==='2026-10-01','Fortnightly anchor did not save');
    const group=row.getByRole('group',{name:'Record a pay change',exact:true});
    await group.getByLabel('New amount',{exact:true}).fill('1500');
    await group.getByLabel('Effective from',{exact:true}).fill('2026-10-01');
    check(await saved('amount')===initial,'Pay-change draft saved before Record');
    await group.getByRole('button',{name:'Record change',exact:true}).click();
    check(await saved('amount')===1500,'Record did not save the new pay amount');
    check(await saved("history.some(x=>x.date==='2026-10-01' && x.value===1500)") && await saved('history.some(x=>x.value==='+initial+')'),'Record did not preserve pay history');
    check(await page.evaluate(()=>document.activeElement.matches('[data-pay-change]')),'Recording pay lost keyboard focus');
    for(const width of [320,390,1280]){
      await page.setViewportSize({width,height:844});
      const audit=await row.evaluate(root=>{
        const controls=[...root.querySelectorAll('.field-control')].filter(el=>el.getClientRects().length);
        return {doc:document.documentElement.scrollWidth,viewport:innerWidth,width:root.clientWidth,scroll:root.scrollWidth,accountWidth:root.querySelector('.f-account').getBoundingClientRect().width,nameWidth:root.querySelector('.f-what').getBoundingClientRect().width,
          bad:controls.filter(el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return !el.labels?.length || !el.labels[0].textContent.trim() || r.width<=0 || r.height<(innerWidth<880?44:36) || s.borderRadius!=='6px' || s.padding!=='6px 8px' || document.querySelectorAll('[id="'+el.id+'"]').length!==1 || (el.getAttribute('aria-describedby')||'').split(' ').some(id=>!document.getElementById(id));}).map(el=>el.className)};
      });
      check(audit.doc<=width && audit.scroll<=audit.width+1 && audit.accountWidth>=audit.nameWidth-1 && !audit.bad.length,'Income field sizing/names/reflow failed at '+width+': '+JSON.stringify(audit));
    }
    const cdp=await page.context().newCDPSession(page), tree=await cdp.send('Accessibility.getFullAXTree');
    check(tree.nodes.some(n=>!n.ignored && n.name?.value==='Super treatment' && /employer super/.test(n.description?.value || '')),'Super help is missing from the native accessibility tree');
    await cdp.detach();
  },
  async rowmodals(page){
    await typeLineName(page,'demo-groceries',await stored(page,"state.shared.find(x=>x.id==='demo-groceries').what"),false);
    const row=page.locator('[data-line-id="demo-groceries"]');
    await row.getByRole('button',{name:/Close editor$/}).waitFor();
    async function isolated(){
      const result=await page.evaluate(()=>{
        const row=document.querySelector('.m-row.open[role="dialog"]');
        return {modal:row?.getAttribute('aria-modal'),editorInert:!!row?.closest('[inert]'),backgroundInert:!!document.querySelector('#recurringRuleForm')?.closest('[inert]')};
      });
      check(result.modal==='true' && !result.editorInert && result.backgroundInert,'Row modal isolation failed: '+JSON.stringify(result));
      const cdp=await page.context().newCDPSession(page), tree=await cdp.send('Accessibility.getFullAXTree');
      check(tree.nodes.some(n=>!n.ignored && n.role?.value==='dialog' && /^Edit /.test(n.name?.value || '')),'Row missing from native accessibility tree');
      check(!tree.nodes.some(n=>!n.ignored && n.role?.value==='button' && n.name?.value==='Add recurring rule'),'Background still in the accessibility tree');
      await cdp.detach();
    }
    for(const width of [320,390,1280]){
      await page.setViewportSize({width,height:844}); await isolated();
      await row.locator('.row-del').focus(); await page.keyboard.press('Tab');
      check(await row.getByRole('button',{name:/Close editor$/}).evaluate(el=>el===document.activeElement),'Tab escaped the row modal');
      await page.keyboard.press('/');
      check(!await page.locator('[data-search-backdrop]').count(),'Search shortcut opened behind the modal');
      await page.keyboard.press('Shift+Tab');
      check(await row.locator('.row-del').evaluate(el=>el===document.activeElement),'Shift+Tab escaped the row modal');
    }
    await row.locator('.f-amount').fill('275');
    const inputId=await row.locator('.f-amount').getAttribute('id');
    await page.evaluate(async()=>{const d=await import('/src/lib/dialogs.js');window.__rowAnswer='pending';d.confirmDialog('Example question above the editor.').then(v=>window.__rowAnswer=v);});
    await page.locator('.app-dialog').waitFor();
    await page.evaluate(async()=> (await import('/src/components/redraw.js')).renderAll());
    await page.keyboard.press('Escape'); await page.locator('.app-dialog').waitFor({state:'detached'});
    check(await page.evaluate(()=>window.__rowAnswer)===false,'Escape did not cancel the nested question');
    await isolated();
    check(await page.evaluate(id=>document.activeElement.id===id,inputId),'Question/redraw lost focus in the editor');
    // Back cancels the question while the editor retains an incomplete edit.
    await row.locator('.f-amount').fill('');
    await page.evaluate(async()=>{(await import('/src/lib/dialogs.js')).confirmDialog('Example Back question.');});
    await page.locator('.app-dialog').waitFor(); await page.goBack(); await page.locator('.app-dialog').waitFor({state:'detached'});
    check(await row.locator('.f-amount').inputValue()==='', 'Nested Back replaced the unfinished input');
    await page.evaluate(async()=>{
      const m=await import('/src/state.js');m.persist();
      if(!m.hasPendingWork() || m.freshForBackground()) throw new Error('An unrelated save cleared the invalid row protection');
    });
    await page.keyboard.press('Escape');
    await page.waitForFunction(()=>!document.querySelector('.m-row.open'));
    check(await page.evaluate(()=>!document.querySelector('#recurringRuleForm').closest('[inert]')),'Closing left the background inert');
    check(await page.evaluate(()=>document.activeElement.closest('[data-line-id]')?.dataset.lineId==='demo-groceries'),'Close did not restore focus to the row opener');
    await row.locator('[data-row-toggle]').first().click(); await row.locator('[role="button"][aria-label$="Close editor"]').waitFor();
    await row.locator('.m-row-edit [data-row-toggle]').click(); await page.waitForFunction(()=>!document.querySelector('.m-row.open'));
    await row.locator('[data-row-toggle]').first().click(); await row.getByRole('button',{name:/Close editor$/}).waitFor();
    await page.goBack(); await page.waitForFunction(()=>!document.querySelector('.m-row.open'));
    await row.locator('[data-row-toggle]').first().click(); await row.getByRole('button',{name:/Close editor$/}).waitFor();
    await page.locator('#mRowBackdrop').click({position:{x:2,y:2}}); await page.waitForFunction(()=>!document.querySelector('.m-row.open'));
    const before=await stored(page,'state.shared.length');
    await page.locator('[data-add="shared"]:visible').first().click();
    await page.locator('.m-row.open[role="dialog"]').waitFor();
    check(await page.evaluate(async()=> (await import('/src/state.js')).hasPendingWork()), 'An untouched new row was considered safe to replace');
    await page.keyboard.press('Escape');
    await page.waitForFunction(()=>!document.querySelector('.m-row.open'));
    check(await stored(page,'state.shared.length')===before,'Closing an untouched new row kept it');
    check(await page.evaluate(()=>document.activeElement.matches('[data-add="shared"]')),'Discard did not restore the Add opener');
    await row.locator('[data-row-toggle]').first().click(); await row.getByRole('button',{name:/Close editor$/}).waitFor();
    await row.locator('.row-del').click(); await page.waitForFunction(()=>!document.querySelector('.m-row.open'));
    check(!await stored(page,"state.shared.some(x=>x.id==='demo-groceries')"),'Delete did not remove the edited row');
    check(await page.evaluate(()=>!document.querySelector('#recurringRuleForm').closest('[inert]')),'Deleting stranded the modal boundary');
    await page.locator('.toast-undo-btn').last().click();
    check(await stored(page,"state.shared.some(x=>x.id==='demo-groceries')"),'Undo was unavailable after deleting the modal row');
    await go(page,'assets','data-assets-sub','Cash');
    const assets=await stored(page,'state.assets.length');
    await page.locator('[data-add="assets:Cash"]').click();
    await page.locator('.m-row.open[role="dialog"]').waitFor();
    check(await page.evaluate(async()=> (await import('/src/state.js')).hasPendingWork()), 'An untouched new row was considered safe to replace');
    await page.keyboard.press('Escape');
    await page.waitForFunction(()=>!document.querySelector('.m-row.open'));
    check(await stored(page,'state.assets.length')===assets,'Closing an untouched cash row kept it');
    check(await page.evaluate(()=>document.activeElement.matches('[data-add="assets:Cash"]')),'Cash editor did not restore its Add opener');
    // Older/property records may have no id: their successor must not inherit the modal.
    await go(page,'expenses','data-expenses-sub','budget');
    const index=await page.evaluate(async()=>{
      const m=await import('/src/state.js'), index=m.state.shared.length;
      m.state.shared.push({what:'Example positional row',amount:80,freq:'Monthly',classification:'Needs'},{what:'Following positional row',amount:80,freq:'Monthly',classification:'Needs'});
      m.commit(['shared']);return index;
    });
    const positional=page.locator('.m-row[data-section="shared"][data-index="'+index+'"]');
    await positional.evaluate(el=>{const toggle=el.closest('.m-card').querySelector('[data-budget-group-toggle]');if(toggle?.getAttribute('aria-expanded')!=='true')toggle?.click();});
    await positional.locator('[data-row-toggle]').first().click();
    await positional.getByRole('button',{name:/Close editor$/}).waitFor();
    await positional.locator('.row-del').click();await page.waitForFunction(()=>!document.querySelector('.m-row.open'));
    check(await stored(page,'state.shared[state.shared.length-1].what')==='Following positional row','Deleting a positional row changed its successor');


  },
  async ledgerfields(page){
    await typeLineName(page, "demo-groceries", await stored(page,"state.shared.find(x=>x.id==='demo-groceries').what"), false);
    const row=page.locator('[data-line-id="demo-groceries"]');
    check(await row.locator('.f-freq').evaluate(el=>!!el.labels?.length), 'Frequency has no associated visible label');
    await row.locator('.row-more-options').evaluate(el=>el.open=true);
    await row.locator('.f-deductible').check();
    await row.locator('.f-irregular').check();
    const inspect=()=>row.evaluate(root=>{
      const controls=[...root.querySelectorAll('.field-control')].filter(el=>el.getClientRects().length);
      return {count:controls.length,unlabelled:controls.filter(el=>!el.labels?.length || !el.labels[0].textContent.trim() || el.labels[0].control!==el).map(el=>el.className),
        missingDescriptions:controls.filter(el=>(el.getAttribute('aria-describedby')||'').split(' ').some(id=>!document.getElementById(id))).map(el=>el.className),
        duplicateIds:controls.filter(el=>document.querySelectorAll('[id="'+el.id+'"]').length!==1).map(el=>el.id)};
    });
    const labels=await inspect();
    check(labels.count>=15 && !labels.unlabelled.length && !labels.missingDescriptions.length && !labels.duplicateIds.length, 'Ledger field associations failed: '+JSON.stringify(labels));
    const cdp=await page.context().newCDPSession(page);
    const tree=await cdp.send('Accessibility.getFullAXTree');
    check(tree.nodes.some(n=>!n.ignored && n.name?.value==='Frequency' && n.role?.value==='combobox'), 'Frequency is missing from the native accessibility tree');
    check(tree.nodes.some(n=>!n.ignored && n.name?.value==='Starts (optional)' && /Leave blank/.test(n.description?.value || '')), 'Timing help is missing from the native accessibility description');
    await cdp.detach();
    for(const cls of ['f-what','f-amount']){
      const id=await row.locator('.'+cls).getAttribute('id');
      await row.locator('label[for="'+id+'"]').click();
      check(await page.evaluate(id=>document.activeElement.id===id,id), 'Clicking the '+cls+' label did not focus its field');
    }
    for(const width of [320,390,1280]){
      await page.setViewportSize({width,height:844});
      const layout=await row.evaluate(root=>({doc:document.documentElement.scrollWidth,viewport:innerWidth,fullWidth:root.querySelector('.f-what').getBoundingClientRect().width,fields:[...root.querySelectorAll('.field-control')].filter(el=>el.getClientRects().length).map(el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return {type:el.type,width:r.width,height:r.height,radius:s.borderRadius,padding:s.padding};})}));
      check(layout.doc<=width && layout.fields.every(f=>f.width>0 && f.height>=(width<880?44:36) && f.radius==='6px' && f.padding==='6px 8px' && (width>640 || f.type!=='date' || f.width>=layout.fullWidth-1)), 'Shared field sizing/reflow failed at '+width+': '+JSON.stringify(layout));
    }
    await row.getByLabel('Amount',{exact:true}).fill('-40');
    check(await stored(page, "state.shared.find(x=>x.id==='demo-groceries').amount")===-40 && await row.locator('.f-amount').evaluate(el=>el.validity.valid), 'A supported negative amount was rejected by the shared control');
    await row.getByLabel('Amount',{exact:true}).fill('');
    const invalid=await row.locator('.f-amount').evaluate(el=>({invalid:el.getAttribute('aria-invalid'),messages:document.querySelectorAll('[id="'+el.id+'-error"]').length,help:document.getElementById(el.id+'-error')?.textContent}));
    check(invalid.invalid==='true' && invalid.messages===1 && /Enter an amount/.test(invalid.help), 'Shared field validation did not reuse its error: '+JSON.stringify(invalid));
    await row.getByLabel('Amount',{exact:true}).fill('275');
    const owner=row.locator('.f-deductperson');
    const property=await owner.locator('option[value^="property:"]').first().getAttribute('value');
    await owner.selectOption(property);
    check(await row.locator('.f-rentline').isVisible() && !await row.locator('.f-deductlabel').isVisible(), 'Property claim did not reveal its labelled rental line');
    await owner.selectOption('Alex');
    check(await row.locator('.f-deductlabel').isVisible() && !await row.locator('.f-rentline').isVisible(), 'Personal claim did not restore its labelled return field');
    await row.locator('.f-startdate').focus();
    const focused=await row.locator('.f-startdate').getAttribute('id');
    await page.evaluate(async()=> (await import('/src/components/redraw.js')).renderAll());
    check(await page.evaluate(id=>document.activeElement.id===id,focused), 'Redraw lost focus on a shared timing field');
  },
  async taximporterrors(page){
    await page.evaluate(()=>{window.__failLodged=true;});
    const file={kind:'wealth-planner-tax-year',fy:2026,markLodged:true,people:{Alex:{}}};
    for(const picker of ['#importFile','#taxYearImportFile']){
      await page.evaluate(()=>document.querySelectorAll('#toastWrap .toast').forEach(e=>e.remove()));
      await page.locator(picker).setInputFiles({name:'example-tax-year.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(file))});
      await answerDialog(page,true);
      await page.locator('#toastWrap').getByText(picker==='#importFile'?"That file doesn't look like a valid backup":"That tax year file could not be imported. Check it and try again.",{exact:true}).waitFor();
    }
    // Encrypt a tax-year file with the same real crypto as backup imports, then fail after decryption.
    const encrypted=await page.evaluate(async file=>{
      const b=await import('/src/lib/backup.js');const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
      const key=await b.deriveBackupKey('invented-error-check',salt);
      const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(JSON.stringify(file)));
      return JSON.stringify({wealthPlannerEncrypted:true,v:1,salt:b.bufToBase64(salt),iv:b.bufToBase64(iv),ciphertext:b.bufToBase64(cipher)});
    },file);
    await page.evaluate(()=>document.querySelectorAll('#toastWrap .toast').forEach(e=>e.remove()));
    await page.locator('#importFile').setInputFiles({name:'encrypted-tax-year.json',mimeType:'application/json',buffer:Buffer.from(encrypted)});
    await answerDialog(page,true,'invented-error-check');await answerDialog(page,true);
    await page.locator('#toastWrap').getByText("That file doesn't look like a valid backup",{exact:true}).waitFor();
    check(!(await page.locator('#toastWrap').innerText()).includes('Wrong passphrase'),'post-merge failure was blamed on the password');
  },
  async dialognavigation(page){
    await go(page,'plan','data-plan-sub','scenarios');
    const editor=page.locator('#cards [data-edit-scenario]').last();
    const scenarioName=await editor.getAttribute('data-edit-scenario');await editor.click();
    await page.locator('[data-sc-addsheet]').click();await page.locator('#addChangeRoot [data-sc-new="cost"]').click();
    await page.waitForFunction(()=>!document.querySelector('[data-acs-backdrop]'));
    const cases=[['pairedsettings','/settings/preferences'],['pairedpeople','/tax/people'],['settings','/settings/preferences'],['income','/expenses/income'],['projections','/plan/projections'],['people','/tax/people'],['checks','/dashboard']];
    for(const [route,expected]of cases){
      const before=await page.evaluate(async()=>({url:location.pathname,settings:(await import('/src/components/nav.js')).settingsSubpage(),tax:(await import('/src/components/nav.js')).taxSubpage(),plan:document.querySelector('#planSubnav .active')?.dataset.planSub,expense:document.querySelector('#expensesSubnav .active')?.dataset.expensesSub}));
      async function request(){await page.evaluate(async route=>{
        const n=await import('/src/components/nav.js');window.__navigationDone=false;
        if(route==='pairedsettings') n.showPage('settings');
        if(route==='pairedpeople') n.showPage('accounts');
        const task=['settings','pairedsettings'].includes(route)?n.showAccountsSubpage('preferences'):route==='pairedpeople'?n.showAccountsSubpage('people'):['people','checks'].includes(route)?n.showAccountsSubpage(route):n.showPage(route);
        Promise.resolve(task).then(()=>window.__navigationDone=true);
      },route);}
      await request();await page.locator('.app-dialog').waitFor();
      check(await page.evaluate(()=>location.pathname)===before.url,route+': URL changed before approval');
      check(await page.evaluate(async()=>(await import('/src/components/nav.js')).settingsSubpage())===before.settings,route+': Settings changed before approval');
      check(await page.evaluate(async()=>(await import('/src/components/nav.js')).taxSubpage())===before.tax,route+': Tax changed before approval');
      check(await page.evaluate(()=>document.querySelector('#planSubnav .active')?.dataset.planSub)===before.plan,route+': Plan changed before approval');
      check(await page.evaluate(()=>document.querySelector('#expensesSubnav .active')?.dataset.expensesSub)===before.expense,route+': Cash flow changed before approval');
      await answerDialog(page,false);await page.waitForFunction(()=>window.__navigationDone);
      check(await page.evaluate(()=>location.pathname)===before.url,route+': Cancel changed URL');
      check(await page.evaluate(()=>document.body.dataset.currentPage)==='scenario',route+': Cancel left the editor');
      await request();await answerDialog(page,true);await page.waitForFunction(()=>window.__navigationDone);
      await page.waitForFunction(expected=>location.pathname===expected,expected);
      check(await page.evaluate(()=>document.querySelector('.app-page:not([hidden])').id)==='page-'+expected.split('/')[1],route+': URL and visible page disagree');
      await page.goBack();
      // Existing routing reopens /scenario as the list, where its retained draft waits.
      await page.waitForFunction(()=>document.body.dataset.currentPage==='plan');
      check(await page.evaluate(()=>location.pathname)===before.url,route+': Back did not return to the source history entry');
      await page.locator('#cards .card-edit-link[data-edit-scenario="'+scenarioName+'"]').click();
      await page.waitForFunction(()=>document.body.dataset.currentPage==='scenario');
    }
  },
  async welcomedialogs(page){
    await page.goto(base+'/welcome.html');
    // state.js normalises loaded data before the import starts; compare at the dialog boundary.
    const before=await page.evaluate(()=>localStorage.getItem('wealthPlanner.v1'));
    const data=JSON.parse(before);data.shared[0].amount=500;
    await page.locator('#welcomeImportFile').setInputFiles({name:'example-backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
    await answerDialog(page,false);
    const after=await page.evaluate(()=>localStorage.getItem('wealthPlanner.v1'));
    check(after===before,'cancelled welcome import replaced the saved copy');
    await page.locator('#welcomeImportFile').setInputFiles({name:'example-backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
    await answerDialog(page,true);
    await page.waitForURL('**/index.html');
    await page.waitForFunction(()=>document.documentElement.hasAttribute('data-wp-ready'));
    check(await st(page,'state.shared[0].amount')===500,'welcome import did not apply the chosen backup');
  },
  async transitiontimeout(page){
    // Force Chromium's animation-only failure while running the real page update.
    // Navigation must finish, including an alias subpage, without hiding render errors.
    await page.evaluate(async()=>{
      const original=document.startViewTransition;
      document.startViewTransition=callback=>{
        const updateCallbackDone=Promise.resolve().then(callback);
        return {updateCallbackDone,ready:Promise.reject(new DOMException('Animation timed out','TimeoutError')),finished:updateCallbackDone};
      };
      try{
        const nav=await import('/src/components/nav.js');
        if(!await nav.showPage('income')) throw new Error('Navigation did not complete');
        if(location.pathname!=='/expenses/income' || document.querySelector('#expensesSub-income').hidden || document.body.dataset.currentPage!=='expenses') throw new Error('Page and route disagree after animation timeout');
      }finally{ document.startViewTransition=original; }
    });
  },
  async appdialogs(page){
    await page.setViewportSize({width:320,height:844});
    const native=[];page.on('dialog',d=>{native.push(d.type());d.dismiss();});
    await go(page,'plan','data-plan-sub','scenarios');
    const count=await st(page,'state.scenarios.length');
    await page.locator('#addScenarioBtn').click();
    await page.locator('[data-sq-blank]').click();
    await answerDialog(page,false);
    check(await st(page,'state.scenarios.length')===count,'Cancel created a scenario');
    await page.locator('#addScenarioBtn').click();
    await page.locator('[data-sq-blank]').click();
    await page.locator('#appDialogInput').fill('Example plan');
    await page.keyboard.press('Enter');await page.locator('.app-dialog').waitFor({state:'detached'});
    check(await st(page,'state.scenarios.includes("Example plan")'),'text dialog did not create the scenario');
    // Secret fields are masked, confirmation validates in place, and Cancel does not set a passcode.
    await go(page,'settings','data-accounts-sub','preferences');
    await page.locator('[data-sk="pass-set"]').click();
    const d=page.locator('.app-dialog'), first=d.locator('#appDialogInput'), repeat=d.locator('#appDialogRepeat');
    check(await first.getAttribute('type')==='password','secret was not masked');
    await first.fill('invented-device-code');await repeat.fill('different-code');
    await d.locator('[data-dialog-submit]').click();
    check(await d.locator('[role="alert"]:visible').count()===1,'password mismatch did not show inline feedback');
    check(!await page.evaluate(()=>localStorage.getItem('wealthPlanner.passcode')),'mismatched passcode was stored');
    await d.getByRole('button',{name:'Show password'}).click();
    check(await first.getAttribute('type')==='text','password reveal did not work');
    const last=d.locator('[data-dialog-submit]');
    await page.setViewportSize({width:320,height:400});await last.scrollIntoViewIfNeeded();
    check(await d.evaluate(el=>el.getBoundingClientRect().width===innerWidth),'phone sheet does not use the viewport width');
    check(await last.evaluate(el=>el.getBoundingClientRect().bottom<=innerHeight),'short viewport hides the dialog action');
    check(await page.evaluate(()=>document.documentElement.scrollWidth===320),'dialog widens the short phone viewport');
    await page.setViewportSize({width:320,height:844});
    await last.focus();await page.keyboard.press('Tab');
    check(await first.evaluate(el=>el===document.activeElement),'Tab escaped the dialog');
    await first.focus();await page.keyboard.press('Shift+Tab');
    check(await last.evaluate(el=>el===document.activeElement),'Shift+Tab escaped the dialog');
    await page.keyboard.press('Escape');await d.waitFor({state:'detached'});
    check(!await page.evaluate(()=>localStorage.getItem('wealthPlanner.passcode')),'Escape changed the passcode');
    check(await page.locator('[data-sk="pass-set"]').evaluate(el=>el===document.activeElement),'dialog did not return focus');
    await page.locator('[data-sk="pass-set"]').click();
    await answerDialog(page,true,'invented-device-code');
    await page.locator('[data-sk="pass-off"]').waitFor();
    check(!!await page.evaluate(()=>localStorage.getItem('wealthPlanner.passcode')),'valid passcode was not stored');
    await page.locator('[data-sk="pass-off"]').click();await answerDialog(page,true,'invented-device-code');
    await page.locator('[data-sk="pass-set"]').waitFor();
    // Back cancels only the question, preserving a sheet's own history and unsaved field.
    await go(page,'expenses','data-expenses-sub','spending');
    await page.locator('#quickLogBtn').click();
    await page.locator('#quickLogAmount').fill('123');
    await page.evaluate(async()=>{
      const d=await import('/src/lib/dialogs.js');window.__dialogResult='pending';
      d.choiceDialog('Choose a copy <img src=x onerror=alert(1)>',{title:'Choose copy',accept:'Load saved copy',alternative:'Use this copy'}).then(v=>{window.__dialogResult=v;});
    });
    await page.locator('.app-dialog').waitFor();
    check(!await page.locator('.app-dialog img').count(),'dialog message was interpreted as HTML');
    check(await page.evaluate(async()=>(await import('/src/state.js')).hasPendingWork()),'open dialog did not protect pending work');
    await page.goBack();await page.locator('.app-dialog').waitFor({state:'detached'});
    check(await page.evaluate(()=>window.__dialogResult===null),'Back selected a destructive choice');
    check(await page.locator('#quickLogAmount').inputValue()==='123','Back closed the underlying sheet or lost typing');
    await page.goForward();await page.waitForFunction(()=>!history.state?.appDialog);
    check(await page.locator('#quickLogAmount').inputValue()==='123','Forward onto a dismissed question closed the editor');
    await page.keyboard.press('Escape');await page.locator('#quickLogAmount').waitFor({state:'hidden'});
    for(const choice of ['alternative','accept']){
      await page.evaluate(async()=>{
        const d=await import('/src/lib/dialogs.js');window.__dialogResult='pending';
        d.choiceDialog('Choose which copy to keep.',{title:'Choose copy',accept:'Load saved copy',alternative:'Use this copy'}).then(v=>{window.__dialogResult=v;});
      });
      await page.locator('.app-dialog').getByRole('button',{name:choice==='alternative'?'Use this copy':'Load saved copy',exact:true}).click();
      await page.locator('.app-dialog').waitFor({state:'detached'});
      check(await page.evaluate(()=>window.__dialogResult)===choice,'three-way choice selected the wrong copy');
    }
    // The scenario leave guard now awaits a decision; cancellation keeps its draft and page.
    await go(page,'plan','data-plan-sub','scenarios');
    await page.locator('#cards [data-edit-scenario="Example plan"]').click();
    await page.locator('[data-sc-addsheet]').click();await page.locator('#addChangeRoot [data-sc-new="cost"]').click();
    await page.waitForFunction(()=>!document.querySelector('[data-acs-backdrop]'));
    await page.goBack();await answerDialog(page,false);
    check(await page.evaluate(()=>document.body.getAttribute('data-current-page')==='scenario'),'cancelled leave navigated away');
    await page.goBack();await answerDialog(page,true);
    await page.waitForFunction(()=>document.body.getAttribute('data-current-page')!=='scenario');
    check(await st(page,'Object.keys(state.scenarioChanges).some(k=>k.startsWith("Draft"))'),'leaving lost the scenario draft');
    check(native.length===0,'a migrated flow opened a native browser dialog');
  },

  // #269: two tabs on one household — each check reads storage as well as the screen.
  async twotabs(page){
    const banner = p => p.evaluate(() => { const b = document.getElementById("storageConflict"); return b ? b.getAttribute("data-kind") : null; });
    // 1. A second tab, opened and left alone (its startup and refreshes run), doesn't stop this one saving.
    let other = await secondTab(page);
    await typeLineName(page, "demo-groceries", "Groceries (tab A)", true);
    check(await stored(page, "state.shared[0].what") === "Groceries (tab A)", "1: opening a second tab stopped the first saving");
    check(await banner(page) === null, "1: a second tab, left alone, raised the banner");
    // 2. A save in B; idle A takes it, shows it, and its next edit saves on top of it.
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await saveIn(other, 333);
    await page.waitForFunction(() => import("/src/state.js").then(m => m.state.shared[0].amount === 333), null, { timeout: 5000 }).catch(() => {});
    check(await st(page, "state.shared[0].amount") === 333, "2: an idle tab didn't take another tab's save");
    check(/Updated from another tab/.test(await page.evaluate(() => document.getElementById("statusText").textContent)), "2: no word that it updated");
    await typeLineName(page, "demo-groceries", "Groceries (A again)", true);
    check(await stored(page, "state.shared[0].amount") === 333 && await stored(page, "state.shared[0].what") === "Groceries (A again)", "2: an edit after adopting lost the other tab's save or its own");
    // 3. A scenario draft in progress in A survives B's save; A's own save of it is refused, then kept by choice.
    await go(page, "plan", "data-plan-sub", "scenarios");
    const name = await page.evaluate(() => [...document.querySelectorAll("#cards [data-edit-scenario]")].map(b => b.getAttribute("data-edit-scenario"))[1]);
    const savedBefore = await stored(page, "((state.scenarioChanges || {})[" + JSON.stringify(name) + "] || []).length");
    await click(page, '#cards [data-edit-scenario="' + name + '"]'); await until(page, () => document.body.getAttribute("data-current-page") === "scenario"); await settle(page);
    await click(page, "[data-sc-addsheet]"); await page.waitForTimeout(300);
    await click(page, '[data-sc-new="cost"]');
    const draftKey = "Draft · " + name;
    await until(page, k => import("/src/state.js").then(m => ((m.state.scenarioChanges || {})[k] || []).length > 0), draftKey);
    const draftLen = await st(page, "((state.scenarioChanges || {})[" + JSON.stringify(draftKey) + "] || []).length");
    await saveIn(other, 444);
    await page.waitForFunction(() => JSON.parse(localStorage.getItem("wealthPlanner.v1")).shared[0].amount === 444);
    await page.locator('#storageConflict[data-kind="updated"]').waitFor({ timeout: 5000 });
    check(await st(page, "((state.scenarioChanges || {})[" + JSON.stringify(draftKey) + "] || []).length") === draftLen, "3: another tab's save replaced the scenario draft");
    check(await page.evaluate(() => document.body.getAttribute("data-current-page") === "scenario"), "3: the editor closed under the person");
    check(await stored(page, "state.shared[0].amount") === 444, "3: the other tab's save didn't survive");
    await click(page, "[data-sc-save]"); await until(page, () => !!document.querySelector('#storageConflict[data-kind="stale"]'));
    check(await stored(page, "state.shared[0].amount") === 444, "3: a stale tab wrote over the other tab's save");
    check(await banner(page) === "stale", "3: a refused save didn't say so");
    await click(page, "[data-storage-keep]"); await answerDialog(page, true); await until(page, () => !document.getElementById("storageConflict"));
    check(await stored(page, "((state.scenarioChanges || {})[" + JSON.stringify(name) + "] || []).length") === savedBefore + 1, "3: keeping this tab's version didn't save the scenario");
    check(await banner(page) === null, "3: the banner stayed after choosing");
    // B was idle: it takes A's chosen version.
    await other.waitForFunction(n => import("/src/state.js").then(m => ((m.state.scenarioChanges || {})[n] || []).length), name, { timeout: 5000 });
    // 4. Price and cash-rate refreshes, in either tab: neither blocks the other, and both still save.
    for(const [who, by] of [["B", other], ["A", page]]){
      await by.evaluate(async () => { const m = await import("/src/state.js"); m.state.cashRate = null; await (await import("/src/components/cashrate.js")).readCashRateNow(); await (await import("/src/components/autoprices.js")).refreshAutoPrices(); });
      // Fixed on purpose: a refresh may save or may not (nothing changed), so there's no event to wait for — this
      // only gives a save, if there was one, time to reach the other tab.
      await page.waitForTimeout(500);
      for(const [w, p] of [["A", page], ["B", other]]){
        await saveIn(p, w === "A" ? 501 : 502);
        check(await stored(p, "state.shared[0].amount") === (w === "A" ? 501 : 502), "4: after a refresh in " + who + ", tab " + w + " couldn't save");
        check(await banner(p) === null, "4: a refresh in " + who + " raised the banner in " + w);
        // The other tab has taken this save before it makes its own.
        await until(p === page ? other : page, a => import("/src/state.js").then(m => m.state.shared[0].amount === a), w === "A" ? 501 : 502);
      }
    }
    // ...and a refresh in a tab that's mid-edit, after the other saved, applies nothing and redraws nothing.
    const typedAt = await typeBalance(page, 1234);
    await saveIn(other, 600);
    await page.waitForFunction(() => JSON.parse(localStorage.getItem("wealthPlanner.v1")).shared[0].amount === 600);
    const r = await page.evaluate(async () => (await import("/src/components/autoprices.js")).refreshAutoPrices());
    check(r.skipped === true, "4: a refresh applied over work in progress");
    check(await stored(page, "state.shared[0].amount") === 600, "4: a refresh in a stale tab wrote over the other tab's save");
    check(await page.inputValue(typedAt) === "1234", "4: a refresh wiped the typing in progress");
    await other.close();
    // 5. Near-simultaneous saves from two settled tabs: whichever lands, the other tab is never left thinking it saved.
    await page.reload(); await page.waitForFunction(() => document.documentElement.hasAttribute("data-wp-ready"));
    other = await secondTab(page);
    for(let i = 0; i < 8; i++){
      if(await banner(page) || await banner(other)) break;
      await Promise.all([saveIn(page, 700 + i * 2), saveIn(other, 701 + i * 2)]);
      // Both tabs see the same saved copy, and each has either taken it or said why not.
      await eventually(async () => {
        const a = await stored(page, "state.shared[0].amount"), b = await stored(other, "state.shared[0].amount");
        if(a !== b) return false;
        for(const p of [page, other]) if(!(await banner(p)) && await st(p, "state.shared[0].amount") !== a) return false;
        return true;
      });
      const kept = await stored(page, "state.shared[0].amount");
      for(const [w, p, mine] of [["A", page, 700 + i * 2], ["B", other, 701 + i * 2]]){
        if(kept === mine) continue;
        const said = await banner(p), adopted = await st(p, "state.shared[0].amount") === kept;
        check(said === "overwritten" || said === "stale" || adopted, "5: tab " + w + "'s save was written over and it wasn't told (round " + i + ")");
      }
    }
    await other.close();
  },
  async datasafety(page){
    await page.evaluate(async () => { const m = await import('/src/state.js'); m.state.shared[0].amount = 147; m.commit(['shared']); });
    // A real reload: waiting on data-wp-ready alone could pass on the old page before the new one loads (#269).
    await page.reload();
    await page.waitForFunction(() => document.documentElement.hasAttribute('data-wp-ready'));
    check(await st(page, 'state.shared[0].amount') === 147, 'reload lost the last edit');
    check(await stored(page, 'state.shared[0].amount') === 147, 'reload lost the last edit from storage');
    const other = await secondTab(page);
    // #269: an idle tab now takes another tab's save. A stale tab is one with work in progress: an account's new
    // balance typed and not yet saved.
    const typedAt = await typeBalance(page, 4321);
    await saveIn(other, 320);
    check(await stored(other, 'state.shared[0].amount') === 320, 'the newer tab did not save');
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('wealthPlanner.v1')).shared[0].amount === 320); // propagation between tabs
    await page.locator('#storageConflict[data-kind="updated"]').waitFor();
    check(await page.inputValue(typedAt) === '4321', 'another tab\'s save replaced the typing in progress');
    check(await st(page, 'state.shared[0].amount') === 147, 'another tab\'s save was taken over work in progress');
    await page.evaluate(async () => { const m = await import('/src/state.js'); m.state.shared[0].amount = 280; m.commit(['shared']); });
    check(await page.evaluate(() => JSON.parse(localStorage.getItem('wealthPlanner.v1')).shared[0].amount) === 320, 'stale tab overwrote the newer household');
    check(await st(page, 'state.shared[0].amount') === 280, 'conflict destroyed the local copy');
    await page.locator('#storageConflict').waitFor();
    const recovery = page.waitForEvent('download'); await page.locator('[data-storage-copy]').click();
    const file = await recovery;
    const copy = JSON.parse(fs.readFileSync(await file.path(), 'utf8'));
    check(copy.shared[0].amount === 280, 'recovery download omitted unsaved changes');
    check(await page.evaluate(() => JSON.parse(localStorage.getItem('wealthPlanner.v1')).shared[0].amount) === 320, 'recovery export changed the saved copy');
    await other.close();
    await page.locator('[data-storage-reload]').click(); await answerDialog(page, false);
    check(await st(page, 'state.shared[0].amount') === 280, 'cancelled reload discarded the recoverable copy');
    await page.locator('[data-storage-reload]').click();
    await Promise.all([page.waitForNavigation({waitUntil:'domcontentloaded'}), answerDialog(page, true)]);
    await page.waitForFunction(() => document.documentElement.hasAttribute('data-wp-ready'));
    check(await st(page, 'state.shared[0].amount') === 320, 'Reload latest did not adopt the saved household');
    await page.goto(base + '/index.html?mock=1');
    await page.locator('.app-dialog').waitFor();
    check(await page.locator('#appLoading:not(.is-hidden)').count()===0,'sample question blocked bootstrap completion');
    await answerDialog(page, false);
    await page.waitForFunction(() => document.documentElement.hasAttribute('data-wp-ready'));
    check(await st(page, 'state.shared[0].amount') === 320, 'declining sample data replaced the household');
    await page.goto(base + '/index.html?mock=1');
    await answerDialog(page, true);
    await page.waitForFunction(() => document.documentElement.hasAttribute('data-wp-ready'));
    check(await st(page, 'state.shared[0].amount') !== 320, 'accepted sample replacement did not run');
    check(!await page.locator('#firstRunRoot [role="dialog"]').count(), 'sample household opened the empty setup wizard');
    const protectedSections = await page.evaluate(async()=>{
      const m=await import('/src/state.js'), data=await import('/src/components/datawiring.js'), saved=m.state;
      const checked=[];
      try {
        for(const key of ['accounts','incomeLog','transfers','savingsGoals','recurringRules']){
          m.setState(m.defaultState()); m.state[key]=[{id:'synthetic-only'}];
          if(!data.hasRealUserData()) throw new Error('Sample guard missed '+key);
          checked.push(key);
        }
      } finally {m.setState(saved);}
      return checked.length;
    });
    check(protectedSections===5,'sample guard did not protect partially entered households');
    check(await page.evaluate(async()=>{
      const m=await import('/src/state.js'), data=await import('/src/components/datawiring.js'), saved=m.state;
      try {m.setState(m.defaultState()); m.state.home[m.state.baselineScenario][0].amount=430; return data.hasRealUserData();}
      finally {m.setState(saved);}
    }), 'sample guard missed a housing-only household');
  },
  async backupstatus(page){
    await page.evaluate(async () => {
      const m = await import('/src/state.js'); delete m.state.lastBackupDate; m.commit(['lastBackupDate']);
      window.claude = {use: async () => ({save: async () => {throw {code:'declined'};}})};
    });
    await runBackup(page, 'doExport', '');
    check(!await st(page, 'state.lastBackupDate'), 'declined backup cleared the reminder');
    await page.evaluate(() => { window.claude = {use: async () => ({save: async () => {}})}; });
    await runBackup(page, 'doExport', '');
    check(await st(page, 'state.lastBackupDate') === '2026-11-03', 'successful backup did not update the reminder');
    await page.evaluate(async () => {
      const m = await import('/src/state.js'); delete m.state.lastBackupDate; m.commit(['lastBackupDate']);
      Object.defineProperty(navigator, 'canShare', {configurable:true,value:()=>true});
      Object.defineProperty(navigator, 'share', {configurable:true,value:async()=>{throw new DOMException('Cancelled','AbortError')}});
    });
    await runBackup(page, 'doShare', 'invented-test-passphrase');
    await page.getByRole('button', {name:'Send',exact:true}).click();
    // Fixed on purpose: this checks the reminder did NOT change, so there's nothing to wait for.
    await page.waitForTimeout(200);
    check(!await st(page, 'state.lastBackupDate'), 'cancelled sharing cleared the backup reminder');
    await page.evaluate(() => { Object.defineProperty(navigator,'share',{configurable:true,value:async()=>{}}); });
    await runBackup(page, 'doShare', 'invented-test-passphrase');
    await page.getByRole('button', {name:'Send',exact:true}).last().click();
    await eventually(async () => await st(page, 'state.lastBackupDate') === '2026-11-03');
    check(await st(page, 'state.lastBackupDate') === '2026-11-03', 'successful sharing did not update the reminder');
    await page.evaluate(async()=>{
      const m=await import('/src/state.js'); delete m.state.lastBackupDate; m.commit(['lastBackupDate']);
      window.__encrypt=crypto.subtle.encrypt;
      crypto.subtle.encrypt=()=>Promise.reject(new Error('Synthetic encryption failure'));
    });
    await runBackup(page, 'doExport', 'invented-test-passphrase');
    await page.evaluate(()=>{crypto.subtle.encrypt=window.__encrypt; delete window.__encrypt; delete window.claude;});
    check(!await st(page, 'state.lastBackupDate'), 'failed encryption cleared the reminder');
  },
  async assessmentux(page){
    await go(page,'dashboard');
    const home=page.locator('#homeSummary');
    check(await home.locator('.home-grid').evaluate(e => e.previousElementSibling == null || !e.previousElementSibling.classList.contains('home-week')), 'weekly recap still leads Home');
    check(await home.locator('.home-grid > [data-home-card]').first().getAttribute('data-home-card') === 'month', 'current cash flow is not first');
    check(!await home.locator('.wk-details').evaluate(e=>e.open), 'weekly recap is not collapsed by default');
    await home.locator('.wk-details summary').click(); check(await home.locator('.wk-details').evaluate(e=>e.open), 'weekly recap cannot be expanded');
    check((await home.innerText()).includes('Planned monthly surplus'), 'planned and logged cash flow are not distinguished');
    check((await page.locator('[data-home-card="tax"]').textContent()).includes('estimated annual tax'), 'annual tax still reads as tax so far');
    check((await home.innerText()).includes('Recorded balances'), 'net worth lacks data-quality context');
    await page.locator('#quickFab').click();
    await until(page, () => !!document.querySelector('#quickLogRoot [role="dialog"], #quickLogRoot .quick-log, #quickLogRoot input, #quickLogSheet input'));
    check(await page.locator('#quickLogRoot [role="dialog"], #quickLogRoot .quick-log, #quickLogRoot input').count() > 0 || await page.locator('#quickLogSheet input').count() > 0, 'primary Log spending action did not open entry');
    await page.keyboard.press('Escape');
    await go(page,'plan','data-plan-sub','scenarios');
    check(await page.locator('.card-funding').count() > 0, 'unfunded scenario cards lack funding status');
    const longterm=page.locator('.cmp-longterm');
    check(!await longterm.evaluate(e=>e.open), 'long-term detail is not collapsed');
    await longterm.locator('summary').focus(); await page.keyboard.press('Enter');
    check(await longterm.evaluate(e=>e.open), 'long-term comparison is not keyboard operable');
    check((await page.locator('.cmp-card').innerText()).includes('Indicative serviceability check'), 'comparison implies a lending approval');
    await page.setViewportSize({width:1280,height:844});
    await go(page,'assets','data-assets-sub','summary');
    check(await page.evaluate(()=>{
      const title=document.getElementById('pageTitle').getBoundingClientRect(), actions=document.querySelector('.app-topbar .actions').getBoundingClientRect();
      return Math.abs((title.top+title.height/2)-(actions.top+actions.height/2))<12;
    }), 'desktop Investments header wrapped its actions onto another row');
    const funding=await page.evaluate(async()=>{
      const rows=[...document.querySelectorAll('#netWorthPanel tbody tr')];
      const m=await import('/src/calc/canbuy.js');
      return rows.every(row=>{
        const cells=row.querySelectorAll('td'), buy=m.canBuy(cells[0].textContent);
        return Number(cells[2].textContent.replace(/[^0-9.]/g,''))===Math.round(buy.available) &&
          Number(cells[3].textContent.replace(/[^0-9.]/g,''))===Math.round(Math.abs(buy.left));
      });
    });
    check(funding,'Investments settlement table disagrees with the purchase warning');
  },
  async keyboardaudit(page){
    page.setDefaultTimeout(10000);
    const original = await st(page, 'JSON.stringify(state)');
    await page.evaluate(async () => {
      const s = await import('/src/state.js'); s.setState(s.defaultState());
      (await import('/src/calc/engine.js')).recalcComputedItems();
      (await import('/src/components/redraw.js')).renderAll();
    });
    await go(page, 'dashboard');
    const opener = page.locator('#dashboardSetup [data-firstrun-open]');
    // #282: a trace of the close, so a failure says why focus didn't come back — not a retry. Every focus change;
    // every .focus() on an opener (in the page? visible? inert?) and who called it; every opener removed; and when
    // the startup price and cash-rate reads land. The failure message prints it.
    await page.evaluate(() => {
      const t0 = performance.now(), log = window.__setupTrace = [];
      const d = el => !el ? "none" : el === document.body ? "BODY" : el.tagName + (el.id ? "#" + el.id : "") + (el.matches && el.matches("[data-firstrun-open]") ? "[opener]" : "");
      const L = m => { if(log.length < 80) log.push(Math.round(performance.now() - t0) + "ms " + m); };
      document.addEventListener("focusin", e => L("focusin " + d(e.target)), true);
      document.addEventListener("focusout", e => L("focusout " + d(e.target) + " -> " + d(e.relatedTarget)), true);
      const focus = HTMLElement.prototype.focus;
      HTMLElement.prototype.focus = function(o){
        if(this.matches && this.matches("[data-firstrun-open]")) L("focus() on opener: inPage=" + this.isConnected + " visible=" + !!this.getClientRects().length + " inert=" + !!this.closest("[inert]") + " from " + ((new Error().stack || "").split("\n")[2] || "").trim().replace(/^.*\/src\//, "").replace(/\?v=[0-9.]+/, ""));
        return focus.call(this, o);
      };
      const get = window.fetch;
      window.fetch = function(u){ const r = get.apply(this, arguments); if(/latest\.json|weekly\.json|cash-rate/.test(String(u))) r.then(() => L("read " + String(u).split("/").pop().split("?")[0]), () => L("failed " + String(u).split("/").pop())); return r; };
      new MutationObserver(ms => ms.forEach(m => m.removedNodes.forEach(n => {
        if(n.nodeType === 1 && (n.matches("[data-firstrun-open]") || (n.querySelector && n.querySelector("[data-firstrun-open]")))) L("opener removed (in " + d(n) + "), focus now " + d(document.activeElement));
      }))).observe(document, { childList: true, subtree: true });
      window.addEventListener("popstate", () => L("popstate"), true);
    });
    await opener.focus(); await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Set up Wealth Planner' });
    const first = dialog.locator('[data-fr-close]'), last = dialog.locator('[data-fr-next]');
    await last.focus(); await page.keyboard.press('Tab');
    check(await first.evaluate(el => el === document.activeElement), 'Tab escaped the setup dialog');
    await first.focus(); await page.keyboard.press('Shift+Tab');
    check(await last.evaluate(el => el === document.activeElement), 'Shift+Tab escaped the setup dialog');
    check(await page.locator('.app-shell').evaluate(el => el.inert), 'background remains available to assistive technology');
    const cdp = await page.context().newCDPSession(page);
    const ax = await cdp.send('Accessibility.getFullAXTree');
    const accessible = ax.nodes.filter(n => !n.ignored);
    check(accessible.some(n => n.role?.value === 'dialog' && n.name?.value === 'Set up Wealth Planner'), 'setup is missing from the native accessibility tree');
    check(!accessible.some(n => n.role?.value === 'button' && n.name?.value === 'Guided setup'), 'background button remains in the native accessibility tree');
    await cdp.detach();
    await dialog.locator('[data-fr="people.0.name"]').fill('Alex');
    await last.click();
    const type = dialog.locator('[data-fr="accounts.0.type"]');
    check(await type.evaluate(el => el.getBoundingClientRect().width >= 110), 'mobile account type picker truncates its labels');
    await type.focus();
    await type.selectOption('savings');
    check(await type.evaluate(el => el === document.activeElement), 'changing account type lost keyboard focus');
    await page.evaluate(() => window.__setupTrace && window.__setupTrace.push("--- Escape"));
    await page.keyboard.press('Escape');
    // Focus comes back at the end of an async chain (Escape → history.back() → popstate → close → setTimeout), so
    // wait for it rather than a fixed 400ms, which a busy CI runner missed (#274).
    // Read focus and match the live opener in one browser task: locator.evaluate can resolve
    // a node before a background redraw and compare that detached node to its focused replacement.
    await page.waitForFunction(() => { const a = document.activeElement; return !!(a && a.matches('#dashboardSetup [data-firstrun-open]')); }, null, { timeout: 5000 }).catch(() => {});
    check(await page.evaluate(() => !!document.activeElement?.matches('#dashboardSetup [data-firstrun-open]')), 'closing setup did not return focus to its opener — ' + await page.evaluate(() => {
      const a = document.activeElement;
      return JSON.stringify({ focus: a ? a.tagName + "#" + a.id + "." + a.className + " in " + ((a.closest("[id]") || {}).id || "-") : null,
        focusData: a ? Object.assign({}, a.dataset) : null, setupOpen: !!document.querySelector('#firstRunRoot [role="dialog"]'), shellInert: !!(document.querySelector(".app-shell") || {}).inert,
        openers: document.querySelectorAll('#dashboardSetup [data-firstrun-open]').length, page: document.body.getAttribute("data-current-page"), history: history.state,
        trace: (window.__setupTrace || []).slice(-30) });
    }));
    check(await page.locator('.app-shell').evaluate(el => !el.inert), 'closing setup left the app inert');
    // A full redraw (the app's own price refresh can land here) keeps a keyboard user's place: lib/keepui.js.
    // Hold the old node to exercise the redraw that can land between a locator's
    // resolution and evaluate(). Focus belongs to the replacement, not that detached node.
    await page.evaluate(async () => {
      const before = document.activeElement;
      (await import('/src/components/redraw.js')).renderAll();
      if(before.isConnected) throw new Error('Focus regression did not replace the opener');
      if(!document.activeElement?.matches('#dashboardSetup [data-firstrun-open]')) throw new Error('A full redraw took focus from the setup opener');
    });
    await page.evaluate(async original => {
      const s = await import('/src/state.js'); s.setState(s.migrateState(JSON.parse(original)));
      (await import('/src/calc/engine.js')).recalcComputedItems();
      (await import('/src/components/redraw.js')).renderAll();
    }, original);
    await go(page, 'plan', 'data-plan-sub', 'scenarios');
    const compare = page.locator('.cmp-scroll').first();
    await compare.focus(); await page.keyboard.press('ArrowRight'); await until(page, el => el.scrollLeft > 0, await compare.elementHandle());
    check(await compare.evaluate(el => el.scrollLeft > 0), 'scenario table cannot scroll with the keyboard');
    await go(page, 'reports');
    await page.locator('[data-report="networth"]').click();
    const report = page.locator('#reportSheet .rp-scroll');
    await report.focus(); await page.keyboard.press('ArrowRight'); await until(page, el => el.scrollLeft > 0, await report.elementHandle());
    check(await report.evaluate(el => el.scrollLeft > 0), 'net worth report cannot scroll with the keyboard');
  },
  async onboardingaudit(page){
    page.setDefaultTimeout(10000);
    await page.evaluate(async () => {
      const s = await import('/src/state.js');
      s.setState(s.defaultState());
      const e = await import('/src/calc/engine.js'); e.recalcComputedItems();
      const r = await import('/src/components/redraw.js'); r.renderAll();
    });
    await go(page, 'dashboard');
    await page.locator('#dashboardSetup [data-firstrun-open]').click();
    const dialog = page.getByRole('dialog', { name: 'Set up Wealth Planner' });
    check((await dialog.innerText()).includes('Step 1 of 5'), 'setup has no readable progress');
    await dialog.locator('[data-fr="people.0.name"]').fill('Alex');
    await dialog.locator('[data-fr-next]').click();
    check((await dialog.innerText()).includes('Step 2 of 5'), 'setup did not advance');
    await dialog.locator('[data-fr-close]').click();
    check(await st(page, 'state.income.length') === 0, 'cancelling setup saved an incomplete draft');
    await page.locator('#dashboardSetup [data-firstrun-open]').click();
    await dialog.locator('[data-fr="people.0.name"]').fill('Alex');
    await dialog.locator('[data-fr-next]').click();
    await dialog.locator('[data-fr-next]').click();
    await dialog.locator('[data-fr="people.0.pay"]').fill('60000');
    await dialog.locator('[data-fr-next]').click();
    await dialog.locator('[data-fr-next]').click();
    await dialog.locator('[data-fr-finish="home"]').click();
    check(await st(page, 'state.income.length') > 0, 'finishing setup did not save income');
    await go(page, 'reports');
    const progress = page.locator('[aria-label="Planning setup progress"]');
    await progress.locator('summary').click();
    check((await progress.innerText()).includes('Not entered: Goals'), 'partial profile goals were presented as entered');
    check(!(await page.locator('body').innerText()).match(/NaN|undefined/), 'partial profile produced invalid figures');
  },
  async recurringrules(page){
    page.setDefaultTimeout(10000);
    await go(page, "expenses", "data-expenses-sub", "budget");
    await page.locator('#recurringRuleForm').evaluate(el => el.closest('details').open = true);
    await page.locator('#recurringRuleForm [name="what"]').fill('Synthetic service');
    await page.evaluate(async () => (await import('/src/components/budgettoolswiring.js')).renderRecurring());
    check(await page.locator('#recurringRuleForm [name="what"]').inputValue() === 'Synthetic service', 'background redraw discarded the open rule draft');
    await page.locator('#recurringRuleForm [name="amount"]').fill('25');
    await page.locator('#recurringRuleForm [name="startDate"]').fill('2026-10-01');
    const before = await st(page, "state.transactions.length");
    await page.locator('#recurringRuleForm button[type="submit"]').click();
    check(await st(page, "state.transactions.length") === before, 'saving a rule generated transactions without approval');
    const id = await st(page, "state.recurringRules.find(r => r.what === 'Synthetic service').id");
    const preview = page.locator('[data-rr-preview="' + id + '"]');
    let message = '';
    await preview.click();
    message = await page.locator('#appDialogMessage').innerText();
    await answerDialog(page, false);
    check(message.includes('\n\n2026-10-01') && !message.includes('\\n'), 'preview must show readable occurrence lines');
    check(await st(page, "state.transactions.length") === before, 'cancelled preview wrote transactions');
    await preview.click(); await answerDialog(page, true);
    check(await st(page, "state.transactions.length") === before + 2, 'approved monthly occurrences were not recorded');
    await preview.click();
    check(await st(page, "state.transactions.length") === before + 2, 'repeated preview duplicated occurrences');
    await page.locator('[data-rr-edit="' + id + '"]').click();
    await page.locator('#recurringRuleForm [name="kind"]').selectOption('Income');
    await page.locator('#recurringRuleForm [name="category"]').fill('Synthetic category');
    await page.locator('#recurringRuleForm button[type="submit"]').click();
    const incomeBefore = await st(page, "state.incomeLog.length");
    await preview.click();
    check(await st(page, "state.incomeLog.length") === incomeBefore, 'type edit duplicated previously recorded dates');
    await page.locator('[data-rr-toggle="' + id + '"]').click();
    check(await st(page, "state.recurringRules.find(r => r.what === 'Synthetic service').enabled") === false, 'pause was not saved');
    await page.waitForFunction(() => {
      const saved = JSON.parse(localStorage.getItem('wealthPlanner.v1') || '{}');
      return (saved.recurringRules || []).some(r => r.what === 'Synthetic service' && r.enabled === false);
    });
    // Re-enter via the static entry point; this test server does not emulate Pages 404 routing.
    await page.goto(base + "/index.html");
    await page.waitForFunction(() => document.documentElement.hasAttribute('data-wp-ready'));
    await go(page, "expenses", "data-expenses-sub", "budget");
    check(await st(page, "state.recurringRules.find(r => r.what === 'Synthetic service').category") === 'Synthetic category', 'rule edit did not persist locally');
    await page.locator('[data-rr-delete="' + id + '"]').click(); await answerDialog(page, true);
    check(await st(page, "state.recurringRules.some(r => r.what === 'Synthetic service')") === false, 'rule deletion did not persist');
    check(await st(page, "state.transactions.length") === before + 2, 'deleting a rule deleted its historical payments');
  },
  async reportaudit(page){
    page.setDefaultTimeout(10000);
    await page.evaluate(() => {
      window.__csvShares = [];
      Object.defineProperty(navigator, 'canShare', {configurable:true,value:()=>true});
      Object.defineProperty(navigator, 'share', {configurable:true,value:async({files})=>{window.__csvShares.push({name:files[0].name,text:await files[0].text()});}});
    });
    await go(page, "reports");
    await page.locator('[data-report="cashflow"]').click();
    const disclosure = page.locator('[aria-label="Report assumptions and data quality"]');
    await disclosure.locator('summary').focus();
    await page.keyboard.press('Enter');
    check(await disclosure.locator('details').evaluate(el => el.open), 'report disclosure is not keyboard operable');
    check((await disclosure.innerText()).includes('2026-11-03'), 'report has no as-of date');
    const result = await page.evaluate(async () => {
      const m = await import('/src/components/reports.js');
      const csv = m.reportCsv(), printed = m.reportPrintHtml();
      const calc = await import('/src/calc/reports.js');
      const rep = calc.buildReport('cashflow', m.reportOpts());
      return { csv, printed, expected: calc.reportCsvRows(rep) };
    });
    check(JSON.stringify(result.csv.headers) === JSON.stringify(result.expected.headers), 'CSV headers disagree with report');
    check(JSON.stringify(result.csv.rows.slice(0, result.expected.rows.length)) === JSON.stringify(result.expected.rows), 'CSV calculations disagree with report');
    check(result.csv.rows.some(r => r[0] === 'As of' && r[1] === '2026-11-03'), 'CSV omits as-of metadata');
    check(result.printed.includes('<details open>') && result.printed.includes('2026-11-03'), 'print omits visible disclosures');
    const download = page.waitForEvent('download');
    await page.locator('[data-report-csv]').click();
    const file = await download;
    check(file.suggestedFilename().endsWith('.csv'), 'report download did not produce a CSV');
    check(await page.evaluate(()=>window.__csvShares.length) === 0, 'Download unexpectedly opened native sharing');
    await page.locator('[data-report-share]').click();
    await page.waitForFunction(()=>window.__csvShares.length === 1);
    const shared = await page.evaluate(()=>window.__csvShares[0]);
    check(shared.name.endsWith('.csv') && shared.text.includes('As of'), 'Share CSV omitted report or metadata');
    const failedShare = page.waitForEvent('download');
    await page.evaluate(()=>Object.defineProperty(navigator,'share',{configurable:true,value:async()=>{throw new Error('Unavailable')}}));
    await page.locator('[data-report-share]').click();
    check((await failedShare).suggestedFilename().endsWith('.csv'), 'failed CSV share did not offer a download');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    check(!overflow, 'report scrolls sideways on mobile');
    const setup = page.locator('[aria-label="Planning setup progress"]');
    await setup.locator('summary').click();
    const goals = setup.getByRole('button', { name: 'Review Goals', exact: true });
    await goals.focus();
    await page.keyboard.press('Enter');
    await page.locator('#planSub-goals').waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
    check(await page.locator('#planSub-goals').isVisible(), 'setup Goals action did not open Plan goals');
  },

  async bills(page){
    await go(page, "expenses", "data-expenses-sub", "spending");
    const before = await st(page, "state.transactions.length");
    const btn = await page.$("#reviewExpensesBtn:not([hidden])");
    check(btn, "no \"bills to confirm\" button on the sample household");
    await btn.click(); await until(page, () => !!document.querySelector(".bc-confirm-row .bc-confirm-check:checked"));
    const n = await page.evaluate(() => document.querySelectorAll(".bc-confirm-row .bc-confirm-check:checked").length);
    check(n > 0, "the sheet lists no bills");
    await click(page, "[data-review-confirm]"); await eventually(async () => await st(page, "state.transactions.length") > before);
    const after = await st(page, "state.transactions.length");
    check(after === before + n, "confirming " + n + " bills logged " + (after - before));
    check(await page.evaluate(() => /Logged/.test(document.querySelector(".review-panel").innerText)), "no \"Logged\" note after confirming");
  },
  async transfer(page){
    await go(page, "expenses", "data-expenses-sub", "spending");
    // The form draws after the click: reading it after a fixed 300ms is the "missing selector" Transfer failure (#267).
    await click(page, "#transactionsTable [data-cf-transfer]"); await until(page, () => !!document.querySelector('#transactionsTable [data-tf="from"]'));
    const accts = await page.evaluate(() => [...document.querySelector('#transactionsTable [data-tf="from"]').options].map(o => o.value).filter(Boolean));
    const bal = () => page.evaluate(async (a) => { const s = (await import("/src/state.js")).state, ac = await import("/src/calc/accounts.js"); return a.map(n => Math.round(ac.accountBalance(s.accounts.find(x => x.name === n)).balance || 0)); }, accts.slice(0, 2));
    const before = await bal();
    await page.fill('#transactionsTable [data-tf="amount"]', "250");
    await page.selectOption('#transactionsTable [data-tf="from"]', accts[0]); await page.selectOption('#transactionsTable [data-tf="to"]', accts[1]);
    const box = await page.$('#transactionsTable [data-tf="balances"]'); if(box && !(await box.isChecked())) await box.check();
    await click(page, "#transactionsTable [data-tf-save]"); await eventually(async () => await st(page, "state.transfers.filter(function(t){ return t.amount === 250; }).length") > 0);
    const after = await bal();
    check(after[0] === before[0] - 250 && after[1] === before[1] + 250, "balances " + JSON.stringify(before) + " → " + JSON.stringify(after));
    check(await page.evaluate(() => document.querySelector("#transactionsTable").innerText.includes("250")), "the transfer isn't listed");
    await page.evaluate(() => [...document.querySelectorAll(".toast button")].find(b => /undo/i.test(b.innerText)).click());
    await eventually(async () => await st(page, "state.transfers.filter(function(t){ return t.amount === 250; }).length") === 0);
    check(JSON.stringify(await bal()) === JSON.stringify(before), "Undo didn't put the balances back");
    check(await st(page, "state.transfers.filter(function(t){ return t.amount === 250; }).length") === 0, "Undo left the transfer");
  },
  async autopay(page){
    await go(page, "accounts");
    await page.evaluate(() => { const c = [...document.querySelectorAll("#accountsTable .acct-card")].find(c => /loan/i.test(c.innerText)); c.querySelector(".acct-card-toggle").click(); });
    await page.waitForTimeout(400);
    await click(page, "[data-ap-add]"); await until(page, () => !!document.querySelector('[data-ap-field="from"]'));
    const from = await page.evaluate(() => [...document.querySelector('[data-ap-field="from"]').options].map(o => o.value).find(v => /everyday/i.test(v)));
    await page.selectOption('[data-ap-field="from"]', from);
    await page.fill('[data-ap-field="amount"]', "1850"); await page.press('[data-ap-field="amount"]', "Tab");
    await page.fill('[data-ap-field="start"]', TODAY.slice(0, 10)); await page.press('[data-ap-field="start"]', "Tab"); await page.waitForTimeout(300);
    await go(page, "dashboard");
    check(await page.$('[data-home-card="autopay"]'), "Home doesn't ask about the payment on its day");
    await click(page, "[data-ap-other]"); await page.waitForTimeout(200);
    await page.fill(".ap-other-amount", "1912.35");
    await click(page, "[data-ap-other-save]"); await eventually(async () => await st(page, "state.transfers.some(function(t){ return t.autoPay; })"));
    const ap = await st(page, "{ amount: state.autoPayments[0].amount, tx: state.transfers.filter(function(t){ return t.autoPay; }).map(function(t){ return t.amount; }) }");
    check(ap.amount === 1912.35 && ap.tx.length === 1 && ap.tx[0] === 1912.35, "after answering: " + JSON.stringify(ap));
    check(!(await page.$('[data-home-card="autopay"]')), "Home still asks after the answer");
  },
  async scenario(page){
    await go(page, "plan", "data-plan-sub", "scenarios");
    const name = await page.evaluate(() => [...document.querySelectorAll("#cards [data-edit-scenario]")].map(b => b.getAttribute("data-edit-scenario"))[1]);
    const card = () => page.evaluate(n => document.querySelector('#cards [data-edit-scenario="' + n + '"]').closest(".card").innerText.replace(/\s+/g, " "), name);
    const before = await card();
    await click(page, '#cards [data-edit-scenario="' + name + '"]'); await until(page, () => document.body.getAttribute("data-current-page") === "scenario"); await settle(page);
    check(await page.evaluate(() => document.body.getAttribute("data-current-page") === "scenario"), "Edit didn't open the scenario's page");
    check(await page.evaluate(() => getComputedStyle(document.getElementById("mobileTabbar")).display === "none"), "the bottom tabs show while editing");
    await click(page, "[data-sc-addsheet]"); await page.waitForTimeout(300);
    await click(page, '[data-sc-new="cost"]'); await page.waitForTimeout(600);
    await click(page, "[data-sc-save]"); await until(page, () => document.body.getAttribute("data-current-page") === "plan"); await settle(page);
    check(await page.evaluate(() => document.body.getAttribute("data-current-page") === "plan"), "Save didn't go back to Plan");
    check((await card()) !== before, "the card didn't change after saving a new cost");
    await click(page, '#cards [data-edit-scenario="' + name + '"]'); await until(page, () => document.body.getAttribute("data-current-page") === "scenario"); await settle(page);
    await click(page, "[data-make-real]"); await until(page, () => /THIS WILL|This will/.test((document.querySelector("[data-mr-backdrop]") || {}).innerText || ""));
    check(await page.evaluate(() => /THIS WILL|This will/.test((document.querySelector("[data-mr-backdrop]") || {}).innerText || "")), "Make it real shows no plan");
    await page.keyboard.press("Escape");
  },
  async csv(page){
    await go(page, "expenses", "data-expenses-sub", "spending");
    const before = await st(page, "state.transactions.length");
    await page.setInputFiles("#bankImportFile", { name: "statement.csv", mimeType: "text/csv", buffer: Buffer.from(STATEMENT_CSV) });
    await page.waitForSelector("#bankImportConfirmBtn", { timeout: 10000 });
    await click(page, "#bankImportConfirmBtn"); await eventually(async () => await st(page, "state.transactions.length") > before);
    const after = await st(page, "state.transactions.length");
    check(after === before + 2, "the CSV's two purchases didn't land (" + (after - before) + ")");
  },
  async pdf(page){
    await go(page, "expenses", "data-expenses-sub", "spending");
    const before = await st(page, "state.transactions.length");
    await page.setInputFiles("#bankImportFile", { name: "statement.pdf", mimeType: "application/pdf", buffer: statementPdf() });
    await page.waitForSelector("#bankImportConfirmBtn", { timeout: 20000 });
    check(await page.evaluate(() => /3 transactions to import/.test(document.getElementById("bankImportPanel").innerText)), "the PDF's three purchases weren't read");
    await click(page, "#bankImportConfirmBtn"); await eventually(async () => await st(page, "state.transactions.length") > before);
    check((await st(page, "state.transactions.length")) === before + 3, "the PDF's purchases didn't land");
  },
  // v3.208.0 (item 240): a property manager's statement dropped into the same import lands in its property's form.
  async rentstatement(page){
    await go(page, "expenses", "data-expenses-sub", "spending");
    const before = await st(page, "state.incomeLog.length");
    await page.setInputFiles("#bankImportFile", { name: "owner-statement.pdf", mimeType: "application/pdf", buffer: agentStatementPdf() });
    await page.waitForFunction(() => [...document.querySelectorAll("[data-as-panel]")].some(d => d.open && d.offsetParent && d.querySelector('[data-as="rent"]').value), null, { timeout: 20000 });
    const form = await page.evaluate(() => { const p = [...document.querySelectorAll("[data-as-panel]")].find(d => d.open && d.offsetParent); const v = k => p.querySelector('[data-as="' + k + '"]').value; return { rent: v("rent"), fees: v("fees"), net: p.querySelector("[data-as-net]").textContent }; });
    check(form.rent === "1200" && form.fees === "84" && /1,116\.00/.test(form.net), "the statement didn't fill its property's form: " + JSON.stringify(form));
    check(!(await page.evaluate(() => !!document.getElementById("bankImportConfirmBtn"))), "it was read as a bank statement too");
    await page.evaluate(() => [...document.querySelectorAll("[data-as-log]")].find(b => b.offsetParent).click());
    await eventually(async () => await st(page, "state.incomeLog.length") > before);
    check((await st(page, "state.incomeLog.length")) === before + 1, "logging it didn't record the rent received");
  },
  // Item 243: a loan account's statement — its interest and fees go on the loan, nothing lands as spending.
  async loanstatement(page){
    await go(page, "expenses", "data-expenses-sub", "spending");
    const tx = await st(page, "state.transactions.length");
    await page.setInputFiles("#bankImportFile", { name: "Investment loan statement.csv", mimeType: "text/csv", buffer: Buffer.from(LOAN_STATEMENT_CSV) });
    await page.waitForSelector("[data-bank-loan]", { timeout: 10000 });
    check(/Record 5 on the loan/.test(await page.evaluate(() => document.getElementById("bankImportConfirmBtn").textContent)), "the loan's charges weren't offered");
    // Wait for the charges on the loan; then nothing having landed as spending is a real check (one import, one save).
    await click(page, "#bankImportConfirmBtn"); await eventually(async () => await st(page, "state.properties[0].loans[0].charges.length") >= 5);
    check((await st(page, "state.transactions.length")) === tx, "a loan charge landed as spending");
    const loan = await st(page, "({ n: state.properties[0].loans[0].charges.length, bank: (state.properties[0].loans[0].bankRepayment || {}).amount })");
    check(loan.n === 5 && loan.bank === 2950, "the charges or the bank's repayment weren't recorded: " + JSON.stringify(loan));
  },
  // Item 245: the same statement under a name that says nothing — the import asks which loan.
  async cashrate(page){
    // The site's file is read a moment after startup; the sample household has loans to record it on.
    for(let i = 0; i < 40 && !(await st(page, "!!state.cashRate")); i++) await page.waitForTimeout(250);
    check(await st(page, "!!(state.cashRate && state.cashRate.rate > 0)"), "the cash rate file wasn't read");
    await go(page, "properties");
    await page.waitForSelector("#cashRatePanel [data-cr-record]", { timeout: 5000 });
    const picks = await page.evaluate(() => [...document.querySelectorAll("#cashRatePanel [data-cr-loan]:checked")].map(x => x.getAttribute("data-cr-loan")));
    check(picks.length > 0, "no loans offered for the rate change");
    await page.fill("#cashRatePanel [data-cr-date]", "2026-11-20");
    await click(page, "#cashRatePanel [data-cr-record]"); await until(page, () => !document.querySelector("#cashRatePanel [data-cr-record]"));
    const r = await page.evaluate(async (key) => {
      const s = (await import("/src/state.js")).state, P = await import("/src/calc/property.js");
      const [pid, i] = key.split(":"), l = s.properties.find(p => p.id === pid).loans[Number(i)];
      return { before: P.loanRateOn(l, "2026-11-19"), after: P.loanRateOn(l, "2026-11-20"), change: s.cashRate.change, seen: s.cashRate.seen === s.cashRate.effective,
        panel: !!document.querySelector("#cashRatePanel [data-cr-record]") };
    }, picks[0]);
    check(Math.abs(r.after - r.before - r.change) < 0.001, "the loan's rate moved " + (r.after - r.before) + ", the cash rate " + r.change);
    check(r.seen && !r.panel, "the move still asks to be recorded");
  },
  async savings(page){
    await go(page, "dashboard", "data-dashboard-sub", "overview");
    await click(page, '#dashboardStats [data-savings-why]');
    await page.waitForSelector("#savingsBreakdown:not([hidden])", { timeout: 5000 });
    const r = await page.evaluate(() => {
      const el = document.getElementById("savingsBreakdown");
      const total = [...el.querySelectorAll(".bp-total")].find(x => /normal month|each month/.test(x.textContent));
      const money = s => Number(String(s).replace(/[^0-9.−-]/g, "").replace("−", "-"));
      return { tile: money(document.querySelector('#dashboardStats [data-home-card="savings"] b').textContent), total: total ? money(total.querySelector("em").textContent) : null,
        loans: [...el.querySelectorAll(".bp-row span")].some(x => /loan repayments/.test(x.textContent)), docW: document.documentElement.scrollWidth };
    });
    check(r.total === r.tile, "the breakdown ends at " + r.total + ", the tile says " + r.tile);
    check(r.loans, "no investment loan repayments line in the breakdown");
    check(r.docW <= 390, "the breakdown is wider than the phone");
    await go(page, "expenses", "data-expenses-sub", "budget");
    const b = await page.evaluate(async () => {
      const m = await import("/src/components/expenses.js");
      const group = document.querySelector("#propertyExpensesModern [data-budget-loans]");
      return { group: !!group, total: document.getElementById("totalSharedMonthly").textContent, expected: m.budgetMonthlyTotal(), loans: m.investmentLoanRepaymentsMonthly() };
    });
    check(b.group && b.loans > 0, "the Budget lists no investment loan repayments");
    check(Number(b.total.replace(/[^0-9.]/g, "")) === Math.round(b.expected), "the Budget total " + b.total + " isn't its lines plus the loan repayments");
  },
  async loanguess(page){
    await go(page, "expenses", "data-expenses-sub", "spending");
    await page.setInputFiles("#bankImportFile", { name: "export.csv", mimeType: "text/csv", buffer: Buffer.from(LOAN_STATEMENT_CSV) });
    await page.waitForSelector("[data-bank-loanguess]", { timeout: 10000 });
    await click(page, "[data-bank-loanpick]");
    await page.waitForSelector("[data-bank-loan]", { timeout: 5000 });
    check(/Record 5 on the loan/.test(await page.evaluate(() => document.getElementById("bankImportConfirmBtn").textContent)), "picking the loan didn't read it as the loan's");
  }
};

// ---------------- Journeys ----------------
const pick = process.env.JOURNEYS ? process.env.JOURNEYS.split(",") : Object.keys(JOURNEYS);
if(!process.env.SPEED_ONLY) for(const name of pick){
  const { ctx, page, errors } = await fresh({taxFailure:name === "taximporterrors"});
  const t0 = Date.now();
  try { await JOURNEYS[name](page); }
  catch(e){ failures.push(name + ": " + e.message); }
  errors.forEach(e => failures.push(name + ": " + e));
  console.log((failures.some(f => f.indexOf(name + ":") === 0) ? "✗ " : "✓ ") + name + " (" + (Date.now() - t0) + "ms)");
  await ctx.close();
}

// ---------------- Speed budget ----------------
// A large invented household: the sample one with its spending copied back in time, six times over
// (several years of a household that logs everything), at 4× CPU slowdown.
const BUDGET = { startup: 8000, transfer: 2000, scenarioChange: 1500 };
// And as a share of a full redraw, measured in the same run: saving a transfer was a full redraw before
// v3.200.2 (over 100%); about half of one after v3.205.0; about a third since v3.206.0 (item 236b), when its
// commit redraws only the views that read transfers and balances.
const SHARE = { transfer: 0.6 };
if(process.env.SPEED !== "0"){
  const { demoHousehold } = await import(path.join(root, "src/calc/demo.js"));
  const big = demoHousehold(TODAY.slice(0, 10));
  const tx = big.transactions.slice();
  for(let k = 1; k < 6; k++) tx.forEach(function(t, i){
    const d = new Date(t.date + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() - k * 56);
    big.transactions.push(Object.assign({}, t, { id: t.id + "-k" + k + "-" + i, date: d.toISOString().slice(0, 10) }));
  });
  const { ctx, page, errors } = await fresh({ stored: JSON.stringify(big), cpu: 4, query: "?perf=1" });
  const median = xs => xs.slice().sort((p, q) => p - q)[Math.floor(xs.length / 2)];
  const results = {};
  results.startup = Math.round(await page.evaluate(() => performance.getEntriesByName("wp:ready")[0].startTime));
  await go(page, "expenses", "data-expenses-sub", "spending");
  // A full redraw of every page — what the steps below are measured against.
  const full = [];
  await page.evaluate(() => window.__wpRenderAll());
  for(let i = 0; i < 5; i++) full.push(await page.evaluate(() => { const t0 = performance.now(); window.__wpRenderAll(); return performance.now() - t0; }));
  results.fullRender = Math.round(median(full));
  const transfers = [];
  // The first save warms up; the median of the next five counts.
  for(let i = 0; i < 6; i++){
    await click(page, "#transactionsTable [data-cf-transfer]"); await until(page, () => !!document.querySelector('#transactionsTable [data-tf="from"]'));
    await page.evaluate(() => { const f = document.querySelector('#transactionsTable [data-tf="from"]'), t = document.querySelector('#transactionsTable [data-tf="to"]'), o = [...f.options].map(x => x.value).filter(Boolean); f.value = o[0]; t.value = o[1]; document.querySelector('#transactionsTable [data-tf="amount"]').value = "75"; });
    const ms = await page.evaluate(() => { const t0 = performance.now(); document.querySelector("#transactionsTable [data-tf-save]").click(); return performance.now() - t0; });
    if(i) transfers.push(ms);
    await page.waitForTimeout(300);
  }
  results.transfer = Math.round(median(transfers));
  await go(page, "plan", "data-plan-sub", "scenarios");
  await page.evaluate(() => { const b = [...document.querySelectorAll("#cards [data-edit-scenario]")][1]; if(b) b.click(); });
  await until(page, () => document.body.getAttribute("data-current-page") === "scenario"); await settle(page);
  await click(page, "[data-sc-addsheet]"); await until(page, () => !!document.querySelector('[data-sc-new="cost"]'));
  results.scenarioChange = Math.round(await page.evaluate(() => { const t0 = performance.now(); document.querySelector('[data-sc-new="cost"]').click(); return performance.now() - t0; }));
  errors.forEach(e => failures.push("speed: " + e));
  // A step that only redraws what it changes stays well under a full redraw, whatever the machine's speed.
  Object.keys(SHARE).forEach(function(k){
    const share = results[k] / results.fullRender, ok = share <= SHARE[k];
    console.log((ok ? "✓ " : "✗ ") + "speed " + k + ": " + Math.round(share * 100) + "% of a full redraw (" + results.fullRender + "ms; at most " + Math.round(SHARE[k] * 100) + "%)");
    if(!ok) failures.push("speed: " + k + " took " + Math.round(share * 100) + "% of a full redraw — over " + Math.round(SHARE[k] * 100) + "%: it redraws more than it changes");
  });
  Object.keys(BUDGET).forEach(function(k){
    const ok = results[k] <= BUDGET[k];
    console.log((ok ? "✓ " : "✗ ") + "speed " + k + ": " + results[k] + "ms (budget " + BUDGET[k] + "ms, 4× CPU, " + big.transactions.length + " transactions)");
    if(!ok) failures.push("speed: " + k + " took " + results[k] + "ms, over its " + BUDGET[k] + "ms budget");
  });
  await ctx.close();
}

await browser.close();
server.close();
if(failures.length){
  console.error("\nJourneys failed:\n  " + failures.join("\n  "));
  process.exit(1);
}
console.log("\nJourneys passed.");
