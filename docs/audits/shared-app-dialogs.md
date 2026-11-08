# Shared app dialogs — issue #256

Based on main at v3.228.1. No changes to calculations, stored household shape, release version or service credentials.
Implementation is for review on `codex/shared-app-dialogs`; merge and release remain separate.

## Inventory and interaction contract

The baseline had 36 native prompt/confirm calls across the app and its standalone welcome page. All have been
removed; the browser-controlled before-unload warning for an unsaved scenario remains (a page cannot replace it).

| Call sites | Migration |
| --- | --- |
| `scenarios.js`, `taxwiring.js` | Labelled name entry; explicit create/rename/copy and person-removal decisions. |
| `scenariowiring.js`, `nav.js` | Await scenario discard/leave answers; keep the draft when leaving deliberately. |
| `backup.js`, `datawiring.js`, `welcome.html` | Masked passphrases; confirmation when choosing a new one; explicit backup replacement, tax merge, reset and sample-data approval. |
| `safekeepingwiring.js` | Passcode and sync-passphrase setup validate confirmation before changing credentials; existing-copy unlock is masked too. |
| `safekeepingwiring.js` conflict fallback | Load synced copy / Use this device's copy / Cancel. Cancel returns without pulling or pushing. |
| `budgettoolswiring.js` | Explicit AI copy/send, recurring deletion and occurrence approval; retain exact preview and financial disclosures. |
| `spendingwiring.js`, `propertieswiring.js` | Explicit transaction moves and duplicate rent-statement approval. |
| `app.js` | A sample-data URL still requires approval before replacing a populated household. |

`lib/dialogs.js` supplies decision, text/password and three-way questions. Only static markup uses HTML parsing;
messages, labels and input values use DOM properties. Password values are cleared from the removed dialog and
are never saved or logged by the component. New secrets require matching confirmation; blank optional backup
passphrases still produce plain backups. Minimum passcode length remains four characters.

The native `<dialog>` supplies modal semantics and background exclusion. The shared component traps focus,
handles Enter, Escape and Cancel, and restores the opener (or its replacement after a redraw). Buttons have
explicit action labels. At phone widths it is a bottom sheet with safe-area padding and a scrollable height;
fields retain the existing phone typography/target floors.

`overlaystack.js` keeps the question's history separate from any underlying editor. Its modal popstate listener
is wired explicitly from `components/overlays.js` before the app's page/overlay listener (and on the welcome page). Back cancels just the question. Closing a sheet can be awaited:
scenario creation no longer relies on a fixed delay before opening the name question. Scenario navigation awaits
its leave decision without turning all existing navigation calls into asynchronous operations.

An open native dialog is already pending work under #269, so other tabs cannot redraw it. Folder/Dropbox sync
starts network work immediately with the requested permission/manual/force options, including on tab hiding.
Only applying its response waits until the questions close; the response and the original choice are retained.
Sync setup inspects the copy without changing keys, asks for confirmation only for a new secret, and refuses
to enable sync if a copy appeared/disappeared while the question was open.

## Verification

- Existing backup lifecycle unit assertions are retained. Their Node-only harness supplies asynchronous dialog
  answers through a module loader hook; it does not bypass approval in browser tests.
- Existing `backupstatus`, `recurringrules`, `datasafety` and `twotabs` journeys now operate real dialog controls.
- New `appdialogs` journey at 320px covers creation cancellation/Enter, masked secrets, inline mismatch feedback,
  reveal, focus trap/return, passcode set/remove, message escaping, pending-work detection, Back over an underlying
  sheet with unsaved typing, and scenario leave cancellation/approval with its draft preserved.
- New `welcomedialogs` journey verifies that cancelling a standalone import preserves the stored household and
  approving it imports the chosen synthetic backup.
- Accessibility coverage adds text, password, error, decision and three-way questions in both themes at phone
  and desktop widths; the same states are available for a separate 320px run and saved screenshots.

Final check results are recorded in the PR. All fixtures and screenshots use synthetic data. Chromium emulation
is not a physical iOS/Android or actual screen-reader test. No real Dropbox/folder account was connected; cloud
sync cancellation was checked in source and its generic three-way dialog exercised locally.

## PR review follow-up

All ten review points are addressed on the same branch:

1. Navigation returns its acceptance/completion result; Settings, aliases and moved destinations wait before
   changing subpages or URL. Other paired subpage calls defer behind the pending leave decision.
2. Both tax-year import entry points await post-confirm work inside their error boundaries. Encrypted imports
   distinguish a post-merge failure from a bad passphrase.
3. Sync retains permission/manual/force options and the actual response while a question is open.
4. Network pushes do not wait for a dialog or a hidden-tab timer; only the UI response waits.
5. Existing sync copies ask for one password; new copies require confirmation before enabling sync. The copy's
   existence is checked again at unlock so a race cannot silently create a new key.
6. Overlay close waiters belong to their editor. Failed history insertion closes directly; replacement cancels
   old waiters; a bounded fallback handles a missing popstate without firing a later unrelated action.
7. Bootstrap is synchronous; the populated-household sample question is queued after all listeners are wired.
8. Modal history wiring is explicit, without a global listener side effect from importing a library.
9. Forward onto a dismissed question steps past its inert entry without closing the editor underneath.
10. Dialog-only create/copy flows use the single name validator; inline rename also uses that same rule.

New regression coverage includes Settings/alias/moved-destination cancellation and approval, visible-page/URL
agreement, Back/Forward with an unsaved editor, and injected post-merge failures through normal, dedicated and
encrypted tax-year imports. Isolated tests cover failed/replaced/missing overlay history, retained sync options
and responses, immediate network pushes while UI waits, and existing/new sync setup cancellation. A synthetic
folder transport exercises actual encryption, read-only inspection, correct/wrong passphrases and copy races.
