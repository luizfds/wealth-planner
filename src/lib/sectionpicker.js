// #259: keep the existing buttons and their navigation/leave guards as the authority.
// A native picker replaces them only when their full-size labels do not fit.
var RAILS = ".subnav, .time-range-control";

export function initSectionPickers(root){
  var scheduled = false, observed = new Set(), sources = new WeakMap(), restore = null;
  var observer = new MutationObserver(function(records){
    // Help/row decoration elsewhere on the page also changes hidden attributes. Watching
    // those writes makes the decorators and picker wake each other on every frame.
    if(records.some(function(record){
      var target = record.target;
      if(target.closest && target.closest(RAILS)) return true;
      if(record.type === "attributes") return !!target.querySelector(RAILS);
      return Array.from(record.addedNodes).concat(Array.from(record.removedNodes)).some(function(node){
        return node.nodeType === 1 && (node.matches(RAILS) || node.querySelector(RAILS));
      });
    })) schedule();
  });
  var resize = new ResizeObserver(schedule);
  function watch(){
    observer.observe(root, { subtree: true, childList: true, attributes: true,
      attributeFilter: ["hidden", "aria-current", "aria-selected", "aria-pressed"] });
  }
  function schedule(){
    if(scheduled) return;
    scheduled = true;
    requestAnimationFrame(update);
  }
  function update(){
    scheduled = false;
    // Our own options and labels must not schedule another pass.
    observer.disconnect();
    observed.forEach(function(rail){ if(!rail.isConnected){ resize.unobserve(rail); observed.delete(rail); } });
    root.querySelectorAll(RAILS).forEach(function(rail){
      if(!observed.has(rail)){ observed.add(rail); resize.observe(rail); }
      if(!rail.getClientRects().length) return;
      rail.classList.remove("has-section-picker");
      var buttons = Array.from(rail.children).filter(function(el){ return el.matches("button") && el.getClientRects().length; });
      if(!buttons.length) return;
      var picker = rail.querySelector(":scope > .section-picker");
      if(!picker){
        picker = document.createElement("select");
        picker.className = "field-control section-picker";
        picker.setAttribute("aria-label", rail.getAttribute("aria-label") || "Section");
        rail.appendChild(picker);
        picker.addEventListener("change", function(){
          var source = sources.get(picker)[Number(picker.value)];
          restore = { label: picker.getAttribute("aria-label"), page: rail.closest(".app-page"), old: picker };
          if(source && !source.disabled) source.click();
          // The click may be rejected by a leave guard. The next pass reads the actual selection.
          schedule();
        });
      }
      // Measure the original controls, including phone target floors, at the rail's actual width.
      // Reading and restoring happen in one frame, so the tabs never flash on screen.
      sources.set(picker, buttons);
      var style = getComputedStyle(rail);
      var need = buttons.reduce(function(sum, b){ return sum + b.getBoundingClientRect().width; }, 0) +
        (parseFloat(style.columnGap) || 0) * (buttons.length - 1);
      var room = rail.clientWidth - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0);
      var compact = need > room + 1;
      rail.classList.toggle("has-section-picker", compact);
      var selected = Math.max(0, buttons.findIndex(function(b){
        return b.getAttribute("aria-current") === "page" || b.getAttribute("aria-selected") === "true" || b.getAttribute("aria-pressed") === "true";
      }));
      buttons.forEach(function(b, i){
        var option = picker.options[i];
        if(!option){ option = document.createElement("option"); picker.appendChild(option); }
        option.value = String(i);
        option.textContent = b.textContent.trim();
        option.disabled = b.disabled;
      });
      while(picker.options.length > buttons.length) picker.remove(picker.options.length - 1);
      picker.value = String(selected);
      // A select is not a tab: the hidden original tabs still name their panels.
      if(rail.matches(".prop-tabs")) rail.setAttribute("role", compact ? "group" : "tablist");
      if(compact && buttons.includes(document.activeElement)) picker.focus({ preventScroll: true });
      else if(!compact && document.activeElement === picker) buttons[selected].focus({ preventScroll: true });
      if(restore && !restore.old.isConnected && rail.closest(".app-page") === restore.page &&
        picker.getAttribute("aria-label") === restore.label && document.activeElement === document.body){
        (compact ? picker : buttons[selected]).focus({ preventScroll: true });
      }
    });
    restore = null;
    watch();
  }
  window.addEventListener("resize", schedule);
  // Household parts are CSS switches on body; a hidden Shares/Property destination must
  // disappear from the native options too, even when the rail's dimensions stay unchanged.
  new MutationObserver(schedule).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  if(document.fonts) document.fonts.ready.then(schedule);
  update();
}
