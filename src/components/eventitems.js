import { tripSpend } from "../calc/trips.js";
import { state, commit, genId } from "../state.js";
import { eventBudget, eventItem, itemSpending, projectSpent } from "../calc/projects.js";
import { fmtCurrency0, fmtCurrency2, fmtDate } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";

function asCents(amount){
  return Math.round((Number(amount) || 0) * 100);
}

function money(cents){
  return (cents % 100 ? fmtCurrency2 : fmtCurrency0).format(cents / 100);
}

function balance(cents){
  return money(Math.abs(cents)) + (cents < 0 ? " over" : " left");
}

export function eventItemHint(event, itemId, amount){
  var item = eventItem(event, itemId);
  if(!item) return "";
  var spent = itemSpending(event, state.transactions).get(itemId) || 0;
  var total = event.lineId ? tripSpend(event, state.transactions) : projectSpent(event, state.transactions);
  return (amount > 0 ? "After this purchase · " : amount < 0 ? "After this refund · " : "") +
    item.name + " · " + balance(asCents(item.budget) - spent - asCents(amount)) + " · " + balance(asCents(event.budget) - asCents(total) - asCents(amount)) + " overall";
}

export function eventItemOptions(event, selectedId){
  return '<option value="">No item</option>' + ((event && event.items) || []).map(function(item){
    return '<option value="' + escapeAttr(item.id) + '"' + (item.id === selectedId ? " selected" : "") + '>' + escapeAttr(item.name) + '</option>';
  }).join("");
}

export function eventItemsHtml(event){
  var items = event.items || [];
  var spent = itemSpending(event, state.transactions);
  var allocated = items.reduce(function(sum, item){ return sum + asCents(item.budget); }, 0);
  var free = asCents(event.budget) - allocated;
  var rows = items.map(function(item){
    var used = spent.get(item.id) || 0;
    var date = !event.lineId && item.paymentDate ? '<small>Payment planned for ' + escapeAttr(fmtDate(item.paymentDate, {year:true})) + '</small>' : "";
    return '<li><span><b>' + escapeAttr(item.name) + '</b><small>' +
      (used ? money(used) + ' spent · ' + balance(asCents(item.budget) - used) : money(asCents(item.budget)) + ' planned') +
      '</small>' + date + '</span><div class="trip-actions">' +
      (asCents(item.budget) > used ? '<button type="button" class="btn btn-sm" data-book-trip="' + escapeAttr(event.id) + '" data-book-item="' + escapeAttr(item.id) + '" aria-label="Log payment for ' + escapeAttr(item.name) + '">Log payment</button>' : '') + '<button type="button" class="btn btn-sm btn-ghost" data-edit-event-item="' + escapeAttr(item.id) + '" aria-label="Edit ' + escapeAttr(item.name) + '">Edit</button></div></li>';
  }).join("");
  return '<details class="event-items" data-event-items="' + escapeAttr(event.id) + '"><summary>Planned items' +
    (items.length ? ' <small>' + items.length + '</small>' : '') + '</summary>' +
    (rows ? '<ul>' + rows + '</ul><p>' + (free < 0 ? money(-free) + ' planned above the event budget' : money(free) + ' not allocated to items') + '</p>' : '') +
    '<button type="button" class="btn btn-sm" data-add-event-item>+ Add item</button>' +
    '<form class="trip-form" data-event-item-form hidden><label>Item name<input class="field-control" name="name" required maxlength="70"></label>' +
    '<label>Planned amount ($)<input class="field-control" name="budget" type="number" min="0.01" step="0.01" inputmode="decimal" required></label>' +
    (!event.lineId ? '<label>Payment date <span class="label-optional">(optional)</span><input class="field-control" name="paymentDate" type="date"></label>' : "") +
    '<div class="trip-actions"><button class="btn btn-sm btn-primary" type="submit">Save item</button> <button class="btn btn-sm" type="button" data-cancel-event-item>Cancel</button></div></form></details>';
}

export function wireEventItems(body){
  body.addEventListener("click", function(e){
    var button = e.target.closest("[data-add-event-item], [data-edit-event-item], [data-cancel-event-item]");
    if(!button) return;
    var details = button.closest("[data-event-items]");
    var form = details.querySelector("form");
    var add = details.querySelector("[data-add-event-item]");
    var item = eventItem(eventBudget(state, details.dataset.eventItems), button.dataset.editEventItem);
    var cancel = button.hasAttribute("data-cancel-event-item");
    form.elements.name.setCustomValidity("");
    form.elements.name.value = item ? item.name : "";
    form.elements.budget.value = item ? item.budget : "";
    if(form.elements.paymentDate) form.elements.paymentDate.value = item ? item.paymentDate || "" : "";
    form.dataset.itemId = item ? item.id : "";
    form.hidden = cancel;
    add.hidden = !cancel;
    (cancel ? add : form.elements.name).focus();
  });
  body.addEventListener("input", function(e){
    if(e.target.matches('[data-event-item-form] [name="name"]')) e.target.setCustomValidity("");
  });
  body.addEventListener("submit", function(e){
    var form = e.target.closest("[data-event-item-form]");
    if(!form) return;
    e.preventDefault();
    var name = form.elements.name.value.trim();
    if(!name){
      form.elements.name.setCustomValidity("Enter an item name.");
      form.reportValidity();
      return;
    }
    var id = form.closest("[data-event-items]").dataset.eventItems;
    var event = eventBudget(state, id);
    if(!event || !form.reportValidity()) return;
    var item = eventItem(event, form.dataset.itemId);
    if(!item){
      item = { id: genId("item") };
      if(!event.items) event.items = [];
      event.items.push(item);
    }
    item.name = name;
    item.budget = asCents(form.elements.budget.value) / 100;
    if(form.elements.paymentDate){
      if(form.elements.paymentDate.value) item.paymentDate = form.elements.paymentDate.value;
      else delete item.paymentDate;
    }
    form.hidden = true;
    form.parentElement.querySelector("[data-add-event-item]").hidden = false;
    commit([event.lineId ? "trips" : "projects"]);
    body.querySelector('[data-event-items="' + CSS.escape(id) + '"] [data-add-event-item]')?.focus({preventScroll:true});
  });
}
