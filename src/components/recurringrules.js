import { categorySpendingChanges } from "../calc/spendinginsights.js";
import { escapeAttr } from "../lib/html.js";
import { recurringCandidates } from "../calc/recurringschedule.js";
import { emptyStateHtml } from "../lib/empty.js";

export function validateRecurringRule(input){
  const r = { id: String(input.id || ""), what: String(input.what || "").trim(), kind: input.kind === "Income" ? "Income" : "Expense",
    amount: Number(input.amount), frequency: String(input.frequency || ""), startDate: String(input.startDate || ""),
    endDate: String(input.endDate || ""), intervalDays: Number(input.intervalDays || 0), category: String(input.category || ""),
    enabled: input.enabled !== false };
  if(!r.id || !r.what || !Number.isFinite(r.amount) || r.amount <= 0) return null;
  if(!["Weekly", "Fortnightly", "Monthly", "Custom"].includes(r.frequency)) return null;
  if(r.frequency === "Custom" && (!Number.isSafeInteger(r.intervalDays) || r.intervalDays < 1 || r.intervalDays > 366)) return null;
  // Recurrence engine rejects invalid calendar dates; verify the start independently.
  if(!/^\d{4}-\d{2}-\d{2}$/.test(r.startDate)) return null;
  const start = new Date(r.startDate + "T00:00:00Z");
  if(!Number.isFinite(start.getTime()) || start.toISOString().slice(0, 10) !== r.startDate) return null;
  if(r.endDate){
    const end = new Date(r.endDate + "T00:00:00Z");
    if(r.endDate < r.startDate || !/^\d{4}-\d{2}-\d{2}$/.test(r.endDate) ||
      !Number.isFinite(end.getTime()) || end.toISOString().slice(0, 10) !== r.endDate) return null;
  }
  return r;
}
export function approvedOccurrences(rule, transactions, incomeLog, from, through){
  // A type edit must not regenerate occurrences already recorded in the other log.
  const existing = (transactions || []).concat(incomeLog || []);
  return recurringCandidates(rule, existing, from, through).map(function(x){
    return { ...x, id: rule.id + ":" + x.date, what: rule.what, amount: rule.amount,
      category: rule.category, ...(rule.kind === "Income" ? { target: "" } : { linkedExpenseId: null }) };
  });
}
export function recurringRuleManagerHtml(rules, transactions, incomeLog, today, editingId){
  const edit = (rules || []).find(function(r){ return r.id === editingId; }) || null;
  const safe = function(s){ return escapeAttr(String(s == null ? "" : s)); };
  const opt = function(value, chosen){ return '<option value="' + value + '"' + (value === chosen ? " selected" : "") + '>' + value + '</option>'; };
  let html = '<div class="ledger-note" role="region" aria-label="Approved recurring rules"><strong>Your recurring rules</strong><p>Rules stay in this device’s saved financial data. Occurrences are only recorded after you preview and confirm them. Imported bank transactions are not generated automatically.</p>';
  if(!(rules || []).length) html += emptyStateHtml("No rules configured yet — add one in the form below.", { beside: true });
  (rules || []).forEach(function(r){
    html += '<div class="rc-row"><b>' + safe(r.what) + '</b> · ' + safe(r.kind) + ' · ' + safe(r.frequency) + ' · ' + safe(r.amount) +
      (r.enabled === false ? ' · Paused' : '') +
      '<div class="rc-actions"><button type="button" class="btn btn-sm" data-rr-edit="' + safe(r.id) + '">Edit</button>' +
      '<button type="button" class="btn btn-sm" data-rr-preview="' + safe(r.id) + '">Preview due</button>' +
      '<button type="button" class="btn btn-sm btn-ghost" data-rr-toggle="' + safe(r.id) + '">' + (r.enabled === false ? 'Resume' : 'Pause') + '</button>' +
      '<button type="button" class="btn btn-sm btn-danger" data-rr-delete="' + safe(r.id) + '">Delete</button></div></div>';
  });
  const r = edit || { what: "", amount: "", kind: "Expense", frequency: "Monthly", startDate: today, endDate: "", intervalDays: 10, category: "" };
  html += '<details' + (edit ? ' open' : '') + '><summary>' + (edit ? 'Edit rule' : 'Add recurring rule') + '</summary>' +
    '<form id="recurringRuleForm"><label>Description <input class="field-control" name="what" required maxlength="120" value="' + safe(r.what) + '"></label> ' +
    '<label>Type <select class="field-control" name="kind">' + opt("Expense", r.kind) + opt("Income", r.kind) + '</select></label> ' +
    '<label>Amount <input class="field-control" name="amount" type="number" min="0.01" step="0.01" required value="' + safe(r.amount) + '"></label> ' +
    '<label>Frequency <select class="field-control" name="frequency">' + ["Weekly","Fortnightly","Monthly","Custom"].map(function(v){ return opt(v,r.frequency); }).join("") + '</select></label> ' +
    '<label>Custom interval (days) <input class="field-control" name="intervalDays" type="number" min="1" max="366" value="' + safe(r.intervalDays) + '"></label> ' +
    '<label>Starts <input class="field-control" name="startDate" type="date" required value="' + safe(r.startDate) + '"></label> ' +
    '<label>Ends (optional) <input class="field-control" name="endDate" type="date" value="' + safe(r.endDate) + '"></label> ' +
    '<label>Category <input class="field-control" name="category" maxlength="80" value="' + safe(r.category) + '"></label> ' +
    '<button class="btn btn-sm" type="submit">Save rule</button></form></details></div>';
  return html;
}

export function categoryInsightsHtml(transactions, today){
  const month = String(today || "").slice(0, 7);
  const rows = categorySpendingChanges(transactions, month);
  const safe = function(v){ return escapeAttr(String(v)); };
  if(!rows.length) return '<p class="ledger-note">No category spending comparisons available for this month and last month.</p>';
  return '<details class="ledger-note"><summary>Category spending changes (' + rows.length + ')</summary>' +
    '<p>Observed transactions only. The current month may be incomplete, imports may be missing, and a change does not establish its cause. Review the underlying transactions before drawing conclusions.</p><ul>' +
    rows.map(function(r){
      return '<li><strong>' + safe(r.category) + '</strong>: $' + r.current.toFixed(2) + ' this month vs $' + r.previous.toFixed(2) +
        ' last month (' + (r.delta >= 0 ? '+' : '') + '$' + r.delta.toFixed(2) + ')' +
        (r.currentCount === 0 ? ' — no transactions recorded this month' : '') + '</li>';
    }).join('') + '</ul></details>';
}

export function upsertRecurringRule(data, rule){
  if(!Array.isArray(data.recurringRules)) data.recurringRules = [];
  const idx = data.recurringRules.findIndex(function(r){ return r.id === rule.id; });
  if(idx >= 0) data.recurringRules[idx] = rule; else data.recurringRules.push(rule);
}
export function toggleRecurringRule(data, id){
  const rule = (data.recurringRules || []).find(function(r){ return r.id === id; });
  if(rule) rule.enabled = rule.enabled === false;
}
export function deleteRecurringRule(data, id){
  data.recurringRules = (data.recurringRules || []).filter(function(r){ return r.id !== id; });
}
export function recordApprovedOccurrences(data, rule, from, through){
  const approved = approvedOccurrences(rule, data.transactions, data.incomeLog, from, through);
  if(rule.kind === "Income") data.incomeLog.push(...approved);
  else data.transactions.push(...approved);
  return approved.length;
}
