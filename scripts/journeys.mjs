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
async function go(page, pageId, subAttr, sub){
  await page.evaluate(([p, a, s]) => { const b = document.querySelector('.mobile-tab[data-page="' + p + '"]') || document.querySelector('[data-page="' + p + '"]'); b.click(); if(a) setTimeout(() => document.querySelector("[" + a + '="' + s + '"]').click(), 50); }, [pageId, subAttr, sub]);
  await page.waitForTimeout(700);
}
const click = (page, sel) => page.evaluate(s => { const el = document.querySelector(s); if(!el) throw new Error("No " + s); el.click(); }, sel);

const JOURNEYS = {
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
    await page.waitForTimeout(400);
    check(await opener.evaluate(el => el === document.activeElement), 'closing setup did not return focus to its opener');
    check(await page.locator('.app-shell').evaluate(el => !el.inert), 'closing setup left the app inert');
    await page.evaluate(async original => {
      const s = await import('/src/state.js'); s.setState(s.migrateState(JSON.parse(original)));
      (await import('/src/calc/engine.js')).recalcComputedItems();
      (await import('/src/components/redraw.js')).renderAll();
    }, original);
    await go(page, 'plan', 'data-plan-sub', 'scenarios');
    const compare = page.locator('.cmp-scroll');
    await compare.focus(); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(300);
    check(await compare.evaluate(el => el.scrollLeft > 0), 'scenario table cannot scroll with the keyboard');
    await go(page, 'reports');
    await page.locator('[data-report="networth"]').click();
    const report = page.locator('#reportSheet .rp-scroll');
    await report.focus(); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(300);
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
    page.once('dialog', async d => { message = d.message(); await d.dismiss(); });
    await preview.click();
    check(message.includes('\n\n2026-10-01') && !message.includes('\\n'), 'preview must show readable occurrence lines');
    check(await st(page, "state.transactions.length") === before, 'cancelled preview wrote transactions');
    page.once('dialog', d => d.accept());
    await preview.click();
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
    page.once('dialog', d => d.accept());
    await page.locator('[data-rr-delete="' + id + '"]').click();
    check(await st(page, "state.recurringRules.some(r => r.what === 'Synthetic service')") === false, 'rule deletion did not persist');
    check(await st(page, "state.transactions.length") === before + 2, 'deleting a rule deleted its historical payments');
  },
  async reportaudit(page){
    page.setDefaultTimeout(10000);
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
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    check(!overflow, 'report scrolls sideways on mobile');
    const setup = page.locator('[aria-label="Planning setup progress"]');
    await setup.locator('summary').click();
    const goals = setup.getByRole('button', { name: 'Review Goals', exact: true });
    await goals.focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    check(await page.locator('#planSub-goals').isVisible(), 'setup Goals action did not open Plan goals');
  },

  async bills(page){
    await go(page, "expenses", "data-expenses-sub", "spending");
    const before = await st(page, "state.transactions.length");
    const btn = await page.$("#reviewExpensesBtn:not([hidden])");
    check(btn, "no \"bills to confirm\" button on the sample household");
    await btn.click(); await page.waitForTimeout(500);
    const n = await page.evaluate(() => document.querySelectorAll(".bc-confirm-row .bc-confirm-check:checked").length);
    check(n > 0, "the sheet lists no bills");
    await click(page, "[data-review-confirm]"); await page.waitForTimeout(600);
    const after = await st(page, "state.transactions.length");
    check(after === before + n, "confirming " + n + " bills logged " + (after - before));
    check(await page.evaluate(() => /Logged/.test(document.querySelector(".review-panel").innerText)), "no \"Logged\" note after confirming");
  },
  async transfer(page){
    await go(page, "expenses", "data-expenses-sub", "spending");
    await click(page, "#transactionsTable [data-cf-transfer]"); await page.waitForTimeout(300);
    const accts = await page.evaluate(() => [...document.querySelector('#transactionsTable [data-tf="from"]').options].map(o => o.value).filter(Boolean));
    const bal = () => page.evaluate(async (a) => { const s = (await import("/src/state.js")).state, ac = await import("/src/calc/accounts.js"); return a.map(n => Math.round(ac.accountBalance(s.accounts.find(x => x.name === n)).balance || 0)); }, accts.slice(0, 2));
    const before = await bal();
    await page.fill('#transactionsTable [data-tf="amount"]', "250");
    await page.selectOption('#transactionsTable [data-tf="from"]', accts[0]); await page.selectOption('#transactionsTable [data-tf="to"]', accts[1]);
    const box = await page.$('#transactionsTable [data-tf="balances"]'); if(box && !(await box.isChecked())) await box.check();
    await click(page, "#transactionsTable [data-tf-save]"); await page.waitForTimeout(400);
    const after = await bal();
    check(after[0] === before[0] - 250 && after[1] === before[1] + 250, "balances " + JSON.stringify(before) + " → " + JSON.stringify(after));
    check(await page.evaluate(() => document.querySelector("#transactionsTable").innerText.includes("250")), "the transfer isn't listed");
    await page.evaluate(() => [...document.querySelectorAll(".toast button")].find(b => /undo/i.test(b.innerText)).click()); await page.waitForTimeout(400);
    check(JSON.stringify(await bal()) === JSON.stringify(before), "Undo didn't put the balances back");
    check(await st(page, "state.transfers.filter(function(t){ return t.amount === 250; }).length") === 0, "Undo left the transfer");
  },
  async autopay(page){
    await go(page, "accounts");
    await page.evaluate(() => { const c = [...document.querySelectorAll("#accountsTable .acct-card")].find(c => /loan/i.test(c.innerText)); c.querySelector(".acct-card-toggle").click(); });
    await page.waitForTimeout(400);
    await click(page, "[data-ap-add]"); await page.waitForTimeout(400);
    const from = await page.evaluate(() => [...document.querySelector('[data-ap-field="from"]').options].map(o => o.value).find(v => /everyday/i.test(v)));
    await page.selectOption('[data-ap-field="from"]', from);
    await page.fill('[data-ap-field="amount"]', "1850"); await page.press('[data-ap-field="amount"]', "Tab");
    await page.fill('[data-ap-field="start"]', TODAY.slice(0, 10)); await page.press('[data-ap-field="start"]', "Tab"); await page.waitForTimeout(300);
    await go(page, "dashboard");
    check(await page.$('[data-home-card="autopay"]'), "Home doesn't ask about the payment on its day");
    await click(page, "[data-ap-other]"); await page.waitForTimeout(200);
    await page.fill(".ap-other-amount", "1912.35");
    await click(page, "[data-ap-other-save]"); await page.waitForTimeout(400);
    const ap = await st(page, "{ amount: state.autoPayments[0].amount, tx: state.transfers.filter(function(t){ return t.autoPay; }).map(function(t){ return t.amount; }) }");
    check(ap.amount === 1912.35 && ap.tx.length === 1 && ap.tx[0] === 1912.35, "after answering: " + JSON.stringify(ap));
    check(!(await page.$('[data-home-card="autopay"]')), "Home still asks after the answer");
  },
  async scenario(page){
    await go(page, "plan", "data-plan-sub", "scenarios");
    const name = await page.evaluate(() => [...document.querySelectorAll("#cards [data-edit-scenario]")].map(b => b.getAttribute("data-edit-scenario"))[1]);
    const card = () => page.evaluate(n => document.querySelector('#cards [data-edit-scenario="' + n + '"]').closest(".card").innerText.replace(/\s+/g, " "), name);
    const before = await card();
    await click(page, '#cards [data-edit-scenario="' + name + '"]'); await page.waitForTimeout(800);
    check(await page.evaluate(() => document.body.getAttribute("data-current-page") === "scenario"), "Edit didn't open the scenario's page");
    check(await page.evaluate(() => getComputedStyle(document.getElementById("mobileTabbar")).display === "none"), "the bottom tabs show while editing");
    await click(page, "[data-sc-addsheet]"); await page.waitForTimeout(300);
    await click(page, '[data-sc-new="cost"]'); await page.waitForTimeout(600);
    await click(page, "[data-sc-save]"); await page.waitForTimeout(800);
    check(await page.evaluate(() => document.body.getAttribute("data-current-page") === "plan"), "Save didn't go back to Plan");
    check((await card()) !== before, "the card didn't change after saving a new cost");
    await click(page, '#cards [data-edit-scenario="' + name + '"]'); await page.waitForTimeout(800);
    await click(page, "[data-make-real]"); await page.waitForTimeout(500);
    check(await page.evaluate(() => /THIS WILL|This will/.test((document.querySelector("[data-mr-backdrop]") || {}).innerText || "")), "Make it real shows no plan");
    await page.keyboard.press("Escape");
  },
  async csv(page){
    await go(page, "expenses", "data-expenses-sub", "spending");
    const before = await st(page, "state.transactions.length");
    await page.setInputFiles("#bankImportFile", { name: "statement.csv", mimeType: "text/csv", buffer: Buffer.from(STATEMENT_CSV) });
    await page.waitForSelector("#bankImportConfirmBtn", { timeout: 10000 });
    await click(page, "#bankImportConfirmBtn"); await page.waitForTimeout(600);
    const after = await st(page, "state.transactions.length");
    check(after === before + 2, "the CSV's two purchases didn't land (" + (after - before) + ")");
  },
  async pdf(page){
    await go(page, "expenses", "data-expenses-sub", "spending");
    const before = await st(page, "state.transactions.length");
    await page.setInputFiles("#bankImportFile", { name: "statement.pdf", mimeType: "application/pdf", buffer: statementPdf() });
    await page.waitForSelector("#bankImportConfirmBtn", { timeout: 20000 });
    check(await page.evaluate(() => /3 transactions to import/.test(document.getElementById("bankImportPanel").innerText)), "the PDF's three purchases weren't read");
    await click(page, "#bankImportConfirmBtn"); await page.waitForTimeout(600);
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
    await page.evaluate(() => [...document.querySelectorAll("[data-as-log]")].find(b => b.offsetParent).click()); await page.waitForTimeout(600);
    check((await st(page, "state.incomeLog.length")) === before + 1, "logging it didn't record the rent received");
  },
  // Item 243: a loan account's statement — its interest and fees go on the loan, nothing lands as spending.
  async loanstatement(page){
    await go(page, "expenses", "data-expenses-sub", "spending");
    const tx = await st(page, "state.transactions.length");
    await page.setInputFiles("#bankImportFile", { name: "Investment loan statement.csv", mimeType: "text/csv", buffer: Buffer.from(LOAN_STATEMENT_CSV) });
    await page.waitForSelector("[data-bank-loan]", { timeout: 10000 });
    check(/Record 5 on the loan/.test(await page.evaluate(() => document.getElementById("bankImportConfirmBtn").textContent)), "the loan's charges weren't offered");
    await click(page, "#bankImportConfirmBtn"); await page.waitForTimeout(600);
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
    await click(page, "#cashRatePanel [data-cr-record]"); await page.waitForTimeout(400);
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
  const { ctx, page, errors } = await fresh();
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
    await click(page, "#transactionsTable [data-cf-transfer]"); await page.waitForTimeout(300);
    await page.evaluate(() => { const f = document.querySelector('#transactionsTable [data-tf="from"]'), t = document.querySelector('#transactionsTable [data-tf="to"]'), o = [...f.options].map(x => x.value).filter(Boolean); f.value = o[0]; t.value = o[1]; document.querySelector('#transactionsTable [data-tf="amount"]').value = "75"; });
    const ms = await page.evaluate(() => { const t0 = performance.now(); document.querySelector("#transactionsTable [data-tf-save]").click(); return performance.now() - t0; });
    if(i) transfers.push(ms);
    await page.waitForTimeout(300);
  }
  results.transfer = Math.round(median(transfers));
  await go(page, "plan", "data-plan-sub", "scenarios");
  await page.evaluate(() => { const b = [...document.querySelectorAll("#cards [data-edit-scenario]")][1]; if(b) b.click(); }); await page.waitForTimeout(1000);
  await click(page, "[data-sc-addsheet]"); await page.waitForTimeout(400);
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
