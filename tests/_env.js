// Minimal browser-global stubs so src/state.js (and anything importing it) can be loaded under
// Node's test runner. state.js touches localStorage/window at module-load time to hydrate its
// singleton `state` — this repo has no DOM in tests, so we fake just enough for that to no-op
// cleanly and fall through to defaultState(). Import this file (for its side effect) before
// importing anything from src/state.js or src/calc/*.js.
if(typeof globalThis.localStorage === "undefined"){
  var store = {};
  globalThis.localStorage = {
    getItem: function(k){ return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem: function(k, v){ store[k] = String(v); },
    removeItem: function(k){ delete store[k]; }
  };
}
if(typeof globalThis.window === "undefined"){
  globalThis.window = { innerWidth: 1280 };
}
