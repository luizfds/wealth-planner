# App assessment — 24 November 2026 (v3.330)

A whole-app pass after the November series of reviews (Today, Money, Property, Tax, Settings, import and setup), to
find what's left and to plan what comes next, a public landing page among it. The companion
[sitemap](../sitemap.md) lists every page and what it does.

## How it was done

- Every view the smoke run knows (`scripts/smoke.mjs` `VIEWS`: 51 views and reports) opened at 390px with the sample
  household; each one's headings, folds, buttons and fields recorded and photographed, top of the page and whole
  page. The add menu, search, the period picker, More and three desktop pages (1280px) too.
- Read against `index.html`, `components/` and `calc/`, the decisions and the roadmap, so a finding is checked before
  it's written down (Show as's Hour, for one, is deliberate — each person's own hours).
- Sample data only. Nothing here comes from a real household.

The app is in good shape: no page errors on any view, one set of figures everywhere, every report in eight families.
What's left is mostly small: a few fields that aren't the shared field yet, one switch drawn wrong, labels from older
versions, and the length of three pages.

## Findings

Ranked: **A** wrong or broken, **B** confusing, **C** polish. Each keeps every feature (CLAUDE.md: nothing is removed
without the owner agreeing).

### A — wrong or broken

| # | Where | What | Suggested change |
| --- | --- | --- | --- |
| A1 | Calculators › Stamp duty | The *First home buyer* switch's track is drawn across its label at 390px ("First / h / buyer" with the knob over the text). Came with the calculators' switches in PR #481. | Lay the switch out as the shared switch does elsewhere (label, then a fixed-size track); a smoke check for a switch narrower than its label. |
| A2 | Settings › Import rules | The test field's placeholder names a real city. Comments in `calc/import-rules.js` and `calc/merchants.js` use a real supermarket and city in their examples. Decision 0004: no real places. | Invented examples ("FERN CAFE 1234 EXAMPLETON"). The brand list in `merchantbook.js` stays: public brand names are its purpose. |
| A3 | `manifest.webmanifest` | The install shortcuts are named for pages that no longer exist ("Income & Tax", "Expenses", "Assets", "Properties"). | Today, Money, Accounts, Plan, at their current addresses. |

### B — confusing

| # | Where | What | Suggested change |
| --- | --- | --- | --- |
| B1 | Accounts › Bank accounts | "Owed on cards and loans −$452,000" above a **Debts** fold saying "Total $0": the property loan counts in one and not the other. | Say what each holds: "Owed, property loans included" and "Other debts (not on a property)". |
| B2 | Accounts › Offsets | The offset's balance is a raw number field ("26840") in a cramped row; the loan's name wraps a word a line at 320px. | The shared money field (`$26,840`), and the row stacked at phone widths. |
| B3 | Tax › Returns › rental schedule | Each return line's field shows a raw number ("30680", "0.00"). | Money fields, as on the rest of Tax since PR #481. |
| B4 | Plan › Retirement | "Your age now" is empty though People has each date of birth; the Financial independence card asks the age again ("I'm — and want to stop working at —"). | Fill both from the date of birth (still editable); one place to type it. |
| B5 | Money › Budget | Two inboxes side by side: "N things to tidy" and "N notices", plus the page's "N to look at" strip. | One entry — "N to look at" — opening one list with sections (tidy, suggestions, checks). Every item stays. Mock-up first. |
| B6 | Sample household | Both people's super funds are named "Superannuation", so the sample's own Checks flag "a name shared by two things" and the Super page lists two identical names. The sample is the first thing a new visitor (and the landing page's screenshots) sees. | Name them per person ("Alex's super", "Sam's super"); a test that the sample raises no Checks. |
| B7 | Investments › Shares | A day's change that rounds to 0% shows as a fall ("▼ $5 (0%)" in red). | Under 0.05%, show it flat ("$5 · 0%") in plain ink. |

### C — polish

| # | Where | What | Suggested change |
| --- | --- | --- | --- |
| C1 | More (phone) | Shows the period chip, though nothing on More follows the period. | Hide it on More, as on Settings. |
| C2 | Reports | Budget vs actual and Lender pack show no family kicker (their family has one report); the other nineteen do. | Show the family on every report, one report or not. |
| C3 | Accounts on a desktop | One long column at 1280px: names at the left edge, figures at the right, a wide gap between. | A two-column grid of groups from ~1100px, or a narrower list beside the folded charts. |
| C4 | Page length at 390px | Property 8,800px, Budget 6,500px, Scenarios 6,400px, Tax › This year 5,700px — the longest pages. | Fold what's below the first screen behind its heading (as Settings did); keep every part. Mock-up first. |
| C5 | Today | The "Sample data generated" toast sits over the round + button for its time on screen. | Toasts above the + button on a phone. |

### Carried over

- **errorsummarybounds** journey: "Execution context was destroyed" on main after #483 (first seen on PR #450), with no
  navigation request logged — so not a reload the app started. Re-run once; find the cause if it comes back.
- **#299** screen reader on a real device — the owner's checklist (`docs/audits/screen-reader-checklist.md`).
- The owner's own household: clean the two flagged days in Accounts › Net worth history; check the iPad header.

## What's next, beyond fixes

1. **A public landing page** — see [docs/design/landing-page.md](../design/landing-page.md). Today a stranger sees
   `onboarding.html`, which is `noindex` and written for someone already in the app.
2. **Screenshots from the sample household**, made by a script (light and dark, phone and desktop) so the landing
   page and the README always show the current app. Needs B6 first.
3. **A README** for the repository: what it is, the privacy model, how to run it, the decisions — the repo is public
   and has none.
4. **The first five minutes**, measured: from the landing page through setup to a first import, as a journey with a
   time budget, so the path a new visitor takes stays short.
