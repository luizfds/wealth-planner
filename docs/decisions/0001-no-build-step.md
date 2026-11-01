# 0001 — No build step: plain ES modules, served as they are

**Decided:** v1.33 onwards; completed when the last of the monolith left `app.js` (v3.206, item 237).

**Context.** A personal tool, deployed to GitHub Pages and edited mostly in short sessions. A bundler, a transpiler and
a lockfile full of them would be the largest moving part, and the one most likely to be broken when someone comes back
to it months later.

**Decision.** `index.html` + `styles.css` + native ES modules under `src/`, exactly as written. No bundler, no framework,
no runtime dependencies. The dev dependencies are checks only (ESLint, TypeScript's checker over JSDoc, stylelint).
pdf.js is vendored (`vendor/pdfjs/`) rather than loaded from a CDN, so PDF import works offline and depends on no host.

**Consequences.**
- The app must be served over HTTP (`python3 -m http.server`); `file://` can't load modules.
- Cache-busting is done by `npm run stamp`: an import map in `index.html` maps every module to `?v=<version>`
  (one module instance, no stale mix after a release), modulepreload links avoid a waterfall, and the CSP's script
  hashes are recomputed. A new module or inline script needs a stamp; `tests/stamp.test.js` fails otherwise.
- The PWA (`manifest.webmanifest`, `sw.js`) is network-first with cache-as-you-go: no precache list to maintain.
  `start_url`/`scope` are `"."` so the same files work at `/` locally and under `/wealth-planner/` on Pages.
  Two `sw.js` traps cost real time: a cache write after `respondWith` needs `event.waitUntil()`, and a same-origin
  `no-cors` fetch (stylesheets, fonts) is opaque with `.ok === false` even when it worked — cache on
  `response.ok || response.type === "opaque"`.
- Anything that needs jsdom or a bundler to be testable is the wrong fix (see 0013).
