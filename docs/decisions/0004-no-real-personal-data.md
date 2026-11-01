# 0004 — No real personal data in the repository, ever

**Context.** The repository is public, and so is its history: removing something later means rewriting history and
asking GitHub to purge cached pull-request commits. The app is built against real households' data — the owner's own
backups, payslips and returns are shared in working sessions.

**Decision.** Nothing from a real person's finances or identity goes into code, tests, fixtures, comments, docs, commit
messages or PR descriptions — names, addresses, employers, banks, lenders, merchants, places, account/card/TFN numbers,
salaries, balances, transactions, return figures, purchase or settlement dates, ages, birthdays. That includes the
owner's own.

**Consequences.**
- Fixtures are invented from scratch, far from anything real: Alex and Sam, Employer A, 1 Example St, Fern Café,
  Bank One. Never a real figure scaled, rounded or lightly altered.
- Checking the engine against real data happens outside the repo, and is reported without figures
  ("every label matches").
- A file made from someone's data (a tax-year import, a corrected backup) goes to them directly.
- Before every push, grep the diff for names, places, employers and non-round amounts.
- `prices/universe.json` is a fixed public ticker list — never extended because someone holds a ticker.
