# A public landing page — the plan

Status: **proposed** (November 2026). The owner decides the open questions at the end before anything is built; the
page is mocked up on the design canvas first, as every other change this month was.

## Why

The app has no front door. A first visit to the site with no saved household is sent to `onboarding.html` — written
for someone already deciding to try it, `noindex`, with no screenshots, no answers to "is it safe?" or "does it work
for us?", and nothing a search engine or a link preview can use. People who'd find the app useful (Australian
households, couples planning together, first home buyers, property investors) have no page that tells them what it
does before they're inside it.

## What the page has to do

1. **Say what it is in one line**, above the fold on a phone: a free planner for an Australian household's money —
   budget, tax, property and net worth in one place, kept in your browser.
2. **Show it** — real screens from the sample household, not illustrations.
3. **Answer the trust question first**: no account, no server, nothing leaves the browser unless you choose (sync
   encrypted with your passphrase, prices by ticker only, Ask Claude with your own key and a minimised summary).
4. **Get them in, two ways**: *Try it with sample data* and *Start with your own* — the same two doors
   `onboarding.html` has today — plus *Open a file someone shared* (`welcome.html`).
5. **Be found and shared**: indexable, a proper title and description, a 1200×630 link preview, a sitemap.

## Content, top to bottom

| Section | What it says | Notes |
| --- | --- | --- |
| **Hero** | The one line; a sub-line ("Budget, spending from your bank statements, Australian tax and super, property and a plan — no sign-up"); the two buttons; a phone screenshot of Today. | Both buttons inside the first 844px screen, as `onboarding.html` learned. |
| **Private by design** | Three short points: stays in your browser · no account · you choose what leaves. Link to how sync and backups work. | The page's most important promise; said plainly, no fine print. |
| **What it does** | Five tiles, one per place in the app — Today, Money, Accounts, Plan, Tax & reports — each a sentence and a screenshot. | Names match the app's menu exactly (one name per place). |
| **Made for Australia** | Income tax, Medicare and super worked out; returns in myTax's order; stamp duty and LMI by state; offsets, negative gearing, franking; the RBA cash rate. | Descriptive use of public names (myTax, RBA) only. |
| **Who it's for** | Three short stories with invented people: a couple sharing a budget; buying a first home (deposit, costs, settlement); an investment property (rent, costs, the rental schedule). | Invented throughout (decision 0004). |
| **Bring your data in** | Bank statements (CSV, PDF, OFX, QIF), payslips, broker trades, spreadsheets; rules learned as you go. No bank login, ever. | Sets the expectation: files, not bank feeds. |
| **How to start** | 1 Try the sample · 2 Start with your own (five-minute setup) · 3 Import a statement. | |
| **Questions** | Is it free? Where is my data? What if I clear my browser? Can two of us use it? Does it work offline / on a phone? Is this financial advice? Who makes it? | Each a short answer; `<details>` so the page stays short. |
| **Footer** | Open the app · the source on GitHub · request a feature · version · "General information only, not financial advice." | The general-advice line also sits under the hero's numbers. |

## Where it lives

**Recommended: a new static page at `about/` (`/wealth-planner/about/`), with the first visit sent there instead of
`onboarding.html`.** The app stays at the root, so every installed copy (`start_url: "."`), bookmark, deep link, the
share target and the service worker's scope keep working. A returning visitor (a saved household) goes straight to
the app as today; a new one lands on the page. `onboarding.html` becomes a redirect to `about/` for old links.

Considered and not recommended: making the root the landing page and moving the app to `/app/` — it breaks installed
apps, every saved link and the 404 deep-link route, for a nicer address a custom domain gives more cheaply later.

## How it's built

- **Static HTML and CSS, no build step** (decision 0001), no script needed to read it; a small inline script only
  for the first-visit check, its hash in the CSP (`npm run stamp -- --hashes`).
- **The app's design tokens**: the page links the base and token layers of `styles.css` (or a small `landing.css` in
  the same layers), so colours, type and dark mode match the app (decision 0010).
- **The same CSP and security baseline** (decision 0014); no third-party scripts, fonts as the app loads them.
- **No tracking by default.** If the owner wants numbers, a privacy-respecting, cookie-free counter — an owner's
  decision, and the CSP entry with it.
- **Screenshots generated, not hand-made**: a script (`scripts/landing-shots.mjs`) drives the sample household at a
  fixed date, phone and desktop, light and dark, and writes compressed images to `about/img/`. Re-run on a release
  so the page never shows an old app.
- **Findable**: title and description, canonical URL, Open Graph and Twitter cards with a 1200×630 image,
  `SoftwareApplication` structured data, `robots.txt` and `sitemap.xml` at the site root.
- **Fast**: under 200 KB before images on a phone, images lazy below the fold, a Lighthouse budget checked in CI.
- **Tested like the app**: in the smoke run's widths and themes, axe in the accessibility job, and a journey —
  landing → *Try it with sample data* → Today, and landing → *Start* → setup — with a time budget.

## Steps

| Step | What | Done when |
| --- | --- | --- |
| L1 | A decision record (where it lives, what it promises) and the copy, reviewed by the owner. | Decision 0017 merged. |
| L2 | Mock-ups on the canvas: phone and desktop, light and dark. | Owner agrees. |
| L3 | The sample household fit to be photographed (assessment B6), and the screenshot script. | Images in `about/img/` from a script. |
| L4 | Build `about/`: the page, its styles, the first-visit route, `onboarding.html` redirecting. | Smoke, axe and the journeys pass. |
| L5 | Findable: meta, preview image, structured data, `robots.txt`, `sitemap.xml`. | A link preview shows the card; the page is indexable. |
| L6 | A README for the repository pointing at the page, the privacy model and how to run it. | README merged. |
| L7 (later) | A custom domain, if the owner wants one: `CNAME`, the hard-coded origins in `og:url`/`og:image`, the manifest. | — |

## Open questions for the owner

1. **Name**: keep "Wealth Planner"? It's generic and hard to find in search; a distinctive name helps the page and a
   domain. (A name is also worth a trademark search before it's printed anywhere.)
2. **Address**: `…/about/` on GitHub Pages for now, or a custom domain from the start?
3. **Who makes it**: say it's one person's project (with a link to GitHub), or keep the maker out of it?
4. **Numbers**: no analytics (as now), or a cookie-free counter?
5. **Feedback**: is *Request a feature* (a GitHub issue) the channel, or an email?
6. **Tone**: the app's plain, direct voice — or a little warmer for strangers?
