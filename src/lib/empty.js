// ---------------- An empty state (#255 step 3, pages.md §4) ----------------
//
// An empty section says, in one line, what it holds and why it's empty, then gives the next step as a control: a link
// to the place the step is done (`go`: "page" or "page/tab", read by components/chromewiring.js), a page's own add
// action (`add`: true, which the page's + button already runs), a part of the same page (`scroll`: "#id"), or a button
// the caller wires (`attrs`). Where the controls that fill it come straight after it (a form, a row of add chips), it
// says so with `beside: true`. A section with nothing to do (every check passes, nothing to flag) says so with
// `done: true`. The smoke run fails an empty state in the empty household with none of these.
import { escapeAttr } from "./html.js";

var ATTR_NAME = /^data-[a-z0-9-]+$/;

// emptyStateHtml(text, { go, add, scroll, label, attrs, beside, done, className })
//   text   the sentence, as plain text (escaped here)
//   go     "expenses/income", "properties", … — a link there, labelled `label` ("Go to Income →")
//   add    the page's own add button — "#addAccountBtn", or true for whatever its + button does — labelled `label`
//   scroll "#id" on this page — a link that brings it into view, labelled `label`
//   attrs  { "data-…": value } for a button the caller already handles, labelled `label`
//   beside true: the controls that fill it follow it directly (the smoke run checks the next element has one)
//   done   true: nothing needs doing — no control, and the smoke run expects none
export function emptyStateHtml(text, o){
  o = o || {};
  var control = "";
  if(!o.done && !o.beside){
    var a = "";
    if(o.go) a += ' data-go="' + escapeAttr(o.go) + '"';
    if(o.add) a += ' data-empty-add="' + escapeAttr(o.add === true ? "" : o.add) + '"';
    if(o.scroll) a += ' data-empty-scroll="' + escapeAttr(o.scroll) + '"';
    Object.keys(o.attrs || {}).forEach(function(k){
      if(!ATTR_NAME.test(k)) throw new Error("Not a data attribute: " + k);
      a += " " + k + '="' + escapeAttr(o.attrs[k]) + '"';
    });
    if(!a) throw new Error("An empty state needs its next step (go, add, scroll or attrs) — or beside or done");
    control = ' <button type="button" class="link-btn empty-state-go"' + a + ">" + escapeAttr(o.label || "Go there →") + "</button>";
  }
  return '<p class="ledger-note empty-state' + (o.className ? " " + escapeAttr(o.className) : "") + '"' + (o.done ? ' data-empty="done"' : o.beside ? ' data-empty="beside"' : "") + ">" +
    escapeAttr(text) + control + "</p>";
}
