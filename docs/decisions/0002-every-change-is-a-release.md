# 0002 — Every shipped change is a release, versioned by the workflow

**Decided:** releases by hand from the start; automated in v3.202 (item 233).

**Context.** The app caches itself (0001) and tells people a new version is out by comparing the version in
`index.html`. A change that ships without a new version is a change some browsers never load.

**Decision.** Every merge to main that changes what ships is a release. `.github/workflows/release.yml` runs
`scripts/release.mjs`, which picks the bump from the PR's label — `release: minor` (a feature or behaviour change),
`release: patch` (a fix, or a refactor with no visible change), `release: none` (nothing ships) — or, unlabelled, from
what changed (nothing under `src/`, `index.html`, `styles.css`, `sw.js`, `vendor/`, `icons/` → none; every commit
titled "Fix …" → patch; otherwise minor). It bumps `<span class="app-version-num">`, stamps, tests, commits
`Bump version to vX.Y.Z — <PR title>` and tags it.

**Consequences.** Never bump the version by hand. One PR per coherent piece of work, always opened for finished work,
always labelled. A version mentioned in a code comment or doc is the one the release will get — check the last tag
before writing it.

**Checked by:** `tests/release.test.js`; the workflow itself.
