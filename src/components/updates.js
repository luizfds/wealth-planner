// ---------------- Update detection (v3.206.1, item 237) ----------------
//
// Noticing a new release and reloading into it, moved out of app.js as it was; app.js calls wireUpdates()
// where its listeners used to be added.
import { showToast, showPersistentToast } from "../lib/toast.js";
import { appAssetUrl } from "./nav.js";

var CURRENT_APP_VERSION, updateBannerShown;

function announceUpdateAvailable(newVersion){
  if(updateBannerShown) return;
  updateBannerShown = true;
  var msg = newVersion ? ("A new version (" + newVersion + ") is available") : "A new version is available";
  showPersistentToast(msg, "Reload", reloadForUpdate);
}
// Ask the worker to purge and re-prime, then reload. Reloading alone isn't enough: this check only
// reads index.html's version string, so a freshly-deployed shell alongside a still-cached
// src/*.js would reload into a new version number running old code.
//
// Delegated to sw.js rather than clearing CacheStorage from here, for two reasons: the cache name
// and shell URL live there, and a bare purge would delete the cached shell that is the only thing
// making a reload work on a pushState'd path (/expenses/budget) if the network hiccups on the way
// back. The worker does both halves together.
//
// Reloads regardless of the reply — a failed purge is a stale cache, which is where we already
// were, whereas not reloading at all leaves a banner that does nothing. The timeout covers the
// worker being absent, asleep or wedged.
function reloadForUpdate(){
  var reloaded = false;
  var reload = function(){
    if(reloaded) return;
    reloaded = true;
    window.location.reload();
  };
  if(!navigator.serviceWorker || !navigator.serviceWorker.controller || typeof MessageChannel === "undefined"){
    reload();
    return;
  }
  try{
    var channel = new MessageChannel();
    channel.port1.onmessage = reload;
    navigator.serviceWorker.controller.postMessage({ type: "purge-and-reprime" }, [channel.port2]);
    setTimeout(reload, 3000);
  }catch(e){
    reload();
  }
}
// Resolves to the deployed version string, or "" when the response didn't carry one.
function fetchDeployedVersion(){
  // appAssetUrl(), NOT a bare "index.html": a document-relative fetch resolves against whatever
  // route is in the address bar, and by the time this runs the app has already rewritten it. From
  // /expenses/spending that fetched /expenses/index.html and 404'd, so the update check silently
  // never worked on a two-segment route. See appAssetUrl()'s own comment in nav.js.
  //
  // cache:"no-store" stops the *browser* answering from its own cache, but it says nothing about
  // what an intermediary does, and this app is served through a CDN. A URL nothing has requested
  // before can't be answered from an edge cache, so the timestamp is what makes the answer
  // trustworthy rather than possibly-minutes-stale — which matters most in exactly the case that
  // looks like a bug: a check that quietly concludes "no update" and then waits for the next one.
  return fetch(appAssetUrl("index.html") + "?v=" + Date.now(), { cache: "no-store" })
    .then(function(r){ return r.text(); })
    .then(function(html){
      var match = html.match(/<span class="app-version-num">([^<]*)<\/span>/);
      return match ? match[1].trim() : "";
    });
}
function checkForNewVersion(){
  fetchDeployedVersion().then(function(latest){
    if(latest && CURRENT_APP_VERSION && latest !== CURRENT_APP_VERSION) announceUpdateAvailable(latest);
  }).catch(function(){ /* offline, or the request was blocked — next check will just retry */ });
}
// The same check, asked for deliberately — so it answers either way. A background check that finds
// nothing is silent by design; a person who just tapped "Check for updates" and got silence has no
// way to tell that from a broken button.
export function runManualUpdateCheck(){
  showToast("Checking for updates…");
  // Ask the browser to re-fetch sw.js at the same time. It normally only does this on navigation,
  // which an installed PWA left open for days may not have done in a while.
  if(navigator.serviceWorker && navigator.serviceWorker.getRegistration){
    navigator.serviceWorker.getRegistration()
      .then(function(reg){ if(reg && reg.update) reg.update(); })
      .catch(function(){});
  }
  fetchDeployedVersion().then(function(latest){
    if(!latest){
      showToast("Couldn't read the deployed version — try again in a minute.");
      return;
    }
    if(latest !== CURRENT_APP_VERSION){
      // Deliberately re-armed: a manual check is an explicit request to be told, even if a banner
      // for this same version was already dismissed earlier in the session.
      updateBannerShown = false;
      announceUpdateAvailable(latest);
      return;
    }
    showToast("You're on the latest version (" + CURRENT_APP_VERSION + ")");
  }).catch(function(){
    showToast("Couldn't check for updates — you may be offline.");
  });
}

export function wireUpdates(){
  // ---------------- Update detection ----------------
  // sw.js's own script rarely changes between releases (this app has no fixed precache list, so
  // most version bumps only touch app.js/CSS/index.html) — the browser's built-in service-worker
  // update check only re-installs a worker when sw.js's own bytes differ, so relying on that alone
  // would miss the common case entirely. Polling index.html's own <p class="app-version"> instead
  // catches every release, regardless of what changed.
  CURRENT_APP_VERSION = (function(){
    var el = document.querySelector(".app-version-num");
    return el ? el.textContent.trim() : "";
  })();
  updateBannerShown = false;
  // Cheap enough to run whenever the tab regains focus (the common "came back after a while" case)
  // plus a periodic fallback for a tab that's simply left open and never loses focus. focus is
  // listened for alongside visibilitychange because they don't fire in the same situations: moving
  // between windows on a desktop fires focus without ever hiding the document.
  document.addEventListener("visibilitychange", function(){
    if(document.visibilityState === "visible") checkForNewVersion();
  });
  window.addEventListener("focus", checkForNewVersion);
  setInterval(checkForNewVersion, 15 * 60 * 1000);

  // appAssetUrl(), NOT a bare "sw.js" — same trap as the version fetch above, and it cost more here:
  // a bare "sw.js" resolved against the restored route, so on a fresh load of /expenses/spending or
  // /assets/shares (a shared link, a bookmark, or a plain reload) registration 404'd and the service
  // worker never installed. Offline support was silently absent for anyone who didn't land on the
  // bare root. The resulting scope is "/" locally and "/wealth-planner/" on Pages — the whole app
  // either way, which is what sw.js's own new URL("index.html", registration.scope) assumes.
  if("serviceWorker" in navigator){
    var hadControllerAtLoad = !!navigator.serviceWorker.controller;
    window.addEventListener("load", function(){
      navigator.serviceWorker.register(appAssetUrl("sw.js")).catch(function(){});
    });
    // Fires when this page starts being controlled by a different worker than the one that had it
    // at load — the fast path for the (comparatively rare) release that touches sw.js itself.
    // Skipped on the very first-ever activation (no prior controller): that's a first-time visitor
    // gaining offline support, not an update.
    navigator.serviceWorker.addEventListener("controllerchange", function(){
      if(!hadControllerAtLoad) return;
      announceUpdateAvailable();
    });
  }
}
