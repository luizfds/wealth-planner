// Network-first, cache-as-you-go: every online visit refreshes the cache from the network,
// and anything already cached keeps working with no network at all (this app is 100%
// client-side/localStorage already — installing it should mean it also works offline).
// No fixed precache list to keep in sync with src/ — whatever the app actually requests gets
// cached the first time it's fetched successfully.
var CACHE_NAME = "wealth-planner-cache-v1";

self.addEventListener("install", function(event){
  self.skipWaiting();
});

self.addEventListener("activate", function(event){
  event.waitUntil(
    caches.keys().then(function(names){
      return Promise.all(names.filter(function(n){ return n !== CACHE_NAME; }).map(function(n){ return caches.delete(n); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

var SHELL_URL = new URL("index.html", self.registration.scope).href;

self.addEventListener("fetch", function(event){
  if(event.request.method !== "GET") return;
  var isNavigation = event.request.mode === "navigate";
  // fetch(event.request) alone still goes through the browser's own HTTP cache (a layer below
  // this one, governed by GitHub Pages' response headers) — so "network-first" could silently be
  // satisfied by a stale disk-cached response without this worker or the origin ever being asked,
  // which is how a shipped update can go quietly unseen even on a hard reload. Cloning with
  // cache:"no-store" forces an actual round-trip every time. (Request's mode can't be set to
  // "navigate" explicitly, so cloning a navigation request without overriding mode downgrades it
  // to "same-origin" — the standard, documented way to still add cache:"no-store" to a navigation
  // fetch inside a service worker; harmless here since this fetch never leaves the same origin.)
  var networkRequest = new Request(event.request, { cache: "no-store" });
  event.respondWith(
    fetch(networkRequest).then(function(response){
      // A same-origin stylesheet/font fetch (mode "no-cors") comes back as an opaque response —
      // status is always 0 and .ok is always false by spec, even on success, so .ok alone would
      // silently skip caching every CSS/font request. Still worth caching: we just can't inspect it.
      if(response && (response.ok || response.type === "opaque")){
        var copyForRequest = response.clone();
        // Client-side routing (nav.js pushState) means any *extensionless* path — /properties,
        // /assets/shares — is really just this same shell; a URL never actually fetched over the
        // network before (only pushState'd to) would otherwise be a guaranteed cache miss when
        // reloaded offline or when the OS relaunches the installed app to a remembered non-root
        // path. A real, separate .html file (welcome.html, 404.html) is not that — caching its
        // content under SHELL_URL would silently replace the actual app shell, breaking offline
        // navigation to every pushState'd route afterward.
        var isDistinctHtmlPage = /\.html$/i.test(new URL(event.request.url).pathname) && event.request.url !== SHELL_URL;
        var copyForShell = (isNavigation && !isDistinctHtmlPage) ? response.clone() : null;
        // Caching is a side effect of returning `response` below — without waitUntil(), the browser
        // is free to tear down this fetch event (and the still-pending cache write) the instant the
        // response is handed back, before cache.put() actually finishes.
        event.waitUntil(
          caches.open(CACHE_NAME).then(function(cache){
            var puts = [cache.put(event.request, copyForRequest)];
            if(copyForShell) puts.push(cache.put(SHELL_URL, copyForShell));
            return Promise.all(puts);
          })
        );
      }
      return response;
    }).catch(function(){
      return caches.match(event.request).then(function(cached){
        if(cached) return cached;
        if(isNavigation) return caches.match(SHELL_URL);
        return Promise.reject("offline and not cached");
      });
    })
  );
});
