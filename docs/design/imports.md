# Shared import discovery

The Import data chooser is the first slice of issue #265. The avatar menu, relevant page actions and global search all open the same native modal. It groups statements, investments and spreadsheet rows, with supported formats and destinations stated before selection. Backup restore has its own replacement section.

A choice navigates to an existing tool, opens its disclosure/menu and focuses its control. It does not select a file, call a parser or confirm an import. Back returns to the origin. Escape, Cancel and backdrop dismissal return focus to the visible opener, including the menu toggle when the original menu item is hidden. Tab stays inside the chooser. No new persistent state or import data model is introduced.

Bank and loan statements use Spending's existing CSV/PDF/OFX/QFX/QIF workflow. Property PDFs use the existing statement recognition and property selection there. Payslips lead to Tax's per-person checks; the parsed figures are staged for explicit review before updating year-to-date figures, with Undo. Broker trades open the Shares trade tool. Prices open the existing Prices tool for paste or Google Sheet configuration. Budget, income and asset CSVs open their own template/preview controls. Restore leads to Preferences' existing Open a backup file control and confirmation flow.

Without an investment property, a person or a share holding, the relevant choice explains the prerequisite and opens its Add control. Opening the Add editor is a separate explicit action. Navigation refreshes the header's moved import/export controls synchronously before focusing them.

## Validation and remaining work

The `importchooser` journey measures every choice and the modal at 320/390/768/1280px in both themes, checks keyboard/touch navigation, focus containment/return, Back/Escape, all destinations, empty-household prerequisites and unchanged in-memory/persisted household data. `IMPORT_A11Y=1` adds eight scoped axe scans; `IMPORT_SHOTS` retains chooser screenshots separately from page defaults.

Issue #265 is complete. Every importer has its Select → Review → Confirm → Result contract: statements (bank, loan, property, payslip), broker trades, spreadsheet rows, pasted prices and backup restore, each in its own section below. Actual devices and screen readers remain #299.

## Payslip year-to-date review

Pasting text, choosing a PDF on a person's tax card, and recognising a payslip PDF in Spending all stage the parsed figures in memory. They do not change saved YTD figures. The review names the person and shows both proposed figures and the saved date/gross/tax. Missing or invalid YTD data cannot be applied; duplicate figures are identified. An older payslip offers an explicit Replace newer year-to-date figures action with both dates visible.

Save checks that the person still exists and the saved figures match those shown in the review. An intervening edit requires another review. Undo restores the previous YTD only if no later edit replaced the applied figures. Dismissal discards the pending read; failed parsing keeps pasted text for correction. A newer read or dismissal invalidates an earlier PDF callback. The PDF chooser is a keyboard-operable button.

Salary updates and logging take-home pay remain separate explicit actions. An inbox payslip is not moved to Imported on reading or applying figures; Finish review explicitly completes that file, including when its figures were already saved. Dismissing leaves it available. Reading does not certify the inferred person or source currency; check the named destination and parsed figures. Broader import mapping/currency/recovery work stays in #265.

The payslipreview journey checks staging, dismissal, malformed/partial/invalid/duplicate/older reads, stale saves and guarded Undo, deleted people, cancelled asynchronous failure, direct and recognised PDFs, persisted-state invariance before apply, and four widths in both themes with scoped axe checks.

## Broker trade review

Broker reads are staged with loading/error/cancel/retry states and retained paste text. A newer read or cancellation invalidates older file completions. Editing pasted text requires another Read before Apply. CSV and Excel file selection is keyboard-operable.

A unique matching holding is preselected by stable identity; ambiguous or missing matches require a destination or explicit Leave out. Options name the holding, person and currency. Reordering assets cannot redirect a selection, and a deleted/changed destination is reviewed again. The review shows date range, purchase/sale counts and totals in the source/destination currency, duplicate and skipped rows, and unrecognised tables. Known source currencies must match the destination; mixed currencies within a ticker are blocked until split or left out. No conversion is performed. When the file has no currency column, the user must check it against the destination.

Identical input rows (including any Reference) count once; distinct reference values preserve separate same-detail trades within a read. Existing recorded-trade matching remains date/units/price based for purchases and date/units based for sales, so historical matching cannot certify order identity. FIFO allocation, current holding quantities and existing cost-base warnings remain unchanged.

Apply verifies the displayed holding snapshots before changing assets. It commits only the chosen import and offers Undo. Undo restores only unchanged selected holdings, preserving unrelated assets, and refuses to overwrite later edits to an imported holding. This is a broker-specific slice of #265; other parsers and real-device checks remain separate.

The brokerreview journey covers ambiguous and currency-mismatched destinations, duplicate/partial input, all four widths and both themes with axe, cancellation, stale/deleted/reordered targets, guarded Undo, changed paste text, file error/retry, late cancelled reads and a separate touch import.

## Bank statement read lifecycle

Selecting a bank/loan statement replaces the previous preview immediately with a named loading state. It offers Cancel, and no old confirmation remains available. File-read and PDF-extraction failures show an inline error with Retry and advice to choose another statement; PDFs without readable transactions suggest a CSV export. A failed file stays in this tab for Retry until cancellation, successful reading, a new selection or household replacement. The file input is reset so selecting the same file again also works.

New reads, cancellation and whole-household replacement invalidate earlier completions, including errors and PDF recognition into payslip/property tools. Inbox retrieval uses the same guard and supports Retry; a late folder download cannot replace a newer chosen file. Inbox files remain pending on read/error/cancel and are marked imported only through the existing confirmation/handoff paths. Property statement completion semantics remain a separate follow-up. A household replacement also discards any ready bank preview, so it cannot confirm into the replacement household.

Loading and error messages receive focus and announce status. Retry and Cancel are native buttons; cancellation returns focus to the file chooser. The existing review now names the source file, using escaped text that wraps at narrow widths. Mapping, date-order correction, duplicates, accounts, loan treatment, explicit confirmation and Undo retain their existing behavior. No financial data is written by reading, error handling or cancellation.

The bankreadrecovery journey deterministically holds file reads, inbox retrieval and actual PDF extraction completions. It covers Retry, synchronous/rejected reads, malformed and empty PDFs, successful/failed late results, superseded selections, cancelled payslip/property recognition, household replacement, source escaping, saved-data invariance, confirmation/inbox completion/Undo and separate touch recovery. BANK_READ_A11Y adds loading and error axe scans at four widths in both themes; BANK_READ_SHOTS stores those states separately. Shared-file cache deletion, broader parser/review semantics and physical-device/screen-reader verification remain follow-up work under #265/#267/#299.

## Property statement review and completion

Recognising a property-manager PDF opens the property's existing statement form as a staged review. The source filename and destination property are visible; edited fields survive property/full redraws. Discard read clears the staged fields and restores focus to a keyboard-operable PDF picker. Direct PDF selection uses the same review and guards late reads against newer selections, deleted properties and household replacement.

An inbox file stays pending while reading, choosing a property, reviewing, cancelling or declining a duplicate warning. It moves to Imported only after Log statement creates the existing rent/bill records and a save succeeds. Duplicate confirmation checks the live property, household and review again before writing. Failed storage leaves the file pending, disables duplicate logging and explains that the current tab cannot save; the user can export a backup or discard the unsaved statement records. This follows the existing storage-failure behavior, which disables saving for that tab. It does not promise an in-tab save retry.

The property handoff awaits navigation instead of a fixed delay. It resolves the same live investment-property object again before filling; superseded navigation and stale selection/household callbacks cannot fill another property. The existing statement calculation, duplicate heuristic, transaction/income semantics and Undo remain. Undo affects recorded financial data; an already archived source file remains in Imported. No new persistent fields are introduced. Shared-file cache lifecycle and wider parser/currency recovery remain separate #265 work.

The propertystatementreview journey reproduces early inbox completion on released main. It covers source/destination context, redraw-preserved edits, eight width/theme axe scans, keyboard/touch discard, duplicate cancellation, deleted selections, household replacement, superseded sources, empty logs, confirmation/completion/Undo, storage failure with unsaved rollback, keyboard PDF selection and late direct reads. Physical-device and screen-reader checks remain separate.

## Investment-property chooser

When more than one investment property is available, statement import and the quick action open a native modal. Tab and Shift+Tab stay within its choices and Cancel; the browser excludes the background from focus and the accessibility tree. Escape, Cancel, backdrop and browser Back dismiss it without selecting a destination. Cancellation restores a connected visible opener, its replacement by ID, or a visible bank-file/quick-action/avatar fallback.

Choices keep stable property identities and show saved state, purchase date and owners as context for similar names. Selection waits for confirmed closure before invoking the handoff, then checks the same household and live investment-property object. Deleted/replaced properties, changed property kinds and replacement households require another choice. Repeated activation invokes the handoff once; a history close that times out does not continue into a property. The existing one-property shortcut and no-property guidance remain. Opening and cancelling the chooser do not read files, log statements or save household data.

The propertypicker journey reproduces keyboard escape on released main and checks native modal/AX isolation, four widths and both themes with scoped axe, long/escaped/duplicate names, all dismissal routes, focus restoration, short scrolling screens, reordering/deletion/replacement, one-time selection, unconfirmed closure, one/no-property cases and a separate touch context. Existing property review and import flows remain covered separately. Physical-device and screen-reader checks remain separate #299 work.

## Pending shares and app updates

The worker stores a file received through the installed app's share target in `wealth-planner-share`. This cache holds user input. Worker activation and the accepted-update cleanup both preserve it while discarding stale app resources. Successful shell refreshes, failed network/cache writes and repeated update attempts leave the pending file's bytes, filename header and content type untouched. The existing shell re-prime and update reply semantics remain.

The `serviceworker` tests exercise share-target POST delivery, activation, successful/failed/repeated updates, HTTP errors and shell-cache write failures. The `shareupdate` journey uses the real worker, CacheStorage and MessageChannel in Chromium, drops shell connections to exercise actual worker fetch failures, checks an online retry and reload, and verifies unchanged household data. It fails against released main because update cleanup deletes the pending share cache.

This protects files still in the worker's cache. The page's later pickup currently consumes that cache entry before parsing; recovery after pickup, review cancellation and confirmation remains separate #265 work. No import parser, confirmation flow, persistent household field or financial calculation changes here.

## Restore-control focus through redraws

Preferences’ backup controls redraw immediately and again after folder/receipt storage details arrive. Both passes use the shared `keepUi` helper, preserving the focused control by its existing DOM key. An asynchronous completion respects focus moved to another control. No restore, file selection or household write occurs during these redraws. The `importrestorefocus` journey proves both redraws lose Restore focus on released main, then covers preservation and moved focus at four widths in both themes.

The signed-amount focus test also distinguishes an independent tap from native repeated-tap text selection. Rapid label-only taps reproducibly select “Amount” and focus the row container, matching the recorded CI symptom. Each independent test interaction now taps another field before the label, with no sleeps, gesture retries or manual focus of Amount. `rowlabelfocus` checks 48 such activations; failure diagnostics retain selection, associated-control identity, inertness and pointer/click/focus events. The earlier untraced failure remains distinct from this controlled reproduction.

## Bank/loan confirmation save recovery

Bank statement confirmation completes an inbox source and offers the normal result/Undo only after an observed successful household save. A rejected storage write or a save conflict keeps the inbox file pending. The failed attempt cannot be confirmed again, including through the commit entry point. Parser, mapping, account, refund, transfer, reconciliation and loan calculations retain their existing semantics.

The named Not saved status receives focus and explains that the imported records remain in this tab. Download unsaved copy uses the existing recovery export, including receipts, without marking the household backed up; failure leaves the recovery available. Close review keeps those in-memory records and returns focus to file selection. Reload restores the last durable household; storage failure still disables saving for the tab, so no in-tab retry is promised. Chosen files are told to retain their original instead of being promised an inbox copy.

If the user explicitly resolves a save conflict by keeping this tab’s version, the status updates to Save warning resolved without completing the original inbox source or allowing another confirmation. The full household has since been saved; the user is asked to check those records before reviewing the source again. The update uses shared focus preservation. Household replacement discards the failed preview.

The bankconfirmfailure journey reproduces premature source completion on released main, then covers storage errors, durable-data invariance, retained records, duplicate prevention, recovery download failure/success, close/reload, normal confirmation/Undo, an explicit conflict decision, loan charges separate from spending, escaped chosen filenames, keyboard/touch and four widths in both themes. BANK_SAVE_A11Y scans both failed and resolved states; BANK_SAVE_SHOTS keeps their screenshots separately. The synthetic inbox’s reload test blocks its worker so network probes remain active. Shared-file pickup/cache retention through review and physical devices/readers remain separate #265/#267/#299 work.

## Spreadsheet row imports (Budget, Income, Assets)

The three CSV imports from each page's own template share one panel (`components/rowimport.js`) and one apply/undo (`calc/rowimport.js`). Parsing, defaults and templates are unchanged.

Choosing a file shows that it is being read, with Cancel. A read that finishes after Cancel, or after a newer file was chosen, is dropped. A read that fails offers Retry with the same file. The review names where each row goes: Budget, Home costs, an investment property, a person's income, or an Investments category. It lists skipped rows with their reasons. Rows that look like ones already there are left out unless Include them is ticked, which was the owner's choice. That covers a row the household already has, or one repeating an earlier row in the same file, with the same name, amount, frequency and destination. A file of nothing but duplicates offers no Import.

Confirm rechecks before writing anything. A property deleted, or no longer an investment property, since the review sends the review back with the change named and its rows' new destination shown. A household replaced while the review is open (restore, reset, another tab's save adopted) is reviewed again against the one now open. Rows link their account by id (0006), and an unknown account name stays as typed. The import saves with `commit(keys)`. Success is reported only once the save is observed. When the save doesn't happen, the rows are taken back out of the tab and the review stays, saying nothing was imported, with Try again.

Undo removes exactly the imported rows, wherever they are now, and any categories the file added that nothing else uses. It refuses, changing nothing, when an imported row was edited or removed since or the household was replaced. Changes the app makes on its own (a share price read, a vehicle's written-down value) don't count as edits.

The `rowimports` journey covers all of this. It runs at 320/390/768/1280px in both themes; `ROW_IMPORT_A11Y=1` adds the scoped axe scans. It also checks keyboard toggling of Include, focus on each status, escaping of file names and rows, a touch import with its Undo, and that storage is unchanged until confirmation. Real devices and screen readers remain #299.

## Pasted share prices

Investments → Shares → Prices → "Or paste prices by hand". Review prices reads the box into a review and writes nothing (`calc/pricepaste.js`, panel in `components/pricepaste.js`). The Google Sheet read and the app's own daily prices still apply directly. They are syncs the person set up, not imports, and the sheet already refused a price at or below zero.

Each line is read the way the sheet is read. A tab or quoted CSV cell is one column. A thousands separator is read whole (`"1,234.50"` is 1,234.50, not 234.50). A price at or below zero, `#N/A`, a decimal comma and a line with more than one number after its ticker are left out with the reason. A "Symbol / Price" header is skipped. An exchange prefix (`ASX:`, `NASDAQ:`, `NYSE:`…) says which market's holding it prices. A prefix naming a market the ticker isn't held on is left out, because prices aren't converted. A ticker held on two markets needs a prefix. A ticker given two different prices is left out both times; the same price twice counts once.

The review lists each holding with its current and new price and the change, plus the exchange rate and benchmark rows. A change over 50% is marked to check but still applied. Every line left out is listed with its line number and reason. Update reads the box again against the household. If the reviewed holdings or their prices changed (a price read, an edit, a deleted holding, a replaced household), it shows the new review and writes nothing. Editing the box puts the review away. Success is reported only once the save is observed. A save that doesn't happen puts the prices back and keeps the review, with Try again. Undo restores the prices, the rate and the benchmark store exactly, unless something has priced them since. In that case the newer prices stay.

The `pricepaste` journey covers all of this, at 320/390/768/1280px in both themes; `PRICE_PASTE_A11Y=1` adds the scoped axe scans. It includes a touch update with its Undo. `applyPrices` takes an optional market, which only the paste sets.

## Backup restore

Settings → Preferences → Open a backup file, the backup folder's "Open it", and welcome.html all go through `calc/restore.js`.

A file is checked before anything is asked. Its `income` must be a list and its `home` an object. Its other lists (budget, transactions, assets, accounts, properties, debts, money received, transfers, goals, scenarios) must be lists. It must migrate, in a copy, the way the app would load it. A file that fails says why, and nothing is offered. A tax year file picked here still merges as it always has.

When this device holds anything, the question lists what the backup holds beside what this device holds: budget lines, income rows (computed ones aren't counted), transactions, accounts, assets, properties and debts. It also gives each copy's last change and who saved the backup, and says when the backup is the older copy. An empty backup is named as one, and its button says "Replace with empty household". If the household changes while the question is open (another tab's save adopted), nothing is restored and you are asked to open the backup again.

The household is replaced only once the save is seen to happen. Otherwise this device's household is put back and the message says nothing was restored. A backup's receipt files are stored only after a successful restore. Undo puts the previous household back, through the same observed save, until anything changes; after that it refuses and suggests restoring an earlier backup. welcome.html has no Undo (it opens the app straight after), so its question leaves that line out.

The dialog's optional `details` are plain lines set with `textContent`, like its message.

The `restorebackup` journey covers all of this, at 320/390/768/1280px in both themes; `RESTORE_A11Y=1` adds the scoped axe scans. It includes a touch restore with its Undo, and welcome.html's check.

