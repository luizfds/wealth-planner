// ---------------- Light, dark or the system's (v3.206.2, item 237b — from app.js) ----------------
// Per device, in localStorage; applied first thing at startup (app.js) so the page never flashes the other one.
export var THEME_KEY = "wealthPlanner.theme";
export var THEME_MODES = ["system", "light", "dark"];
export function applyTheme(mode){
  if(mode === "light" || mode === "dark") document.documentElement.setAttribute("data-theme", mode);
  else document.documentElement.removeAttribute("data-theme");
}
export function getThemePref(){
  try{ return localStorage.getItem(THEME_KEY) || "system"; }catch(e){ return "system"; }
}
