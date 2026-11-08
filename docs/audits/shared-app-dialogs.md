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
is installed before the app's page/overlay listener. Back cancels just the question. Closing a sheet can be awaited:
scenario creation no longer relies on a fixed delay before opening the name question. Scenario navigation awaits
its leave decision without turning all existing navigation calls into asynchronous operations.

An open native dialog is already pending work under #269, so other tabs cannot redraw it. Folder/Dropbox sync
also defers while a shared question is open, including applying an in-flight response; the normal sync is retried
against current state instead of redrawing a form the person is deciding about.

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
