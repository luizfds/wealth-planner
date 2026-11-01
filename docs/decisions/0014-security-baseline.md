# 0014 — A Content-Security-Policy, escaped text and a local error log

**Decided:** v3.202 (item 233).

**Decision.** `index.html` carries a Content-Security-Policy: scripts from this site and inline scripts only by hash
(`npm run stamp` keeps them current), network only to this site and the services the app names. Text a person typed or
a file brought in goes into HTML through `escapeAttr()`. Uncaught errors are kept on the device (`lib/errorlog.js`,
imported first) and listed in Settings → Keeping your data safe.

**Consequences.** A new third-party host goes in the CSP's `connect-src` (or the right directive), or the browser
blocks it. `npm run check`'s `local/no-unescaped-text` flags a row field (`.what`, `.description`, `.name`…) joined into
markup raw.
