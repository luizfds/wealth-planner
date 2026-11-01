# Decision records

Why the app is built the way it is — one short record per decision, so `CLAUDE.md` can stay a list of what to do.
Each says what was decided, why, what follows from it, and what checks it. A decision that changes gets a new record
that says which one it replaces; the old one stays.

| # | Decision |
|---|---|
| [0001](0001-no-build-step.md) | No build step: plain ES modules, served as they are |
| [0002](0002-every-change-is-a-release.md) | Every shipped change is a release, versioned by the workflow |
| [0003](0003-local-first-data.md) | The household's data lives in the browser; migrations are numbered steps |
| [0004](0004-no-real-personal-data.md) | No real personal data in the repository, ever |
| [0005](0005-scenarios-are-sandboxes.md) | Scenarios are sandboxes: changes beside the household, never on it |
| [0006](0006-accounts-linked-by-id.md) | Rows link accounts by id; the name is a copy |
| [0007](0007-edits-redraw-what-they-touched.md) | Pages drawn when seen; an edit redraws only what reads what it touched |
| [0008](0008-app-js-is-a-bootstrap.md) | app.js is a bootstrap; each page wires itself; sections are a registry |
| [0009](0009-css-cascade-layers.md) | CSS in explicit cascade layers |
| [0010](0010-one-design-system.md) | One design system: tokens for type, numbers, buttons, cards and categories |
| [0011](0011-one-place-for-each-sum.md) | One place for each piece of financial logic |
| [0012](0012-sync-without-a-server.md) | Sync, receipts and the activity log without a server |
| [0013](0013-testing-in-three-layers.md) | Testing in three layers, and what each can't see |
| [0014](0014-security-baseline.md) | A Content-Security-Policy, escaped text and a local error log |
