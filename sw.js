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
  event.respondWith(
    fetch(event.request).then(function(response){
      // A same-origin stylesheet/font fetch (mode "no-cors") comes back as an opaque response —
      // status is always 0 and .ok is always false by spec, even on success, so .ok alone would
      // silently skip caching every CSS/font request. Still worth caching: we just can't inspect it.
      if(response && (response.ok || response.type === "opaque")){
        var copyForRequest = response.clone();
        var copyForShell = isNavigation ? response.clone() : null;
        // Caching is a side effect of returning `response` below — without waitUntil(), the browser
        // is free to tear down this fetch event (and the still-pending cache write) the instant the
        // response is handed back, before cache.put() actually finishes.
        event.waitUntil(
          caches.open(CACHE_NAME).then(function(cache){
            var puts = [cache.put(event.request, copyForRequest)];
            // Client-side routing (nav.js pushState) means any path — /properties, /assets/shares —
            // is really just this same shell; a URL never actually fetched over the network before
            // (only pushState'd to) would otherwise be a guaranteed cache miss when reloaded offline
            // or when the OS relaunches the installed app to a remembered non-root path.
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
