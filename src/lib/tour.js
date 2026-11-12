// The quick tour (#339): where each of the app's places is, in the order the menu lists them, ending on
// the first-month steps (lib/setup.js) rather than a checklist of its own.
//
// Pure: the steps, what's remembered about them, and where the card sits beside what it points at. No
// DOM and no state — components/tour.js draws it and components/tourwiring.js runs it.

// Remembered per browser, not in `state`: a tour is about the person at this screen, not the household
// (a partner on another device hasn't seen it), and it has to survive Reset and loading sample data.
export var TOUR_KEY = "wealthPlanner.tour";
// null — never came up. "offer" — Home asks once. "done" / "skipped" — answered; only the menu starts it.
export function tourStatus(storage){
  try {
    var v = storage.getItem(TOUR_KEY);
    return v === "offer" || v === "done" || v === "skipped" ? v : null;
  } catch(e){ return null; }
}
export function setTourStatus(storage, status){
  try { storage.setItem(TOUR_KEY, status); } catch(e){ /* private mode: the tour still runs, just unremembered */ }
}
// The offer comes up once, when someone has just arrived (the setup sheet closed, or the sample household
// loaded) — never for a household that was already here before the tour existed, and never twice.
export function offerTourOnce(storage){
  if(tourStatus(storage) !== null) return false;
  setTourStatus(storage, "offer");
  return tourStatus(storage) === "offer";
}

function navTargets(page){
  // The sidebar on a desktop, the tab bar on a phone, and the menu button where the sidebar folds away.
  return ['.nav-item[data-page="' + page + '"]', '.mobile-tab[data-page="' + page + '"]', "#navMenuToggle"];
}
// `title` of a place is its label in the menu, word for word (tests/tour.test.js holds them to index.html).
// `page` is shown behind the card; `targets` are tried in order and the first one on screen is ringed — a
// step whose target isn't there (a narrower layout, a later redesign) is still read, just without a ring.
export var TOUR_STEPS = [
  { key: "home", title: "Home", page: "dashboard", targets: navTargets("dashboard"),
    text: "Your money at a glance: what you're worth, how this month is going against your plan, and anything that needs doing." },
  { key: "cashflow", title: "Cash flow", page: "expenses", targets: navTargets("expenses"),
    text: "Your budget, your pay after tax, what you actually spent — brought in from bank statements — and the bills coming up." },
  { key: "networth", title: "Net worth", page: "networth", targets: navTargets("networth"),
    text: "Everything you own and owe: accounts, investments and super, and property with its loans." },
  { key: "tax", title: "Tax", page: "tax", targets: navTargets("tax"),
    text: "Income tax, Medicare and super worked out from your pay, with each year's return and the documents for it." },
  { key: "plan", title: "Plan", page: "plan", targets: navTargets("plan"),
    text: "Looking ahead: how your net worth could grow, savings goals and retirement — built on the same numbers as every other page." },
  { key: "scenarios", title: "Scenarios", page: "plan", sub: "scenarios", targets: ['#planSubnav [data-plan-sub="scenarios"]', "#planSubnav .section-picker"],
    text: "A scenario is a safe what-if: keep renting or buy, a different job. Change anything in one and your real figures stay as they are, then compare scenarios side by side." },
  { key: "add", title: "Adding and editing", page: "expenses", targets: ["#headerAddBtn", "#quickFab"],
    text: "The + button adds to whichever page you're on. To change something already there, open its row." },
  { key: "menu", title: "Your menu", targets: ["#avatarBtn"],
    text: "Reports, calculators, settings and backups live here — and this tour, whenever you'd like it again." },
  { key: "start", title: "Getting started", page: "dashboard", checklist: true,
    text: "That's the lot. Nothing is required and any order works — these make a good start:" }
];

// Where the card goes: beside what it points at, never over it. `target` and `card` are boxes in viewport
// pixels ({left, top, width, height}); `prefer` is the side tried first. With no target, or no side that
// fits, the card is centred (low on a short screen, where the middle would crowd whatever is ringed).
export function placeTourCard(target, card, viewport, prefer){
  var margin = 12, gap = 12;
  var maxLeft = Math.max(margin, viewport.width - card.width - margin), maxTop = Math.max(margin, viewport.height - card.height - margin);
  function clamp(v, hi){ return Math.max(margin, Math.min(hi, v)); }
  var centred = { side: "center", left: clamp((viewport.width - card.width) / 2, maxLeft), top: clamp((viewport.height - card.height) / 2, maxTop) };
  if(!target) return centred;
  var alongX = clamp(target.left + target.width / 2 - card.width / 2, maxLeft), alongY = clamp(target.top + target.height / 2 - card.height / 2, maxTop);
  var sides = {
    below: { fits: target.top + target.height + gap + card.height <= viewport.height - margin, left: alongX, top: target.top + target.height + gap },
    above: { fits: target.top - gap - card.height >= margin, left: alongX, top: target.top - gap - card.height },
    right: { fits: target.left + target.width + gap + card.width <= viewport.width - margin, left: target.left + target.width + gap, top: alongY },
    left: { fits: target.left - gap - card.width >= margin, left: target.left - gap - card.width, top: alongY }
  };
  var order = (prefer ? [prefer] : []).concat(["below", "above", "right", "left"]);
  for(var i = 0; i < order.length; i++){
    var s = sides[order[i]];
    if(s && s.fits) return { side: order[i], left: s.left, top: s.top };
  }
  return centred;
}
