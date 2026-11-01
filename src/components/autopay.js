// ---------------- Automatic payments (v3.196.0, item 231) — calc/autopay.js decides ----------------
// Set up on an account's card (Net worth → Accounts); asked about on Home and in the bell on the day.
import { state } from "../state.js";
import { AUTOPAY_FREQS, dueAutoPays, upcomingAutoPays, autoPayName } from "../calc/autopay.js";
import { fmtCurrency2, fmtDate, localDateStr } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";

// Session-only: which due payment has its "a different amount" form open ("<id>|<date>").
export var autoPayView = { other: "" };

function money(n){ return fmtCurrency2.format(Number(n) || 0); }
function accountOptions(selected){
  var names = (state.accounts || []).filter(function(a){ return a && a.name && a.type !== "agent"; }).map(function(a){ return a.name; });
  var opts = '<option value="">— pick —</option>' + names.map(function(n){ return '<option value="' + escapeAttr(n) + '"' + (n === selected ? " selected" : "") + '>' + escapeAttr(n) + '</option>'; }).join("");
  if(selected && names.indexOf(selected) === -1) opts += '<option value="' + escapeAttr(selected) + '" selected>' + escapeAttr(selected) + ' (deleted)</option>';
  return opts;
}
function lineOptions(selected){
  var lines = (state.shared || []).filter(function(l){ return l && l.id && l.what; });
  return '<option value="">— none —</option>' + lines.map(function(l){ return '<option value="' + escapeAttr(l.id) + '"' + (l.id === selected ? " selected" : "") + '>' + escapeAttr(l.what) + '</option>'; }).join("");
}

// One automatic payment's fields, inside an account's card.
function autoPayRowHtml(ap, today){
  var next = upcomingAutoPays({ autoPayments: [ap], transfers: state.transfers }, today, 400)[0];
  var f = function(label, control, wide){ return '<label class="acct-field' + (wide ? " acct-field-wide" : "") + '"><span>' + label + '</span>' + control + '</label>'; };
  var a = escapeAttr(ap.id);
  return '<div class="ap-row" data-ap-row="' + a + '">' +
    f("What it's for", '<input type="text" data-ap-id="' + a + '" data-ap-field="what" value="' + escapeAttr(ap.what || "") + '" placeholder="' + escapeAttr(autoPayName(ap)) + '" aria-label="What the automatic payment is for">', true) +
    f("From", '<select data-ap-id="' + a + '" data-ap-field="from" aria-label="Paid from">' + accountOptions(ap.from) + '</select>') +
    f("To", '<select data-ap-id="' + a + '" data-ap-field="to" aria-label="Paid to">' + accountOptions(ap.to) + '</select>') +
    f("Amount $", '<input type="number" min="0" step="0.01" data-ap-id="' + a + '" data-ap-field="amount" value="' + (Number(ap.amount) || "") + '" aria-label="Amount">') +
    f("How often", '<select data-ap-id="' + a + '" data-ap-field="freq" aria-label="How often">' + AUTOPAY_FREQS.map(function(q){ return '<option' + (q === ap.freq ? " selected" : "") + '>' + q + '</option>'; }).join("") + '</select>') +
    f("A day it comes out", '<input type="date" data-ap-id="' + a + '" data-ap-field="start" value="' + escapeAttr(ap.start || "") + '" aria-label="A day it comes out">') +
    f("Stands for the Budget line", '<select data-ap-id="' + a + '" data-ap-field="line" aria-label="The Budget line it stands for">' + lineOptions(ap.line) + '</select>') +
    '<p class="ledger-note acct-field-wide" style="margin:0">' + (next ? "Next on " + escapeAttr(fmtDate(next.date)) + ". " : "") +
      "On the day, Home and the bell ask whether it went through — yes records the transfer." + (ap.line ? " Its Budget line is shown as this payment on the calendar." : "") + '</p>' +
    '<div class="acct-field-wide"><button type="button" class="btn btn-danger btn-sm" data-ap-del="' + a + '">Delete automatic payment</button></div>' +
  '</div>';
}

// The section in an account's card: every automatic payment in or out of it, and a button to add one.
export function accountAutoPaysHtml(account, today){
  if(!account || !account.name || account.type === "agent") return "";
  today = today || localDateStr();
  var mine = (state.autoPayments || []).filter(function(ap){ return ap.from === account.name || ap.to === account.name; });
  return '<div class="acct-field-wide ap-section"><span class="ap-title">Automatic payments</span>' +
    mine.map(function(ap){ return autoPayRowHtml(ap, today); }).join("") +
    '<button type="button" class="btn btn-sm" data-ap-add="' + escapeAttr(account.name) + '">+ Add an automatic payment</button></div>';
}

// Home: what went out today (or in the last month) and hasn't been confirmed.
export function autoPayCardHtml(today){
  today = today || localDateStr();
  var due = dueAutoPays(state, today);
  if(!due.length) return "";
  return '<section class="home-card home-autopay" data-home-card="autopay" aria-label="Automatic payments to confirm"><span class="home-k">Did these go through?</span>' +
    '<ul class="ap-due">' + due.slice(0, 4).map(function(p){
      var key = p.id + "|" + p.date, other = autoPayView.other === key;
      var when = p.days === 0 ? "today" : p.days === -1 ? "yesterday" : fmtDate(p.date);
      var k = ' data-ap-id="' + escapeAttr(p.id) + '" data-ap-date="' + p.date + '"';
      return '<li class="ap-due-row"><div class="ap-due-what"><b>' + escapeAttr(p.what) + '</b><span>' + money(p.amount) + ' · ' + escapeAttr(p.from) + ' → ' + escapeAttr(p.to) + ' · ' + escapeAttr(when) + '</span></div>' +
        (other
          ? '<div class="ap-due-other"><label><span>It was $</span><input type="number" min="0" step="0.01" class="ap-other-amount" value="' + Number(p.amount) + '"' + k + ' aria-label="The amount that went out"></label>' +
              '<label class="pref-check"><input type="checkbox" class="ap-other-keep" checked> The amount from now on</label>' +
              '<button type="button" class="btn btn-sm btn-primary" data-ap-other-save' + k + '>Save</button><button type="button" class="btn btn-sm btn-ghost" data-ap-other-cancel>Cancel</button></div>'
          : '<div class="ap-due-actions"><button type="button" class="btn btn-sm btn-primary" data-ap-yes' + k + '>Yes, ' + money(p.amount) + '</button>' +
              '<button type="button" class="btn btn-sm" data-ap-other' + k + '>A different amount</button>' +
              '<button type="button" class="btn btn-sm btn-ghost" data-ap-skip' + k + '>It didn\'t</button></div>') +
      '</li>';
    }).join("") + '</ul>' + (due.length > 4 ? '<small>and ' + (due.length - 4) + ' more — they\'ll show once these are answered</small>' : '') + '</section>';
}
