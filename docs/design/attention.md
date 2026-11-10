# One place for what needs attention (#305)

**Status: agreed (decisions at the end). Step 1 (one list) is implemented; the rest is not yet.** Part of #253; step 2 of the November
roadmap. It builds on [pages.md](pages.md) (how a page is put together) and the shared dialogs from #256.

## What there is today

Measured on main at v3.239.0 with the demo household, at 390×844, on a fixed date. Six surfaces, four sources:

| Surface | Where | Source | Demo household |
|---|---|---|---|
| Notifications (the bell) | Header | `lib/notifications.js`, 17 generators | 5 items |
| "The app notices" strip | Budget, every Tax tab, Plan → Scenarios (and Income, Accounts, Investments when they have any) | `calc/advice.js`, by `area` | 1, 2 and 3 items |
| "What the app notices" | Home → Insights | `calc/advice.js`, all of it | 11 items |
| To do | Home → Overview | `homeTodos()` in `components/home.js` | 2 items |
| Checks | Home → Review | `calc/health.js` | 1 item |
| Page banners | Property (cash rate) | `components/cashrate.js` | 1 |

What is wrong with it:

- **Stacks above the content.** The strip is 151px on each of the four Tax tabs, 274px on Plan → Scenarios and 85px on
  Budget. The cash-rate banner is 319px, with a form in it, above Property's first tile.
- **The same notice on tabs it isn't about.** Tax's two notices are about pay (they go to Tax → People) and show on
  This year, Returns and Documents as well, because a strip follows its page's `area`, not the tab.
- **Two lists of to-dos that don't agree.** The bell and Home's To do are built by different code from the same facts.
  In the demo both say the return is due, only To do says the month needs reviewing, and only the bell says a bill is
  due. Each has its own wording for the same thing ("FY25/26 tax return due 31 October — 4 days left" and "Lodge
  FY25/26 — 4 days to 31 October").
- **Four vocabularies.** Advice is Watch / Opportunity / Worth knowing / On track; notifications are bad / warn / info
  dots; To do is a coloured edge; Checks are bad / warn / info.
- **Raw dates** in the bell ("Due 2026-10-31").
- **Advice can't be put away.** A notice goes only when its figures change, so "Wants were 18% of spending" sits on
  Budget every visit.

## The design

### One list, two groups

Everything that asks for attention is one list of items of one shape, built in one place (`lib/attention.js`):

| Group | What is in it | From |
|---|---|---|
| **To do** | Something with a date or an action: a bill due, a return to lodge, a month to review, transactions to review, a balance to update, a rate change to record, a backup, things to fix in Checks | Today's notifications, plus the to-dos only Home had (transactions to review, stale account balances, a rent review, a fixed rate ending) |
| **Worth knowing** | An observation from the figures: Watch, Opportunity, Worth knowing | `calc/advice.js`, unchanged |

- **One generator per fact.** Where the bell and Home both made an item (lodging, the month's review, Checks, a
  backup), one remains, with one wording.
- **On track** stays what it is: a fold on Home → Insights. It asks for nothing, so it is not in the list.
- **Checks** stay on Home → Review. The list carries one To do for them ("2 things to fix in Checks"), as now.
- **No rule changes.** What raises an item, and its figures, are untouched. This is about where items show.

### Where the list shows

| Surface | Shows |
|---|---|
| **The bell** | The whole list, in two groups: To do first, then Worth knowing. |
| **Home → Overview, To do** | The first few To do items from the same list, same wording, and "All of them" opening the bell. |
| **Home → Insights** | Worth knowing in full, with each item's detail, the On track fold and the written review. The reading view. |
| **A page** | One line, not a stack: "3 things to look at". It opens the bell showing only that view's items. |
| **Home → Review** | Checks, as now. |

- **A page's line counts only what is about that view.** An item belongs to the page and tab it sends you to. One with
  no tab belongs to the page's first tab. So Tax's pay notices count on People only.
- **What the page already shows in full stays off its line**, as today (`SHOWN_ON_PAGE`: a person's super room on Tax).
- **No line when there is nothing**, so most views show none.

### The bell's count

- **It counts To do items not yet opened.** Worth knowing never adds to it.
- Opening an item marks it read, as today. A new instance (the next bill, the next month) is a new item.

### Putting advice away

- **Opportunity and Worth knowing can be dismissed.** A dismissed notice stays hidden until its figures change, which is
  when its title changes; then it comes back.
- **Watch can't be dismissed.** A scenario short of cash or a thin emergency fund goes when it is fixed.
- **Dismissals are saved with the household** (a new `state` key, so they follow a backup and sync), not per device.
- To do items aren't dismissed: they are done, or marked read.

### A prompt that needs a decision

- **The cash-rate change becomes a To do** ("The RBA raised the cash rate: record it on your loans"). It is already a
  notification; it now carries the action.
- **Property shows it as part of its one line.** The form (which loans, from what date) opens in a dialog (#256), with
  "Not now" as its cancel.

### One vocabulary, one look

| Label | Used for | Colour |
|---|---|---|
| Urgent | A To do that is overdue or days from its date | `--bad-ink` |
| To do | A To do waiting on you | `--warn-ink` |
| Reminder | A To do that only tells you something: the week's recap, a return not due for months | `--ink-soft` |
| Watch | Advice that is a risk | `--bad-ink` |
| Opportunity | Advice with something to gain | `--good-ink` |
| Worth knowing | Other advice | `--ink-soft` |

- An item is a row with its label, title, one line of detail and where it goes. The same row in the bell, on Home and
  on Insights.
- Dates read "31 Oct", through `fmtDate`, everywhere.
- Risk wording from #212 is unchanged.

## How it ships

Each step is its own PR, with the smoke run, journeys and accessibility scan at 320, 390 and 1280px.

1. **One list.** `lib/attention.js`; the bell in two groups with the new count; Home's To do reading the same list;
   one wording per fact; one date format and one set of labels. A unit test that each fact makes one item.
2. **One line per page.** The strips go; the line opens the bell filtered to the view; items belong to their tab. A
   smoke check that no view has more than one line of notices above its content.
3. **Dismiss.** A `MIGRATION_STEPS` entry for the new key, its test, the key in `calc/activity.js`'s SKIP, and a journey:
   dismiss, change a figure, see it return.
4. **The cash-rate prompt as a To do and a dialog.** The existing cash-rate journey moves to the dialog.

## Decisions from review (10 November 2026)

1. **Pages show one line**, not a stack and not nothing.
2. **The bell counts To dos only.**
3. **Advice can be dismissed, except Watch.**
4. **The cash-rate prompt is a To do with a dialog**, not a banner that expands in place.
