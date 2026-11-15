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

// Keep the selected error in the usable page area as its summary/header reflows.
// One watch follows the focused field's DOM identity through a redraw; it never restores focus.
var stopPositionWatch = null;
function positionErrorTarget(input){
  if(stopPositionWatch) stopPositionWatch();
  input.scrollIntoView({block:'center', behavior:'instant'});
  if(input.closest('dialog, [role="dialog"]')) return;
  var id = input.id, key = input.getAttribute('data-error-key'), scope = null, active = true, queued = false;
  var viewport = window.visualViewport, observer = typeof ResizeObserver === 'function' ? new ResizeObserver(changed) : null;
  function stop(){
    active = false;
    if(observer) observer.disconnect();
    document.removeEventListener('focusin', focusChanged, true);
    document.removeEventListener('focusout', focusChanged, true);
    window.removeEventListener('wheel', stop, true); window.removeEventListener('touchstart', stop, true);
    window.removeEventListener('pointerdown', stop, true); window.removeEventListener('keydown', keys);
    window.removeEventListener('resize', changed);
    if(viewport){ viewport.removeEventListener('resize', changed); viewport.removeEventListener('scroll', changed); }
    if(stopPositionWatch === stop) stopPositionWatch = null;
  }
  function fit(center){
    if(!active) return;
    var live = document.getElementById(id);
    if(!live || live !== document.activeElement || !live.getClientRects().length || live.disabled || live.closest('[inert]') || live.getAttribute('data-error-key') !== key){ stop(); return; }
    input = live;
    var nextScope = longFormScope(input);
    if(!nextScope){ stop(); return; }
    if(observer && nextScope !== scope){
      if(scope) observer.unobserve(scope);
      scope = nextScope; if(scope) observer.observe(scope, {box:'border-box'});
    }
    var top = viewport ? viewport.offsetTop : 0, bottom = top + (viewport ? viewport.height : window.innerHeight);
    var header = document.querySelector('.app-topbar'), h = header && header.getBoundingClientRect();
    if(h && header.getClientRects().length && h.top <= top && h.bottom > top && h.bottom < bottom) top = h.bottom;
    var nav = document.querySelector('.mobile-tabbar'), n = nav && nav.getBoundingClientRect();
    if(n && nav.getClientRects().length && n.top > top && n.top < bottom) bottom = n.top;
    var r = input.getBoundingClientRect(), gap = Math.min(8, Math.max(0, (bottom - top - r.height) / 2));
    var delta = center ? r.top + r.height / 2 - (top + bottom) / 2 : r.top < top + gap ? r.top - top - gap : r.bottom > bottom - gap ? r.bottom - bottom + gap : 0;
    if(Math.abs(delta) > 0.5) window.scrollBy({top:delta, behavior:'instant'});
  }
  function changed(){ fit(false); }
  function focusChanged(){
    if(queued) return;
    queued = true; queueMicrotask(function(){ queued = false; changed(); });
  }
  function keys(e){ if(['Tab', 'Escape', 'PageUp', 'PageDown'].indexOf(e.key) !== -1) stop(); }
  stopPositionWatch = stop;
  document.addEventListener('focusin', focusChanged, true); document.addEventListener('focusout', focusChanged, true);
  window.addEventListener('wheel', stop, {passive:true,capture:true}); window.addEventListener('touchstart', stop, {passive:true,capture:true});
  window.addEventListener('pointerdown', stop, {passive:true,capture:true}); window.addEventListener('keydown', keys);
  window.addEventListener('resize', changed, {passive:true});
  if(viewport){ viewport.addEventListener('resize', changed, {passive:true}); viewport.addEventListener('scroll', changed, {passive:true}); }
  if(observer) document.querySelectorAll('.app-topbar, .mobile-tabbar').forEach(function(el){ observer.observe(el, {box:'border-box'}); });
  fit(true); requestAnimationFrame(changed);
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
    positionErrorTarget(input);
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
