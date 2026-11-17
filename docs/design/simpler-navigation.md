# Simpler navigation

Status: approved by the owner (November 2026). Roadmap: "Simpler navigation", five steps.

People reported that the app is hard to find their way around: features spread across many places, and no simple
way to go back. A review at v3.286.0 drove the demo household at 390×844 and 1280×800 (nothing expanded) and measured
it. This records what it found and the agreed plan.

## What was measured

**Spread across places.** Cash balances show on four views (Net worth, Accounts, Investments → Cash, Investments →
Offsets) and offsets on Property too. Debts are on Net worth and Investments → Summary; the net worth total on Home,
Net worth, Investments → Summary and the header. Importing starts from seven places (the avatar menu's Import data and
Import backup, Cash flow, Investments, Property, Tax, Settings). "Review" names five things. Shares are three levels
down: Net worth › Investments › a seven-option picker.

**Going back.** Home's four tabs share one address (`/dashboard`), as did every report (`/reports`), so Back skipped
them. Only two views had a visible back link (a Details page, and Investments on a phone), and the Details one called
`history.back()` whenever `history.length > 1` — which leaves the app when the tab was on another site first. On a phone,
Back from Home closed the app; a deep link to any other page had nothing in the app below it.

**Density.** About 40 views and 21 reports. Visible controls per view, default state: Budget 55, Tax → Returns 53,
Projections 51, Bills 44, Insights 43; Settings → Categories 591 (every category's editor drawn open). Spending is 5.6
phone screens long. Reports, Calculators and Backup sit in different places on a phone and a desktop.

## How often each thing is used

The sorting rule for the rest: daily things get the front door, monthly things one tap, yearly and setup things a
More hub or a card in the weeks they matter.

- Daily · weekly: log spend, this month against the plan, bills due, balances, to do, search, transactions.
- Monthly: the monthly review, importing a statement, balances, paying a card, the budget, goals, prices, rent statements.
- Yearly · seasonal: the tax return and its documents, closing the year, Year in review, next year's plan, Before 30
  June, Benchmarks, the year-end pack.
- Setup · what-ifs: scenarios, projections, retirement, the range of outcomes, calculators, categories, import rules,
  people, depreciation and CGT detail, backup and sync.

## The plan, in order

Each step is its own PR.

1. **Back works everywhere.** Every view has its own address — Home's tabs (`/dashboard/insights`) and the chosen report
   (`/reports/budget`) included. Inner pages with no other way out (Details, Reports, Settings, Calculators) get one
   back link in the header, named for where it goes: the screen you came from when you came from inside the app, else
   the page's parent. A deep link to anything but Home puts Home beneath it, so Back reaches Home before it leaves the
   app. The scenario editor keeps its "← Scenarios" (it has a leave guard) and Investments its "‹ Net worth".
2. **One + for adding and importing.** The + sheet gains "Import a file", which works out the kind (bank, payslip,
   broker trades, a manager's statement); page buttons open the same chooser preset. Reports and Calculators sit in the
   same place on a phone and a desktop.
3. **Home becomes Today.** This month, to do, bills, balances, goals. Insights and Benchmarks leave the tab rail (their
   notices already reach the bell). Seasonal cards: the monthly review early in the month, tax time July–October,
   Year in review in July.
4. **Accounts as one list.** Net worth, Accounts, Investments and Property become one list with filter chips (Cash ·
   Investments · Super · Property · Debts); each kind's tools move to its Details page; the repeated net worth and debt
   tiles go. Old ids through `nav.js` ALIASES.
5. **Simple and Advanced.** Advanced sections carry `data-level="advanced"`; one rule in the `utilities` layer hides them
   in Simple. No component branches on the mode — the Classic/Modern split was removed because two renderings of one page
   drifted apart, and this must not bring it back. A page with hidden sections ends with "Show more on this page"; a link
   or to-do that points at a hidden section opens it. New households start Simple, existing ones Advanced. Kept per
   device. The smoke run covers both modes and caps controls per view in Simple. Settings → Categories gets collapsed rows.

Before and after steps 1–3, a five-task check with a few people: log a coffee, groceries this month, update a savings
balance, last year's tax estimate, get back to where you started.

## Step 1 decisions

- The header link goes back through history when the screen before was the app's own (each entry the app writes records
  how deep it is and the name of the screen it came from), so scroll and filters come back as they were, and it is
  named for that screen ("‹ Spending", "‹ Monthly cash flow", "‹ Net worth"). With nothing of the app's below — which
  Home beneath a deep link makes rare — it goes Home. Never `history.length`: it counts other sites in the tab.
- It shows on Details, Reports, Settings and Calculators only. Pages in the menu have the menu; Accounts and Property
  keep Net worth's rail. On a phone it sits on its own line above the title, and shrinks to a 44px chevron when the
  header does. Details' own "← Back" went, so there is one.
- Home's Overview stays at `/dashboard`, so old links and bookmarks keep working; the other tabs add a segment
  (`/dashboard/insights`). Reports name the report (`/reports/budget`); a pinned report opens at its report's address,
  its saved dates are not in it.
- Search opening a result replaces the search sheet's entry, not the page's: the result counts as a step on from the
  page under the sheet, so its back link names that page.
- Found while building it, on main too: a link into another page's tab (`data-go`, notices, empty states) chose the tab
  with "replace" while the page change still waited for its view transition, so it replaced the entry of the page
  being left — Back from Spending skipped Tax. A tab written while its page change is pending now pushes or replaces
  as the page asked (nav.js `pendingPageWrite`).
- Journey: `backeverywhere` (390 and 1280px) walks Home → Insights → Spending → two reports → Net worth → a Details page,
  then Back the whole way, follows a link from Tax into Spending and back, and opens a shared report link through the
  404 bounce.

## Step 2 decisions (#411)

- The + button (the header's on a desktop, the round one on a phone) always opens one sheet. Before, it ran the page's own
  action on 8 views (Log spend on Home and Cash flow, Add holding on Shares…) and opened Quick actions on the other 9,
  so the same button did different things. The sheet leads with this page's own action, then logging, Import a file and
  adding. Log spend becomes two taps from +; Spending's list keeps its own one-tap "+ Log spend".
- Reports, Calculators and Settings stay where they are (sidebar and avatar menu) until step 3 brings the More tab, so
  they move once.
- As built: the sheet ("Add, log or import") groups On this page · Log · Import · Add something new. Adding is a
  two-column grid of short names ("Budget line", "Cash account"…), each with its full name and hint as its accessible
  name, so the sheet fits a 320×844 phone and a 1280×800 desktop without scrolling. The page's own row runs once the
  sheet's history entry is gone; Import a file opens the import chooser in the sheet's place, so Back closes it and
  doesn't bring the sheet back. An empty state's next step with no target of its own still runs the page's action
  directly (`runPageAction`). The avatar menu's item is renamed to match. Journey `plussheet`.
- "Works out the kind" is Spending's statement reader (bank, loan, property manager, payslip), now the chooser's first
  choice, "Any statement file". Broker trades are not recognised from a statement file yet; they keep their own choice.

