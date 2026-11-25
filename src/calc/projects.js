export function projectSpent(project, transactions){
  return (transactions || []).reduce(function(sum, tx){
    return sum + (tx.project === project.id ? Number(tx.amount) || 0 : 0);
  }, Number(project.spent) || 0);
}
export function projectRemaining(project, transactions){
  return Math.max(0, (Number(project.budget) || 0) - projectSpent(project, transactions));
}
export function fileProject(st, tx, id){
  if((tx.project || tx.trip) !== id) delete tx.eventItemId;
  if(tx.trip && !id) tx.tripNo = tx.trip;
  delete tx.project;
  delete tx.trip;
  var trip = (st.trips || []).find(function(t){ return t.id === id; });
  if(trip){ tx.trip = trip.id; tx.linkedExpenseId = trip.lineId; delete tx.tripNo; }
  else if((st.projects || []).some(function(p){ return p.id === id; })){
    tx.project = id;
    tx.linkedExpenseId = null;
  }
}

export function eventBudget(st, id){
  return (st.projects || []).concat(st.trips || []).find(function(event){ return event.id === id; });
}

export function eventItem(event, id){
  return id && event && (event.items || []).find(function(item){ return item.id === id; });
}

export function itemSpending(event, transactions){
  var totals = new Map();
  (transactions || []).forEach(function(tx){
    if((tx.project || tx.trip) !== event.id || !tx.eventItemId) return;
    var amount = Math.round((Number(tx.amount) || 0) * 100);
    totals.set(tx.eventItemId, (totals.get(tx.eventItemId) || 0) + amount);
  });
  return totals;
}
