// ---------------- Money fields (November 2026, docs/design/fields.md "Floating label") ----------------
//
// A money field (lib/field.js type "money") shows its amount with thousands separators: "575,000". It's edited as it
// stands — the separators can stay or go while typing, since whatever reads it goes through lib/validate.js readInput,
// which takes "$575,000" as 575000 — and leaving the field tidies it back to "575,000". (Taking the separators out on
// focus was tried: changing the value as it's focused loses the selection a Tab or a tap makes, so typing added to the
// old amount instead of replacing it.)
import { formatMoney } from "./field.js";

export function onMoneyBlur(e){
  var t = e.target;
  if(!t || !t.matches || !t.matches("input[data-money]")) return;
  var shown = formatMoney(t.value);
  if(shown !== t.value) t.value = shown;
}
