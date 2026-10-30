import { state } from "../state.js";
import { categoryLook } from "../calc/categorylook.js";
import { escapeAttr } from "./html.js";

// ---------------- Category icons (v3.157.0, item 187) — calc/categorylook.js picks them ----------------
// Drawn here on a 20×20 grid, stroked in the category's colour: no icon font, nothing from a CDN.
var PATHS = {
  cart: "M3 4h2l1.6 8.2a1 1 0 0 0 1 .8h6.6a1 1 0 0 0 1-.8L16.5 7H6M8 16.5h.01M14 16.5h.01",
  fork: "M6 3v5a2 2 0 0 0 2 2v7M8 3v4M10 3v5a2 2 0 0 1-2 2M14 17V3c-1.7 1-2.5 3-2.5 5.5V11H14",
  fuel: "M4 17V5a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v12M3 17h11M5.5 8h6M13 9h1.5a1.5 1.5 0 0 1 1.5 1.5V14a1 1 0 0 0 2 0V8l-2-2",
  bus: "M5 15V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v10M4 15h12M5 9h10M7 15v2M13 15v2M7.5 12h.01M12.5 12h.01",
  car: "M3 13v-2.5L4.8 6.6A2 2 0 0 1 6.6 5.5h6.8a2 2 0 0 1 1.8 1.1L17 10.5V13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM3.5 10.5h13M6 14v2M14 14v2",
  house: "M3 9.5 10 4l7 5.5M5 8v8h10V8M8.5 16v-4h3v4",
  building: "M4 17V4h8v13M12 8h4v9M2.5 17h15M6.5 7h1M6.5 10h1M6.5 13h1M9 7h.5M9 10h.5M9 13h.5",
  bolt: "M11 2.5 4.5 11H10l-1 6.5L15.5 9H10z",
  phone: "M7 2.5h6a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 16V4A1.5 1.5 0 0 1 7 2.5zM9 15h2",
  shield: "M10 2.5 4 5v4.5c0 3.7 2.5 6.5 6 8 3.5-1.5 6-4.3 6-8V5z",
  heart: "M10 16.5s-6-3.6-6-8A3.3 3.3 0 0 1 10 6a3.3 3.3 0 0 1 6 2.5c0 4.4-6 8-6 8z",
  dumbbell: "M3 10h14M5 6.5v7M7.5 5v10M12.5 5v10M15 6.5v7",
  book: "M4 4.5A1.5 1.5 0 0 1 5.5 3H16v12H5.5A1.5 1.5 0 0 0 4 16.5zM4 16.5A1.5 1.5 0 0 0 5.5 18H16v-3",
  child: "M10 7.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM6 17v-4a4 4 0 0 1 8 0v4M8.5 4.5h.01M11.5 4.5h.01",
  repeat: "M4 9V8a3 3 0 0 1 3-3h9m-2.5-2.5L16 5l-2.5 2.5M16 11v1a3 3 0 0 1-3 3H4m2.5 2.5L4 15l2.5-2.5",
  bag: "M4.5 7h11l-1 10h-9zM7.5 7V5.5a2.5 2.5 0 0 1 5 0V7",
  user: "M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM4 17a6 6 0 0 1 12 0",
  paw: "M10 11c-2.5 0-4.5 2.4-4.5 4.2 0 1.5 1.5 1.8 2.6 1.4.8-.3 1.2-.4 1.9-.4s1.1.1 1.9.4c1.1.4 2.6.1 2.6-1.4 0-1.8-2-4.2-4.5-4.2zM5 8.5h.01M8 5.5h.01M12 5.5h.01M15 8.5h.01",
  plane: "M17 4.5 3 9.5l5 1.5 1.5 5 2-3.5L15 15z",
  gift: "M3.5 8h13v3h-13zM4.5 11v6h11v-6M10 8v9M10 8S8.5 3.5 6.5 4.5 8 8 10 8zm0 0s1.5-4.5 3.5-3.5S12 8 10 8z",
  ticket: "M3 6.5h14V9a1.5 1.5 0 0 0 0 3v2.5H3V12a1.5 1.5 0 0 0 0-3zM11.5 6.5v8",
  receipt: "M5 2.5h10v15l-2-1.3-1.7 1.3-1.6-1.3-1.7 1.3L6.3 16.2 5 17.5zM7.5 6.5h5M7.5 9.5h5M7.5 12.5h3",
  piggy: "M4 10.5c0-3 2.7-5 6-5 2.4 0 4.5 1 5.5 2.7l1.5-.2v3.5l-1.6.7a5.3 5.3 0 0 1-1.9 2V16h-2.5v-1.2a7.6 7.6 0 0 1-2.5 0V16H6v-1.7c-1.2-.9-2-2.2-2-3.8zM12.5 9h.01M8 7.5h3",
  dot: "M10 13.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"
};

export function iconSvg(icon, size){
  size = size || 18;
  return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + (PATHS[icon] || PATHS.dot) + '"/></svg>';
}

// The round badge on a row: the icon in the category's colour on a tint of it. Decorative — the
// category's name is always written beside it.
export function categoryIconHtml(name, opts){
  opts = opts || {};
  var look = categoryLook(name, state.categoryLooks);
  return '<span class="cat-icon cat-c-' + look.color + (opts.small ? " cat-icon-sm" : "") + '" aria-hidden="true"' + (name ? ' title="' + escapeAttr(name) + '"' : '') + '>' + iconSvg(look.icon, opts.small ? 14 : 18) + '</span>';
}
// The colour alone, for a chart segment or a legend swatch: a class that sets --cat.
export function categoryColorClass(name){
  return "cat-c-" + categoryLook(name, state.categoryLooks).color;
}
