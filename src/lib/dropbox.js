// ---------------- Dropbox (v3.136.0) — item 163, the second way ----------------
//
// Sync through Dropbox, for any device with a browser — phones included, which can't keep a folder.
// The app has no server, so it signs in the way Dropbox allows a browser-only app to: OAuth with PKCE
// (no client secret), and access to its own app folder (Apps/<app name>/) and nothing else in the
// person's Dropbox. The sync file is the same encrypted file as the folder way (lib/foldersync.js
// encrypts before anything gets here) — Dropbox only ever stores ciphertext.
//
// The app key isn't a secret (it's in every browser that uses it). DROPBOX_APP_KEY is the one this
// site is registered with; until it's set, Settings lets you paste your own key from the Dropbox App
// Console, kept on this device. This device's tokens are kept in localStorage: an access token that
// lasts hours and a refresh token, both only usable with this app's key, revoked on Disconnect.
export var DROPBOX_APP_KEY = "";
var KEY_LS = "wealthPlanner.dropboxKey", TOKENS_LS = "wealthPlanner.dropbox", PKCE_SS = "wealthPlanner.dropboxPkce";
var PATH = "/wealth-planner-sync.json";

export function appKey(){ try { return DROPBOX_APP_KEY || localStorage.getItem(KEY_LS) || ""; } catch(e){ return DROPBOX_APP_KEY; } }
export function setAppKey(k){ try { if(k) localStorage.setItem(KEY_LS, String(k).trim()); else localStorage.removeItem(KEY_LS); } catch(e){} }
export function keyIsBuiltIn(){ return !!DROPBOX_APP_KEY; }
function tokens(){ try { return JSON.parse(localStorage.getItem(TOKENS_LS) || "null"); } catch(e){ return null; } }
function setTokens(t){ try { if(t) localStorage.setItem(TOKENS_LS, JSON.stringify(t)); else localStorage.removeItem(TOKENS_LS); } catch(e){} }
export function dropboxConnected(){ var t = tokens(); return !!(t && (t.refresh || t.access)); }

// Where Dropbox sends the browser back to: the app's own root, which has to be one of the redirect
// URIs registered for the key.
export function redirectUri(){
  if(typeof location === "undefined") return "https://<your site>/";
  return location.origin + (location.hostname.indexOf("github.io") !== -1 ? "/wealth-planner/" : "/");
}

function b64url(bytes){ var s = ""; bytes.forEach(function(b){ s += String.fromCharCode(b); }); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
export function pkcePair(){
  var verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)).then(function(h){ return { verifier: verifier, challenge: b64url(new Uint8Array(h)) }; });
}
export function authorizeUrl(key, challenge, state, redirect){
  return "https://www.dropbox.com/oauth2/authorize?client_id=" + encodeURIComponent(key) + "&response_type=code&code_challenge=" + challenge +
    "&code_challenge_method=S256&token_access_type=offline&redirect_uri=" + encodeURIComponent(redirect) + "&state=" + encodeURIComponent(state);
}

// Sends the browser to Dropbox to approve access.
export function connectDropbox(){
  var key = appKey();
  if(!key) return Promise.reject(new Error("no-key"));
  return pkcePair().then(function(p){
    var st = b64url(crypto.getRandomValues(new Uint8Array(16)));
    sessionStorage.setItem(PKCE_SS, JSON.stringify({ verifier: p.verifier, state: st, back: location.pathname }));
    location.assign(authorizeUrl(key, p.challenge, st, redirectUri()));
  });
}

function form(obj){ return Object.keys(obj).map(function(k){ return encodeURIComponent(k) + "=" + encodeURIComponent(obj[k]); }).join("&"); }
function tokenRequest(body){
  return fetch("https://api.dropboxapi.com/oauth2/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form(body) })
    .then(function(r){ return r.json().then(function(j){ if(!r.ok) throw new Error(j.error_description || j.error || "HTTP " + r.status); return j; }); });
}
// On load: back from Dropbox with ?code=…&state=…. Resolves { connected } or null when this load
// isn't a return from Dropbox. Cleans the address bar either way.
export function finishDropboxRedirect(){
  var q = new URLSearchParams(location.search);
  if(!q.get("state") || !(q.get("code") || q.get("error"))) return Promise.resolve(null);
  var saved = null;
  try { saved = JSON.parse(sessionStorage.getItem(PKCE_SS) || "null"); } catch(e){}
  sessionStorage.removeItem(PKCE_SS);
  var clean = function(){ history.replaceState(history.state, "", (saved && saved.back) || location.pathname); };
  if(!saved || saved.state !== q.get("state")){ clean(); return Promise.resolve(saved ? { connected: false, reason: "state" } : null); }
  if(q.get("error")){ clean(); return Promise.resolve({ connected: false, reason: q.get("error") }); }
  return tokenRequest({ code: q.get("code"), grant_type: "authorization_code", client_id: appKey(), redirect_uri: redirectUri(), code_verifier: saved.verifier })
    .then(function(j){
      setTokens({ access: j.access_token, refresh: j.refresh_token || null, expiresAt: Date.now() + ((Number(j.expires_in) || 14400) - 120) * 1000, account: j.account_id || "" });
      clean();
      return { connected: true };
    }, function(e){ clean(); return { connected: false, reason: e.message }; });
}
function accessToken(){
  var t = tokens();
  if(!t) return Promise.reject(new Error("not-connected"));
  if(t.access && t.expiresAt > Date.now()) return Promise.resolve(t.access);
  if(!t.refresh) return Promise.reject(new Error("not-connected"));
  return tokenRequest({ grant_type: "refresh_token", refresh_token: t.refresh, client_id: appKey() }).then(function(j){
    setTokens(Object.assign(t, { access: j.access_token, expiresAt: Date.now() + ((Number(j.expires_in) || 14400) - 120) * 1000 }));
    return j.access_token;
  }, function(e){ if(/invalid_grant|expired|revoked/i.test(e.message)) setTokens(null); throw new Error("not-connected"); });
}

// The sync file: { text, rev } or null when there isn't one yet. `rev` is Dropbox's own revision,
// handed back to write() so a write only lands on the copy that was read.
export function readDropbox(){
  return accessToken().then(function(tok){
    return fetch("https://content.dropboxapi.com/2/files/download", { method: "POST", headers: { Authorization: "Bearer " + tok, "Dropbox-API-Arg": JSON.stringify({ path: PATH }) } });
  }).then(function(r){
    if(r.status === 409) return null; // path/not_found
    if(r.status === 401){ setTokens(null); throw new Error("not-connected"); }
    if(!r.ok) throw new Error("HTTP " + r.status);
    var meta = {}; try { meta = JSON.parse(r.headers.get("Dropbox-API-Result") || "{}"); } catch(e){}
    return r.text().then(function(text){ return { text: text, rev: meta.rev || null }; });
  });
}
// Writes the sync file. With `rev`, only over that revision — if someone else wrote in between,
// rejects with "conflict" and the caller reads again.
export function writeDropbox(text, rev){
  return accessToken().then(function(tok){
    var mode = rev ? { ".tag": "update", update: rev } : { ".tag": "add" };
    return fetch("https://content.dropboxapi.com/2/files/upload", { method: "POST", headers: { Authorization: "Bearer " + tok, "Content-Type": "application/octet-stream",
      "Dropbox-API-Arg": JSON.stringify({ path: PATH, mode: mode, autorename: false, mute: true }) }, body: text });
  }).then(function(r){
    if(r.status === 409) throw new Error("conflict");
    if(r.status === 401){ setTokens(null); throw new Error("not-connected"); }
    if(!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  });
}
export function disconnectDropbox(){
  var t = tokens();
  setTokens(null);
  if(!t || !t.access) return Promise.resolve();
  return fetch("https://api.dropboxapi.com/2/auth/token/revoke", { method: "POST", headers: { Authorization: "Bearer " + t.access } }).catch(function(){});
}
