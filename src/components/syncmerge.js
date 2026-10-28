import { escapeAttr } from "../lib/html.js";
import { rowLabel, sectionLabel, fieldLabel, valueText } from "../calc/syncmerge.js";

// ---------------- The question a sync merge asks (v3.143.0, item 182) ----------------
// One choice per thing changed on both devices (calc/syncmerge.js); everything else is already
// combined. This device's version is ticked to begin with. `where` is "Dropbox" or a folder's name.
export function mergeDialogHtml(conflicts, where, savedAt){
  var items = conflicts.map(function(c, i){
    var isRow = !c.field;
    var title = sectionLabel(c.top) + (c.row ? " · " + rowLabel(c.row) : "") + (c.field ? " · " + fieldLabel(c.field) : "");
    var opt = function(side, label, v){
      return '<label class="merge-opt"><input type="radio" name="merge-' + i + '" value="' + side + '" data-merge-id="' + escapeAttr(c.id) + '"' + (side === "ours" ? " checked" : "") + '>' +
        '<span><small>' + label + '</small>' + escapeAttr(valueText(v, isRow)) + '</span></label>';
    };
    return '<fieldset class="merge-item"><legend>' + escapeAttr(title) + '</legend>' + opt("ours", "This device", c.ours) + opt("theirs", escapeAttr(where || "The other copy"), c.theirs) + '</fieldset>';
  }).join("");
  return '<h2>Both devices changed the same ' + (conflicts.length === 1 ? "thing" : conflicts.length + " things") + '</h2>' +
    '<p class="ledger-note" style="margin:0 0 10px">Everything else from the copy in ' + escapeAttr(where || "the other copy") + (savedAt ? ' (' + escapeAttr(savedAt) + ')' : '') +
    ' and from this device is combined. Pick which to keep here:</p>' +
    '<div class="merge-list">' + items + '</div>' +
    '<form method="dialog" class="merge-actions"><button class="btn btn-sm btn-ghost" value="cancel">Not now</button><button class="btn btn-sm btn-primary" value="ok" data-merge-ok>Combine</button></form>';
}
