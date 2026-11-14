// Long forms reuse the inline validation result; summaries never validate or save a value.
var controllers = new WeakMap(), records = new WeakMap(), nextRecord = 0;

// DOM-only identity: deleting or reordering a repeated row must not move its invalid draft
// to the next row. Nothing is added to the saved financial record.
export function draftFieldKey(record, field){
  if(!records.has(record)) records.set(record, ++nextRecord);
  return "draft-" + records.get(record) + "-" + field;
}

// Present before an error occurs, so a polite announcement is a change to an existing live region.
export function errorSummaryLiveHtml(){
  return '<p class="visually-hidden" data-error-summary-live aria-live="polite" aria-atomic="true"></p>';
}

export function longFormScope(input){
  if(!input || !input.closest || input.disabled) return null;
  var scope = input.closest('[data-error-scope]');
  if(!scope || !scope.hasAttribute || !scope.hasAttribute('data-error-scope')) return null;
  var dialog = input.closest('[role="dialog"], dialog');
  if(dialog && !dialog.contains(scope)) return null; // short nested row editors have inline errors
  var edit = input.closest('.prop-edit');
  if(edit && !scope.classList.contains('is-editing')) return null;
  for(var n = input; n && n !== scope; n = n.parentElement){
    if(n.hidden && !n.matches('[role="tabpanel"]')) return null;
  }
  return scope;
}

function fieldName(input){
  var ids = (input.getAttribute('aria-labelledby') || '').split(/\s+/).filter(Boolean);
  var labelled = ids.map(function(id){ var el = document.getElementById(id); return el ? el.textContent : ''; }).join(' ').trim();
  var name = (labelled || input.getAttribute('aria-label') || Array.from(input.labels || []).map(function(l){ return l.textContent; }).join(' ') ||
    (input.closest('.calc-field, .proj-field, .m-edit-field') || input.parentElement).querySelector('label')?.textContent || 'Figure').replace(/\s+/g, ' ').trim();
  var row = input.closest('.cc-row, .ty-row');
  if(!row) return name;
  var description = row.querySelector('.cc-what, [data-ty-key="payer"], [data-ty-key="account"], [data-ty-key="what"]');
  if(description && description.value.trim()) return description.value.trim() + ': ' + name;
  if(row.classList.contains('ty-row')) return 'Row ' + (Number(input.getAttribute('data-ty-index')) + 1) + ': ' + name;
  return name;
}
function errorMessage(input){
  return (input.getAttribute('aria-describedby') || '').split(/\s+/).map(function(id){ return document.getElementById(id); })
    .filter(function(el){ return el && el.classList.contains('field-error'); }).map(function(el){ return el.textContent.trim(); }).filter(Boolean).join(' ');
}

function controller(scope){
  var summary = document.createElement('section');
  summary.className = 'error-summary';
  summary.setAttribute('data-error-summary', '');
  summary.setAttribute('aria-label', 'Figures to fix: ' + scope.getAttribute('data-error-scope'));
  summary.hidden = true;
  var count = document.createElement('p');
  count.className = 'error-summary-count';
  var live = scope.querySelector(':scope > [data-error-summary-live]');
  var list = document.createElement('ul');
  summary.append(count, list); scope.prepend(summary);
  var last = '', queued = false, hadErrors = false;
  function update(){
    queued = false;
    var errors = Array.from(scope.querySelectorAll('[aria-invalid="true"]')).filter(function(el){ return longFormScope(el) === scope; })
      .map(function(el){ return {id:el.id, name:fieldName(el), message:errorMessage(el)}; }).filter(function(e){ return e.id && e.message; });
    var key = JSON.stringify(errors);
    if(key === last) return;
    last = key;
    // Reuse links that remain, including the focused link when another field changes.
    var old = new Map(Array.from(list.querySelectorAll('a')).map(function(a){ return [a.getAttribute('data-error-target'), a]; }));
    errors.forEach(function(error){
      var a = old.get(error.id);
      if(!a){ a = document.createElement('a'); var li = document.createElement('li'); li.append(a); list.append(li); }
      old.delete(error.id);
      a.setAttribute('href', '#' + error.id); a.setAttribute('data-error-target', error.id);
      var text = error.name + ' — ' + error.message;
      if(a.textContent !== text) a.textContent = text;
    });
    old.forEach(function(a){ a.parentElement.remove(); });
    var countText = errors.length ? errors.length + (errors.length === 1 ? ' figure needs fixing' : ' figures need fixing') : '';
    if(count.textContent !== countText) count.textContent = countText;
    var announcement = countText || (hadErrors ? 'All figures fixed.' : '');
    if(live && live.textContent !== announcement) live.textContent = announcement;
    hadErrors = !!errors.length;
    summary.hidden = !errors.length;
  }
  function schedule(){
    if(queued) return;
    queued = true; queueMicrotask(update);
  }
  summary.addEventListener('click', function(e){
    var link = e.target.closest('[data-error-target]');
    if(!link) return;
    e.preventDefault();
    var input = document.getElementById(link.getAttribute('data-error-target'));
    if(!input || !scope.contains(input)) { schedule(); return; }
    input.dispatchEvent(new CustomEvent('reveal-field-error', {bubbles:true}));
    for(var n = input.parentElement; n; n = n.parentElement) if(n.tagName === 'DETAILS') n.open = true;
    input.focus({preventScroll:true});
    input.scrollIntoView({block:'center', behavior:'instant'});
  });
  if(typeof MutationObserver === 'function'){
    new MutationObserver(function(changes){
      if(changes.some(function(c){ var target = c.target.nodeType === 1 ? c.target : c.target.parentElement; return target && !target.closest('[data-error-summary]'); })) schedule();
    }).observe(scope, {subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:['aria-invalid','disabled','hidden','class']});
  }
  return {schedule:schedule};
}

export function refreshErrorSummary(input){
  var scope = longFormScope(input);
  if(!scope) return;
  var c = controllers.get(scope);
  if(!c && input.getAttribute('aria-invalid') !== 'true') return;
  if(!c){ c = controller(scope); controllers.set(scope, c); }
  c.schedule();
}
