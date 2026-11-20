// Journeys and a speed budget (v3.203.1, item 234). The smoke script proves every page renders; this proves
// the things people do work, end to end, in a real browser at a phone's width, on invented data:
//
//   replacedhousehold — the household replaced a tick after the scenario cards are drawn: nothing throws (#267)
//   dismissnotice — put an observation away from the bell, bring it back on Insights, and see it return by itself (#305)
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
//   basicinvestmenthelp — described recording actions, Super/Vehicle method help, chart names and saved snapshots
//   investmentssummaryhelp — accessible summary/funding explanations, allocation values, redraws and empty guidance
//   pagehelpstays — opening a page's help from the header ⓘ a little way down leaves the page where it was
//   billpaid — Paid on a bill: pre-filled with today, its amount and its account; logged against its line, off the list
//   setupfocusrace — closing setup returns focus to Guided setup when its replacement shows late or is redrawn (#282)
//   incomehelp — hourly basis, chart values and live edits, current scenario guidance, CSV exports and import review
//   propertyremaininghelp — loan/acquisition chart names and live patches, schedule help, descriptions and saves
//   propertyactionhelp — recording, move-to-loan and CSV help by touch/keyboard; recording, move, Undo and export
//   propertyfigurehelp — Property-card figure help by touch and keyboard, conditional explanations, live edits
//                 and redraws, independent cards and unchanged stored/visible figures
//   propertysummaryhelp — Property portfolio explanations by touch and keyboard, labelled chart figures,
//                 redraw stability and unchanged stored properties; empty households hide the summary
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
//   scenariocalcfields — the purchase and invest calculators on the shared field (#254): skin, 44px, 16px text and
//                 tied labels at 320–1280px in both themes; a click on a label focuses its field; the LMI quote reads whole
//   emptystates — #255 step 3: an empty household's empty states take you on — a link to the page and tab where the
//                 step is done, the page's own add, a scroll to the list it means — and a report says what it needs
//   firstrunpath — #309: "Start from scratch" to a household — one setup flow and one progress count at a time, sample
//                 data offered once, one way back into a skipped setup (after Reset too), no $0 cards or to-dos
//   setupfields — the first-run setup on the shared field (#254): every step at 320–1280px in both themes, a typed
//                 figure kept through a select's redraw, and the answers saved on Finish
//   scenariofields — the scenario editor on the shared field (#254): its name, note, quick-add row, every kind of
//                 change and the template questions, at 320–1280px in both themes; changed and unusual figures still show
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
//   rowimports  — the Budget, Income and Assets CSV imports (#265): reading with Cancel, a stale read dropped, each
//                 row's destination named, duplicates left out unless included, a deleted property or a replaced
//                 household reviewed again, an unsaved import taken back out, and Undo removing exactly its rows
//   pricepaste  — Shares' pasted prices (#265): read into a review first, nothing below zero, a quoted thousands
//                 figure read whole, conflicting or other-market lines left out, a stale review shown again,
//                 an unsaved update put back, and Undo restoring prices only while nothing has priced them since
//   restorebackup — restoring a backup (#265): checked before anything asks, the question says what the backup
//                 and this device hold, an empty backup named as one, an unsaved restore put back, and Undo
//   scenariosandbox — #392: a scenario's purchase says its piece on Plan → Scenarios only; Home → Insights, the bell
//                 and the household's emergency fund read the same with every scenario's purchase on or off
//   needstarget — #389: under a scenario's comparison, the take-home it would take for Needs to be the household's
//                 target share; the target is one setting, changed there or in Preferences, saved only when 1–100
//   yearreview  — #396: Reports → Year in review as guided sections with a verdict and a way there each; the household's
//                 year (calendar too); a Home card once a year has finished, opened or put away; an empty household
//   savingsoffset — #398: Year in review's savings account vs offset — asks for a cash account's rate, which is entered
//                 on Investments → Cash (0–25%, blank allowed), then compares it with the loan's offset after tax
//   nextyearplan — #399: Year in review's next year's plan — goals in priority order share one monthly surplus (the
//                 lower of the budget's and last year's kept); reordering moves the money; saving adds savings goals
//                 with their monthly amount, cancelling adds nothing
//   planprogress — #400: next year's plan each month — off by default (no review step, no bell item); turned on in
//                 Preferences, the review's plan step shows a goal behind with its catch-up, and the bell opens it there
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
let dropShellRequests = false, droppedShellRequests = 0;
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if(dropShellRequests && p === "/index.html"){ droppedShellRequests++; res.destroy(); return; }
  let file = path.join(root, p);
  if(!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, "index.html");
  res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const base = "http://127.0.0.1:" + server.address().port;
const TODAY = "2026-11-03T10:00:00";
const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const failures = [];
const STRESS_CPU = Number(process.env.JOURNEY_CPU) || 0;

function check(ok, what){ if(!ok) throw new Error(what); }
// A fresh phone-sized page on the sample household (or `stored`, a state to start from), the clock fixed.
async function fresh(opts){
  opts = opts || {};
  const ctx = await browser.newContext({ viewport: { width: opts.width || 390, height: 844 }, hasTouch: !!opts.touch, isMobile: !!opts.touch, serviceWorkers: opts.blockWorker ? "block" : "allow" });
  await ctx.addInitScript(([stored]) => {
    if(sessionStorage.getItem("journeyLoaded")) return;
    localStorage.setItem("wealthPlanner.hasSeenIntro", "1");
    // #339: a journey is someone who has been here before; the tour's own journey clears this to be asked.
    localStorage.setItem("wealthPlanner.tour", "skipped");
    // #414: everything on screen, as before Simple mode; the simplemode journey switches.
    localStorage.setItem("wealthPlanner.mode", "advanced"); localStorage.setItem("wealthPlanner.modeOffer", "done");
    if(stored) localStorage.setItem("wealthPlanner.v1", stored);
    sessionStorage.setItem("journeyLoaded", "1");
  }, [opts.stored || null]);
  await ctx.route(/fonts\.(googleapis|gstatic)\.com|docs\.google\.com|coingecko|frankfurter|dropboxapi|anthropic/, r => r.abort());
  if(opts.bankRead || opts.propertyReview){
    await ctx.route('**/src/lib/inbox.js*', r => {
      const source=fs.readFileSync(path.join(root,'src/lib/inbox.js'),'utf8');
      const probe=source.replace('export function listInbox(){', `export function listInbox(){
        return Promise.resolve(globalThis.__bankInboxMarked ? [] : [{name:'${opts.propertyReview ? 'Owner Example.pdf' : 'Inbox Example.csv'}',via:'journey',label:'Example folder'}]);
      }
      function journeyListInbox(){`).replace('export function readInboxFile(f){', `export function readInboxFile(f){
        if(f.via==='journey') return new Promise(function(resolve,reject){
          globalThis.__finishBankInbox=function(fail){
            if(fail) reject(new Error('Synthetic inbox open failure'));
            else resolve(globalThis.__propertyInboxFile || new File([globalThis.__bankInboxCsv], f.name, {type:'text/csv'}));
          };
        });`).replace('export function markInboxFileImported(f){', `export function markInboxFileImported(f){
        if(f.via==='journey'){globalThis.__bankInboxMarked=(globalThis.__bankInboxMarked||0)+1;return Promise.resolve();}`);
      return r.fulfill({contentType:'text/javascript',body:probe});
    });
    await ctx.route('**/src/lib/pdftext.js*', r => {
      const source=fs.readFileSync(path.join(root,'src/lib/pdftext.js'),'utf8');
      const probe=source.replace('export function pdfLines(data, pdfjs){', `export function pdfLines(data, pdfjs){
        if(!globalThis.__holdBankPdf) return journeyPdfLines(data,pdfjs);
        globalThis.__holdBankPdf=false;
        var parsed=journeyPdfLines(data,pdfjs);
        globalThis.__bankPdfReady=parsed.then(function(){return true;});
        return new Promise(function(resolve,reject){
          globalThis.__finishBankPdf=function(fail){return parsed.then(function(lines){
            if(fail) reject(new Error("Synthetic PDF extraction failure")); else resolve(lines);
          });};
        });
      }
      function journeyPdfLines(data, pdfjs){`);
      if(probe===source) throw new Error('Bank PDF probe no longer matches extraction boundary');
      return r.fulfill({contentType:'text/javascript',body:probe});
    });
  }
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
  // JOURNEY_CPU=6 slows every journey's page six times, the fixed clock kept — a slow CI runner on demand, for
  // finding the step a journey's timing depends on (#267). Off by default.
  else if(STRESS_CPU){ const cdp = await ctx.newCDPSession(page); await cdp.send("Emulation.setCPUThrottlingRate", { rate: STRESS_CPU }); }
  nameWaits(page);
  await page.goto(base + "/index.html" + (opts.query || (opts.stored ? "" : "?mock=1")));
  await page.waitForFunction(() => document.documentElement.hasAttribute("data-wp-ready") && document.querySelector(".app-page:not([hidden])"), null, { timeout: 60000 });
  // A journey starts once the app's startup reads (prices, the cash rate) are done, so none lands halfway through
  // it. The speed budget measures startup itself, so it doesn't wait.
  if(!opts.cpu) await waited(page, () => document.documentElement.hasAttribute("data-wp-settled"), "the app's startup reads to finish");
  await page.waitForTimeout(300);
  return { ctx, page, errors };
}
// A wait that times out says what it was waiting for. Playwright's own message is "Timeout 30000ms exceeded" and
// nothing else — all the datasafety failure on PR #318 said, with five waits it could have been.
function nameWaits(page){
  const wf = page.waitForFunction.bind(page);
  page.waitForFunction = (fn, arg, options) => wf(fn, arg, options).catch(e => {
    e.message = String(e.message).split("\n")[0] + " — waiting for: " + String(fn).replace(/\s+/g, " ").slice(0, 220);
    throw e;
  });
  return page;
}
const st = (page, expr) => page.evaluate(new Function("return import('/src/state.js').then(function(m){ var state = m.state; return (" + expr + "); })"));
// #269: what's in storage, as opposed to the tab's own copy; a second tab on the same household, settled (its own
// startup and refreshes done); a save made in a tab; a budget line's name typed in its editor, left or not.
const stored = (page, expr) => page.evaluate(new Function("var state = JSON.parse(localStorage.getItem('wealthPlanner.v1')); return (" + expr + ");"));
async function secondTab(page){
  const other = nameWaits(await page.context().newPage());
  await other.goto(base + "/index.html");
  // Its startup and its reads done, by the app's own word. (This waited on Playwright's "networkidle", which three
  // times in some 150 runs never arrived: 249 requests made, none in flight, thirty seconds, time out.)
  await ready(other, "the second tab");
  await settle(other);
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
// The page at rest before a step reads a saved figure to compare against later: the app's startup reads are done
// (data-wp-settled), then a frame for what they drew. The day's price read starts 800ms after startup and, when it
// lands, legitimately changes a holding's saved price — a journey that had already read its "before" then saw "a
// negative price saved 113.35" (PR #317: the price file's figure, not the -3 it typed).
async function quiet(page){
  await ready(page, "the app at rest");
  await settle(page);
}
// A wait named for what the step needs, rather than for its code (nameWaits does that for the rest).
const waited = (page, fn, what, arg) => page.waitForFunction(fn, arg, { timeout: 30000 }).catch(e => { throw new Error("timed out waiting for " + what + " (" + String(e.message).split("\n")[0] + ")"); });
// Under emulated touch Chrome can move the page between a tap's touch and its click when the target was only just
// scrolled into view beside the sticky headers, and the click lands on what moved there (incomehelp, taxhelp). Centred
// and still first, as a person taps what's in front of them.
const pageStill = page => page.evaluate(() => new Promise(r => { let last = scrollY, same = 0; (function f(){ if(scrollY === last) same++; else { same = 0; last = scrollY; } if(same >= 30) r(); else requestAnimationFrame(f); })(); }));
async function steadyTap(page, locator){ await pageStill(page); await locator.evaluate(el => el.scrollIntoView({ block: 'center' })); await pageStill(page); await locator.tap(); }
// The app loaded and its startup reads finished — after a load, a reload, or in a tab just opened.
// documentElement is null for a moment while a reload swaps the document: that is "not yet", not a failure.
const ready = (page, what) => waited(page, () => !!document.documentElement && document.documentElement.hasAttribute("data-wp-ready") && document.documentElement.hasAttribute("data-wp-settled"), what);
// Until fn (run in the page, with arg) is true, up to 10s. It doesn't fail by itself: the step's own check after it
// says what was wrong.
const until = (page, fn, arg) => page.waitForFunction(fn, arg, { timeout: 10000 }).catch(() => {});
// The same from this side: until test() (async, here) is true, up to 10s, polling every 100ms.
async function eventually(test){ for(let t0 = Date.now(); Date.now() - t0 < 10000; await new Promise(r => setTimeout(r, 100))) if(await test()) return; }
// #413: Investments → Summary's purchase funding, allocation and history are under Net worth's list, folded.
// "Net worth if you buy" is on Plan → Scenarios (it was under Accounts' list): there, opened.
async function goPurchaseFunding(page){
  await go(page, 'plan', 'data-plan-sub', 'scenarios');
  await page.evaluate(() => { document.getElementById('purchaseFundingCard').open = true; });
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
}
async function goNetWorthMore(page){
  await go(page, 'networth');
  await page.evaluate(() => document.querySelectorAll('#netWorthMore > details').forEach(d => { d.open = true; }));
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
}
// #415: bills to confirm open from their To do (the bell, Home, a page's line), not a header button.
async function openBillsToConfirm(page){
  await page.evaluate(() => [...document.querySelectorAll('.notif-bell-btn')].find(b => b.getClientRects().length).click());
  await page.locator('#notifPanel [data-notif-action="catchup"]').first().click();
  await page.locator('#expenseReviewRoot .review-panel').waitFor();
}
async function go(page, pageId, subAttr, sub){
  // #427: Income is no tab — Money in is the top of Budget, where every Income link lands.
  if(pageId === 'expenses' && sub === 'income'){
    await go(page, 'expenses', 'data-expenses-sub', 'budget');
    await page.evaluate(() => document.getElementById('moneyIn').scrollIntoView({ block: 'start' }));
    return;
  }
  if(pageId === 'reports' && subAttr === 'data-report'){
    await go(page, 'reports');
    await page.locator('#reportsBody [data-report-choose]').first().click();
    await page.locator('.report-chooser [data-report="' + sub + '"]').click();
    await page.waitForFunction(key => !!document.querySelector('[data-current-report="' + key + '"]') && !document.querySelector('.report-chooser'), sub);
    await settle(page); return;
  }
  // #412: Today has no tab rail — its views open from links on it — so they are chosen through nav.js.
  if(subAttr === 'data-dashboard-sub'){
    await page.evaluate(async s => { const b = document.querySelector('[data-page="dashboard"]'); b.click(); (await import('/src/components/nav.js')).showDashboardSubpage(s); }, sub);
    await page.waitForFunction(s => document.body.getAttribute("data-current-page") === "dashboard" && !document.getElementById("dashboardSub-" + s).hidden, sub, { timeout: 10000 });
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    return;
  }
  // Investments' sections have no buttons: Accounts' chips are the one switcher, and each group's heading opens its page.
  if(subAttr === 'data-assets-sub'){
    await page.evaluate(async s => { const n = await import('/src/components/nav.js'); n.showPage('assets'); n.showAssetsSubpage(s); }, sub);
    await page.waitForFunction(s => document.body.getAttribute("data-current-page") === "assets" && !document.getElementById("assetsSub-" + s).hidden, sub, { timeout: 10000 });
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    return;
  }
  // #428: Bank accounts, Investments and Property have no button of their own (they're behind Accounts' list), so
  // they're opened through nav.js as Details → Manage, + and search do.
  await page.evaluate(async ([p, a, s]) => { const b = document.querySelector('.mobile-tab[data-page="' + p + '"]') || document.querySelector('[data-page="' + p + '"]');
    if(b) b.click(); else (await import('/src/components/nav.js')).showPage(p);
    if(a) setTimeout(() => document.querySelector("[" + a + '="' + s + '"]').click(), 50); }, [pageId, subAttr, sub]);
  // The page, and its subtab, showing — then a frame for what they draw.
  await page.waitForFunction(([p, a, s]) => document.body.getAttribute("data-current-page") === p &&
    (!a || !!document.querySelector("[" + a + '="' + s + '"]:is(.active, [aria-selected="true"], [aria-current="page"], [aria-current="true"])')),
    [pageId, subAttr, sub], { timeout: 10000 });
  await settle(page);
}
// "Guided setup", and if the click can't land, what was in its way. On PR #311 it timed out behind setup's own
// backdrop, and the log couldn't say whether setup was already open or hadn't finished closing (#282).
// An empty household, loaded the way "Start from scratch" opens it. The app is left first, for a plain file on the same
// site: a save the sample household still had pending (the activity log's, a second after its last change) landed after
// the storage was cleared and before the reload, and the "empty" household loaded with everything in it.
async function emptyHousehold(page){
  await page.goto(base + '/styles.css');
  await page.evaluate(() => { localStorage.removeItem('wealthPlanner.v1'); localStorage.setItem('wealthPlanner.tour', 'skipped'); });
  await page.goto(base + '/index.html');
  await ready(page, 'an empty household');
  // It opens by itself on an empty household: if it doesn't, say what the household had.
  await page.waitForSelector('#firstRunRoot [role="dialog"]', { timeout: 15000 }).catch(async () => {
    throw new Error('the empty household opened no setup: ' + JSON.stringify(await page.evaluate(async () => { const m = await import('/src/state.js'), f = await import('/src/components/firstrun.js');
      return { income: m.state.income.length, shared: m.state.shared.length, accounts: (m.state.accounts || []).length, assets: m.state.assets.length, done: m.state.firstRunDone, skipped: m.state.firstRunSkipped,
        open: f.firstRun.open, pending: f.firstRun.pending, stored: (localStorage.getItem('wealthPlanner.v1') || '').length, page: document.body.getAttribute('data-current-page'), dialogs: document.querySelectorAll('.app-dialog').length }; })));
  });
}
// #309: how many progress counts are on screen — "Step 1 of 5", "step 1 of 4", "0 of 5 sections" — with their words.
const progressCounts = page => page.evaluate(() => {
  const seen = [];
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for(let n = walk.nextNode(); n; n = walk.nextNode()){
    const el = n.parentElement;
    if(!el || !el.getClientRects().length || el.closest('[hidden], [aria-hidden="true"], .visually-hidden') || getComputedStyle(el).visibility === 'hidden') continue;
    (n.textContent.match(/\b(step \d+ of \d+|\d+ of \d+ sections)\b/gi) || []).forEach(m => seen.push(m));
  }
  return seen;
});
// `which` names the click in the journey (#282 asked which of onboardingaudit's two it was), and the failure says
// how many overlays the app holds open: its sheet-or-panel slot, an app question, and dialogs on screen.
async function openSetup(page, which){
  await page.locator('#dashboardSetup [data-firstrun-open]').click().catch(async e => {
    const seen = await page.evaluate(async () => { const d = document.querySelector('#firstRunRoot [role="dialog"]');
      const o = await import('/src/lib/overlaystack.js'), q = await import('/src/lib/dialogs.js');
      return "setup dialog " + (d ? "open (" + ((d.innerText.match(/Step \d of \d/) || ["no step shown"])[0]) + ")" : "not open") +
        "; backdrop " + (document.querySelector("#firstRunRoot .review-backdrop") ? "present" : "gone") +
        "; overlays: active " + o.overlayOpen() + ", app question " + q.dialogOpen() + ", on screen " +
          [...document.querySelectorAll('dialog[open], [role="dialog"]:not([hidden])')].filter(el => el.getClientRects().length).length +
        "; history.state " + JSON.stringify(history.state) + "; page " + document.body.getAttribute("data-current-page") +
        "; focus " + (document.activeElement ? document.activeElement.tagName + (document.activeElement.id ? "#" + document.activeElement.id : "") : "none"); }).catch(() => "page not readable");
    throw new Error("Guided setup could not be clicked" + (which ? " (" + which + ")" : "") + " — " + seen + " — " + String(e.message).split("\n")[0]);
  });
}
// Clicks the first match, once there is one (up to 10s) — a step's target can arrive after a redraw.
const click = async (page, sel) => {
  await page.waitForSelector(sel, { state: "attached", timeout: 10000 }).catch(() => {});
  return page.evaluate(s => { const el = document.querySelector(s); if(!el) throw new Error("No " + s); el.click(); }, sel);
};

// App questions are asynchronous DOM dialogs. Drive their controls rather than bypassing approval.
let dialogSeq = 0;
async function answerDialog(page, accept, value){
  const dialog = page.locator('.app-dialog');
  await dialog.waitFor({state:'visible'});
  // This dialog, not "a dialog": when one question follows another (a passphrase, then a confirmation) the next is
  // on screen before a wait for '.app-dialog' to go can look, and it waited out thirty seconds on the wrong one
  // (taximporterrors, under load — #267). So the one being answered is tagged, and the wait is for the tag to go:
  // true when it closes, and when its answer reloads the page ("Reload latest").
  const tag = "d" + (++dialogSeq);
  await dialog.evaluate((d, t) => d.setAttribute("data-journey-dialog", t), tag);
  const self = page.locator('.app-dialog[data-journey-dialog="' + tag + '"]');
  if(value !== undefined){
    await self.locator('#appDialogInput').fill(value);
    if(await self.locator('#appDialogRepeat').count()) await self.locator('#appDialogRepeat').fill(value);
  }
  await self.locator(accept ? '[data-dialog-submit]' : '[data-dialog-cancel]').click();
  await page.waitForFunction(t => !document.querySelector('.app-dialog[data-journey-dialog="' + t + '"]'), tag, { timeout: 30000 })
    .catch(e => { if(/Timeout/.test(String(e.message))) throw new Error("the app dialog did not close after " + (accept ? "accepting" : "cancelling") + " it"); });
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
  async savingsoffset(page){
    // Synthetic demo household: cash accounts with no rate yet, and an investment loan with an offset.
    await quiet(page);
    await go(page, 'reports', 'data-report', 'review');
    const em = page.locator('[data-yr-section="emergency"]');
    await em.locator('.yr-offset').waitFor();
    let t = await em.innerText();
    check(/Savings account or offset\?/.test(t) && /offset saves [\d.]+% a year after tax/.test(t), 'the offset comparison is missing: ' + t.slice(0, 200));
    check(/No interest rate on .*Everyday Account/.test(t), 'accounts without a rate are not listed');
    const link = em.locator('.yr-offset [data-go="assets/Cash"]');
    check(await link.count() === 1, 'no way to where a rate is entered');
    await link.click();
    await waited(page, () => document.body.dataset.currentPage === 'assets', 'Investments → Cash');
    // Enter a rate on the first cash account — out of range first, then a real one.
    const row = page.locator('#assetsSub-Cash .m-row').filter({ hasText: 'Everyday Account' }).first();
    await row.locator('[data-row-toggle]').first().click();
    const rate = row.locator('input.a-rate');
    await rate.waitFor({ state: 'visible' });
    check(await page.locator('label[for="' + await rate.getAttribute('id') + '"]').innerText() === 'Interest rate', 'the rate field is not labelled');
    await rate.fill('30');
    await waited(page, () => document.querySelector('#assetsSub-Cash input.a-rate[aria-invalid="true"]'), 'the out-of-range message');
    check(await stored(page, "state.assets.find(a => a.what === 'Everyday Account').interestRate") == null, 'a 30% rate was saved');
    await rate.fill('4.5');
    await eventually(async () => await stored(page, "state.assets.find(a => a.what === 'Everyday Account').interestRate") === 4.5);
    check(await stored(page, "state.assets.find(a => a.what === 'Everyday Account').interestRate") === 4.5, 'the rate was not saved');
    await rate.fill('');
    await eventually(async () => await stored(page, "'interestRate' in state.assets.find(a => a.what === 'Everyday Account')") === false);
    check(await stored(page, "'interestRate' in state.assets.find(a => a.what === 'Everyday Account')") === false, 'clearing the rate did not remove it');
    await rate.fill('4.5');
    await eventually(async () => await stored(page, "state.assets.find(a => a.what === 'Everyday Account').interestRate") === 4.5);
    // The review now compares it.
    await go(page, 'reports', 'data-report', 'review');
    t = await page.locator('[data-yr-section="emergency"]').innerText();
    check(/Everyday Account \(\$[\d,]+\) earns 4\.5%, [\d.]+% after the household's tax: about \$[\d,]+ a year\. In the offset it would save about \$[\d,]+ — (\$[\d,]+ a year (more|less)|about the same)\./.test(t), 'the account is not compared: ' + t.slice(0, 400));
    check(!/NaN|Infinity|undefined/.test(t), 'the comparison shows NaN');
    for(const width of [320, 390, 768, 1280]){
      await page.setViewportSize({ width, height: 844 }); await settle(page);
      check(!await page.locator('.yr-offset').evaluate((e, w) => e.getBoundingClientRect().right > w + 1 || document.documentElement.scrollWidth > w + 1, width), 'the comparison overflows at ' + width);
    }
  },

  async yearreview(page){
    // Synthetic demo household, the journeys' fixed date (3 November 2026): the year looked back on is FY25/26.
    await quiet(page);
    await go(page, 'reports', 'data-report', 'review');
    const sheet = page.locator('#reportSheet');
    const sections = sheet.locator('[data-yr-section]');
    check(await sections.count() === 7, 'not seven sections: ' + await sections.count());
    check(JSON.stringify(await sections.evaluateAll(els => els.map(e => e.getAttribute('data-yr-section')))) === JSON.stringify(['money', 'networth', 'leaks', 'emergency', 'goals', 'checking', 'plan']), 'sections out of order');
    const text = await sheet.innerText();
    check(/1 July 2025 to 30 June 2026/.test(text), 'not the financial year: ' + text.slice(0, 120));
    check(!/NaN|Infinity|undefined/.test(text), 'the review shows NaN');
    check(/came in and .* was spent/.test(await sheet.locator('[data-yr-section="money"]').innerText()), 'where the money went has no verdict');
    // Every section either has its verdict and a way there, or says what fills it — with a control.
    for(const key of ['money', 'networth', 'leaks', 'emergency', 'goals']){
      const sec = sheet.locator('[data-yr-section="' + key + '"]');
      check(await sec.locator('[data-go]').count() >= 1, key + ' has no way to where it is acted on');
    }
    const links = sheet.locator('[data-yr-section="checking"] a');
    check(await links.count() === 3, 'worth checking links missing');
    check(await links.evaluateAll(as => as.every(a => a.target === '_blank' && /noopener/.test(a.rel) && /^https:\/\/(moneysmart|www\.ato|www\.servicesaustralia)\.gov\.au\//.test(a.href))), 'a worth-checking link is not an official site opened safely');
    check(await sheet.locator('details.yr-figures summary').count() === 1, 'the figures fold is missing');
    // #397: how the year adds up — kept, and where it went, with what's unaccounted shown, not hidden.
    const recon = sheet.locator('[data-yr-section="money"] details.yr-recon');
    await recon.locator('summary').click();
    const rt = await recon.innerText();
    check(/Money in/.test(rt) && /Kept/.test(rt) && /Cash and savings/.test(rt) && /Loans (paid down|borrowed)|Borrowed on loans/.test(rt) && /Shares (bought|sold)/.test(rt) && /Unaccounted/.test(rt), 'how it adds up is incomplete: ' + rt.slice(0, 200));
    check(/Loan interest and fees/.test(rt), 'the loan\'s interest is not taken off');
    check(!/NaN|Infinity|\d{4}-\d{2}-\d{2}/.test(rt), 'how it adds up shows NaN or a raw date');
    const nums = await recon.evaluate(el => [...el.querySelectorAll('.yr-recon-lines dd')].map(d => Number(d.textContent.replace(/[^0-9.−-]/g, '').replace('−', '-'))));
    check(nums.length >= 8, 'how it adds up has too few lines');
    // A section's way there goes there.
    await sheet.locator('[data-yr-section="leaks"] [data-go]').click();
    await waited(page, () => document.body.dataset.currentPage === 'expenses' && !!document.querySelector('[data-expenses-sub="budget"].active, [data-expenses-sub="budget"][aria-current]'), 'Budget, where Trim is');
    // A calendar-year household looks back on a calendar year.
    await page.evaluate(async () => { const m = await import('/src/state.js'); m.state.yearBasis = 'calendar'; m.commit(['yearBasis']); });
    await go(page, 'reports', 'data-report', 'review');
    check(/1 January to 31 December 2025/.test(await page.locator('#reportSheet').innerText()), 'a calendar-year household still sees a financial year');
    await page.evaluate(async () => { const m = await import('/src/state.js'); m.state.yearBasis = 'financial'; m.commit(['yearBasis']); });
    // Four widths, both themes.
    await go(page, 'reports', 'data-report', 'review');
    if(process.env.YEAR_A11Y){ const axe = await import('axe-core'); await page.evaluate(axe.default.source); }
    for(const width of [320, 390, 768, 1280]) for(const theme of ['light', 'dark']){
      await page.setViewportSize({ width, height: 844 }); await page.evaluate(t => document.documentElement.dataset.theme = t, theme); await settle(page);
      check(!await page.locator('.yr-sections').evaluate((e, w) => e.getBoundingClientRect().right > w + 1 || document.documentElement.scrollWidth > w + 1, width), 'year in review overflows at ' + width + '/' + theme);
      if(process.env.YEAR_A11Y){
        const v = await page.locator('.yr-sections').evaluate(async el => (await window.axe.run(el, { preload: false })).violations.map(x => ({ id: x.id, nodes: x.nodes.map(n => n.failureSummary) })));
        check(!v.length, 'year in review accessibility ' + width + '/' + theme + ': ' + JSON.stringify(v));
      }
    }
    await page.setViewportSize({ width: 390, height: 844 }); await page.evaluate(() => delete document.documentElement.dataset.theme);
    // Mid-August: the year has just finished. Home has the card, not a To do; the bell has it too.
    const august = async () => { const c = await fresh(); await c.page.clock.setFixedTime(new Date('2026-08-15T10:00:00')); await c.page.reload(); await ready(c.page, 'the app in August'); await settle(c.page); return c; };
    const a = await august();
    try{
      const p = a.page; await go(p, 'dashboard');
      const card = p.locator('[data-home-card="yearreview"]');
      await card.waitFor();
      check(/Your FY25\/26 in review is ready/.test(await card.textContent()), 'the card does not name the year: ' + await card.textContent());
      check(!/in review is ready/.test(await p.locator('[data-home-card="needs"]').innerText()), 'the year in review is in Home\'s Needs you as well as its card');
      await card.locator('[data-yr-open]').click();
      await waited(p, () => document.body.dataset.currentPage === 'reports' && !!document.querySelector('[data-current-report="review"]'), 'the review opened from Home');
      await go(p, 'dashboard');
      check(await p.locator('[data-home-card="yearreview"]').count() === 0, 'the card stayed after the review was opened');
      check(!a.errors.length, 'August errors: ' + a.errors.join('; '));
    } finally { await a.ctx.close(); }
    const b = await august();
    try{
      const p = b.page; await go(p, 'dashboard');
      await p.locator('[data-home-card="yearreview"] [data-yr-dismiss]').click();
      await waited(p, () => !document.querySelector('[data-home-card="yearreview"]'), 'the card put away');
      check(await p.evaluate(async () => (await import('/src/lib/notifications.js')).getNotifications().find(n => n.type === 'yearreview').read === true), 'putting the card away did not mark the bell\'s item read');
    } finally { await b.ctx.close(); }
    // An empty household: every section says what fills it, with a way there.
    await emptyHousehold(page);
    await page.locator('#firstRunRoot [data-fr-close]').click().catch(() => {});
    await go(page, 'reports', 'data-report', 'review');
    for(const key of ['money', 'networth', 'leaks', 'emergency', 'goals']){
      const sec = page.locator('[data-yr-section="' + key + '"]');
      check(await sec.locator('.empty-state').count() === 1 && await sec.locator('.empty-state [data-go]').count() === 1, key + ' in an empty household does not say what fills it');
      check(!/\$0\b/.test(await sec.innerText()), key + ' shows $0 in an empty household');
    }
  },

  async nextyearplan(page){
    // Synthetic demo household, the journeys' fixed date.
    await quiet(page);
    await go(page, 'reports', 'data-report', 'review');
    const sec = page.locator('[data-yr-section="plan"]');
    const goalsBefore = await page.evaluate(async () => (await import('/src/state.js')).state.savingsGoals.length);
    await sec.locator('[data-plan-start]').click();
    await sec.locator('[data-plan-goal]').first().waitFor();
    check(await page.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-plan-field')) === 'kind', 'starting the plan did not put focus on its first goal');
    const surplusText = await sec.locator('.nyp-surplus').textContent();
    check(/a month to share/.test(surplusText) && /(budget's regular surplus|actually kept last year)/.test(surplusText), 'the surplus does not say where it comes from: ' + surplusText);
    const surplus = await page.evaluate(async () => (await import('/src/calc/nextyearplan.js')).planSurplus((await import('/src/lib/format.js')).localDateStr(), {}).monthly);
    check(surplus > 0, 'the demo household has no surplus to share');
    // Two save goals, each bigger than the surplus on its own, so only the first can be funded.
    const fill = async (n, name, amount) => {
      const g = sec.locator('[data-plan-goal]').nth(n);
      await g.locator('[data-plan-field="kind"]').selectOption('save');
      await sec.locator('[data-plan-goal]').nth(n).locator('[data-plan-field="name"]').fill(name);
      await sec.locator('[data-plan-goal]').nth(n).locator('[data-plan-field="name"]').press('Tab');
      await sec.locator('[data-plan-goal]').nth(n).locator('[data-plan-field="amount"]').fill(String(amount));
      await sec.locator('[data-plan-goal]').nth(n).locator('[data-plan-field="amount"]').press('Tab');
      const acct = sec.locator('[data-plan-goal]').nth(n).locator('[data-plan-field="account"]');
      const first = await acct.locator('option').nth(1).getAttribute('value');
      await acct.selectOption(first);
    };
    const big = Math.ceil(surplus * 8 / 100) * 100;  // about 8 months' surplus by the end of a year: more than it all
    await fill(0, 'Trip A', big);
    await sec.locator('[data-plan-add]').click();
    await fill(1, 'Car B', big);
    const statuses = async () => sec.locator('[data-plan-goal]').evaluateAll(els => els.map(e => [e.querySelector('[data-plan-field="name"]').value, e.className.match(/nyp-(\w+)$/)[1]]));
    let st = await statuses();
    check(JSON.stringify(st.map(x => x[0])) === '["Trip A","Car B"]', 'goals not in the order added: ' + JSON.stringify(st));
    check(['funded', 'partial'].includes(st[0][1]) && ['partial', 'unfunded'].includes(st[1][1]), 'the first goal is not funded first: ' + JSON.stringify(st));
    const t1 = await sec.locator('[data-plan-goal]').nth(1).locator('.nyp-status').textContent();
    check(/Needs \$[\d,]+ a month to get there by \d+ \w+ \d{4}/.test(t1), 'a goal does not say what it needs: ' + t1);
    check(!/NaN|Infinity|undefined|\d{4}-\d{2}-\d{2}/.test(await sec.textContent()), 'the plan shows NaN or a raw date');
    // Moving the second up moves the money with it.
    await sec.locator('[data-plan-goal]').nth(1).locator('[data-plan-move="-1"]').click();
    st = await statuses();
    check(st[0][0] === 'Car B' && ['funded', 'partial'].includes(st[0][1]) && st[1][0] === 'Trip A' && st[1][1] !== 'funded', 'moving a goal up did not move the money: ' + JSON.stringify(st));
    check(await page.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-plan-move')) !== null, 'focus left the move button');
    const left = await sec.locator('.nyp-sum .yr-recon-total dd').textContent();
    check(left.trim() === '$0', 'all of the surplus is not shared out: ' + left);
    // An incomplete goal is said, and not saved.
    await sec.locator('[data-plan-add]').click();
    await sec.locator('[data-plan-goal]').nth(2).locator('[data-plan-field="kind"]').selectOption('debt');
    check(/Choose the card or loan/.test(await sec.locator('[data-plan-goal]').nth(2).locator('.nyp-status').textContent()), 'an incomplete goal does not say what it needs');
    // Four widths, both themes.
    if(process.env.YEAR_A11Y){ const axe = await import('axe-core'); await page.evaluate(axe.default.source); }
    for(const width of [320, 390, 768, 1280]) for(const theme of ['light', 'dark']){
      await page.setViewportSize({ width, height: 844 }); await page.evaluate(t => document.documentElement.dataset.theme = t, theme); await settle(page);
      check(!await sec.evaluate((e, w) => e.getBoundingClientRect().right > w + 1 || document.documentElement.scrollWidth > w + 1, width), 'the plan overflows at ' + width + '/' + theme);
      if(process.env.YEAR_A11Y){
        const v = await sec.evaluate(async el => (await window.axe.run(el, { preload: false })).violations.map(x => ({ id: x.id, nodes: x.nodes.map(n => n.failureSummary) })));
        check(!v.length, 'the plan accessibility ' + width + '/' + theme + ': ' + JSON.stringify(v));
      }
    }
    await page.setViewportSize({ width: 390, height: 844 }); await page.evaluate(() => delete document.documentElement.dataset.theme);
    // Cancel adds nothing; the plan starts afresh.
    await sec.locator('[data-plan-cancel]').click();
    await sec.locator('[data-plan-start]').waitFor();
    check(await page.evaluate(async () => (await import('/src/state.js')).state.savingsGoals.length) === goalsBefore, 'cancelling added goals');
    // Save: the complete goals become savings goals, with what the plan gave each a month and the year.
    await sec.locator('[data-plan-start]').click();
    await fill(0, 'Trip A', big);
    const given = await page.evaluate(async () => { const c = await import('/src/components/nextyearplan.js'); const r = c.currentPlan((await import('/src/lib/format.js')).localDateStr(), {}).plan.rows[0]; return r.given; });
    await sec.locator('[data-plan-save]').click();
    await sec.locator('[data-plan-start]').waitFor();
    const saved = await page.evaluate(async () => (await import('/src/state.js')).state.savingsGoals.slice(-1)[0]);
    check(saved.name === 'Trip A' && saved.target === big && saved.plannedMonthly === given && /^FY\d{2}\/\d{2}$/.test(saved.planYear), 'the saved goal is wrong: ' + JSON.stringify(saved));
    check(await page.evaluate(async () => (await import('/src/state.js')).state.savingsGoals.length) === goalsBefore + 1, 'saving did not add one goal');
    await go(page, 'plan', 'data-plan-sub', 'goals');
    check(/Trip A/.test(await page.locator('#page-plan').innerText()), 'the saved goal is not on Goals');
  },

  async planprogress(page){
    // Synthetic demo household, the journeys' fixed date (3 November 2026). A goal saved from the plan on 1 August,
    // $1,000 a month on an account whose balance hasn't moved since: three months in, it's $3,000 behind.
    await quiet(page);
    const acct = await page.evaluate(async () => {
      const m = await import('/src/state.js'), a = await import('/src/calc/accounts.js');
      const pick = m.state.accounts.find(x => x.type === 'savings' && a.accountBalance(x).balance != null) || m.state.accounts.find(x => x.type !== 'credit' && x.type !== 'loan' && x.type !== 'agent' && a.accountBalance(x).balance != null);
      const b = a.accountBalance(pick).balance;
      m.state.savingsGoals.push({ id: 'sgplan', name: 'Trip A', target: b + 12000, by: '2027-08-01', accounts: [pick.name], plannedMonthly: 1000, planYear: 'FY26/27', planFrom: '2026-08-01', planStart: b });
      m.commit(['savingsGoals']);
      return { name: pick.name, off: m.state.planCheckIn };
    });
    check(acct.off === false, 'the plan check-in is not off by default');
    const reviewSteps = async () => {
      await go(page, 'dashboard', 'data-dashboard-sub', 'review');
      if(await page.locator('[data-mr-intro-ok]').isVisible()) await page.locator('[data-mr-intro-ok]').click();
      return page.locator('#monthReviewBody .mr-step-dot').evaluateAll(els => els.map(e => e.getAttribute('aria-label')));
    };
    const planNotes = () => page.evaluate(async () => (await import('/src/lib/notifications.js')).getNotifications().filter(n => n.type === 'planprogress').length);
    // Off: nothing shows.
    check(!(await reviewSteps()).some(l => /plan on track/.test(l)), 'the review has a plan step with the check-in off');
    check(await planNotes() === 0, 'the bell has a plan item with the check-in off');
    // On, in Preferences.
    await go(page, 'settings', 'data-accounts-sub', 'preferences');
    const box = page.locator('#planCheckInPref [data-plan-checkin]');
    check(!await box.isChecked(), 'the setting shows on before it was turned on');
    await box.check();
    check(await page.evaluate(async () => (await import('/src/state.js')).state.planCheckIn) === true, 'turning it on did not save');
    const steps = await reviewSteps();
    check(steps.length === 6 && /Step 5: Is the plan on track\?/.test(steps[4]), 'no plan step before the summary: ' + JSON.stringify(steps));
    await page.locator('#monthReviewBody [data-mr-to="4"]').first().click();
    const body = page.locator('#monthReviewBody .mr-stepcard');
    await waited(page, () => /Is the plan on track/.test(document.querySelector('#monthReviewBody .mr-stepcard h3').textContent), 'the plan step');
    const t = await body.textContent();
    check(/Trip A/.test(t) && /Behind/.test(t) && /\$3,0\d\d short/.test(t), 'the goal is not shown about $3,000 behind: ' + t.slice(0, 300));
    check(/To catch up: put \$[\d,]+ a month toward it from now/.test(t) && /at the pace so far it doesn't get there/.test(t), 'no catch-up suggestion: ' + t.slice(0, 400));
    check(/As of today, 3 Nov 2026/.test(t), 'not as of today');
    check(!/NaN|Infinity|undefined|\d{4}-\d{2}-\d{2}/.test(t), 'the plan step shows NaN or a raw date');
    // The bell: one item, which opens the review at the plan step.
    check(await planNotes() === 1, 'the bell has no plan item for a goal behind');
    await go(page, 'plan', 'data-plan-sub', 'goals');
    await page.locator('.notif-bell-btn:visible').first().click();
    const panel = page.locator('#notifPanel'); await panel.waitFor();
    await panel.locator('[data-notif-id^="planprogress:"]').click();
    await waited(page, () => document.body.dataset.currentPage === 'dashboard' && /Is the plan on track/.test((document.querySelector('#monthReviewBody .mr-stepcard h3') || {}).textContent || ''), 'the bell opened the plan step');
    // Four widths, both themes.
    if(process.env.YEAR_A11Y){ const axe = await import('axe-core'); await page.evaluate(axe.default.source); }
    for(const width of [320, 390, 768, 1280]) for(const theme of ['light', 'dark']){
      await page.setViewportSize({ width, height: 844 }); await page.evaluate(t => document.documentElement.dataset.theme = t, theme); await settle(page);
      check(!await body.evaluate((e, w) => e.getBoundingClientRect().right > w + 1 || document.documentElement.scrollWidth > w + 1, width), 'the plan step overflows at ' + width + '/' + theme);
      if(process.env.YEAR_A11Y){
        const v = await body.evaluate(async el => (await window.axe.run(el, { preload: false })).violations.map(x => ({ id: x.id, nodes: x.nodes.map(n => n.failureSummary) })));
        check(!v.length, 'the plan step accessibility ' + width + '/' + theme + ': ' + JSON.stringify(v));
      }
    }
    await page.setViewportSize({ width: 390, height: 844 }); await page.evaluate(() => delete document.documentElement.dataset.theme);
    // Off again: gone from both.
    await go(page, 'settings', 'data-accounts-sub', 'preferences');
    await page.locator('#planCheckInPref [data-plan-checkin]').uncheck();
    check(!(await reviewSteps()).some(l => /plan on track/.test(l)), 'the plan step stayed after turning it off');
    check(await planNotes() === 0, 'the bell kept its plan item after turning it off');
  },

  async needstarget(page){
    // Synthetic demo household; a scenario that buys a home.
    await quiet(page);
    const openBuy = async () => {
      await go(page, 'plan', 'data-plan-sub', 'scenarios');
      const name = await page.locator('#cards .card').filter({ hasText: /buy/i }).first().locator('.card-edit-link[data-edit-scenario]').getAttribute('data-edit-scenario');
      await click(page, '#cards .card-edit-link[data-edit-scenario="' + name + '"]');
      await waited(page, () => document.body.dataset.currentPage === 'scenario', 'the scenario editor');
      await page.locator('.needs-target').waitFor();
      return name;
    };
    const name = await openBuy();
    const block = page.locator('.needs-target');
    const text = await block.innerText();
    check(/Take-home for Needs at 50%/.test(text), 'the default target is not 50%: ' + text.slice(0, 120));
    check(text.includes(name) && /Current \/ baseline/.test(text), 'baseline and scenario are not both shown');
    check(/Needs are \$[\d,]+\/mo, [\d.]+% of \$[\d,]+\/mo take-home/.test(text), 'Needs and their share of take-home are not said');
    check(!/NaN|Infinity|undefined/.test(text), 'the block shows NaN/Infinity');
    // Its figures are the comparison's own: Needs and take-home match the rings above.
    const figures = await page.evaluate(async n => { const e = await import('/src/calc/engine.js'); const c = e.scenarioBudgetComposition(n); return { needs: Math.round(c.needs), income: Math.round(c.income) }; }, name);
    const money = v => '$' + v.toLocaleString('en-AU');
    check(text.includes(money(figures.needs) + '/mo') && text.includes(money(figures.income) + '/mo take-home'), 'the figures are not the comparison\'s: ' + JSON.stringify(figures));
    // Change the target here: saved, the block says the new target, and Preferences shows it.
    const field = block.locator('[data-needs-target]');
    await field.fill('60'); await field.press('Enter'); await field.dispatchEvent('change');
    await waited(page, () => /Take-home for Needs at 60%/.test(document.querySelector('.needs-target')?.innerText || ''), 'the block at 60%');
    check(await stored(page, 'state.needsTarget') === 60, 'the target was not saved');
    // Out of range: said beside the field, nothing saved.
    const again = page.locator('.needs-target [data-needs-target]');
    await again.fill('0'); await again.dispatchEvent('change');
    await waited(page, () => document.querySelector('.needs-target [data-needs-target]')?.getAttribute('aria-invalid') === 'true', 'the out-of-range message');
    check(/from 1 to 100/.test(await page.locator('.needs-target .field-error').innerText()) && await stored(page, 'state.needsTarget') === 60, 'an out-of-range target was saved or not explained');
    await go(page, 'settings', 'data-accounts-sub', 'preferences');
    const pref = page.locator('#needsTargetPref [data-needs-target]');
    await pref.waitFor();
    check(await pref.inputValue() === '60', 'Preferences does not show the saved target');
    check(await page.locator('label[for="needsTargetPrefInput"]').innerText() === 'Needs at most', 'Preferences\' field is not labelled');
    await pref.fill('50'); await pref.dispatchEvent('change');
    await eventually(async () => await stored(page, 'state.needsTarget') === 50);
    check(await stored(page, 'state.needsTarget') === 50, 'Preferences did not save the target');
    await openBuy();
    check(/Take-home for Needs at 50%/.test(await page.locator('.needs-target').innerText()), 'the scenario does not follow Preferences');
    // Four widths, both themes: nothing wider than the page.
    if(process.env.NEEDS_A11Y){ const axe = await import('axe-core'); await page.evaluate(axe.default.source); }
    for(const width of [320, 390, 768, 1280]) for(const theme of ['light', 'dark']){
      await page.setViewportSize({ width, height: 844 }); await page.evaluate(t => document.documentElement.dataset.theme = t, theme); await settle(page);
      check(!await page.locator('.needs-target').evaluate((e, w) => e.getBoundingClientRect().right > w + 1 || e.scrollWidth > e.clientWidth + 1 || document.documentElement.scrollWidth > w + 1, width), 'needs target overflows at ' + width + '/' + theme);
      if(process.env.NEEDS_A11Y){
        const v = await page.locator('.needs-target').evaluate(async el => (await window.axe.run(el, { preload: false })).violations.map(x => ({ id: x.id, nodes: x.nodes.map(n => n.failureSummary) })));
        check(!v.length, 'needs target accessibility ' + width + '/' + theme + ': ' + JSON.stringify(v));
      }
    }
  },

  async scenariosandbox(page){
    // The demo household: two scenarios that buy a home, both short of cash at settlement.
    await quiet(page);
    const homeInsights = async () => { await go(page, 'dashboard', 'data-dashboard-sub', 'insights'); return page.locator('#adviceHome').evaluate(el => el.textContent); };
    const bell = async () => {
      await go(page, 'dashboard');
      await page.locator('.notif-bell-btn:visible').first().click();
      const panel = page.locator('#notifPanel'); await panel.waitFor();
      const text = await panel.innerText();
      await page.keyboard.press('Escape'); await waited(page, () => !document.getElementById('notifPanel'), 'the bell closed');
      return text;
    };
    const scenarios = await st(page, 'state.scenarios.filter(n => state.purchase[n] && state.purchase[n].enabled)');
    check(scenarios.length >= 1, 'the demo household has no scenario that buys');
    const withBuy = { insights: await homeInsights(), bell: await bell() };
    for(const name of scenarios){
      check(!withBuy.insights.includes(name) && !withBuy.bell.includes(name), name + ' is named outside Plan → Scenarios');
    }
    check(/Emergency fund: about/.test(withBuy.insights), "the household's emergency fund isn't reported on Insights");
    check(!/competes with the deposit/.test(withBuy.insights), 'super room still talks about a deposit');
    // Plan → Scenarios' line carries them, and the bell opened from it shows them against their scenario.
    await go(page, 'plan', 'data-plan-sub', 'scenarios');
    const line = page.locator('#attentionLine [data-attn-line]');
    await line.waitFor();
    await line.click();
    const panel = page.locator('#notifPanel'); await panel.waitFor();
    const there = await panel.innerText();
    check(scenarios.some(name => there.includes(name + ':')), 'Plan → Scenarios does not show its scenarios\' observations: ' + there.slice(0, 200));
    await page.keyboard.press('Escape'); await waited(page, () => !document.getElementById('notifPanel'), 'the bell closed');
    // The same household with no purchase in any scenario: the household's observations are the same, word for word.
    await page.evaluate(async names => { const m = await import('/src/state.js'); names.forEach(n => { m.state.purchase[n].enabled = false; }); m.commit(['purchase']); }, scenarios);
    await settle(page);
    const without = { insights: await homeInsights(), bell: await bell() };
    check(without.insights === withBuy.insights, 'Insights changed with the scenarios\' purchases:\n' + withBuy.insights.slice(0, 300) + '\n---\n' + without.insights.slice(0, 300));
    check(without.bell === withBuy.bell, 'the bell changed with the scenarios\' purchases');
  },

  async restorebackup(page){
    // Synthetic demo household; backups are made from it here, in the test.
    await quiet(page);
    const saved = () => page.evaluate(() => localStorage.getItem('wealthPlanner.v1'));
    const current = async () => JSON.parse(await page.evaluate(async () => JSON.stringify((await import('/src/state.js')).state)));
    const pick = (p, obj) => p.setInputFiles('#importFile', { name: 'example-backup.json', mimeType: 'application/json', buffer: Buffer.from(typeof obj === 'string' ? obj : JSON.stringify(obj)) });
    const clearToasts = p => p.evaluate(() => document.querySelectorAll('#toastWrap > *').forEach(t => t.remove()));
    const original = await current(), linesWas = original.shared.length;
    const backup = JSON.parse(JSON.stringify(original));
    backup.shared = backup.shared.slice(0, 2); backup.savedAt = '2026-11-02T09:00:00.000Z'; backup.savedByName = 'Sam <i>';

    // Not a backup: said straight away, nothing asked.
    for(const [bad, said] of [[{ income: 'x', home: 'y' }, /doesn't look like a valid backup/], [{ income: [], home: {}, transactions: {} }, /its transactions isn't a list/], ['not json', /doesn't look like a valid backup/]]){
      await clearToasts(page); const before = await saved();
      await pick(page, bad);
      await page.locator('#toastWrap').getByText(said).waitFor();
      check(!await page.locator('.app-dialog').count() && await saved() === before, 'a malformed file was offered as a replacement: ' + JSON.stringify(bad));
    }

    // The question names what each holds; Cancel changes nothing.
    await pick(page, backup);
    const dialog = page.locator('.app-dialog');
    await dialog.waitFor();
    const text = await dialog.innerText();
    check(/This backup is OLDER than what's on this device/.test(text), 'older backup not said: ' + text);
    check(/This backup, last changed .* by Sam <i>: 2 budget lines/.test(text) && new RegExp('This device, last changed .*: ' + linesWas + ' budget lines').test(text), 'the comparison is missing: ' + text);
    check(await dialog.evaluate(d => !d.querySelector('#appDialogDetails i') && d.getAttribute('aria-describedby') === 'appDialogMessage appDialogDetails'), 'details not plain text, or not described');
    if(process.env.RESTORE_A11Y){ const axe = await import('axe-core'); await page.evaluate(axe.default.source); }
    for(const width of [320, 390, 768, 1280]) for(const theme of ['light', 'dark']){
      await page.setViewportSize({ width, height: 700 }); await page.evaluate(t => document.documentElement.dataset.theme = t, theme); await settle(page);
      check(await dialog.evaluate((d, w) => d.getBoundingClientRect().right <= w + 1 && d.scrollWidth <= d.clientWidth + 1, width), 'restore dialog overflows at ' + width + '/' + theme);
      if(process.env.RESTORE_A11Y){
        const violations = await dialog.evaluate(async el => (await window.axe.run(el, { preload: false })).violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.failureSummary) })));
        check(!violations.length, 'restore dialog accessibility ' + width + '/' + theme + ': ' + JSON.stringify(violations));
      }
    }
    await page.setViewportSize({ width: 390, height: 844 }); await page.evaluate(() => delete document.documentElement.dataset.theme);
    const beforeCancel = await saved();
    await answerDialog(page, false);
    check(await saved() === beforeCancel && (await current()).shared.length === linesWas, 'cancel changed the household');

    // Restore, then Undo puts the previous household back.
    await clearToasts(page);
    await pick(page, backup); await answerDialog(page, true);
    await page.locator('#toastWrap').getByText('Backup restored').waitFor();
    check(await stored(page, 'state.shared.length') === 2 && (await current()).shared.length === 2, 'restore not saved');
    await page.locator('#toastWrap .toast-undo-btn').last().click();
    await page.locator('#toastWrap').getByText('Restore undone').waitFor();
    check(await stored(page, 'JSON.stringify(state.shared)') === JSON.stringify(original.shared) && (await current()).shared.length === linesWas, 'Undo did not bring the previous household back');

    // Undo after an edit refuses and keeps the edit.
    await clearToasts(page);
    await pick(page, backup); await answerDialog(page, true);
    await page.locator('#toastWrap').getByText('Backup restored').waitFor();
    await page.evaluate(async () => { const m = await import('/src/state.js'); m.state.shared[0].amount = 123; m.commit(['shared']); });
    await page.locator('#toastWrap .toast-undo-btn').last().click();
    await page.locator('#toastWrap').getByText(/Can't undo — the household has changed since the restore/).waitFor();
    check(await stored(page, 'state.shared[0].amount') === 123 && await stored(page, 'state.shared.length') === 2, 'refused Undo changed the household');

    // An empty backup is named as one.
    await pick(page, { income: [], home: {} });
    await dialog.waitFor();
    check(/This backup is empty/.test(await dialog.innerText()) && await dialog.locator('[data-dialog-submit]').innerText() === 'Replace with empty household', 'an empty backup was not named as one');
    await answerDialog(page, false);

    // A save that doesn't happen: this device's household stays, and nothing says it was restored.
    await clearToasts(page);
    const durable = await saved(), shown = JSON.stringify((await current()).shared);
    await page.evaluate(() => { window.__setItem = Storage.prototype.setItem; Storage.prototype.setItem = function(k, v){ if(k === 'wealthPlanner.v1') throw new Error('Synthetic restore save failure'); return window.__setItem.call(this, k, v); }; });
    await pick(page, original); await answerDialog(page, true);
    await page.locator('#toastWrap').getByText(/Not restored — this browser couldn't save the backup/).waitFor();
    check(await saved() === durable && JSON.stringify((await current()).shared) === shown, 'a failed restore changed the household');
    check(!/Backup restored/.test(await page.locator('#toastWrap').innerText()), 'a failed restore claimed success');
    await page.evaluate(() => { Storage.prototype.setItem = window.__setItem; });

    // Touch: restore by tap, Undo by tap.
    const touch = await fresh({ touch: true });
    try{
      const tp = touch.page; await quiet(tp);
      const was = await tp.evaluate(() => localStorage.getItem('wealthPlanner.v1'));
      const b = JSON.parse(was); b.shared = b.shared.slice(0, 1);
      await pick(tp, b);
      await tp.locator('.app-dialog [data-dialog-submit]').tap();
      await tp.locator('#toastWrap').getByText('Backup restored').waitFor();
      check(await stored(tp, 'state.shared.length') === 1, 'touch restore not saved');
      await tp.locator('#toastWrap .toast-undo-btn').last().tap();
      await tp.locator('#toastWrap').getByText('Restore undone').waitFor();
      check(await stored(tp, 'state.shared.length') === JSON.parse(was).shared.length, 'touch Undo did not bring the household back');
      check(!touch.errors.length, 'touch restore errors: ' + touch.errors.join('; '));
    } finally { await touch.ctx.close(); }

    // welcome.html checks a file the same way before asking.
    await page.goto(base + '/welcome.html');
    await page.locator('#welcomeImportFile').setInputFiles({ name: 'example-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ income: [], home: {}, assets: 'x' })) });
    await page.locator('#toastWrap').getByText(/its assets isn't a list/).waitFor();
    check(!await page.locator('.app-dialog').count(), 'welcome offered a malformed backup');
  },

  async pricepaste(page){
    // Synthetic demo household: VAS and IVV held on the ASX.
    await quiet(page);
    const openPaste = async p => {
      await go(p, 'assets', 'data-assets-sub', 'Shares');
      if(await p.locator('[data-asset-tool-panel="prices"]').isHidden()){
        await p.locator('[data-asset-list-tool="prices"]').first().evaluate(el => el.closest('.page-overflow').querySelector('[data-overflow-toggle]').click());
        await p.locator('[data-asset-list-tool="prices"]').first().click();
      }
      await p.evaluate(() => { const a = document.getElementById('sharesPasteArea'); a.closest('details.ps-manual').open = true; a.closest('[data-ps-panel]').open = true; });
      await p.locator('#sharesPasteArea').waitFor({ state: 'visible' });
    };
    const reviewOf = async (p, text) => { await p.locator('#sharesPasteArea').fill(text); await p.locator('#sharesPasteApply').click(); await p.locator('#sharesPasteReview [data-price-review-status]').waitFor(); };
    const prices = p => st(p, 'JSON.stringify([state.assets.filter(a=>a.category==="Shares").map(a=>[a.symbol,a.price,a.priceUpdated,a.amount,a.history]), state.fx, state.benchmark])');
    const held = (p, sym) => st(p, `state.assets.find(a=>a.symbol==='${sym}').price`);
    const durable = p => p.evaluate(() => localStorage.getItem('wealthPlanner.v1'));
    const panel = page.locator('#sharesPasteReview');
    await openPaste(page);
    const was = await prices(page), savedWas = await durable(page);
    const PASTE = ['Symbol\tPrice', 'VAS\t101.50', 'IVV,"1,234.50"', 'VAS\t101.50', 'NASDAQ:VAS\t500', 'ZZZ 5', 'ABC\t0', 'XYZ\t#N/A', 'USDAUD\t1.52', 'IOZ@NOW\t33.10', 'IVV 1 234.50'].join('\n');
    await reviewOf(page, PASTE);
    const text = await panel.innerText();
    check(/4 prices to update · 5 left out/.test(text), 'review counts: ' + text);
    check(/\$1,234\.50/.test(text) && /check/.test(text), 'quoted thousands not read whole, or its big change not flagged');
    check(/a US price, but VAS is held on the ASX/.test(text) && /no holding with this ticker/.test(text) && /more than zero/.test(text) && /hasn't worked out this price/.test(text) && /more than one number/.test(text), 'a left-out reason is missing: ' + text);
    check(await prices(page) === was && await durable(page) === savedWas, 'reviewing changed prices');
    check(await panel.locator('[data-price-review-status]').evaluate(el => document.activeElement === el), 'review status did not take focus');
    if(process.env.PRICE_PASTE_A11Y){ const axe = await import('axe-core'); await page.evaluate(axe.default.source); }
    for(const width of [320, 390, 768, 1280]) for(const theme of ['light', 'dark']){
      await page.setViewportSize({ width, height: 844 }); await page.evaluate(t => document.documentElement.dataset.theme = t, theme); await settle(page);
      check(await panel.evaluate((el, w) => document.documentElement.scrollWidth <= w + 1 && el.getBoundingClientRect().right <= w + 1 && el.scrollWidth <= el.clientWidth + 1, width), 'price review overflows at ' + width + '/' + theme);
      if(width <= 390){ const b = await panel.locator('[data-price-review-confirm]').boundingBox(); check(b && b.height >= 43.5, 'Update under 44px at ' + width); }
      if(process.env.PRICE_PASTE_A11Y){
        const violations = await panel.evaluate(async el => (await window.axe.run(el, { preload: false })).violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.failureSummary) })));
        check(!violations.length, 'price review accessibility ' + width + '/' + theme + ': ' + JSON.stringify(violations));
      }
    }
    await page.setViewportSize({ width: 390, height: 844 }); await page.evaluate(() => delete document.documentElement.dataset.theme);

    // A price read lands while the review is open: shown again, nothing written.
    await page.evaluate(async () => { const m = await import('/src/state.js'); m.state.assets.find(a => a.symbol === 'IVV').price += 1; m.commit(['assets']); });
    const staleSaved = await durable(page);
    await panel.locator('[data-price-review-confirm]').click();
    await panel.getByText(/changed since this review/).waitFor();
    check(await held(page, 'VAS') !== 101.5 && (await durable(page)) === staleSaved, 'a stale review was written');
    check(await page.locator('#sharesPasteArea').inputValue() === PASTE, 'the pasted text was lost on a redraw');

    // Update, then Undo puts every price back.
    const beforeUpdate = await prices(page);
    await panel.locator('[data-price-review-confirm]').click();
    await waited(page, () => document.getElementById('sharesPasteReview').hidden, 'prices updated');
    check(/4 prices updated \(2 holdings, USD\/AUD rate, 1 benchmark\) · 5 left out/.test(await page.locator('#toastWrap').innerText()), 'update result: ' + await page.locator('#toastWrap').innerText());
    check(await stored(page, "state.assets.find(a=>a.symbol==='VAS').price") === 101.5 && await stored(page, "state.assets.find(a=>a.symbol==='IVV').price") === 1234.5 && await stored(page, 'state.fx.usdAud') === 1.52, 'reviewed prices not saved');
    check(await page.locator('#sharesPasteArea').inputValue() === '', 'box not cleared after an update');
    await page.locator('#toastWrap .toast-undo-btn').last().click();
    await eventually(async () => await prices(page) === beforeUpdate);
    check(await prices(page) === beforeUpdate && await stored(page, "state.assets.find(a=>a.symbol==='VAS').price") !== 101.5, 'Undo did not restore prices, rate and benchmark');

    // Undo after a newer price refuses and keeps the newer one.
    await reviewOf(page, 'VAS\t102');
    await panel.locator('[data-price-review-confirm]').click();
    await waited(page, () => document.getElementById('sharesPasteReview').hidden, 'second update');
    await page.evaluate(async () => { const m = await import('/src/state.js'); const a = m.state.assets.find(x => x.symbol === 'VAS'); a.price = 103; m.commit(['assets']); });
    await page.locator('#toastWrap .toast-undo-btn').last().click();
    await page.locator('#toastWrap').getByText(/Can't undo — 1 price has been updated again since/).waitFor();
    check(await held(page, 'VAS') === 103, 'refused Undo changed the newer price');

    // Below zero is never offered; typing puts a review away; a replaced household is reviewed again.
    await reviewOf(page, 'VAS\t-3');
    check(/Nothing to update/.test(await panel.innerText()) && !await panel.locator('[data-price-review-confirm]').count(), 'a negative price was offered');
    await page.locator('#sharesPasteArea').press('End'); await page.keyboard.type('0');
    check(await panel.isHidden(), 'editing the text kept a review of the old text');
    await reviewOf(page, 'IVV\t60');
    await page.evaluate(async () => { const m = await import('/src/state.js'); m.setState(JSON.parse(JSON.stringify(m.state))); });
    await panel.getByText(/reviewed again against the one open now/).waitFor();

    // A save that doesn't happen: nothing claims an update, prices are put back, the review stays.
    const failSaved = await durable(page), failWas = await prices(page), ivvBeforeFail = await held(page, 'IVV');
    await page.evaluate(() => { document.querySelectorAll('#toastWrap > *').forEach(t => t.remove()); window.__setItem = Storage.prototype.setItem; Storage.prototype.setItem = function(k, v){ if(k === 'wealthPlanner.v1') throw new Error('Synthetic price save failure'); return window.__setItem.call(this, k, v); }; });
    await panel.locator('[data-price-review-confirm]').click();
    await panel.getByText(/Not saved — no prices were changed/).waitFor();
    check(await durable(page) === failSaved && await prices(page) === failWas, 'a failed save left prices changed');
    check(!/updated/.test(await page.locator('#toastWrap').innerText()), 'a failed save claimed an update');
    await page.evaluate(() => { Storage.prototype.setItem = window.__setItem; });
    await go(page, 'dashboard'); await page.reload(); await quiet(page);
    check(await held(page, 'IVV') === ivvBeforeFail, 'reload kept an unsaved price');

    // Touch: review and update by tap, then Undo.
    const touch = await fresh({ touch: true });
    try{
      const tp = touch.page; await quiet(tp); await openPaste(tp);
      const tWas = await prices(tp);
      await tp.locator('#sharesPasteArea').fill('VAS\t99.25');
      await tp.locator('#sharesPasteApply').tap();
      await tp.locator('#sharesPasteReview [data-price-review-confirm]').tap();
      await waited(tp, () => document.getElementById('sharesPasteReview').hidden, 'touch update');
      check(await stored(tp, "state.assets.find(a=>a.symbol==='VAS').price") === 99.25, 'touch update not saved');
      await tp.locator('#toastWrap .toast-undo-btn').last().tap();
      await eventually(async () => await prices(tp) === tWas);
      check(await prices(tp) === tWas, 'touch Undo did not restore');
      check(!touch.errors.length, 'touch price paste errors: ' + touch.errors.join('; '));
    } finally { await touch.ctx.close(); }
  },

  async rowimports(page){
    // Synthetic demo household: "Streaming" $29 Monthly is already budgeted; "1 Example St" is its investment property.
    await quiet(page);
    const csvFile = (name, text) => ({ name, mimeType: 'text/csv', buffer: Buffer.from(text) });
    const panel = kind => page.locator('#' + ({ expenses: 'expenseImportPreview', income: 'incomeImportPreview', assets: 'assetsImportPreview' })[kind]);
    const choose = (kind, name, text) => page.setInputFiles('#' + ({ expenses: 'expenseImportFile', income: 'incomeImportFile', assets: 'assetsImportFile' })[kind], csvFile(name, text));
    const reviewed = kind => waited(page, id => !!document.querySelector('#' + id + ' [data-rowimport-confirm]'), kind + ' review', ({ expenses: 'expenseImportPreview', income: 'incomeImportPreview', assets: 'assetsImportPreview' })[kind]);
    const budget = () => st(page, 'JSON.stringify([state.shared, state.properties.map(p=>p.expenses), state.categories])');
    const durable = () => page.evaluate(() => localStorage.getItem('wealthPlanner.v1'));
    const undoLast = () => page.locator('#toastWrap .toast-undo-btn').last().click();
    const toastText = () => page.locator('#toastWrap').innerText();
    const BUDGET_CSV = 'What,Classification,Category,Amount,Frequency,Account,Source\n' +
      'Example gym,Wants,Example <b>new</b> category,40,Monthly,Everyday Account,\n' +
      'Example strata,Needs,,300,Quarterly,,1 Example St\n' +
      'Example water,Needs,,90,Quarterly,,Housing\n' +
      'Streaming,Wants,Subscriptions,29,Monthly,Credit Card,\n' +
      'Example gym,Wants,,40,Monthly,,\n' +
      ',Needs,,10,Monthly,,\n';

    await go(page, 'expenses', 'data-expenses-sub', 'budget');
    const budgetWas = await budget(), durableWas = await durable();
    await choose('expenses', 'Example <budget>.csv', BUDGET_CSV);
    await reviewed('expenses');
    const text = await panel('expenses').innerText();
    check(/3 expenses ready to import/.test(text) && /1 skipped/.test(text) && /2 left out/.test(text), 'budget review counts: ' + text);
    check(/1 Example St/.test(text) && /Home costs/.test(text) && /Budget/.test(text), 'budget review did not name each destination');
    check(/1 already in the household, 1 repeating an earlier row in this file/.test(text), 'budget review did not say why rows were left out');
    check(await panel('expenses').locator('[data-rowimport-status]').evaluate(el => document.activeElement === el), 'review status did not take focus');
    check(await panel('expenses').evaluate(el => !el.innerHTML.includes('<budget>') && !el.innerHTML.includes('<b>new')), 'file name or category reached the page unescaped');
    check(await budget() === budgetWas && await durable() === durableWas, 'reviewing changed the household');
    // Include them, by keyboard: the count follows, then back out.
    await panel('expenses').locator('[data-rowimport-dups]').focus(); await page.keyboard.press('Space');
    await waited(page, () => /Import 5 expenses/.test(document.querySelector('#expenseImportPreview [data-rowimport-confirm]')?.textContent || ''), 'duplicates included');
    check(await panel('expenses').locator('[data-rowimport-dups]').evaluate(el => document.activeElement === el && el.checked), 'Include lost focus or state');
    await page.keyboard.press('Space');
    await waited(page, () => /Import 3 expenses/.test(document.querySelector('#expenseImportPreview [data-rowimport-confirm]')?.textContent || ''), 'duplicates left out again');

    // Four widths, both themes: nothing wider than the page.
    if(process.env.ROW_IMPORT_A11Y){ const axe = await import('axe-core'); await page.evaluate(axe.default.source); }
    for(const width of [320, 390, 768, 1280]) for(const theme of ['light', 'dark']){
      await page.setViewportSize({ width, height: 844 }); await page.evaluate(t => document.documentElement.dataset.theme = t, theme); await settle(page);
      check(await panel('expenses').evaluate((el, w) => document.documentElement.scrollWidth <= w + 1 && el.getBoundingClientRect().right <= w + 1 && el.scrollWidth <= el.clientWidth + 1, width), 'budget review overflows at ' + width + '/' + theme);
      const btn = await panel('expenses').locator('[data-rowimport-confirm]').boundingBox();
      if(width <= 390) check(btn && btn.height >= 43.5, 'Import button under 44px at ' + width);
      if(process.env.ROW_IMPORT_A11Y){
        const violations = await panel('expenses').evaluate(async el => (await window.axe.run(el, { preload: false })).violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.failureSummary) })));
        check(!violations.length, 'row import review accessibility ' + width + '/' + theme + ': ' + JSON.stringify(violations));
      }
    }
    await page.setViewportSize({ width: 390, height: 844 }); await page.evaluate(() => delete document.documentElement.dataset.theme);

    await panel('expenses').locator('[data-rowimport-confirm]').click();
    await waited(page, () => document.getElementById('expenseImportPreview').hidden, 'budget review closed');
    check(/3 expenses imported · 1 to a property · 2 left out/.test(await toastText()), 'budget result: ' + await toastText());
    const saved = await stored(page, `({ gym: state.shared.filter(r=>r.what==='Example gym'), water: state.shared.find(r=>r.what==='Example water'),
      strata: state.properties.find(p=>p.what==='1 Example St').expenses.find(r=>r.what==='Example strata'), streaming: state.shared.filter(r=>r.what==='Streaming').length,
      cat: state.categories.includes('Example <b>new</b> category'), acct: (state.accounts||[]).find(a=>a.name==='Everyday Account') })`);
    check(saved.gym.length === 1 && saved.gym[0].account === 'Everyday Account' && saved.gym[0].accountId === saved.acct.id, 'imported row not linked to its account by id');
    check(saved.water && saved.water.homeCost && saved.strata && saved.streaming === 1 && saved.cat, 'imported rows not saved where the review said');
    // Undo takes out exactly those rows — the property's and the new category included.
    await undoLast();
    await eventually(async () => await budget() === budgetWas);
    check(await budget() === budgetWas, 'Undo left imported rows or a category behind');
    check(await stored(page, 'JSON.stringify([state.shared, state.properties.map(p=>p.expenses), state.categories])') === budgetWas, 'Undo was not saved');

    // Undo after other edits removes only the imported row; after the imported row is edited it refuses.
    await choose('expenses', 'one.csv', 'What,Amount,Frequency\nExample import,10,Monthly\n'); await reviewed('expenses');
    await panel('expenses').locator('[data-rowimport-confirm]').click();
    await waited(page, () => document.getElementById('expenseImportPreview').hidden, 'single import saved');
    await page.evaluate(async () => { const m = await import('/src/state.js'); m.state.shared.splice(0, 1); m.state.shared.push({ what: 'Example later', amount: 5, freq: 'Monthly', classification: 'Needs' }); m.commit(['shared']); });
    const firstGone = await st(page, 'state.shared.length');
    await undoLast();
    await eventually(async () => !await st(page, "state.shared.some(r=>r.what==='Example import')"));
    check(!await st(page, "state.shared.some(r=>r.what==='Example import')") && await st(page, "state.shared.some(r=>r.what==='Example later')") && await st(page, 'state.shared.length') === firstGone - 1, 'Undo removed the wrong rows');
    await choose('expenses', 'two.csv', 'What,Amount,Frequency\nExample edited,10,Monthly\n'); await reviewed('expenses');
    await panel('expenses').locator('[data-rowimport-confirm]').click();
    await waited(page, () => document.getElementById('expenseImportPreview').hidden, 'second import saved');
    await page.evaluate(async () => { const m = await import('/src/state.js'); m.state.shared.find(r => r.what === 'Example edited').amount = 12; m.commit(['shared']); });
    await undoLast();
    await page.locator('#toastWrap').getByText(/Can't undo — 1 imported row was changed or removed since/).waitFor();
    check(await st(page, "state.shared.find(r=>r.what==='Example edited').amount") === 12, 'refused Undo still changed the edited row');

    // A property deleted between review and confirm: reviewed again, saying so; nothing sent elsewhere unseen.
    await choose('expenses', 'land.csv', 'What,Amount,Frequency,Source\nExample land fee,50,Monthly,1 Example St\n'); await reviewed('expenses');
    await page.evaluate(async () => { const m = await import('/src/state.js'); m.state.properties = m.state.properties.filter(p => p.what !== '1 Example St'); m.commit(['properties']); });
    const beforeLost = await durable();
    await panel('expenses').locator('[data-rowimport-confirm]').click();
    await panel('expenses').getByText(/1 Example St is no longer one of your investment properties/).waitFor();
    check(await durable() === beforeLost && !await st(page, "state.shared.some(r=>r.what==='Example land fee')"), 'deleted property silently retargeted its row');
    check(/Budget/.test(await panel('expenses').innerText()), 'the re-review did not show the new destination');
    await panel('expenses').locator('[data-rowimport-cancel]').click();

    // A household replaced while a review is open is reviewed again against the new one.
    await go(page, 'expenses', 'data-expenses-sub', 'income');
    await choose('income', 'income.csv', 'What,Person,Type,Amount,Frequency\nExample side work,Alex,Net,100,Monthly\n'); await reviewed('income');
    check(/Income · Alex/.test(await panel('income').innerText()), 'income review did not name the person');
    const replacedWas = await durable();
    await page.evaluate(async () => { const m = await import('/src/state.js'); const s = JSON.parse(JSON.stringify(m.state)); s.income = s.income.slice(0, 1); m.setState(s); });
    await panel('income').getByText(/reviewed again against the one open now/).waitFor();
    check(await durable() === replacedWas && !await st(page, "state.income.some(r=>r.what==='Example side work')"), 'household replacement imported rows');
    await panel('income').locator('[data-rowimport-confirm]').click();
    await waited(page, () => document.getElementById('incomeImportPreview').hidden, 'income saved');
    check(await stored(page, "state.income.filter(r=>r.what==='Example side work').length") === 1, 'income not saved into the open household');
    // The same file again: left out as a duplicate.
    await choose('income', 'income.csv', 'What,Person,Type,Amount,Frequency\nExample side work,Alex,Net,100,Monthly\n');
    await panel('income').getByText(/1 row looks like one you already have/).waitFor();
    check(!await panel('income').locator('[data-rowimport-confirm]').count(), 'a file of only duplicates still offered to import');
    await panel('income').locator('[data-rowimport-cancel]').click();

    // Reading: says so with Cancel; a read finishing after Cancel, or after a newer file, is dropped.
    await go(page, 'assets');
    await page.evaluate(() => { const R = FileReader.prototype.readAsText; window.__reads = []; FileReader.prototype.readAsText = function(f){ const self = this; window.__reads.push(() => R.call(self, f)); }; });
    await choose('assets', 'slow.csv', 'What,Category,Amount\nExample slow,Cash,1000\n');
    await panel('assets').getByText(/Reading slow\.csv/).waitFor();
    await panel('assets').locator('[data-rowimport-cancel]').click();
    await page.evaluate(() => window.__reads[0]()); await settle(page);
    check(await panel('assets').isHidden(), 'a read finishing after Cancel brought its review back');
    await choose('assets', 'older.csv', 'What,Category,Amount\nExample older,Cash,1000\n');
    await choose('assets', 'newer.csv', 'What,Category,Amount\nExample newer,Cash,2000\n');
    await page.evaluate(() => { window.__reads[2](); window.__reads[1](); }); await reviewed('assets'); await settle(page);
    check(/newer\.csv/.test(await panel('assets').innerText()) && !/older/.test(await panel('assets').innerText()), 'an older read replaced the newer review');
    await page.evaluate(() => { window.__reads.length = 0; });

    // A save that doesn't happen: nothing claims to be imported, the rows come back out, the review stays.
    const assetsWas = await st(page, 'state.assets.length'), assetsDurable = await durable();
    await page.evaluate(() => { window.__setItem = Storage.prototype.setItem; Storage.prototype.setItem = function(k, v){ if(k === 'wealthPlanner.v1') throw new Error('Synthetic import save failure'); return window.__setItem.call(this, k, v); }; });
    await page.evaluate(() => document.querySelectorAll('#toastWrap > *').forEach(t => t.remove()));
    await panel('assets').locator('[data-rowimport-confirm]').click();
    await panel('assets').getByText(/Not saved — nothing was imported from newer\.csv/).waitFor();
    check(await durable() === assetsDurable && await st(page, 'state.assets.length') === assetsWas, 'failed save left rows in the tab or storage');
    check(!/imported/.test((await toastText()).replace(/nothing was imported/, '')), 'failed save claimed an import: ' + await toastText());
    check(await panel('assets').locator('[data-rowimport-status]').evaluate(el => document.activeElement === el), 'save failure not announced by focus');
    await page.evaluate(() => { Storage.prototype.setItem = window.__setItem; });
    await go(page, 'dashboard'); await page.reload(); await quiet(page);
    check(await st(page, 'state.assets.length') === assetsWas, 'reload kept an unsaved asset');

    // Touch, at a phone's width: a review confirmed by tap, and its Undo.
    const touch = await fresh({ touch: true });
    try{
      const tp = touch.page; await quiet(tp); await go(tp, 'assets');
      const before = await tp.evaluate(() => localStorage.getItem('wealthPlanner.v1'));
      await tp.setInputFiles('#assetsImportFile', csvFile('touch.csv', 'What,Category,Amount\nExample touch,Cash,500\n'));
      await tp.locator('#assetsImportPreview [data-rowimport-confirm]').tap();
      await waited(tp, () => document.getElementById('assetsImportPreview').hidden, 'touch import saved');
      check(await stored(tp, "state.assets.some(a=>a.what==='Example touch')"), 'touch import not saved');
      await tp.locator('#toastWrap .toast-undo-btn').last().tap();
      await eventually(async () => !await stored(tp, "state.assets.some(a=>a.what==='Example touch')"));
      check(!await stored(tp, "state.assets.some(a=>a.what==='Example touch')") && JSON.parse(await tp.evaluate(() => localStorage.getItem('wealthPlanner.v1'))).assets.length === JSON.parse(before).assets.length, 'touch Undo did not remove the asset');
      check(!touch.errors.length, 'touch row import errors: ' + touch.errors.join('; '));
    } finally { await touch.ctx.close(); }
  },
  async shareupdate(page){
    await quiet(page);
    const before=await st(page,'JSON.stringify(state)'),saved=await page.evaluate(()=>localStorage.getItem('wealthPlanner.v1'));
    const bytes=[...Buffer.from('Date,Description,Amount\n01/10/2026,Example Market,-100\n')];
    const expected={bytes,type:'text/csv',name:encodeURIComponent('Example statement.csv')};
    await page.evaluate(async ({bytes,name})=>{
      const registration=await navigator.serviceWorker.register(new URL('/sw.js',location.href));
      await navigator.serviceWorker.ready;
      if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));
      window.__shareScope=registration.scope;
      const share=await caches.open('wealth-planner-share');
      await share.put(new URL('shared-statement',registration.scope),new Response(new Uint8Array(bytes),{headers:{'Content-Type':'text/csv','X-File-Name':name}}));
      const app=await caches.open('wealth-planner-cache-v1');
      await app.put(new URL('index.html',registration.scope),new Response('stale app shell'));
      await app.put(new URL('stale-example.js',registration.scope),new Response('stale script'));
      const old=await caches.open('wealth-planner-cache-old');await old.put(new URL('old-example.js',registration.scope),new Response('old script'));
      window.__requestShareUpdate=()=>new Promise((resolve,reject)=>{
        const channel=new MessageChannel(),timer=setTimeout(()=>reject(new Error('Update worker did not reply')),10000);
        channel.port1.onmessage=e=>{clearTimeout(timer);channel.port1.close();resolve(e.data.ok);};
        navigator.serviceWorker.controller.postMessage({type:'purge-and-reprime'},[channel.port2]);
      });
    },{bytes,name:expected.name});
    const pending=()=>page.evaluate(async()=>{
      if(!await caches.has('wealth-planner-share'))return null;
      const response=await (await caches.open('wealth-planner-share')).match(new URL('shared-statement',window.__shareScope||new URL('/',location.href)));
      return response?{bytes:[...new Uint8Array(await response.arrayBuffer())],type:response.headers.get('Content-Type'),name:response.headers.get('X-File-Name')}:null;
    });
    check(await page.evaluate(()=>window.__requestShareUpdate())===true,'online update did not complete');
    check(JSON.stringify(await pending())===JSON.stringify(expected),'app update deleted or changed pending shared statement');
    check(await page.evaluate(async()=>{
      const cache=await caches.open('wealth-planner-cache-v1'),shell=await cache.match(new URL('index.html',window.__shareScope));
      return !await caches.has('wealth-planner-cache-old')&&!await cache.match(new URL('stale-example.js',window.__shareScope))&&!!shell&&(await shell.text()).includes('Wealth Planner');
    }),'app update failed to clear stale resources and re-prime the shell');
    try{
      // Context offline emulation does not cover the worker's own fetches. Drop the actual shell connection.
      dropShellRequests = true;
      for(let attempt=0;attempt<2;attempt++){
        const previousDrops = droppedShellRequests;
        check(await page.evaluate(()=>window.__requestShareUpdate())===false,'failed refresh did not report failure');
        check(droppedShellRequests>previousDrops,'failure probe did not reach the shell request');
        check(JSON.stringify(await pending())===JSON.stringify(expected),'failed update changed pending shared file');
      }
    }finally{dropShellRequests = false;}
    check(await page.evaluate(()=>window.__requestShareUpdate())===true,'online retry did not complete');
    check(JSON.stringify(await pending())===JSON.stringify(expected),'online retry changed pending shared file');
    check(await st(page,'JSON.stringify(state)')===before&&await page.evaluate(()=>localStorage.getItem('wealthPlanner.v1'))===saved,'update cleanup changed household data');
    await page.reload();await quiet(page);
    check(JSON.stringify(await pending())===JSON.stringify(expected),'pending shared file did not survive reload after update');
  },
  async propertypicker(page){
    await quiet(page);await go(page,'expenses','data-expenses-sub','spending');
    const setup=async p=>p.evaluate(async()=>{
      const m=await import('/src/state.js');
      m.state.properties=[
        {id:'example-property-a',kind:'IP',what:'Example property with a long descriptive name <b>North</b>',state:'QLD',purchaseDate:'2020-01-01',ownership:{Alex:100}},
        {id:'example-property-b',kind:'IP',what:'Example property with a long descriptive name <b>North</b>',state:'NSW',purchaseDate:'2021-01-01',ownership:{Sam:100}},
        {id:'example-property-c',kind:'IP',what:'',ownership:{Alex:50,Sam:50}}
      ];window.__propertyPickerCalls=[];
    });
    const open=async p=>{
      await p.locator('#bankImportPickBtn').focus();
      await p.evaluate(async()=>{window.__propertyPickerCalls=[];const m=await import('/src/components/rentstatement.js');m.chooseInvestmentProperty('Choose the statement property',p=>window.__propertyPickerCalls.push({id:p.id,open:!!document.querySelector('[data-ipp]')}));});
      await p.locator('[data-ipp]').first().waitFor();
    };
    const closed=async p=>waited(p,()=>!document.querySelector('[data-ipp]'),'property chooser closes');
    await setup(page);
    const before=await st(page,'JSON.stringify(state)'),saved=await page.evaluate(()=>localStorage.getItem('wealthPlanner.v1'));
    if(process.env.PROPERTY_PICKER_A11Y){const axe=await import('axe-core');await page.evaluate(axe.default.source);}
    if(process.env.PROPERTY_PICKER_SHOTS)fs.mkdirSync(process.env.PROPERTY_PICKER_SHOTS,{recursive:true});
    await waited(page,()=>!document.querySelector('#toastWrap .toast'),'initial notices clear');
    let i=0;
    for(const width of [320,390,768,1280])for(const theme of ['light','dark']){
      await page.setViewportSize({width,height:844});await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);await open(page);
      const dialog=page.getByRole('dialog',{name:'Choose the statement property'}),first=dialog.locator('[data-ipp]').first(),last=dialog.locator('[data-ipp-close]');
      // On released main, Tab from the final property leaves the custom sheet for the page behind it.
      await dialog.locator('[data-ipp]').last().focus();await page.keyboard.press('Tab');
      check(await dialog.evaluate(el=>el.contains(document.activeElement)),'Tab escaped property chooser');
      check(await dialog.evaluate(el=>el.matches(':modal')),'property chooser is not a native modal');
      await first.focus();await page.keyboard.press('Shift+Tab');check(await last.evaluate(el=>el===document.activeElement),'Shift+Tab escaped property chooser');
      await last.focus();await page.keyboard.press('Tab');check(await first.evaluate(el=>el===document.activeElement),'Tab did not wrap to first property');
      check((await first.innerText()).includes('Alex')&&(await dialog.locator('[data-ipp]').nth(1).innerText()).includes('Sam'),'duplicate names lack ownership context');
      check(!await dialog.locator('.qfab-action-label b').count(),'property name interpreted as markup');
      check(await dialog.evaluate(el=>{const r=el.getBoundingClientRect();return el.scrollWidth<=el.clientWidth+1&&r.left>=-1&&r.right<=innerWidth+1&&r.top>=-1&&r.bottom<=innerHeight+1;}),'property chooser overflows viewport');
      await page.locator('#bankImportPickBtn').evaluate(el=>el.focus());check(await dialog.evaluate(el=>el.contains(document.activeElement)),'background accepted keyboard focus through modal');
      if(i===0){const cdp=await page.context().newCDPSession(page),ax=await cdp.send('Accessibility.getFullAXTree');const nodes=ax.nodes.filter(n=>!n.ignored);check(nodes.some(n=>n.role?.value==='dialog'&&n.name?.value==='Choose the statement property'),'native accessibility tree lacks property dialog');check(!nodes.some(n=>n.role?.value==='button'&&n.name?.value==='Choose a CSV or PDF'),'native accessibility tree exposes background control');await cdp.detach();}
      if(process.env.PROPERTY_PICKER_A11Y){const violations=await dialog.evaluate(async el=>(await window.axe.run(el,{preload:false})).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.failureSummary)})));check(!violations.length,'property picker accessibility: '+JSON.stringify(violations));}
      if(process.env.PROPERTY_PICKER_SHOTS)await page.screenshot({path:path.join(process.env.PROPERTY_PICKER_SHOTS,width+'-'+theme+'.png')});
      if(i%4===0)await page.keyboard.press('Escape');
      else if(i%4===1)await last.click();
      else if(i%4===2)await page.evaluate(()=>history.back());
      else {const box=await dialog.boundingBox();await page.mouse.click(2,Math.max(1,box.y-4));}
      await closed(page);
      check(await page.locator('#bankImportPickBtn').evaluate(el=>el===document.activeElement),'cancel did not restore chooser opener');
      check(!await page.evaluate(()=>window.__propertyPickerCalls.length),'cancellation selected a property');i++;
    }
    check(await st(page,'JSON.stringify(state)')===before&&await page.evaluate(()=>localStorage.getItem('wealthPlanner.v1'))===saved,'property choices or cancellation changed household data');
    await open(page);await page.evaluate(async()=>{const m=await import('/src/state.js');m.state.properties.reverse();});
    await page.locator('[data-ipp="example-property-b"]').click();await closed(page);
    await waited(page,()=>window.__propertyPickerCalls.length===1,'property selection callback');
    check(await page.evaluate(()=>window.__propertyPickerCalls[0].id==='example-property-b'&&!window.__propertyPickerCalls[0].open),'reordering redirected choice or callback ran before closure');
    for(const mode of ['deleted','replaced','household','kind']){
      await setup(page);await open(page);
      await page.evaluate(async mode=>{const m=await import('/src/state.js');if(mode==='household')m.setState(JSON.parse(JSON.stringify(m.state)));else if(mode==='deleted')m.state.properties=m.state.properties.filter(p=>p.id!=='example-property-a');else if(mode==='replaced')m.state.properties[0]={...m.state.properties[0]};else m.state.properties[0].kind='PPOR';},mode);
      await page.locator('[data-ipp="example-property-a"]').click();await closed(page);
      await page.locator('#toastWrap').getByText('That property or statement is no longer available. Choose the statement again.',{exact:true}).last().waitFor();
      check(!await page.evaluate(()=>window.__propertyPickerCalls.length),'stale '+mode+' property was selected');
    }
    await setup(page);await open(page);
    await page.locator('#bankImportPickBtn').evaluate(el=>el.replaceWith(el.cloneNode(true)));
    await page.keyboard.press('Escape');await closed(page);check(await page.locator('#bankImportPickBtn').evaluate(el=>el===document.activeElement),'replacement opener did not receive focus');
    await open(page);await page.locator('#bankImportPickBtn').evaluate(el=>el.hidden=true);await page.keyboard.press('Escape');await closed(page);
    check(await page.evaluate(()=>document.activeElement!==document.body&&!!document.activeElement.getClientRects().length),'hidden opener left focus on body');
    await page.locator('#bankImportPickBtn').evaluate(el=>el.hidden=false);
    await page.setViewportSize({width:320,height:300});
    await page.evaluate(async()=>{const m=await import('/src/state.js'),p=m.state.properties[0];m.state.properties=Array.from({length:30},(_,i)=>({...p,id:'example-many-'+i,what:'Example property '+i+' with a longer descriptive name'}));});
    await open(page);const dialog=page.getByRole('dialog',{name:'Choose the statement property'});await dialog.locator('[data-ipp]').last().focus();
    check(await dialog.evaluate(el=>{const r=el.getBoundingClientRect(),a=document.activeElement.getBoundingClientRect();return el.scrollHeight>el.clientHeight&&r.top>=0&&r.bottom<=innerHeight+1&&a.top>=r.top&&a.bottom<=r.bottom;}),'short-screen list cannot scroll focused choice into view');
    await page.keyboard.press('Escape');await closed(page);
    await setup(page);await page.setViewportSize({width:390,height:844});await open(page);
    await page.evaluate(async()=>{const m=await import('/src/components/rentstatement.js');m.chooseInvestmentProperty('Second chooser',()=>window.__propertyPickerCalls.push({id:'unexpected'}));});
    check(await page.getByRole('dialog').count()===1,'reentrant chooser opened another modal');
    await page.locator('[data-ipp]').first().evaluate(el=>{el.click();el.click();});await closed(page);await waited(page,()=>window.__propertyPickerCalls.length>0,'one selection after double activation');
    check(await page.evaluate(()=>window.__propertyPickerCalls.length)===1,'double activation invoked selection twice');
    await open(page);await page.evaluate(()=>{window.__pickerBack=history.back;history.back=()=>{};});
    try{await page.locator('[data-ipp]').first().click();await closed(page);check(!await page.evaluate(()=>window.__propertyPickerCalls.length),'unconfirmed history close selected property');}
    finally{await page.evaluate(()=>history.back=window.__pickerBack);}
    await setup(page);await page.evaluate(async()=>{const m=await import('/src/state.js');m.state.properties=m.state.properties.slice(0,1);const r=await import('/src/components/rentstatement.js');r.chooseInvestmentProperty('One property',p=>window.__propertyPickerCalls.push({id:p.id}));});
    check(await page.evaluate(()=>window.__propertyPickerCalls.length)===1&&!await page.locator('[data-ipp]').count(),'one-property shortcut changed');
    await page.evaluate(async()=>{const m=await import('/src/state.js');m.state.properties=[];window.__propertyPickerCalls=[];(await import('/src/components/rentstatement.js')).chooseInvestmentProperty('No properties',p=>window.__propertyPickerCalls.push({id:p.id}));});
    check(!await page.evaluate(()=>window.__propertyPickerCalls.length)&&!await page.locator('[data-ipp]').count(),'empty household selected a property');
    await page.locator('#toastWrap').getByText('Add the investment property first (Accounts → Property), then log its statements there',{exact:true}).waitFor();
    const touch=await fresh({touch:true});
    try{await quiet(touch.page);await go(touch.page,'expenses','data-expenses-sub','spending');await setup(touch.page);await open(touch.page);await touch.page.locator('[data-ipp="example-property-b"]').tap();await closed(touch.page);await waited(touch.page,()=>window.__propertyPickerCalls.length===1,'touch property choice');check(await touch.page.evaluate(()=>window.__propertyPickerCalls[0].id)==='example-property-b','touch selected wrong property');await open(touch.page);await touch.page.locator('[data-ipp-close]').tap();await closed(touch.page);check(!await touch.page.evaluate(()=>window.__propertyPickerCalls.length),'touch cancellation chose property');check(!touch.errors.length,'touch picker errors: '+touch.errors.join('; '));}
    finally{await touch.ctx.close();}
  },
  async propertystatementreview(page){
    await quiet(page);await go(page,'expenses','data-expenses-sub','spending');
    const original=await st(page,'JSON.stringify(state)');
    const saved=await page.evaluate(()=>localStorage.getItem('wealthPlanner.v1'));
    const panel=()=>page.locator('[data-as-panel][open]').filter({has:page.locator('[data-as-source]')}).first();
    const read=async (p,buffer=agentStatementPdf(),choosing=false)=>{
      await go(p,'expenses','data-expenses-sub','spending');
      await p.evaluate(async bytes=>{
        window.__propertyInboxFile=new File([new Uint8Array(bytes)],'Owner Example.pdf',{type:'application/pdf'});
        await (await import('/src/components/importwiring.js')).checkInbox(false);
      },[...buffer]);
      await p.locator('[data-inbox-next]').click();
      await waited(p,()=>typeof window.__finishBankInbox==='function','inbox file request');
      await p.evaluate(()=>window.__finishBankInbox(false));
      if(choosing) return;
      await waited(p,()=>[...document.querySelectorAll('[data-as-panel]')].some(el=>el.open&&el.getClientRects().length&&Number(el.querySelector('[data-as="rent"]').value)>0),'filled property statement');
    };
    const restore=async()=>page.evaluate(async raw=>{
      const m=await import('/src/state.js');m.setState(JSON.parse(raw));
      (await import('/src/components/redraw.js')).renderAll();window.__bankInboxMarked=0;
    },original);
    await read(page);
    check(!await page.evaluate(()=>window.__bankInboxMarked),'opening property review prematurely moved inbox file to Imported');
    check(await st(page,'JSON.stringify(state)')===original,'reading property statement changed household');
    check(await page.evaluate(()=>localStorage.getItem('wealthPlanner.v1'))===saved,'reading property statement changed saved data');
    check((await panel().locator('[data-as-source]').innerText()).includes('Owner Example.pdf'),'property review has no source filename');
    await panel().locator('[data-as="rent"]').fill('1400');await panel().locator('[data-as="water"]').fill('20');
    await panel().locator('[data-as="otherAmount"]').fill('30');
    const values=()=>panel().locator('[data-as]').evaluateAll(els=>Object.fromEntries(els.map(el=>[el.dataset.as,el.value])));
    const draft=await values();
    await page.evaluate(async()=>{const ui=(await import('/src/components/properties.js')).agentStatementUi;Object.values(ui.reviews)[0].name='Owner Example <b>statement</b> with a long descriptive filename.pdf';});
    await page.locator('#toastWrap .toast-close-btn').evaluateAll(els=>els.forEach(el=>el.click()));
    await waited(page,()=>!document.querySelector('#toastWrap .toast'),'property review notices clear');
    if(process.env.PROPERTY_READ_A11Y){const axe=await import('axe-core');await page.evaluate(axe.default.source);}
    if(process.env.PROPERTY_READ_SHOTS)fs.mkdirSync(process.env.PROPERTY_READ_SHOTS,{recursive:true});
    for(const width of [320,390,768,1280])for(const theme of ['light','dark']){
      await page.setViewportSize({width,height:844});await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
      await page.evaluate(async()=>{(await import('/src/components/redraw.js')).renderAll();});
      check(JSON.stringify(await values())===JSON.stringify(draft),'property review draft lost on redraw');
      check(await panel().evaluate(el=>el.scrollWidth<=el.clientWidth+1),'property review local overflow');
      check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'property review page overflow');
      if(process.env.PROPERTY_READ_A11Y){const violations=await panel().evaluate(async el=>(await window.axe.run(el,{preload:false})).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.failureSummary)})));check(!violations.length,'property review accessibility: '+JSON.stringify(violations));}
      check((await panel().locator('[data-as-source]').innerHTML()).includes('&lt;b&gt;'),'source filename interpreted as markup');
      if(process.env.PROPERTY_READ_SHOTS){await panel().locator('[data-as-source]').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(process.env.PROPERTY_READ_SHOTS,width+'-'+theme+'.png')});}
    }
    await panel().locator('[data-as-discard]').focus();await page.keyboard.press('Enter');
    check(!await page.locator('[data-as-source]').count(),'Discard kept the read');
    check(await page.locator('[data-as-pick]').evaluateAll(els=>els.includes(document.activeElement)),'Discard did not restore file chooser focus');
    check(!await page.evaluate(()=>window.__bankInboxMarked),'Discard moved inbox file');
    check(await st(page,'JSON.stringify(state)')===original,'Discard changed household');
    await read(page);
    await page.evaluate(async()=>{
      const m=await import('/src/state.js'),p=Object.values((await import('/src/components/properties.js')).agentStatementUi.reviews)[0].property;
      m.state.incomeLog.push({id:'example-duplicate',target:'rent:'+p.id,amount:1116,date:'2026-10-31',what:'Example payment',account:''});
    });
    let before=await st(page,'JSON.stringify(state)');await panel().locator('[data-as-log]').click();
    await page.locator('.app-dialog[open] [data-dialog-cancel]').click();
    check(await st(page,'JSON.stringify(state)')===before&&!await page.evaluate(()=>window.__bankInboxMarked),'declined duplicate changed data or moved file');
    await panel().locator('[data-as-log]').click();
    await page.evaluate(async()=>{const m=await import('/src/state.js'),ui=(await import('/src/components/properties.js')).agentStatementUi;const id=Object.keys(ui.reviews)[0];m.state.properties=m.state.properties.filter(p=>p.id!==id);});
    before=await st(page,'JSON.stringify(state)');await page.locator('.app-dialog[open] [data-dialog-submit]').click();
    check(await st(page,'JSON.stringify(state)')===before&&!await page.evaluate(()=>window.__bankInboxMarked),'deleted property accepted duplicate confirmation');
    await restore();await read(page);
    // A newer bank selection invalidates the earlier recognised source, including its completion hook.
    await go(page,'expenses','data-expenses-sub','spending');
    await page.setInputFiles('#bankImportFile',{name:'newer.csv',mimeType:'text/csv',buffer:Buffer.from('Date,Description,Amount\n01/10/2026,Example Market,-100\n')});
    await waited(page,()=>!!document.querySelector('#bankImportConfirmBtn'),'new bank selection');
    await go(page,'properties');before=await st(page,'JSON.stringify(state)');
    await panel().locator('[data-as-log]').click();check(await st(page,'JSON.stringify(state)')===before&&!await page.evaluate(()=>window.__bankInboxMarked),'superseded source was logged');
    await restore();await go(page,'expenses','data-expenses-sub','spending');
    const navigation=await page.evaluate(async()=>{
      const m=await import('/src/state.js'),r=await import('/src/components/rentstatement.js');
      const p=r.investmentProperties()[0],pending=r.openStatementForm(p,{date:'2026-10-31',rent:1000,water:0,fees:100,waterRates:0,others:[],received:900});
      m.setState(JSON.parse(JSON.stringify(m.state)));return pending;
    });
    check(navigation===false&&!await page.locator('[data-as-source]').count(),'replaced household accepted a pending navigation handoff');
    await restore();
    await page.evaluate(async()=>{const m=await import('/src/state.js'),p=structuredClone(m.state.properties.find(p=>p.kind==='IP'));p.id='example-second-property';p.what='2 Example St';m.state.properties.push(p);});
    const unknown=statementPdf([['Example Realty owner statement'],['31 Oct 2026'],['Property: Unknown Example'],['Details','','Money Out','Money In'],['Rent paid to 24/10/2026','','','1,000.00'],['Management Fee','','100.00',''],['You Received','','','','900.00']]);
    before=await st(page,'JSON.stringify(state)');await read(page,unknown,true);await page.locator('[data-ipp]').first().waitFor();
    check(!await page.evaluate(()=>window.__bankInboxMarked),'choosing a property moved inbox file');
    await page.keyboard.press('Escape');await waited(page,()=>!document.querySelector('[data-ipp]'),'property choice cancelled');
    check(await st(page,'JSON.stringify(state)')===before&&!await page.evaluate(()=>window.__bankInboxMarked),'cancelled property choice changed data or moved source');
    await read(page,unknown,true);await page.locator('[data-ipp]').first().waitFor();
    const choice=await page.locator('[data-ipp]').first().getAttribute('data-ipp');
    await page.evaluate(async id=>{const m=await import('/src/state.js');m.state.properties=m.state.properties.filter(p=>p.id!==id);},choice);
    before=await st(page,'JSON.stringify(state)');await page.locator('[data-ipp]').first().click();
    await page.locator('#toastWrap').getByText('That property or statement is no longer available. Choose the statement again.',{exact:true}).waitFor();
    check(await st(page,'JSON.stringify(state)')===before&&!await page.evaluate(()=>window.__bankInboxMarked),'deleted property choice staged data or completed source');
    await restore();await read(page);
    for(const key of ['rent','water','fees','waterRates','otherAmount'])await panel().locator('[data-as="'+key+'"]').fill('0');
    await panel().locator('[data-as-log]').click();check(!await page.evaluate(()=>window.__bankInboxMarked),'empty statement completed inbox file');
    await panel().locator('[data-as="rent"]').fill('1000');await panel().locator('[data-as="fees"]').fill('100');
    const count=await st(page,'state.incomeLog.length');await panel().locator('[data-as-log]').click();
    check(await st(page,'state.incomeLog.length')===count+1&&await page.evaluate(()=>window.__bankInboxMarked)===1,'successful log did not record and complete inbox exactly once');
    await page.locator('#toastWrap .toast-undo-btn').last().click();
    check(await st(page,'state.incomeLog.length')===count,'property statement Undo failed');
    // Storage errors latch saving off for this tab; keep the source pending and allow an unsaved rollback.
    await restore();await read(page);
    const beforeFailedSave=await page.evaluate(()=>localStorage.getItem('wealthPlanner.v1'));
    await page.evaluate(()=>{window.__statementSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='wealthPlanner.v1')throw new Error('Synthetic storage failure');return window.__statementSetItem.call(this,key,value);};});
    await panel().locator('[data-as-log]').click();
    check(!await page.evaluate(()=>window.__bankInboxMarked),'failed save completed inbox file');
    check(await st(page,'state.incomeLog.length')===count+1,'storage failure test did not stage an unsaved log');
    check(await panel().locator('[data-as-log]').isDisabled(),'failed save allows duplicate logging');
    await panel().locator('[data-as-discard]').click();
    check(await st(page,'state.incomeLog.length')===count&&!await page.evaluate(()=>window.__bankInboxMarked),'discard failed to remove unsaved records or moved source');
    check(await page.evaluate(()=>localStorage.getItem('wealthPlanner.v1'))===beforeFailedSave,'failed save or discard changed stored data');
    await page.evaluate(()=>Storage.prototype.setItem=window.__statementSetItem);
    // Direct PDF selection uses a keyboard-operable button and the same staged review.
    await restore();await page.evaluate(async()=>{const r=await import('/src/components/rentstatement.js');await r.openStatementForm(r.investmentProperties()[0]);});
    const picker=page.locator('[data-as-pick]:visible').first(),chooser=page.waitForEvent('filechooser');await picker.focus();await page.keyboard.press('Enter');
    await (await chooser).setFiles({name:'Direct Example.pdf',mimeType:'application/pdf',buffer:agentStatementPdf()});
    await waited(page,()=>!!document.querySelector('[data-as-source]'),'direct PDF staged review');
    check((await panel().locator('[data-as-source]').innerText()).includes('Direct Example.pdf'),'direct PDF retained previous source');
    await page.evaluate(()=>{const original=File.prototype.arrayBuffer;File.prototype.arrayBuffer=function(){const file=this;if(file.name==='Slow Example.pdf')return new Promise(resolve=>window.__finishPropertyRead=()=>original.call(file).then(resolve));return original.call(file);};});
    await panel().locator('[data-as-pdf]').setInputFiles({name:'Slow Example.pdf',mimeType:'application/pdf',buffer:agentStatementPdf()});
    await waited(page,()=>typeof window.__finishPropertyRead==='function','direct PDF read held');
    await page.evaluate(async()=>{const m=await import('/src/state.js');m.setState(JSON.parse(JSON.stringify(m.state)));await window.__finishPropertyRead();});
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    check(!await page.locator('[data-as-source]').count(),'late direct PDF filled a replacement household');
    const touch=await fresh({touch:true,propertyReview:true});
    try{await quiet(touch.page);await read(touch.page);await touch.page.locator('[data-as-discard]').tap();check(!await touch.page.evaluate(()=>window.__bankInboxMarked),'touch Discard moved source');check(!touch.errors.length,'touch property review errors: '+touch.errors.join('; '));}
    finally{await touch.ctx.close();}
  },
  async bankconfirmfailure(page){
    const csv='Date,Description,Amount\n01/10/2026,Example Market,-100\n02/10/2026,Example Cafe,-20\n';
    const setup=async(p,text=csv,loan=false)=>{
      await quiet(p);await go(p,'expenses','data-expenses-sub','spending');
      await p.evaluate(async csv=>{
        window.__bankInboxCsv=csv;
        await (await import('/src/components/importwiring.js')).checkInbox(false);
        document.getElementById('bankImportCard').open=true;
      },text);
      await p.locator('[data-inbox-next]').click();
      await waited(p,()=>!!window.__finishBankInbox,'statement inbox read');
      await p.evaluate(()=>window.__finishBankInbox(false));
      await p.locator('#bankImportConfirmBtn').waitFor();
      if(loan){await p.locator('[data-bank-loanpick]').click();await p.locator('[data-bank-loan]').waitFor();}
    };
    const failStorage=p=>p.evaluate(()=>{
      window.__bankOriginalSetItem=Storage.prototype.setItem;
      Storage.prototype.setItem=function(key,value){
        if(key==='wealthPlanner.v1') throw new Error('Synthetic import save failure');
        return window.__bankOriginalSetItem.call(this,key,value);
      };
    });
    const saved=p=>p.evaluate(()=>localStorage.getItem('wealthPlanner.v1'));
    const financial=p=>st(p,'JSON.stringify([state.transactions,state.incomeLog,state.transfers,state.importRules,state.shared,state.accounts,state.assets,state.debts,state.properties])');
    await setup(page);
    const durable=await saved(page),count=await st(page,'state.transactions.length');
    await failStorage(page);
    await page.locator('#bankImportConfirmBtn').click();
    check(await saved(page)===durable,'failed save changed durable household data');
    check(!await page.evaluate(()=>window.__bankInboxMarked),'failed save marked the statement imported');
    const status=page.locator('[data-bank-save-status]');await status.waitFor();
    check(await status.evaluate(el=>document.activeElement===el),'save failure status did not receive focus');
    check(await st(page,'state.transactions.length')===count+2,'failure did not retain the unsaved records described by recovery');
    check(!await page.locator('#bankImportConfirmBtn').count()&&!/Imported 2 transactions/.test(await page.locator('#toastWrap').innerText()),'failed save still offered confirmation or claimed success');
    const unsaved=await financial(page);
    const result=await page.evaluate(async()=> (await import('/src/components/bank-import.js')).commitBankImport());
    check(result.saved===false&&result.ids.length===0&&await financial(page)===unsaved,'repeated failed confirmation duplicated or changed financial records');
    if(process.env.BANK_SAVE_A11Y){const axe=await import('axe-core');await page.evaluate(axe.default.source);}
    if(process.env.BANK_SAVE_SHOTS)fs.mkdirSync(process.env.BANK_SAVE_SHOTS,{recursive:true});
    for(const width of [320,390,768,1280]) for(const theme of ['light','dark']){
      await page.setViewportSize({width,height:844});await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
      const panel=page.locator('#bankImportPanel');
      check(await panel.evaluate((el,w)=>document.documentElement.scrollWidth<=w+1&&el.scrollWidth<=el.clientWidth+1,width),'save recovery overflow '+width+'/'+theme);
      if(process.env.BANK_SAVE_A11Y){const violations=await panel.evaluate(async el=>(await window.axe.run(el,{preload:false})).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.failureSummary)})));check(!violations.length,'bank save recovery accessibility: '+JSON.stringify(violations));}
      if(process.env.BANK_SAVE_SHOTS)await panel.screenshot({path:path.join(process.env.BANK_SAVE_SHOTS,width+'-'+theme+'.png')});
    }
    await page.evaluate(()=>{window.__bankObjectURL=URL.createObjectURL;URL.createObjectURL=()=>{throw new Error('Synthetic recovery download failure');};});
    await page.locator('[data-bank-save-export]').click();
    await page.locator('#toastWrap').getByText("Couldn't download the file. Try again from a full browser tab.",{exact:true}).waitFor();
    check(await saved(page)===durable&&await financial(page)===unsaved&&!await page.evaluate(()=>window.__bankInboxMarked),'failed recovery download changed data or completed source');
    await page.evaluate(()=>URL.createObjectURL=window.__bankObjectURL);
    await status.focus();await page.keyboard.press('Tab');
    check(await page.locator('[data-bank-save-export]').evaluate(el=>document.activeElement===el),'unsaved copy unreachable by keyboard');
    const pending=page.waitForEvent('download');await page.keyboard.press('Enter');
    const download=await pending,stream=await download.createReadStream();let text='';for await(const chunk of stream)text+=chunk.toString();
    check(JSON.parse(text).transactions.length===count+2&&download.suggestedFilename().startsWith('wealth-planner-unsaved-'),'recovery copy omitted unsaved records or claimed to be a saved backup');
    check(await saved(page)===durable&&await financial(page)===unsaved&&!await page.evaluate(()=>window.__bankInboxMarked),'recovery export changed durable data, records or source completion');
    await page.locator('[data-bank-save-close]').click();
    check(await page.locator('#bankImportPanel').isHidden()&&await page.locator('#bankImportPickBtn').evaluate(el=>document.activeElement===el),'closing recovery did not return to file selection');
    check(await financial(page)===unsaved,'closing recovery silently discarded unsaved records');
    await page.evaluate(async()=> (await import('/src/components/importwiring.js')).checkInbox(false));
    check(await page.locator('[data-inbox-next]').isVisible(),'failed source is unavailable for a later review');
    await page.evaluate(()=>Storage.prototype.setItem=window.__bankOriginalSetItem);
    await go(page,'dashboard');await page.reload();await quiet(page);
    check(await st(page,'state.transactions.length')===count,'reload kept records that never reached storage');
    await setup(page);await page.locator('#bankImportConfirmBtn').click();
    check(await page.evaluate(()=>window.__bankInboxMarked)===1&&await stored(page,'state.transactions.length')===count+2,'successful confirmation did not save and complete the source once');
    await page.locator('#toastWrap .toast-undo-btn').last().click();
    check(await stored(page,'state.transactions.length')===count,'successful confirmation lost its existing Undo');
    // A stale household revision rejects persistence without throwing or disabling Storage itself.
    const conflict=await fresh({bankRead:true});
    try{
      await setup(conflict.page);
      const theirs=await conflict.page.evaluate(()=>{
        const other=JSON.parse(localStorage.getItem('wealthPlanner.v1'));
        other.budgetGroupBy=other.budgetGroupBy==='category'?'type':'category';
        const text=JSON.stringify(other);localStorage.setItem('wealthPlanner.v1',text);return text;
      });
      await conflict.page.locator('#bankImportConfirmBtn').click();
      await conflict.page.locator('[data-bank-save-status]').waitFor();
      check(await saved(conflict.page)===theirs&&!await conflict.page.evaluate(()=>window.__bankInboxMarked),'save conflict overwrote the newer household or completed the source');
      await conflict.page.locator('[data-storage-keep]').click();await answerDialog(conflict.page,true);
      await waited(conflict.page,()=>document.querySelector('[data-bank-save-status]')?.textContent.startsWith('Save warning resolved'),'recovery after explicitly keeping this tab’s version');
      check(await stored(conflict.page,'state.transactions.length')===count+2&&!await conflict.page.evaluate(()=>window.__bankInboxMarked),'later save did not persist the chosen household or prematurely completed source');
      if(process.env.BANK_SAVE_A11Y){
        const axe=await import('axe-core');await conflict.page.evaluate(axe.default.source);
        for(const width of [320,390,768,1280]) for(const theme of ['light','dark']){
          await conflict.page.setViewportSize({width,height:844});await conflict.page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
          const panel=conflict.page.locator('#bankImportPanel');
          check(await panel.evaluate((el,w)=>document.documentElement.scrollWidth<=w+1&&el.scrollWidth<=el.clientWidth+1,width),'resolved save recovery overflow');
          const violations=await panel.evaluate(async el=>(await window.axe.run(el,{preload:false})).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.failureSummary)})));
          check(!violations.length,'resolved bank save accessibility: '+JSON.stringify(violations));
          if(process.env.BANK_SAVE_SHOTS)await panel.screenshot({path:path.join(process.env.BANK_SAVE_SHOTS,width+'-'+theme+'-resolved.png')});
        }
      }
      await conflict.page.evaluate(async()=>{const m=await import('/src/state.js');m.setState(JSON.parse(JSON.stringify(m.state)));});
      check(await conflict.page.locator('#bankImportPanel').isHidden()&&!await conflict.page.evaluate(()=>window.__bankInboxMarked),'household replacement kept failed confirmation or completed source');
      check(!conflict.errors.length,'conflict recovery errors: '+conflict.errors.join('; '));
    }finally{await conflict.ctx.close();}
    const loan=await fresh({bankRead:true,touch:true});
    try{
      await setup(loan.page,LOAN_STATEMENT_CSV,true);
      const before=await saved(loan.page),charges=await st(loan.page,'state.properties.reduce((n,p)=>n+(p.loans||[]).reduce((m,l)=>m+(l.charges||[]).length,0),0)'),spending=await st(loan.page,'state.transactions.length');
      await failStorage(loan.page);await loan.page.locator('#bankImportConfirmBtn').tap();
      await loan.page.locator('[data-bank-save-status]').waitFor();
      check(await saved(loan.page)===before&&!await loan.page.evaluate(()=>window.__bankInboxMarked),'failed loan save changed durable data or completed source');
      check(await st(loan.page,'state.properties.reduce((n,p)=>n+(p.loans||[]).reduce((m,l)=>m+(l.charges||[]).length,0),0)')===charges+5&&await st(loan.page,'state.transactions.length')===spending,'loan attempt did not retain its charges separately from spending');
      const attempt=await financial(loan.page);
      await loan.page.evaluate(async()=> (await import('/src/components/bank-import.js')).commitBankImport());
      check(await financial(loan.page)===attempt,'failed loan confirmation duplicated charges or account changes');
      await loan.page.locator('[data-bank-save-close]').tap();
      check(await loan.page.locator('#bankImportPanel').isHidden()&&!await loan.page.evaluate(()=>window.__bankInboxMarked),'touch close completed failed loan source');
      check(!loan.errors.length,'loan recovery errors: '+loan.errors.join('; '));
    }finally{await loan.ctx.close();}
    const chosen=await fresh({touch:true});
    try{
      await quiet(chosen.page);await go(chosen.page,'expenses','data-expenses-sub','spending');
      await chosen.page.locator('#bankImportCard').evaluate(el=>el.open=true);
      await chosen.page.setInputFiles('#bankImportFile',{name:'Example <b>statement</b> with a long source name.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
      await chosen.page.locator('#bankImportConfirmBtn').waitFor();
      await failStorage(chosen.page);await chosen.page.locator('#bankImportConfirmBtn').tap();
      const status=chosen.page.locator('[data-bank-save-status]');await status.waitFor();
      check((await status.innerText()).includes('<b>statement</b>')&&!await status.locator('b').count(),'failed source name was interpreted as markup');
      const panel=chosen.page.locator('#bankImportPanel');
      check((await panel.innerText()).includes('Keep the original statement')&&!(await panel.innerText()).includes('inbox statement'),'chosen-file recovery falsely promised an inbox copy');
      await chosen.page.setViewportSize({width:320,height:844});
      check(await panel.evaluate(el=>document.documentElement.scrollWidth<=320&&el.scrollWidth<=el.clientWidth+1),'long failed filename overflows on mobile');
      check(!chosen.errors.length,'chosen statement recovery errors: '+chosen.errors.join('; '));
    }finally{await chosen.ctx.close();}
  },
  async bankreadrecovery(page){
    await quiet(page);await go(page,'expenses','data-expenses-sub','spending');
    const csv='Date,Description,Amount\n01/10/2026,Example Market,-100\n02/10/2026,Example Cafe,-20\n';
    const pick=async (name,buffer=Buffer.from(csv))=>page.setInputFiles('#bankImportFile',{name,mimeType:name.endsWith('.pdf')?'application/pdf':'text/csv',buffer});
    const review=()=>waited(page,()=>!!document.querySelector('#bankImportConfirmBtn'),'statement review');
    const reading=()=>waited(page,()=>document.querySelector('[data-bank-read-status]')?.textContent.startsWith('Reading '),'statement loading');
    const error=()=>waited(page,()=>!!document.querySelector('[data-bank-read-retry]'),'statement read error with Retry');
    await page.evaluate(()=>{
      window.__bankPending={};window.__bankFailures=new Set();
      // Also hold the released FileReader path so the same regression proves the old preview bug.
      const readAsText=FileReader.prototype.readAsText;
      FileReader.prototype.readAsText=function(file){if(file.name.startsWith('slow-'))return;return readAsText.call(this,file);};
      for(const method of ['text','arrayBuffer']){
        const original=File.prototype[method];
        File.prototype[method]=function(){
          const file=this;
          if(file.name.startsWith('slow-'))return new Promise((resolve,reject)=>{
            window.__bankPending[file.name]=fail=>{if(fail){reject(new Error('Synthetic read failure'));return;}return original.call(file).then(resolve);};
          });
          if(file.name.startsWith('retry-')&&!window.__bankFailures.has(file.name)){
            window.__bankFailures.add(file.name);return Promise.reject(new Error('Synthetic first read failure'));
          }
          if(file.name==='throw.csv')throw new Error('Synthetic synchronous read failure');
          return original.call(file);
        };
      }
    });
    const finish=async (name,fail=false)=>{
      await page.evaluate(async ({name,fail})=>{await window.__bankPending[name](fail);},{name,fail});
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    };
    const before=await st(page,'JSON.stringify(state)'),saved=await page.evaluate(()=>localStorage.getItem('wealthPlanner.v1'));
    await pick('previous.csv');await review();
    const name='slow-Example <b>statement</b> with a long file name.csv';
    await pick(name);
    check(!await page.locator('#bankImportConfirmBtn').count(),'old preview remains confirmable while reading');
    await reading();
    check(await page.evaluate(async()=>!(await import('/src/components/bank-import.js')).bankImport),'previous in-memory review retained');
    check(!await page.locator('[data-bank-read-status] b').count(),'file name interpreted as markup');
    if(process.env.BANK_READ_A11Y){const axe=await import('axe-core');await page.evaluate(axe.default.source);}
    if(process.env.BANK_READ_SHOTS)fs.mkdirSync(process.env.BANK_READ_SHOTS,{recursive:true});
    for(const width of [320,390,768,1280])for(const theme of ['light','dark']){
      await page.setViewportSize({width,height:844});await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
      const audit=async state=>{
        check(await page.locator('#bankImportPanel').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'statement '+state+' local overflow');
        check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'statement '+state+' page overflow');
        if(process.env.BANK_READ_A11Y){const violations=await page.locator('#bankImportPanel').evaluate(async el=>(await window.axe.run(el,{preload:false})).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.failureSummary)})));check(!violations.length,'bank read '+state+' accessibility: '+JSON.stringify(violations));}
        if(process.env.BANK_READ_SHOTS)await page.locator('#bankImportPanel').screenshot({path:path.join(process.env.BANK_READ_SHOTS,width+'-'+theme+'-'+state+'.png')});
      };
      await audit('loading');
      await finish(name,true);await error();await audit('error');
      check(await page.locator('[data-bank-read-status]').evaluate(el=>el===document.activeElement),'read error focus missing');
      await page.keyboard.press('Tab');check(await page.locator('[data-bank-read-retry]').evaluate(el=>el===document.activeElement),'Retry unreachable by keyboard');
      await page.keyboard.press('Enter');await reading();
    }
    await page.locator('#bankImportCancelBtn').click();
    check(await page.locator('#bankImportPanel').isHidden(),'cancelled read left panel visible');
    check(await page.locator('#bankImportPickBtn').evaluate(el=>el===document.activeElement),'Cancel did not restore file chooser focus');
    await finish(name);check(await page.locator('#bankImportPanel').isHidden(),'cancelled successful read reopened preview');
    await pick('retry-example.csv');await error();await page.locator('[data-bank-read-retry]').click();await review();
    check((await page.locator('#bankImportPanel').innerText()).includes('retry-example.csv'),'Retry lost selected file');
    await pick('slow-older.csv');await reading();await pick('newer.csv',Buffer.from(csv.replaceAll('Example','Another')));await review();
    await finish('slow-older.csv');check((await page.locator('#bankImportPanel').innerText()).includes('newer.csv'),'older success replaced newer preview');
    await pick('slow-failure.csv');await reading();await pick('latest.csv');await review();await finish('slow-failure.csv',true);
    check(!await page.locator('[data-bank-read-retry]').count()&&(await page.locator('#bankImportPanel').innerText()).includes('latest.csv'),'older failure replaced newer preview');
    await pick('throw.csv');await error();await page.locator('#bankImportCancelBtn').click();
    await pick('retry-example.pdf',statementPdf());await error();await page.locator('[data-bank-read-retry]').click();await review();
    await pick('empty.pdf',statementPdf([['Example statement with no transactions']]));await error();
    check((await page.locator('[data-bank-read-status]').innerText()).includes('CSV export'),'empty PDF lacks recovery advice');
    await page.locator('#bankImportCancelBtn').click();
    await pick('broken.pdf',Buffer.from('invalid synthetic PDF'));await error();await page.locator('#bankImportCancelBtn').click();
    // Pause after real PDF extraction, not only before bytes arrive. Cancelled recognition must not navigate.
    const payslip=statementPdf([['Alex'],['Gross Pay','2,000.00'],['Tax','400.00'],['Net Pay','1,600.00']]);
    for(const [buffer,fail] of [[statementPdf(),false],[payslip,false],[agentStatementPdf(),false],[statementPdf(),true]]){
      await page.evaluate(()=>{window.__holdBankPdf=true;window.__bankPdfReady=null;});
      await pick('extraction.pdf',buffer);await reading();
      await waited(page,()=>!!window.__bankPdfReady,'PDF extraction starts');await page.evaluate(()=>window.__bankPdfReady);
      await page.locator('#bankImportCancelBtn').click();await page.evaluate(fail=>window.__finishBankPdf(fail),fail);
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      check(await page.locator('#bankImportPanel').isHidden()&&await page.evaluate(()=>document.body.dataset.currentPage==='expenses'),'cancelled PDF reopened review or recognition destination');
      check(!await page.locator('.app-dialog[open]').count(),'cancelled property statement opened a chooser');
    }
    await pick('slow-household.csv');await reading();
    await page.evaluate(async()=>{const m=await import('/src/state.js');m.setState(JSON.parse(JSON.stringify(m.state)));});
    await finish('slow-household.csv');check(await page.locator('#bankImportPanel').isHidden(),'replaced household accepted an older read');
    await pick('replaced-review.csv');await review();
    await page.evaluate(async()=>{const m=await import('/src/state.js');m.setState(JSON.parse(JSON.stringify(m.state)));});
    check(await page.locator('#bankImportPanel').isHidden(),'household replacement kept an old confirmation');
    await page.evaluate(text=>window.__bankInboxCsv=text,csv);
    const openInbox=async()=>{await page.locator('[data-inbox-next]').click();await reading();};
    await page.locator('#bankImportCard').evaluate(el=>el.open=false);
    await go(page,'dashboard');
    await page.evaluate(async()=>{const m=await import('/src/components/importwiring.js');await m.checkInbox(true);});
    await page.locator('#toastWrap .toast-undo-btn').filter({hasText:'Review'}).last().click();
    await waited(page,()=>document.body.dataset.currentPage==='expenses'&&document.querySelector('[data-bank-read-status]')===document.activeElement,'inbox navigation and loading focus');
    await page.evaluate(()=>window.__finishBankInbox(true));await error();
    await page.locator('[data-bank-read-retry]').click();await reading();await page.evaluate(()=>window.__finishBankInbox(false));await review();
    check(!await page.evaluate(()=>window.__bankInboxMarked),'inbox file marked imported before confirmation');
    await page.locator('#bankImportCancelBtn').click();
    await openInbox();await page.locator('#bankImportCancelBtn').click();await page.evaluate(()=>window.__finishBankInbox(false));
    await page.evaluate(()=>new Promise(requestAnimationFrame));check(await page.locator('#bankImportPanel').isHidden(),'cancelled inbox retrieval reopened preview');
    await openInbox();await pick('chosen-after-inbox.csv');await review();await page.evaluate(()=>window.__finishBankInbox(false));
    await page.evaluate(()=>new Promise(requestAnimationFrame));check((await page.locator('#bankImportPanel').innerText()).includes('chosen-after-inbox.csv'),'late inbox retrieval replaced chosen file');
    await openInbox();await page.evaluate(async()=>{const m=await import('/src/state.js');m.setState(JSON.parse(JSON.stringify(m.state)));});
    await page.evaluate(()=>window.__finishBankInbox(false));await page.evaluate(()=>new Promise(requestAnimationFrame));
    check(await page.locator('#bankImportPanel').isHidden(),'household replacement accepted late inbox retrieval');
    check(!await page.evaluate(()=>window.__bankInboxMarked),'failure or cancellation moved inbox file');
    check(await st(page,'JSON.stringify(state)')===before,'reading, retry or cancellation changed household data');
    check(await page.evaluate(()=>localStorage.getItem('wealthPlanner.v1'))===saved,'reading, retry or cancellation changed saved data');
    // Keep confirmation, inbox completion and Undo on the existing path.
    await openInbox();await page.evaluate(()=>window.__finishBankInbox(false));await review();const count=await st(page,'state.transactions.length');
    await page.locator('#bankImportConfirmBtn').click();
    check(await st(page,'state.transactions.length')===count+2,'reviewed statement no longer imports purchases');
    check(await page.evaluate(()=>window.__bankInboxMarked)===1,'confirmed inbox file was not marked imported exactly once');
    await page.locator('#toastWrap .toast-undo-btn').last().click();
    check(await st(page,'state.transactions.length')===count,'statement Undo no longer removes imported purchases');
    const touch=await fresh({touch:true});
    try{
      await quiet(touch.page);await go(touch.page,'expenses','data-expenses-sub','spending');
      await touch.page.evaluate(()=>{File.prototype.text=()=>Promise.reject(new Error('Synthetic touch read failure'));});
      await touch.page.setInputFiles('#bankImportFile',{name:'touch.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
      await waited(touch.page,()=>!!document.querySelector('[data-bank-read-retry]'),'touch error');
      await touch.page.locator('[data-bank-read-retry]').tap();await waited(touch.page,()=>!!document.querySelector('[data-bank-read-retry]'),'touch retry');
      await touch.page.locator('#bankImportCancelBtn').tap();check(await touch.page.locator('#bankImportPanel').isHidden(),'touch cancel failed');
      check(!touch.errors.length,'touch bank read errors: '+touch.errors.join('; '));
    }finally{await touch.ctx.close();}
  },
  async usermenubounds(page){
    await quiet(page);
    await waited(page,()=>!document.querySelector('#toastWrap .toast'),'sample-data toast clears');
    const before=await st(page,'JSON.stringify(state)');
    if(process.env.MENU_A11Y){const axe=await import('axe-core');await page.evaluate(axe.default.source);}
    if(process.env.MENU_SHOTS) fs.mkdirSync(process.env.MENU_SHOTS,{recursive:true});
    const metrics=()=>page.evaluate(()=>{
      const menu=document.querySelector('.avatar-menu'), r=menu.getBoundingClientRect(), vv=visualViewport;
      const v={left:vv?.offsetLeft||0,top:vv?.offsetTop||0,width:vv?.width||innerWidth,height:vv?.height||innerHeight};
      let bottom=v.top+v.height;const nav=document.querySelector('.mobile-tabbar'),nr=nav.getBoundingClientRect();
      if(nav.getClientRects().length&&nr.top>v.top&&nr.top<bottom)bottom=nr.top;
      const last=menu.querySelector('[data-avatar-go="updates"]'),l=last.getBoundingClientRect(), version=menu.querySelector('.avatar-version').getBoundingClientRect();
      const hit=document.elementFromPoint(l.left+l.width/2,l.top+l.height/2);
      return {inside:r.left>=v.left-1&&r.right<=v.left+v.width+1&&r.top>=v.top-1&&r.bottom<=bottom-4,
        horizontal:menu.scrollWidth<=menu.clientWidth+1,scrollable:menu.scrollHeight>menu.clientHeight,
        lastVisible:l.top>=r.top&&l.bottom<=r.bottom&&l.bottom<=bottom,hit:hit===last||last.contains(hit),hitElement:hit?.outerHTML.slice(0,300),lastRect:{top:l.top,bottom:l.bottom},
        versionVisible:version.top>=r.top&&version.bottom<=r.bottom,scrollTop:menu.scrollTop,rect:{top:r.top,bottom:r.bottom,left:r.left,right:r.right},bottom};
    });
    const bounded=async what=>{await waited(page,()=>{
      const menu=document.querySelector('.avatar-menu'),r=menu.getBoundingClientRect(),vv=visualViewport;
      const left=vv?.offsetLeft||0,top=vv?.offsetTop||0,right=left+(vv?.width||innerWidth);let bottom=top+(vv?.height||innerHeight);
      const nav=document.querySelector('.mobile-tabbar'),nr=nav.getBoundingClientRect();if(nav.getClientRects().length&&nr.top>top&&nr.top<bottom)bottom=nr.top;
      return !menu.hidden&&r.left>=left-1&&r.right<=right+1&&r.top>=top-1&&r.bottom<=bottom-4;
    },what);};
    for(const width of [320,390,768,1280]) for(const theme of ['light','dark']){
      await page.setViewportSize({width,height:844});await page.evaluate(t=>{document.documentElement.dataset.theme=t;window.scrollTo(0,0);},theme);
      await page.locator('#avatarBtn').click();
      if(process.env.MENU_SHOTS) await page.screenshot({path:path.join(process.env.MENU_SHOTS,width+'-'+theme+'-open.png')});
      check((await metrics()).inside,'user menu extends outside usable viewport: '+JSON.stringify(await metrics()));
      check((await metrics()).horizontal,'user menu has horizontal overflow');
      if(process.env.MENU_A11Y){const violations=await page.locator('.avatar-menu').evaluate(async el=>(await window.axe.run(el,{preload:false})).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.failureSummary)})));check(!violations.length,'user menu accessibility: '+JSON.stringify(violations));}
      // Native Tab must scroll the last action into view, without the page's + covering it.
      const count=await page.locator('.avatar-menu button:visible,.avatar-menu a:visible').count();
      for(let i=0;i<count+1;i++){
        await page.keyboard.press('Tab');
        if(await page.locator('[data-avatar-go="updates"]').evaluate(el=>el===document.activeElement)) break;
      }
      check(await page.locator('[data-avatar-go="updates"]').evaluate(el=>el===document.activeElement),'last menu action unreachable by Tab');
      check((await metrics()).lastVisible&&(await metrics()).hit,'last menu action is clipped or covered '+width+'/'+theme+': '+JSON.stringify(await metrics()));
      await page.locator('.avatar-menu').evaluate(el=>el.scrollTop=el.scrollHeight);
      check((await metrics()).versionVisible,'version clipped at the menu bottom');
      if(process.env.MENU_SHOTS) await page.screenshot({path:path.join(process.env.MENU_SHOTS,width+'-'+theme+'-bottom.png')});
      await page.keyboard.press('Escape');
      check(await page.locator('.avatar-menu').evaluate(el=>el.hidden)&&await page.locator('#avatarBtn').evaluate(el=>el===document.activeElement),'Escape did not close/restore focus');
    }
    await page.setViewportSize({width:390,height:844});
    await page.evaluate(()=>window.scrollTo(0,500));
    await waited(page,()=>document.querySelector('.app-topbar').classList.contains('is-compact'),'compact header');
    await page.locator('#avatarBtn').click();await bounded('compact menu fits');
    await page.setViewportSize({width:844,height:390});await bounded('landscape menu fits');
    await page.setViewportSize({width:320,height:240});await bounded('short-screen menu fits');
    check((await metrics()).scrollable,'short-screen menu cannot scroll');
    await page.setViewportSize({width:390,height:700});
    await page.evaluate(()=>{
      document.querySelectorAll('.avatar-menu .btn').forEach(el=>el.style.fontSize='20px');
      document.querySelector('.avatar-menu a').textContent='Request a feature with a longer descriptive label';
      document.getElementById('shareBtn').hidden=false;
      document.querySelector('.mobile-tabbar').style.paddingBottom='40px';
    });
    await bounded('large text and safe-area-sized navigation fit');
    await page.locator('.avatar-menu').evaluate(el=>el.scrollTop=el.scrollHeight);
    check((await metrics()).inside&&(await metrics()).horizontal&&(await metrics()).versionVisible,'larger text or safe-area simulation clipped the menu');
    const cdp=await page.context().newCDPSession(page);
    await cdp.send('Emulation.setPageScaleFactor',{pageScaleFactor:1.5});
    await bounded('zoomed visual viewport fits');
    check((await metrics()).horizontal,'zoomed menu overflows horizontally');
    await cdp.send('Emulation.setPageScaleFactor',{pageScaleFactor:1});
    await bounded('menu fits after zoom reset');await page.keyboard.press('Escape');
    check(await st(page,'JSON.stringify(state)')===before,'menu navigation changed household data');
    const touch=await fresh({touch:true});
    try{
      await quiet(touch.page);
      await touch.page.setViewportSize({width:390,height:600});
      await waited(touch.page,()=>!document.querySelector('#toastWrap .toast'),'touch sample-data toast clears');
      await touch.page.locator('#avatarBtn').tap();
      const box=await touch.page.locator('.avatar-menu').boundingBox();
      const session=await touch.page.context().newCDPSession(touch.page);
      const x=Math.round(box.x+box.width/2),y=Math.round(box.y+box.height-40);
      await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
      for(let distance=20;distance<=200;distance+=20){
        await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-distance}]});
        await touch.page.evaluate(()=>new Promise(requestAnimationFrame));
      }
      await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      await waited(touch.page,()=>document.querySelector('.avatar-menu').scrollTop>0,'touch scroll inside menu');
      await touch.page.locator('.avatar-menu').evaluate(el=>el.scrollTop=el.scrollHeight);
      await touch.page.evaluate(()=>document.addEventListener('click',e=>{if(e.target.closest('[data-avatar-go="updates"]')){e.preventDefault();e.stopImmediatePropagation();window.__menuLastActivated=true;}},true));
      await touch.page.locator('[data-avatar-go="updates"]').tap();
      check(await touch.page.evaluate(()=>window.__menuLastActivated),'bottom action could not be tapped');
      check(!touch.errors.length,'touch user menu errors: '+touch.errors.join('; '));
    }finally{await touch.ctx.close();}
  },
  async brokerreview(page){
    const csv='Date,Code,Side,Quantity,Price,Brokerage,Currency\n2026-10-01,EXA,Buy,100,20,0,USD';
    const setup=async p=>{
      await quiet(p);
      await p.evaluate(async()=>{
        const {state,commit,normalizeShareAsset}=await import('/src/state.js');
        state.assets=[{id:'example-alex',what:'Example Alex holding with a long descriptive name',person:'Alex',category:'Shares',symbol:'EXA',quantity:100,price:20,currency:'AUD',sales:[]},
          {id:'example-sam',what:'Example Sam holding',person:'Sam',category:'Shares',symbol:'EXA',quantity:100,price:30,currency:'USD',sales:[]},
          {id:'example-cash',what:'Example cash',category:'Cash',amount:1000}];
        state.assets.filter(a=>a.category==='Shares').forEach(normalizeShareAsset);
        state.autoPrices=Object.assign({},state.autoPrices,{on:false});commit(['assets','autoPrices']);
      });
      await go(p,'assets','data-assets-sub','Shares');
      await p.locator('[data-asset-list-tool="trades"]').evaluate(el=>el.closest('.page-overflow').querySelector('[data-overflow-toggle]').click());
      await p.locator('[data-asset-list-tool="trades"]').click();
    };
    await setup(page);
    const read=async text=>{await page.locator('[data-tr-text]').fill(text);await page.locator('[data-tr-read]').click();};
    const saved=()=>stored(page,'JSON.stringify(state.assets)');
    const before=await saved();
    await read(csv);
    check(await page.locator('[data-tr-apply]').isDisabled(),'ambiguous ticker silently selected a holding');
    check(await saved()===before,'reading broker data wrote assets');
    await page.selectOption('[data-tr-pick="EXA"]','id:example-alex');
    check(await page.locator('[data-tr-apply]').isDisabled(),'currency mismatch allowed apply');
    check((await page.locator('.tr-preview').innerText()).includes('does not match'),'currency mismatch unexplained');
    await read(csv+'\n2026-10-02,EXB,Buy,100,30,0,USD');
    await page.selectOption('[data-tr-pick="EXA"]','id:example-sam');
    check(await page.locator('[data-tr-apply]').isDisabled(),'unmatched code was silently skipped');
    await page.selectOption('[data-tr-pick="EXB"]','skip');
    check(await page.locator('[data-tr-apply]').isEnabled(),'explicit partial import could not proceed');
    await page.locator('[data-tr-cancel]').click();
    await read(csv);await page.selectOption('[data-tr-pick="EXA"]','id:example-sam');
    if(process.env.BROKER_A11Y){const axe=await import('axe-core');await page.evaluate(axe.default.source);}
    if(process.env.BROKER_SHOTS) fs.mkdirSync(process.env.BROKER_SHOTS,{recursive:true});
    for(const width of [320,390,768,1280]) for(const theme of ['light','dark']){
      await page.setViewportSize({width,height:844});await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
      const panel=page.locator('[data-tr-panel]');
      check(await panel.evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&el.scrollWidth<=el.clientWidth+1&&Array.from(el.querySelectorAll('.tr-row,select')).every(x=>x.scrollWidth<=x.clientWidth+1);}), 'broker review overflow '+width+'/'+theme);
      if(process.env.BROKER_A11Y){const violations=await panel.evaluate(async el=>(await window.axe.run(el,{preload:false})).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.failureSummary)})));check(!violations.length,'broker review accessibility: '+JSON.stringify(violations));}
      await page.locator('[data-tr-review]').evaluate(el=>el.scrollIntoView({block:'center'}));
      if(process.env.BROKER_SHOTS) await page.screenshot({path:path.join(process.env.BROKER_SHOTS,width+'-'+theme+'.png')});
    }
    await page.locator('[data-tr-cancel]').click();check(await saved()===before,'Cancel changed saved assets');
    await read('Example unsupported columns\nExample text');
    check(!await page.locator('[data-tr-apply]').count(),'unsupported text offered apply');
    check(await page.locator('[data-tr-text]').inputValue()==='Example unsupported columns\nExample text','failed parse lost source text');
    await read(csv+'\n2026-10-01,EXA,Buy,100,20,0,USD\n2026-02-31,EXA,Buy,100,20,0,USD');
    check((await page.locator('[data-tr-review]').innerText()).includes('1 duplicate row ignored'),'input duplicates not reported');
    check((await page.locator('[data-tr-review]').innerText()).includes('1 row skipped'),'invalid row not reported');
    await page.selectOption('[data-tr-pick="EXA"]','id:example-sam');
    await page.evaluate(async()=>{(await import('/src/state.js')).state.assets.reverse();});
    await page.locator('[data-tr-apply]').click();
    check(await st(page,'state.assets.find(a=>a.id==="example-sam").lots.length')===1,'reordered destination received no trade');
    check(await st(page,'state.assets.find(a=>a.id==="example-alex").lots.length')===0,'trade went to wrong same-symbol holding');
    await page.evaluate(async()=>{(await import('/src/state.js')).state.assets.find(a=>a.id==='example-cash').amount=2000;});
    await page.locator('.toast-undo-btn').last().click();
    check(await st(page,'state.assets.find(a=>a.id==="example-sam").lots.length')===0,'Undo failed');
    check(await st(page,'state.assets.find(a=>a.id==="example-cash").amount')===2000,'Undo replaced an unrelated edit');
    await read(csv);await page.selectOption('[data-tr-pick="EXA"]','id:example-sam');
    await page.evaluate(async()=>{const {state}=await import('/src/state.js');state.assets.find(a=>a.id==='example-sam').what='Renamed Example holding';});
    await page.locator('[data-tr-apply]').click();
    check(await st(page,'state.assets.find(a=>a.id==="example-sam").lots.length')===0,'stale review applied without another review');
    check((await page.locator('[data-tr-status]').innerText()).includes('Holdings changed'),'stale review failed silently');
    await page.locator('[data-tr-apply]').click();
    await page.evaluate(async()=>{const {state,commit}=await import('/src/state.js');state.assets.find(a=>a.id==='example-sam').lots[0].brokerage=100;commit(['assets']);});
    await page.locator('.toast-undo-btn').last().click();
    check(await st(page,'state.assets.find(a=>a.id==="example-sam").lots[0].brokerage')===100,'Undo clobbered a later imported-holding edit');
    await read(csv);await page.selectOption('[data-tr-pick="EXA"]','id:example-sam');
    check(await page.locator('[data-tr-apply]').isDisabled(),'repeat import offered duplicate lot');
    await page.locator('[data-tr-text]').fill(csv.replace('100,20','100,40'));
    check(await page.locator('[data-tr-apply]').isDisabled(),'edited source could apply the old preview');
    await page.locator('[data-tr-read]').click();await page.selectOption('[data-tr-pick="EXA"]','id:example-sam');
    await page.evaluate(async()=>{const {state}=await import('/src/state.js');window.__removedBrokerHolding=state.assets.find(a=>a.id==='example-sam');state.assets=state.assets.filter(a=>a.id!=='example-sam');});
    const deleted=await st(page,'JSON.stringify(state.assets)');await page.locator('[data-tr-apply]').click();
    check(await st(page,'JSON.stringify(state.assets)')===deleted,'deleted destination redirected an import');
    check(await page.locator('[data-tr-apply]').isDisabled(),'deleted destination did not require a choice');
    await page.locator('[data-tr-cancel]').click();
    await page.evaluate(()=>{
      const text=File.prototype.text;
      File.prototype.text=function(){
        if(this.name==='broken.csv'&&!window.__brokerFailed){window.__brokerFailed=true;return Promise.reject(new Error('Synthetic file read failure'));}
        if(this.name==='slow.csv')return window.__brokerSlow=new Promise(resolve=>{window.__brokerRelease=resolve;});
        return text.call(this);
      };
    });
    await page.setInputFiles('[data-tr-file]',{name:'broken.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
    await waited(page,()=>document.querySelector('[data-tr-status]')?.textContent.includes("Couldn't read"),'actionable file error');
    await page.setInputFiles('[data-tr-file]',{name:'broken.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
    await waited(page,()=>!!document.querySelector('[data-tr-review]'),'retry read succeeds');
    await page.setInputFiles('[data-tr-file]',{name:'slow.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
    await page.locator('[data-tr-cancel]').click();await read(csv.replace('EXA','EXB'));
    await page.evaluate(async text=>{window.__brokerRelease(text);await window.__brokerSlow;},csv);
    check((await page.locator('.tr-preview').innerText()).includes('EXB'),'late cancelled read replaced the newer review');
    const touch=await fresh({touch:true});
    try{
      await setup(touch.page);await touch.page.locator('[data-tr-text]').fill(csv);await touch.page.locator('[data-tr-read]').tap();
      await touch.page.selectOption('[data-tr-pick="EXA"]','id:example-sam');await touch.page.locator('[data-tr-apply]').tap();
      check(await st(touch.page,'state.assets.find(a=>a.id==="example-sam").lots.length')===1,'touch import destination differs');
      check(!touch.errors.length,'touch broker errors: '+touch.errors.join('; '));
    }finally{await touch.ctx.close();}
  },
  async payslipreview(page){
    await quiet(page);
    await go(page,'tax','data-tax-sub','year');
    const root='[data-tax-person="Alex"] .tax-ytd';
    const panel=page.locator(root);
    await panel.evaluate(el=>el.open=true);
    const initial=await st(page,'JSON.stringify(state.tax.settings.Alex.ytd||null)');
    const paste=async text=>{
      await panel.evaluate(el=>{el.open=true;el.querySelector('.slip-paste').open=true;});
      await panel.locator('[data-slip-text]').fill(text);
      await panel.locator('[data-slip-read]').click();
    };
    const text=(end='2026-10-31',gross='20,000.00')=>'Employer A\nAlex\nPeriod: 01/10/2026 to '+end+'\nGross pay 6,000.00 '+gross+'\nTax 1,000.00 4,000.00\nNet pay 5,000.00\nSuper 600.00';
    // Earlier explicit Save/Undo actions append activity entries after a quiet spell.
    // Compare every other household field; the first read also checks raw browser storage.
    const snapshot=()=>st(page,'JSON.stringify(Object.fromEntries(Object.entries(state).filter(([key])=>key!=="activity")))');
    const before=await snapshot(), persisted=await page.evaluate(()=>localStorage.getItem('wealthPlanner.v1'));
    await paste(text());
    check(await snapshot()===before,'reading payslip changed household data');
    check(await page.evaluate(()=>localStorage.getItem('wealthPlanner.v1'))===persisted,'reading payslip wrote storage');
    check((await panel.innerText()).includes('Review for Alex'),'destination person missing');
    if(process.env.PAYSLIP_A11Y){const axe=await import('axe-core');await page.evaluate(axe.default.source);}
    if(process.env.PAYSLIP_SHOTS) fs.mkdirSync(process.env.PAYSLIP_SHOTS,{recursive:true});
    for(const width of [320,390,768,1280]) for(const theme of ['light','dark']){
      await page.setViewportSize({width,height:844});await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
      check(await panel.evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&el.scrollWidth<=el.clientWidth+1&&Array.from(el.querySelectorAll('.slip-actions button')).every(b=>b.scrollWidth<=b.clientWidth+1);}), 'payslip preview overflow '+width+'/'+theme);
      await panel.locator('[data-slip-review]').evaluate(el=>{el.scrollIntoView({block:'center'});el.focus({preventScroll:true});});
      check(await panel.locator('[data-slip-review]').evaluate(el=>{const r=el.getBoundingClientRect(),bar=document.querySelector('.app-topbar').getBoundingClientRect();return r.top>=bar.bottom&&r.bottom<=innerHeight-80;}),'review focus is obscured '+width+'/'+theme);
      if(process.env.PAYSLIP_SHOTS) await page.screenshot({path:path.join(process.env.PAYSLIP_SHOTS,width+'-'+theme+'.png')});
      if(process.env.PAYSLIP_A11Y){const violations=await panel.evaluate(async el=>(await window.axe.run(el,{preload:false})).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.failureSummary)})));check(!violations.length,'payslip review accessibility: '+JSON.stringify(violations));}
    }
    await panel.locator('[data-slip-cancel]').click();
    check(await snapshot()===before,'dismissing payslip changed data');
    await paste('Example unreadable text');
    check(await panel.locator('[data-slip-text]').inputValue()==='Example unreadable text','failed parse discarded the source text');
    check(!await panel.locator('[data-slip-use]').count(),'malformed payslip offered an apply');
    check(await snapshot()===before,'malformed payslip changed data');
    await paste('Gross pay 6,000.00\nPeriod ending 31/10/2026');
    check(!await panel.locator('[data-slip-use]').count(),'partial payslip offered YTD apply');
    await paste(text('2026-02-31'));
    check(!await panel.locator('[data-slip-use]').count(),'invalid period date offered apply');
    await paste(text());
    await panel.locator('[data-slip-use]').click();
    await waited(page,async()=>{const {state}=await import('/src/state.js');return state.tax.settings.Alex.ytd?.gross===20000;},'explicit YTD save');
    check(await st(page,'JSON.stringify(state.tax.settings.Alex.ytd)')===JSON.stringify({asOf:'2026-10-31',gross:20000,withheld:4000}),'wrong YTD saved');
    check(!await panel.locator('[data-slip-use]').count(),'duplicate YTD still offered save');
    await page.locator('.toast-undo-btn').last().click();
    check(await st(page,'JSON.stringify(state.tax.settings.Alex.ytd||null)')===initial,'Undo failed to restore original YTD');
    // A later edit while this preview is open must be reviewed before replacement.
    await paste(text());
    await page.evaluate(async()=>{const {state}=await import('/src/state.js');state.tax.settings.Alex.ytd={asOf:'2026-11-01',gross:30000,withheld:6000};});
    await panel.locator('[data-slip-use]').click();
    check(await st(page,'state.tax.settings.Alex.ytd.gross')===30000,'stale preview overwrote an intervening edit');
    check((await panel.locator('[data-slip-use]').innerText()).includes('Replace newer'),'older replacement not explicit');
    await panel.locator('[data-slip-use]').click();
    check(await st(page,'state.tax.settings.Alex.ytd.gross')===20000,'explicit older replacement did not save');
    // An Undo must also respect a newer edit.
    await page.evaluate(async()=>{const {state}=await import('/src/state.js');state.tax.settings.Alex.ytd={asOf:'2026-11-02',gross:40000,withheld:8000};});
    await page.locator('.toast-undo-btn').last().click();
    check(await st(page,'state.tax.settings.Alex.ytd.gross')===40000,'Undo clobbered a newer edit');
    await panel.locator('[data-slip-cancel]').click();
    const pdf=statementPdf(text().split('\n').map(line=>[line]));
    const beforePdf=await snapshot();
    await page.setInputFiles(root+' [data-slip-file]',{name:'example-payslip.pdf',mimeType:'application/pdf',buffer:pdf});
    await waited(page,()=>!!document.querySelector('[data-tax-person="Alex"] [data-slip-review]'),'direct PDF preview');
    check(await snapshot()===beforePdf,'direct PDF auto-saved YTD');
    await panel.locator('[data-slip-cancel]').click();
    await page.evaluate(()=>{
      const read=File.prototype.arrayBuffer;
      File.prototype.arrayBuffer=function(){
        if(this.name!=='delayed-payslip.pdf') return read.call(this);
        window.__pendingPayslipRead=new Promise((resolve,reject)=>{window.__failPayslipRead=()=>reject(new Error('Synthetic read failure'));});
        return window.__pendingPayslipRead;
      };
    });
    await page.setInputFiles(root+' [data-slip-file]',{name:'delayed-payslip.pdf',mimeType:'application/pdf',buffer:pdf});
    await waited(page,()=>!!document.querySelector('[data-tax-person="Alex"] [data-slip-cancel]'),'pending PDF can be dismissed');
    await panel.locator('[data-slip-cancel]').click();
    await page.evaluate(async()=>{window.__failPayslipRead();await window.__pendingPayslipRead.catch(()=>{});});
    check(!await panel.locator('[data-slip-cancel]').count(),'dismissed PDF failure resurrected the review');
    check(await snapshot()===beforePdf,'cancelled PDF read changed data');
    await paste(text());
    await page.evaluate(async()=>{const {state}=await import('/src/state.js');window.__keptPayslipIncome=state.income;state.income=state.income.filter(i=>i.person!=='Alex');});
    const removed=await snapshot();
    await panel.locator('[data-slip-use]').click();
    check(await snapshot()===removed,'deleted person received a stale payslip update');
    await page.evaluate(async()=>{(await import('/src/state.js')).state.income=window.__keptPayslipIncome;});
    await panel.locator('[data-slip-cancel]').click();
    await go(page,'expenses','data-expenses-sub','spending');
    await page.setInputFiles('#bankImportFile',{name:'example-payslip.pdf',mimeType:'application/pdf',buffer:pdf});
    await waited(page,()=>document.body.dataset.currentPage==='tax'&&!!document.querySelector('[data-tax-person="Alex"] [data-slip-review]'),'recognised PDF preview');
    {const after=await snapshot();check(after===beforePdf,'recognised PDF changed keys: '+Object.keys(JSON.parse(after)).filter(k=>JSON.stringify(JSON.parse(after)[k])!==JSON.stringify(JSON.parse(beforePdf)[k])).join(','));}
    await panel.locator('[data-slip-cancel]').click();
    await paste(text());
    const logBefore=await st(page,'state.incomeLog.length'), ytdBefore=await st(page,'JSON.stringify(state.tax.settings.Alex.ytd)');
    await panel.locator('[data-slip-log]').click();
    check(await st(page,'state.incomeLog.length')===logBefore+1,'explicit pay logging no longer works');
    check(await st(page,'JSON.stringify(state.tax.settings.Alex.ytd)')===ytdBefore,'logging pay applied YTD too');
    await page.locator('.toast-undo-btn').last().click();
    check(await st(page,'state.incomeLog.length')===logBefore,'pay logging Undo failed');
    const salaryBefore=await page.evaluate(async()=>{const row=(await import('/src/components/income.js')).salaryRowFor('Alex');return {id:row.id,amount:row.amount};});
    await panel.locator('[data-slip-salary]').click();
    check(await st(page,'state.income.find(i=>i.id==='+JSON.stringify(salaryBefore.id)+').amount')===6000,'explicit salary update no longer works');
    check(await st(page,'JSON.stringify(state.tax.settings.Alex.ytd)')===ytdBefore,'salary action applied YTD too');
    await page.locator('.toast-undo-btn').last().click();
    check(await st(page,'state.income.find(i=>i.id==='+JSON.stringify(salaryBefore.id)+').amount')===salaryBefore.amount,'salary Undo failed');
  },
  // An independent touch gesture must not be mistaken for Chromium's repeated-tap text selection.
  async rowlabelfocus(page){
    await quiet(page);
    await typeLineName(page,'demo-groceries',await stored(page,"state.shared.find(x=>x.id==='demo-groceries').what"),false);
    const row=page.locator('[data-line-id="demo-groceries"]'),amount=row.locator('.f-amount'),name=row.locator('.f-what');
    const label=row.locator('label[for="'+await amount.getAttribute('id')+'"]');
    const before=await stored(page,'JSON.stringify(state)');
    for(const width of [320,390,768,1280]) for(const theme of ['light','dark']){
      await page.setViewportSize({width,height:844});
      await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
      for(let i=0;i<6;i++){
        await name.tap();
        check(await name.evaluate(el=>document.activeElement===el),'touch did not focus the name field');
        await label.tap();
        await waited(page,id=>document.activeElement===document.getElementById(id),'Amount focus after independent label tap',await amount.getAttribute('id'));
        check(await page.evaluate(()=>window.getSelection()?.toString()===''),'independent label tap selected its text');
      }
    }
    check(await stored(page,'JSON.stringify(state)')===before,'label gestures changed saved household data');
  },
  async importrestorefocus(page){
    await quiet(page);
    await go(page,'settings','data-accounts-sub','preferences');
    const before=await stored(page,'JSON.stringify(state)');
    for(const width of [320,390,768,1280]) for(const theme of ['light','dark']){
      await page.setViewportSize({width,height:844});
      await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
      const result=await page.evaluate(async()=>{
        const {renderSafekeeping}=await import('/src/components/safekeeping.js');
        const selector='[data-sk="file-open"]';
        document.querySelector(selector).focus();
        const completion=renderSafekeeping();
        const synchronous=document.activeElement===document.querySelector(selector);
        document.querySelector(selector).focus();
        await completion;
        const asynchronous=document.activeElement===document.querySelector(selector);
        const other=renderSafekeeping(),avatar=document.getElementById('avatarBtn');
        avatar.focus();await other;
        return {synchronous,asynchronous,movedFocus:document.activeElement===avatar,focus:document.activeElement?.outerHTML.slice(0,200)};
      });
      check(result.synchronous&&result.asynchronous&&result.movedFocus,'backup redraw focus at '+width+'/'+theme+': '+JSON.stringify(result));
    }
    check(await stored(page,'JSON.stringify(state)')===before,'backup redraw changed saved household data');
  },
  async importchooser(page){
    await quiet(page);

    await page.evaluate(()=>{
      if(!document.startViewTransition) return;
      const start=document.startViewTransition.bind(document);
      document.startViewTransition=function(update){const t=start(update);window.__importTransitionDone=Promise.allSettled([t.finished]);return t;};
    });
    const navDone=()=>page.evaluate(()=>window.__importTransitionDone);
    const open=async()=>{
      await navDone();
      await click(page,'#avatarBtn');
      await click(page,'.avatar-menu [data-import-open]');
      await waited(page,()=>!!document.querySelector('.import-chooser:modal'),'import chooser');
    };
    const before=await st(page,'JSON.stringify(state)');
    const persisted=await page.evaluate(()=>localStorage.getItem('wealthPlanner.v1'));
    if(process.env.IMPORT_SHOTS) fs.mkdirSync(process.env.IMPORT_SHOTS,{recursive:true});
    if(process.env.IMPORT_A11Y){const axe=await import('axe-core');await page.evaluate(axe.default.source);}
    for(const width of [320,390,768,1280]) for(const theme of ['light','dark']){
      await navDone();
      await page.setViewportSize({width,height:844});
      await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
      await open();
      if(process.env.IMPORT_SHOTS) await page.locator('.import-chooser').screenshot({path:path.join(process.env.IMPORT_SHOTS,width+'-'+theme+'.png')});
      check(await page.locator('[data-import-choice]').count()===9,'missing supported import format');
      check(await page.locator('.import-chooser').evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&el.scrollWidth<=el.clientWidth+1;}),'chooser overflow '+width+'/'+theme);
      check(await page.locator('.import-choice').evaluateAll(els=>els.every(el=>el.scrollWidth<=el.clientWidth+1&&el.getBoundingClientRect().height>=44)),'import choice overflow or small target');
      if(process.env.IMPORT_A11Y){const violations=await page.locator('.import-chooser').evaluate(async el=>(await window.axe.run(el,{preload:false})).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.failureSummary)})));check(!violations.length,'import chooser accessibility: '+JSON.stringify(violations));}
      await page.press('[data-import-choice="bank"]','Shift+Tab');
      check(await page.locator('[data-import-close]').evaluate(el=>el===document.activeElement),'import focus escaped');
      await page.keyboard.press('Escape');
      await waited(page,()=>!document.querySelector('.import-chooser')&&document.activeElement===document.getElementById('avatarBtn'),'import Escape and focus restore');
    }
    const choices=await page.evaluate(async()=>(await import('/src/components/importchooser.js')).importChoices({people:1,properties:1,shares:1}));
    for(const choice of choices){
      const origin=await page.evaluate(()=>location.pathname);
      await open();
      if(choice.key==='trades') await page.locator('[data-import-choice="trades"]').click();
      else await page.locator('[data-import-choice="'+choice.key+'"]').press('Enter');
      await waited(page,({choice})=>!document.querySelector('.import-chooser')&&document.body.dataset.currentPage===choice.page&&!!document.querySelector(choice.target)?.getClientRects().length&&document.querySelector(choice.target)===document.activeElement,'revealed and focused '+choice.key,{choice});
      await navDone();
      await page.goBack();
      await waited(page,p=>location.pathname===p,'import origin',origin);
    }
    check(await st(page,'JSON.stringify(state)')===before,'chooser changed household state');
    check(await page.evaluate(()=>localStorage.getItem('wealthPlanner.v1'))===persisted,'chooser changed persisted data');
    await open();await page.goBack();
    await waited(page,()=>!document.querySelector('.import-chooser'),'Back cancels chooser');
    await navDone();
    await click(page,'#searchBtn');await page.fill('#searchInput','Import data');await page.press('#searchInput','Enter');
    await waited(page,()=>!!document.querySelector('.import-chooser:modal')&&!document.querySelector('.search-dialog'),'search opens import chooser');
    await page.goBack();await waited(page,()=>!document.querySelector('.import-chooser'),'Back from search chooser');
    await emptyHousehold(page);
    await page.keyboard.press('Escape');
    await waited(page,()=>!document.querySelector('#firstRunRoot [role="dialog"]')&&!document.querySelector('.app-shell').inert,'dismiss empty-household setup');
    await quiet(page);
    for(const [key,target] of [['payslip','#addPersonBtn'],['property','#addPropertyBtn'],['prices','[data-add="holding"]']]){
      await open();await page.locator('[data-import-choice="'+key+'"]').click();
      await waited(page,target=>!!document.querySelector(target)?.getClientRects().length&&document.querySelector(target)===document.activeElement,'setup destination '+key,target);
      check(await page.locator(target).first().evaluate(el=>el===document.activeElement),'setup action not focused: '+key);
    }
    const touch=await fresh({touch:true});
    try{
      await quiet(touch.page);
      await click(touch.page,'#avatarBtn');
      await touch.page.locator('.avatar-menu [data-import-open]').tap();
      await waited(touch.page,()=>!!document.querySelector('.import-chooser:modal'),'touch import chooser');
      await touch.page.locator('[data-import-choice="trades"]').tap();
      await waited(touch.page,()=>!!document.querySelector('[data-tr-text]')?.getClientRects().length&&document.querySelector('[data-tr-text]')===document.activeElement,'touch broker import destination');
      check(!touch.errors.length,'touch import errors: '+touch.errors.join('; '));
    }finally{await touch.ctx.close();}
  },
  async exactsearch(page){
    await quiet(page);
    // Wait for the actual transition before resizing or beginning the next interaction.
    // A URL is updated inside its DOM callback, before the animation has finished.
    await page.evaluate(()=>{
      if(!document.startViewTransition) return;
      const start=document.startViewTransition.bind(document);
      document.startViewTransition=function(update){
        const transition=start(update);
        window.__searchTransitionDone=Promise.allSettled([transition.finished]);
        return transition;
      };
    });
    const navigationDone=()=>page.evaluate(()=>window.__searchTransitionDone);
    await page.evaluate(async () => {
      const {state} = await import('/src/state.js');
      state.transactions.push({id:'search-first',what:'Example duplicate',date:'2025-01-01',amount:100,account:'Bank One'},
        {id:'search-second',what:'Example duplicate',date:'2025-02-01',amount:200,account:'Bank Two'});
      state.income.push({id:'search-income',what:'Example salary',person:'Sam',amount:5000,freq:'Monthly'});
    });
    const open = async query => {
      await navigationDone();
      await click(page,'#searchBtn');
      await page.fill('#searchInput',query);
    };
    await page.evaluate(async()=>{const {txFilters}=await import('/src/components/cashflow.js'); Object.assign(txFilters,{account:'Bank Three',from:'2026-10-01',to:'2026-10-31',text:'unrelated'});});
    const filtersBefore = await page.evaluate(async()=>JSON.stringify((await import('/src/components/cashflow.js')).txFilters));
    if(process.env.SEARCH_A11Y){ const axe=await import('axe-core'); await page.evaluate(axe.default.source); }
    const origin = await page.evaluate(()=>location.pathname);
    const before = await st(page,'JSON.stringify(state)');
    for(const width of [320,390,768,1280]) for(const theme of ['light','dark']){
      await navigationDone();
      await page.setViewportSize({width,height:844});
      await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
      await open('Example duplicate');
      check(await page.locator('[data-search-result]').count()===2,'duplicate records not found');
      check(await page.locator('.search-dialog').evaluate(el=>el.matches(':modal')),'search is not modal');
      check(await page.locator('.search-panel').evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&el.scrollWidth<=el.clientWidth+1;}),'search overflows '+width+'/'+theme);
      if(process.env.SEARCH_A11Y){
        const violations=await page.locator('.search-dialog').evaluate(async el=>(await window.axe.run(el,{preload:false})).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.failureSummary)})));
        check(!violations.length,'search accessibility: '+JSON.stringify(violations));
      }
      await page.press('#searchInput','ArrowUp');
      check(await page.locator('[data-search-result="1"]').evaluate(el=>el===document.activeElement),'ArrowUp did not select last result');
      await page.focus('#searchInput');
      await page.press('#searchInput','Shift+Tab');
      check(await page.locator('[data-search-result="1"]').evaluate(el=>el===document.activeElement),'modal focus escaped');
      if(width===390) await page.locator('[data-search-result="1"]').tap();
      else {
        await page.focus('#searchInput');
        await page.press('#searchInput','ArrowDown');
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
      }
      await waited(page,()=>location.pathname.endsWith('/detail/transaction/search-second'),'exact historical transaction');
      check((await page.locator('#detailBody').innerText()).includes('200'),'wrong duplicate transaction');
      await navigationDone();
      await page.goBack();
      await waited(page,p=>location.pathname===p,'search origin',origin);
      await open('Example salary');
      await page.press('#searchInput','Enter');
      await waited(page,()=>location.pathname.endsWith('/detail/income/search-income'),'exact income');
      check((await page.locator('#detailBody').innerText()).includes('Sam'),'income person missing');
      await navigationDone();
      await page.goBack();
      await waited(page,p=>location.pathname===p,'income origin',origin);
    }
    check(await st(page,'JSON.stringify(state)')===before,'search changed household or saved filters');
    check(await page.evaluate(async()=>JSON.stringify((await import('/src/components/cashflow.js')).txFilters))===filtersBefore,'search changed Spending filters');
    await open('Example duplicate');
    await page.evaluate(async()=>{const {state}=await import('/src/state.js');state.transactions=state.transactions.filter(t=>t.id!=='search-first');});
    await click(page,'[data-search-result="0"]');
    check((await page.locator('#searchStatus').innerText()).includes('no longer available'),'deleted result opened another record');
    check(await page.locator('.search-dialog').isVisible(),'stale result dismissed search');
    await page.press('#searchInput','Escape');
    await waited(page,()=>!document.querySelector('.search-dialog'),'Escape dismisses search');
    await open('Calculators');
    await page.press('#searchInput','Enter');
    await waited(page,()=>document.body.dataset.currentPage==='calc','calculator action destination');
    await go(page,'expenses','data-expenses-sub','budget');
    const line = await page.evaluate(async()=>{
      const expenses=await import('/src/components/expenses.js');
      expenses.setAllBudgetGroupsCollapsed(true); expenses.renderSharedGroups();
      const row=expenses.budgetLineItems().find(l=>l.id);
      return {id:row.id,what:row.what,collapsed:expenses.allBudgetGroupsCollapsed()};
    });
    check(line.collapsed,'source budget groups were not collapsed');
    await open(line.what);
    const lineIndex=await page.evaluate(async id=>(await import('/src/lib/search.js')).searchApp(document.getElementById('searchInput').value).findIndex(r=>r.extra.detail?.kind==='line'&&r.extra.detail.id===id),line.id);
    await click(page,'[data-search-result="'+lineIndex+'"]');
    await waited(page,id=>location.pathname.endsWith('/detail/line/'+encodeURIComponent(id)),'collapsed budget record',line.id);
    const computed=await page.evaluate(async()=>{
      const {state}=await import('/src/state.js'), {incomeSearchId}=await import('/src/lib/search.js');
      const row=state.income.find(i=>i.syntheticNetFor);
      return {what:row.what,id:incomeSearchId(row)};
    });
    await open(computed.what);
    await page.press('#searchInput','Enter');
    await waited(page,id=>location.pathname.endsWith('/detail/income/'+encodeURIComponent(id)),'computed income record',computed.id);
    await open(await st(page,'state.scenarios[0]'));
    const scenarioIndex=await page.evaluate(async()=>(await import('/src/lib/search.js')).searchApp(document.getElementById('searchInput').value).findIndex(r=>r.type==='Scenario'));
    await click(page,'[data-search-result="'+scenarioIndex+'"]');
    await waited(page,()=>location.pathname.includes('/detail/scenario/'),'scenario record');
    await open('Import rules');
    await page.press('#searchInput','Enter');
    await waited(page,()=>location.pathname.endsWith('/settings/rules'),'Import rules destination');
    await open('Reports');
    await page.goBack();
    await waited(page,()=>!document.querySelector('.search-dialog'),'Back dismisses search');
  },
  // #339: the quick tour — asked once on arrival, walks the real menu without moving the address bar, answers to
  // the keyboard and the phone's Back, is remembered, and replays from the avatar menu.
  async tour(page){
    const tourState = () => page.evaluate(() => {
      const card = document.querySelector('.tour-card'), spot = document.querySelector('.tour-spot');
      if(!card) return { open: false, flag: localStorage.getItem('wealthPlanner.tour'), offer: !document.getElementById('tourOffer').hidden,
        page: document.body.getAttribute('data-current-page'), path: location.pathname, inert: !!document.querySelector('.app-shell').inert };
      const c = card.getBoundingClientRect(), s = spot.hidden ? null : spot.getBoundingClientRect();
      // By its box, not a hit test: the app under the tour is inert, and inert elements aren't hit.
      const ringed = s && Array.from(document.querySelectorAll('.mobile-tab, .nav-item')).find(el => { const r = el.getBoundingClientRect();
        return r.width > 0 && r.left >= s.left - 1 && r.right <= s.right + 1 && r.top >= s.top - 1 && r.bottom <= s.bottom + 1; });
      return { open: true, count: card.querySelector('.tour-count').textContent, title: card.querySelector('.tour-title').textContent,
        inside: c.left >= 0 && c.top >= 0 && c.right <= innerWidth && c.bottom <= innerHeight,
        covers: !!s && !(c.right <= s.left || c.left >= s.right || c.bottom <= s.top || c.top >= s.bottom), ring: !!s,
        ringedLabel: ringed ? (ringed.querySelector('.mobile-tab-label') || ringed).textContent.trim() : null,
        focusInCard: card.contains(document.activeElement), focus: document.activeElement.textContent.trim(),
        page: document.body.getAttribute('data-current-page'), path: location.pathname, inert: !!document.querySelector('.app-shell').inert,
        targets: Array.from(card.querySelectorAll('button')).filter(b => !b.hidden).every(b => b.getBoundingClientRect().height >= 44) };
    });
    const onStep = n => waited(page, n => { const c = document.querySelector('.tour-count'); return !!c && c.textContent.indexOf('Step ' + n + ' of') === 0 && !!document.querySelector('.tour-card[data-side]'); }, 'tour step ' + n, n);
    const closedTour = () => waited(page, () => !document.querySelector('.tour-card') && !document.querySelector('.app-shell').inert, 'the tour to close');

    // Someone who has been here before is never asked.
    check(!(await tourState()).offer, 'a returning household was offered the tour');
    // A first arrival on the sample household: asked once, on Home.
    await page.evaluate(() => localStorage.removeItem('wealthPlanner.tour'));
    await page.goto(base + '/index.html?mock=1');
    await answerDialog(page, true);
    await ready(page, 'the app after loading the sample household');
    await waited(page, () => !document.getElementById('tourOffer').hidden, 'the tour to be offered');
    check(await page.locator('#tourOffer [data-tour-skip]').count() === 1 && await page.locator('#tourOffer [data-tour-start]').count() === 1, 'the offer needs Skip and Start tour');
    const startPath = await page.evaluate(() => location.pathname);
    await page.locator('#tourOffer [data-tour-start]').click();
    await onStep(1);
    let s = await tourState();
    check(s.inert && s.focusInCard && s.focus === 'Next', 'the tour did not open as a modal with focus on Next: ' + JSON.stringify(s));
    check(!s.offer && await page.locator('#tourOffer').isHidden(), 'the offer stayed on screen under the tour');
    // The five places, each named as its own tab names it, ringed, with the card beside it.
    // #412: Today, and More (with Tax inside) in place of Tax.
    const places = [['Today', 'dashboard'], ['Money', 'expenses'], ['Accounts', 'networth'], ['Plan', 'plan'], ['More', 'more']];
    for(let i = 0; i < places.length; i++){
      await onStep(i + 1);
      // The ring slides to its place; wait for it to arrive around this step's own tab, not for a length of time.
      await waited(page, label => { const sp = document.querySelector('.tour-spot'); if(!sp || sp.hidden) return false; const b = sp.getBoundingClientRect();
        return Array.from(document.querySelectorAll('.mobile-tab, .nav-item')).some(el => { const r = el.getBoundingClientRect();
          return r.width > 0 && (el.querySelector('.mobile-tab-label') || el).textContent.trim() === label && r.left >= b.left - 1 && r.right <= b.right + 1 && r.top >= b.top - 1 && r.bottom <= b.bottom + 1; }); },
        'the ring to settle on ' + places[i][0], places[i][0]);
      s = await tourState();
      check(s.title === places[i][0] && s.page === places[i][1], 'step ' + (i + 1) + ' is not ' + places[i][0] + ' on its page: ' + JSON.stringify(s));
      check(s.ring && s.ringedLabel === places[i][0], 'step ' + (i + 1) + ' rings ' + s.ringedLabel + ', not ' + places[i][0]);
      check(s.inside && !s.covers && s.targets, 'step ' + (i + 1) + ' card off screen, over its target, or with small buttons: ' + JSON.stringify(s));
      check(s.path === startPath, 'the tour moved the address bar to ' + s.path);
      await page.locator('[data-tour-next]').click();
    }
    await onStep(6);
    check((await tourState()).title === 'Scenarios', 'step 6 is not Scenarios');
    // The keyboard: arrows move, Tab stays in the card, Escape leaves — and puts back the page it started on.
    await page.keyboard.press('ArrowLeft'); await onStep(5);
    await page.keyboard.press('ArrowRight'); await onStep(6);
    for(let i = 0; i < 6; i++){ await page.keyboard.press('Tab'); check((await tourState()).focusInCard, 'Tab left the tour'); }
    await page.keyboard.press('Escape');
    await closedTour();
    await waited(page, () => document.body.getAttribute('data-current-page') === 'dashboard', 'Home to come back after the tour');
    s = await tourState();
    check(s.flag === 'skipped' && !s.offer && s.path === startPath, 'leaving the tour was not remembered: ' + JSON.stringify(s));
    // Remembered across a reload; still in the menu. The phone's Back closes it without leaving the page.
    await page.reload(); await ready(page, 'the app after a reload');
    check(!(await tourState()).offer, 'the tour was offered again after a reload');
    await go(page, 'expenses');
    const before = await page.evaluate(() => location.pathname);
    await page.locator('#avatarBtn').click();
    await page.locator('.avatar-menu [data-tour-start]').click();
    await onStep(1);
    await page.locator('[data-tour-next]').click(); await onStep(2);
    await page.goBack();
    await closedTour();
    s = await tourState();
    check(s.page === 'expenses' && s.path === before, 'Back out of the tour left ' + s.page + ' at ' + s.path + ', not Cash flow');
    await waited(page, () => document.activeElement && document.activeElement.id === 'avatarBtn', 'focus to return to the menu button');
    // To the end: the first-month steps, and one of them taken.
    await page.locator('#avatarBtn').click();
    await page.locator('.avatar-menu [data-tour-start]').click();
    for(let n = 1; n < 9; n++){ await onStep(n); await page.locator('[data-tour-next]').click(); }
    await onStep(9);
    s = await tourState();
    check(s.title === 'Getting started' && s.focus === 'Done' && s.inside, 'the last step: ' + JSON.stringify(s));
    check(await page.locator('.tour-card [data-tour-go]').count() === 4 && await page.locator('.tour-card [data-tour-skip-btn]').isHidden(), 'the last step needs the four first steps and no Skip');
    await page.locator('.tour-card [data-tour-go]').last().click();
    await closedTour();
    await waited(page, () => document.body.getAttribute('data-current-page') === 'networth' && /networth/.test(location.pathname), 'the chosen first step to open Net worth');
    check((await tourState()).flag === 'done', 'finishing the tour was not remembered');
    // A household starting from scratch: nothing beside the setup sheet; the offer once it closes; Skip puts it away.
    await page.evaluate(async () => {
      localStorage.removeItem('wealthPlanner.tour');
      const m = await import('/src/state.js'); m.setState(m.defaultState());
      (await import('/src/calc/engine.js')).recalcComputedItems();
      (await import('/src/components/redraw.js')).renderAll();
    });
    await go(page, 'dashboard');
    await page.locator('#dashboardSetup [data-firstrun-open]').click();
    await page.locator('#firstRunRoot [role="dialog"]').waitFor();
    check(!(await tourState()).offer, 'the tour was offered beside the setup sheet');
    await page.locator('#firstRunRoot [data-fr-close]').click();
    await waited(page, () => !document.querySelector('#firstRunRoot [role="dialog"]') && !document.getElementById('tourOffer').hidden, 'the tour to be offered once setup closes');
    await page.locator('#tourOffer [data-tour-skip]').click();
    await waited(page, () => document.getElementById('tourOffer').hidden, 'Skip to put the offer away');
    s = await tourState();
    check(s.flag === 'skipped' && !s.open, 'Skip was not remembered: ' + JSON.stringify(s));
  },
  // #261 / #263: Settings → Categories — a rename cleared to retype doesn't uncategorise the lines in it, a taken name
  // doesn't merge two categories, and each delete says which category it removes.
  async errorsummarybounds(page){
    await quiet(page);await go(page,'properties');await page.locator('[data-prop-edit]').first().click();
    const card=page.locator('.property-card').first(),id=await card.getAttribute('data-property-id');
    const before=await page.evaluate(async id=>{const m=await import('/src/state.js');const p=m.state.properties.find(p=>p.id===id);return JSON.stringify({...p,sectionsCollapsed:undefined});},id);
    await card.locator('.prop-value').fill('');await card.locator('.prop-purchase-price').fill('-100');await card.locator('.prop-purchase-price').press('Tab');
    await waited(page,()=>document.querySelector('[data-error-summary] a')&&document.querySelector('[data-error-summary]').querySelectorAll('a').length===2,'two property errors');
    if(process.env.ERROR_BOUNDS_SHOTS)fs.mkdirSync(process.env.ERROR_BOUNDS_SHOTS,{recursive:true});
    let phase='activation';
    const visible=async target=>waited(page,id=>{
      const input=document.getElementById(id);if(!input||input!==document.activeElement)return false;
      const v=visualViewport;let top=v?.offsetTop||0,bottom=top+(v?.height||innerHeight);
      const header=document.querySelector('.app-topbar').getBoundingClientRect();if(header.top<=top&&header.bottom>top)top=header.bottom;
      const nav=document.querySelector('.mobile-tabbar'),n=nav.getBoundingClientRect();if(nav.getClientRects().length&&n.top>top&&n.top<bottom)bottom=n.top;
      const r=input.getBoundingClientRect();return r.top>top+1&&r.bottom<bottom-1&&document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)===input;
    },'error field inside usable viewport after '+phase,target).catch(async error=>{
      const diagnostic=await page.evaluate(id=>{const e=document.getElementById(id),r=e?.getBoundingClientRect(),v=visualViewport,nav=document.querySelector('.mobile-tabbar');return {id,width:innerWidth,height:innerHeight,theme:document.documentElement.dataset.theme,scrollY,focus:document.activeElement?.outerHTML.slice(0,250),target:e?.outerHTML.slice(0,250),rect:r?.toJSON(),header:document.querySelector('.app-topbar').getBoundingClientRect().toJSON(),nav:nav.getBoundingClientRect().toJSON(),navVisible:!!nav.getClientRects().length,viewport:{top:v.offsetTop,left:v.offsetLeft,width:v.width,height:v.height},hit:r?document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)?.outerHTML.slice(0,250):null};},target);
      throw new Error(error.message+'; '+JSON.stringify(diagnostic));
    });
    for(const width of [320,390,768,1280])for(const theme of ['light','dark'])for(const height of [190,240,390,844]){
      await page.setViewportSize({width,height});await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
      for(let i=0;i<2;i++){
        const link=card.locator('[data-error-summary] a').nth(i),target=await link.getAttribute('data-error-target');
        await link.focus();await link.evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));
        if(width<700)await link.tap();else{await link.focus();await page.keyboard.press('Enter');}
        phase='activation';await visible(target);
        // A redraw preserves the same focused draft and must not let the deferred adjustment scroll an old node.
        await page.evaluate(async()=>{(await import('/src/components/properties.js')).renderProperties();});phase='redraw';await visible(target);
        if(process.env.ERROR_BOUNDS_SHOTS&&i===0&&[190,844].includes(height))await page.screenshot({path:path.join(process.env.ERROR_BOUNDS_SHOTS,width+'-'+theme+'-'+height+'.png')});
      }
    }
    await page.setViewportSize({width:390,height:390});
    const link=card.locator('[data-error-summary] a').first(),target=await link.getAttribute('data-error-target');
    await link.focus();await page.keyboard.press('Enter');await visible(target);
    await page.evaluate(()=>{window.__errorBoundsWheel=false;window.addEventListener('wheel',()=>window.__errorBoundsWheel=true,{once:true,capture:true});});
    await page.mouse.move(20,180);await page.mouse.wheel(0,500);
    await waited(page,()=>window.__errorBoundsWheel,'native wheel event delivered');
    await waited(page,id=>document.getElementById(id).getBoundingClientRect().bottom<0,'user scroll moves away from selected field',target);
    await page.evaluate(()=>window.dispatchEvent(new Event('resize')));
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    check(await page.evaluate(id=>document.getElementById(id).getBoundingClientRect().bottom<0,target),'layout adjustment fought a manual scroll');
    const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setPageScaleFactor',{pageScaleFactor:1.5});
    await link.focus();await page.keyboard.press('Enter');await visible(target);
    await cdp.send('Emulation.setPageScaleFactor',{pageScaleFactor:1});
    check(await page.evaluate(async id=>{const m=await import('/src/state.js');return JSON.stringify({...m.state.properties.find(p=>p.id===id),sectionsCollapsed:undefined});},id)===before,'summary navigation or redraw changed property figures');
  },
  async errorsummaries(page){
    await quiet(page);
    await page.evaluate(()=>{
      window.__errorSummaryTrace=[];window.__errorSummarySamples=[];
      const nodes=new WeakMap();let nextNode=0;const nodeId=el=>{if(!el)return null;if(!nodes.has(el))nodes.set(el,++nextNode);return nodes.get(el);};
      const identity=el=>el?el.tagName+(el.id?'#'+el.id:'')+'.'+String(el.className):null;
      const rect=el=>{if(!el)return null;const r=el.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right};};
      window.__captureErrorSummary=(event)=>{
        const a=window.__errorSummaryActivation;if(!a)return;
        const target=document.getElementById(a.id),r=target?.getBoundingClientRect(),vv=visualViewport;
        const sample={event,time:Math.round(performance.now()),...a,page:document.body.dataset.currentPage,width:innerWidth,height:innerHeight,scrollY,
          focus:identity(document.activeElement),focusNode:nodeId(document.activeElement),target:identity(target),targetNode:nodeId(target),focused:target===document.activeElement,connected:target?.isConnected,
          duplicates:[...document.querySelectorAll('[id]')].filter(el=>el.id===a.id).length,
          bounds:rect(target),source:rect([...document.querySelectorAll('[data-error-target]')].find(el=>el.dataset.errorTarget===a.id)),header:rect(document.querySelector('.app-topbar')),nav:rect(document.querySelector('.mobile-tabbar')),
          hit:r?identity(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)):null,
          viewport:vv?{top:vv.offsetTop,left:vv.offsetLeft,width:vv.width,height:vv.height}:null};
        window.__errorSummaryTrace.push(sample);if(window.__errorSummaryTrace.length>100)window.__errorSummaryTrace.shift();
        if(event==='settled')window.__errorSummarySamples.push(sample);
      };
      document.addEventListener('focusin',()=>window.__captureErrorSummary('focusin'),true);
      document.addEventListener('focusout',()=>window.__captureErrorSummary('focusout'),true);
      new ResizeObserver(()=>window.__captureErrorSummary('header resize')).observe(document.querySelector('.app-topbar'));
      for(const kind of ['pointerdown','pointerup','click'])document.addEventListener(kind,e=>{const a=e.target.closest('[data-error-target]');window.__captureErrorSummary(kind+' '+identity(e.target)+' '+(a?.dataset.errorTarget||'')+' @'+e.clientX+','+e.clientY);},true);
      window.addEventListener('scroll',()=>window.__captureErrorSummary('scroll'),{passive:true});
      window.addEventListener('resize',()=>window.__captureErrorSummary('resize'),{passive:true});
      new MutationObserver(ms=>{
        const a=window.__errorSummaryActivation;if(!a)return;
        if(ms.some(m=>[...m.removedNodes].some(n=>n.nodeType===1&&(n.id===a.id||[...n.querySelectorAll('[id]')].some(el=>el.id===a.id)))))window.__captureErrorSummary('target removed');
      }).observe(document,{childList:true,subtree:true});
    });
    const a11yResults=[];
    if(process.env.ERROR_SHOTS) fs.mkdirSync(process.env.ERROR_SHOTS,{recursive:true});
    if(process.env.ERROR_A11Y){ const axe = await import('axe-core'); await page.evaluate(axe.default.source); }
    const count = async (root,n) => {
      await waited(page, ([selector,n]) => {
        const r=document.querySelector(selector), s=r?.querySelector('[data-error-summary]');
        return n ? !!s && !s.hidden && s.querySelectorAll('a').length===n : !s || s.hidden;
      }, 'the '+root+' summary to list '+n+' errors', [root,n]);
    };
    const scan = async locator => {
      if(!process.env.ERROR_A11Y) return;
      // Scan rendered styles with every rule; optional cross-origin font/CSS prefetch conflicts with the app CSP.
      const result = await locator.evaluate(async el => ({scope:el.className,width:innerWidth,theme:document.documentElement.dataset.theme,violations:(await window.axe.run(el,{preload:false,runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice']}})).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))}));
      a11yResults.push(result);
      if(process.env.ERROR_A11Y_DIR){fs.mkdirSync(process.env.ERROR_A11Y_DIR,{recursive:true});fs.writeFileSync(path.join(process.env.ERROR_A11Y_DIR,'results.json'),JSON.stringify(a11yResults,null,2));}
      check(!result.violations.length,'error-state accessibility: '+JSON.stringify(result));
    };
    const verify = async (root,name) => {
      await count(root,2);
      const summary=page.locator(root+' > [data-error-summary]');
      check(await page.locator(root+' > [data-error-summary-live][aria-live="polite"][aria-atomic="true"]').count()===1 && !await summary.locator('[role="alert"]').count(),'summary is not polite');
      check(await summary.locator('a').evaluateAll(as=>as.every(a=>{
        const input=document.getElementById(a.dataset.errorTarget), error=input&&document.getElementById(input.id+'-error');
        return input?.getAttribute('aria-invalid')==='true' && error && a.textContent.includes(error.textContent);
      })),'summary differs from its field messages');
      for(const scheme of ['light','dark']){
        await page.evaluate(s=>{document.documentElement.dataset.theme=s;},scheme);
        for(const width of [320,390,768,1280]){
          await page.setViewportSize({width,height:844});
          await summary.locator('a').first().focus();
          await summary.evaluate(e=>e.scrollIntoView({block:'center',behavior:'instant'}));
          await scan(summary);
          if(process.env.ERROR_SHOTS && [390,1280].includes(width)) await summary.screenshot({path:process.env.ERROR_SHOTS+'/'+name+'-'+width+'-'+scheme+'.png'});
          for(let i=0;i<2;i++){
            await summary.evaluate(e=>e.scrollIntoView({block:'center',behavior:'instant'}));
          const link=summary.locator('a').nth(i), target=await link.getAttribute('data-error-target');
          await link.focus();await link.evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));
          await page.evaluate(activation=>{window.__errorSummaryActivation=activation;window.__errorSummaryTrace=[];window.__captureErrorSummary('before activation');},{id:target,form:name,scheme,width,index:i});
          // A viewport/scroll change can still be compacting the header. Finish that layout before the gesture.
          await page.evaluate(async()=>{await new Promise(requestAnimationFrame);await Promise.all(document.querySelector('.app-topbar').getAnimations({subtree:true}).filter(a=>'transitionProperty' in a).map(a=>a.finished.catch(()=>{})));});
          if(width<700) await link.tap(); else { await link.focus(); await page.keyboard.press('Enter'); }
          await waited(page,id=>{
            const e=document.getElementById(id);if(!e||e!==document.activeElement)return false;
            const r=e.getBoundingClientRect();return r.top>document.querySelector('.app-topbar').getBoundingClientRect().bottom && r.bottom<innerHeight-64 && document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)===e;
          },'the '+name+' summary target '+i+' at '+width+'/'+scheme+' to be focused and unobscured',target).catch(async error=>{
            const trace=await page.evaluate(()=>{window.__captureErrorSummary('timeout');return window.__errorSummaryTrace;});
            if(process.env.ERROR_TRACE_DIR){fs.mkdirSync(process.env.ERROR_TRACE_DIR,{recursive:true});fs.writeFileSync(path.join(process.env.ERROR_TRACE_DIR,'failure.json'),JSON.stringify(trace,null,2));}
            throw new Error(error.message+'; target trace: '+JSON.stringify(trace.slice(-20)));
          });
          await page.evaluate(()=>window.__captureErrorSummary('settled'));
          const field=page.locator('[id="'+target+'"]');
          await scan(field.locator('xpath=ancestor::*[contains(@class,"calc-field") or contains(@class,"proj-field") or contains(@class,"ty-cell") or contains(@class,"m-edit-field")][1]'));
          }
          check(await summary.evaluate(e=>e.scrollWidth<=e.clientWidth+1),'summary has local horizontal overflow');
          check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'error summary overflows at '+width);
        }
      }
    };
    await go(page,'properties');
    await page.locator('[data-prop-edit]').first().click();
    const property='.property-card[data-property-id="'+await page.locator('.property-card').first().getAttribute('data-property-id')+'"]';
    const value=await page.locator(property+' .prop-value').inputValue(), price=await page.locator(property+' .prop-purchase-price').inputValue();
    const propertySaved=await page.evaluate(async selector=>{const m=await import('/src/state.js'),id=document.querySelector(selector).dataset.propertyId,p=m.state.properties.find(p=>p.id===id);return JSON.stringify({...p,sectionsCollapsed:undefined});},property);
    check(!await page.locator(property+' > [data-error-summary]:visible').count(),'valid form shows an error summary');
    await page.locator(property+' .prop-value').fill('');
    await page.locator(property+' .prop-purchase-price').fill('-100');await page.locator(property+' .prop-purchase-price').press('Tab');
    await count(property,2);
    await page.evaluate(async()=>(await import('/src/components/properties.js')).renderProperties());
    await count(property,2);
    check(await page.locator(property+' .prop-value').inputValue()==='' && await page.locator(property+' .prop-purchase-price').inputValue()==='-100','property redraw lost invalid drafts');
    await page.locator(property+' [data-prop-tab][data-tab="loans"]').evaluate(e=>e.click());
    await verify(property,'property');
    // Collapsing an erroneous section redraws the card. A link reopens it without losing drafts.
    await page.locator(property+' [data-prop-section-toggle="value"]').evaluate(e=>e.click());
    await count(property,2);
    await page.locator(property+' [data-error-summary] a').first().click();
    check(await page.locator(property+' .prop-value').isVisible() && await page.locator(property+' .prop-value').inputValue()==='','collapsed section did not reveal its draft');
    check(await page.evaluate(async selector=>{const m=await import('/src/state.js'),id=document.querySelector(selector).dataset.propertyId,p=m.state.properties.find(p=>p.id===id);return JSON.stringify({...p,sectionsCollapsed:undefined});},property)===propertySaved,'summary interaction changed saved property figures');
    await page.locator(property+' .prop-value').fill(value);
    await count(property,1);
    await page.locator(property+' .prop-purchase-price').fill(price);await page.locator(property+' .prop-purchase-price').press('Tab');
    await count(property,0);
    await page.locator(property+' .prop-value').fill('');await count(property,1);
    await page.locator(property+' [data-prop-edit-done]').click();await count(property,0);
    check(await page.locator(property+' .prop-value').inputValue()===value && !await page.locator(property+' .prop-value').getAttribute('aria-invalid'),'closing property details restored an invalid draft');
    await go(page,'tax','data-tax-sub','people');
    const person=await page.locator('[data-pp-card]').first().getAttribute('data-pp-card'), people='[data-pp-card="'+person+'"]';
    const help=await page.locator(people+' .pp-help').inputValue(), week=await page.locator(people+' .pp-week').inputValue();
    const personSaved=await stored(page,'JSON.stringify(state.tax.settings['+JSON.stringify(person)+'])');
    await page.locator(people+' .pp-help').fill('');await page.locator(people+' .pp-help').press('Tab');
    await page.locator(people+' .pp-week').fill('200');await page.locator(people+' .pp-week').press('Tab');
    await page.evaluate(async()=>(await import('/src/components/people.js')).renderPeople());
    await verify(people,'people');
    check(await stored(page,'JSON.stringify(state.tax.settings['+JSON.stringify(person)+'])')===personSaved,'summary interaction changed saved person figures');
    check(await page.locator(people+' .pp-help').inputValue()==='' && await page.locator(people+' .pp-week').inputValue()==='200','people redraw lost drafts');
    await page.locator(people+' .pp-help').fill(help);await page.locator(people+' .pp-help').press('Tab');
    await page.locator(people+' .pp-week').fill(week);await page.locator(people+' .pp-week').press('Tab');
    await count(people,0);
    await go(page,'tax','data-tax-sub','returns');
    const owner=await page.locator('[data-ty-add="is"]').first().getAttribute('data-ty-person'), tax='[data-ty-card="'+owner+'"]';
    await page.locator(tax+' details').evaluateAll(ds=>ds.forEach(d=>d.open=true));
    for(const payer of ['Employer A','Employer <B> & "example"']){
      await page.locator(tax+' [data-ty-add="is"]').click();
      await page.locator(tax+' details').evaluateAll(ds=>ds.forEach(d=>d.open=true));
      await page.locator(tax+' [data-ty-key="payer"]').last().fill(payer);await page.locator(tax+' [data-ty-key="payer"]').last().press('Tab');
      await page.locator(tax+' [data-ty-kind="is"][data-ty-key="gross"]').last().fill('1000');await page.locator(tax+' [data-ty-kind="is"][data-ty-key="gross"]').last().press('Tab');
    }
    const gross=page.locator(tax+' [data-ty-kind="is"][data-ty-key="gross"]');
    const n=await gross.count();
    await gross.nth(n-2).fill('');await gross.nth(n-2).dispatchEvent('change');
    await gross.last().fill('');await gross.last().dispatchEvent('change');
    await page.evaluate(async()=>(await import('/src/components/taxyear.js')).renderTaxYear());
    await page.locator(tax+' details').first().evaluate(d=>d.open=false);
    check((await page.locator(tax+' [data-error-summary]').textContent()).includes('Employer <B> & "example"') && !await page.locator(tax+' [data-error-summary] b').count(),'summary treats imported/user text as markup');
    await verify(tax,'return');
    check(await page.evaluate(async person=>{const t=await import('/src/components/taxyear.js'),c=await import('/src/calc/taxyear.js');return c.personYear(t.taxYearSelected(),person,false).incomeStatements.slice(-2).every(r=>r.gross===1000);},owner),'summary interaction saved invalid return figures');
    await page.locator(tax+' [data-ty-del="is"]').nth(n-2).click();
    await count(tax,1);
    check(await gross.last().inputValue()==='' && await gross.last().getAttribute('aria-invalid')==='true','deleting an earlier row lost or moved the remaining draft');
    await gross.last().fill('1000');await gross.last().dispatchEvent('change');
    await count(tax,0);
    await go(page,'plan','data-plan-sub','scenarios');
    const scenario=await page.locator('#cards .card').filter({hasText:/buy/i}).first().locator('.card-edit-link[data-edit-scenario]').getAttribute('data-edit-scenario');
    await click(page,'#cards .card-edit-link[data-edit-scenario="'+scenario+'"]');await waited(page,()=>document.body.dataset.currentPage==='scenario','the scenario editor');
    await click(page,'[data-sc-calc]');await waited(page,()=>document.body.dataset.currentPage==='calc','the purchase calculator');
    const calc='#calcScenarioBody [data-calc-scenario]';
    const paid=await page.locator(calc+' .calc-price').inputValue(), term=await page.locator(calc+' .calc-term').inputValue();
    const purchaseKey=await page.locator(calc).getAttribute('data-calc-scenario'),purchaseSaved=await stored(page,'JSON.stringify(state.purchase['+JSON.stringify(purchaseKey)+'])');
    await page.locator(calc+' .calc-price').fill('');await page.locator(calc+' .calc-term').fill('0');
    await page.evaluate(async()=>(await import('/src/components/scenarios.js')).renderCalcScenario());
    await verify(calc,'purchase');
    check(await stored(page,'JSON.stringify(state.purchase['+JSON.stringify(purchaseKey)+'])')===purchaseSaved,'summary interaction changed the purchase draft figures');
    check(await page.locator(calc+' .calc-price').inputValue()==='' && await page.locator(calc+' .calc-term').inputValue()==='0','calculator redraw lost drafts');
    await page.locator(calc+' .calc-price').fill(paid);await page.locator(calc+' .calc-term').fill(term);
    await count(calc,0);
    if(process.env.ERROR_TRACE_DIR){fs.mkdirSync(process.env.ERROR_TRACE_DIR,{recursive:true});fs.writeFileSync(path.join(process.env.ERROR_TRACE_DIR,'samples.json'),JSON.stringify(await page.evaluate(()=>window.__errorSummarySamples),null,2));}
    if(process.env.ERROR_A11Y) console.log('Error-summary accessibility: '+a11yResults.length+' scopes, zero violations.');
  },
  async periodranges(page){
    await quiet(page);
    await page.evaluate(async () => {
      const s = await import('/src/state.js');
      s.state.yearBasis = 'financial';
      s.state.transactions = [
        {id:'example-current',what:'Example current month',date:'2026-11-01',amount:100,category:'Groceries'},
        {id:'example-prior',what:'Example prior month',date:'2026-10-06',amount:200,category:'Groceries'},
        {id:'example-old',what:'Example prior year',date:'2025-11-01',amount:300,category:'Groceries'}
      ];
      s.state.trips = [{id:'example-trip',name:'Example trip',from:'2026-10-05',to:'2026-10-10'}];
      s.commit(['transactions','trips','yearBasis']);
      (await import('/src/components/period.js')).applyPeriod(null,'');
    });
    const before = await stored(page, 'JSON.stringify({transactions:state.transactions,trips:state.trips,assets:state.assets})');
    await go(page,'expenses','data-expenses-sub','spending');
    const tx = page.locator('#transactionsTable'), heading = tx.locator('.record-heading h2');
    const amount = async () => Number((await tx.locator('#totalTransactionsAmount').textContent()).replace(/[^0-9.-]/g,''));
    const openFilters = async () => { if(!await tx.locator('#cfFilterRow').isVisible()) await tx.locator('.record-toolbar [data-cf-panel]').click(); };
    const headerYear = async year => {
      await page.evaluate(() => window.scrollTo(0,0));
      await waited(page,()=>!document.querySelector('.app-topbar').classList.contains('is-compact'),'the full period header');
      await page.locator('#periodBtn').click(); await page.locator('[data-period-year="'+year+'"]').click(); await page.keyboard.press('Escape');
    };
    check(await heading.textContent() === 'Nov 2026' && await amount() === 100,'month heading or entries disagree');
    check((await page.locator('#periodBtn').textContent()).includes('Nov · FY26/27'),'Spending header omits its month');
    await openFilters();
    check(await tx.getByRole('group',{name:'Spending list dates'}).isVisible(),'list dates are not named');
    await tx.locator('[data-tx-range="year"]').focus(); await page.keyboard.press('Enter');
    check(await heading.textContent() === 'FY26/27' && await amount() === 300,'year view does not follow selected year');
    await tx.locator('[data-tx-range="all"]').tap();
    check(await heading.textContent() === 'All dates' && await amount() === 600,'All does not state its local range');
    await headerYear(2025);
    check(await heading.textContent() === 'All dates' && await amount() === 600,'header year changed All dates');
    await openFilters(); await tx.locator('#transactionsRange [data-tx-range="month"]').click();
    check(await heading.textContent() === 'Jun 2026' && await amount() === 0,'month view does not use the past year effective month');
    await page.locator('#periodBtn').click(); await page.locator('[data-period-month="2025-11"]').tap(); await page.keyboard.press('Escape');
    check(await heading.textContent() === 'Nov 2025' && await amount() === 300,'header month did not update list dates and entries');
    await openFilters();
    await tx.locator('[data-cf-filter="from"]').fill('2026-10-01');
    await tx.locator('[data-cf-filter="to"]').fill('2026-11-01');
    check(await heading.textContent() === '1 Oct 2026 – 1 Nov 2026' && await amount() === 300,'dated filter does not state its actual window');
    await tx.locator('[data-cf-filter="trip"]').selectOption('example-trip');
    check(await heading.textContent() === '5 Oct 2026 – 10 Oct 2026' && await amount() === 200,'trip intersection does not state its effective dates');
    await page.keyboard.press('Escape');
    check(await heading.isVisible() && !await tx.locator('#cfFilterRow').isVisible(),'dates disappear with Filters closed');
    await headerYear(2026);
    check(await heading.textContent() === '5 Oct 2026 – 10 Oct 2026' && await amount() === 200,'global period changed a dated trip filter');
    await openFilters(); await tx.locator('[data-cf-clear]').click();
    await page.locator('#periodBtn').click(); await page.locator('[data-period-basis="calendar"]').click(); await page.keyboard.press('Escape');
    await openFilters(); await tx.locator('[data-tx-range="year"]').click();
    check(await heading.textContent() === '2026' && await amount() === 300,'calendar year list does not agree with the header');
    await go(page,'reports','data-report','categories');
    const range = page.locator('[data-rf="range"]'), subtitle = page.locator('#reportSheet .rp-head > div > span').first();
    const reportTotal = () => page.evaluate(async () => {
      const r = await import('/src/components/reports.js'), c = await import('/src/calc/reports.js');
      return c.buildReport(r.reportShown.key,r.reportOpts()).rows.find(x=>x.cls==='total').cells.total;
    });
    check(await reportTotal() === 300,'selected calendar-year report total changed');
    check(await range.locator('option[value="period"]').textContent() === 'Selected year · 2026','report default does not name the actual year');
    check((await subtitle.textContent()).includes('1 Jan 2026 – 31 Dec 2026'),'report omits actual year dates');
    await range.selectOption('month');
    check((await subtitle.textContent()).includes('1 Nov 2026 – 30 Nov 2026') && await reportTotal() === 100,'monthly report dates or total disagree');
    await range.selectOption('custom');
    await page.locator('[data-rf="from"]').fill('2025-11-01');
    await page.locator('[data-rf="to"]').fill('2026-10-31');
    const custom = await subtitle.textContent();
    check(await reportTotal() === 500,'custom report total changed');
    await headerYear(2025);
    check(await subtitle.textContent() === custom && await reportTotal() === 500 && custom.includes('1 Nov 2025 – 31 Oct 2026'),'global year changed custom report dates');
    check(await range.locator('option[value="period"]').textContent() === 'Selected year · 2025','report selected-year option is stale');
    await range.selectOption('period');
    check((await subtitle.textContent()).includes('1 Jan 2025 – 31 Dec 2025') && await reportTotal() === 300,'selected-year report did not follow header');
    const printed = await page.evaluate(async()=>(await import('/src/components/reports.js')).reportPrintHtml());
    check(printed.includes('1 Jan 2025 – 31 Dec 2025'),'printed report omits its actual dates');
    await range.selectOption('month');
    check((await subtitle.textContent()).includes('1 Nov 2026 – 30 Nov 2026') && await reportTotal() === 100,'current-month report silently followed the selected past year');
    for(const scheme of ['light','dark']){
      await page.evaluate(s=>{document.documentElement.dataset.theme=s;},scheme);
      for(const width of [320,390,1280]){
        await page.setViewportSize({width,height:844});
        check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'report date controls overflow');
        await go(page,'expenses','data-expenses-sub','spending'); await openFilters();
        check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'list date controls overflow');
        if(process.env.RANGE_SHOTS && width!==320) await page.screenshot({path:process.env.RANGE_SHOTS+'/spending-'+width+'-'+scheme+'.png'});
        await go(page,'reports','data-report','categories');
        if(process.env.RANGE_SHOTS && width!==320) await page.screenshot({path:process.env.RANGE_SHOTS+'/reports-'+width+'-'+scheme+'.png'});
      }
    }
    check(await stored(page,'JSON.stringify({transactions:state.transactions,trips:state.trips,assets:state.assets})')===before,'viewing date ranges changed saved financial records');
  },
  async periodheader(page){
    await quiet(page);
    await go(page, 'dashboard', 'data-dashboard-sub', 'overview');
    const label = page.locator('#periodBtn .period-btn-label');
    check(await label.textContent() === 'Nov · FY26/27', 'Home does not state its implicit month');
    const balances = await stored(page, 'JSON.stringify({assets:state.assets,transactions:state.transactions})');
    await page.locator('#periodBtn').focus(); await page.keyboard.press('Enter');
    await page.locator('[data-period-year="2025"]').focus(); await page.keyboard.press('Enter');
    check(await label.textContent() === 'Jun · FY25/26', 'past whole year does not state its effective month');
    check((await page.locator('#periodBtn').getAttribute('aria-label')).includes('not today'), 'accessible name omits the visible past-period flag');
    await page.keyboard.press('Escape');
    // Net worth is the glance's hero now (no card of its own): a past period says it stays as of today.
    check((await page.locator('#homeSummary .home-period-note').textContent()).includes('always as of today'), 'balance date followed the past period');
    for(const scheme of ['light','dark']){
      await page.evaluate(s => { document.documentElement.dataset.theme = s; }, scheme);
      for(const width of [320,390,1280]){
        await page.setViewportSize({width,height:844});
        for(const sub of ['budget','income']){
          await go(page, 'expenses', 'data-expenses-sub', sub);
          check(await label.textContent() === 'Jun · FY25/26', 'monthly cash-flow label is stale after navigation');
          check((await page.locator('#periodBtn').getAttribute('aria-label')).includes(await label.textContent()), 'accessible period label disagrees');
        }
        await go(page, 'tax', 'data-tax-sub', 'year');
        check(await label.textContent() === 'FY25/26', 'annual tax view states a monthly range');
        check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'period header overflows');
      }
    }
    await go(page, 'expenses', 'data-expenses-sub', 'income');
    await page.locator('#periodBtn').tap();
    await page.locator('[data-period-month="2025-07"]').tap();
    await page.keyboard.press('Escape');
    check(await label.textContent() === 'Jul · FY25/26', 'touch month selection did not update the label');
    await go(page, 'dashboard', 'data-dashboard-sub', 'overview');
    check(await label.textContent() === 'Jul · FY25/26' && (await page.locator('#homeSummary').innerText()).includes('July 2025'), 'Home and header months disagree');
    await page.locator('#periodBtn').click();
    await page.locator('[data-period-basis="calendar"]').click();
    await page.keyboard.press('Escape');
    check(await label.textContent() === 'Nov · 2026', 'calendar basis label is stale');
    check(await stored(page, 'JSON.stringify({assets:state.assets,transactions:state.transactions})') === balances, 'period labels changed balances or transactions');
  },
  async reportlabels(page){
    await quiet(page);
    const printed = {};
    for(const scheme of ['light','dark']){
      await page.evaluate(s => { document.documentElement.dataset.theme = s; }, scheme);
      for(const width of [320,390,1280]){
        await page.setViewportSize({width,height:844});
        for(const report of ['cashflow','categories']){
          await go(page, 'reports', 'data-report', report);
          const chart = page.locator('#reportsBody .rc').first();
          await chart.waitFor({state:'visible'});
          await waited(page, () => {
            const svg = document.querySelector('#reportsBody .rc svg');
            return svg && Math.abs(svg.getScreenCTM().a - 1) < 0.02;
          }, 'report SVG units to match CSS pixels');
          const bad = await chart.locator('text').evaluateAll(es => es.some(e => Math.abs(e.getScreenCTM().a - 1) > 0.02));
          check(!bad, 'report text scales with its container');
          const labels = await chart.locator('text[y="154"]').evaluateAll(es => es.map(e => ({left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right})));
          check(labels.every((r,i) => !i || r.left >= labels[i-1].right + 2), 'month labels overlap');
          check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'report chart overflows');
          const print = await page.evaluate(async () => (await import('/src/components/reports.js')).reportPrintHtml());
          if(printed[report]) check(printed[report] === print, 'resizing changed the printed report or its values');
          else printed[report] = print;
          if(process.env.LABEL_SHOTS && width !== 320) await chart.screenshot({path:process.env.LABEL_SHOTS + '/' + report + '-' + width + '-' + scheme + '.png'});
        }
      }
    }
    const chart = page.locator('#reportsBody .rc').first();
    await chart.evaluate(e => { e.dataset.resizeProbe = 'same'; });
    await page.setViewportSize({width:390,height:844});
    await waited(page, () => {
      const svg = document.querySelector('#reportsBody .rc svg');
      return svg && Math.abs(svg.getScreenCTM().a - 1) < 0.02;
    }, 'the existing chart to resize');
    check(await chart.getAttribute('data-resize-probe') === 'same', 'resize replaced the chart container');
    await go(page, 'dashboard');
    await page.setViewportSize({width:1280,height:844});
    await go(page, 'reports', 'data-report', 'cashflow');
    await waited(page, () => Math.abs(document.querySelector('#reportsBody .rc svg').getScreenCTM().a-1)<0.02, 'a reopened report to fit');
    await page.evaluate(async () => {
      const detail = await import('/src/components/detail.js');
      detail.detailTarget.kind = 'line'; detail.detailTarget.id = 'demo-groceries';
      detail.renderDetailPage();
      (await import('/src/components/nav.js')).showPage('detail');
    });
    await waited(page, () => {
      const svg = document.querySelector('#detailBody .rc svg');
      return document.body.dataset.currentPage === 'detail' && svg && Math.abs(svg.getScreenCTM().a-1)<0.02;
    }, 'the shared Detail chart to fit after opening');
    await page.setViewportSize({width:320,height:844});
    await waited(page, () => Math.abs(document.querySelector('#detailBody .rc svg').getScreenCTM().a-1)<0.02, 'the Detail chart to resize');

  },
  async sidebarfooter(page){
    await quiet(page);
    const before = await stored(page, 'JSON.stringify({assets:state.assets,lastBackupDate:state.lastBackupDate})');
    await go(page, 'settings', 'data-accounts-sub', 'preferences');
    check(await page.locator('.app-version-num').count() === 1, 'release version marker is missing or duplicated');
    check(await page.locator('#accountsSub-preferences .app-version-num').textContent() === await page.locator('#avatarVersion').textContent(), 'avatar and Preferences versions disagree');
    const privacy = await page.locator('#dataPrivacyNote').textContent();
    check(privacy.includes('sync carries it encrypted') && privacy.includes('not guaranteed anonymous') && privacy.includes('Clearing your browser data clears it too'), 'privacy risks were lost');
    check((await page.locator('.app-sidebar-footer').textContent()).trim() === 'Stored on this device · Back up', 'sidebar footer is not concise');
    for(const scheme of ['light','dark']){
      await page.evaluate(s => { document.documentElement.dataset.theme = s; }, scheme);
      for(const width of [390,1280]){
        await page.setViewportSize({width,height:844});
        await page.evaluate(() => window.scrollTo(0,0));
        check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Preferences overflow');
        if(process.env.FOOTER_SHOTS){
          await page.screenshot({path:process.env.FOOTER_SHOTS + '/preferences-' + width + '-' + scheme + '.png'});
          await page.locator('details:has(#checkUpdatesLink)').screenshot({path:process.env.FOOTER_SHOTS + '/about-' + width + '-' + scheme + '.png'});
        }
      }
    }
    await Promise.all([page.waitForResponse(r => /\/index\.html\?v=/.test(r.url())), page.locator('#checkUpdatesLink').click()]);
    await waited(page, () => [...document.querySelectorAll('.toast')].some(e => e.textContent.includes("You're on the latest version")), 'Preferences update check to read the release version');
    await go(page, 'dashboard');
    await page.locator('#exportLink2').click();
    check(await page.getByRole('dialog', {name:'Protect your data'}).isVisible(), 'sidebar backup shortcut did not open backup');
    await answerDialog(page, false);
    await page.setViewportSize({width:390,height:844});
    await page.locator('#avatarBtn').click();
    await Promise.all([page.waitForResponse(r => /\/index\.html\?v=/.test(r.url())), page.locator('[data-avatar-go="updates"]').click()]);
    await waited(page, () => [...document.querySelectorAll('.toast')].some(e => e.textContent.includes("You're on the latest version")), 'avatar update check to work from another page');
    await page.locator('#avatarBtn').click();
    await page.locator('[data-avatar-go="backup"]').click();
    await waited(page, () => document.body.dataset.currentPage === 'settings' && document.querySelector('[data-accounts-sub="preferences"]').getAttribute('aria-current') === 'page', 'avatar backup to open Preferences');
    check(await page.locator('#dataPrivacyNote').isVisible(), 'phone backup destination hides the privacy explanation');
    check(await stored(page, 'JSON.stringify({assets:state.assets,lastBackupDate:state.lastBackupDate})') === before, 'chrome actions changed balances or stamped a cancelled backup');
  },
  async homebalance(page){
    await quiet(page);
    await go(page, 'dashboard', 'data-dashboard-sub', 'overview');
    const before = await stored(page, 'JSON.stringify({assets:state.assets,savingsGoals:state.savingsGoals,transactions:state.transactions})');
    for(const scheme of ['light','dark']){
      await page.evaluate(s => { document.documentElement.dataset.theme = s; }, scheme);
      for(const width of [320,390,1280]){
        await page.setViewportSize({width,height:2000});
        await page.evaluate(() => window.scrollTo(0,0));
        if(process.env.HOME_SHOTS && width !== 320) await page.locator('#homeSummary').screenshot({path:process.env.HOME_SHOTS + '/home-' + width + '-' + scheme + '.png'});
        check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Home overflows');
        if(width === 1280){
          const heights = await page.locator('.home-grid > .home-card').evaluateAll(es => es.map(e => e.getBoundingClientRect().height));
          check(Math.max(...heights) - Math.min(...heights) > 30, 'Home cards still stretch to equal height');
          check((await page.locator('.home-week').boundingBox()).height < 100, 'collapsed desktop recap is not a compact row');
        }
        const recap = page.locator('.home-week .wk-details');
        await recap.locator('summary').click();
        check(await recap.evaluate(e => e.open) && await recap.locator('.wk-body').isVisible(), 'weekly recap cannot expand');
        await recap.locator('summary').click();
      }
    }
    check(await stored(page, 'JSON.stringify({assets:state.assets,savingsGoals:state.savingsGoals,transactions:state.transactions})') === before, 'Home layout changed financial data');
  },
  async categorycolours(page){
    await quiet(page);
    await go(page, 'settings', 'data-accounts-sub', 'categories');
    // #426: rows are folded; open the first to reach its delete.
    await page.locator('#categoriesTable .cat-fold-summary').first().click();
    const button = page.locator('#categoriesTable [data-cat-del]').first();
    const colourMatches = token => button.evaluate((e,token) => {
      const probe = document.createElement('span'); probe.style.color = 'var(' + token + ')'; e.append(probe);
      const expected = getComputedStyle(probe).color; probe.remove();
      return getComputedStyle(e).color === expected;
    }, token);
    for(const scheme of ['light','dark']){
      await page.evaluate(s => { document.documentElement.dataset.theme = s; }, scheme);
      for(const width of [390,1280]){
        await page.setViewportSize({width,height:844});
        await button.scrollIntoViewIfNeeded();
        await page.mouse.move(0,0);
        await button.evaluate(e => e.blur());
        check(await colourMatches('--ink-soft'), 'category deletes are not quiet at rest in ' + scheme);
        await button.hover();
        check(await colourMatches('--bad-ink'), 'hover does not show danger colour');
        await page.mouse.move(0,0);
        await button.focus(); await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
        check(await button.evaluate(e => e === document.activeElement && e.matches(':focus-visible')), 'keyboard cannot focus category delete');
        check(await colourMatches('--bad-ink'), 'keyboard focus does not show danger colour');
        check(await button.evaluate(e => getComputedStyle(e).boxShadow !== 'none' || getComputedStyle(e).outlineStyle !== 'none'), 'delete has no keyboard focus indicator');
        await page.keyboard.press('Tab');
        check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'category controls overflow');
        if(process.env.CATEGORY_SHOTS){
          await page.evaluate(() => window.scrollTo(0,0));
          await page.screenshot({path:process.env.CATEGORY_SHOTS + '/categories-' + width + '-' + scheme + '.png'});
        }
      }
    }
  },
  async categories(page){
    await quiet(page);
    await page.evaluate(async () => { const m = await import("/src/state.js"); m.state.shared[1].category = ""; m.commit(["shared"]); });
    const before = await stored(page, "({ cat: state.shared[0].category, other: state.shared[1].category, i: state.categories.indexOf(state.shared[0].category), n: state.categories.length })");
    await go(page, "settings", "data-accounts-sub", "categories");
    const field = '#categoriesTable .cat-mgmt-name[data-cat-index="' + before.i + '"]';
    // #426: folded until opened — each row its icon, name and use.
    check(!await page.locator(field).isVisible(), "category rows are not folded");
    check(await page.locator('#categoriesTable .cat-fold-summary').nth(before.i).innerText().then(t => t.includes(before.cat)), "a folded row does not name its category");
    await page.locator('#categoriesTable .cat-fold-summary').nth(before.i).click();
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
  // #308: debt uses the category palette; a surcharge is a normal-weight warning.
  async financialcolours(page){
    await quiet(page);
    await go(page, 'tax', 'data-tax-sub', 'year');
    const person = await page.locator('#taxSuperBody [data-tax-person]').first().getAttribute('data-tax-person');
    await page.evaluate(async person => {
      const s = await import('/src/state.js');
      s.state.tax.privateHospitalCover = false;
      s.state.income.filter(i => i.incomeType === 'Gross' && i.person === person).forEach(i => { i.amount = 300000; i.freq = 'Yearly'; });
      (await import('/src/calc/engine.js')).recalcComputedItems();
      (await import('/src/components/income.js')).renderTaxSuper();
    }, person);
    const note = page.locator('#taxSuperBody [data-tax-person]').first().locator('.tax-mls-note');
    const wording = await note.textContent();
    check(await note.isVisible() && await note.evaluate(e => e.classList.contains('warn')), 'fixture has no surcharge warning');
    for(const scheme of ['light','dark']){
      await page.evaluate(s => { document.documentElement.dataset.theme = s; }, scheme);
      for(const width of [390,1280]){
        await page.setViewportSize({width,height:844});
        await go(page, 'properties');
        const bar = page.locator('#propertiesEquityDebtBar');
        const debt = bar.locator('.tax-waterfall-seg[aria-label^="Debt:"]');
        check(await debt.evaluate(e => e.classList.contains('series-color-0')), 'debt does not use the blue chart category');
        check(await bar.locator('.proj-swatch.series-color-0').count() === 1, 'debt legend and segment colours disagree');
        await bar.scrollIntoViewIfNeeded();
        if(process.env.COLOUR_SHOTS) await bar.screenshot({path:process.env.COLOUR_SHOTS + '/property-' + width + '-' + scheme + '.png'});
        await go(page, 'tax', 'data-tax-sub', 'year');
        const style = await note.evaluate(e => {
          const probe = document.createElement('span'); probe.style.color = 'var(--warn-ink)'; e.append(probe);
          const expected = getComputedStyle(probe).color; probe.remove();
          return {color:getComputedStyle(e).color, weight:getComputedStyle(e).fontWeight, expected};
        });
        check(style.color === style.expected && style.weight === '400', 'surcharge is not a normal-weight standard warning in ' + scheme);
        await note.scrollIntoViewIfNeeded();
        if(process.env.COLOUR_SHOTS) await note.screenshot({path:process.env.COLOUR_SHOTS + '/surcharge-' + width + '-' + scheme + '.png'});
        check(await note.textContent() === wording, 'styling changed the surcharge wording');
        check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'warning causes page overflow');
      }
    }
    // Hospital cover live-patches the existing notice; switching back must retain the warning skin.
    await note.evaluate(e => { e.dataset.colourProbe = 'same'; });
    await page.evaluate(async () => {
      const s = await import('/src/state.js'); s.state.tax.privateHospitalCover = true;
      (await import('/src/components/income.js')).patchAllTaxPersonOutputs();
    });
    check(!await note.evaluate(e => e.classList.contains('warn')), 'covered notice kept warning styling');
    await page.evaluate(async () => {
      const s = await import('/src/state.js'); s.state.tax.privateHospitalCover = false;
      (await import('/src/components/income.js')).patchAllTaxPersonOutputs();
    });
    check(await note.getAttribute('data-colour-probe') === 'same' && await note.evaluate(e => e.classList.contains('warn') && getComputedStyle(e).fontWeight === '400'), 'live patch lost the standard warning');
    check(await note.textContent() === wording, 'live patch changed the original surcharge wording');
  },
  // #308: display dates stay readable and today's balances do not follow the reporting period.
  async displaydates(page){
    await quiet(page);
    const fixture=await page.evaluate(async()=>{
      const s=await import('/src/state.js'),e=await import('/src/calc/engine.js'),r=await import('/src/calc/received.js');
      const p=s.state.properties.find(p=>p.kind==='IP'),loan=p.loans[0];
      p.sectionsCollapsed=Object.assign({},p.sectionsCollapsed,{loans:false});
      loan.rateHistory=[{date:'2025-07-01',rate:5},{date:'2026-07-01',rate:6}];loan.rate=6;
      p.rentReviews=[{date:'2026-10-01',from:500,to:600,freq:'Weekly',change:0.2}];
      p.agentStatements=[{id:'example-dated-statement',date:'2026-11-01',rent:1000,fees:100,water:0,waterRates:0,others:[],net:900,txIds:[]}];
      (await import('/src/calc/accounts.js')).loanAccountFor(loan.id);
      const asset=s.state.assets.find(a=>a.category==='Cash');
      asset.history=[{date:'2026-10-01',value:10000},{date:'2026-11-01',value:12000}];asset.amount=12000;
      const share=s.state.assets.findIndex(a=>a.category==='Shares');
      (await import('/src/components/assets.js')).recordAssetSale(share,{date:'2026-10-01',units:1,proceeds:100,costBase:50,acquired:'2025-07-01'});
      s.state.monthReviews['2026-10']={statements:{},done:'2026-11-01'};
      e.recalcComputedItems();
      const target=r.incomeTargets().find(t=>t.key.startsWith('net:'))||r.incomeTargets()[0];
      r.logIncomeReceived({target:target.key,date:'2026-11-01',amount:1000,what:'Example receipt'});
      s.state.transactions.push({id:'example-dated-spend',date:'2026-11-01',amount:100,what:'Example purchase',linkedExpenseId:'demo-groceries',account:''});
      s.state.accounts.push({id:'example-dated-card',name:'Example Card',type:'credit',statementStartDay:1,payDay:1});
      s.state.transactions.push({id:'example-card-charge',date:'2026-10-15',amount:100,what:'Example card purchase',account:'Example Card'});
      s.commit(['*']);
      const notice=(await import('/src/lib/notifications.js')).getLocalNotifications().find(n=>n.id.startsWith('cardpay:Example Card:')&&n.title.includes('not logged'));
      return {property:p.id,loan:loan.id,target:target.key,notice};
    });
    const snapshot=()=>page.evaluate(async()=>{
      const {state}=await import('/src/state.js'),e=await import('/src/calc/engine.js');
      const keys=['income','incomeLog','transactions','shared','assets','accounts','debts','properties','monthReviews'];
      const saved=JSON.parse(localStorage.getItem('wealthPlanner.v1'));
      return JSON.stringify({live:keys.map(k=>state[k]),saved:keys.map(k=>saved[k]),totals:e.scenarioTotals(state.baselineScenario),projection:e.computeNetWorthSeries(state.baselineScenario,1)});
    });
    const before=await snapshot(),dateErrors=[];
    check(fixture.notice?.date==='2026-11-01','overdue card date fixture is missing');
    if(!fixture.notice.title.includes('1 Nov 2026'))dateErrors.push('overdue notification: '+fixture.notice.title);
    if(process.env.DISPLAY_DATE_A11Y){const axe=await import('axe-core');await page.evaluate(axe.default.source);}
    if(process.env.DISPLAY_DATE_SHOTS)fs.mkdirSync(process.env.DISPLAY_DATE_SHOTS,{recursive:true});
    const audit=async(name,root,expected)=>{
      await root.waitFor({state:'visible'});
      await root.locator('details').evaluateAll(ds=>ds.forEach(d=>d.open=true));
      for(const width of [320,390,768,1280])for(const theme of ['light','dark']){
        await page.setViewportSize({width,height:844});await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
        const findings=await root.evaluate(el=>{
          const raw=[],walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);
          for(let n=walker.nextNode();n;n=walker.nextNode()){
            if(!/\b\d{4}-\d{2}-\d{2}\b/.test(n.textContent)||n.parentElement.closest('input,textarea,pre,code,.bank-import-source,[hidden]'))continue;
            const range=document.createRange();range.selectNodeContents(n);if(range.getClientRects().length)raw.push(n.textContent.trim());
          }
          const names=[...el.querySelectorAll('[aria-label]')].filter(n=>n.getClientRects().length&&/\b\d{4}-\d{2}-\d{2}\b/.test(n.getAttribute('aria-label'))).map(n=>n.getAttribute('aria-label'));
          return {raw,names,text:el.innerText,overflow:el.scrollWidth>el.clientWidth+1||document.documentElement.scrollWidth>innerWidth+1};
        });
        if(findings.raw.length||findings.names.length||!findings.text.includes(expected))dateErrors.push(name+'/'+width+'/'+theme+': '+JSON.stringify({raw:findings.raw,names:findings.names,missing:!findings.text.includes(expected)?expected:null}));
        check(!findings.overflow,'readable dates overflow '+name+'/'+width+'/'+theme+': '+JSON.stringify(await root.evaluate(el=>[el,...el.querySelectorAll('*')].filter(n=>n.getClientRects().length&&(n.scrollWidth>n.clientWidth+1||n.getBoundingClientRect().right>innerWidth+1)).slice(0,15).map(n=>({tag:n.tagName,class:n.className,width:n.clientWidth,scroll:n.scrollWidth,text:n.textContent.slice(0,160)})))));
        if(process.env.DISPLAY_DATE_A11Y){const violations=await root.evaluate(async el=>(await window.axe.run(el,{preload:false})).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.failureSummary)})));check(!violations.length,'date accessibility '+name+': '+JSON.stringify(violations));}
        if(process.env.DISPLAY_DATE_SHOTS&&(width===390||width===1280))await root.screenshot({path:path.join(process.env.DISPLAY_DATE_SHOTS,name+'-'+width+'-'+theme+'.png')});
      }
    };
    await go(page,'reports','data-report','cashflow');
    await audit('reports',page.locator('[aria-label="Report assumptions and data quality"]'),'As of 3 Nov 2026');
    await go(page,'dashboard','data-dashboard-sub','review');
    await page.evaluate(async()=>{const m=await import('/src/components/monthreview.js');m.setReviewMonth('2026-10');m.renderMonthReview();});
    if(await page.locator('[data-mr-intro-ok]').isVisible())await page.locator('[data-mr-intro-ok]').click();
    await page.locator('[data-mr-to="2"]').click();
    await audit('balances',page.locator('#monthReviewBody'),'Reviewed 1 Nov 2026');
    await go(page,'expenses','data-expenses-sub','income');
    const received=page.locator('#receivedBody [data-rcv-key="'+fixture.target+'"]');
    await received.locator('[data-rcv-toggle]').click();
    await audit('received',received,'1 Nov 2026');
    await go(page,'properties');await page.locator('[data-prop-edit="'+fixture.property+'"]').click();
    await page.locator('[data-prop-tab="'+fixture.property+'"][data-tab="income"]').click();
    await audit('rent',page.locator('[data-rent-panel="'+fixture.property+'"]'),'1 Oct 2026');
    check(await page.locator('[data-as-panel="'+fixture.property+'"] [data-as="date"]').inputValue()==='2026-11-03','statement date input stopped using ISO');
    await page.locator('[data-prop-tab="'+fixture.property+'"][data-tab="loans"]').click();
    const section=page.locator('.prop-tab-panel:not([hidden]) [data-prop-section-toggle="loans"]');
    if(await section.getAttribute('aria-expanded')==='false')await section.click();
    const loan=page.locator('.prop-tab-panel:not([hidden]) .m-row[data-loan-index="0"]');
    await loan.locator('[data-row-toggle]').click();await loan.locator('details').evaluateAll(ds=>ds.forEach(d=>d.open=true));
    await audit('rates',loan.locator('.rh-wrap'),'1 Jul 2025');
    check(await loan.locator('.loan-rate-date').inputValue()==='2026-11-03','rate date input stopped using ISO');
    await page.keyboard.press('Escape');await waited(page,()=>!document.querySelector('.m-row.open[role="dialog"]'),'loan editor closes');
    await go(page,'tax','data-tax-sub','documents');
    await audit('documents',page.locator('#taxSub-documents'),'sold 1 Oct 2026');
    await go(page,'expenses','data-expenses-sub','spending');
    await page.setInputFiles('#bankImportFile',{name:'Example 2026-10-01.csv',mimeType:'text/csv',buffer:Buffer.from('Date,Description,Amount,Balance\n2026-10-01,Example Market,-100,1000\n2026-10-02,Example Cafe,-20,980\n')});
    await page.locator('#bankImportConfirmBtn').waitFor();
    await audit('bank',page.locator('#bankImportPanel'),'1 Oct 2026');
    check((await page.locator('.bank-import-source').innerText()).includes('Example 2026-10-01.csv'),'literal source filename was reformatted');
    await page.locator('#bankImportCancelBtn').click();
    await page.setInputFiles('#bankImportFile',{name:'Investment loan statement.csv',mimeType:'text/csv',buffer:Buffer.from(LOAN_STATEMENT_CSV)});
    await page.locator('[data-bank-loan]').waitFor();
    await audit('loan-statement',page.locator('#bankImportPanel'),'31 Jul 2026');
    const balance=page.locator('[data-bank-setbalance]'),checked=await balance.isChecked();
    await page.locator('.bank-import-balance > span').click();
    check(await balance.isChecked()!==checked,'wrapping the balance label broke checkbox activation');
    await balance.setChecked(checked);
    await page.locator('#bankImportCancelBtn').click();
    const after=await snapshot();
    const a=JSON.parse(before),b=JSON.parse(after),keys=['income','incomeLog','transactions','shared','assets','accounts','debts','properties','monthReviews'];
    const changes=['live','saved'].flatMap(kind=>keys.filter((k,i)=>JSON.stringify(a[kind][i])!==JSON.stringify(b[kind][i])).map((k)=>kind+':'+k));
    if(JSON.stringify(a.totals)!==JSON.stringify(b.totals))changes.push('totals: '+JSON.stringify([a.totals,b.totals]));
    if(JSON.stringify(a.projection)!==JSON.stringify(b.projection))changes.push('projection');
    const fields=[];
    const diff=(a,b,path)=>{if(JSON.stringify(a)===JSON.stringify(b))return;if(a&&b&&typeof a==='object'&&typeof b==='object'){for(const k of new Set([...Object.keys(a),...Object.keys(b)]))diff(a[k],b[k],path+'.'+k);}else fields.push({path,before:a,after:b});};
    diff(a.live[7],b.live[7],'properties');
    check(after===before,'displaying dates changed saved values or calculations: '+JSON.stringify({changes,fields}));
    check(!dateErrors.length,'raw or missing readable dates: '+JSON.stringify(dateErrors));
  },
  async homedates(page){
    await go(page, 'dashboard', 'data-dashboard-sub', 'overview');
    const before = await stored(page, 'JSON.stringify({assets:state.assets,netWorthLog:state.netWorthLog})');
    await page.evaluate(async () => {
      (await import('/src/calc/ledger.js')).setPeriod(2025, '2025-09');
      (await import('/src/components/home.js')).renderHomeSummary();
    });
    for(const colorScheme of ['light','dark']){
      await page.emulateMedia({colorScheme});
      for(const width of [320,390,1280]){
        await page.setViewportSize({width,height:844});
        const card = page.locator('#homeSummary .home-period-note');
        check((await card.textContent()).includes('always as of today'), 'balance date did not stay today');
        check(!/\b\d{4}-\d{2}-\d{2}\b/.test(await page.locator('#homeSummary').innerText()), 'Home displays an ISO date');
        check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'readable date overflows');
        if(process.env.DATE_SHOTS && width !== 320) await card.screenshot({path:process.env.DATE_SHOTS + '/home-date-' + width + '-' + colorScheme + '.png'});
      }
    }
    check(await stored(page, 'JSON.stringify({assets:state.assets,netWorthLog:state.netWorthLog})') === before, 'display changed stored balances');
  },
  async homecompare(page){
    await quiet(page);
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
  // #267: the scenario cards' break-even figures are filled a tick after the cards are drawn. Replace the household
  // inside that tick (a reset, an import, another tab's save) and the cards still on screen name scenarios that are
  // gone: it threw "Cannot read properties of undefined (reading 'reduce')". A page error fails the journey.
  async replacedhousehold(page){
    await go(page, "plan", "data-plan-sub", "scenarios");
    check(await page.locator("#cards [data-card-breakeven]").count() > 0, "the demo household has no buying scenario to fill");
    await page.evaluate(async () => {
      const s = await import("/src/state.js"), d = await import("/src/components/dashboard.js");
      d.renderCards();                    // queues the fill for the next tick…
      s.setState(s.defaultState());       // …and the household is replaced before it runs
      await new Promise(r => setTimeout(r, 50));
    });
    await settle(page);
  },
  // #305: an observation put away from the bell is saved, leaves the bell, its page's line and Insights' list, and
  // sits in Insights' "Put away" fold; a Watch can't be put away; it comes back when brought back, and by itself
  // once its title is no longer the one that was dismissed (its figures moved).
  async dismissnotice(page){
    // The demo household's Watches are its scenarios' (a purchase short of cash); since #392 they are said on Plan →
    // Scenarios, so that's where a Watch is shown not to be dismissable — through the line, which opens the bell there.
    await go(page, 'plan', 'data-plan-sub', 'scenarios');
    await page.locator('#attentionLine [data-attn-line]').click();
    const panel = page.locator('#notifPanel');
    await panel.waitFor();
    check(await panel.locator('.notif-label.risk').count() > 0 && await panel.locator('.notif-row:has(.notif-label.risk)').count() === 0, 'a Watch can be dismissed from the bell');
    await page.keyboard.press('Escape');
    await waited(page, () => !document.getElementById('notifPanel'), 'the bell closed');
    await go(page, 'dashboard');
    await page.locator('.notif-bell-btn:visible').first().click();
    await panel.waitFor();
    const title = await panel.locator('.notif-row:has([data-notice-dismiss="wants"]) .notif-item-title').innerText();
    check(await panel.locator('[data-notice-dismiss="wants"]').getAttribute('aria-label') === 'Dismiss: ' + title, 'the dismiss button does not name its notice');
    await panel.locator('[data-notice-dismiss="wants"]').click();
    await until(page, () => !document.querySelector('#notifPanel [data-notice-dismiss="wants"]'));
    check(await panel.count() === 1, 'dismissing closed the list');
    check(await stored(page, 'state.noticesDismissed.wants') === title, 'the dismissal was not saved with its title');
    await page.keyboard.press('Escape');
    await go(page, 'expenses', 'data-expenses-sub', 'budget');
    await until(page, () => { const l = document.getElementById('attentionLine'); return !l || l.hidden || !/Wants were/.test(l.innerText); });
    check(await page.evaluate(() => { const l = document.getElementById('attentionLine'); return !l || l.hidden || !/Wants were/.test(l.innerText); }), 'the dismissed notice is still on Budget\'s line');
    await go(page, 'dashboard', 'data-dashboard-sub', 'insights');
    const home = page.locator('#adviceHome');
    check(await home.locator('.adv-panel > .adv-list [data-adv-id="wants"]').count() === 0, 'the dismissed notice is still in Insights\' list');
    check(await home.locator('.adv-risk [data-notice-dismiss]').count() === 0, 'a Watch can be dismissed on Insights');
    const fold = home.locator('[data-adv-away]');
    check((await fold.locator('summary').first().innerText()).includes('1 dismissed'), 'Insights has no Put away fold');
    await fold.locator('summary').first().click();
    await fold.locator('[data-notice-restore="wants"]').click();   // beside the card: no need to open it first
    await until(page, () => !document.querySelector('#adviceHome [data-adv-away]'));
    check(await stored(page, 'Object.keys(state.noticesDismissed).length') === 0, 'bringing it back was not saved');
    check(await home.locator('.adv-panel > .adv-list [data-adv-id="wants"]').count() === 1, 'brought back, it is not in the list');
    // One tap on Insights too: the ✕ beside the card, with the card still closed.
    check(await home.locator('[data-adv-id="wants"]').evaluate(d => !d.open), 'the card is open');
    await home.locator('.adv-row:has([data-adv-id="wants"]) [data-notice-dismiss="wants"]').click();
    await until(page, () => !!document.querySelector('#adviceHome [data-adv-away]'));
    check(await stored(page, 'state.noticesDismissed.wants') === title, 'dismissing from beside the card was not saved');
    // The fold remembers it was open, so it comes back open; make sure either way.
    await home.locator('[data-adv-away]').evaluate(d => { d.open = true; });
    await home.locator('[data-notice-restore="wants"]').click();
    await until(page, () => !document.querySelector('#adviceHome [data-adv-away]'));
    // Its figures move: what was dismissed was an older title, so it is shown again and the stale entry means nothing.
    await page.evaluate(() => import('/src/state.js').then(m => { m.state.noticesDismissed.wants = 'Wants were 99% of spending'; m.commit(['noticesDismissed']); }));
    check(await home.locator('.adv-panel > .adv-list [data-adv-id="wants"]').count() === 1, 'a notice whose figures changed since it was dismissed stays hidden');
    check(await home.locator('[data-adv-away]').count() === 0, 'a stale dismissal is counted as put away');
  },
  // #306: controls stay usable after leaving the default list, and saved filters keep their meaning.
  async recordtools(page){
    await quiet(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await go(page, 'assets', 'data-assets-sub', 'Shares');
    const assetsBefore = await stored(page, 'JSON.stringify(state.assets)');
    const shares = page.locator('#assetsSub-Shares');
    await shares.locator('.record-toolbar [data-asset-list-filters]').click();
    await shares.locator('[data-asset-list-person]').selectOption({ label: 'Alex' });
    await shares.locator('[data-shares-gain-filter="winners"]').click();
    await shares.locator('#sharesSortSelect').selectOption('value-desc');
    await shares.locator('#assetListFilters-Shares [data-asset-list-filters]').click();
    check((await shares.locator('.record-toolbar [data-asset-list-filters]').textContent()).includes('(3)'), 'Shares does not count person, gain and sort');
    check((await shares.locator('.record-applied').textContent()).includes('Alex'), 'closed filters hide the selected person');
    await shares.locator('[data-asset-list-clear]').click();
    check(!await shares.locator('.record-applied').count(), 'Clear left a Shares filter active');
    await shares.locator('.record-toolbar [data-overflow-toggle]').focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');
    check(await shares.locator('[data-asset-list-tool="prices"]').evaluate(e => e === document.activeElement), 'Tab did not reach Prices in the tools menu');
    await page.keyboard.press('Enter');
    check(await shares.locator('[data-ps-panel]').evaluate(d => d.open && !!d.getClientRects().length), 'Prices needs another disclosure after choosing the tool');
    await shares.locator('[data-asset-tool-panel="prices"] > [data-asset-list-tool]').click();
    check(await shares.locator('.record-toolbar [data-overflow-toggle]').evaluate(e => e === document.activeElement), 'closing Prices lost focus');
    await shares.locator('.record-toolbar [data-overflow-toggle]').click();
    await shares.locator('[data-asset-list-tool="trades"]').click();
    await shares.locator('[data-tr-text]').fill('Date,Code,Side,Quantity,Price,Brokerage\n2026-10-01,VAS,Buy,2,100,0');
    await shares.locator('[data-tr-read]').click();
    check(await shares.locator('.tr-preview').isVisible(), 'trade preview did not survive redraw in the tool');
    await shares.locator('[data-asset-tool-panel="trades"] > [data-asset-list-tool]').click();
    check(await stored(page, 'JSON.stringify(state.assets)') === assetsBefore, 'filters or reading trades changed stored holdings');
    await go(page, 'assets', 'data-assets-sub', 'Super');
    const sup = page.locator('#assetsSub-Super');
    await sup.locator('.record-toolbar [data-asset-list-filters]').click();
    await sup.locator('[data-asset-list-person]').selectOption({ label: 'Alex' });
    await page.keyboard.press('Escape');
    check(await sup.locator('.record-toolbar [data-asset-list-filters]').evaluate(e => e === document.activeElement), 'Escape from Super filters lost focus');
    check((await sup.locator('.record-applied').textContent()).includes('Alex'), 'Super hides its applied person');
    await sup.locator('[data-asset-list-clear]').click();
    await go(page, 'expenses', 'data-expenses-sub', 'spending');
    const tx = page.locator('#transactionsTable');
    await tx.locator('.record-toolbar [data-cf-panel]').click();
    await tx.locator('[data-cf-dir="in"]').click();
    await tx.locator('[data-tx-range="year"]').click();
    await tx.locator('[data-cf-view-save]').click();
    await tx.locator('[data-cf-view-name]').fill('Discard this name');
    await page.keyboard.press('Escape');
    check(!await tx.locator('[data-cf-view-name]').count() && await tx.locator('#cfFilterRow').isVisible(), 'Escape closed Filters instead of cancelling the view name');
    await tx.locator('[data-cf-view-save]').click();
    await tx.locator('[data-cf-view-name]').fill('Money received');
    await tx.locator('[data-cf-view-confirm]').click();
    check(await stored(page, 'state.txViews.some(v => v.name === "Money received" && v.filter.direction === "in")'), 'saved view lost the transaction type');
    await tx.locator('#cfFilterRow [data-cf-panel]').click();
    check((await tx.locator('.record-toolbar [data-cf-panel]').textContent()).includes('(2)'), 'Spending does not count type and scope');
    check(await tx.locator('.cf-chip[data-cf-dir="all"]').isVisible(), 'closed Spending filters hide transaction type');
    await tx.locator('[data-cf-clear]').click();
    await tx.locator('.record-toolbar [data-cf-panel]').click();
    await tx.locator('[data-cf-view]').filter({ hasText: 'Money received' }).click();
    check(await page.evaluate(async () => (await import('/src/components/cashflow.js')).txFilters.direction === 'in'), 'saved view did not restore its filter');
    await tx.locator('[data-cf-clear]').click();
    await page.evaluate(() => { const b = document.createElement('button'); b.id = 'sampleSpendingLink'; b.textContent = 'Show sample spending'; b.setAttribute('data-sv', ''); b.setAttribute('data-sv-direction', 'out'); b.setAttribute('data-sv-category', 'Groceries'); document.getElementById('transactionsTable').prepend(b); });
    await page.locator('#sampleSpendingLink').click();
    check(await page.evaluate(async () => { const f = (await import('/src/components/cashflow.js')).txFilters; return f.direction === 'out' && f.category === 'Groceries'; }), 'data-sv lost a filter');
    await tx.locator('[data-cf-clear]').click();
    await tx.locator('.record-toolbar [data-cf-search]').click();
    await tx.locator('[data-cf-filter="text"]').fill('Rent');
    await page.waitForFunction(() => document.querySelector('#transactionsTable [data-cf-filter="text"]').value === 'Rent' && !document.querySelector('#transactionsTable [data-cf-filter="text"]').closest('[hidden]'));
    await tx.locator('[data-cf-clear]').click();
    await tx.locator('[data-overflow-toggle]').click();
    await tx.locator('.page-overflow-menu [data-cf-select]').click();
    check(await tx.locator('.cf-bulk').isVisible(), 'Select transactions did not enter selection mode');
    await tx.locator('.cf-filters > [data-cf-select]').click();
    await tx.locator('[data-overflow-toggle]').click();
    await tx.locator('[data-cf-transfer]').click();
    check(await tx.locator('[data-tf="amount"]').evaluate(e => e === document.activeElement), 'transfer amount was not focused');
    await tx.locator('[data-tf-cancel]').click();
    check(await tx.locator('[data-overflow-toggle]').evaluate(e => e === document.activeElement), 'cancelling transfer lost focus');
  },
  // #259: real picker interaction, current state, history, redraw and resize.
  async mobileinvestments(page){
    await quiet(page);
    await page.locator('.mobile-tab[data-page="networth"]').tap();
    await page.waitForFunction(() => document.body.dataset.currentPage === "networth");
    const enter = async () => {
      await settle(page);
      // #428: Investments is behind Accounts' list — a holding's Details → Manage on Investments.
      await page.locator('#netWorthBody [data-detail="asset"]').first().tap();
      await page.waitForFunction(() => document.body.dataset.currentPage === "detail");
      await page.locator('[data-detail-edit]').tap();
      await page.waitForFunction(() => document.body.dataset.currentPage === "assets");
    };
    await enter();
    // Accounts' chips are the one switcher: the page behind a group has no pills of its own (and never a dropdown), and
    // is titled with the group's name — a holding's Details goes to its own kind's page.
    check(!await page.locator('#page-assets .subnav, #page-assets select.section-picker').count(), "Investments' page has a section switcher of its own");
    check(await page.evaluate(async () => { const t = (await import('/src/constants.js')).ASSET_PAGE_TITLES, shown = [...document.querySelectorAll('.assets-subpage')].find(e => !e.hidden);
      return !!shown && document.getElementById('pageTitle').textContent === t[shown.id.replace('assetsSub-', '')]; }), "Manage didn't open a page titled with its holding's kind");
    await page.locator('#pageBack').tap();
    await page.waitForFunction(() => document.body.dataset.currentPage === "networth");
    // Each group's heading opens its kind's page, named as the group is; Other things is vehicles and the rest together.
    for(const [go_, title, shown] of [['assets/Shares', 'Investments', ['Shares']], ['assets/Super', 'Super', ['Super']], ['assets/Other', 'Other things', ['Vehicle', 'Other']]]){
      const heading = page.locator('#netWorthBody .nw-go[data-go="' + go_ + '"]');
      await heading.scrollIntoViewIfNeeded(); await heading.tap();
      await page.waitForFunction(() => document.body.dataset.currentPage === "assets");
      check(await page.locator('#pageTitle').innerText() === title, go_ + ' is titled ' + await page.locator('#pageTitle').innerText() + ', not ' + title);
      check(JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('.assets-subpage')].filter(e => !e.hidden).map(e => e.id.replace('assetsSub-', '')))) === JSON.stringify(shown), go_ + ' shows the wrong sections');
      check(!await page.locator('.nw-manage').count(), 'a "Manage on" link is still on Accounts');
      await page.locator('#pageBack').tap();
      await page.waitForFunction(() => document.body.dataset.currentPage === "networth");
      // Each card ends with a row naming what its page holds, going to the same page as its heading.
      const foot = page.locator('#netWorthBody .nw-foot-link[data-go="' + go_ + '"]');
      check(await foot.count() === 1 && (await foot.boundingBox()).height >= 44, go_ + ' card has no row saying what is behind it');
      await foot.scrollIntoViewIfNeeded(); await foot.tap();
      await page.waitForFunction(t => document.body.dataset.currentPage === "assets" && document.getElementById('pageTitle').textContent === t, title);
      await page.locator('#pageBack').tap();
      await page.waitForFunction(() => document.body.dataset.currentPage === "networth");
    }
    // Cash's offsets and Debts' property loans have their own rows where there are some (the sample household has both).
    check(await page.locator('#netWorthBody .nw-foot-link[data-go="assets/Offsets"]').count() === 1, 'Cash offers no way to Offsets');
    check(await page.locator('#netWorthBody .nw-foot-link[data-go="properties"]').count() === 2, 'Property and Debts do not both offer a way to the property page');
    await enter();
    const back = page.locator('#pageBack');
    check(await back.isVisible() && (await back.textContent()).includes("Accounts"), "Investments has no header link up to Accounts");
    await back.tap();
    await page.waitForFunction(() => document.body.dataset.currentPage === "networth");
    await enter();
    await page.locator('#pageBack').tap();
    await page.waitForFunction(() => document.body.dataset.currentPage === "networth");
  },
  async sharesquickperiod(page){
    await quiet(page);
    await go(page, 'assets', 'data-assets-sub', 'Shares');
    const shares = page.locator('#assetsSub-Shares');
    const before = await stored(page, 'JSON.stringify(state.assets)');
    const strip = shares.locator('#sharesChangeWindow');
    await strip.waitFor({state:'visible'});
    check(!await shares.locator('#assetListFilters-Shares').isVisible(), 'period still requires opening Filters');
    check(await strip.locator('button').count() === 8, 'price-change windows missing');
    const initial = await shares.locator('#sharesGlance').textContent();
    const keys = ['1d','1w','1m','3m','6m','1y','ytd','all'];
    for(const key of keys){
      await strip.locator('[data-shares-change-window="' + key + '"]').tap();
      await page.waitForFunction(async key => (await import('/src/components/assets.js')).sharesChangeWindow === key, key);
      await page.waitForFunction(() => document.activeElement === document.querySelector('#sharesChangeWindow [aria-pressed="true"]'));
    }
    await strip.locator('[data-shares-change-window="1w"]').tap();
    await settle(page);
    check(await shares.locator('#sharesGlance').textContent() !== initial, 'quick period did not refresh gain/loss');
    check((await shares.locator('.record-toolbar [data-asset-list-filters]').textContent()).trim() === 'Filters', 'period counted as a filter');
    check(!await shares.locator('.record-applied').count(), 'period adds an applied-filter row');
    await shares.locator('.record-toolbar [data-asset-list-filters]').click();
    await shares.locator('[data-shares-gain-filter="winners"]').click();
    await shares.locator('#assetListFilters-Shares [data-asset-list-filters]').click();
    check((await shares.locator('.record-toolbar [data-asset-list-filters]').textContent()).includes('(1)'), 'gain filter count includes period');
    await shares.locator('[data-asset-list-clear]').click();
    check(await strip.locator('[aria-pressed="true"]').getAttribute('data-shares-change-window') === '1w' && !await shares.locator('.record-applied').count(), 'Clear changed period or left filters active');
    for(const width of [320,390,768,1024,1280]){
      await page.setViewportSize({width,height:844}); await settle(page);
      check(!await strip.locator('select').count(), 'range strip became a picker at ' + width);
      const bad = await strip.evaluate((e,width) => e.getBoundingClientRect().right > width + 1 || [...e.querySelectorAll('button')].some(b => {
        const r = b.getBoundingClientRect(); return r.width < 44 || r.height < 44;
      }), width);
      check(!bad, 'quick period row overflows at ' + width);
      if(width === 320){
        const rect = await strip.boundingBox(), cdp = await page.context().newCDPSession(page);
        const x = rect.x + rect.width - 20, y = rect.y + rect.height / 2;
        await cdp.send('Input.dispatchTouchEvent', {type:'touchStart',touchPoints:[{x,y}]});
        for(const delta of [10,30,60,90,120]){
          await cdp.send('Input.dispatchTouchEvent', {type:'touchMove',touchPoints:[{x:x-delta,y}]});
          await page.waitForTimeout(25);
        }
        await cdp.send('Input.dispatchTouchEvent', {type:'touchEnd',touchPoints:[]});
        await cdp.detach();
        await page.waitForFunction(() => document.getElementById('sharesChangeWindow').scrollLeft > 0);
        check(!await shares.evaluate(e => e.hidden), 'swiping ranges changed Investments section');
        await strip.locator('[data-shares-change-window="all"]').tap();
        check(await strip.locator('[aria-pressed="true"]').evaluate(e => {
          const r = e.getBoundingClientRect(), s = e.parentElement.getBoundingClientRect();
          return r.left >= s.left - 1 && r.right <= s.right + 1;
        }), 'redraw hid the selected range beyond the scroll edge');
      }
      if(width === 390){
        check(await strip.evaluate(e => e.scrollWidth <= e.clientWidth + 1), 'all ranges do not fit a standard phone');
      }
      if(width === 390 || width === 1280){
        const top = await shares.locator('.m-asset-rows .m-row').first().evaluate(e => e.getBoundingClientRect().top);
        check(top < (width === 390 ? 422 : 400), 'quick period pushes first holding below half-screen: ' + top);
        if(width === 390){
          // System font metrics can put the phone header's help/actions on another line.
          const wrapped = await page.addStyleTag({content:'@media(max-width:880px){.app-topbar h1{flex-basis:100%;}}'});
          await settle(page);
          const wrappedTop = await shares.locator('.m-asset-rows .m-row').first().evaluate(e => e.getBoundingClientRect().top);
          check(wrappedTop < 422, 'wrapped header pushes first holding below half-screen: ' + wrappedTop);
          await wrapped.evaluate(e => e.remove());
        }
      }
    }
    await shares.locator('[data-shares-change-window="3m"]').click();
    check(await page.evaluate(async() => (await import('/src/components/assets.js')).sharesChangeWindow === '3m'), 'wide-screen period tabs did not work');
    await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
    check(await strip.locator('[aria-pressed="true"]').evaluate(e => {
      const s = getComputedStyle(e); return e === document.activeElement && s.outlineStyle === 'solid' && parseFloat(s.outlineWidth) >= 2;
    }), 'keyboard selection lacks visible focus');
    check(await stored(page, 'JSON.stringify(state.assets)') === before, 'period/filter controls changed holdings');
  },
  // Simpler navigation step 1: Home's tabs and each report have their own address, so Back steps through them; an inner
  // page's header link names where it goes; a deep link has Home beneath it. Phone and desktop.
  // A view that draws into one tab of a page (lib/views.js opts.tabs) waits, stale, while another tab shows, and is
  // drawn when its tab opens. Saving a transfer on Spending used to redraw the hidden Bills calendar and, for one
  // block on Budget, the whole Property page — which tipped the speed budget's transfer step over its 60%.
  // #411: one + button. It always opens the same sheet — this page's own action first, then Log, Import and Add — at
  // every width; the page's row runs that action; Import a file opens the import chooser in the sheet's place, so Back
  // closes it without bringing the sheet back; an empty state with no target of its own still runs the page's action.
  // #412: Home is Today, with no tab rail — Insights, How you compare and the Monthly review open from links on it, at
  // their own addresses, with the header's way back; the Today tab, chosen on one of them, comes back to Today. A phone's
  // bar is Today · Cash flow · Net worth · Plan · More, More holds Tax, Reports, Calculators, Settings and Backup and stays
  // lit on each; a desktop's sidebar lists the same five under More.
  // #413: Net worth is one list, filtered by kind with chips; Investments → Summary went — its funding, allocation and
  // history are folded under the list, its debts are on Accounts, and Investments opens on Cash (an old
  // /assets/summary too).
  // #414: Simple and Advanced. Switched from More (or Settings → Preferences) and remembered on this device: Simple puts
  // the tools used now and then away — Today's deeper links and tiles, Spending over time, Net worth's folded extras,
  // Plan's other tabs (Plan opens on Goals), Calculators, Import rules and all but five reports — and a page's "Show
  // more on this page" brings its own back until you leave it. Every figure is the same either way.
  async simplemode(page){
    await quiet(page);
    const mode = () => page.evaluate(() => document.documentElement.getAttribute('data-mode'));
    const shownAdvanced = () => page.evaluate(() => [...document.querySelectorAll('[data-level="advanced"]')].filter(e => e.getClientRects().length).length);
    check(await mode() === 'advanced', 'journeys start in Advanced');
    await go(page, 'dashboard', 'data-dashboard-sub', 'overview');
    const figure = () => page.evaluate(() => document.getElementById('globalNetWorth').textContent);
    const before = await figure();
    await page.locator('.mobile-tab[data-page="more"]').click(); await page.waitForFunction(() => location.pathname === '/more');
    await page.locator('#moreModeToggle').uncheck();
    check(await mode() === 'simple' && await page.evaluate(() => localStorage.getItem('wealthPlanner.mode')) === 'simple', 'Simple was not switched on and remembered');
    check(await page.locator('#moreList [data-page="calc"]').isHidden(), 'Calculators still shows in More');
    check(await figure() === before, 'Simple changed the net worth figure: ' + before + ' → ' + await figure());
    await go(page, 'dashboard', 'data-dashboard-sub', 'overview');
    check(await page.locator('.today-more [data-dashboard-sub="insights"]').isHidden() && await page.locator('.today-more [data-dashboard-sub="review"]').isVisible(), 'Today: Insights should go, the monthly review stay');
    check(await page.locator('[data-home-card="projected"]').isHidden(), 'Today still shows the projected net worth tile');
    await go(page, 'expenses', 'data-expenses-sub', 'spending');
    check(await page.locator('#spendingTrendsPanel').isHidden(), 'Spending over time still shows');
    await go(page, 'networth');
    check(await page.locator('#netWorthMore').isHidden() && await page.locator('#netWorthBody .nw-group').first().isVisible(), 'Net worth: the list should stay, the extras go');
    // Plan opens on Goals; Show more brings its tabs back, and leaving the page puts them away again.
    await page.locator('.mobile-tab[data-page="plan"]').click(); await page.waitForFunction(() => location.pathname === '/plan/goals');
    check(await page.locator('#planSubnav [data-plan-sub="projections"]').isHidden(), 'Plan still shows Projections');
    await page.locator('#showMoreHere [data-show-more]').click();
    await page.waitForFunction(() => document.querySelector('#planSubnav [data-plan-sub="projections"]').getClientRects().length > 0 || [...document.querySelectorAll('#planSubnav > select option')].some(o => o.textContent === 'Projections'));
    check(await page.locator('#showMoreHere').isHidden(), 'Show more stays after showing everything');
    await page.locator('.mobile-tab[data-page="dashboard"]').click(); await page.waitForFunction(() => location.pathname === '/dashboard');
    check(await shownAdvanced() === 0, 'what Show more brought back stayed after leaving the page');
    // A link to an advanced view still opens it.
    await page.evaluate(async () => (await import('/src/components/nav.js')).showDashboardSubpage('insights'));
    await page.waitForFunction(() => location.pathname === '/dashboard/insights' && !document.getElementById('dashboardSub-insights').hidden);
    // Reports: the everyday five, then all of them.
    await go(page, 'reports');
    await page.locator('#reportsBody [data-report-choose]').first().click();
    const chooser = page.locator('.report-chooser');
    await chooser.waitFor();
    const everyday = await chooser.locator('[data-report]').evaluateAll(es => es.map(e => e.getAttribute('data-report')));
    check(everyday.length <= 6 && everyday.includes('budget') && !everyday.includes('cgt'), 'Simple chooser lists ' + everyday.join());
    await chooser.locator('[data-report-show-all]').click();
    check(await chooser.locator('[data-report="cgt"]').count() === 1, 'Show all reports did not list them all');
    await page.keyboard.press('Escape'); await chooser.waitFor({ state: 'detached' });
    // Remembered across a reload; switched back, everything shows.
    // From /dashboard itself: this test server can't reload a nested address (production's 404 bounce can).
    await go(page, 'dashboard', 'data-dashboard-sub', 'overview'); await page.reload(); await quiet(page);
    check(await mode() === 'simple', 'Simple was not remembered');
    await go(page, 'settings', 'data-accounts-sub', 'preferences');
    await page.locator('#modeAdvancedToggle').check();
    check(await mode() === 'advanced', 'Advanced was not switched back on');
    await go(page, 'dashboard', 'data-dashboard-sub', 'overview');
    check(await page.locator('.today-more [data-dashboard-sub="insights"]').isVisible() && await page.locator('#showMoreHere').isHidden(), 'Advanced does not show everything');
  },
  async networthlist(page){
    await quiet(page);
    for(const width of [390, 1280]){
      await page.setViewportSize({ width, height: width > 900 ? 800 : 844 });
      await go(page, 'networth');
      const chips = await page.locator('#netWorthBody .nw-chip').allInnerTexts();
      check(chips[0] === 'All' && chips.length === 1 + await page.locator('#netWorthBody .nw-group').count(), 'chips do not match the groups: ' + chips.join());
      const all = await page.locator('#netWorthBody .nw-group').count();
      await page.locator('#netWorthBody .nw-chip', { hasText: 'Super' }).click();
      check(await page.locator('#netWorthBody .nw-group').count() === 1 && (await page.locator('#netWorthBody .nw-group h2').innerText()).startsWith('SUPER') || (await page.locator('#netWorthBody .nw-group h2').innerText()).startsWith('Super'), 'the Super chip does not show Super alone');
      check(await page.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-nw-filter') === 'super' || document.activeElement.textContent === 'Super'), 'the chip lost focus');
      check(await page.locator('#netWorthBody .nw-chip[aria-pressed="true"]').innerText() === 'Super', 'the chip does not say it is on');
      await page.locator('#netWorthBody .nw-chip', { hasText: 'All' }).click();
      check(await page.locator('#netWorthBody .nw-group').count() === all, 'All does not bring the list back');
      const folded = await page.locator('#netWorthMore > details').evaluateAll(ds => ds.map(d => d.open));
      check(folded.length === 3 && folded.every(o => !o), 'the moved blocks are not folded: ' + JSON.stringify(folded));
      check(await page.evaluate(() => ['assetsAllocation', 'portfolioHistoryPanel', 'allocationHistoryPanel'].every(id => document.getElementById(id).innerHTML.trim().length > 0)), 'a moved block was not drawn on Accounts');
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Net worth scrolls sideways at ' + width);
      await go(page, 'assets');
      check(await page.evaluate(() => !document.getElementById('assetsSub-Cash').hidden && !document.getElementById('assetsSub-summary') && location.pathname === '/assets/cash'), 'Investments does not open on Cash');
      await go(page, 'accounts');
      check(await page.locator('#page-accounts #debtsTable').count() === 1 && await page.locator('#page-accounts #addDebtBtn').isVisible(), 'Debts are not on Accounts');
    }
    await page.evaluate(() => sessionStorage.setItem('wealthPlanner.redirectPath', '/assets/summary'));
    await page.goto(base + '/index.html'); await quiet(page);
    check(await page.evaluate(() => document.body.dataset.currentPage === 'assets' && !document.getElementById('assetsSub-Cash').hidden), 'an old /assets/summary link does not open Investments on Cash');
  },
  // #425: a screen with nothing of the app's own behind it goes up to its parent, a desktop names where it lives, and
  // Back to a list puts you back where you were in it, with its filter.
  async returnwhereyouwere(page){
    await quiet(page);
    const holding = await stored(page, 'state.assets.find(a => a.category === "Shares").id');
    const name = await stored(page, 'state.assets.find(a => a.category === "Shares").what');
    const deep = async path => { await page.evaluate(p => sessionStorage.setItem('wealthPlanner.redirectPath', p), path); await page.goto(base + '/index.html'); await quiet(page);
      await page.waitForFunction(p => location.pathname === p, path); };
    const here = () => page.evaluate(() => ({ path: location.pathname, back: document.getElementById('pageBack').checkVisibility() ? document.querySelector('#pageBack .page-back-label').textContent : null,
      crumbs: document.getElementById('pageCrumbs').checkVisibility() ? document.getElementById('pageCrumbs').innerText.replace(/\s+/g, ' ').trim() : null,
      lit: [...document.querySelectorAll('.mobile-tab.active, .nav-item.active')].filter(e => e.checkVisibility()).map(e => e.getAttribute('data-page')).join() }));
    for(const width of [320, 390]){
      await page.setViewportSize({ width, height: 844 });
      await deep('/detail/asset/' + holding);
      let s = await here();
      // #428: a holding is in Accounts' one list.
      check(s.back === 'Accounts' && s.lit === 'networth' && !s.crumbs, width + ': a holding opened by link does not go up to Accounts: ' + JSON.stringify(s));
      await page.locator('#pageBack').click();
      await page.waitForFunction(() => location.pathname === '/networth');
      await page.goBack(); await page.waitForFunction(() => location.pathname === '/dashboard');
    }
    await page.setViewportSize({ width: 1280, height: 800 });
    await deep('/detail/asset/' + holding);
    const s = await here();
    const parts = await page.locator('#pageCrumbs li').allInnerTexts();
    check(parts.join(' › ') === 'Accounts › ' + name && !s.back && s.lit === 'networth', 'a desktop does not say where a holding lives: ' + JSON.stringify({ parts, s }));
    await page.locator('#pageCrumbs [data-crumb="0"]').click();
    await page.waitForFunction(() => location.pathname === '/networth');
    for(const width of [390, 1280]){
      // A desktop window short enough that one kind's list scrolls (each group lost its "Manage on" row to its heading).
      await page.setViewportSize({ width, height: width > 900 ? 600 : 844 });
      await go(page, 'networth');
      await page.locator('#netWorthBody [data-nw-filter]').nth(1).click();
      const filter = await page.locator('#netWorthBody .nw-chip.is-on').textContent();
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      const link = page.locator('#netWorthBody [data-detail]').last();
      await link.scrollIntoViewIfNeeded();
      const y = await page.evaluate(() => scrollY);
      check(y > 50, width + ': the list is too short to scroll (' + y + ')');
      await link.click(); await page.waitForFunction(() => document.body.dataset.currentPage === 'detail');
      await page.goBack(); await page.waitForFunction(() => document.body.dataset.currentPage === 'networth');
      await page.waitForFunction(want => Math.abs(scrollY - want) < 30, y, { timeout: 5000 }).catch(() => {});
      const back = await page.evaluate(() => ({ y: scrollY, filter: document.querySelector('#netWorthBody .nw-chip.is-on').textContent }));
      check(Math.abs(back.y - y) < 30 && back.filter === filter, width + ': Back did not return to the same place in the list: ' + JSON.stringify({ was: { y, filter }, now: back }));
    }
  },
  // #426: Simple offered once; "Update a balance" in +; Categories folded; the device's count of screens opened.
  async smallpolish(page){
    await quiet(page);
    const offer = page.locator('#modeOffer');
    // Offered once, to a household in Advanced that hasn't answered.
    await page.evaluate(() => localStorage.removeItem('wealthPlanner.modeOffer'));
    await page.goto(base + '/index.html'); await quiet(page);
    await go(page, 'dashboard', 'data-dashboard-sub', 'overview');
    check(await offer.isVisible(), 'a household in Advanced is not offered Simple');
    await offer.locator('[data-mode-offer="no"]').click();
    check(!await offer.isVisible() && await page.evaluate(() => document.documentElement.dataset.mode) === 'advanced', 'No thanks did not end the offer in Advanced');
    await page.goto(base + '/index.html'); await quiet(page);
    check(!await offer.isVisible(), 'the offer came back after No thanks');
    await page.evaluate(() => localStorage.removeItem('wealthPlanner.modeOffer'));
    await page.goto(base + '/index.html'); await quiet(page);
    await offer.locator('[data-mode-offer="simple"]').click();
    check(await page.evaluate(() => document.documentElement.dataset.mode === 'simple' && localStorage.getItem('wealthPlanner.mode') === 'simple'), 'Try Simple did not switch to Simple');
    check(!await offer.isVisible(), 'the offer stayed after Try Simple');
    await page.evaluate(async () => { (await import('/src/lib/mode.js')).setStoredMode('advanced'); (await import('/src/lib/mode.js')).applyMode('advanced'); });
    // Update a balance: which account, then its own form.
    for(const width of [320, 1280]){
      await page.setViewportSize({ width, height: width > 900 ? 800 : 844 });
      await go(page, 'dashboard', 'data-dashboard-sub', 'overview');
      await page.evaluate(() => [document.getElementById('headerAddBtn'), document.getElementById('quickFab')].find(b => b.getClientRects().length).click());
      await page.locator('.qfab-panel [data-quick-action]', { hasText: 'Update a balance' }).click();
      const chooser = page.getByRole('dialog', { name: 'Update which balance?' });
      await chooser.waitFor();
      const choice = chooser.locator('[data-bal-choice]').first();
      const id = await choice.getAttribute('data-bal-choice');
      await choice.click();
      await page.waitForFunction(id => { const i = document.activeElement; return document.body.dataset.currentPage === 'accounts' && i && i.matches('.acct-bal-input') && i.closest('[data-acct-index]'); }, id, { timeout: 5000 });
      check(await page.evaluate(id => { const i = document.activeElement, card = i.closest('.acct-card'); return !!card && !!card.querySelector('[data-acct-bal-save]') && JSON.stringify(window.__wp || null) !== 'x'; }, id), width + ': Update a balance did not open that account\'s balance form');
      await page.locator('[data-acct-bal-cancel]').first().click();
    }
    // Categories, folded: fewer controls than one per name, delete and look each.
    await go(page, 'settings', 'data-accounts-sub', 'categories');
    const counts = await page.evaluate(() => ({ rows: document.querySelectorAll('#categoriesTable .cat-fold').length,
      shown: [...document.querySelectorAll('#categoriesTable button, #categoriesTable input, #categoriesTable summary')].filter(e => e.checkVisibility()).length }));
    check(counts.rows > 3 && counts.shown === counts.rows, 'Categories is not folded to one control a row: ' + JSON.stringify(counts));
    // The count of screens opened: on this device, never in the household, forgotten on request.
    await go(page, 'expenses', 'data-expenses-sub', 'spending');
    await go(page, 'tax', 'data-tax-sub', 'returns');
    const use = await page.evaluate(() => JSON.parse(localStorage.getItem('wealthPlanner.pageUse') || '{}'));
    check(use.views && use.views['expenses/spending'] >= 1 && use.views['tax/returns'] >= 1, 'screens opened were not counted: ' + JSON.stringify(use));
    check(!(await stored(page, 'JSON.stringify(state)')).includes('pageUse'), 'the count of screens opened is in the household');
    await page.evaluate(() => { const v = { 'expenses/spending': 40, 'dashboard/insights': 20 }; localStorage.setItem('wealthPlanner.pageUse', JSON.stringify({ since: '2026-01-01', views: v })); });
    await go(page, 'settings', 'data-accounts-sub', 'preferences');
    const fold = page.locator('#pageUseBody').locator('xpath=ancestor::details[1]');
    await fold.evaluate(d => { d.open = true; });
    const listed = await page.locator('#pageUseBody li').allInnerTexts();
    check(listed.includes('Tax → Returns') && listed.includes('Plan → Retirement') && !listed.includes('Money → Transactions') && !listed.includes('Today → Insights'), 'rarely opened lists ' + JSON.stringify(listed));
    await page.locator('#pageUseClear').click();
    check(await page.evaluate(() => localStorage.getItem('wealthPlanner.pageUse') === null || !JSON.parse(localStorage.getItem('wealthPlanner.pageUse')).views['expenses/spending']), 'Forget did not clear the count');
  },
  async todaymore(page){
    await quiet(page);
    const shown = () => page.evaluate(() => ({ path: location.pathname, title: document.getElementById('pageTitle').textContent,
      back: (b => b.hidden ? null : b.querySelector('.page-back-label').textContent)(document.getElementById('pageBack')),
      lit: [...document.querySelectorAll('.mobile-tab.active, .nav-item.active')].filter(e => e.getClientRects().length).map(e => (e.querySelector('.mobile-tab-label') || e).firstChild.textContent.trim()) }));
    for(const width of [390, 1280]){
      await page.setViewportSize({ width, height: width > 900 ? 800 : 844 });
      await go(page, 'dashboard', 'data-dashboard-sub', 'overview');
      check(!await page.locator('#dashboardSubnav').count(), 'Today still has a tab rail');
      let s = await shown();
      check(s.title === 'Today' && s.path === '/dashboard' && !s.back && s.lit.join() === 'Today', width + ': Today is not itself: ' + JSON.stringify(s));
      for(const [sub, title] of [['insights', 'Insights'], ['benchmarks', 'How you compare'], ['review', 'Monthly review']]){
        await page.locator('.today-more [data-dashboard-sub="' + sub + '"]').click();
        await page.waitForFunction(p => location.pathname === p, '/dashboard/' + sub);
        s = await shown();
        check(s.title === title && s.back === 'Today' && s.lit.join() === 'Today', width + ': ' + sub + ' reads ' + JSON.stringify(s));
        // #425: a desktop names where it is in the breadcrumb ("Today › Insights") instead of a back link.
        if(width > 900){
          check(await page.locator('#pageCrumbs').innerText().then(t => t.replace(/\s+/g, ' ').trim()) === 'Today › ' + title || (await page.locator('#pageCrumbs').innerText()).includes(title), width + ': ' + sub + ' has no breadcrumb');
          check(!await page.locator('#pageBack').isVisible(), 'a desktop shows a back link beside the breadcrumb');
          await page.locator('#pageCrumbs [data-crumb="0"]').click();
        } else await page.locator('#pageBack').click();
        await page.waitForFunction(() => location.pathname === '/dashboard');
      }
      // The Today tab, chosen on Insights, is Today again.
      await page.locator('.today-more [data-dashboard-sub="insights"]').click(); await page.waitForFunction(() => location.pathname === '/dashboard/insights');
      await page.locator((width > 900 ? '.nav-item' : '.mobile-tab') + '[data-page="dashboard"]').click();
      await page.waitForFunction(() => location.pathname === '/dashboard' && !document.getElementById('dashboardSub-overview').hidden);
      if(width < 900){
        const tabs = await page.locator('.mobile-tab .mobile-tab-label').allInnerTexts();
        check(tabs.join() === 'Today,Money,Accounts,Plan,More', 'the tab bar reads ' + tabs.join());
        await page.locator('.mobile-tab[data-page="more"]').click(); await page.waitForFunction(() => location.pathname === '/more');
        const rows = await page.locator('#moreList .more-item-label').allInnerTexts();
        check(rows.map(r => r.split('\n')[0].replace(/Lodge by.*/, '').trim()).join() === 'Tax,Reports,Calculators,Settings,Backup & sync', 'More lists ' + JSON.stringify(rows));
        for(const [page_, path] of [['tax', '/tax/'], ['reports', '/reports/'], ['calc', '/calc'], ['settings', '/settings/']]){
          await go(page, 'more');
          await page.locator('#moreList [data-page="' + page_ + '"]').click();
          await page.waitForFunction(p => location.pathname.indexOf(p) === 0, path);
          s = await shown();
          check(s.lit.join() === 'More' && s.back === 'More', 'More → ' + page_ + ': ' + JSON.stringify(s));
        }
        await go(page, 'more'); await page.locator('#moreList [data-more-go="backup"]').click();
        await page.waitForFunction(() => location.pathname === '/settings/preferences');
      } else {
        const side = await page.locator('.app-nav > .nav-item, .nav-group, .nav-group-items .nav-item').allInnerTexts();
        check(side.map(t => t.trim()).join() === 'Today,Money,Accounts,Plan,MORE,Tax,Reports,Calculators,Settings,Backup & sync' ||
          side.map(t => t.trim()).join() === 'Today,Money,Accounts,Plan,More,Tax,Reports,Calculators,Settings,Backup & sync', 'the sidebar reads ' + side.join());
        await page.locator('.nav-item[data-page="tax"]').click(); await page.waitForFunction(() => location.pathname.indexOf('/tax/') === 0);
        check((await shown()).lit.join() === 'Tax', 'the sidebar does not light Tax');
      }
    }
  },
  async plussheet(page){
    await quiet(page);
    const plus = () => page.evaluate(() => [document.getElementById('headerAddBtn'), document.getElementById('quickFab')].find(b => b.getClientRects().length).click());
    const sheet = page.locator('.qfab-panel');
    for(const width of [320, 390, 1280]){
      await page.setViewportSize({ width, height: width > 900 ? 800 : 844 });
      for(const [pg, attr, sub, own] of [['dashboard', 'data-dashboard-sub', 'overview', null], ['expenses', 'data-expenses-sub', 'budget', null],
        ['assets', 'data-assets-sub', 'Shares', 'Add holding'], ['plan', 'data-plan-sub', 'projections', null]]){
        await go(page, pg, attr, sub);
        const name = await page.evaluate(() => [document.getElementById('headerAddBtn'), document.getElementById('quickFab')].find(b => b.getClientRects().length).getAttribute('aria-label'));
        check(name === 'Add, log or import', pg + '/' + sub + ': + is named ' + name);
        await plus(); await sheet.waitFor();
        await sheet.evaluate(e => Promise.all(e.getAnimations().map(a => a.finished)));   // a phone's sheet slides up
        const groups = await sheet.locator('.qfab-group').allInnerTexts();
        check(JSON.stringify(groups.map(g => g.toUpperCase())) === JSON.stringify((own ? ['ON THIS PAGE'] : []).concat(['LOG', 'IMPORT', 'ADD SOMETHING NEW'])), pg + '/' + sub + ': sheet groups ' + JSON.stringify(groups));
        if(own) check((await sheet.locator('[data-quick-page] .qfab-action-label').innerText()).startsWith(own), pg + '/' + sub + ': first row is not ' + own);
        check(await sheet.evaluate(e => { const r = e.getBoundingClientRect(); return e.scrollHeight <= e.clientHeight + 1 && r.top >= 0 && r.bottom <= innerHeight + 1 && r.left >= 0 && r.right <= innerWidth + 1; }), pg + '/' + sub + ' at ' + width + 'px: the sheet scrolls or leaves the screen ' + await sheet.evaluate(e => JSON.stringify({ sh: e.scrollHeight, ch: e.clientHeight, rows: [...e.querySelectorAll('.qfab-action')].map(b => Math.round(b.getBoundingClientRect().height) + ' ' + b.innerText.split('\n')[0]) })));
        await page.keyboard.press('Escape'); await sheet.waitFor({ state: 'detached' });
      }
    }
    // This page's own row runs it: Add holding opens the holding editor on Shares.
    await go(page, 'assets', 'data-assets-sub', 'Shares');
    const holdings = await st(page, 'state.assets.length');
    await plus(); await sheet.locator('[data-quick-page]').click(); await sheet.waitFor({ state: 'detached' });
    await waited(page, () => !!document.querySelector('.row-modal, [data-row-editor], .m-row.open, .review-panel'), 'Add holding opened an editor');
    await page.keyboard.press('Escape'); await settle(page);
    check(await st(page, 'state.assets.length') >= holdings, 'opening Add holding lost a holding');
    // Import a file: the chooser in the sheet's place; Back closes it and leaves no sheet behind.
    await go(page, 'dashboard', 'data-dashboard-sub', 'overview');
    const url = await page.evaluate(() => location.pathname);
    await plus(); await sheet.locator('[data-quick-import]').click();
    const chooser = page.locator('.import-chooser');
    await chooser.waitFor();
    check((await chooser.locator('[data-import-choice="bank"] .import-choice-label').innerText()) === 'Any statement file', 'the chooser does not lead with the statement reader');
    await page.goBack(); await chooser.waitFor({ state: 'detached' });
    check(!await sheet.count(), 'Back from the chooser reopened the + sheet');
    check(await page.evaluate(() => location.pathname) === url, 'Back from the chooser left Home');
    // Log spend from the sheet, as from Home's + before.
    await plus(); await sheet.locator('[data-quick-action]', { hasText: 'Log spend' }).first().click();
    await waited(page, () => !!document.querySelector('#quickLogRoot input, #quickLogSheet input'), 'Log spend opened the quick log');
    await page.keyboard.press('Escape');
  },
  async tabviews(page){
    await quiet(page);
    await go(page, 'expenses', 'data-expenses-sub', 'spending');
    const staleNow = () => page.evaluate(async () => (await import('/src/lib/views.js')).staleViews());
    await page.evaluate(() => document.querySelector('#transactionsTable [data-cf-transfer]').click());
    await page.locator('#transactionsTable [data-tf="from"]').waitFor();
    await page.evaluate(() => { const f = document.querySelector('#transactionsTable [data-tf="from"]'), t = document.querySelector('#transactionsTable [data-tf="to"]'), o = [...f.options].map(x => x.value).filter(Boolean); f.value = o[0]; t.value = o[1]; document.querySelector('#transactionsTable [data-tf="amount"]').value = "75"; });
    const before = await page.evaluate(() => document.getElementById('billsCalendar').innerHTML);
    await page.evaluate(() => document.querySelector('#transactionsTable [data-tf-save]').click());
    await settle(page);
    const stale = await staleNow();
    check(stale.includes('billsCalendar'), 'the Bills calendar was drawn while Spending showed: ' + JSON.stringify(stale));
    check(await page.evaluate(() => document.getElementById('billsCalendar').innerHTML) === before, 'the hidden Bills calendar changed while Spending showed');
    await go(page, 'expenses', 'data-expenses-sub', 'bills');
    check(!(await staleNow()).includes('billsCalendar'), 'opening Bills did not draw its calendar');
    check(await page.locator('#billsCalendar').evaluate(e => e.children.length > 0), 'Bills calendar is empty after opening Bills');
    // A balance edit touches the properties view, whose Cash flow block is on Budget.
    await page.evaluate(async () => { const { commit } = await import('/src/state.js'); commit(['balances']); });
    await settle(page);
    check((await staleNow()).includes('properties'), 'the property block on Budget was drawn while Bills showed');
    await go(page, 'expenses', 'data-expenses-sub', 'budget');
    check(!(await staleNow()).includes('properties'), 'opening Budget did not draw its property block');
  },
  async backeverywhere(page){
    await quiet(page);
    const at = async (p) => {
      try{ await page.waitForFunction(p => location.pathname === p, p, { timeout: 10000 }); }
      catch(e){ throw new Error('expected ' + p + ', at ' + await page.evaluate(() => location.pathname), { cause: e }); }
      await settle(page);
    };
    const backLabel = () => page.evaluate(() => { const b = document.getElementById('pageBack'); return b && !b.hidden && b.getClientRects().length ? b.querySelector('.page-back-label').textContent : null; });
    // 320px too: there Home's tabs never fit, and a section picker stands in for them (CI's wider fallback font does
    // the same at 390px), so tabs are chosen the way go() does rather than by clicking a button that may be hidden.
    for(const width of [320, 390, 1280]){
      await page.setViewportSize({ width, height: width > 900 ? 800 : 844 });
      await go(page, 'dashboard', 'data-dashboard-sub', 'overview');
      await go(page, 'dashboard', 'data-dashboard-sub', 'insights'); await at('/dashboard/insights');
      // Budget, then Spending: two entries whatever the timing (go() chooses a tab 50ms after the page, and a tab chosen
      // while the page's transition runs writes the page's own entry — one entry or two, by how fast the machine is).
      await go(page, 'expenses', 'data-expenses-sub', 'budget'); await at('/expenses/budget');
      await go(page, 'expenses', 'data-expenses-sub', 'spending'); await at('/expenses/spending');
      check(await backLabel() === null, 'a page in the menu has a header back link');
      // Reports opens on the report last shown (the first pass leaves it on Budget vs actual): choose the other one.
      await page.evaluate(() => document.querySelector('.nav-item[data-page="reports"]').click());   // a phone's More holds it too
      await page.waitForFunction(() => location.pathname.indexOf('/reports/') === 0);
      const first = (await page.evaluate(() => location.pathname)).split('/')[2];
      const [second, firstLabel] = first === 'budget' ? ['cashflow', 'Budget vs actual'] : ['budget', 'Monthly cash flow'];
      check(await backLabel() === 'Transactions', 'Reports does not offer the way back to Transactions: ' + await backLabel());
      await page.locator('#reportsBody [data-report-choose]').first().click();
      await page.locator('.report-chooser [data-report="' + second + '"]').click(); await at('/reports/' + second);
      check(await backLabel() === firstLabel, 'the second report does not name the first: ' + await backLabel());
      await go(page, 'networth'); await at('/networth');
      await page.locator('#page-networth [data-detail]:visible').first().click();
      await page.waitForFunction(() => location.pathname.indexOf('/detail/') === 0); await settle(page);
      check(await page.locator('#detailBody .dt-back').count() === 0, 'Details shows two back links');
      if(width > 900){
        // #425: a desktop's breadcrumb already names Accounts (#428), so it shows no back link to it beside it.
        check((await page.locator('#pageCrumbs [data-crumb]').allInnerTexts())[0] === 'Accounts' && await backLabel() === null, 'Details on a desktop does not say it is under Accounts: ' + await backLabel());
        await page.goBack(); await at('/networth');
      } else {
        check(await backLabel() === 'Accounts', 'Details does not name Accounts: ' + await backLabel());
        const target = await page.locator('#pageBack').boundingBox();
        check(target.height >= 36 && target.width >= 44, 'the back link is too small to tap: ' + JSON.stringify(target));
        await page.locator('#pageBack').click(); await at('/networth');
      }
      for(const p of ['/reports/' + second, '/reports/' + first, '/expenses/spending', '/expenses/budget', '/dashboard/insights', '/dashboard']){
        await page.goBack(); await at(p);
      }
      check(await page.evaluate(() => !document.getElementById('dashboardSub-overview').hidden), 'Back to /dashboard did not show Overview');
      // A link into another page's tab (data-go, as notices and empty states use): Back returns to the page it was on.
      // The tab chosen during the page's transition used to replace the entry of the page being left.
      await go(page, 'tax', 'data-tax-sub', 'year'); await at('/tax/year');
      await page.evaluate(() => { const a = document.createElement('button'); a.setAttribute('data-go', 'expenses/spending'); document.body.appendChild(a); a.click(); a.remove(); });
      await at('/expenses/spending');
      await page.goBack(); await at('/tax/year');
      // A shared link, bounced through 404.html as GitHub Pages does: Home is beneath it.
      await page.evaluate(() => sessionStorage.setItem('wealthPlanner.redirectPath', '/reports/budget'));
      await page.goto(base + '/index.html'); await quiet(page); await at('/reports/budget');
      check(await page.evaluate(() => document.querySelector('[data-current-report="budget"]') !== null), 'a report link did not open that report');
      // #425: with nothing of the app's own behind it, its way back is its parent (More), and Today is beneath that.
      check(await backLabel() === 'More', 'a shared report link does not offer its parent, More: ' + await backLabel());
      await page.goBack(); await at('/dashboard');
      check(await page.evaluate(() => document.body.dataset.currentPage === 'dashboard'), 'Back from a shared link did not show Home');
    }
  },
  async sectionpickers(page){
    await quiet(page);
    for(const width of [320, 390]){
      await page.setViewportSize({ width, height: 844 });
      await go(page, "assets", "data-assets-sub", "Shares");
      // Accounts' chips are the one switcher: Investments has no pills or picker of its own, at any width, and goes up
      // to Accounts from the header.
      await page.locator('#sharesChangeWindow').waitFor({ state: "visible" });
      check(!await page.locator('#page-assets .subnav, #page-assets select.section-picker').count(), "Investments has a section switcher of its own");
      check(await page.locator('#pageTitle').innerText() === 'Investments', "deep-linked Shares is not titled Investments");
      check(!await page.locator('.nw-rail').count(), "a Net worth rail is back");
      check(await page.locator('#pageBack').isVisible() && (await page.locator('#pageBack').textContent()).includes("Accounts"), "Investments has no Accounts back link");
      const range = page.locator('#sharesChangeWindow [data-shares-change-window="1w"]');
      await range.click();
      check(!await page.locator('#sharesChangeWindow select').count(), "Shares range strip became a section picker");
      // Back from one kind's page to another's (both opened from Accounts) restores the first, title and all.
      await page.evaluate(async () => (await import('/src/components/nav.js')).showAssetsSubpage('Super'));
      await page.waitForFunction(() => !document.getElementById('assetsSub-Super').hidden && document.getElementById('pageTitle').textContent === 'Super');
      await page.goBack();
      await page.waitForFunction(() => !document.getElementById('assetsSub-Shares').hidden);
      await settle(page);
      check(await page.locator('#pageTitle').innerText() === 'Investments', "Back did not restore Investments' title");
      await page.setViewportSize({ width: 1280, height: 800 });
      // #428: no rail on a desktop either — the header's way up: Accounts › Investments.
      check((await page.locator('#pageCrumbs').innerText()).replace(/\s+/g, ' ').trim() === 'Accounts Investments' && (await page.locator('#pageCrumbs [data-crumb]').allInnerTexts())[0] === 'Accounts', "desktop did not show the way up (Accounts › Investments): " + await page.locator('#pageCrumbs').innerText());
      await page.setViewportSize({ width, height: 844 });
      await go(page, "properties");
      const prop = page.locator('#propertiesBody .prop-tabs').first();
      const pp = prop.locator('select');
      await pp.waitFor({ state: 'visible' });
      await pp.selectOption({ index: 1 });
      await settle(page);
      check(await prop.evaluate(el => {
        const selected = el.querySelector('[aria-selected="true"]');
        return el.getAttribute('role') === 'group' && selected && !document.getElementById(selected.getAttribute('aria-controls')).hidden &&
          el.querySelector('select').selectedOptions[0].textContent === selected.textContent.trim();
      }), "property picker and panel disagree");
      const overflow = await page.evaluate(() => [...document.querySelectorAll('.app-page:not([hidden]) .subnav, .app-page:not([hidden]) .time-range-control')]
        .filter(el => el.getClientRects().length && el.scrollWidth > el.clientWidth + 1).map(el => el.getAttribute('aria-label')));
      check(!overflow.length, "sideways navigation remains: " + overflow.join(', '));
    }
  },
  // #262: tabs and choosers by keyboard — a property card's tabs are ARIA tabs that work as tabs; Reports' picker is a
  // chooser that keeps focus when it redraws; page subtabs say which one is showing.
  async tabkeys(page){
    await quiet(page);
    // Tabs remain tabs when they fit; the narrow-screen picker has its own journey below.
    await page.setViewportSize({ width: 1280, height: 800 });
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
    await page.locator('[data-report-choose]').first().click();
    await page.locator('.report-chooser [data-report="categories"]').waitFor({ state: "visible" });
    check(await page.locator('#reportsBody [role="tablist"], #reportsBody [role="tab"]').count() === 0, "Reports' picker still claims to be tabs");
    await page.focus('[data-report="categories"]'); await page.keyboard.press("Enter"); await settle(page);
    await page.waitForFunction(() => !!document.querySelector('[data-current-report="categories"]') && !document.querySelector('.report-chooser'));
    check(await page.evaluate(() => document.activeElement.matches('[data-report-choose]')), "choosing a report lost focus");
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
    await quiet(page);
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
    await quiet(page);
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
    await quiet(page);
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
    await quiet(page);
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
    await quiet(page);
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
  async investmentfields(page){
    await go(page,'assets','data-assets-sub','Shares');
    await page.evaluate(()=>[...document.querySelectorAll('.m-asset-rows [data-row-toggle]')].find(e=>e.getClientRects().length).click());
    const row=page.locator('.m-row.open');
    const idx=Number(await row.getAttribute('data-index'));
    await row.locator('details').evaluateAll(ds=>ds.forEach(d=>d.open=true));
    await row.locator('[data-stmt-add]').click();
    await row.locator('details').evaluateAll(ds=>ds.forEach(d=>d.open=true));
    const statement=row.locator('.stmt-card').first();
    const fields=statement.locator('input,select');
    check(await fields.count()===14,'statement fields missing');
    const labels=await fields.evaluateAll(es=>es.every(e=>e.labels?.length && e.labels[0].htmlFor===e.id && e.classList.contains('field-control') && document.getElementById(e.id+'-error') && (e.getAttribute('aria-describedby')||'').split(' ').every(id=>document.getElementById(id))));
    check(labels,'statement labels/help/errors are not linked');
    const amount=statement.locator('[data-stmt-key="m20"]');
    const label=await amount.getAttribute('id');
    await statement.locator('label[for="'+label+'"]').click();
    check(await amount.evaluate(e=>e===document.activeElement),'statement label does not activate its field');
    await amount.fill('100');
    check(await stored(page,'state.assets['+idx+'].taxStatements[0].m20')===100,'statement amount did not save');
    await amount.fill('');
    check(await stored(page,'state.assets['+idx+'].taxStatements[0].m20')===100,'blank statement amount saved as zero');
    check(await amount.getAttribute('aria-invalid')==='true','blank statement amount has no inline error');
    check(await amount.evaluate(e=>document.querySelectorAll('[id="'+e.id+'-error"]').length===1),'validation duplicated a reserved error');
    await amount.fill('-100');
    check(await stored(page,'state.assets['+idx+'].taxStatements[0].m20')===-100,'signed statement amount policy changed');
    check(await amount.getAttribute('aria-invalid')===null,'valid amount did not clear error');
    const fy=statement.locator('.stmt-fy');
    const years=await fy.locator('option').evaluateAll(os=>os.map(o=>o.value));
    await fy.selectOption(years[0]);
    check(await stored(page,'state.assets['+idx+'].taxStatements[0].fy')===Number(years[0]),'statement year did not save');
    await row.locator('[data-payout-add]').click();
    await row.locator('details').evaluateAll(ds=>ds.forEach(d=>d.open=true));
    const cash=row.locator('.po-cash').last();
    const payout=Number(await cash.getAttribute('data-payout-index'));
    await cash.fill('100');
    check(await stored(page,'state.assets['+idx+'].payouts['+payout+'].cash')===100,'distribution cash did not save');
    await cash.fill('');
    check(await stored(page,'state.assets['+idx+'].payouts['+payout+'].cash')===100,'blank distribution cash saved');
    check(await cash.getAttribute('aria-invalid')==='true','blank distribution has no shared error');
    await cash.fill('0');
    check(await stored(page,'state.assets['+idx+'].payouts['+payout+'].cash')===0,'zero distribution no longer saves');
    await row.locator('[data-lot-add]').click();
    await row.locator('details').evaluateAll(ds=>ds.forEach(d=>d.open=true));
    const lot=row.locator('.lot-row[data-lot-index]').last();
    const lotIndex=Number(await lot.getAttribute('data-lot-index'));
    await lot.locator('.lot-brokerage').fill('100');
    check(await stored(page,'state.assets['+idx+'].lots['+lotIndex+'].brokerage')===100,'lot brokerage did not save');
    await lot.locator('[data-lot-del]').click();
    check(await row.locator('.lot-row[data-lot-index="'+lotIndex+'"]').count()===0,'new lot could not be deleted');
    await row.locator('.stmt-field').first().focus();
    const focusId=await row.locator('.stmt-field').first().getAttribute('id');
    await page.evaluate(async()=>(await import('/src/components/assets.js')).renderSharesSubpage());
    check(await page.evaluate(id=>document.activeElement?.id===id,focusId),'holding redraw lost statement focus');
    for(const width of [320,390,768,1024,1280]){
      await page.setViewportSize({width,height:844});
      const audit=await row.evaluate(el=>({doc:document.documentElement.scrollWidth,viewport:innerWidth,scroll:el.scrollWidth,width:el.clientWidth,bad:[...el.querySelectorAll('.lot-row input,.stmt-field,.stmt-fy')].filter(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return !e.classList.contains('field-control')||s.borderRadius!=='6px'||s.paddingLeft!==(e.classList.contains('field-compact')?'4px':'8px')||r.height<(innerWidth<=880?44:36);}).map(e=>e.className)}));
      check(audit.doc<=audit.viewport+1&&audit.scroll<=audit.width+1,'investment editor overflows at '+width);
      check(!audit.bad.length,'shared investment skin failed at '+width+': '+audit.bad.join(','));
    }
  },
  async investvalidation(page){
    await quiet(page);
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
  async debtoffsetfields(page){
    await page.evaluate(async()=>{const s=await import('/src/state.js');s.state.debts=[{what:'Sample card',balance:1000},{what:'Sample personal loan',balance:5000}];s.commit(['debts']);});
    await go(page,'accounts');   // #413: debts are on Accounts
    await page.locator('#debtsTable').evaluate(e=>e.closest('details').open=true);
    const balance=page.locator('.debt-balance').first();
    await balance.fill('');
    check(await stored(page,'state.debts[0].balance')===1000,'blank debt balance saved');
    check(await balance.getAttribute('aria-invalid')==='true','debt balance lacks shared error');
    check(await balance.evaluate(e=>document.querySelectorAll('[id="'+e.id+'-error"]').length===1),'debt error is duplicated');
    await balance.fill('-100');check(await stored(page,'state.debts[0].balance')===-100,'negative debt policy changed');
    await balance.fill('0');check(await stored(page,'state.debts[0].balance')===0,'zero debt no longer saves');
    await page.locator('.debt-what').first().fill('Renamed sample card');
    check(await page.getByRole('spinbutton',{name:'Balance of Renamed sample card',exact:true}).count()===1,'balance name did not follow rename');
    await balance.focus();await page.evaluate(async()=>(await import('/src/components/assets.js')).renderDebts());
    check(await balance.evaluate(e=>e===document.activeElement),'debt redraw lost focus');
    await page.locator('[data-debt-log]').first().click();
    check(await stored(page,'state.debts[0].history.length')>0,'debt snapshot did not save');
    await go(page,'assets','data-assets-sub','Offsets');
    const offset=page.locator('.offset-balance-input').first();
    const property=await offset.getAttribute('data-offset-property'),loan=Number(await offset.getAttribute('data-offset-loan'));
    const saved=()=>page.evaluate(async({property,loan})=>(await import('/src/state.js')).state.properties.find(p=>p.id===property).loans[loan].offsetBalance,{property,loan});
    const before=await saved();await offset.fill('');check(await saved()===before,'blank offset saved');
    check(await offset.getAttribute('aria-invalid')==='true','offset lacks shared error');
    check(await offset.evaluate(e=>document.querySelectorAll('[id="'+e.id+'-error"]').length===1),'offset error duplicated');
    await offset.fill('-100');check(await saved()===before,'negative offset saved');
    await offset.fill('1000');check(await saved()===1000,'valid offset did not save');
    await offset.focus();await page.evaluate(async()=>(await import('/src/components/assets.js')).renderOffsetsSubpage());
    check(await offset.evaluate(e=>e===document.activeElement),'offset redraw lost focus');
    await page.locator('[data-jump-property="'+property+'"]').first().click();
    await page.waitForFunction(()=>document.body.dataset.currentPage==='properties');
    await page.locator('[data-prop-edit="'+property+'"]').click();
    const loanTab=page.locator('[data-prop-tab="'+property+'"][data-tab="loans"]');
    const sectionPicker=loanTab.locator('..').locator('select.section-picker');
    if(await sectionPicker.isVisible())await sectionPicker.selectOption({label:'Loans'});else await loanTab.click();
    await page.evaluate(()=>{document.querySelectorAll('[data-prop-section-toggle="loans"][aria-expanded="false"]').forEach(e=>e.click());});
    await page.locator('.prop-tab-panel:not([hidden]) [data-loan-index="'+loan+'"]').first().locator('[data-row-toggle]').click();
    const row=page.locator('.m-row.open[data-loan-index]');
    await row.locator('details').evaluateAll(ds=>ds.forEach(d=>d.open=true));
    check(await row.locator('.loan-offset').inputValue()==='1000','Offsets value did not mirror into loan');
    check(await row.locator('input,select').evaluateAll(es=>es.every(e=>e.classList.contains('field-control'))),'loan still has an independent control skin');
    const properLabels=await row.locator('.m-edit-field > input,.m-edit-field > select').evaluateAll(es=>es.every(e=>e.labels?.length && (e.getAttribute('aria-describedby')||'').split(' ').filter(Boolean).every(id=>document.getElementById(id))));
    check(properLabels,'loan label/help links lost');
    await row.locator('.loan-offset').fill('2000');check(await saved()===2000,'loan offset did not save');
    check(await page.locator('.offset-balance-input[data-offset-property="'+property+'"][data-offset-loan="'+loan+'"]').inputValue()==='2000','loan edit did not mirror into Offsets');
    const oldBalance=await row.locator('.loan-balance').inputValue();await row.locator('.loan-balance').fill('');
    check(await row.locator('.loan-balance').getAttribute('aria-invalid')==='true','loan blank balance has no error');
    await row.locator('.loan-balance').fill(oldBalance);
    await row.locator('.loan-repay-mode').focus();await row.locator('.loan-repay-mode').selectOption('manual');
    check(await row.locator('.loan-repay-mode').evaluate(e=>e===document.activeElement),'repayment mode redraw lost focus');
    await row.locator('.loan-manual-amount').fill('1000');
    check(await page.evaluate(async({property,loan})=>(await import('/src/state.js')).state.properties.find(p=>p.id===property).loans[loan].manualRepaymentAmount,{property,loan})===1000,'manual repayment did not save');
    await row.locator('.loan-rate-new').fill('5');await row.locator('.loan-rate-date').fill('2026-11-03');
    await row.locator('[data-rate-record]').click();
    check(await page.evaluate(async({property,loan})=>(await import('/src/state.js')).state.properties.find(p=>p.id===property).loans[loan].rateHistory.some(h=>h.date==='2026-11-03'&&h.rate===5),{property,loan}),'new rate was not recorded');
    for(const width of [320,390,768,1024,1280]){
      await page.setViewportSize({width,height:844});
      const bad=await row.locator('input,select').evaluateAll(es=>es.filter(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.borderRadius!=='6px'||s.padding!=='6px 8px'||r.height+0.01<(innerWidth<=880?44:36);}).map(e=>e.className));
      check(!bad.length,'loan shared skin failed at '+width+': '+bad.join(','));
      check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'loan editor creates page overflow at '+width);
    }
    await row.locator('.loan-offset').focus();await page.evaluate(async()=>(await import('/src/components/properties.js')).renderProperties());
    check(await row.locator('.loan-offset').evaluate(e=>e===document.activeElement),'property loan redraw lost focus');
  },
  async debts(page){
    await quiet(page);
    await page.evaluate(async () => { const m = await import("/src/state.js"); m.state.debts = [{ what: "Card one", balance: 1200 }, { what: "Personal loan", balance: 8000 }]; m.commit(["debts"]); });
    await go(page, "accounts");   // #413: debts are on Accounts
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
  // #300: signed planning adjustments retain their meaning through save, totals and reload.
  async signedamounts(page){
    await quiet(page);
    await page.evaluate(async()=>{
      const s=await import('/src/state.js'), next=s.defaultState();
      next.firstRunDone=true;next.setupDismissed=true;
      next.income=[
        {id:'example-salary',what:'Employer A',person:'Alex',incomeType:'Gross',amount:120000,freq:'Yearly',superMode:'On top'},
        {id:'example-gross-offset',what:'Gross adjustment',person:'Alex',incomeType:'Gross',amount:0,freq:'Yearly',superMode:'On top'},
        {id:'example-net',what:'Net income',incomeType:'Net',amount:500,freq:'Monthly'},
        {id:'example-net-offset',what:'Net adjustment',incomeType:'Net',amount:0,freq:'Monthly'}
      ];
      next.shared=[
        {id:'example-cost',what:'Planned spending',amount:1000,freq:'Monthly',classification:'Needs'},
        {id:'example-cost-offset',what:'Budget adjustment',amount:0,freq:'Monthly',classification:'Needs'}
      ];
      Object.assign(next.projection,{investReturnRate:0,inflationRate:0,incomeGrowthRate:0,realTerms:false});
      next.tax.sgRate=12;s.setState(next);
      (await import('/src/calc/engine.js')).recalcComputedItems();
      s.commit(['*']);
      (await import('/src/components/income.js')).setIncomeShowAs('month');
    });
    const snapshot=()=>page.evaluate(async()=>{
      const s=(await import('/src/state.js')).state,e=await import('/src/calc/engine.js'),t=await import('/src/calc/tax.js');
      const name=s.baselineScenario;
      return {totals:e.scenarioTotals(name),forecast:e.computeNetWorthSeries(name,1)[1].y,
        gross:t.personIncomeBreakdown('Alex'),actual:JSON.stringify([s.transactions,s.incomeLog])};
    });
    const initial=await snapshot(), close=(a,b)=>Math.abs(a-b)<0.01;
    const row=async(section,id)=>{
      const index=await page.evaluate(async([section,id])=>(await import('/src/state.js')).state[section].findIndex(x=>x.id===id),[section,id]);
      return page.locator('.m-row[data-section="'+section+'"][data-index="'+index+'"]');
    };
    const open=async(section,id)=>{
      const existing=await row(section,id);
      if(await existing.locator('.f-amount').isVisible()) return existing;
      const closeEditor=page.getByRole('button',{name:/Close editor$/});
      if(await closeEditor.isVisible()){
        await closeEditor.click();
        await closeEditor.waitFor({state:'hidden'});
      }
      await page.evaluate(async section=>{
        const nav=await import('/src/components/nav.js');
        await nav.showPage('expenses');
        await nav.showExpensesSubpage(section==='income'?'income':'budget');
      },section);
      await settle(page);
      const r=await row(section,id);
      if(section==='shared'){
        const group=r.locator('xpath=ancestor::*[contains(@class,"m-card")][1]').locator('[data-budget-group-toggle]');
        if(await group.getAttribute('aria-expanded')==='false') await group.click();
      }
      if(!await r.locator('.f-amount').isVisible()){
        await r.locator('[data-row-toggle]').first().focus();await page.keyboard.press('Enter');
      }
      await r.locator('.f-amount').waitFor({state:'visible'});
      return r;
    };
    let r=await open('shared','example-cost-offset');
    await r.getByLabel('Amount',{exact:true}).fill('-100');
    let after=await snapshot();
    check(close(after.totals.expensesMonthly,initial.totals.expensesMonthly-100),'negative Budget did not reduce planned spending');
    check(close(after.forecast,initial.forecast+1200),'negative Budget did not increase annual projected savings');
    r=await open('income','example-net-offset');
    await r.getByLabel('Amount',{exact:true}).fill('-200');
    after=await snapshot();
    check(close(after.totals.incomeMonthly,initial.totals.incomeMonthly-200),'negative Net did not reduce take-home income');
    check(close(after.totals.netMonthly,initial.totals.netMonthly-100) && close(after.forecast,initial.forecast-1200),'signed adjustments did not flow into surplus/projections');
    r=await open('income','example-gross-offset');
    await r.getByLabel('Amount',{exact:true}).fill('-12000');
    after=await snapshot();
    check(close(after.gross.baseGross,108000) && close(after.gross.sg,12960),'negative Gross did not adjust combined pay and employer super');
    check(after.totals.incomeMonthly<initial.totals.incomeMonthly-200,'negative Gross did not reduce computed take-home income');
    const finalForecast=after.forecast, finalTotals=after.totals;
    check(after.actual===initial.actual,'planning adjustments created actual records');
    await r.getByLabel('Amount',{exact:true}).fill('');
    check(await stored(page,"state.income.find(x=>x.id==='example-gross-offset').amount")===-12000 && await r.locator('.f-amount').getAttribute('aria-invalid')==='true','blank draft overwrote negative Gross');
    await r.getByLabel('Amount',{exact:true}).fill('-12000');
    for(const [section,id,meaning] of [['shared','example-cost-offset','reduces planned spending'],['income','example-net-offset','reduces planned take-home'],['income','example-gross-offset','combined gross pay']]){
      r=await open(section,id);
      const amount=r.getByLabel('Amount',{exact:true}), savedAmount=await amount.inputValue();
      await amount.fill('');
      check(await stored(page,"state["+JSON.stringify(section)+"].find(x=>x.id==="+JSON.stringify(id)+").amount")===Number(savedAmount) && await amount.getAttribute('aria-invalid')==='true','blank draft overwrote signed amount');
      await amount.fill(savedAmount);
      check(await amount.evaluate((el,meaning)=>(el.getAttribute('aria-describedby')||'').split(/\s+/).some(id=>document.getElementById(id)?.textContent.includes(meaning)),meaning),'signed amount help is not associated with its input');
      check(/-.*\$/.test(await r.locator('.m-row-amt').first().textContent()),'row summary lost its minus sign');
      for(const width of [320,390,768,1280]) for(const theme of ['light','dark']){
        await page.setViewportSize({width,height:844});
        await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
        const label=r.locator('label[for="'+await amount.getAttribute('id')+'"]');
        // A real tap elsewhere starts an independent gesture; repeated taps on this label can select its text.
        await r.locator('.f-what').tap();
        check(!await amount.evaluate(el=>document.activeElement===el),'Amount was focused before the label gesture');
        const gesture=await label.evaluate(el=>{
          if(window.__stopSignedGesture) window.__stopSignedGesture();
          const events=[],control=el.control, row=el.closest('.m-row'), snapshot=()=>({focus:document.activeElement?.id||document.activeElement?.className,connected:el.isConnected,control:el.control?.id,originalControl:el.control===control,controlConnected:control?.isConnected,inert:!!control?.closest('[inert]'),disabled:control?.disabled,selection:window.getSelection()?.toString(),ids:control?[...document.querySelectorAll('[id]')].filter(x=>x.id===control.id).length:0});
          window.__signedGesture=events;
          const listeners=[],listen=(type,handler,capture)=>{document.addEventListener(type,handler,capture);listeners.push([type,handler,capture]);};
          for(const type of ['pointerdown','pointerup','touchstart','touchend','click','focusin','focusout']) listen(type,e=>{events.push({type,detail:e.detail,target:e.target.id||e.target.className,...snapshot()});if(events.length>100) events.shift();},true);
          listen('click',e=>events.push({type:'click-default',prevented:e.defaultPrevented,target:e.target.id||e.target.className,...snapshot()}),false);
          const observer=new MutationObserver(records=>{if(records.some(r=>[...r.removedNodes].some(n=>n===control||n.contains?.(control)||n===row))||!el.isConnected) events.push({type:'removed',...snapshot()});});
          observer.observe(document.body,{childList:true,subtree:true});
          window.__stopSignedGesture=()=>{observer.disconnect();listeners.forEach(([type,handler,capture])=>document.removeEventListener(type,handler,capture));};
          const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
          return {label:el.htmlFor,rect:{x:r.x,y:r.y,width:r.width,height:r.height},hit:hit?.id||hit?.className,...snapshot()};
        });
        await label.tap();
        try{
          await waited(page,id=>document.activeElement===document.getElementById(id),'Amount focus after one label tap',await amount.getAttribute('id'));
        }catch(error){
          throw new Error(error.message+' at '+section+'/'+width+'/'+theme+': '+JSON.stringify({before:gesture,after:await page.evaluate(()=>({focus:document.activeElement?.id,events:window.__signedGesture}))}),{cause:error});
        }
        await page.evaluate(()=>window.__stopSignedGesture());
        check(await page.evaluate(w=>document.documentElement.scrollWidth<=w+1,width),'signed editor overflows at '+width+'/'+theme);
        if(process.env.SIGNED_A11Y){
          const axe=await import('axe-core');await page.evaluate(axe.default.source);
          const violations=await r.evaluate(async el=>(await window.axe.run(el,{preload:false})).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.failureSummary)})));
          check(!violations.length,'signed editor accessibility: '+JSON.stringify(violations));
        }
      }
    }
    // Changing type must replace the explanation as well as the calculation rule.
    r=await open('income','example-gross-offset');
    await r.getByLabel('Income type',{exact:true}).selectOption('Net');
    r=await open('income','example-gross-offset');
    await r.getByText('A negative amount reduces planned take-home income. It does not record a payment.',{exact:true}).waitFor();
    await r.getByLabel('Income type',{exact:true}).selectOption('Gross');
    r=await open('income','example-gross-offset');
    await r.getByText('A negative amount adjusts this person’s combined gross pay. Tax and super are recalculated; no payment is recorded.',{exact:true}).waitFor();
    await page.keyboard.press('Escape');
    // The minimal test server serves index.html directly; production's 404 redirects nested routes to the app root.
    await go(page,'dashboard');
    await page.reload();await quiet(page);
    check(await stored(page,"state.shared.find(x=>x.id==='example-cost-offset').amount")===-100,'Budget adjustment lost on reload');
    check(await stored(page,"state.income.find(x=>x.id==='example-net-offset').amount")===-200,'Net adjustment lost on reload');
    check(await stored(page,"state.income.find(x=>x.id==='example-gross-offset').amount")===-12000,'Gross adjustment lost on reload');
    after=await snapshot();
    check(close(after.forecast,finalForecast) && close(after.totals.netMonthly,finalTotals.netMonthly) && after.actual===initial.actual,'reload changed signed totals/projections or actual records');
  },
  async budgetclarity(page){
    await quiet(page);
    await go(page,'expenses','data-expenses-sub','budget');
    const plan=page.locator('#budgetPlanBody');
    check(await plan.locator('.bp-overview > div').count()===3,'monthly summary missing');
    check(await plan.locator('details[open]').count()===0,'statement details open by default');
    await plan.locator('.bp-fold').first().locator('summary').click();
    check(await plan.locator('.bp-row').first().isVisible(),'income detail unavailable');
    await page.evaluate(async()=> (await import('/src/components/expenses.js')).renderBudgetPlan());
    check(await plan.locator('.bp-fold').first().getAttribute('open')!==null,'redraw collapsed an open section');
    check((await plan.textContent()).includes('Running balance means'),'running balance explanation missing');
    for(const width of [320,390,768,1280]){
      await page.setViewportSize({width,height:844});
      const overflow=await plan.evaluate((e,w)=>[...e.querySelectorAll('.bp-overview,.bp-row,summary')].filter(x=>x.getClientRects().length).some(x=>x.getBoundingClientRect().right>w+1),width);
      check(!overflow,'planned month overflow at '+width);
    }
    await page.setViewportSize({width:390,height:844});
    await go(page,'plan','data-plan-sub','scenarios');
    await page.locator('#cards .card-edit-link[data-edit-scenario]').nth(1).click();
    await until(page,()=>document.body.dataset.currentPage==='scenario');await settle(page);
    const comparison=page.locator('.budget-comparison');
    check(await comparison.locator('.budget-pie').count()===2,'baseline/scenario rings missing');
    const before=await comparison.textContent();
    await click(page,'[data-sc-calc]');await until(page,()=>document.body.dataset.currentPage==='calc');await settle(page);
    const price=page.locator('#calcScenarioBody .calc-price');
    await price.fill('900000');await price.press('Tab');
    // The editor summary is kept up to date while calculator controls retain focus.
    check((await comparison.textContent())!==before,'scenario composition did not follow the purchase edit');
    await page.locator('[data-calc-done]').click();await until(page,()=>document.body.dataset.currentPage==='scenario');await settle(page);
    for(const width of [320,390,768,1280]){
      await page.setViewportSize({width,height:844});
      for(const theme of ['light','dark']){
        await page.evaluate(t=>document.documentElement.setAttribute('data-theme',t),theme);
        check(!await comparison.evaluate((e,w)=>e.getBoundingClientRect().right>w+1||e.scrollWidth>e.clientWidth+1,width),'comparison overflow at '+width+'/'+theme);
      }
    }
  },
  // #255 step 4: Tax's explanations work by keyboard/touch and survive live card updates.
  async basicinvestmenthelp(page){
    await go(page,'assets','data-assets-sub','Cash');
    await page.evaluate(async()=>{
      const s=await import('/src/state.js');
      const person=s.state.assets.find(a=>a.id==='demo-super-alex').person;
      for(const category of ['Cash','Super','Vehicle','Other']){
        for(const n of [1,2]) s.state.assets.push({id:'example-'+category+'-'+n,what:'Extra <'+category+'> & "example" '+n,category,amount:n*10000,person:category==='Super'?person:'',history:category==='Super'&&n===1?[{date:'2026-09-01',value:10000}]:[],...(category==='Vehicle'?{purchasePrice:n*10000,purchaseDate:'2026-01-01',depreciationRate:10}:{} )});
      }
      (await import('/src/calc/engine.js')).recalcComputedItems();s.persist();
      (await import('/src/components/assets.js')).renderAssets();
    });
    for(const category of ['Cash','Super','Vehicle','Other']){
      await go(page,'assets','data-assets-sub',category);
      const root=page.locator('#assetsSub-'+category);
      const saved=await stored(page,'JSON.stringify(state.assets)');
      const index=await page.evaluate(async c=>(await import('/src/state.js')).state.assets.findIndex(a=>a.id==='example-'+c+'-1'),category);
      const row=root.locator('.m-row[data-index="'+index+'"]');
      const figures=root.locator('[data-comp-bar] [role="img"]');
      check(await figures.count()>=2,'asset composition segments are not named');
      check((await figures.evaluateAll(es=>es.map(e=>e.getAttribute('aria-label')))).some(t=>t.includes('Extra <'+category+'> & "example"')),'composition names lost escaped text');
      for(const figure of await figures.all()) check(await figure.getAttribute('aria-label')===await figure.getAttribute('title'),'composition name differs from its hover value');
      let help, note;
      if(category==='Super'){
        help=page.locator('#pageHelpBtn');note=page.locator('#superEstimateHelp');
        check(await row.locator('.est-note').isVisible() && await row.locator('.m-row-summary').getAttribute('aria-describedby')==='superEstimateHelp','Super estimate lost its visible qualifier or description');
        check(await row.locator('.est-note').getAttribute('title')===null,'Super estimate still depends on hover');
        const cdp=await page.context().newCDPSession(page),tree=await cdp.send('Accessibility.getFullAXTree');
        check(tree.nodes.some(n=>!n.ignored && n.role?.value==='button' && /Extra <Super>/.test(n.name?.value||'') && /15% contributions tax/.test(n.description?.value||'')),'folded Super method is absent from the row’s accessibility description');
        await cdp.detach();
      }else if(category==='Vehicle'){
        help=root.locator('details:has(#assetsComp-Vehicle) > [data-help-toggle]');note=page.locator('#vehicleMethodHelp');
        check(await root.locator('[data-add="vehicle"]').getAttribute('aria-describedby')==='vehicleMethodHelp','Add vehicle lacks its method description');
      }
      if(help){
        check(!await note.isVisible(),'asset help is not folded initially');
        await page.evaluate(()=>window.scrollTo(0,0));await page.waitForFunction(()=>!document.querySelector('.app-topbar.is-compact'));
        await help.focus();await page.keyboard.press('Enter');check(await note.isVisible(),'Enter did not reveal asset help');
        await page.keyboard.press('Space');check(!await note.isVisible(),'Space did not fold asset help');
        for(const scheme of ['light','dark']){
          await page.evaluate(s=>{document.documentElement.dataset.theme=s;},scheme);
          for(const width of [320,390,1280]){
            await page.setViewportSize({width,height:844});
            await page.evaluate(()=>window.scrollTo(0,0));await page.waitForFunction(()=>!document.querySelector('.app-topbar.is-compact'));
            await help.tap();check(await note.isVisible(),'touch did not reveal asset help');
            check(await page.evaluate(w=>document.documentElement.scrollWidth<=w,width),'asset help overflows at '+width+' in '+scheme);
            await help.tap();
          }
        }
      }
      check(await stored(page,'JSON.stringify(state.assets)')===saved,'opening help changed asset data');
      if(category==='Super'){
        await page.evaluate(()=>window.scrollTo(0,0));await help.click();
        const text=await note.innerText();
        await page.evaluate(async()=> (await import('/src/components/assets.js')).renderAssetCategoryPage('Super'));
        check(await note.isVisible() && await note.innerText()===text,'Super redraw lost open method help');
      }
      await row.locator('[data-row-toggle]').first().click();
      const record=row.getByRole('button',{name:'Record value',exact:true});
      check(await record.getAttribute('title')===null,'recording still depends on hover');
      check(await record.evaluate(e=>{const h=document.getElementById(e.getAttribute('aria-describedby'));return !!h && h.getClientRects().length>0 && /Record value.*snapshot/.test(h.textContent);}), 'snapshot action does not describe its visible help');
      const cdp=await page.context().newCDPSession(page),tree=await cdp.send('Accessibility.getFullAXTree');
      check(tree.nodes.some(n=>!n.ignored && n.role?.value==='button' && n.name?.value==='Record value' && /snapshot/.test(n.description?.value||'')), 'recording description is missing from the editor’s accessibility tree');
      await cdp.detach();
      const before=await stored(page,'state.assets.find(a=>a.id==="example-'+category+'-1").amount');
      await record.focus();await page.keyboard.press('Enter');
      check(await stored(page,'state.assets.find(a=>a.id==="example-'+category+'-1").history.some(h=>h.date==="2026-11-03" && h.value==='+before+')'),'snapshot did not record the current asset value');
      check(await record.evaluate(e=>e===document.activeElement),'recording lost focus');
      await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('.m-row.open'));
      if(category==='Super'){
        check(await note.isVisible(),'recording folded Super method help');
        check(await row.locator('.est-note').count()===0,'a newly confirmed Super balance still shows an old estimate');
        await page.evaluate(()=>window.scrollTo(0,0));await help.click();
      }
    }
  },
  async investmentssummaryhelp(page){
    // #413: Investments → Summary went; its allocation is under Accounts' list, and its funding ("Net worth if you buy")
    // on Plan → Scenarios. Each is checked where it is.
    await goNetWorthMore(page);
    const funding = page.locator('#purchaseFundingCard');
    const allocation = page.locator('#netWorthMore details:has(#assetsAllocation)');
    const groups = [funding,allocation];
    const showGroup = async group => { if(group === funding) await goPurchaseFunding(page); else await goNetWorthMore(page); };
    const saved = await stored(page,'JSON.stringify({assets:state.assets,properties:state.properties,purchase:state.purchase})');
    const stats = JSON.stringify(await page.locator('#netWorthBody .nw-head b').allTextContents());
    await goPurchaseFunding(page);   // drawn when its tab shows
    const table = JSON.stringify(await page.locator('#netWorthPanel tbody td').allTextContents());
    for(const group of groups){
      await showGroup(group);
      const help = group.locator(':scope > [data-help-toggle], :scope > h2 > [data-help-toggle]');
      const note = group.locator('.help').first();
      check(!await note.isVisible(), 'summary help is not folded initially');
      await help.focus(); await page.keyboard.press('Enter');
      check(await note.isVisible(), 'Enter did not reveal summary help');
      await page.keyboard.press('Space');
      check(!await note.isVisible(), 'Space did not fold summary help');
    }
    for(const scheme of ['light','dark']){
      await page.evaluate(s => { document.documentElement.dataset.theme = s; }, scheme);
      for(const width of [320,390,1280]){
        await page.setViewportSize({width,height:844});
        for(const group of groups){
          await showGroup(group);
          const help = group.locator(':scope > [data-help-toggle], :scope > h2 > [data-help-toggle]');
          await help.tap();
          check(await group.locator('.help').first().isVisible(), 'touch did not reveal summary help');
          check(await page.evaluate(w=>document.documentElement.scrollWidth<=w,width), 'summary help overflows at ' + width + ' in ' + scheme);
          await help.tap();
        }
        if(width<768){
          await goPurchaseFunding(page);
          await page.locator('[data-funding-full-toggle]').check();
          check(await page.locator('.funding-full-table').isVisible(), 'full funding table is unavailable');
          check(await page.evaluate(w=>document.documentElement.scrollWidth<=w,width), 'full funding table causes page overflow');
          await page.locator('[data-funding-full-toggle]').uncheck();
        }
      }
    }
    check(await stored(page,'JSON.stringify({assets:state.assets,properties:state.properties,purchase:state.purchase})') === saved, 'opening help changed financial data');
    check(JSON.stringify(await page.locator('#netWorthBody .nw-head b').allTextContents()) === stats && JSON.stringify(await page.locator('#netWorthPanel tbody td').allTextContents()) === table, 'opening help changed displayed figures');
    check(await page.locator('#netWorthPanel th[title]').count() === 0, 'summary explanations still depend on hover');
    for(const selector of ['#assetsAllocation [role="img"]','#allocationHistoryPanel .alloc-today [role="img"]']){
      const figures = page.locator(selector);
      check(await figures.count()>1, 'composition chart lacks accessible segments');
      for(const figure of await figures.all()){
        const label = await figure.getAttribute('aria-label');
        check(label === await figure.getAttribute('title') && /\$.*%/.test(label), 'composition name differs from its exact hover values');
      }
    }
    for(const header of await page.locator('#netWorthPanel th[aria-describedby]').all()){
      check(await header.evaluate(e=>!!document.getElementById(e.getAttribute('aria-describedby'))?.textContent), 'funding header lacks its explanation');
    }
    check(await page.locator('#netWorthPanel th[aria-describedby]').count() === 4, 'not all funding definitions are linked');
    await goPurchaseFunding(page);
    const cdp = await page.context().newCDPSession(page), tree = await cdp.send('Accessibility.getFullAXTree');
    check(tree.nodes.some(n=>!n.ignored && n.role?.value==='columnheader' && /^surplus \/ shortfall$/i.test(n.name?.value || '') && /higher LVR, likely with LMI/.test(n.description?.value || '')), 'folded funding explanation is missing from the accessibility tree');
    await cdp.detach();
    await goPurchaseFunding(page);
    const help = funding.locator(':scope > [data-help-toggle]');
    await help.tap();
    check(/save more first, borrow a larger share/.test(await funding.innerText()), 'funding-gap wording was lost');
    await help.focus();
    await page.evaluate(async()=>{
      const a=await import('/src/components/assets.js');a.renderNetWorthPanel();a.renderAssetsSummary();
    });
    check(await funding.locator('.help').first().isVisible() && await help.evaluate(e=>e===document.activeElement), 'redraw lost open funding help or focus');
    check(/Selling investments is not assumed/.test(await page.locator('#netWorthPanel').innerText()), 'visible funding assumption was lost');
    const labels = await page.locator('#assetsAllocation [role="img"]').evaluateAll(es=>es.map(e=>e.getAttribute('aria-label')));
    await page.evaluate(async()=>{
      const s=await import('/src/state.js'), a=await import('/src/components/assets.js');
      s.state.assets.find(x=>x.category==='Cash').amount+=1000;s.persist();
      a.renderAssetsSummary();a.renderNetWorthPanel();a.renderAllocationChart();
    });
    check(JSON.stringify(await page.locator('#assetsAllocation [role="img"]').evaluateAll(es=>es.map(e=>e.getAttribute('aria-label')))) !== JSON.stringify(labels), 'summary redraw left composition labels stale');
    check(JSON.stringify(await page.locator('#netWorthPanel tbody td').allTextContents()) !== table, 'funding redraw left cash figures stale');
    await page.evaluate(async()=>{
      const s=await import('/src/state.js');s.state.assets=[];s.state.properties=[];s.state.debts=[];s.state.accounts=[];
      (await import('/src/components/networth.js')).renderNetWorthPage();
    });
    await go(page, 'networth');
    check(await page.locator('#netWorthBody .empty-state').isVisible(), 'an empty Net worth lost its guidance');
  },
  async incomehelp(page){
    await go(page, 'expenses', 'data-expenses-sub', 'income');
    const person = await page.evaluate(async () => {
      const s = await import('/src/state.js');
      const person = s.state.income.find(i=>i.id==='demo-pay-alex').person;
      s.state.income.push({id:'example-extra-pay',what:'Extra <A> & "example"',person,incomeType:'Net',amount:1000,freq:'Monthly'}, {id:'example-shared-pay',what:'Shared income',person:'',incomeType:'Net',amount:500,freq:'Monthly'});
      (await import('/src/calc/tax.js')).personTaxSettings(person).hoursPerWeek = 0;
      (await import('/src/calc/engine.js')).recalcComputedItems(); s.persist();
      (await import('/src/components/redraw.js')).renderAll(); return person;
    });
    const root = page.locator('#expensesSub-income');
    const ledger = root.locator('details:has(#incomeGroups)');
    const help = ledger.locator(':scope > [data-help-toggle]');
    const hourly = page.locator('#incomeHourlyHelp');
    const saved = await stored(page,'JSON.stringify(state.income)');
    const tax = await page.evaluate(async p=>JSON.stringify((await import('/src/calc/tax.js')).computePersonTax(p)),person);
    check(!await hourly.isVisible(), 'Income explanation is not folded initially');
    await help.focus(); await page.keyboard.press('Enter');
    check(await hourly.isVisible(), 'Enter did not reveal Income help');
    await page.keyboard.press('Space');
    check(!await hourly.isVisible(), 'Space did not fold Income help');
    await root.locator('[data-showas="hour"]').click();
    const personCard = root.locator('.m-card').filter({has:page.getByText(person,{exact:true})});
    const sharedCard = root.locator('.m-card').filter({has:page.getByText('Household / Shared',{exact:true})});
    for(const card of [personCard,sharedCard]){
      const dash = card.locator('.m-card-total [role="img"]');
      check(await dash.getAttribute('aria-label') === 'Hourly income unavailable' && await dash.getAttribute('aria-describedby') === 'incomeHourlyHelp', 'hourly dash lacks its explanation');
    }
    const cdp = await page.context().newCDPSession(page), tree = await cdp.send('Accessibility.getFullAXTree');
    check(tree.nodes.some(n=>!n.ignored && n.name?.value === 'Hourly income unavailable' && /zero working hours/.test(n.description?.value || '')), 'hourly explanation is missing from the accessibility tree while folded');
    await cdp.detach();
    for(const scheme of ['light','dark']){
      await page.evaluate(s => { document.documentElement.dataset.theme = s; }, scheme);
      for(const width of [320,390,1280]){
        await page.setViewportSize({width,height:844});
        // #427: Income is Money in, below Budget's summary, so the ⓘ is tapped part-way down a long page. Scrolled only
        // just into view it sat under the sticky header and section bar, and under emulated touch Chrome sometimes moved
        // the page between the touch and its click (38px at 320px: the touch on the ⓘ, the click on what moved there; no
        // script scrolled it). Centred, as a person taps what's in front of them, it didn't (16 of 16 at 6× CPU).
        await steadyTap(page, help);
        check(await hourly.isVisible() && /zero working hours/.test(await hourly.innerText()), 'touch did not reveal the hourly basis');
        check(!/⇄ Vary/.test(await ledger.innerText()) && /Changes from today/.test(await ledger.innerText()), 'Income help points to removed scenario controls');
        check(await page.evaluate(w=>document.documentElement.scrollWidth<=w,width), 'Income help overflows at ' + width + ' in ' + scheme);
        await help.tap();
      }
    }
    check(await stored(page,'JSON.stringify(state.income)') === saved, 'opening help or Show as changed saved income');
    check(await page.evaluate(async ([p,before])=>JSON.stringify((await import('/src/calc/tax.js')).computePersonTax(p))===before,[person,tax]), 'opening help or Show as changed tax results');
    const figures = personCard.locator('[data-comp-bar] [role="img"]');
    check(await figures.count() >= 2, 'income composition segments are not labelled');
    for(const figure of await figures.all()){
      const label = await figure.getAttribute('aria-label');
      check(label === await figure.getAttribute('title') && /\/mo \([0-9.,]+%\)/.test(label), 'composition label does not match its monthly value');
    }
    check((await figures.evaluateAll(es=>es.map(e=>e.getAttribute('aria-label')))).some(t=>t.includes('Extra <A> & "example"')), 'chart names lost escaped text');
    await page.evaluate(async person => {
      const s = await import('/src/state.js');
      (await import('/src/calc/tax.js')).personTaxSettings(person).hoursPerWeek = 20; s.persist();
      (await import('/src/components/income.js')).patchIncomeGroupTotals();
    },person);
    check(await personCard.locator('.m-card-total [role="img"]').count() === 0 && /\/hr/.test(await personCard.locator('.m-card-total').innerText()), 'positive hours did not replace the unavailable figure');
    check(await sharedCard.locator('.m-card-total [role="img"]').count() === 1, 'shared income acquired a person’s hourly figure');
    const beforeLabel = await figures.evaluateAll(es=>es.map(e=>e.getAttribute('aria-label')));
    const index = await page.evaluate(async()=> (await import('/src/state.js')).state.income.findIndex(i=>i.id==='example-extra-pay'));
    const row = root.locator('.m-row[data-index="'+index+'"]');
    await row.locator('[data-row-toggle]').first().click();
    await row.locator('.f-amount').fill('2000'); await row.locator('.f-amount').press('Tab');
    await page.keyboard.press('Escape');
    check(await stored(page,'state.income.find(i=>i.id==="example-extra-pay").amount') === 2000, 'income editor stopped saving');
    check(JSON.stringify(await figures.evaluateAll(es=>es.map(e=>e.getAttribute('aria-label')))) !== JSON.stringify(beforeLabel), 'live edit left composition labels stale');
    // Escape closes the row through history.back(): it shuts on the later popstate, and putting focus back on the
    // row scrolls it into view. Scrolling to the top before then is undone, and the header stays compact.
    await waited(page,()=>!document.querySelector('#expensesSub-income .m-row.open'),'the income row closed');
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.waitForFunction(()=>!document.querySelector('.app-topbar.is-compact'));
    // #427: Money in's explanation is behind the ⓘ beside its heading (it was the Income tab's page help).
    await page.locator('#moneyIn [data-help-toggle]').click();
    check(await page.locator('#incomePageHelp').isVisible(), 'Money in help is unavailable');
    const menu = page.getByRole('button',{name:'Income import and export',exact:true});
    const downloadText = async id => {
      if(await menu.getAttribute('aria-expanded') !== 'true') await menu.click();
      const action = page.locator('#'+id);
      check(await action.getAttribute('title') === null && await action.evaluate(e=>!!document.getElementById(e.getAttribute('aria-describedby'))?.textContent), 'CSV action lacks its linked explanation');
      const pending = page.waitForEvent('download'); await action.click();
      const file = await pending, stream = await file.createReadStream();
      let text = ''; for await(const chunk of stream) text += chunk.toString(); return text;
    };
    const csv = await downloadText('incomeExportCsvBtn');
    check(csv.includes('Shared income') && csv.includes('2000'), 'income export lost saved rows');
    const template = await downloadText('incomeDownloadTemplateBtn');
    check(/What,Person,Type,Amount,Frequency/.test(template), 'income template headers changed');
    const importCsv = template.trim()+'\nImported income,,Net,500,Monthly,,,,\n';
    const importWas = await stored(page,'JSON.stringify(state.income)');
    await menu.click();
    const chooser = page.waitForEvent('filechooser'); await page.locator('#incomeImportBtn').click();
    const file = {name:'example-income.csv',mimeType:'text/csv',buffer:Buffer.from(importCsv)};
    await (await chooser).setFiles(file);
    await page.locator('#incomeImportPreview [data-rowimport-cancel]').click();
    check(await stored(page,'JSON.stringify(state.income)') === importWas, 'cancelled income import saved rows');
    await page.locator('#incomeImportFile').setInputFiles(file);
    await page.locator('#incomeImportPreview [data-rowimport-confirm]').click();
    check(await stored(page,'state.income.some(i=>i.what==="Imported income" && i.amount===500)'),'income import did not save its reviewed row');
  },
  async propertyremaininghelp(page){
    await go(page, 'properties');
    await page.evaluate(async () => {
      const s = await import('/src/state.js'), p = s.state.properties[0];
      const fy = (await import('/src/calc/property.js')).financialYearOf((await import('/src/calc/ledger.js')).householdYearWindow().start);
      p.acquisitionCosts = [{what:'Cost <A> & "example"',amount:2000},{what:'Second cost',amount:1000}];
      p.loans = [{...p.loans[0],what:'Loan <A> & "example"',balance:200000,offsetBalance:0}, {...structuredClone(p.loans[0]),id:'example-second-loan',what:'Second loan',balance:100000,offsetBalance:0}];
      p.depreciationSchedule = [{fy,capitalWorks:2000,plant:500}]; s.persist();
      (await import('/src/components/properties.js')).renderProperties();
    });
    const card = page.locator('.property-card').first();
    await card.locator('[data-prop-edit]').click();
    const tab = async (name, section) => {
      const button = card.locator('[data-prop-tab][data-tab="' + name + '"]');
      const picker = card.locator('.prop-tabs select');
      // A card redraw starts with buttons; the next picker pass can hide them. Wait for that
      // decoration before choosing a control, so an early visibility read cannot select a disappearing tab.
      await picker.waitFor({state:'attached'});
      if(await picker.isVisible()) await picker.selectOption({label:(await button.textContent()).trim()});
      else await button.click();
      const toggle = card.locator('[data-prop-section-toggle="' + section + '"]');
      if(await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();
    };
    const chartLabels = async root => {
      const segments = root.locator('[data-comp-bar] [role="img"]');
      check(await segments.count() === 2, 'composition chart lacks named segments');
      for(const segment of await segments.all()){
        const label = await segment.getAttribute('aria-label');
        check(label === await segment.getAttribute('title') && /\$.*\([0-9.,]+%\)/.test(label), 'chart name differs from its exact hover value');
      }
      check((await segments.first().getAttribute('aria-label')).includes('<A> & "example"'), 'chart name lost escaped text');
    };
    await tab('overview','acquisition');
    await chartLabels(card.locator('[id^="propAcqCostRows_"]'));
    await tab('loans','loans');
    await chartLabels(card.locator('[id^="propLoanRows_"]'));
    const oldLabel = await card.locator('[id^="propLoanRows_"] [role="img"]').first().getAttribute('aria-label');
    await page.evaluate(async () => {
      const s = await import('/src/state.js'), p = s.state.properties[0]; p.loans[0].balance = 300000;
      (await import('/src/components/properties.js')).patchPropertyCardComputed(p); s.persist();
    });
    check(await card.locator('[id^="propLoanRows_"] [role="img"]').first().getAttribute('aria-label') !== oldLabel, 'live loan patch left chart labels stale');
    await tab('tax','depreciation');
    const group = card.locator('[data-property-help="depreciation-schedule"]');
    const help = group.locator('[data-help-toggle]'), note = group.locator('.help');
    const saved = await stored(page, 'JSON.stringify(state.properties)');
    check(!await note.isVisible(), 'schedule help is not folded initially');
    await help.focus(); await page.keyboard.press('Enter');
    check(await note.isVisible(), 'Enter did not reveal schedule help');
    await page.keyboard.press('Space');
    check(!await note.isVisible(), 'Space did not fold schedule help');
    for(const scheme of ['light','dark']){
      await page.evaluate(s => { document.documentElement.dataset.theme = s; }, scheme);
      for(const width of [320,390,1280]){
        await page.setViewportSize({width,height:844});
        await help.tap();
        check(await note.isVisible() && /Division 43.*Division 40/s.test(await note.innerText()), 'schedule help is missing on touch');
        check(await page.evaluate(w => document.documentElement.scrollWidth <= w, width), 'expanded schedule help overflows at ' + width + ' in ' + scheme);
        await help.tap();
      }
    }
    check(await stored(page, 'JSON.stringify(state.properties)') === saved, 'opening schedule help changed stored properties');
    for(const cls of ['dep-sched-cw','dep-sched-plant']){
      check(await group.locator('.'+cls).getAttribute('title') === null, 'schedule field still uses a title');
      check(await group.locator('.'+cls).evaluate(e => !!document.getElementById(e.getAttribute('aria-describedby'))?.textContent), 'schedule field description is missing');
    }
    await help.tap();
    const capitalHelp = await group.locator('.dep-sched-cw').getAttribute('aria-describedby');
    await group.locator('.dep-sched-cw').fill(''); await group.locator('.dep-sched-cw').press('Tab');
    check(await stored(page,'state.properties[0].depreciationSchedule[0].capitalWorks') === 2000, 'blank schedule amount changed saved data');
    check((await group.locator('.dep-sched-cw').getAttribute('aria-describedby')).split(/\s+/).includes(capitalHelp), 'validation dropped the schedule description');
    await group.locator('.dep-sched-cw').fill('3000'); await group.locator('.dep-sched-cw').press('Tab');
    check(await stored(page,'state.properties[0].depreciationSchedule[0].capitalWorks') === 3000, 'schedule edit did not save');
    check(await note.isVisible(), 'schedule edit folded help');
    await help.focus();
    await page.evaluate(async () => { (await import('/src/components/properties.js')).renderProperties(); });
    check(await note.isVisible() && await help.evaluate(e=>e === document.activeElement), 'redraw lost open schedule help or its focus');
  },
  async propertyactionhelp(page){
    await go(page, 'properties');
    await page.evaluate(async () => {
      const s = await import('/src/state.js'), p = s.state.properties[0];
      p.history = [];
      p.acquisitionCosts = [{what:'LMI',amount:2000}, {what:'Purchase fee',amount:500}];
      p.loans = [p.loans[0], {...structuredClone(p.loans[0]), id:'example-earlier-loan', what:'Earlier loan', settlementDate:'2024-01-01'}];
      p.loans[0].settlementDate = '2025-01-01';
      const home = structuredClone(p); home.id = 'example-home'; home.what = 'Example home'; home.kind = 'PPOR'; home.loans = [{...structuredClone(p.loans[0]),id:'example-home-loan',what:'Home loan'}];
      s.state.properties.push(home); s.persist();
      (await import('/src/components/properties.js')).renderProperties();
    });
    // Exercise wider Linux fallback metrics: the two-loan LVR badge must fit at 320px,
    // including values above 100% and the offset suffix.
    await page.addStyleTag({content:'.property-card-badges{font-family:"DejaVu Sans",sans-serif}'});
    const card = page.locator('.property-card').first();
    await card.locator('[data-prop-edit]').click();
    for(const key of ['value','acquisition']){
      const toggle = card.locator('[data-prop-section-toggle="' + key + '"]');
      if(await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();
    }
    const saved = await stored(page, 'JSON.stringify(state.properties)');
    const recordHelp = card.locator('[data-property-help="record-value"]');
    const moveHelp = card.locator('[data-property-help="move-cost"]');
    check(await page.locator('[data-property-id="example-home"] [data-property-help="move-cost"]').count() === 0, 'unavailable move action has help');
    for(const group of [recordHelp, moveHelp]){
      const help = group.locator('[data-help-toggle]'), note = group.locator('.help');
      check(!await note.isVisible(), 'action help is not folded initially');
      await help.focus(); await page.keyboard.press('Enter');
      check(await note.isVisible(), 'Enter did not reveal action help');
      await page.keyboard.press('Space');
      check(!await note.isVisible(), 'Space did not fold action help');
    }
    for(const scheme of ['light','dark']){
      await page.evaluate(s => { document.documentElement.dataset.theme = s; }, scheme);
      for(const width of [320,390,1280]){
        await page.setViewportSize({width,height:844});
        for(const group of [recordHelp, moveHelp]){
          await group.locator('[data-help-toggle]').tap();
          check(await group.locator('.help').isVisible(), 'touch did not reveal action help at ' + width + ' in ' + scheme);
          const layout = await page.evaluate(w => ({width:innerWidth, client:document.documentElement.clientWidth, scroll:document.documentElement.scrollWidth, outside:[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return r.width && (r.left < -1 || r.right > w + 1);}).map(e=>({tag:e.tagName,cls:e.className,text:e.textContent.trim().slice(0,60),left:Math.round(e.getBoundingClientRect().left),right:Math.round(e.getBoundingClientRect().right)}))}),width);
          check(layout.scroll <= width, 'action help overflows at ' + width + ' in ' + scheme + ' for ' + await group.getAttribute('data-property-help') + ': ' + JSON.stringify(layout));
          await group.locator('[data-help-toggle]').tap();
        }
      }
    }
    check(await stored(page, 'JSON.stringify(state.properties)') === saved, 'opening action help changed saved properties');
    const actions = card.locator('[data-property-log], [data-acq-cost-move]');
    check(await actions.count() === 3, 'record/suggested/ordinary move actions are missing');
    for(const action of await actions.all()){
      check(await action.getAttribute('title') === null, 'action still depends on a title');
      check(await action.evaluate(e => !!document.getElementById(e.getAttribute('aria-describedby'))?.textContent), 'action description is missing');
    }
    await recordHelp.locator('[data-help-toggle]').tap();
    await moveHelp.locator('[data-help-toggle]').tap();
    await card.locator('[data-property-log]').click();
    check(await stored(page,'state.properties[0].history.length') === 1 && await stored(page,'state.properties[0].history[0].value') === await stored(page,'state.properties[0].value'), 'record-value action did not save the current value');
    check(await recordHelp.locator('.help').isVisible() && await moveHelp.locator('.help').isVisible(), 'record-value redraw folded open action help');
    const beforeMove = await stored(page, 'JSON.stringify({costs:state.properties[0].acquisitionCosts,loans:state.properties[0].loans})');
    const borrowing = await stored(page, 'state.properties[0].loans[1].borrowingCosts || 0');
    await card.locator('[data-acq-cost-move="0"]').click();
    check(await stored(page,'state.properties[0].acquisitionCosts.length') === 1 && await stored(page,'state.properties[0].loans[1].borrowingCosts') === borrowing + 2000, 'move action did not send the cost to the earliest loan');
    await page.locator('.toast-undo-btn').last().click();
    check(await stored(page, 'JSON.stringify({costs:state.properties[0].acquisitionCosts,loans:state.properties[0].loans})') === beforeMove, 'Undo did not restore the acquisition cost and loan');
    await page.locator('#pageHelpBtn').click();
    check(await page.locator('#propertyPageHelp').isVisible() && /every loan, across every property/.test(await page.locator('#propertyPageHelp').innerText()), 'page help omits loan export scope');
    await page.locator('#page-properties [data-overflow-toggle]').click();
    const download = page.waitForEvent('download');
    await page.locator('#propertyLoansExportCsvBtn').click();
    const file = await download, stream = await file.createReadStream();
    let csv = ''; for await(const chunk of stream) csv += chunk.toString();
    check(/^property-loans-.*\.csv$/.test(file.suggestedFilename()) && csv.includes('Earlier loan') && csv.includes('Home loan'), 'loan export did not download all loans');
  },
  async propertyfigurehelp(page){
    await go(page, 'properties');
    await page.evaluate(async () => {
      const s = await import('/src/state.js');
      const home = structuredClone(s.state.properties[0]);
      home.id = 'example-home'; home.what = 'Example home'; home.kind = 'PPOR';
      home.purchasePrice = null; home.income = []; home.expenses = []; home.loans = [];
      s.state.properties.push(home); s.persist();
      (await import('/src/components/properties.js')).renderProperties();
    });
    const card = page.locator('.property-card').first();
    const figures = card.locator('.property-figures');
    const help = figures.locator('[data-help-toggle]');
    const note = figures.locator('[data-property-figures-explanations]');
    const saved = await stored(page, 'JSON.stringify(state.properties)');
    const before = await figures.locator('.calc-outputs').allTextContents();
    const homeNote = page.locator('[data-property-id="example-home"] [data-property-figures-explanations]');
    check(!/Gearing:|Gross yield:|Yield on cost:|Capital gain:/.test(await homeNote.textContent()), 'home shows inapplicable investment explanations');
    check(!await note.isVisible(), 'figure help is not folded initially');
    await help.focus(); await page.keyboard.press('Enter');
    check(await note.isVisible() && !await homeNote.isVisible(), 'Enter did not reveal only this property’s figure help');
    await page.keyboard.press('Space');
    check(!await note.isVisible(), 'Space did not fold figure help');
    for(const scheme of ['light', 'dark']){
      await page.evaluate(s => { document.documentElement.dataset.theme = s; }, scheme);
      for(const width of [320, 390, 1280]){
        await page.setViewportSize({width, height:844});
        await help.tap();
        check(await note.isVisible(), 'touch did not reveal figure help at ' + width + ' in ' + scheme);
        check(/Loan repayment:.*Usable equity:.*LVR:.*Gearing:.*Gross yield:.*Yield on cost:.*Capital gain:/s.test(await note.innerText()), 'figure explanations are incomplete');
        check(await page.evaluate(w => document.documentElement.scrollWidth <= w, width), 'figure help overflows at ' + width);
        await help.tap();
      }
    }
    check(await stored(page, 'JSON.stringify(state.properties)') === saved, 'opening figure help changed stored properties');
    check(JSON.stringify(await figures.locator('.calc-outputs').allTextContents()) === JSON.stringify(before), 'opening figure help changed displayed figures');
    check(await figures.locator('[title]:not([data-help-toggle])').count() === 0, 'figure explanations still use titles: ' + await figures.locator('[title]:not([data-help-toggle])').evaluateAll(es => es.map(e => e.outerHTML).join(' ')));
    await help.tap();
    await figures.locator('.property-stats-more > summary').click();
    await help.focus();
    await page.evaluate(async () => { (await import('/src/components/properties.js')).renderProperties(); });
    check(await note.isVisible() && await help.getAttribute('aria-expanded') === 'true', 'redraw folded open figure help');
    check(await help.evaluate(e => document.activeElement === e), 'redraw lost help focus');
    check(await figures.locator('.property-stats-more').evaluate(d => d.open), 'redraw folded More detail');
    await card.locator('[data-prop-edit]').click();
    await card.locator('.prop-value').fill('400000'); await card.locator('.prop-value').press('Tab');
    check(/above 80% typically triggers/.test(await note.innerText()), 'live value edit did not update LVR explanation');
    await card.locator('.prop-value').fill('900000'); await card.locator('.prop-value').press('Tab');
    check(!/above 80% typically triggers/.test(await note.innerText()), 'live value edit left an outdated LVR warning');
    const original = await note.innerText();
    await card.locator('.prop-purchase-price').fill('300000'); await card.locator('.prop-purchase-price').press('Tab');
    check(await note.isVisible() && await note.innerText() !== original, 'purchase-price redraw left help folded or its cost base stale');
    check(await figures.locator('[title]:not([data-help-toggle])').count() === 0, 'live edit restored figure titles');
    await page.evaluate(async () => { (await import('/src/lib/help.js')).setShowHelp(true); });
    check(await note.isVisible() && !await help.isVisible(), 'always-show-help preference does not apply to property figures');
  },
  async propertysummaryhelp(page){
    await go(page, 'properties');
    const root = page.locator('#propertiesSummary');
    const help = root.locator('[data-help-toggle]');
    const note = page.locator('#propertiesSummaryHelp');
    const before = await page.locator('#propertiesSummaryStats').innerText();
    const saved = await stored(page, 'JSON.stringify(state.properties)');
    check(!await note.isVisible(), 'portfolio help is not folded initially');
    await help.focus(); await page.keyboard.press('Enter');
    check(await note.isVisible() && await help.getAttribute('aria-expanded') === 'true', 'Enter did not reveal portfolio help');
    await page.keyboard.press('Space');
    check(!await note.isVisible(), 'Space did not fold portfolio help');
    for(const scheme of ['light', 'dark']){
      await page.evaluate(s => { document.documentElement.dataset.theme = s; }, scheme);
      for(const width of [320, 390, 1280]){
        await page.setViewportSize({width, height:844});
        await help.tap();
        check(await note.isVisible(), 'touch did not reveal portfolio help at ' + width + ' in ' + scheme);
        check(/Total equity:.*Net cash flow:.*Avg gross yield:/.test(await note.innerText()), 'portfolio explanations are incomplete');
        if(width < 700) check(await help.evaluate(e => { const r = e.getBoundingClientRect(), p = getComputedStyle(e, '::before'); return r.width - parseFloat(p.left) - parseFloat(p.right) >= 44 && r.height - parseFloat(p.top) - parseFloat(p.bottom) >= 44; }), 'portfolio help target is too small');
        check(await page.evaluate(w => document.documentElement.scrollWidth <= w, width), 'portfolio help overflows at ' + width);
        await help.tap();
      }
    }
    const chart = page.locator('#propertiesEquityDebtBar [role="img"]');
    check(await chart.count() === 2, 'equity and debt are not labelled chart figures');
    for(const figure of await chart.all()){
      const title = await figure.getAttribute('title');
      check(await figure.getAttribute('aria-label') === title && /^(Equity|Debt):.*%/.test(title), 'chart label does not include its value and share');
    }
    await help.tap();
    await page.evaluate(async () => { (await import('/src/components/properties.js')).renderPropertiesSummary(); });
    check(await note.isVisible(), 'summary redraw folded the explanation');
    check(await page.locator('#propertiesSummaryStats').innerText() === before, 'opening help changed portfolio figures');
    check(await stored(page, 'JSON.stringify(state.properties)') === saved, 'opening help changed saved properties');
    await page.evaluate(async () => {
      const s = await import('/src/state.js'); s.state.properties = [];
      (await import('/src/components/properties.js')).renderPropertiesSummary();
    });
    check(!await root.isVisible(), 'empty household has a portfolio summary heading');
  },
  async taxhelp(page){
    await go(page, 'tax', 'data-tax-sub', 'year');
    const root = page.locator('#taxSub-year');
    const help = root.locator('.ledgers > details:has(#taxSuperBody) > [data-help-toggle]');
    const panel = page.locator('#taxSuperBody [data-tax-person]').first();
    const person = await panel.getAttribute('data-tax-person');
    const maxHelp = panel.locator('[data-tax-maxcap-help]');
    const snapshot = await page.evaluate(async () => {
      const t = await import('/src/calc/tax.js'); return JSON.stringify(t.getTaxPeople().map(p => t.computePersonTax(p)));
    });
    check(!await maxHelp.isVisible(), 'tax help is not folded initially');
    await help.focus(); await page.keyboard.press('Enter');
    check(await maxHelp.isVisible() && await help.getAttribute('aria-expanded') === 'true', 'Enter did not reveal tax help');
    await page.keyboard.press('Space');
    check(!await maxHelp.isVisible(), 'Space did not fold tax help');
    await page.locator('[data-tax-household] > summary').click();
    for(const scheme of ['light', 'dark']){
      await page.evaluate(s => { document.documentElement.dataset.theme = s; }, scheme);
      for(const width of [320, 390, 1280]){
        await page.setViewportSize({ width, height: 844 });
        await help.tap();
        check(await maxHelp.isVisible(), 'touch did not reveal tax help at ' + width + ' in ' + scheme);
        check(await page.locator('#taxPrivateCoverHelp').isVisible(), 'household help is unavailable');
        check(await page.evaluate(w => document.documentElement.scrollWidth <= w, width), 'expanded tax help overflows at ' + width);
        const exposed = await root.locator('[data-tax-note-help]').evaluateAll(es => es.filter(e => {
          const note = e.parentElement.querySelector('.tax-' + e.dataset.taxNoteHelp + '-note');
          return note?.hidden && e.getClientRects().length;
        }).length);
        check(!exposed, 'opening help revealed an inapplicable tax note');
        // Off screen before the tap (Playwright scrolled it in beside the sticky headers): the page moved between the
        // touch and its click, as in incomehelp, and the field never got the click.
        await steadyTap(page, panel.locator('.tax-sacrifice'));
        check(await panel.locator('.tax-sacrifice').evaluate(e => e === document.activeElement), 'sacrifice field is unreachable with help open');
        await help.tap();
      }
    }
    check(await page.evaluate(async original => { const t = await import('/src/calc/tax.js'); return original === JSON.stringify(t.getTaxPeople().map(p => t.computePersonTax(p))); }, snapshot), 'opening help changed tax figures');
    const cdp = await page.context().newCDPSession(page);
    const ax = await cdp.send('Accessibility.getFullAXTree');
    check(ax.nodes.some(n => !n.ignored && /Private hospital cover/i.test(n.name?.value || '') && /not extras-only/.test(n.description?.value || '')), 'hospital cover description is absent from the accessibility tree');
    await cdp.detach();
    const before = await maxHelp.textContent();
    await page.locator('#taxSgRate').fill('13'); await page.locator('#taxSgRate').press('Tab');
    check(await maxHelp.textContent() !== before, 'live SG update left the cap explanation stale');
    const desired = await page.evaluate(async person => { const r = (await import('/src/calc/tax.js')).computePersonTax(person); return Math.max(0, Math.round(r.capAvailable - r.sg - r.autoSacrifice)); }, person);
    await panel.locator('[data-tax-maxcap]').click();
    check(await stored(page, 'state.tax.settings[' + JSON.stringify(person) + '].superSacrificeAnnual') === desired, 'Max out cap no longer saves the described amount');
    // A synthetic high-income household makes the conditional warnings present; patch down in place.
    await page.evaluate(async person => {
      const s = await import('/src/state.js'), t = await import('/src/calc/tax.js');
      s.state.income.filter(i => i.incomeType === 'Gross' && i.person === person).forEach(i => { i.amount = 500000; i.freq = 'Yearly'; });
      t.personTaxSettings(person).helpBalance = 10000;
      (await import('/src/calc/engine.js')).recalcComputedItems();
      (await import('/src/components/income.js')).renderTaxSuper();
    }, person);
    check(await panel.locator('.tax-div293-note').isVisible(), 'Division 293 warning was hidden with help');
    await help.tap();
    check(await panel.locator('[data-tax-note-help="div293"] .help').isVisible(), 'Division 293 explanation is unavailable');
    await page.evaluate(async person => {
      const s = await import('/src/state.js'), t = await import('/src/calc/tax.js');
      s.state.income.filter(i => i.incomeType === 'Gross' && i.person === person).forEach(i => { i.amount = 50000; });
      t.personTaxSettings(person).helpBalance = 0;
      (await import('/src/calc/engine.js')).recalcComputedItems();
      (await import('/src/components/income.js')).patchAllTaxPersonOutputs();
    }, person);
    check(!await panel.locator('[data-tax-note-help="div293"]').isVisible(), 'live patch left obsolete Division 293 help visible');
    check(!await panel.locator('[data-tax-note-help="help"]').isVisible(), 'live patch left obsolete HELP explanation visible');
    const bad = await root.locator('[data-seg-bar]').evaluateAll(es => es.filter(e => e.getAttribute('role') !== 'img' || e.getAttribute('aria-label') !== e.getAttribute('title')).length);
    check(!bad, 'live waterfall update lost its exact accessible values');
    const titles = await root.locator('[title]').evaluateAll(es => es.filter(e => e.getClientRects().length && e.getAttribute('title').length > 40 && e.getAttribute('role') !== 'img').map(e => e.tagName));
    check(!titles.length, 'tax help remains in native titles: ' + titles.join(', '));
  },
  async taxplanningfields(page){
    await quiet(page);
    await go(page, 'tax', 'data-tax-sub', 'year');
    await page.evaluate(() => document.querySelectorAll('#taxSuperBody details').forEach(d => { d.open = true; }));
    const panel = page.locator('#taxSuperBody [data-tax-person]').first();
    const person = await panel.getAttribute('data-tax-person');
    const setting = key => stored(page, 'state.tax.settings[' + JSON.stringify(person) + '].' + key);
    const fill = async(input,value) => { await input.fill(value); await input.press('Tab'); };
    await fill(page.locator('#taxSgRate'),'13');
    check(await stored(page,'state.tax.sgRate') === 13, 'SG rate did not save');
    await fill(page.locator('#taxSgRate'),'');
    check(await stored(page,'state.tax.sgRate') === 13 && await page.locator('#taxSgRate').getAttribute('aria-invalid') === 'true', 'blank SG rate accepted');
    await fill(page.locator('#taxSgRate'),'13');
    await page.locator('#taxPhiLine').selectOption('');
    await fill(page.locator('#taxPhiPremiums'),'2000');
    check(await stored(page,'state.tax.phiPremiums') === 2000, 'typed premiums did not save');
    const line = await page.locator('#taxPhiLine option[value]:not([value=""])').first().getAttribute('value');
    await page.locator('#taxPhiLine').selectOption(line);
    check(await stored(page,'state.tax.phiLineId') === line && await page.locator('#taxPhiPremiums').isDisabled(), 'linked premiums did not disable the modeled amount');
    await page.locator('#taxPhiTier').selectOption('2');
    check(await stored(page,'state.tax.phiTierClaimed') === 2, 'rebate tier did not save');
    await page.locator('#taxPhiLine').selectOption('');
    check(!await page.locator('#taxPhiPremiums').isDisabled() && await page.locator('#taxPhiPremiums').inputValue() === '2000', 'switching back lost typed premiums');
    const cover = await page.locator('#taxPrivateCover').isChecked();
    await page.locator('#taxPrivateCover').setChecked(!cover);
    check(await stored(page,'state.tax.privateHospitalCover') === !cover, 'hospital cover toggle did not save');
    const family = await page.locator('#taxFamilyThresholds').isChecked();
    await page.locator('#taxFamilyThresholds').setChecked(!family);
    check(await stored(page,'state.tax.familyThresholds') === !family, 'family threshold toggle did not save');
    for(const [cls,key,value] of [['tax-sacrifice','superSacrificeAnnual','2000'],['tax-topup-amt','topUpAmount','1000']]){
      const input = panel.locator('.' + cls);
      await fill(input,value);
      check(await setting(key) === Number(value), cls + ' did not save');
      await fill(input,'-100');
      check(await setting(key) === Number(value) && await input.getAttribute('aria-invalid') === 'true', cls + ' accepted negative amount');
      await fill(input,value);
    }
    for(const [cls,key,value] of [['tax-ytd-asof','asOf','2026-08-01'],['tax-ytd-gross','gross','10000'],['tax-ytd-withheld','withheld','2000']]){
      await fill(panel.locator('.' + cls),value);
      check(await setting('ytd.' + key) === (key === 'asOf' ? value : Number(value)), cls + ' did not save');
    }
    const paste = panel.locator('[data-slip-text]');
    await paste.fill('Employer A\nSample payslip text');
    await fill(panel.locator('.tax-ytd-gross'),'12000');
    check(await paste.inputValue() === 'Employer A\nSample payslip text', 'updating withholding erased payslip draft');
    check((await panel.locator('.tax-ytd-out').textContent()).trim().length > 0, 'withholding output missing');
    for(const width of [320,390,768,1024,1280]){
      await page.setViewportSize({width,height:844});
      for(const theme of ['light','dark']){
        await page.emulateMedia({colorScheme:theme === 'dark' ? 'light' : 'dark'});
        await page.evaluate(t => document.documentElement.setAttribute('data-theme',t),theme);
        const bad = await page.locator('#taxSuperBody input:not([type="checkbox"]):not([type="file"]), #taxSuperBody select, #taxSuperBody textarea').evaluateAll((es,{width,theme}) => es.filter(e => e.getClientRects().length).flatMap(e => {
          const s = getComputedStyle(e), r = e.getBoundingClientRect();
          return !e.classList.contains('field-control') || !e.labels.length || s.borderRadius !== '6px' || r.height < 44 || r.left < -1 || r.right > width + 1 ||
            (e.type === 'date' && (r.width < 150 || s.colorScheme !== theme)) || (e.type === 'number' && parseFloat(s.fontSize) < 16) ? [e.id || e.className] : [];
        }),{width,theme});
        check(!bad.length, 'Tax planning field skin/name/size/overflow at ' + width + '/' + theme + ': ' + bad.join(', '));
      }
    }
  },
  async taxreturnfields(page){
    await quiet(page);
    await go(page, 'tax', 'data-tax-sub', 'returns');
    const person = await page.locator('[data-ty-add="is"]').first().getAttribute('data-ty-person');
    const fy = await page.evaluate(async() => (await import('/src/components/taxyear.js')).taxYearSelected());
    const saved = expr => stored(page, 'state.taxYears[' + fy + '].people[' + JSON.stringify(person) + '].' + expr);
    const open = () => page.evaluate(() => document.querySelectorAll('#taxYearBody details').forEach(d => { d.open = true; }));
    for(const [kind,fields,array] of [
      ['is',{payer:'Employer A',gross:'100000',allowances:'1000',withheld:'20000',resc:'1000',rfba:'1000'},'incomeStatements'],
      ['int',{account:'Bank One',gross:'100',sharePct:'50'},'interest'],
      ['ded',{what:'Sample equipment',amount:'100'},'deductions']
    ]){
      await page.locator('[data-ty-add="' + kind + '"][data-ty-person="' + person + '"]').click();
      await open();
      for(const [key,value] of Object.entries(fields)){
        const input = page.locator('[data-ty-kind="' + kind + '"][data-ty-person="' + person + '"][data-ty-key="' + key + '"]').last();
        await input.fill(value); await input.press('Tab');
        check(await saved(array + '.slice(-1)[0].' + key) === (['payer','account','what'].includes(key) ? value : Number(value)), kind + '/' + key + ' did not save');
      }
    }
    const label = page.locator('[data-ty-kind="ded"][data-ty-person="' + person + '"][data-ty-key="label"]').last();
    await label.selectOption('D5');
    check(await saved('deductions.slice(-1)[0].label') === 'D5', 'deduction label did not save');
    const gross = page.locator('[data-ty-kind="is"][data-ty-person="' + person + '"][data-ty-key="gross"]').last();
    await gross.fill('-100'); await gross.dispatchEvent('change'); await gross.focus();
    await page.evaluate(async() => (await import('/src/components/taxyear.js')).renderTaxYear());
    check(await gross.evaluate(e => e === document.activeElement && e.value === '-100' && e.getAttribute('aria-invalid') === 'true' && !!document.getElementById(e.id + '-error').textContent), 'redraw lost invalid entry, focus or message');
    check(await saved('incomeStatements.slice(-1)[0].gross') === 100000, 'invalid gross saved');
    await gross.fill('100000'); await gross.press('Tab');
    const share = page.locator('[data-ty-kind="int"][data-ty-person="' + person + '"][data-ty-key="sharePct"]').last();
    await share.fill(''); await share.press('Tab');
    check(await saved('interest.slice(-1)[0].sharePct') == null, 'blank share did not restore whole share');
    await open();
    const rent = page.locator('[data-ty-rent]').first();
    const property = await rent.getAttribute('data-ty-rent'), key = await rent.getAttribute('data-ty-key');
    const rental = () => stored(page, 'state.taxYears[' + fy + '].properties[' + JSON.stringify(property) + '].lines[' + JSON.stringify(key) + ']');
    const estimate = await rent.getAttribute('placeholder');
    await rent.fill('10000'); await rent.press('Tab');
    check(await rental() === 10000, 'rental override did not save');
    await rent.fill(''); await rent.press('Tab');
    check(await rental() == null && await rent.getAttribute('placeholder') === estimate, 'blank rental did not restore estimate');
    for(const width of [320,390,768,1024,1280]){
      await page.setViewportSize({width,height:844});
      for(const theme of ['light','dark']){
        await page.evaluate(t => document.documentElement.setAttribute('data-theme',t), theme);
        const bad = await page.locator('#taxYearBody .ty-in, #taxYearBody .ty-rent-in').evaluateAll((es,width) => es.filter(e => e.getClientRects().length).flatMap(e => {
          const s = getComputedStyle(e), r = e.getBoundingClientRect();
          return !e.classList.contains('field-control') || s.borderRadius !== '6px' || r.height < 44 || r.left < -1 || r.right > width + 1 || (e.type === 'number' && r.width < 95) || !e.getAttribute('aria-label') ? [e.outerHTML.slice(0,150)] : [];
        }),width);
        check(!bad.length, 'Returns field size/skin/name/overflow at ' + width + '/' + theme + ': ' + bad.join(', '));
      }
    }
    // A draft belongs to its financial year; keeping focus must not copy it into another year's fields.
    await rent.focus(); await rent.evaluate(e => { e.value = '12345'; });
    await page.evaluate(async fy => (await import('/src/components/taxyear.js')).setTaxYearSelected(fy - 1), fy);
    await settle(page);
    check(await rent.inputValue() !== '12345', 'year switch carried a rental draft into a different return');
  },
  async peoplefields(page){
    await quiet(page);
    await go(page, 'tax', 'data-tax-sub', 'people');
    const card = page.locator('#peopleTable .pp-card').first();
    const person = await card.locator('.pp-name').inputValue();
    const setting = key => stored(page, '(state.tax.settings[' + JSON.stringify(person) + '] || {}).' + key);
    for(const [cls,key,value] of [
      ['pp-dob','dateOfBirth','1980-01-01'],['pp-help','helpBalance',10000],
      ['pp-cap','concessionalCap',30000],['pp-carry','carryForward',1000],
      ['pp-losses','capitalLossCarriedForward',1000],['pp-week','hoursPerWeek',40]
    ]){
      const input = card.locator('.' + cls);
      await input.fill(String(value)); await input.press('Tab');
      check(await setting(key) === value, cls + ' did not save');
    }
    const cap = card.locator('.pp-cap');
    await cap.fill('-1'); await cap.press('Tab');
    check(await setting('concessionalCap') === 30000 && await cap.getAttribute('aria-invalid') === 'true', 'negative cap accepted');
    await cap.fill('30000'); await cap.press('Tab');
    const hours = card.locator('.pp-wfh').first(), fy = await hours.getAttribute('data-fy');
    await hours.fill('200'); await hours.press('Tab');
    check(await setting('wfhHours[' + fy + ']') === 200, 'working-from-home hours did not save');
    await hours.fill(''); await hours.press('Tab');
    check(await setting('wfhHours[' + fy + ']') == null, 'blank WFH hours did not clear');
    await card.locator('.pp-week').fill(''); await card.locator('.pp-week').press('Tab');
    check(await setting('hoursPerWeek') == null, 'blank weekly hours did not restore default');
    await hours.focus();
    await page.evaluate(async() => (await import('/src/components/people.js')).renderPeople());
    check(await hours.evaluate(e => e === document.activeElement), 'People redraw lost field focus');
    for(const width of [320,390,768,1024,1280]){
      await page.setViewportSize({width,height:844});
      for(const colorScheme of ['light','dark']){
        await page.emulateMedia({colorScheme:colorScheme === 'dark' ? 'light' : 'dark'});
        await page.evaluate(theme => document.documentElement.setAttribute('data-theme', theme), colorScheme);
        const bad = await card.locator('.field-control, .inline-name').evaluateAll((es,options) => es.flatMap(e => {
          const st = getComputedStyle(e), r = e.getBoundingClientRect();
          return st.borderRadius !== '6px' || r.height < 44 || r.right > options.width + 1 || r.left < -1 ||
            (e.type === 'number' && (!e.labels.length || parseFloat(st.fontSize) < 16)) ||
            (e.type === 'date' && (st.colorScheme !== options.colorScheme || r.width < 150)) ? [e.className] : [];
        }),{width,colorScheme});
        check(!bad.length, 'People field skin/size/overflow at ' + width + '/' + colorScheme + ': ' + bad.join(', '));
      }
    }
    const linked = await stored(page, 'state.income.filter(x => x.person === ' + JSON.stringify(person) + ').length');
    await card.locator('.pp-name').fill('Sample person'); await card.locator('.pp-name').press('Tab');
    check(await stored(page, 'state.income.filter(x => x.person === "Sample person").length') === linked, 'renaming lost income references');
    check(await stored(page, 'state.tax.settings["Sample person"].concessionalCap') === 30000, 'renaming lost person settings');
    check(!await stored(page, '!!state.tax.settings[' + JSON.stringify(person) + ']'), 'renaming left old person settings');
  },
  async propertyrecordfields(page){
    await quiet(page);
    await page.evaluate(async() => {
      const s = await import('/src/state.js'), p = s.state.properties[0];
      p.loans.push({...p.loans[0], id:'sample-record-loan', what:'Sample loan with a deliberately long name', charges:[]});
      s.commit(['properties']);
    });
    await go(page, 'properties');
    const tab = async name => {
      await page.locator('[data-prop-tab][data-tab="' + name + '"]').first().evaluate(e => e.click());
      await settle(page);
    };
    const saved = key => stored(page, 'state.properties[0].' + key);
    const inspect = async selector => {
      for(const width of [320,390,768,1024,1280]){
        await page.setViewportSize({width,height:844});
        for(const colorScheme of ['light','dark']){
          await page.emulateMedia({colorScheme});
          const bad = await page.locator(selector).evaluateAll((es, width) => es.filter(e => e.getClientRects().length).flatMap(e => {
            const st = getComputedStyle(e), r = e.getBoundingClientRect();
            return !e.classList.contains('field-control') || !e.labels.length || st.borderRadius !== '6px' || r.height < 44 ||
              r.left < -1 || r.right > width + 1 || (e.type === 'number' && parseFloat(st.fontSize) < 16) ||
              (e.type === 'date' && (!st.colorScheme.includes('dark') || r.width < 150)) ||
              (e.matches('[data-pa-line]') && r.width < 120) ? [e.outerHTML.slice(0,140)] : [];
          }), width);
          check(!bad.length, 'Property record field skin/size/overflow at ' + width + '/' + colorScheme + ': ' + bad.join(', '));
        }
      }
    };
    await tab('income');
    const panel = page.locator('[data-as-panel]').first();
    await panel.locator('summary').click();
    check(await panel.locator('[data-as]').count() === 8, 'statement control count changed');
    await inspect('[data-as]');
    for(const [key,value] of Object.entries({date:'2026-08-01',rent:1000,water:100,fees:100,waterRates:50,otherAmount:50})){
      await panel.locator('[data-as="' + key + '"]').fill(String(value));
    }
    const account = await panel.locator('[data-as="account"] option').last().getAttribute('value');
    // Account options use their visible text as the value.
    const accountName = account || await panel.locator('[data-as="account"] option').last().textContent();
    await panel.locator('[data-as="account"]').selectOption({label:accountName});
    check((await panel.locator('[data-as-net]').textContent()).includes('900.00'), 'statement net preview changed');
    await panel.locator('[data-as-log]').click();
    const statement = (await saved('agentStatements')).at(-1);
    check(statement.net === 900 && statement.txIds.length === 2, 'statement did not record its net and bills');
    check(await stored(page, 'state.incomeLog.find(x => x.id === ' + JSON.stringify(statement.incomeId) + ').account') === accountName, 'statement receipt account changed');
    await tab('activity');
    const line = page.locator('[data-pa-line="' + statement.txIds[0] + '"]');
    const destination = await line.locator('option').last().getAttribute('value');
    await line.selectOption(destination);
    check(await stored(page, 'state.transactions.find(x => x.id === ' + JSON.stringify(statement.txIds[0]) + ').linkedExpenseId') === destination, 'cost-line reassignment did not save');
    const add = page.locator('.pa-add').first();
    await add.locator('summary').click();
    await add.locator('[data-pa-charge-loan]').selectOption('sample-record-loan');
    await add.locator('[data-pa-charge-date]').fill('2026-08-01');
    await add.locator('[data-pa-charge-amount]').fill('-1');
    await add.locator('[data-pa-charge-add]').click();
    check((await saved('loans[1].charges')).length === 0, 'negative interest charge saved');
    await add.locator('[data-pa-charge-amount]').fill('500');
    await add.locator('[data-pa-charge-add]').click();
    check((await saved('loans[1].charges')).at(-1).amount === 500, 'manual interest charge did not save to selected loan');
    if(!await add.evaluate(e => e.open)) await add.locator('summary').click();
    await inspect('[data-pa] .field-control');
    await tab('income');
    await panel.locator('[data-as-del="' + statement.id + '"]').click();
    check(!(await saved('agentStatements')).some(x => x.id === statement.id), 'statement removal failed');
    check(!await stored(page, 'state.incomeLog.some(x => x.id === ' + JSON.stringify(statement.incomeId) + ')'), 'statement removal left its income receipt');
    check(!await stored(page, 'state.transactions.some(x => ' + JSON.stringify(statement.txIds) + '.includes(x.id))'), 'statement removal left its bills');
  },
  async propertytoolsfields(page){
    await quiet(page);
    await page.evaluate(async() => {
      const s = await import('/src/state.js'), p = s.state.properties[0];
      p.loans[0].fixedUntil = '2028-01-01';
      p.loans.push({...p.loans[0], id:'sample-second-loan', what:'Sample second loan with a deliberately long name', balance:100000, fixedUntil:''});
      s.commit(['properties']);
    });
    await go(page, 'properties');
    await click(page, '[data-prop-edit]');
    const saved = key => stored(page, 'state.properties[0].' + key);
    const actual = await saved('loans.map(l => ({balance:l.balance,rate:l.rate}))');
    const value = await saved('value');
    const tab = async (name, sections) => {
      await page.locator('[data-prop-tab][data-tab="' + name + '"]').first().evaluate(e => e.click());
      for(const section of sections){
        const toggle = page.locator('.prop-tab-panel:not([hidden]) [data-prop-section-toggle="' + section + '"]');
        if(await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();
      }
      await settle(page);
    };
    const inspect = async selector => {
      for(const width of [320,390,768,1024,1280]){
        await page.setViewportSize({width,height:844});
        for(const colorScheme of ['light','dark']){
          await page.emulateMedia({colorScheme});
          const bad = await page.locator(selector).evaluateAll((es, viewportWidth) => es.filter(e => e.getClientRects().length).flatMap(e => {
            const st = getComputedStyle(e), r = e.getBoundingClientRect();
            return !e.classList.contains('field-control') || !e.labels.length || st.borderRadius !== '6px' || r.height < 44 ||
              r.left < -1 || r.right > viewportWidth + 1 ||
              (e.type === 'number' && parseFloat(st.fontSize) < 16) ||
              (e.type === 'date' && !st.colorScheme.includes('dark')) ? [e.outerHTML.slice(0,140)] : [];
          }), width);
          check(!bad.length, 'Property tool skin/size/overflow at ' + width + '/' + colorScheme + ': ' + bad.join(', '));
        }
      }
    };
    await tab('loans', ['loans','strategy']);
    await page.locator('[data-strategy-pick]').selectOption('1');
    check(await saved('strategyLoan') === 1, 'strategy loan choice did not save');
    for(const [key,value] of Object.entries({extra:500,offsetAdd:10000,newRate:5,refiRate:4,refiCosts:1000,cashback:500})){
      const field = page.locator('[data-strategy-field="' + key + '"]');
      await field.fill(String(value)); await field.press('Tab');
      check(await saved('loans[1].strategy.' + key) === value, 'strategy ' + key + ' did not save');
    }
    const extra = page.locator('[data-strategy-field="extra"]');
    await extra.fill('-1'); await extra.press('Tab');
    check(await saved('loans[1].strategy.extra') === 500 && await extra.getAttribute('aria-invalid') === 'true', 'negative strategy amount accepted');
    await extra.fill(''); await extra.press('Tab');
    check(await saved('loans[1].strategy.extra') == null, 'blank strategy did not restore no extra repayment');
    const fixed = page.locator('[data-fixed-whatif]').first();
    const fixedKey = await fixed.getAttribute('data-fixed-whatif');
    await fixed.fill('8');
    check(await page.evaluate(async key => (await import('/src/components/properties.js')).fixedWhatIf[key] === 8, fixedKey), 'fixed-rate what-if did not update');
    check(await fixed.evaluate(e => e === document.activeElement), 'fixed-rate redraw lost focus');
    await inspect('[data-strategy-field], [data-strategy-pick], [data-fixed-whatif]');
    await tab('sale', ['sale']);
    for(const [key,value] of Object.entries({date:'2028-01-01',price:700000,agentPct:2,otherCosts:1000})){
      const field = page.locator('[data-sale-field="' + key + '"]');
      await field.fill(String(value)); await field.press('Tab');
      check(await saved('saleWhatIf.' + key) === value, 'sale assumption ' + key + ' did not save');
    }
    const agent = page.locator('[data-sale-field="agentPct"]');
    await agent.fill('11'); await agent.press('Tab');
    check(await saved('saleWhatIf.agentPct') === 2 && await agent.getAttribute('aria-invalid') === 'true', 'out-of-range sale fee accepted');
    await agent.fill('2'); await agent.press('Tab');
    const price = page.locator('[data-sale-field="price"]');
    await price.fill(''); await price.press('Tab');
    check(await saved('saleWhatIf.price') == null, 'blank sale price did not restore estimate');
    await inspect('[data-sale-field]');
    check(JSON.stringify(await saved('loans.map(l => ({balance:l.balance,rate:l.rate}))')) === JSON.stringify(actual) && await saved('value') === value,
      'what-if controls changed actual loan/property figures');
  },
  async propertyincomefields(page){
    await quiet(page);
    await go(page, "properties");
    await click(page, "[data-prop-edit]");
    await page.locator('[data-prop-tab][data-tab="income"]').first().evaluate(e => e.click());
    for(const section of ['income','expenses']){
      const toggle = page.locator('.prop-tab-panel:not([hidden]) [data-prop-section-toggle="' + section + '"]');
      if(await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();
    }
    const saved = key => stored(page, "state.properties[0]." + key);
    const fee = page.locator('.prop-pmfee-percent').first();
    const before = await saved('pmFee.percent');
    await fee.fill('101'); await fee.press('Tab');
    check(await saved('pmFee.percent') === before && await fee.getAttribute('aria-invalid') === 'true', "invalid manager fee was accepted");
    await fee.fill('2'); await fee.press('Tab');
    check(await saved('pmFee.percent') === 2, "manager percentage did not save");
    const flat = page.locator('.prop-pmfee-flat').first();
    await flat.fill('10'); await flat.press('Tab');
    check(await saved('pmFee.flat') === 10, "flat manager fee did not save");
    await page.locator('.prop-income-paid-freq').first().selectOption('Weekly');
    check(await saved('incomePaidFreq') === 'Weekly', "receipt frequency did not save");
    const next = page.locator('[data-rent-next]').first();
    await next.fill('2028-01-01'); await next.press('Tab');
    check(await saved('nextRentReview') === '2028-01-01', "rent review date did not save");
    await page.locator('[data-rent-new]').first().fill('600');
    await page.locator('[data-rent-review]').first().click();
    check(await saved('income[0].amount') === 600 && (await saved('rentReviews')).at(-1).to === 600, "rent review did not update rent/history");
    const count = (await saved('vacancies') || []).length;
    await page.locator('[data-vac-from]').first().fill('2026-01-01');
    await page.locator('[data-vac-to]').first().fill('2026-02-01');
    await page.locator('[data-vac-add]').first().click();
    const vacancy = (await saved('vacancies')).at(-1);
    check((await saved('vacancies')).length === count + 1 && vacancy.from === '2026-01-01' && vacancy.to === '2026-02-01', "vacancy did not save");
    const controls = '.prop-pmfee-panel .field-control, .prop-income-paid-freq, [data-rent-next], [data-rent-new], [data-vac-from], [data-vac-to]';
    for(const width of [320,390,768,1024,1280]){
      await page.setViewportSize({width,height:844});
      for(const colorScheme of ['light','dark']){
        await page.emulateMedia({colorScheme});
        const bad = await page.locator(controls).evaluateAll(es => es.filter(e => e.getClientRects().length).flatMap(e => {
          const st = getComputedStyle(e), rect = e.getBoundingClientRect();
          return !e.classList.contains('field-control') || !e.labels.length || st.borderRadius !== '6px' || rect.height < 44 ||
            rect.right > innerWidth + 1 || rect.left < -1 ||
            (e.type === 'number' && parseFloat(st.fontSize) < 16) ||
            (e.type === 'date' && (!st.colorScheme.includes('dark') || rect.width < 150)) ? [e.outerHTML.slice(0,120)] : [];
        }));
        check(!bad.length, "income control skin/size/overflow at " + width + "/" + colorScheme + ": " + bad.join(', '));
      }
    }
  },
  async propertyoverviewfields(page){
    await quiet(page);
    await go(page, "properties");
    await click(page, "[data-prop-edit]");
    for(const section of ["value", "ownership"]){
      const toggle = page.locator('.prop-tab-panel:not([hidden]) [data-prop-section-toggle="' + section + '"]');
      if(await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();
    }
    const panel = '.prop-tab-panel:not([hidden]) ';
    const saved = key => stored(page, "state.properties[0]." + key);
    await page.locator(panel + '.prop-value').fill('600000');
    check(await saved('value') === 600000, "current value did not save");
    const date = page.locator(panel + '.prop-purchase-date');
    await date.fill('2020-01-01'); await date.press('Tab');
    check(await saved('purchaseDate') === '2020-01-01', "purchase date did not save");
    const region = page.locator(panel + '.prop-state');
    await region.selectOption('Other');
    check(await saved('state') === 'Other', "land-tax state did not save");
    await region.focus();
    await page.evaluate(async() => (await import('/src/components/properties.js')).renderProperties());
    check(await region.evaluate(e => e === document.activeElement), "overview redraw lost focus");
    for(const width of [320,390,768,1024,1280]){
      await page.setViewportSize({width,height:844});
      for(const colorScheme of ['light','dark']){
        await page.emulateMedia({colorScheme});
        const bad = await page.locator(panel + '.calc-field > input, ' + panel + '.calc-field > select').evaluateAll(es => es.filter(e => e.getClientRects().length).flatMap(e => {
          const style = getComputedStyle(e), rect = e.getBoundingClientRect();
          return !e.classList.contains('field-control') || style.borderRadius !== '6px' || rect.height < 44 ||
            rect.left < -1 || rect.right > innerWidth + 1 ||
            (e.type === 'number' && parseFloat(style.fontSize) < 16) ||
            (e.type === 'date' && !style.colorScheme.includes('dark')) ? [e.className] : [];
        }));
        check(!bad.length, "overview field size/skin/overflow at " + width + "/" + colorScheme + ": " + bad.join(', '));
      }
    }
  },
  // #254: the scenario purchase and invest calculators on the shared skin. Saves and validation are calcvalidation's;
  // this is how the fields look and are named, everywhere a phone or tablet can show them.
  async scenariocalcfields(page){
    await go(page, "plan", "data-plan-sub", "scenarios");
    const name = await page.evaluate(() => [...document.querySelectorAll("#cards [data-edit-scenario]")].map(b => b.getAttribute("data-edit-scenario"))
      .find(n => { const c = document.querySelector('#cards [data-edit-scenario="' + n + '"]').closest(".card"); return c && /buy/i.test(c.innerText); }));
    check(!!name, "no buying scenario in the demo household");
    await click(page, '#cards [data-edit-scenario="' + name + '"]'); await until(page, () => document.body.getAttribute("data-current-page") === "scenario"); await settle(page);
    await click(page, "[data-sc-calc]"); await until(page, () => document.body.getAttribute("data-current-page") === "calc"); await settle(page);
    const P = "#calcScenarioBody [data-calc-scenario] ", I = "#calcScenarioBody [data-invest-scenario] ";
    await page.locator(P + ".calc-price").waitFor({ state: "visible" });
    // Every field shows in one of two states: buying (the typed stamp duty of a state with no table), then investing
    // instead (turning that on turns buying off), with its manual amount.
    const sizes = async which => {
      for(const width of [320, 390, 768, 1024, 1280]){
        await page.setViewportSize({ width, height: 844 });
        for(const colorScheme of ["light", "dark"]){
          await page.emulateMedia({ colorScheme });
          const bad = await page.locator("#calcScenarioBody input:not([type=checkbox]), #calcScenarioBody select").evaluateAll(es => {
            const panel = el => el.closest("[data-calc-scenario], [data-invest-scenario]");
            return es.filter(e => panel(e) && e.getClientRects().length).flatMap(e => {
              const style = getComputedStyle(e), rect = e.getBoundingClientRect(), named = (e.labels && e.labels.length) || e.getAttribute("aria-label");
              const wrong = [];
              if(!e.classList.contains("field-control")) wrong.push("skin");
              if(style.borderTopLeftRadius !== "6px") wrong.push("radius " + style.borderTopLeftRadius);
              if(rect.height < 44) wrong.push("height " + Math.round(rect.height));
              if(rect.left < -1 || rect.right > innerWidth + 1) wrong.push("off screen");
              if(e.tagName === "INPUT" && parseFloat(style.fontSize) < 16) wrong.push("text " + style.fontSize);
              if(!named) wrong.push("no name");
              // Only the grid's own fields have a visible label to tie; a cost row's are named by aria-label.
              if(e.closest(".calc-field") && !(e.labels && e.labels.length)) wrong.push("label not tied");
              return wrong.length ? [e.className.split(" ")[0] + ": " + wrong.join(", ")] : [];
            });
          });
          check(!bad.length, which + " fields at " + width + "/" + colorScheme + ": " + bad.join("; "));
          if(which !== "buying") continue;
          const quote = await page.locator(P + ".calc-lmi-quote").evaluate(e => {
            const cs = getComputedStyle(e), c = document.createElement("canvas").getContext("2d");
            c.font = cs.fontSize + " " + cs.fontFamily;
            return e.clientWidth >= c.measureText(e.placeholder).width + parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
          });
          check(quote, "the LMI quote's placeholder is cut off at " + width + "/" + colorScheme);
        }
      }
      await page.setViewportSize({ width: 390, height: 844 });
    };
    // A click on a label puts the caret in its field.
    const labelFocuses = async (label, field) => {
      await page.locator(label).scrollIntoViewIfNeeded(); await page.locator(label).click();
      check(await page.evaluate(f => document.activeElement && document.activeElement.matches(f), field), label + " didn't focus " + field);
    };
    await page.locator(P + ".calc-state").selectOption("Other");
    await page.locator(P + ".calc-manual-stampduty").waitFor({ state: "visible" });
    await labelFocuses(P + 'label[for$="-term"]', ".calc-term");
    await sizes("buying");
    await page.evaluate(s => document.querySelector(s).click(), I + ".invest-enabled");
    await page.locator(I + ".invest-contribmode").waitFor({ state: "visible" });
    await page.locator(I + ".invest-contribmode").selectOption("manual");
    await page.locator(I + ".invest-manual-amount").waitFor({ state: "visible" });
    await labelFocuses(I + 'label[for$="-initial"]', ".invest-initial");
    await sizes("investing");
  },
  // #254: the scenario editor's own fields — the inline name, the note, the quick-add row, the cash-draw picker, every
  // kind of change's fields and an amount change — and the "What are you weighing?" questions.
  async scenariofields(page){
    await go(page, "plan", "data-plan-sub", "scenarios");
    const name = await page.evaluate(() => [...document.querySelectorAll("#cards [data-edit-scenario]")].map(b => b.getAttribute("data-edit-scenario"))
      .find(n => { const c = document.querySelector('#cards [data-edit-scenario="' + n + '"]').closest(".card"); return c && /buy/i.test(c.innerText); }));
    check(!!name, "no buying scenario in the demo household");
    await click(page, '#cards [data-edit-scenario="' + name + '"]'); await until(page, () => document.body.getAttribute("data-current-page") === "scenario"); await settle(page);
    const E = "#page-scenario ";
    const kinds = await page.evaluate(() => { document.querySelector("[data-sc-addsheet]").click();
      return [...document.querySelectorAll("#addChangeRoot [data-sc-new]")].filter(b => !b.disabled).map(b => b.getAttribute("data-sc-new")); });
    await page.keyboard.press("Escape"); await until(page, () => !document.querySelector("#addChangeRoot [data-sc-new]"));
    check(kinds.length >= 5, "the add sheet offered " + kinds.length + " kinds of change");
    for(const kind of kinds){
      await click(page, E + "[data-sc-addsheet]");
      await page.locator('#addChangeRoot [data-sc-new="' + kind + '"]').click();
      await until(page, () => !document.querySelector("#addChangeRoot [data-sc-new]")); await settle(page);
    }
    // A line that costs a different amount, from the quick-add row.
    const row = await page.evaluate(s => [...document.querySelector(s).options].map(o => o.value).find(Boolean), E + "[data-sc-row]");
    await page.locator(E + "[data-sc-row]").selectOption(row);
    await page.locator(E + "[data-sc-new-amount]").fill("123");
    await click(page, E + "[data-sc-add]");
    await page.locator(E + "[data-sc-amount]").first().waitFor({ state: "visible" });
    // An unusual deposit is still marked on its field, and saved to the draft as typed.
    const dep = page.locator(E + '[data-scf="depositPct"]').first();
    await dep.fill("2"); await dep.press("Tab");
    await until(page, s => !!document.querySelector(s).closest(".scf.is-odd"), E + '[data-scf="depositPct"]');
    check(await page.evaluate(s => { const e = document.querySelector(s); return !!e.closest(".scf.is-odd") && getComputedStyle(e).borderTopColor === getComputedStyle(document.querySelector(".scf-odd")).color; }, E + '[data-scf="depositPct"]'),
      "an unusual deposit isn't marked on its field");
    const fields = async (root, where) => {
      for(const width of [320, 390, 768, 1024, 1280]){
        await page.setViewportSize({ width, height: 844 });
        for(const colorScheme of ["light", "dark"]){
          await page.emulateMedia({ colorScheme });
          await page.evaluate(r => document.querySelectorAll(r + " details").forEach(d => { d.open = true; }), root);
          // A sheet rises into place on a phone: measured mid-way, its transform shrinks what's in it.
          await page.evaluate(r => Promise.all(document.querySelector(r).getAnimations({ subtree: true }).map(a => a.finished.catch(() => {}))), root);
          const bad = await page.locator(root + " input:not([type=checkbox]):not([type=radio]):not([type=range]), " + root + " select, " + root + " textarea").evaluateAll(es => es.filter(e => e.getClientRects().length).flatMap(e => {
            const style = getComputedStyle(e), rect = e.getBoundingClientRect(), wrong = [], inline = e.classList.contains("inline-name");
            if(!e.classList.contains("field-control") && !inline) wrong.push("skin");
            if(style.borderTopLeftRadius !== "6px") wrong.push("radius " + style.borderTopLeftRadius);
            if(rect.height < 44) wrong.push("height " + Math.round(rect.height));
            if(rect.left < -1 || rect.right > document.documentElement.clientWidth + 1) wrong.push("off screen");
            if(e.tagName !== "SELECT" && parseFloat(style.fontSize) < 16) wrong.push("text " + style.fontSize);
            if(!((e.labels && e.labels.length) || e.getAttribute("aria-label"))) wrong.push("no name");
            return wrong.length ? [(e.getAttribute("data-scf") || e.getAttribute("data-sq") || e.className.split(" ")[0] || e.tagName) + ": " + wrong.join(", ")] : [];
          }));
          check(!bad.length, where + " fields at " + width + "/" + colorScheme + ": " + bad.join("; "));
        }
      }
      await page.setViewportSize({ width: 390, height: 844 });
    };
    await fields("#page-scenario", "scenario editor");
    // The questions a template asks, in the "Add scenario" sheet.
    await click(page, E + "[data-sc-cancel]");
    await until(page, () => document.body.getAttribute("data-current-page") !== "scenario");
    if(await page.locator(".app-dialog").count()) await answerDialog(page, true);
    await go(page, "plan", "data-plan-sub", "scenarios");
    await click(page, "#addScenarioBtn");
    await page.locator('#startSheetRoot [data-sq-pick="buyHome"]').click();
    await page.locator('#startSheetRoot [data-sq="price"]').waitFor({ state: "visible" });
    await fields("#startSheetRoot", "template");
  },
  // #254: the first-run setup sheet, which only an empty household sees — every step's fields on the shared skin.
  async setupfields(page){
    await page.evaluate(async () => {
      const s = await import('/src/state.js'); s.setState(s.defaultState());
      (await import('/src/calc/engine.js')).recalcComputedItems();
      (await import('/src/components/redraw.js')).renderAll();
    });
    await go(page, 'dashboard');
    await click(page, '#dashboardSetup [data-firstrun-open]');
    const R = '#firstRunRoot ';
    await page.locator(R + '[role="dialog"]').waitFor();
    const sizes = async step => {
      for(const width of [320, 390, 768, 1024, 1280]){
        await page.setViewportSize({ width, height: 844 });
        for(const colorScheme of ['light', 'dark']){
          await page.emulateMedia({ colorScheme });
          // A sheet rises into place on a phone: measured mid-way, its transform shrinks what's in it.
          await page.evaluate(r => Promise.all(document.querySelector(r).getAnimations({ subtree: true }).map(a => a.finished.catch(() => {}))), '#firstRunRoot');
          const bad = await page.locator(R + 'input:not([type=checkbox]), ' + R + 'select').evaluateAll(es => es.filter(e => e.getClientRects().length).flatMap(e => {
            const style = getComputedStyle(e), rect = e.getBoundingClientRect(), wrong = [];
            if(!e.classList.contains('field-control')) wrong.push('skin');
            if(style.borderTopLeftRadius !== '6px') wrong.push('radius ' + style.borderTopLeftRadius);
            if(rect.height < 43.5) wrong.push('height ' + Math.round(rect.height));
            if(rect.left < -1 || rect.right > document.documentElement.clientWidth + 1) wrong.push('off screen');
            if(e.tagName === 'INPUT' && parseFloat(style.fontSize) < 16) wrong.push('text ' + style.fontSize);
            if(!(e.labels && e.labels.length) && !e.getAttribute('aria-label')) wrong.push('no name');
            return wrong.length ? [(e.getAttribute('data-fr') || e.tagName) + ': ' + wrong.join(', ')] : [];
          }));
          check(!bad.length, 'setup step ' + step + ' at ' + width + '/' + colorScheme + ': ' + bad.join('; '));
        }
      }
      await page.setViewportSize({ width: 390, height: 844 });
    };
    await sizes(1);
    await page.locator(R + '[data-fr="people.0.name"]').fill('Alex');
    await click(page, R + '[data-fr-next]'); await sizes(2);
    await click(page, R + '[data-fr-next]'); await sizes(3);
    await click(page, R + '[data-fr-next]'); await sizes(4);
    // A typed figure stays when a select beside it redraws the step.
    await page.locator(R + '[data-fr="housing.amount"]').fill('450');
    await page.locator(R + '[data-fr="housing.freq"]').selectOption('Fortnightly');
    check(await page.locator(R + '[data-fr="housing.amount"]').inputValue() === '450', "the rent typed was lost when its frequency changed");
    await click(page, R + '[data-fr-next]');
    await click(page, R + '[data-fr-finish="home"]');
    await until(page, () => !document.querySelector('#firstRunRoot [role="dialog"]'));
    const rent = await st(page, '(state.shared || []).filter(function(l){ return /rent/i.test(l.what || ""); }).map(function(l){ return [Number(l.amount), l.freq]; })[0]');
    check(!!rent && rent[0] === 450 && rent[1] === 'Fortnightly', 'setup saved the rent as ' + JSON.stringify(rent));
    check(await st(page, 'state.firstRunDone') === true, 'setup did not finish');
  },
  // #309: what a person starting from scratch meets, from an empty household's first load to a saved pay row.
  async firstrunpath(page){
    // An empty household, loaded the way "Start from scratch" opens it (no ?mock): the setup sheet opens by itself.
    await emptyHousehold(page);
    const R = '#firstRunRoot ';
    await page.locator(R + '[role="dialog"]').waitFor();
    const onScreen = sel => page.locator(sel).evaluateAll(es => es.filter(e => e.getClientRects().length && !e.closest('[hidden]')).length);
    let counts = await progressCounts(page);
    check(counts.length === 1 && /Step 1 of 5/.test(counts[0]), 'on arrival: ' + counts.join(' · '));
    check(await onScreen('#dashboardSetup .setup-head') === 0, 'the first month showed beside the open setup sheet');
    // Skipped: the first month, its one count, one offer of sample data and one way back into setup.
    await page.locator(R + '[data-fr-close]').click();
    await until(page, () => !document.querySelector('#firstRunRoot [role="dialog"]'));
    await page.locator('#dashboardSetup .setup-head').waitFor();
    counts = await progressCounts(page);
    check(counts.length === 1, 'after skipping, ' + counts.length + ' progress counts: ' + counts.join(' · '));
    const sample = await page.evaluate(() => [...document.querySelectorAll('.app-page:not([hidden]) button, .app-page:not([hidden]) a, #dashboardIntro')]
      .filter(e => e.getClientRects().length && /sample/i.test(e.textContent)).length);
    check(sample === 1, 'sample data is offered ' + sample + ' times on Home');
    check(await onScreen('.app-page:not([hidden]) [data-firstrun-open]') === 1, 'skipping setup did not leave one way back into it');
    // Nothing entered: no $0 cards and nothing to do.
    const zeros = await page.evaluate(() => [...document.querySelectorAll('[data-home-card]')].filter(c => c.getClientRects().length && /\$0\b/.test(c.innerText)).map(c => c.getAttribute('data-home-card')));
    check(!zeros.length, 'cards showing $0 for an empty household: ' + zeros.join(', '));
    check(await onScreen('[data-home-card="needs"] .home-todo-btn') === 0, 'an empty household was given to-dos');
    check(await onScreen('[data-home-card="month"] [data-go="expenses/income"]') === 1, "the empty month doesn't offer its next step");
    // Back in, from the one way back: the sheet, and its count alone again; through to a first pay row.
    await click(page, '#dashboardSetup [data-firstrun-open]');
    await page.locator(R + '[role="dialog"]').waitFor();
    counts = await progressCounts(page);
    check(counts.length === 1, 'setup reopened with ' + counts.length + ' progress counts: ' + counts.join(' · '));
    await page.locator(R + '[data-fr="people.0.name"]').fill('Alex');
    await click(page, R + '[data-fr-next]'); await click(page, R + '[data-fr-next]');
    await page.locator(R + '[data-fr="people.0.pay"]').fill('60000');
    await click(page, R + '[data-fr-next]'); await click(page, R + '[data-fr-next]');
    await click(page, R + '[data-fr-finish="home"]');
    await until(page, () => !document.querySelector('#firstRunRoot [role="dialog"]'));
    check(await st(page, 'state.income.length') > 0, 'finishing setup saved no pay');
    counts = await progressCounts(page);
    check(counts.length <= 1, 'after finishing, ' + counts.length + ' progress counts: ' + counts.join(' · '));
    // Reset everything: nothing opens the sheet, so the first month's Guided setup has to be there.
    await page.locator('#avatarBtn').click();
    await page.locator('#resetBtn').click();
    await answerDialog(page, true);
    await until(page, () => !!document.querySelector('#dashboardSetup [data-firstrun-open]'));
    check(await onScreen('#dashboardSetup [data-firstrun-open]') === 1, 'after Reset, there was no way into setup');
  },
  // #255 step 4: Spending's explanations work by keyboard and touch; charts keep accessible values.
  async spendinghelp(page){
    await go(page, 'expenses', 'data-expenses-sub', 'spending');
    const help = page.locator('#bankImportCard > [data-help-toggle]');
    const note = page.locator('#bankImportCard .help').first();
    await help.waitFor();
    check(!await note.isVisible(), 'bank import help is not folded initially');
    await help.focus(); await page.keyboard.press('Enter');
    check(await note.isVisible(), 'Enter did not reveal bank import help');
    check(await help.getAttribute('aria-expanded') === 'true', 'help did not announce expanded');
    check((await note.textContent()).includes('PDF statement'), 'bank format explanation was lost');
    await page.keyboard.press('Space');
    check(!await note.isVisible(), 'Space did not fold bank import help');
    await help.tap();
    check(await note.isVisible(), 'touch did not reveal bank import help');
    await help.tap();
    for(const scheme of ['light', 'dark']){
      await page.evaluate(s => { document.documentElement.dataset.theme = s; }, scheme);
      for(const width of [320, 390, 1280]){
        await page.setViewportSize({ width, height: 844 });
        const bounds = await help.boundingBox();
        check(!!bounds && bounds.width > 0 && bounds.height > 0, 'help disappeared at ' + width);
        await help.tap();
        check(await note.isVisible(), 'help is unreachable at ' + width + ' in ' + scheme);
        await help.tap();
        check(await page.evaluate(w => document.documentElement.scrollWidth <= w, width), 'Spending overflow at ' + width);
      }
    }
    check(await page.locator('#expensesSub-spending [role=img][aria-label]').count() > 0, 'sample spending drew no accessible figures');
    const badFigures = await page.locator('#expensesSub-spending .rule-seg.cat-seg, #expensesSub-spending .year-cat-bar').evaluateAll(es =>
      es.filter(e => e.getAttribute('role') !== 'img' || !e.getAttribute('aria-label') || e.getAttribute('aria-label') !== e.getAttribute('title')).length);
    check(badFigures === 0, 'chart figures are missing their exact accessible values');
    const cdp = await page.context().newCDPSession(page);
    const ax = await cdp.send('Accessibility.getFullAXTree');
    check(ax.nodes.some(n => !n.ignored && n.role?.value === 'image' && /by month:/.test(n.name?.value || '')), 'spending history values are absent from the accessibility tree');
    await cdp.detach();
    const preference = await page.evaluate(async () => {
      const h = await import('/src/lib/help.js'); h.setShowHelp(true);
      const note = document.querySelector('#bankImportCard .help');
      const shown = !!note.getClientRects().length;
      h.setShowHelp(false); return shown;
    });
    check(preference, 'Show help preference no longer reveals the explanation');
  },
  // #255 step 3: an empty state's next step works, of each kind, in an empty household.
  async emptystates(page){
    await emptyHousehold(page);
    await page.locator('#firstRunRoot [data-fr-close]').click();
    await until(page, () => !document.querySelector('#firstRunRoot [role="dialog"]'));
    const at = () => page.evaluate(() => {
      const p = document.body.getAttribute('data-current-page'), pick = sel => { const a = document.querySelector(sel); return a ? a.getAttribute(sel.match(/\[([a-z-]+)\]/)[1]) : null; };
      return p + '/' + (pick('#expensesSubnav [data-expenses-sub][aria-current="page"]') || pick('#taxSubnav [data-tax-sub][aria-current="page"]') || '');
    });
    // A link: Tax → Returns has no one to make a return for yet, and goes to Income to add them.
    await go(page, 'tax', 'data-tax-sub', 'returns');
    await click(page, '#page-tax .empty-state [data-go="expenses/income"]');
    // #427: Income is Money in, the top of Budget — the link lands there, with it in view.
    await until(page, () => document.body.getAttribute('data-current-page') === 'expenses' && !!document.querySelector('[data-expenses-sub="budget"][aria-current="page"]'));
    check((await at()) === 'expenses/budget', 'Tax → Returns went to ' + await at() + ', not Money → Budget');
    await until(page, () => { const r = document.getElementById('moneyIn').getBoundingClientRect(); return r.top >= -2 && r.top < innerHeight / 2; });
    // The page's own add: Spending's opens quick log, Accounts' a new account, People's a new person.
    await go(page, 'expenses', 'data-expenses-sub', 'spending');
    await click(page, '#page-expenses .empty-state [data-empty-add="#quickLogBtn"]');
    await page.locator('#quickLogRoot [role="dialog"]').waitFor();
    await page.keyboard.press('Escape');
    await until(page, () => !document.querySelector('#quickLogRoot [role="dialog"]'));
    await go(page, 'accounts');
    const accounts = await st(page, '(state.accounts || []).length');
    await click(page, '#page-accounts .empty-state [data-empty-add="#addAccountBtn"]');
    await eventually(async () => await st(page, '(state.accounts || []).length') > accounts);
    check(await st(page, '(state.accounts || []).length') === accounts + 1, '+ Add account in the empty state added no account');
    await go(page, 'tax', 'data-tax-sub', 'people');
    await click(page, '#page-tax .empty-state [data-empty-add="#addPersonBtn"]');
    await answerDialog(page, true, 'Alex');
    await until(page, () => /Alex/.test(document.getElementById('page-tax').innerText));
    check(/Alex/.test(await page.locator('#page-tax').innerText()), '+ Add person in the empty state added no one');
    // A scroll: the trim card's "budget lines" are above it, and the link brings them into view.
    await go(page, 'expenses', 'data-expenses-sub', 'budget');
    await page.evaluate(() => { const c = document.getElementById('trimCard'); if(c){ c.open = true; c.scrollIntoView(); } });
    await until(page, () => document.querySelector('.app-topbar').classList.contains('is-compact'));
    await page.evaluate(async () => { await Promise.all(document.querySelector('.app-topbar').getAnimations({ subtree: true }).map(a => a.finished.catch(() => {}))); });
    // Inspect the completed scroll. Watching for a transient position let the journey pass while the
    // list was still moving, even though it ended behind the sticky header (or above the viewport).
    // Done is this scroll moved and then still — not the next scrollend, which can be the trim card's own instant
    // scroll just above arriving late on a loaded machine (forced, it measured before the list had moved).
    // Forced: something above the list shrinks by 60px while the page moves, and 40px more after it has stopped (on CI
    // it ended short twice). Where it lands is checked against the headers as they are then.
    await page.evaluate(() => {
      const y = scrollY, list = document.getElementById('sharedGroups'), sec = list.closest('details.ledger'), sum = sec && sec.querySelector(':scope > summary');
      window.__emptyClick = { open: !!(sec && sec.open), sticky: !!sum && getComputedStyle(sum).position === 'sticky', summary: sum ? Math.round(sum.getBoundingClientRect().height) : 0, header: document.querySelector('.app-topbar').offsetHeight };
      const spacer = document.createElement('div'); spacer.style.height = '60px'; list.before(spacer);
      // Done is a scrollend from this scroll (it has moved), then still — a pause partway isn't the end on a slow runner.
      window.__emptyEnded = false;
      const ended = () => { if(scrollY !== y){ window.__emptyEnded = true; removeEventListener('scrollend', ended); } };
      addEventListener('scrollend', ended);
      document.querySelector('#trimCard .empty-state [data-empty-scroll]').click();
      // ...and again after the scroll has ended (as on CI: right at the click, ended normally, short afterwards).
      setTimeout(() => spacer.remove(), 60);
      const late = document.createElement('div'); late.style.height = '40px'; list.before(late);
      setTimeout(() => late.remove(), 700);
    });
    const clickedAt = performance.now();
    await page.waitForFunction(() => window.__emptyEnded, null, { timeout: 5000 });
    // The app looks again for 2s after the click; measure what it leaves. (Real time: the page's clock is fixed.)
    await page.waitForTimeout(Math.max(0, 2300 - (performance.now() - clickedAt)));
    await pageStill(page);
    const position = await page.evaluate(() => {
      const target = document.getElementById('sharedGroups'), r = target.getBoundingClientRect(), h = document.querySelector('.app-topbar').getBoundingClientRect();
      const summary = target.closest('details.ledger').querySelector(':scope > summary');
      const sectionBottom = getComputedStyle(summary).position === 'sticky' ? summary.getBoundingClientRect().bottom : 0;
      return { top: r.top, headerBottom: Math.max(h.bottom, sectionBottom), height: innerHeight, y: scrollY };
    });
    check(position.top >= position.headerBottom && position.top < position.height / 2, 'the budget lines did not clear the sticky header after scrolling: ' + JSON.stringify(position) + ' — at the click: ' + JSON.stringify(await page.evaluate(() => window.__emptyClick)));
    // A report with nothing to show: what it needs, and the way there — no table of $0.
    await go(page, 'reports', 'data-report', 'cashflow');
    check(!await page.locator('#reportSheet .rp-table').count(), 'an empty Monthly cash flow drew its table');
    check(/needs money in and out/.test(await page.locator('#reportSheet .empty-state').innerText()), "an empty report doesn't say what it needs");
    await click(page, '#reportSheet .empty-state [data-go="expenses/spending"]');
    await until(page, () => document.body.getAttribute('data-current-page') === 'expenses' && !!document.querySelector('[data-expenses-sub="spending"][aria-current="page"]'));
    check((await at()) === 'expenses/spending', 'the report went to ' + await at() + ', not Spending');
  },
  async propertycostfields(page){
    await quiet(page);
    await go(page, "properties");
    await click(page, "[data-prop-edit]");
    const tab = async (name, section) => {
      await page.locator('[data-prop-tab][data-tab="' + name + '"]').first().evaluate(e => e.click());
      const toggle = page.locator('.prop-tab-panel:not([hidden]) [data-prop-section-toggle="' + section + '"]');
      if(await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();
      await settle(page);
    };
    const saved = key => stored(page, "state.properties[0]." + key);
    await tab("overview", "acquisition");
    const amount = page.locator('.prop-tab-panel:not([hidden]) .cc-amount').first();
    const amountKey = "acquisitionCosts[" + await amount.getAttribute("data-acq-cost-index") + "].amount";
    const before = await saved(amountKey);
    await amount.fill(''); await amount.press('Tab');
    check(await saved(amountKey) === before, "blank acquisition cost saved");
    check(await amount.getAttribute('aria-invalid') === 'true', "invalid acquisition amount lacks error state");
    await amount.fill('2000'); await amount.press('Tab');
    check(await saved(amountKey) === 2000, "acquisition amount did not save");
    const inspect = async selector => {
      const bad = await page.locator(selector).evaluateAll(els => els.filter(e => e.getClientRects().length).flatMap(e => {
        const st = getComputedStyle(e), rect = e.getBoundingClientRect();
        return !e.classList.contains('field-control') || st.borderRadius !== '6px' ||
          rect.height < (matchMedia('(pointer:coarse)').matches || innerWidth <= 880 ? 44 : 36) ||
          rect.right > innerWidth + 1 || rect.left < -1 ||
          (e.matches(".dep-sched-cw, .dep-sched-plant") && innerWidth <= 480 && rect.width < 90) ? [e.className] : [];
      }));
      check(!bad.length, "property cost field skin/size/overflow: " + bad.join(', '));
    };
    for(const width of [320,390,768,1024,1280]){
      await page.setViewportSize({width,height:844});
      await inspect('.prop-tab-panel:not([hidden]) .cc-what, .prop-tab-panel:not([hidden]) .cc-amount');
    }
    await tab("tax", "depreciation");
    const cost = page.locator('.prop-construction-cost').first();
    await cost.fill('100000'); await cost.press('Tab');
    check(await saved("constructionCost") === 100000, "construction cost did not save");
    const date = page.locator('.prop-construction-date').first();
    await date.fill('2020-01-01'); await date.press('Tab');
    check(await saved("constructionDate") === '2020-01-01', "construction date did not save");
    await page.locator('[data-dep-sched-add]').first().click();
    const capital = page.locator('.dep-sched-cw').last();
    await capital.fill(''); await capital.press('Tab');
    check(await capital.getAttribute('aria-invalid') === 'true', "blank schedule amount lacks error state");
    await capital.fill('3000'); await capital.press('Tab');
    check((await saved("depreciationSchedule")).at(-1).capitalWorks === 3000, "schedule capital works did not save");
    const plant = page.locator('.dep-sched-plant').last();
    await plant.fill('1000'); await plant.press('Tab');
    check((await saved("depreciationSchedule")).at(-1).plant === 1000, "schedule plant did not save");
    await plant.focus();
    await page.evaluate(async() => (await import('/src/components/properties.js')).renderProperties());
    check(await plant.evaluate(e => e === document.activeElement), "schedule redraw lost focus");
    for(const width of [320,390,768,1024,1280]){
      await page.setViewportSize({width,height:844});
      await inspect('.prop-tab-panel:not([hidden]) .field-control');
    }
  },
  async property(page){
    await quiet(page);
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
    await quiet(page);
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
    await quiet(page);
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
    await quiet(page);
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
  // A category change moves the asset to its new section and focuses that section's pill (#422: the one control for
  // it at every width — it was a hand-off between a phone's picker and a desktop's tab, raced by resize frames).
  async categoryresizefocus(page){
    await quiet(page);
    await go(page, 'assets', 'data-assets-sub', 'Cash');
    await page.locator('#assetsSub-Cash .m-row [data-row-toggle]').first().click();
    await page.evaluate(() => new Promise((resolve, reject) => {
      const timer = setTimeout(() => { observer.disconnect(); reject(new Error('Category change did not close its editor')); }, 5000);
      const observer = new MutationObserver(() => {
        if(!document.querySelector('.m-row.open')){ observer.disconnect(); clearTimeout(timer); queueMicrotask(resolve); }
      });
      observer.observe(document.body, {subtree:true,attributes:true,childList:true});
      const field = document.querySelector('#assetsSub-Cash .m-row.open .a-category');
      field.value = 'Other'; field.dispatchEvent(new Event('change', {bubbles:true}));
    }));
    // The row has gone to another kind's page: focus goes to this page's heading (there are no pills to go to).
    await page.waitForFunction(() => document.activeElement.id === 'pageTitle' && document.activeElement.textContent === 'Cash', null, {timeout:5000});
    // It counts under Other things on Accounts straight away.
    check(await page.evaluate(async () => (await import('/src/state.js')).state.assets.some(a => a.category === 'Other')), "the moved holding isn't under Other");
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
    await page.waitForFunction(()=>document.activeElement.id==='pageTitle', null, {timeout:5000});
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
    const cases=[['pairedsettings','/settings/preferences'],['pairedpeople','/tax/people'],['settings','/settings/preferences'],['income','/expenses/budget'],['projections','/plan/projections'],['people','/tax/people'],['checks','/dashboard/review']];
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
        if(location.pathname!=='/expenses/budget' || !document.querySelector('#expensesSub-income').checkVisibility() || document.body.dataset.currentPage!=='expenses') throw new Error('Page and route disagree after animation timeout');
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
    await ready(page, 'the app after a reload');
    check(await st(page, 'state.shared[0].amount') === 147, 'reload lost the last edit');
    check(await stored(page, 'state.shared[0].amount') === 147, 'reload lost the last edit from storage');
    const other = await secondTab(page);
    // #269: an idle tab now takes another tab's save. A stale tab is one with work in progress: an account's new
    // balance typed and not yet saved.
    const typedAt = await typeBalance(page, 4321);
    await saveIn(other, 320);
    check(await stored(other, 'state.shared[0].amount') === 320, 'the newer tab did not save');
    await waited(page, () => JSON.parse(localStorage.getItem('wealthPlanner.v1')).shared[0].amount === 320, "the other tab's save to reach this tab's storage");
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
    // The new page, not "a navigation": closing the question steps back in history first, which Playwright counts as
    // one, and waiting on that let the ready check run while the old page was being torn down (#346's CI).
    await page.evaluate(() => { window.__journeyBeforeReload = true; });
    await page.locator('[data-storage-reload]').click();
    await answerDialog(page, true);
    await waited(page, () => !window.__journeyBeforeReload && !!document.documentElement, 'the page Reload latest loads');
    await ready(page, 'the app after Reload latest');
    check(await st(page, 'state.shared[0].amount') === 320, 'Reload latest did not adopt the saved household');
    await page.goto(base + '/index.html?mock=1');
    await page.locator('.app-dialog').waitFor();
    check(await page.locator('#appLoading:not(.is-hidden)').count()===0,'sample question blocked bootstrap completion');
    await answerDialog(page, false);
    await ready(page, 'the app after declining sample data');
    check(await st(page, 'state.shared[0].amount') === 320, 'declining sample data replaced the household');
    await page.goto(base + '/index.html?mock=1');
    await answerDialog(page, true);
    await ready(page, 'the app after accepting sample data');
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
    // Today leads with the glance, then what needs you, then the month (the owner's order, November 2026).
    check(await page.locator('#homeSummary [data-home-card="glance"]').isVisible(), 'Today does not open on the glance');
    check(JSON.stringify(await home.locator('.home-grid > [data-home-card]').evaluateAll(es => es.slice(0, 2).map(e => e.dataset.homeCard))) === '["needs","month"]', 'what needs you and the month are not first');
    check(!await home.locator('.wk-details').evaluate(e=>e.open), 'weekly recap is not collapsed by default');
    await home.locator('.wk-details summary').click(); check(await home.locator('.wk-details').evaluate(e=>e.open), 'weekly recap cannot be expanded');
    // Said once, in Plans & insights — planned, not logged.
    check((await page.locator('#dashboardStats').textContent()).includes('Planned monthly surplus'), 'planned and logged cash flow are not distinguished');
    check((await page.locator('[data-home-card="tax"]').textContent()).includes('estimated annual tax'), 'annual tax still reads as tax so far');
    check((await home.innerText()).includes('Recorded balances'), 'net worth lacks data-quality context');
    // #411: + opens one sheet; Log spend is its first Log row.
    await page.locator('#quickFab').click();
    await page.locator('.qfab-panel [data-quick-action]', { hasText: 'Log spend' }).first().click();
    await until(page, () => !!document.querySelector('#quickLogRoot [role="dialog"], #quickLogRoot .quick-log, #quickLogRoot input, #quickLogSheet input'));
    check(await page.locator('#quickLogRoot [role="dialog"], #quickLogRoot .quick-log, #quickLogRoot input').count() > 0 || await page.locator('#quickLogSheet input').count() > 0, 'primary Log spending action did not open entry');
    await page.keyboard.press('Escape');
    await go(page,'plan','data-plan-sub','scenarios');
    check(await page.locator('.card-funding').count() > 0, 'unfunded scenario cards lack funding status');
    await page.locator('.cmp-scenario:not([hidden]) .cmp-summary-details > summary').click();
    const longterm=page.locator('.cmp-scenario:not([hidden]) .cmp-longterm');
    check(!await longterm.evaluate(e=>e.open), 'long-term detail is not collapsed');
    await longterm.locator('summary').focus(); await page.keyboard.press('Enter');
    check(await longterm.evaluate(e=>e.open), 'long-term comparison is not keyboard operable');
    check((await page.locator('.cmp-card').innerText()).includes('Indicative serviceability check'), 'comparison implies a lending approval');
    await page.setViewportSize({width:1280,height:844});
    await go(page,'assets','data-assets-sub','Cash');
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
  // #282: closing setup puts focus back on "Guided setup" even when the button drawn in place of the one it was opened
  // from isn't showing yet, and when a redraw outside the full one replaces it just after. Both left focus on the body.
  async setupfocusrace(page){
    for(const race of ['hidden at first', 'replaced after']){
      await page.evaluate(async () => {
        const s = await import('/src/state.js'); s.setState(s.defaultState());
        (await import('/src/calc/engine.js')).recalcComputedItems();
        (await import('/src/components/redraw.js')).renderAll();
      });
      await go(page, 'dashboard');
      const opener = page.locator('#dashboardSetup [data-firstrun-open]');
      await opener.focus(); await page.keyboard.press('Enter');
      await waited(page, () => !!document.querySelector('#firstRunRoot [role="dialog"]'), 'setup open');
      await page.evaluate(async race => {
        const card = document.getElementById('dashboardSetup');
        if(race === 'hidden at first'){
          // The close draws a new Guided setup; it stays hidden for two frames.
          const ob = new MutationObserver(() => {
            if(!card.querySelector('[data-firstrun-open]')) return;
            ob.disconnect(); card.style.display = 'none';
            requestAnimationFrame(() => requestAnimationFrame(() => { card.style.display = ''; }));
          });
          ob.observe(card, { childList: true, subtree: true });
        } else {
          const { renderDashboardStats } = await import('/src/components/dashboard.js');
          document.addEventListener('focusin', function f(e){
            if(!e.target.matches('[data-firstrun-open]')) return;
            document.removeEventListener('focusin', f, true); setTimeout(renderDashboardStats, 20);
          }, true);
        }
      }, race);
      await page.keyboard.press('Escape');
      await waited(page, () => !document.querySelector('#firstRunRoot [role="dialog"]'), 'setup closed');
      await waited(page, () => !!document.activeElement?.matches('#dashboardSetup [data-firstrun-open]'), 'focus back on Guided setup (' + race + ')');
      await page.waitForTimeout(100);
      check(await page.evaluate(() => !!document.activeElement?.matches('#dashboardSetup [data-firstrun-open]')), 'focus left Guided setup after setup closed (' + race + ')');
      await page.evaluate(() => { document.getElementById('dashboardSetup').style.display = ''; });
    }
  },
  // The header's ⓘ opens the page's intros, at its top. A little way down the page, scroll anchoring kept what was below
  // them in place as they opened: the page jumped down past the help just asked for (202px at 320px on Super).
  async pagehelpstays(page){
    for(const width of [320, 390]){
      await page.setViewportSize({ width, height: 844 });
      await go(page, 'assets', 'data-assets-sub', 'Super');
      // The page change scrolls to the top inside its view transition, which can end after go() returns: let it.
      await pageStill(page);
      await page.evaluate(() => window.scrollTo(0, 40));
      await page.waitForFunction(() => scrollY === 40, null, { timeout: 5000 });
      await page.evaluate(() => document.getElementById('pageHelpBtn').click());
      await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));
      const at = await page.evaluate(() => ({ y: scrollY, intro: document.querySelector('#page-assets .page-intro').getBoundingClientRect().top, header: document.querySelector('.app-topbar').getBoundingClientRect().bottom }));
      // Never down; up only as far as shows the help that opened (it starts under the taller header at 320px).
      check(at.y <= 40 && at.intro >= at.header - 1, width + ': opening page help moved the page down, or left it under the header: ' + JSON.stringify(at));
      await page.evaluate(() => document.getElementById('pageHelpBtn').click());
      await page.evaluate(() => window.scrollTo(0, 0));
    }
  },
  // "Paid" on a bill (the owner: logging the investment property's council rates meant hunting through Log spend's
  // line picker). From Today's Bills card: the bill, pre-filled — today, its amount, the account it's paid from — Save,
  // and it's logged against the property's line, on its Activity, and off the list. Money → Bills offers it too.
  // The owner: dozens of things changed on both devices, and a choice each — keep one side for all of them in one tap,
  // still able to change any one back, and Combine with what's ticked.
  async mergeall(page){
    await quiet(page);
    await page.evaluate(async () => {
      const w = await import('/src/components/safekeepingwiring.js');
      const conflicts = [
        { id: 'accounts/id:a1/balance', top: 'accounts', row: { name: 'Everyday' }, field: 'balance', ours: 150, theirs: 175 },
        { id: 'accounts/id:a2/balance', top: 'accounts', row: { name: 'Savings' }, field: 'balance', ours: 900, theirs: 950 },
        { id: 'scenarios/id:s1/purchase', top: 'scenarios', row: { name: 'Buy a house' }, field: 'purchase', ours: { enabled: true, price: 500000 }, theirs: undefined }
      ];
      window.__mergeChoices = null;
      w.openMergeDialog(conflicts, 'Dropbox', '', '', c => { window.__mergeChoices = c; });
    });
    const d = page.locator('#mergeDialog');
    check(await d.isVisible(), 'the merge question did not open');
    check(!(await d.innerText()).includes('{"'), 'a group of settings is shown as raw data');
    await d.locator('[data-merge-all="theirs"]').click();
    check(await d.locator('input[value="theirs"]:checked').count() === 3, 'keep all from Dropbox did not tick every choice');
    check(await d.locator('[data-merge-all="theirs"]').getAttribute('aria-pressed') === 'true', 'the chosen side is not shown as chosen');
    // One back to this device — a plan Dropbox's copy doesn't have.
    await d.locator('input[name="merge-2"][value="ours"]').check();
    await d.locator('[data-merge-ok]').click();
    // The dialog's close event comes after the click: wait for what the app says, not a time.
    await page.waitForFunction(() => window.__mergeChoices !== null, null, { timeout: 5000 }).catch(() => {});
    const choices = await page.evaluate(() => window.__mergeChoices);
    check(choices && choices['accounts/id:a1/balance'] === 'theirs' && choices['accounts/id:a2/balance'] === 'theirs' && choices['scenarios/id:s1/purchase'] === 'ours', 'Combine did not use what was ticked: ' + JSON.stringify(choices));
  },
  async billpaid(page){
    await quiet(page);
    await page.evaluate(async () => {
      const s = await import('/src/state.js'); const p = s.state.properties.find(x => x.kind === 'IP');
      p.expenses = p.expenses || []; p.expenses.push({ id: 'example-rates', what: 'Council rates', amount: 480, freq: 'Quarterly', category: 'Utilities' });
      const d = new Date(Date.now() - 89 * 86400000).toISOString().slice(0, 10);   // a quarter on: due in about two days
      s.state.transactions.push({ id: 'example-rates-paid', date: d, amount: 480, linkedExpenseId: 'example-rates', account: 'Everyday Account' });
      s.commit(['properties', 'transactions']);
    });
    await go(page, 'dashboard', 'data-dashboard-sub', 'overview');
    // The bell says it — a quarterly property bill, named with its property — and following it opens the same sheet.
    await page.locator('#notifBellBtn').click();
    const remind = page.locator('[data-notif-id^="duebill:example-rates:"]').first();
    await remind.waitFor({ state: 'visible' });
    check(/Council rates — /.test(await remind.innerText()) && /quarterly/.test(await remind.innerText()), 'the reminder does not name the property bill: ' + await remind.innerText());
    check(await remind.getAttribute('data-notif-action') === 'billpaid', 'a property bill due in days does not open its Paid sheet');
    await remind.click();
    await page.locator('#expenseReviewRoot [role="dialog"][aria-label="Log a payment"]').waitFor({ state: 'visible' });
    await page.locator('#expenseReviewRoot [data-review-close]').first().click();
    await page.waitForFunction(() => !document.querySelector('#expenseReviewRoot [role="dialog"]'));
    const paid = page.locator('#homeSummary [data-bill-paid="example-rates"]');
    await paid.waitFor({ state: 'visible' });
    check((await paid.getAttribute('aria-label')) === 'Log Council rates as paid', 'the Paid button is not named for its bill');
    await paid.click();
    const sheet = page.locator('#expenseReviewRoot [role="dialog"]');
    await sheet.waitFor({ state: 'visible' });
    check(await sheet.getAttribute('aria-label') === 'Log a payment', 'Paid did not open the payment sheet');
    check(await sheet.locator('.bc-confirm-amount').inputValue() === '480', 'the amount is not the bill\'s');
    check(await sheet.locator('.bc-confirm-date').inputValue() === await page.evaluate(async () => (await import('/src/lib/format.js')).localDateStr()), 'the date paid is not today');
    check(await sheet.locator('[data-review-account]').inputValue() === 'Everyday Account', 'Paid from is not where it was paid from last time');
    check(!await sheet.locator('.bc-confirm-check').isVisible(), 'a single bill shows a tick box');
    const before = await st(page, 'state.transactions.length');
    await sheet.locator('[data-review-confirm]').click();
    await page.waitForFunction(() => !document.querySelector('#expenseReviewRoot [role="dialog"]'));
    check(await st(page, 'state.transactions.length') === before + 1, 'Save did not log one payment');
    const t = await st(page, 'state.transactions[state.transactions.length - 1]');
    check(t.linkedExpenseId === 'example-rates' && t.amount === 480 && t.account === 'Everyday Account', 'the payment is not against the property line: ' + JSON.stringify(t));
    await page.waitForFunction(() => !document.querySelector('#homeSummary [data-bill-paid="example-rates"]'), null, { timeout: 5000 });
    check(await page.evaluate(async () => { const pa = await import('/src/components/propertyactivity.js'), s = await import('/src/state.js');
      return pa.propertyActivityHtml(s.state.properties.find(x => x.kind === 'IP')).includes('Council rates'); }), 'the payment is not on the property\'s Activity');
    await go(page, 'expenses', 'data-expenses-sub', 'bills');
    check(await page.locator('#expensesSub-bills [data-bill-paid]').count() > 0, 'Money → Bills offers no Paid');
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
    await page.locator('[data-cmp-full-table-toggle]').check();
    const compare = page.locator('.cmp-scroll').first();
    await compare.focus(); await page.keyboard.press('ArrowRight'); await until(page, el => el.scrollLeft > 0, await compare.elementHandle());
    check(await compare.evaluate(el => el.scrollLeft > 0), 'scenario table cannot scroll with the keyboard');
    await go(page, 'reports', 'data-report', 'networth');
    await page.locator('[data-report-full-table]').check();
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
    await openSetup(page, 'first click, on arriving at Home');
    const dialog = page.getByRole('dialog', { name: 'Set up Wealth Planner' });
    check((await dialog.innerText()).includes('Step 1 of 5'), 'setup has no readable progress');
    // #309: one progress count on screen at a time — the sheet's, while it's open.
    let counts = await progressCounts(page);
    check(counts.length === 1, 'with setup open, ' + counts.length + ' progress counts show: ' + counts.join(' · '));
    await dialog.locator('[data-fr="people.0.name"]').fill('Alex');
    await dialog.locator('[data-fr-next]').click();
    check((await dialog.innerText()).includes('Step 2 of 5'), 'setup did not advance');
    await dialog.locator('[data-fr-close]').click();
    check(await st(page, 'state.income.length') === 0, 'cancelling setup saved an incomplete draft');
    await until(page, () => !document.querySelector('#firstRunRoot [role="dialog"]'));
    counts = await progressCounts(page);
    check(counts.length === 1, 'after skipping setup, ' + counts.length + ' progress counts show: ' + counts.join(' · '));
    await openSetup(page, 'second click, after Skip');
    await dialog.locator('[data-fr="people.0.name"]').fill('Alex');
    await dialog.locator('[data-fr-next]').click();
    await dialog.locator('[data-fr-next]').click();
    await dialog.locator('[data-fr="people.0.pay"]').fill('60000');
    await dialog.locator('[data-fr-next]').click();
    await dialog.locator('[data-fr-next]').click();
    await dialog.locator('[data-fr-finish="home"]').click();
    check(await st(page, 'state.income.length') > 0, 'finishing setup did not save income');
    await until(page, () => !document.querySelector('#firstRunRoot [role="dialog"]'));
    counts = await progressCounts(page);
    check(counts.length <= 1, 'after finishing setup, ' + counts.length + ' progress counts show: ' + counts.join(' · '));
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
    check(message.includes('\n\n1 Oct 2026') && message.includes('\n1 Nov 2026') && !message.includes('\\n') && !message.includes('2026-10-01'), 'preview must show readable occurrence lines');
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
  async comparisonfinish(page){
    await go(page,'expenses','data-expenses-sub','spending');
    // Drain the sample household's deferred activity entry before taking the unchanged-data baseline.
    await page.evaluate(async() => (await import('/src/lib/activity.js')).noteChanges());
    const original=await page.evaluate(async()=>JSON.stringify((await import('/src/state.js')).state));
    const numbers=page.locator('.trend-numbers');
    await numbers.locator('summary').focus();await page.keyboard.press('Enter');
    const month=page.locator('[data-trend-month]');
    const months=await month.locator('option').evaluateAll(os=>os.map(o=>o.value));
    check(months.length>1,'sample needs multiple logged months');
    check(await month.inputValue()===months.at(-1),'numbers do not default to latest month');
    check((await month.locator('option:checked').textContent()).includes('so far'),'partial-month context missing');
    for(const [index,name] of months.entries()){
      await month.focus();await month.selectOption(name);
      check(await month.evaluate(e=>e===document.activeElement),'month selection lost focus');
      const panel=page.locator('.trend-month:not([hidden])');
      check(await panel.evaluate((e,index)=>{
        const rows=[...document.querySelectorAll('.trend-full-table tbody tr')];
        const fields=[...e.querySelectorAll('[data-trend-row]')];
        return fields.length===rows.length&&fields.every((f,i)=>f.querySelector('dt').textContent===rows[i].cells[0].textContent&&f.querySelector('dd').textContent===rows[i].cells[index+1].textContent);
      },index),'month summary changed a category/total value');
    }
    await page.evaluate(async()=>(await import('/src/components/expenses.js')).renderSpendingTrends());
    check(await month.inputValue()===months.at(-1),'redraw lost month selection');
    check(await month.evaluate(e=>e===document.activeElement),'redraw lost month focus');
    check(await numbers.evaluate(e=>e.open),'redraw collapsed exact numbers');
    await page.locator('.trend-month:not([hidden]) dt').first().evaluate(e=>e.textContent='Sample category with a deliberately long label for narrow phones');
    for(const width of [320,390]){
      await page.setViewportSize({width,height:844});
      check(await page.locator('.trend-month:not([hidden])').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'month numbers overflow at '+width);
      check(await page.locator('.trend-rows').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'default spending bars overflow at '+width);
    }
    await page.locator('[data-trend-full-toggle]').focus();await page.keyboard.press('Space');
    const trendTable=page.locator('.trend-full-table .table-scroll');await trendTable.focus();await page.keyboard.press('ArrowRight');await until(page,e=>e.scrollLeft>0,await trendTable.elementHandle());
    check(!await page.locator('.trend-month-reading').isVisible(),'spending table exposes duplicate summary');
    await page.locator('[data-trend-full-toggle]').uncheck();
    await goPurchaseFunding(page);
    const funding=page.locator('#netWorthPanel'),scenario=page.locator('[data-funding-scenario]');
    const choices=await scenario.locator('option').evaluateAll(os=>os.map(o=>o.value));
    check(choices.length>0,'sample needs a purchase comparison');
    for(const [index,name] of choices.entries()){
      await scenario.focus();await scenario.selectOption(name);
      check(await scenario.evaluate(e=>e===document.activeElement),'funding selection lost focus');
      const panel=page.locator('.funding-scenario:not([hidden])');
      await panel.locator('summary').focus();await page.keyboard.press('Enter');
      check(await panel.evaluate((e,index)=>{
        const row=document.querySelectorAll('.funding-full-table tbody tr')[index];
        return [...e.querySelectorAll('[data-funding-field]')].every(f=>f.querySelector('dd').textContent===row.cells[Number(f.dataset.fundingField)+1].textContent);
      },index),'funding summary changed a table value');
      check((await panel.innerText()).includes('if funded'),'conditional funding value lost its qualification');
    }
    const details=page.locator('.funding-scenario:not([hidden]) .funding-details');
    await details.locator('summary').focus();await page.evaluate(async()=>(await import('/src/components/assets.js')).renderNetWorthPanel());
    check(await scenario.inputValue()===choices.at(-1),'redraw lost funding selection');
    check(await details.evaluate(e=>e.open),'redraw lost funding Details');
    check(await details.locator('summary').evaluate(e=>e===document.activeElement),'redraw lost funding focus');
    check((await funding.innerText()).includes('Selling investments is not assumed'),'funding assumptions missing');
    await page.locator('.funding-scenario:not([hidden]) h3').evaluate(e=>e.textContent='Sample scenario with a deliberately long name for narrow phones');
    for(const width of [320,390]){await page.setViewportSize({width,height:844});check(await page.locator('.funding-scenario:not([hidden])').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'funding summary overflows at '+width);}
    await page.locator('[data-funding-full-toggle]').check();
    const fundingTable=page.locator('.funding-full-table .table-scroll');await fundingTable.focus();await page.keyboard.press('ArrowRight');await until(page,e=>e.scrollLeft>0,await fundingTable.elementHandle());
    check(!await page.locator('.funding-mobile').isVisible(),'funding table exposes duplicate summary');
    await page.locator('[data-funding-full-toggle]').uncheck();
    check(await page.evaluate(async original=>JSON.stringify((await import('/src/state.js')).state)===original,original),'display controls changed household data');
    for(const width of [320,390,768,1280]){
      await page.setViewportSize({width,height:844});
      check(await page.locator('.funding-mobile').isVisible()===(width<768),'wrong funding mode at '+width);
      await go(page,'expenses','data-expenses-sub','spending');
      check(await page.locator('.trend-month-reading').isVisible()===(width<768),'wrong spending numbers mode at '+width);
      check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'comparison creates page overflow at '+width);
      await goPurchaseFunding(page);
    }
    await page.emulateMedia({media:'print'});
    check(await page.locator('.funding-full-table').isVisible()&&!await page.locator('.funding-mobile').isVisible(),'print lost funding comparison');
    await page.emulateMedia({media:'screen'});
    await page.evaluate(async()=>{const a=await import('/src/components/assets.js');a.purchaseDisplay.scenario='Removed';a.renderNetWorthPanel();});
    check(await scenario.inputValue()===choices[0],'missing funding selection did not fall back');
    await go(page,'expenses','data-expenses-sub','spending');
    await page.evaluate(async()=>{const e=await import('/src/components/expenses.js');e.trendDisplay.month='Removed';e.renderSpendingTrends();});
    check(await month.inputValue()===months.at(-1),'missing month did not fall back');
  },
  // #255 step 4: Projections explains its controls without native tooltips.
  async projectionhelp(page){
    await go(page, 'plan', 'data-plan-sub', 'projections');
    const root = page.locator('#planSub-projections');
    const help = root.locator('.ledgers > details > [data-help-toggle]');
    const note = page.locator('#projRealHelp');
    check(!await note.isVisible(), 'projection help is not folded initially');
    const before = await page.evaluate(async () => JSON.stringify((await import('/src/components/projections.js')).projectionSeriesShown()));
    await help.focus(); await page.keyboard.press('Enter');
    check(await note.isVisible() && await help.getAttribute('aria-expanded') === 'true', 'Enter did not reveal dollar-basis help');
    await page.keyboard.press('Space');
    check(!await note.isVisible(), 'Space did not fold dollar-basis help');
    await page.locator('#projAssumptions > summary').click();
    for(const scheme of ['light', 'dark']){
      await page.evaluate(s => { document.documentElement.dataset.theme = s; }, scheme);
      for(const width of [320, 390, 1280]){
        await page.setViewportSize({ width, height: 844 });
        await help.tap();
        check(await note.isVisible(), 'touch did not reveal help at ' + width + ' in ' + scheme);
        check(await page.locator('#projInvestRateHelp').isVisible(), 'assumption explanation is unavailable');
        check(await page.evaluate(w => document.documentElement.scrollWidth <= w, width), 'expanded projection help overflows at ' + width);
        await help.tap();
      }
    }
    const undescribed = await root.locator('.proj-controls input').evaluateAll(es => es.filter(e => {
      const ids = (e.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
      return !ids.length || ids.some(id => !document.getElementById(id)?.textContent.trim());
    }).map(e => e.id));
    check(!undescribed.length, 'assumptions without descriptions: ' + undescribed.join(', '));
    const hidden = await page.evaluate(async original => original === JSON.stringify((await import('/src/components/projections.js')).projectionSeriesShown()), before);
    check(hidden, 'opening help changed projection figures');
    const cdp = await page.context().newCDPSession(page);
    const ax = await cdp.send('Accessibility.getFullAXTree');
    check(ax.nodes.some(n => !n.ignored && /^investment return % p\.a\.$/i.test(n.name?.value || '') && /Annual growth rate/.test(n.description?.value || '')), 'assumption description is absent from the accessibility tree');
    await cdp.detach();
    await page.locator('[data-proj-basis="nominal"]').click();
    check((await page.locator('#projBasisNote').textContent()).includes('Not adjusted for inflation'), 'future dollar basis stopped updating');
    await page.locator('[data-proj-source="actuals"]').click();
    check(await page.locator('[data-proj-source="actuals"]').getAttribute('aria-pressed') === 'true', 'Actuals stopped selecting');
    check((await page.locator('#projActualsHelp').textContent()).includes('spending lines, plus one-offs'), 'redraw lost actuals line counts');
    await help.tap();
    check(await page.locator('#projActualsHelp').isVisible(), 'redrawn source help cannot be revealed');
    await help.tap();
    const titles = await root.locator('[title]').evaluateAll(es => es.filter(e => e.getClientRects().length && e.getAttribute('title').length > 40).map(e => e.tagName));
    check(!titles.length, 'projection help remains in native titles, including expanded assumptions: ' + titles.join(', '));
    await page.locator('#projAssumptions > summary').click();
    const chart = root.locator('svg rect[fill="transparent"]').first();
    await chart.tap();
    check(await root.locator('.viz-tooltip.show').count() > 0, 'chart tap no longer shows exact values');
  },
  async projectionsummary(page){
    await go(page,'plan','data-plan-sub','projections');
    const picker=page.locator('[data-proj-reading-scenario]');
    const original=await page.evaluate(async()=>JSON.stringify((await import('/src/state.js')).state));
    async function parity(){
      const options=await picker.locator('option').evaluateAll(os=>os.map(o=>o.value));
      for(const name of options){
        await picker.focus();await picker.selectOption(name);
        check(await picker.evaluate(e=>e===document.activeElement),'projection scenario selection lost focus');
        const panel=page.locator('.proj-reading-scenario:not([hidden])');
        await panel.locator('details').evaluateAll(ds=>ds.forEach(d=>d.open=true));
        check(await panel.evaluate(el=>{
          const row=[...document.querySelectorAll('[data-proj-table-scenario]')].find(r=>r.dataset.projTableScenario===el.dataset.projReading);
          const headings=[...row.closest('table').tHead.rows[0].cells].slice(1).map(c=>c.textContent);
          const fields=[...el.querySelectorAll('[data-proj-reading-year]')];
          const amounts=[...el.querySelectorAll('[data-proj-reading-target]')];
          const ms=[...document.querySelectorAll('.proj-full-tables .proj-ms-row:not(.proj-ms-head)')].find(r=>r.firstElementChild.textContent===el.dataset.projReading);
          const msCells=ms ? [...ms.children].slice(1) : [];
          return fields.length===headings.length && fields.every(f=>row.cells[headings.indexOf(f.querySelector('dt').textContent)+1]?.textContent===f.querySelector('dd').textContent) && amounts.every((f,i)=>f.querySelector('dd').textContent===msCells[i]?.textContent) && el.querySelector('[data-proj-reading-loans]').textContent===msCells.at(-1)?.textContent;
        }),'projection summary changed or dropped a table value for '+name);
      }
    }
    await parity();
    const details=page.locator('.proj-reading-scenario:not([hidden]) .proj-reading-details');
    await details.locator('summary').focus();
    const selected=await picker.inputValue();
    await page.evaluate(async()=>(await import('/src/components/projections.js')).renderProjectionOutputs());
    check(await picker.inputValue()===selected,'projection redraw lost selected scenario');
    check(await details.evaluate(e=>e.open),'projection redraw lost expanded Details');
    check(await details.locator('summary').evaluate(e=>e===document.activeElement),'projection redraw lost Details focus');
    await page.locator('[data-proj-reading-full-toggle]').focus();await page.keyboard.press('Space');
    check(await page.locator('.proj-full-tables').isVisible(),'projection Full table unavailable');
    check(!await page.locator('.proj-mobile-reading').isVisible(),'summary duplicates controls in table mode');
    for(const selector of ['.proj-full-tables .table-scroll','.proj-full-tables .proj-ms-table']){
      const scroll=page.locator(selector);await scroll.focus();await page.keyboard.press('ArrowRight');
      await until(page,e=>e.scrollLeft>0,await scroll.elementHandle());
    }
    await page.locator('[data-proj-reading-full-toggle]').uncheck();
    const changed=await page.evaluate(async original=>{ const now=(await import('/src/state.js')).state, was=JSON.parse(original);
      return Object.keys(Object.assign({},was,now)).filter(k=>JSON.stringify(was[k])!==JSON.stringify(now[k])).map(k=>k+': '+JSON.stringify(was[k]).slice(0,80)+' → '+JSON.stringify(now[k]).slice(0,400)); },original);
    check(!changed.length,'projection display changed saved household: '+changed.join('; '));
    if(!await page.locator('#projAssumptions').evaluate(d=>d.open)) await page.locator('#projAssumptions > summary').click();
    for(const horizon of [1,7,50])for(const basis of ['real','nominal']){
      await page.locator('#projHorizon').fill(String(horizon));
      await page.locator('[data-proj-basis="'+basis+'"]').click();
      await parity();
      check((await page.locator('.proj-table-reading > h3').textContent()).includes(basis==='real' ? "today's" : 'future'),'projection dollar basis label missing');
    }
    await page.locator('#projHorizon').fill('20');
    await page.locator('[data-proj-stress-enabled]').check();
    const stress=await picker.locator('option').evaluateAll(os=>os.map(o=>o.value).find(v=>v.includes('illustrative')));
    check(stress,'stress line missing from reading selector');
    await picker.selectOption(stress);await parity();await picker.selectOption(stress);
    check((await page.locator('.proj-reading-scenario:not([hidden])').innerText()).includes('excluded from the saved-plan ranking'),'stress summary lacks qualification');
    await page.locator('[data-proj-stress-enabled]').uncheck();
    check(await picker.inputValue()!==stress,'disabled stress line remains selected');
    await page.locator('[data-wi="extraMonthly"]').evaluate(e=>{e.value='500';e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));});
    check(await picker.locator('option').count()===2,'what-if and saved plan missing from selector');
    await parity();
    const download=page.waitForEvent('download');await page.locator('#projCsvBtn').click();const file=await download;
    const text=fs.readFileSync(await file.path(),'utf8');
    const csv=await page.evaluate(async text=>{
      const rows=(await import('/src/lib/backup.js')).parseCsv(text).slice(1);
      const series=(await import('/src/components/projections.js')).projectionSeriesShown();
      const expected=series.flatMap(s=>s.points.map(p=>[s.label,p.x,Math.round(p.y),Math.round(p.investments||0),Math.round(p.propertyEquity||0),Math.round(p.debt||0)].map(String)));
      return JSON.stringify(rows)===JSON.stringify(expected);
    },text);
    check(csv,'every-year CSV changed or omitted a scenario/component');
    for(const width of [320,390,768,1280]){
      await page.setViewportSize({width,height:844});
      check(await page.locator('.proj-mobile-reading').isVisible()===(width<768),'wrong projection summary mode at '+width);
      check(await page.locator('.proj-full-tables').isVisible()===(width>=768),'wrong projection table mode at '+width);
      check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'projection page overflows at '+width);
    }
    await page.emulateMedia({media:'print'});
    check(await page.locator('.proj-full-tables').isVisible()&&!await page.locator('.proj-mobile-reading').isVisible(),'print lost complete projection tables');
    await page.emulateMedia({media:'screen'});
  },
  async scenariosummary(page){
    await go(page,'plan','data-plan-sub','scenarios');
    const picker=page.locator('[data-cmp-scenario]');
    const options=await picker.locator('option').evaluateAll(os=>os.map(o=>o.value));
    check(options.length>1,'sample comparison needs multiple scenarios');
    await until(page,()=>[...document.querySelectorAll('#scenarioCompare [data-odds]')].every(e=>!e.textContent.includes('working out')));
    const original=await page.evaluate(async()=>JSON.stringify((await import('/src/state.js')).state));
    for(const [index,name] of options.entries()){
      await picker.focus(); await picker.selectOption(name);
      check(await picker.evaluate(e=>e===document.activeElement),'scenario picker lost focus');
      const panel=page.locator('.cmp-scenario:not([hidden])');
      check(await panel.getAttribute('data-cmp-summary')===name,'wrong scenario shown');
      check(await page.locator('.cmp-scenario:visible').count()===1,'multiple scenario summaries exposed');
      await panel.locator('details').evaluateAll(ds=>ds.forEach(d=>d.open=true));
      const parity=await panel.evaluate((el,index)=>{
        const rows=[...document.querySelectorAll('.cmp-table-view tr[data-cmp-metric]')];
        const fields=[...el.querySelectorAll('[data-cmp-metric]')];
        return fields.length===rows.length && fields.every(f=>{
          const row=rows.find(r=>r.dataset.cmpMetric===f.dataset.cmpMetric);
          return row && f.querySelector('dd').innerHTML===row.cells[index+1].innerHTML && f.querySelector('dt').textContent===row.cells[0].textContent;
        });
      },index);
      check(parity,'summary changed or dropped a metric for '+name);
      await panel.locator('h3').evaluate(e=>e.textContent='Sample scenario with a deliberately long name for narrow phone layouts');
      for(const width of [320,390]){
        await page.setViewportSize({width,height:844});
        check(await panel.evaluate(e=>e.scrollWidth<=e.clientWidth+1),'scenario summary overflows at '+width);
      }
    }
    const details=page.locator('.cmp-scenario:not([hidden]) .cmp-summary-details');
    await details.locator('summary').focus();
    await page.evaluate(async()=>(await import('/src/components/compare.js')).renderCompare());
    check(await picker.inputValue()===options.at(-1),'redraw lost the selected scenario');
    check(await details.evaluate(e=>e.open),'redraw lost expanded details');
    check(await details.locator('summary').evaluate(e=>e===document.activeElement),'redraw lost keyboard focus');
    await until(page,()=>[...document.querySelectorAll('#scenarioCompare [data-odds]')].every(e=>!e.textContent.includes('working out')));
    await page.locator('[data-cmp-full-table-toggle]').focus(); await page.keyboard.press('Space');
    check(await page.locator('.cmp-table-view').isVisible(),'Full table is unavailable');
    check(!await page.locator('.cmp-mobile-summary').isVisible(),'summary exposes duplicate controls in table mode');
    const scroll=page.locator('.cmp-table-view .cmp-scroll').first();await scroll.focus();await page.keyboard.press('ArrowRight');
    await until(page,e=>e.scrollLeft>0,await scroll.elementHandle());
    await page.locator('[data-cmp-full-table-toggle]').uncheck();
    const changed=await page.evaluate(async original=>{ const now=(await import('/src/state.js')).state, was=JSON.parse(original);
      return Object.keys(Object.assign({},was,now)).filter(k=>JSON.stringify(was[k])!==JSON.stringify(now[k])).map(k=>k+': '+JSON.stringify(was[k]).slice(0,80)+' → '+JSON.stringify(now[k]).slice(0,400)); },original);
    check(!changed.length,'display controls changed saved household data: '+changed.join('; '));
    for(const width of [320,390,768,1280]){
      await page.setViewportSize({width,height:844});
      check(await page.locator('.cmp-mobile-summary').isVisible()===(width<768),'wrong summary mode at '+width);
      check(await page.locator('.cmp-table-view').isVisible()===(width>=768),'wrong table mode at '+width);
      check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'comparison creates page overflow at '+width);
    }
    // A removed selection returns to the current household, and fewer than two scenarios hides comparison.
    await page.evaluate(async()=>{
      const m=await import('/src/components/compare.js');m.compareDisplay.scenario='Removed sample scenario';m.renderCompare();
    });
    check(await picker.inputValue()===options[0],'missing scenario did not fall back to the household');
  },
  // #255 step 4: Month's exact chart values also name its native navigation buttons.
  async monthhelp(page){
    await go(page, 'reports', 'data-report', 'month');
    const root = page.locator('#reportsBody .md');
    const original = await page.evaluate(async () => JSON.stringify((await import('/src/state.js')).state));
    const selected = root.locator('.md-bar[aria-pressed="true"]');
    check(await root.locator('.md-strip[role="group"]').count() === 1, 'month strip has no group semantics');
    check(await root.locator('.md-bar').count() === 12 && await selected.count() === 1, 'month strip lost a month or its selected state');
    const badNames = await root.locator('.md-bar').evaluateAll(es => es.filter(e => e.getAttribute('aria-label') !== e.getAttribute('title') || !/\d{4}: in .+, out .+, left .+/.test(e.getAttribute('aria-label') || '')).length);
    check(!badNames, 'month buttons are missing their exact accessible figures');
    const cdp = await page.context().newCDPSession(page);
    const ax = await cdp.send('Accessibility.getFullAXTree');
    const buttons = ax.nodes.filter(n => !n.ignored && n.role?.value === 'button' && /\d{4}: in .+, out .+, left .+/.test(n.name?.value || ''));
    check(buttons.length === 12, 'native accessibility tree does not expose twelve named month buttons');
    check(buttons.filter(n => n.properties?.some(p => p.name === 'pressed' && p.value?.value === 'true')).length === 1, 'native tree does not announce the selected month');
    await cdp.detach();
    const earlier = root.locator('.md-bar').nth(10);
    const ym = await earlier.getAttribute('data-md-open');
    await earlier.focus(); await page.keyboard.press('Enter');
    check(await selected.getAttribute('data-md-open') === ym, 'Enter did not select the chosen month');
    check(await selected.evaluate(e => e === document.activeElement), 'month selection lost keyboard focus');
    await page.keyboard.press('Space');
    check(await selected.evaluate(e => e === document.activeElement), 'Space activation lost the selected month');
    await root.locator('[data-md-step="-1"]').click();
    check(await selected.getAttribute('data-md-open') !== ym, 'Previous month stopped navigating');
    await root.locator('[data-md-step="1"]').click();
    check(await selected.getAttribute('data-md-open') === ym, 'Next month did not return to the chosen month');
    for(const scheme of ['light', 'dark']){
      await page.evaluate(s => { document.documentElement.dataset.theme = s; }, scheme);
      for(const width of [320, 390, 1280]){
        await page.setViewportSize({ width, height: 844 });
        const bar = root.locator('.md-bar').nth(10), next = await bar.getAttribute('data-md-open');
        await bar.tap();
        check(await selected.getAttribute('data-md-open') === next, 'touch did not select the month at ' + width + ' in ' + scheme);
        const target = await selected.evaluate(e => { const r = e.getBoundingClientRect(), strip = e.parentElement.getBoundingClientRect(); return { width: r.width, visible: r.left >= strip.left - 1 && r.right <= strip.right + 1 }; });
        check(target.width >= 44 && target.visible, 'selected month is too small or off screen after redraw at ' + width);
        check(await page.evaluate(w => document.documentElement.scrollWidth <= w, width), 'month report overflows at ' + width);
      }
    }
    check(await page.evaluate(async original => original === JSON.stringify((await import('/src/state.js')).state), original), 'month navigation changed the saved household');
    // An empty report retains all twelve controls and its step onward.
    await page.evaluate(async () => {
      const m = await import('/src/components/monthdetail.js'); m.monthDetailUi.ym = '2000-01';
      (await import('/src/components/reports.js')).renderReports();
    });
    check(await selected.count() === 1 && await root.locator('.md-bar').count() === 12, 'empty month lost its navigation semantics');
    check(await root.locator('[data-go="expenses/spending"]').count() === 1, 'empty month lost its next step');
  },
  async reportsummary(page){
    await go(page, 'reports', 'data-report', 'invest');
    // All fields, including percentage/negative/blank values, must match the unchanged table.
    const keys = await page.evaluate(async () => (await import('/src/calc/reports.js')).REPORTS.map(r=>r.key).filter(k=>!['month','yearend'].includes(k)));
    for(const key of keys){
      await go(page, 'reports', 'data-report', key);
      const summary = page.locator('.rp-mobile-summary');
      if(!await summary.count()) continue; // empty report has no table or summary
      // #396: Year in review leads with its guided sections; its figures are a fold under them.
      if(key === 'review') await page.evaluate(() => { const f = document.querySelector('details.yr-figures'); if(f) f.open = true; });
      check(await summary.isVisible(), key+' does not default to a phone summary');
      await summary.locator('details').evaluateAll(ds=>ds.forEach(d=>d.open=true));
      const entities = summary.locator('[data-report-entity]');
      const options = await entities.count() ? await entities.locator('option').evaluateAll(os=>os.map(o=>o.value)) : [null];
      for(const entity of options){
        if(entity !== null) await entities.selectOption(entity);
        const parity = await summary.evaluate((el, entity) => {
          const table = document.querySelector('.rp-comparison-table table');
          const headings = [...table.tHead.rows[0].cells].map(c=>c.textContent);
          return [...el.querySelectorAll('[data-report-summary-row]')].every((row,i) => {
            const cells = [...table.tBodies[0].rows[i].cells];
            if(row.querySelector('h3').textContent !== cells[0].textContent) return false;
            const values = [...row.querySelectorAll('[data-report-field]')];
            if(!values.length) return cells.slice(1).every(c=>!c.textContent);
            return values.every(field => {
              const label=field.querySelector('dt').textContent;
              const index=headings.indexOf(label);
              return index>0 && field.querySelector('dd').textContent === (cells[index].textContent || '—');
            }) && (entity !== null || values.length === cells.length-1);
          });
        }, entity);
        check(parity, key+' summary dropped or changed a table cell');
      }
      check(await summary.evaluate(el=>[el,...el.querySelectorAll('*:not(.visually-hidden)')].every(n=>!n.getClientRects().length || n.scrollWidth<=n.clientWidth+1)),key+' has horizontal overflow');
      await page.locator('[data-report-full-table]').check();
      check(await page.locator('.rp-comparison-table').isVisible(),key+' full table is unavailable');
      check(!await summary.isVisible(),key+' summary still exposes duplicate controls');
      await page.locator('[data-report-full-table]').uncheck();
    }
    await go(page,'reports','data-report','cashflow');
    const details=page.locator('.rp-row-details').first();
    await details.locator('summary').focus(); await page.keyboard.press('Enter');
    check(await details.evaluate(d=>d.open),'Details cannot open by keyboard');
    await page.evaluate(async ()=>(await import('/src/components/reports.js')).renderReports());
    check(await details.evaluate(d=>d.open),'redraw lost expanded details');
    check(await details.locator('summary').evaluate(e=>e===document.activeElement),'redraw lost Details focus');
    await page.locator('.rp-mobile-summary [data-md-open]').first().click();
    check(await page.locator('[data-current-report="month"]').count()===1,'summary month action failed');
    await go(page,'reports','data-report','categories');
    await page.locator('[data-rf="range"]').selectOption('l12');
    await page.locator('.rp-mobile-summary [data-rf-drill]').first().click();
    check(await page.locator('.rp-drill').count()>0,'summary spending drilldown failed');
    await page.locator('.rp-drill-head > b').evaluate(el=>el.textContent='Sample category with a deliberately long label for narrow phones');
    for(const width of [320,390]){
      await page.setViewportSize({width,height:844});
      check(await page.locator('.rp-drill').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'spending drilldown overflows at '+width);
    }
    await go(page,'reports','data-report','property');
    const entity=page.locator('[data-report-entity]');
    const options=await entity.locator('option').evaluateAll(os=>os.map(o=>o.value));
    if(options.length>1){
      await entity.focus(); await entity.selectOption(options[1]);
      check(await entity.evaluate(e=>e===document.activeElement),'entity selection lost keyboard focus');
      check(await entity.inputValue()===options[1],'entity selection was not retained');
    }

    for(const width of [320,390,768,1280]){
      await page.setViewportSize({width,height:844});
      await go(page,'reports','data-report','invest');
      check(await page.locator('.rp-mobile-summary').isVisible()===(width<768),'incorrect responsive mode at '+width);
      check(await page.locator('.rp-comparison-table').isVisible()===(width>=768),'table missing at '+width);
      check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'document overflow at '+width);
    }
  },
  async reportchooser(page){
    await go(page, 'reports');
    const opener = page.locator('#reportsBody [data-report-choose]').first();
    await page.locator('[data-rf="range"]').selectOption('l12');
    await page.locator('[data-rf="compare"]').selectOption('prev');
    const frame = () => page.evaluate(async () => {
      const f = (await import('/src/components/reports.js')).reportFrame;
      return JSON.stringify([f.range,f.from,f.to,f.compare,f.group]);
    });
    const previous = await frame();
    await opener.focus(); await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', {name:'Choose a report'});
    const search = dialog.getByRole('searchbox', {name:'Search reports'});
    check(await search.evaluate(e => e === document.activeElement), 'chooser did not focus search');
    check(await dialog.locator('[data-report]').count() === 21, 'chooser lost a report');
    check(await dialog.locator('[data-report="cashflow"]').getAttribute('aria-current') === 'true', 'chooser did not mark the current report');
    await dialog.locator('button').last().focus(); await page.keyboard.press('Tab');
    check(await page.evaluate(() => !!document.activeElement.closest('.report-chooser')), 'Tab escaped the native report chooser');
    await search.fill('property');
    check(await dialog.locator('[data-report]').count() === 3, 'property search does not distinguish all three property reports');
    const position = await search.evaluate(e => e.getBoundingClientRect().top);
    await search.fill('no-such-report');
    check(await dialog.getByText('No reports match', {exact:false}).isVisible(), 'no-results feedback is missing');
    check(Math.abs(await search.evaluate(e => e.getBoundingClientRect().top) - position) < 1, 'search field moved when results changed');
    await dialog.getByRole('button', {name:'Clear search',exact:true}).click();
    check(await dialog.locator('[data-report]').count() === 21, 'Clear search did not restore the catalogue');
    await search.fill('merchant');
    check(await dialog.locator('[data-report="categories"]').count() === 1, 'description search missed Spending');
    await dialog.locator('[data-report="categories"]').focus(); await page.keyboard.press('Enter');
    await page.waitForFunction(() => !!document.querySelector('[data-current-report="categories"]') && !document.querySelector('.report-chooser'));
    check(await frame() === previous, 'ordinary report selection changed its frame');
    check(await opener.evaluate(e => e === document.activeElement), 'selection did not return focus to Choose report');
    await page.locator('[data-rf="group"]').selectOption('merchant');
    const pinnedFrame = await frame();
    await page.locator('[data-report-pin]').click();
    const id = await stored(page, 'state.savedReports[0].id');
    await go(page, 'reports', 'data-report', 'networth');
    await opener.click();
    check(await dialog.locator('[aria-label="Recently viewed"] [data-report-recent="categories"]').isVisible(), 'recent report shortcut is missing');
    await page.goBack();
    await page.waitForFunction(() => !document.querySelector('.report-chooser'));
    check(await opener.evaluate(e => e === document.activeElement), 'Back did not return focus');
    check(await page.locator('[data-current-report="networth"]').count() === 1, 'cancelling the chooser changed the report');
    await page.locator('#reportsBody [data-report-saved="'+id+'"]').click();
    check(await frame() === pinnedFrame, 'pinned shortcut did not restore its frame');
    // A report has its own address now (/reports/networth); this test server can't serve a nested route the way
    // production's 404 bounce does, so reload from Home.
    await go(page, 'dashboard'); await page.reload(); await quiet(page); await go(page, 'reports');
    await page.locator('#reportsBody [data-report-saved="'+id+'"]').click();
    check(await frame() === pinnedFrame, 'pinned report did not survive reload');
    await opener.click(); await dialog.locator('[data-report-search]').fill('discard this search'); await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('.report-chooser'));
    check(await opener.evaluate(e => e === document.activeElement), 'Escape lost focus');
    await opener.click();
    await page.evaluate(async () => { const d = await import('/src/lib/dialogs.js'); void d.confirmDialog('Sample confirmation', {title:'Sample question'}); });
    await page.getByRole('dialog', {name:'Sample question'}).waitFor({state:'visible'});
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('[aria-labelledby="appDialogTitle"]'));
    check(await dialog.isVisible(), 'closing a question also closed the chooser underneath');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('.report-chooser'));
    for(const width of [320,390,768,1280]){
      await page.setViewportSize({width,height:844});
      await opener.click();
      const fit = await dialog.evaluate(e => { const r=e.getBoundingClientRect(); return r.left>=0 && r.right<=innerWidth+1 && e.scrollWidth<=e.clientWidth+1; });
      check(fit, 'chooser overflows at '+width+'px');
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('.report-chooser'));
    }
  },
  async reportaudit(page){
    page.setDefaultTimeout(10000);
    await page.evaluate(() => {
      window.__csvShares = [];
      Object.defineProperty(navigator, 'canShare', {configurable:true,value:()=>true});
      Object.defineProperty(navigator, 'share', {configurable:true,value:async({files})=>{window.__csvShares.push({name:files[0].name,text:await files[0].text()});}});
    });
    await go(page, "reports", 'data-report', 'cashflow');
    const disclosure = page.locator('[aria-label="Report assumptions and data quality"]');
    await disclosure.locator('summary').focus();
    await page.keyboard.press('Enter');
    check(await disclosure.locator('details').evaluate(el => el.open), 'report disclosure is not keyboard operable');
    check((await disclosure.innerText()).includes('3 Nov 2026'), 'report has no readable as-of date');
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
    check(result.printed.includes('<details open>') && result.printed.includes('3 Nov 2026'), 'print omits readable disclosures');
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

  async billconfirmation(page){
    await quiet(page);
    await page.evaluate(async()=>{
      const {state,commit}=await import('/src/state.js');
      state.shared=[{id:'example-generic-bill',what:'Spending',category:'Utilities',account:'Bank One',amount:100,freq:'Monthly',billKind:'bill'},
        {id:'example-long-bill',what:'Example household subscription with a long descriptive name',category:'Subscriptions',account:'Bank One',amount:200,freq:'Monthly',billKind:'bill'}];
      state.home=Object.fromEntries(state.scenarios.map(name=>[name,[]]));state.properties=[];state.accounts=[{id:'example-bank',name:'Bank One',type:'everyday'}];
      state.transactions=[{id:'example-first-paid',linkedExpenseId:'example-generic-bill',what:'Example bill',date:'2026-08-19',amount:100,account:'Bank One'},
        {id:'example-second-paid',linkedExpenseId:'example-long-bill',what:'Example subscription',date:'2026-08-20',amount:200,account:'Bank One'}];
      commit(['shared','home','properties','accounts','transactions']);
    });
    await go(page,'expenses','data-expenses-sub','spending');
    const planned=await st(page,'JSON.stringify(state.shared)');
    const original=await st(page,'JSON.stringify(state.transactions)');
    if(process.env.BILLS_A11Y){const axe=await import('axe-core');await page.evaluate(axe.default.source);}
    if(process.env.BILLS_SHOTS) fs.mkdirSync(process.env.BILLS_SHOTS,{recursive:true});
    for(const width of [320,390,768,1280]) for(const theme of ['light','dark']){
      await page.setViewportSize({width,height:844});
      await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
      await openBillsToConfirm(page);
      await waited(page,()=>document.querySelectorAll('.bc-confirm-row').length===4,'four separate due payments');
      if(process.env.BILLS_SHOTS) await page.locator('#expenseReviewRoot .review-panel').screenshot({path:path.join(process.env.BILLS_SHOTS,width+'-'+theme+'.png')});
      const layout=await page.locator('.bc-confirm-row').evaluateAll(rows=>rows.map(row=>{
        const r=row.getBoundingClientRect(), n=row.querySelector('.bc-confirm-name').getBoundingClientRect(), d=row.querySelector('.bc-confirm-date').getBoundingClientRect(), a=row.querySelector('.bc-confirm-amount').getBoundingClientRect();
        return {display:getComputedStyle(row).display,width:r.width,nameWidth:n.width,fieldsBelow:n.bottom<=d.top+1&&n.bottom<=a.top+1,inside:r.left>=0&&r.right<=innerWidth&&row.scrollWidth<=row.clientWidth+1&&d.right<=r.right&&a.right<=r.right};
      }));
      check(layout.every(r=>r.display==='grid'&&r.inside),'bill rows lose grid or overflow at '+width+'/'+theme+': '+JSON.stringify(layout));
      if(width<=880) check(layout.every(r=>r.nameWidth>r.width*0.65&&r.fieldsBelow),'mobile bill names are squeezed: '+JSON.stringify(layout));
      check(await page.locator('.bc-confirm-name').first().innerText().then(t=>t.includes('Utilities')&&t.includes('Bank One')),'bill source context missing');
      check((await page.locator('#expenseReviewRoot').innerText()).includes('Each row confirms one payment'),'repeated payments unexplained');
      if(process.env.BILLS_A11Y){const violations=await page.locator('#expenseReviewRoot .review-panel').evaluate(async el=>(await window.axe.run(el,{preload:false})).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.failureSummary)})));check(!violations.length,'bills accessibility: '+JSON.stringify(violations));}
      await page.keyboard.press('Escape');
      await waited(page,()=>!document.querySelector('#expenseReviewRoot .review-panel'),'close bills without confirming');
    }
    check(await st(page,'JSON.stringify(state.transactions)')===original,'opening and closing bills changed transactions');
    await openBillsToConfirm(page);
    await page.locator('.bc-confirm-amount').first().fill('300');
    await page.locator('.bc-confirm-date').first().fill('2026-09-21');
    check(await page.locator('.bc-confirm-check:checked').count()===4,'editing a field toggled a bill checkbox');
    await page.locator('.bc-confirm-check').nth(1).uncheck();
    const expected=await page.locator('.bc-confirm-row').evaluateAll(rows=>rows.filter(r=>r.querySelector('.bc-confirm-check').checked).map(r=>({date:r.querySelector('.bc-confirm-date').value,amount:Number(r.querySelector('.bc-confirm-amount').value)})));
    await click(page,'[data-review-confirm]');
    await waited(page,()=>document.querySelector('.review-complete-note')?.textContent.includes('Logged 3 bills'),'three selected payments logged');
    const added=await st(page,'state.transactions.slice(2).map(t=>({date:t.date,amount:t.amount}))');
    check(JSON.stringify(added)===JSON.stringify(expected),'confirmed dates or amounts differ');
    check(await st(page,'JSON.stringify(state.shared)')===planned,'confirmation changed the budget plan');
    await click(page,'[data-review-close]');
    await waited(page,()=>!document.querySelector('#expenseReviewRoot .review-panel'),'close completed bills');
    await openBillsToConfirm(page);
    check(await page.locator('.bc-confirm-row').count()===1,'confirmed payment offered again or unchecked payment lost');
  },
  async bills(page){
    await go(page, "expenses", "data-expenses-sub", "spending");
    const before = await st(page, "state.transactions.length");
    check(await page.locator('#reviewExpensesBtn').count() === 0, "Cash flow's header still carries a bills-to-confirm button");
    await openBillsToConfirm(page); await until(page, () => !!document.querySelector(".bc-confirm-row .bc-confirm-check:checked"));
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
    // #305: the move is a To do. Property shows no banner — one line of notices and the quiet rate line — and the
    // form opens in a dialog from the To do.
    await go(page, "properties");
    check(await page.locator("#page-properties [data-cr-record]").count() === 0, "Property still carries the cash-rate form");
    check(/cash rate/.test(await page.locator("#attentionLine").innerText()), "Property's line doesn't mention the cash rate");
    // One item on the line, and it has its own action: the line opens the dialog itself, with no stop at the bell.
    check((await page.locator("#attentionLine .attn-count").innerText()).startsWith("1 "), "Property's line has more than the cash rate on it");
    await page.locator("#attentionLine [data-attn-line]").click();
    const dlg = page.getByRole("dialog", { name: "Record the cash rate change" });
    await dlg.waitFor({ timeout: 5000 });
    check(await page.locator("#notifPanel").count() === 0, "the bell opened as well as the dialog");
    check(await page.evaluate(() => !!document.activeElement.closest("#cashRateRoot")), "focus is not in the cash-rate dialog");
    // Closing it without answering leaves the To do, and puts focus back on the line.
    await page.keyboard.press("Escape");
    await until(page, () => !document.querySelector("#cashRateRoot [role=dialog]"));
    check(await st(page, "state.cashRate.seen !== state.cashRate.effective"), "closing the dialog answered the move");
    check(await page.evaluate(() => !!document.activeElement.closest("#attentionLine")), "focus did not return to Property's line");
    // The bell's item opens the same dialog.
    await page.locator(".notif-bell-btn:visible").first().click();
    await page.locator('#notifPanel [data-notif-action="cashrate"]').click();
    await dlg.waitFor({ timeout: 5000 });
    const picks = await page.evaluate(() => [...document.querySelectorAll("#cashRateRoot [data-cr-loan]:checked")].map(x => x.getAttribute("data-cr-loan")));
    check(picks.length > 0, "no loans offered for the rate change");
    await page.fill("#cashRateRoot [data-cr-date]", "2026-11-20");
    await click(page, "#cashRateRoot [data-cr-record]"); await until(page, () => !document.querySelector("#cashRateRoot [data-cr-record]"));
    // The page's line is redrawn after the save, not inside it (as the bell's badge is), so wait for it to catch up.
    await until(page, () => !/cash rate/.test((document.getElementById("attentionLine") || {}).innerText || ""));
    const r = await page.evaluate(async (key) => {
      const s = (await import("/src/state.js")).state, P = await import("/src/calc/property.js");
      const [pid, i] = key.split(":"), l = s.properties.find(p => p.id === pid).loans[Number(i)];
      return { before: P.loanRateOn(l, "2026-11-19"), after: P.loanRateOn(l, "2026-11-20"), change: s.cashRate.change, seen: s.cashRate.seen === s.cashRate.effective,
        panel: !!document.querySelector("#cashRateRoot [data-cr-record]") || /cash rate/.test((document.getElementById("attentionLine") || {}).innerText || "") };
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
  const { ctx, page, errors } = await fresh({blockWorker:name === "bankconfirmfailure", propertyReview:name === "propertystatementreview", bankRead:["bankreadrecovery","bankconfirmfailure"].includes(name), taxFailure:name === "taximporterrors", touch:["rowlabelfocus", "signedamounts", "errorsummarybounds", "billconfirmation", "exactsearch", "errorsummaries", "periodranges", "periodheader", "basicinvestmenthelp", "investmentssummaryhelp", "incomehelp", "propertyremaininghelp", "propertyactionhelp", "propertyfigurehelp", "propertysummaryhelp", "monthhelp", "taxhelp", "projectionhelp", "spendinghelp", "mobileinvestments", "propertycostfields", "propertyoverviewfields", "propertyincomefields", "propertytoolsfields", "propertyrecordfields", "sharesquickperiod", "peoplefields", "taxreturnfields", "taxplanningfields", "budgetclarity", "scenariocalcfields", "scenariofields", "setupfields"].includes(name)});
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
