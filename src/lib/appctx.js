// ---------------- What the page modules reach in app.js (v3.206.1, item 237a) ----------------
//
// app.js's event wiring is moving into one module per page. What they share and app.js still holds — the
// full redraw, the dispatch-by-section helpers (rerenderTableFor, getArrayForSection…), the overlay stack —
// they reach through `app`, filled in by app.js as it starts (registerApp, before any listener can fire), so
// no page module imports app.js (the entry point) and nothing is called before it's there.
export var app = {};
export function registerApp(fns){ Object.keys(fns).forEach(function(k){ app[k] = fns[k]; }); }
// A variable of app.js's, read and written through app.<name>.
export function defineVar(name, get, set){ Object.defineProperty(app, name, { get: get, set: set, enumerable: true, configurable: true }); }
