# Shared import discovery

The Import data chooser is the first slice of issue #265. The avatar menu, relevant page actions and global search all open the same native modal. It groups statements, investments and spreadsheet rows, with supported formats and destinations stated before selection. Backup restore has its own replacement section.

A choice navigates to an existing tool, opens its disclosure/menu and focuses its control. It does not select a file, call a parser or confirm an import. Back returns to the origin. Escape, Cancel and backdrop dismissal return focus to the visible opener, including the menu toggle when the original menu item is hidden. Tab stays inside the chooser. No new persistent state or import data model is introduced.

Bank and loan statements use Spending's existing CSV/PDF/OFX/QFX/QIF workflow. Property PDFs use the existing statement recognition and property selection there. Payslips lead to Tax's per-person checks; the chooser explicitly says that reading can update year-to-date figures with Undo, matching current behaviour. Broker trades open the Shares trade tool. Prices open the existing Prices tool for paste or Google Sheet configuration. Budget, income and asset CSVs open their own template/preview controls. Restore leads to Preferences' existing Open a backup file control and confirmation flow.

Without an investment property, a person or a share holding, the relevant choice explains the prerequisite and opens its Add control. Opening the Add editor is a separate explicit action. Navigation refreshes the header's moved import/export controls synchronously before focusing them.

## Validation and remaining work

The `importchooser` journey measures every choice and the modal at 320/390/768/1280px in both themes, checks keyboard/touch navigation, focus containment/return, Back/Escape, all destinations, empty-household prerequisites and unchanged in-memory/persisted household data. `IMPORT_A11Y=1` adds eight scoped axe scans; `IMPORT_SHOTS` retains chooser screenshots separately from page defaults.

Issue #265 remains open. Parser-specific Select → Recognise/map → Review → Confirm → Result contracts, malformed/unsupported/partial-file recovery, mixed-currency and duplicate reviews, and confirmation-before-write for every importer are follow-up work. This chooser does not certify those existing tools' cancellation semantics. Actual devices and screen readers remain separate #267/#299 work.
