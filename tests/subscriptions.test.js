import "./_env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { unbudgetedRecurring, repeatingPayees } from "../src/calc/recurring.js";
import { subscriptionList, subscriptionsYearly, cancelReminders, nextCharge, lastRise } from "../src/calc/subscriptions.js";

// An invented statement, May–October 2026.
function statement(){
  var t = [];
  var add = function(date, what, amount, extra){ t.push(Object.assign({ date: date, what: what, amount: amount }, extra || {})); };
  // A streaming service, monthly on the 3rd, up from $16.99 to $18.99 in August.
  ["05-03", "06-03", "07-03"].forEach(function(d){ add("2026-" + d, "STREAMFLIX PTY LTD", 16.99); });
  ["08-03", "09-03", "10-03"].forEach(function(d){ add("2026-" + d, "STREAMFLIX PTY LTD", 18.99); });
  // A gym, fortnightly, already on a budget line.
  for(var d = Date.UTC(2026, 4, 6); d <= Date.UTC(2026, 9, 21); d += 14 * 86400000) add(new Date(d).toISOString().slice(0, 10), "Fern Gym Direct Debit", 32.5, { linkedExpenseId: "gym" });
  // Cloud storage that stopped after July.
  ["04-12", "05-12", "06-12", "07-12"].forEach(function(dd){ add("2026-" + dd, "Bank One Cloud Storage", 4.49); });
  // A grocer: often, but never the same amount — not a subscription.
  [["05-02", 84.1], ["05-09", 132.4], ["05-16", 61.75], ["05-23", 150.2], ["05-30", 99]].forEach(function(x){ add("2026-" + x[0], "Corner Grocer", x[1]); });
  return t;
}

test("the list agrees with recurring.js: what Budget calls repeating and unbudgeted is here, the same", function(){
  var tx = statement(), today = "2026-10-20";
  var subs = subscriptionList(tx, today, {});
  unbudgetedRecurring(tx, today).forEach(function(u){
    var s = subs.find(function(x){ return x.key === u.key; });
    assert.ok(s, u.name + " is in the list");
    assert.equal(s.freq, u.freq);
    assert.equal(s.stopped, false);
  });
  assert.deepEqual(subs.map(function(s){ return [s.name.length > 0, s.freq, s.stopped]; }),
    [[true, "Fortnightly", false], [true, "Monthly", false], [true, "Monthly", true]]);
  assert.ok(!subs.some(function(s){ return /grocer/i.test(s.label); }), "a shop charging different amounts isn't a subscription");
  // Every detector change goes through one function: the unbudgeted list is the unlinked, running payees.
  assert.equal(unbudgetedRecurring(tx, today).length, repeatingPayees(tx, today).filter(function(r){ return !r.stopped; }).length);
});

test("yearly cost, the last price rise, the next charge, and a stopped one is stopped — not overdue", function(){
  var subs = subscriptionList(statement(), "2026-10-20", {});
  var stream = subs.find(function(s){ return /streamflix/i.test(s.label); });
  assert.equal(stream.amount, 18.99);
  assert.equal(stream.yearly, 227.88);
  assert.deepEqual(stream.lastRise, { date: "2026-08-03", from: 16.99, to: 18.99 });
  assert.equal(stream.next, "2026-11-03");
  var gym = subs.find(function(s){ return /gym/i.test(s.label); });
  assert.equal(gym.line, "gym");
  assert.equal(gym.yearly, 845);
  var cloud = subs.find(function(s){ return /cloud/i.test(s.label); });
  assert.equal(cloud.stopped, true);
  assert.equal(cloud.next, null);
  assert.equal(cloud.last, "2026-07-12");
  assert.equal(subscriptionsYearly(subs), 1072.88, "the stopped one isn't in the yearly total");
});

test("a cancel-by date becomes a reminder a week ahead, and not once it's stopped or set aside", function(){
  var tx = statement();
  var notes = {};
  var key = subscriptionList(tx, "2026-10-20", {}).find(function(s){ return /streamflix/i.test(s.label); }).key;
  var cloudKey = subscriptionList(tx, "2026-10-20", {}).find(function(s){ return /cloud/i.test(s.label); }).key;
  notes[key] = { cancelBy: "2026-10-30" };
  notes[cloudKey] = { cancelBy: "2026-10-22" };
  assert.deepEqual(cancelReminders(subscriptionList(tx, "2026-10-20", notes), "2026-10-20", 7), []);
  assert.deepEqual(cancelReminders(subscriptionList(tx, "2026-10-24", notes), "2026-10-24", 7).map(function(s){ return s.key; }), [key]);
  notes[key].ignored = true;
  assert.deepEqual(cancelReminders(subscriptionList(tx, "2026-10-24", notes), "2026-10-24", 7), []);
});

test("next charge keeps month ends, and skips charges the statement hasn't caught up to", function(){
  assert.equal(nextCharge("2026-01-31", "Monthly", "2026-02-01"), "2026-02-28");
  assert.equal(nextCharge("2026-01-31", "Monthly", "2026-03-01"), "2026-03-31");
  assert.equal(nextCharge("2026-10-01", "Weekly", "2026-10-20"), "2026-10-22");
  assert.equal(lastRise([{ date: "a", amount: 10 }, { date: "b", amount: 10.1 }]), null);
  assert.equal(lastRise([{ date: "a", amount: 10 }, { date: "b", amount: 12 }, { date: "c", amount: 10 }]), null, "up and back down again is no rise");
});

test("rent and a fuel stop aren't subscriptions", function(){
  var t = statement();
  ["05-07", "05-14", "05-21", "05-28", "06-04", "06-11"].forEach(function(d){ t.push({ date: "2026-" + d, what: "Example Realty", amount: 600, linkedExpenseId: "rent" }); });
  [72.4, 75.1, 70.85, 76.3, 73.9, 74.6].forEach(function(a, i){ t.push({ date: "2026-0" + (5 + Math.floor(i / 4)) + "-" + String(1 + (i % 4) * 7).padStart(2, "0"), what: "Roadside Fuel", amount: a }); });
  var subs = subscriptionList(t, "2026-06-20", {}, { homeLines: ["rent"] });
  assert.ok(!subs.some(function(s){ return /realty|fuel/i.test(s.label); }), subs.map(function(s){ return s.label; }).join(", "));
});

// Item 255: one bill under several descriptions, one after the other, filed to the same budget line.
function monthly(what, line, from, n, amount, day){
  const out = [];
  for(let i = 0; i < n; i++){
    const y = 2026 + Math.floor((from - 1 + i) / 12), m = ((from - 1 + i) % 12) + 1;
    out.push({ date: y + "-" + String(m).padStart(2, "0") + "-" + String(day || 9).padStart(2, "0"), what, amount: typeof amount === "function" ? amount(i) : amount, linkedExpenseId: line });
  }
  return out;
}
test("one bill the bank names three ways — direct debit, then a card, then renamed — is one subscription", function(){
  const tx = [].concat(
    monthly("From EXAMPLE NET -", "net", 1, 5, 85, 28),
    monthly("Example Net card Town A AUS", "net", 6, 3, 95, 1),
    monthly("Internet", "net", 9, 2, 99, 1));
  const list = subscriptionList(tx, "2026-10-20", {});
  const net = list.filter(s => s.line === "net");
  assert.equal(net.length, 1, "once, not three times");
  assert.equal(net[0].count, 10);
  assert.equal(net[0].amount, 99);
  assert.equal(net[0].name, "Internet", "the newest name");
  assert.deepEqual(net[0].lastRise && [net[0].lastRise.from, net[0].lastRise.to], [95, 99]);
});
test("two services filed to one line that charge over the same months stay two", function(){
  const tx = [].concat(monthly("STREAM ONE", "subs", 1, 8, 15.99), monthly("STREAM TWO", "subs", 1, 8, 9.99, 12));
  const list = subscriptionList(tx, "2026-08-20", {});
  assert.equal(list.filter(s => s.line === "subs").length, 2);
});
test("a cancel-by date set under the old name stays with the joined subscription", function(){
  const tx = [].concat(monthly("OLD NAME INSURE", "car", 1, 6, 118.79), monthly("Car insurance", "car", 7, 3, 118.79));
  const oldKey = repeatingPayees(tx.slice(0, 6), "2026-06-20", { includeLinked: true })[0].key;
  const list = subscriptionList(tx, "2026-09-20", { [oldKey]: { cancelBy: "2026-12-01" } });
  assert.equal(list.length, 1);
  assert.equal(list[0].cancelBy, "2026-12-01");
});
test("a day with two charges isn't read as the old price", function(){
  const c = [{ date: "2025-11-07", amount: 118.95 }, { date: "2025-11-07", amount: 89.95 }, { date: "2025-12-09", amount: 118.79 }, { date: "2026-01-07", amount: 118.79 }];
  assert.equal(lastRise(c), null);
  assert.deepEqual(lastRise([{ date: "2026-01-01", amount: 35 }, { date: "2026-02-01", amount: 35 }, { date: "2026-03-01", amount: 40 }]), { date: "2026-03-01", from: 35, to: 40 });
});
