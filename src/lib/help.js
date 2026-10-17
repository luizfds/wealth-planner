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
function schedule(){
  if(scheduled) return;
  scheduled = true;
  requestAnimationFrame(function(){ scheduled = false; decorateHelp(document); });
}
export function initHelp(){
  document.body.classList.toggle("help-hidden", !showHelpPreference());
  decorateHelp(document);
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  document.addEventListener("click", function(e){
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
