# Wealth Planner

A free planner for an Australian household's money: a budget, spending brought in from your bank statements, income
tax and super worked out, everything you own and owe, and a plan — keep renting or buy, how net worth grows, when you
could stop working. It runs in your browser, and what you enter stays there.

**Take a look:** <https://luizfds.github.io/wealth-planner/about/>. Try it with the sample household, or start with
your own. [Open the app](https://luizfds.github.io/wealth-planner/) to return to a saved household.

## Private by design

- **No account, no server.** Your household lives in this browser's storage. Nobody else can read it, and there's no
  one to send it to.
- **It only leaves when you choose:**
  - a **backup** is a file you download (optionally encrypted);
  - **sync** between devices sends it encrypted with a passphrase only you know, to your own Dropbox or a folder you
    pick;
  - **price updates** ask for ticker names (VAS, IVV), never amounts;
  - **Ask Claude** sends a minimised summary of your figures, only with your own API key and only when you ask.
- **No bank logins.** Statements come in as files you download from your bank (CSV, PDF, OFX/QFX, QIF).
- **Clearing your browser's data clears the household** — keep a backup.

## What's in it

Today · Money · Accounts · Plan, and under More: Tax, Reports, Calculators, Settings and Backup & sync. Every page,
tab and what it does is in [docs/sitemap.md](docs/sitemap.md). In short:

- **Today** — net worth and how it moved, where you stand this month, what needs you, and a monthly review.
- **Money** — a budget split into essentials and lifestyle, transactions imported and filed by rules it learns, bills,
  income after tax, and trips planned with their own budgets.
- **Accounts** — bank accounts, shares and crypto with daily prices, super, property with its loans, offsets and rent,
  and a purchase in progress through to settlement.
- **Plan** — rent-or-buy scenarios with stamp duty and LMI, projections years out, goals and retirement.
- **Tax** — income tax, Medicare and super for each person, payslips checked, each year's return in myTax's order,
  rental schedules and the documents to keep.
- **Reports** — cash flow, budget, net worth, investments, property, tax, the year in review and a lender pack, to
  print or download as CSV.

It's general information, not financial advice: figures are worked out from what you enter and the rules as the app
knows them.

## Running it

There's no build step: `index.html`, `styles.css` and ES modules under `src/`. Modules don't load from `file://`, so
serve the folder:

```
python3 -m http.server 8934     # then http://localhost:8934/index.html
```

Add `?mock=1` to start with the sample household.

## Tests

```
npm install                     # the linters only — the app itself has no dependencies
npm test                        # node --test over tests/*.test.js
npm run check                   # ESLint (with the project's own rules), TypeScript over calc/, stylelint
```

The browser checks need Playwright at the version CI uses:

```
npm i --no-save playwright@1.56.0 && npx playwright install chromium
node scripts/smoke.mjs          # every page at phone, tablet and desktop widths, light and dark
node scripts/journeys.mjs       # real flows, end to end
node scripts/landing-shots.mjs /tmp/wealth-planner-shots  # screenshots of the sample household
```

## How it's built, and why

- [docs/architecture.md](docs/architecture.md) — what lives where.
- [docs/decisions/](docs/decisions/README.md) — one short record per decision (no build step, local-first data, every
  change a release, scenarios as sandboxes, …).
- [CLAUDE.md](CLAUDE.md) — the working rules, for people and for Claude Code.

Every merged pull request is a release: a workflow versions, stamps, tests, tags and deploys it to GitHub Pages.

**No real personal data, ever** ([decision 0004](docs/decisions/0004-no-real-personal-data.md)): this repository and
its history are public. Names, places, employers, banks, merchants and figures in code, tests, fixtures, docs, commits
and pull requests are invented.
