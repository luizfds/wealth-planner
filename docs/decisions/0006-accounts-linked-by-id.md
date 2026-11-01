# 0006 — Rows link accounts by id; the name is a copy

**Decided:** v3.204 (item 235b).

**Context.** Rows named their account by its name. A rename had to walk every array that might name one, and an array
forgotten there kept the old name for good.

**Decision.** Every link carries the account's id beside its name: `account`/`accountId` on rows (budget lines, income,
transactions, money received, home rows, a property's rows, import rules), `from`/`fromId` and `to`/`toId` on transfers
and automatic payments, a card's `autoPayFrom`/`autoPayFromId`, a rule's `transferAccount`/`transferAccountId`; goals,
saved views and month statements by id too. The name is a display copy that `renameAccount` (`calc/accountlinks.js`)
keeps current; migration step 23 links rows written by name, and an edit by name moves the link.

**Consequences.**
- A new array of rows that names an account goes in `everyAccountLink`, or it's neither linked nor renamed.
- Reading a name stays plain `row.account`; `accountFor` / `isLinkedTo` / `link` (or `rowAccount` / `setRowAccount`)
  when the account itself matters.
- Deleting an account leaves its name on the rows — a record of where money moved; an account added again with that
  name relinks them. So a list of accounts must cope with a name that no longer exists: a `<select>` whose value
  matches no option shows the *first* option, which is why `transactionAccountOptionsHtml()` adds `… (deleted)`.
- Categories are still linked by name (`everyCategorisableArray()`).

**Checked by:** `tests/accountlinks.test.js` (counts the linked arrays).
