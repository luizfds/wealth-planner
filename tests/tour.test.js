import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { TOUR_KEY, TOUR_STEPS, tourStatus, setTourStatus, offerTourOnce, placeTourCard } from "../src/lib/tour.js";
import { tourOfferHtml, tourShellHtml, tourStepHtml } from "../src/components/tour.js";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
function fakeStorage(start){
  var data = Object.assign({}, start);
  return { getItem: function(k){ return k in data ? data[k] : null; }, setItem: function(k, v){ data[k] = String(v); }, data: data };
}
const broken = { getItem: function(){ throw new Error("blocked"); }, setItem: function(){ throw new Error("blocked"); } };

test("the tour is offered once, and either answer is remembered (#339)", () => {
  var s = fakeStorage();
  assert.equal(tourStatus(s), null, "never came up");
  assert.equal(offerTourOnce(s), true);
  assert.equal(tourStatus(s), "offer");
  assert.equal(offerTourOnce(s), false, "already on offer — nothing new to draw");
  ["skipped", "done"].forEach(function(answer){
    setTourStatus(s, answer);
    assert.equal(offerTourOnce(s), false, "answered (" + answer + "): never offered again");
    assert.equal(tourStatus(s), answer);
  });
  assert.equal(tourStatus(fakeStorage({ [TOUR_KEY]: "something else" })), null, "an unknown value reads as never seen");
});

test("storage that refuses doesn't break the tour, and doesn't offer what it can't put away", () => {
  assert.equal(tourStatus(broken), null);
  assert.doesNotThrow(function(){ setTourStatus(broken, "done"); });
  assert.equal(offerTourOnce(broken), false);
  assert.equal(tourStatus(null), null);
});

test("each place is named as the menu names it, and points at something in the page", () => {
  var navLabel = {}, tabLabel = {};
  html.replace(/class="nav-item" data-page="([a-z]+)">([^<]+)/g, function(_, page, label){ navLabel[page] = label.trim(); return _; });
  html.replace(/class="mobile-tab" data-page="([a-z]+)">[\s\S]*?mobile-tab-label">([^<]+)/g, function(_, page, label){ tabLabel[page] = label.trim(); return _; });
  ["dashboard", "expenses", "networth", "tax", "plan"].forEach(function(page){
    var step = TOUR_STEPS.find(function(s){ return s.page === page && s.targets && s.targets[0].indexOf(".nav-item") === 0; });
    assert.ok(step, "a step for " + page);
    assert.equal(step.title, navLabel[page], "the sidebar's label");
    assert.equal(step.title, tabLabel[page], "the tab bar's label");
  });
  var scen = TOUR_STEPS.find(function(s){ return s.key === "scenarios"; });
  assert.match(html, /data-plan-sub="scenarios">Scenarios</, "Scenarios is a tab of Plan");
  assert.equal(scen.page, "plan"); assert.equal(scen.title, "Scenarios");
  TOUR_STEPS.forEach(function(s){
    (s.targets || []).forEach(function(sel){
      var id = /^#([A-Za-z]+)/.exec(sel);
      if(id) assert.ok(html.indexOf('id="' + id[1] + '"') !== -1, sel + " is in index.html");
    });
    if(s.page) assert.ok(html.indexOf('id="page-' + s.page + '"') !== -1, "page " + s.page + " exists");
  });
  assert.equal(TOUR_STEPS[TOUR_STEPS.length - 1].checklist, true, "it ends on the first steps");
  assert.ok(TOUR_STEPS.length <= 9, "a quick tour, not a tutorial");
});

test("the tour's copy is the app's own: no figures, nothing technical", () => {
  TOUR_STEPS.forEach(function(s){
    assert.doesNotMatch(s.title + " " + s.text, /[$0-9]/, s.key + " carries no amounts");
    assert.ok(s.text.length <= 190, s.key + " is short enough to read at a glance");
  });
});

test("the card sits beside what it points at, inside the screen, never over it", () => {
  var card = { width: 340, height: 220 };
  function overlaps(a, at){ return !(at.left + card.width <= a.left || at.left >= a.left + a.width || at.top + card.height <= a.top || at.top >= a.top + a.height); }
  function inside(at, vp){ return at.left >= 0 && at.top >= 0 && at.left + card.width <= vp.width && at.top + card.height <= vp.height; }
  var desktop = { width: 1280, height: 800 }, phone = { width: 390, height: 844 };
  var sidebar = { left: 8, top: 116, width: 200, height: 50 };
  var a = placeTourCard(sidebar, card, desktop, "right");
  assert.equal(a.side, "right"); assert.ok(!overlaps(sidebar, a) && inside(a, desktop));
  var tab = { left: 318, top: 777, width: 70, height: 65 };
  var b = placeTourCard(tab, card, phone, null);
  assert.equal(b.side, "above"); assert.ok(!overlaps(tab, b) && inside(b, phone));
  var avatar = { left: 334, top: 9, width: 46, height: 46 };
  var c = placeTourCard(avatar, card, phone, "right");
  assert.equal(c.side, "below", "the preferred side doesn't fit, so the next that does");
  assert.ok(!overlaps(avatar, c) && inside(c, phone));
  var d = placeTourCard(null, card, phone, null);
  assert.equal(d.side, "center"); assert.ok(inside(d, phone));
  var tiny = { width: 320, height: 300 }, wide = { left: 0, top: 100, width: 320, height: 100 };
  var e = placeTourCard(wide, card, tiny, null);
  assert.equal(e.side, "center", "nowhere fits: still on screen");
  assert.ok(e.left >= 0 && e.top >= 0);
});

test("the tour's markup: a named dialog, a live step, and the first steps as places to go", () => {
  var shell = tourShellHtml();
  assert.match(shell, /role="dialog" aria-modal="true" aria-label="Quick tour"/);
  assert.match(shell, /aria-live="polite"/);
  ["data-tour-next", "data-tour-back", "data-tour-end", "aria-label=\"Close the tour\""].forEach(function(a){ assert.ok(shell.indexOf(a) !== -1, a); });
  var first = tourStepHtml(TOUR_STEPS[0], 0, TOUR_STEPS.length, []);
  assert.match(first, /Step 1 of 9/); assert.match(first, /<h2 class="tour-title">Home<\/h2>/);
  assert.doesNotMatch(first, /data-tour-go/);
  var last = tourStepHtml(TOUR_STEPS[TOUR_STEPS.length - 1], TOUR_STEPS.length - 1, TOUR_STEPS.length,
    [{ label: "Add your pay", done: true }, { label: "A <b>step</b>", done: false }]);
  assert.equal((last.match(/data-tour-go=/g) || []).length, 2);
  assert.match(last, /is-done[\s\S]*Add your pay<span class="visually-hidden"> \(done\)/);
  assert.match(last, /A &lt;b/, "labels are escaped");
  assert.doesNotMatch(first + last + shell + tourOfferHtml(), /undefined|NaN/);
  var offer = tourOfferHtml();
  assert.match(offer, /data-tour-skip>Skip</); assert.match(offer, /data-tour-start>Start tour</);
});

test("index.html has the offer on Home, the tour's root, and a way back to it in the menu", () => {
  assert.match(html, /id="tourOffer"[^>]*hidden/);
  assert.match(html, /<div id="tourRoot"><\/div>/);
  assert.match(html, /avatar-item" data-tour-start[^>]*>Take a tour</);
});
