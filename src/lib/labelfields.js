// ---------------- Tying older form markup's labels to their fields (#261) ----------------
//
// Much of the app's form markup predates the shared field (lib/field.js) and reads
//   <div class="calc-field|proj-field|m-edit-field …" [title="help"]><label>Visible</label><input|select|textarea …>
// — a label beside its control but not tied to it, and the help in a title tooltip that touch and keyboard never reach.
// labelFields(html, prefix) fixes that in place, as plain string work (no DOM, so builders stay testable in Node):
//   - the control gets an id (prefix-N) and the label for= it, so clicking the label focuses it and it's the name;
//   - a title on the wrapper or the control becomes a visible help line after the control, which describes it;
//   - an aria-label that doesn't start with the visible label is dropped (WCAG 2.5.3: the name starts with what's on
//     screen); one that does — a fuller name, "Interest rate for Loan 1" — stays.
// Controls that already have an id, and checkboxes/radios/files, are left alone, so running it twice changes nothing.

var FIELD = /<div class="((?:calc-field|proj-field|m-edit-field)\b[^"]*)"((?: [a-z-]+="[^"]*")*)><label>([\s\S]*?)<\/label>(<(input|select|textarea)\b)([^>]*)>/g;

function plain(s){
  return String(s).replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/\s+/g, " ").trim().toLowerCase();
}

export function labelFields(html, prefix){
  var n = 0, helps = [];
  var out = String(html).replace(FIELD, function(all, cls, divAttrs, label, open, tag, attrs){
    if(/\sid="/.test(attrs) || /\stype="(checkbox|radio|hidden|file)"/.test(attrs)) return all;
    var id = prefix + "-" + (++n), help = null;
    divAttrs = divAttrs.replace(/ title="([^"]*)"/, function(m, t){ help = t; return ""; });
    attrs = attrs.replace(/ title="([^"]*)"/, function(m, t){ if(help == null) help = t; return ""; });
    attrs = attrs.replace(/ aria-label="([^"]*)"/, function(m, a){ return plain(a).indexOf(plain(label)) === 0 ? m : ""; });
    var described = help != null ? ' aria-describedby="' + id + '-help"' : "";
    // The help is an attribute's value from markup a builder already escaped: it goes back in as it is (escaping it
    // again would show &quot; as text).
    if(help != null) helps.push({ id: id, tag: tag, escapedHelp: help });
    return '<div class="' + cls + '"' + divAttrs + '><label for="' + id + '">' + label + '</label>' + open + ' id="' + id + '"' + described + attrs + '>' +
      (help != null ? "\u0000help:" + id + "\u0000" : "");
  });
  // The help goes after the control: straight after an <input>, after the closing tag of a <select> or <textarea>.
  helps.forEach(function(h){
    var marker = "\u0000help:" + h.id + "\u0000", at = out.indexOf(marker);
    var para = '<p class="field-help" id="' + h.id + '-help">' + h.escapedHelp + "</p>";
    if(h.tag === "input"){ out = out.replace(marker, para); return; }
    out = out.slice(0, at) + out.slice(at + marker.length);
    var close = out.indexOf("</" + h.tag + ">", at);
    if(close === -1){ out = out.slice(0, at) + para + out.slice(at); return; }
    close += h.tag.length + 3;
    out = out.slice(0, close) + para + out.slice(close);
  });
  return out;
}
