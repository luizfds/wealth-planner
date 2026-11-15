# Shared import discovery

The Import data chooser is the first slice of issue #265. The avatar menu, relevant page actions and global search all open the same native modal. It groups statements, investments and spreadsheet rows, with supported formats and destinations stated before selection. Backup restore has its own replacement section.

A choice navigates to an existing tool, opens its disclosure/menu and focuses its control. It does not select a file, call a parser or confirm an import. Back returns to the origin. Escape, Cancel and backdrop dismissal return focus to the visible opener, including the menu toggle when the original menu item is hidden. Tab stays inside the chooser. No new persistent state or import data model is introduced.

Bank and loan statements use Spending's existing CSV/PDF/OFX/QFX/QIF workflow. Property PDFs use the existing statement recognition and property selection there. Payslips lead to Tax's per-person checks; the parsed figures are staged for explicit review before updating year-to-date figures, with Undo. Broker trades open the Shares trade tool. Prices open the existing Prices tool for paste or Google Sheet configuration. Budget, income and asset CSVs open their own template/preview controls. Restore leads to Preferences' existing Open a backup file control and confirmation flow.

Without an investment property, a person or a share holding, the relevant choice explains the prerequisite and opens its Add control. Opening the Add editor is a separate explicit action. Navigation refreshes the header's moved import/export controls synchronously before focusing them.

## Validation and remaining work

The `importchooser` journey measures every choice and the modal at 320/390/768/1280px in both themes, checks keyboard/touch navigation, focus containment/return, Back/Escape, all destinations, empty-household prerequisites and unchanged in-memory/persisted household data. `IMPORT_A11Y=1` adds eight scoped axe scans; `IMPORT_SHOTS` retains chooser screenshots separately from page defaults.

Issue #265 remains open. Parser-specific Select → Recognise/map → Review → Confirm → Result contracts, malformed/unsupported/partial-file recovery, mixed-currency and duplicate reviews, and confirmation-before-write for every importer are follow-up work. This chooser does not certify those existing tools' cancellation semantics. Actual devices and screen readers remain separate #267/#299 work.

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
