# 0015 — The release stamps the import map; a pull request doesn't

**Decided:** after slice 4 of #390, when merging main into an open PR had become routine. Changes part of 0001.

**Context.** `npm run stamp` writes an import map into `index.html` with one line per module, each ending
`?v=<version>`, a modulepreload for each, and the CSP's hash of the map (0001). The Release workflow stamps after every
merge (0002), so a release rewrites every one of those lines. A PR that added a module also ran the stamp, adding its
lines among them. Git can't merge two changes to neighbouring lines, so every open PR that added a module conflicted
with the next release, however unrelated the two were.

**Decision.** Only the release writes the import map. A PR that adds a module or stylesheet leaves `index.html` and
`styles.css` alone: the new file loads by its plain URL (one module instance, as before; just not cache-busted or
preloaded) until the release, minutes after the merge, stamps it. A `release: none` merge that adds one is stamped by
the same workflow without a new version (`Stamp modules — <PR title>`). A PR that adds or changes an inline
`<script>` still has to update the CSP, or the browser blocks it: `npm run stamp -- --hashes` rewrites only that
line.

**Consequences.** Don't run a full `npm run stamp` in a PR. A PR still conflicts with a release if it changes the
CSP line or deletes a module (its map line goes), which is rare.

**Checked by:** `tests/stamp.test.js` (`stampProblems`): an inline script the CSP doesn't allow, a mapped or preloaded
module that doesn't exist, and a URL carrying another version fail it; a module not yet in the map doesn't. The
release's own `npm test` runs it on the stamped page.
