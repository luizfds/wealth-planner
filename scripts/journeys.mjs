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
//   appdialogs  — shared text/password/decision dialogs, keyboard, nested Back, and scenario leave guards
//   welcomedialogs — standalone import cancellation and approval preserve/replace the saved household
//   datasafety  — a reload keeps the last edit; a tab with work in progress keeps it when another tab saves,
//                 and its own save is refused, recoverable, and reloads to the latest; sample data asks first
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
    await page.keyboard.press('Escape');
    // Focus comes back at the end of an async chain (Escape → history.back() → popstate → close → setTimeout), so
    // wait for it rather than a fixed 400ms, which a busy CI runner missed (#274). The check itself is unchanged.
    await page.waitForFunction(() => { const a = document.activeElement; return !!(a && a.matches('#dashboardSetup [data-firstrun-open]')); }, null, { timeout: 5000 }).catch(() => {});
    check(await opener.evaluate(el => el === document.activeElement), 'closing setup did not return focus to its opener');
    check(await page.locator('.app-shell').evaluate(el => !el.inert), 'closing setup left the app inert');
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
