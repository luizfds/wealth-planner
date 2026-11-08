# Row editor modal accessibility — #278

A row editor was a fixed card/sheet with a backdrop, but its background remained in keyboard and accessibility
navigation. The full-document expanded-editor scan exposed a partly obscured recurring-rule control behind it.

`lib/rowmodal.js` gives the live editor a named dialog role and `aria-modal`. It makes sibling branches inert on the
path from the row to body, leaving the editor's ancestors available. Only inert flags this controller owns are
restored; pre-existing inert state is preserved. The backdrop still closes the editor, and native questions above
it keep their top-layer focus and history. The header's close action retains its visible text in its accessible name.

Tab and Shift+Tab wrap around enabled, visible controls. Programmatic focus outside returns to the editor, and
page shortcuts stay inactive. Opening an existing row focuses its header rather than raising the phone keyboard;
adding a row keeps its existing first-field focus. Closing restores the row opener, or the Add control captured
before its handler replaced the DOM. Unchanged new rows still discard.

A child-list observer, active only while editing, reapplies the boundary after redraws and ignores attribute changes
it makes itself. It disconnects on close. If deletion removes the edited record, it releases the boundary and closes
the overlay instead of treating the next row at the old index as the edited record. Undo is then reachable.

Rows save edits immediately. Their new dialog role is excluded from the blanket open-dialog pending-work test;
the existing typed-field tracker still protects invalid/incomplete and button-saved inputs. Thus an idle saved row
can adopt another tab's copy, while pending work, setup and native questions retain their existing protection.

## Verification

The `rowmodals` browser journey checks dialog naming, native accessibility-tree background isolation, actual
Tab/Shift+Tab at 320/390/1280px, shortcut isolation, redraw with a question open, nested Escape/Back, an unfinished
input retained through nested Back, Escape/Done/Back/backdrop closes, focus return, untouched Budget and Cash row
discard, and deletion/Undo. Existing validation, two-tab and data-safety journeys remain.

Expanded timing/personal-claim/property-claim/invalid-amount axe checks now scan the **whole document**, restoring
the coverage that exposed #278. The original page states also remain full-document scans. A 320px light pass
supplements 390/1280px in both themes. Browser emulation is not actual screen-reader verification.

Pending manual task: VoiceOver/Safari and NVDA/Firefox, including a physical phone. Verify announced dialog name,
background isolation, field descriptions/errors, focus order and return, and native questions nested above the editor.
