// Section explanations behind an ⓘ (v3.33.0).
//
// Nearly every section opened with a paragraph or three of explanation. They're good on a first
// visit and in the way on the fiftieth — on a phone they put the section's content below the fold.
// Explanatory paragraphs carry class "help"; with the household preference off (the default), they
// are hidden and each section that has one gets an ⓘ in its header that reveals just that
// section's. The preference is per device, like the theme: it's about how you read, not your data.
//
// Decoration is done by a MutationObserver rather than by every renderer, because explanations are
// written by a dozen components, several of which replace their whole section on every edit.

var KEY = "wealthPlanner.showHelp";
var scheduled = false;

export function showHelpPreference(){
  try{ return localStorage.getItem(KEY) === "1"; }catch(e){ return false; }
}
export function setShowHelp(on){
  try{ localStorage.setItem(KEY, on ? "1" : "0"); }catch(e){}
  document.body.classList.toggle("help-hidden", !on);
}

// The element whose header gets the ⓘ: the nearest <details> with a <summary>, or — for help that
// isn't inside one — the help paragraph itself, which gets an inline button in front of it.
function hostFor(el){
  var d = el.closest("details");
  return d && d.querySelector(":scope > summary") ? d : null;
}
function buttonHtml(){
  return '<button type="button" class="help-btn" data-help-toggle aria-expanded="false" title="About this section" aria-label="About this section">' +
    '<svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="10" cy="10" r="8"/><path d="M10 9v5" stroke-linecap="round"/><circle cx="10" cy="6.2" r="0.9" fill="currentColor" stroke="none"/></svg></button>';
}
export function decorateHelp(root){
  (root || document).querySelectorAll(".help").forEach(function(el){
    // A page's own intro (v3.138.0) gets no ⓘ of its own row — the one beside the page title shows it.
    if(el.classList.contains("page-intro")) return;
    var host = hostFor(el);
    if(host){
      var summary = host.querySelector(":scope > summary");
      if(summary.querySelector(":scope [data-help-toggle]")) return;
      var title = summary.querySelector(".ledger-title") || summary;
      title.insertAdjacentHTML("beforeend", buttonHtml());
      return;
    }
    var prev = el.previousElementSibling;
    if(prev && (prev.matches("[data-help-toggle]") || prev.classList.contains("help"))) return;
    el.insertAdjacentHTML("beforebegin", buttonHtml().replace('class="help-btn"', 'class="help-btn help-btn-inline"'));
  });
}
// ---- The page's ⓘ, beside its title (v3.138.0) ----
// Each page and tab opens with a one-line intro (.page-intro.help). Its ⓘ used to sit on a row of its
// own above the content, on nearly every page; now one ⓘ beside the title shows the intro of
// whatever is on screen, and isn't there when what's on screen has none.
// Whether what holds an intro is on screen. An intro row is itself folded away while its intro is
// hidden, so it's the row's own container that says.
function onScreen(el){
  var holder = (el.closest(".page-intro-row") || el).parentElement;
  return !!holder && holder.getClientRects().length > 0;
}
function introsOnScreen(){
  return Array.prototype.filter.call(document.querySelectorAll(".page-intro.help"), onScreen);
}
// A page's own actions (its ⋯ import/export menu, Spending's Review button) sat in the same row as
// its intro, so with the intro tucked away they were alone on a row too. They move into the header
// beside the title, each remembering the row it came from, and show while that row is on screen.
var movedActions = [];
function movePageActions(){
  var slot = document.getElementById("pageActionsSlot");
  if(!slot) return;
  document.querySelectorAll(".page-intro-row > .page-intro-actions").forEach(function(el){
    movedActions.push({ el: el, home: el.parentElement });
    slot.appendChild(el);
  });
}
export function updatePageHelp(){
  movedActions.forEach(function(m){ m.el.hidden = !onScreen(m.home); });
  var btn = document.getElementById("pageHelpBtn");
  if(!btn) return;
  var intros = introsOnScreen();
  btn.hidden = !intros.length;
  btn.setAttribute("aria-expanded", String(intros.length > 0 && intros.every(function(el){ return el.classList.contains("help-open"); })));
}
function addPageHelpButton(){
  var title = document.getElementById("pageTitle");
  if(!title || document.getElementById("pageHelpBtn")) return;
  title.insertAdjacentHTML("afterend", buttonHtml().replace('class="help-btn" data-help-toggle', 'class="help-btn page-help-btn" id="pageHelpBtn" data-page-help')
    .replace(/About this section/g, "About this page") + '<div class="page-actions-slot" id="pageActionsSlot"></div>');
  movePageActions();
}
var pending = { decorate: false, page: false };
function schedule(mutations){
  (mutations || []).forEach(function(m){ if(m.type === "childList") pending.decorate = true; else pending.page = true; });
  if(scheduled) return;
  scheduled = true;
  requestAnimationFrame(function(){
    scheduled = false;
    if(pending.decorate) decorateHelp(document);
    pending.decorate = false; pending.page = false;
    updatePageHelp();
  });
}
export function initHelp(){
  document.body.classList.toggle("help-hidden", !showHelpPreference());
  decorateHelp(document);
  addPageHelpButton();
  updatePageHelp();
  // Pages and tabs are shown by class and `hidden`, so those changes move the page's ⓘ too.
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "hidden"] });
  document.addEventListener("click", function(e){
    var page = e.target.closest("[data-page-help]");
    if(page){
      var intros = introsOnScreen(), open = page.getAttribute("aria-expanded") !== "true";
      intros.forEach(function(el){ el.classList.toggle("help-open", open); });
      page.setAttribute("aria-expanded", String(open));
      return;
    }
    var btn = e.target.closest("[data-help-toggle]");
    if(!btn) return;
    // Inside a <summary>, a click would also open/close the section; the ⓘ only reveals its text.
    e.preventDefault();
    e.stopPropagation();
    var open = btn.getAttribute("aria-expanded") !== "true";
    btn.setAttribute("aria-expanded", String(open));
    var details = btn.closest("details");
    if(details && btn.closest("summary")){
      details.classList.toggle("help-open", open);
      if(open) details.open = true;
    } else {
      btn.classList.toggle("help-open", open);
    }
  }, true);
}
