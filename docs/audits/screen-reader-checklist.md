# Screen-reader checklist (issue #299)

A script for checking the editors with a real screen reader on a real device. The browser checks in CI (axe, the
journeys' accessible-name audits) are Chromium emulation; they don't show what VoiceOver or TalkBack actually says.
This is what they can't cover. About 30 minutes per device.

## Before you start

1. **Open a private tab** (Safari: Tabs → Private; Chrome: New incognito tab). It has its own storage, so the sample
   household never touches your own data, and closing the tab throws it away.
2. Open the app's address with `?mock=1` at the end. That loads the sample household (Alex and Sam, invented).
3. Turn on the reader: **iPhone** Settings → Accessibility → VoiceOver; **Android** Settings → Accessibility → TalkBack.
   Swipe right to move to the next item, double-tap to activate, and swipe down/up (VoiceOver: rotor) to move by form
   control.

## The rule for every field

What the reader says should be, in order:

1. **the field's visible label** (the words above or beside it);
2. what it is (text field, button, pop-up/menu, switch);
3. **its help text**, if a line of help shows under it, or an ⓘ explanation once that's open.

Anything missing, extra, or in another language from what's on screen is a failure. "Edit text, double-tap to edit"
with no name is a failure.

## The editors

For each one: open it, move to the named field, and listen. Then clear the field, move away, and listen for the
error. Then close the editor.

| # | Where | Open | Field to check | Error to try |
|---|---|---|---|---|
| 1 | Money → Budget | tap a budget line | its amount | clear the amount |
| 2 | Money → Budget → Money in | tap an income row | its amount | clear the amount |
| 3 | Accounts → Investments → Shares | tap a holding, then its lots | a lot's units | clear the units |
| 4 | Accounts → Property | open a property, then a loan | the loan balance | clear the balance |
| 5 | Tax → People | tap a person | their pay | clear the pay |
| 6 | Tax → Returns | open a return, then a row | its amount | clear the amount |
| 7 | Plan → Goals | tap a goal | its target | clear the target |
| 8 | More → Calculators | Stamp duty | the purchase price | clear the price |

At each one, check:

- **Opening** says something that tells you an editor opened (its title, or "dialog"), and focus lands inside it,
  not back at the top of the page.
- **The field** follows the rule above.
- **The error** is read out when you leave the cleared field, or when you move back onto it (the error's words, not
  just "invalid").
- **Closing** (the ✕, or the two-finger scrub "Escape" on VoiceOver / back on TalkBack) returns focus to the row you
  opened it from, and it's read out.
- **Help by touch**: on any ⓘ in that editor or its section, double-tap; the explanation is read when you move to it.
  Touch-explore (drag one finger) over it as well.

Also once: **Home → Guided setup** (the sample household has no setup card; in the private tab open the avatar menu at the top
right and choose **Reset everything…**, then Guided setup on Home), press the reader's Escape gesture, and check focus returns to Guided
setup and it's announced (#282).

## Recording what you found

One line per editor per device, for example:

| Device and reader | Editor | Field name heard | Help heard | Error heard | Open/close focus | Result |
|---|---|---|---|---|---|---|
| iPhone, VoiceOver | 1 Budget line | "<what you heard>" | "<what you heard>" | "<what you heard>" | ok / ok | pass |

What you heard can go in your own words. Send it back as it is, and each failure gets its own issue with the
device, the reader and the steps (the issue's last criterion). Nothing is recorded as passing from emulation.
