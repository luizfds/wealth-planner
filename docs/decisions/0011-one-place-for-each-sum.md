# 0011 — One place for each piece of financial logic

**Context.** Several bugs came from two pages computing the same thing two ways — two IRRs, two repeating-payee
detectors, spending totals that counted transfers.

**Decision.** Financial maths is pure and DOM-free under `src/calc/`, and each question has one answer:
- **Spending** is `state.transactions` only. Transfers (`state.transfers`) and money received (`state.incomeLog`) are
  never spending; a split is ordinary transactions sharing `splitGroup`.
- **Returns:** one IRR and one index unit — `xirr` / `indexValue` in `calc/performance.js`, used by investments,
  Benchmarks and the reports.
- **Repeating payees:** `repeatingPayees` in `calc/recurring.js`; the Budget's unbudgeted list and Bills' subscriptions
  both filter it.
- **A sale's CGT:** `calc/salecgt.js`. **An investment property's tax effect:** the owners' tax with and without it
  (`taxEffectFor`).
- **The period:** "this year" and "this month" are the header's period (`selectedYearWindow`, `selectedMonth`,
  `periodAnchorDate` in `calc/ledger.js`). Anything about *now* — notifications, Before 30 June, the last finished
  year, which years can close — passes today explicitly (`todayTaxFy()`, `localDateStr()`).
- **Imports:** CSV, PDF, OFX/QFX and QIF all become one CSV (`statementTextToCsv`, `calc/bank-import.js`) and go through
  one review, rule and duplicate path.

**Checked by:** `tests/*.test.js` over `calc/`.
