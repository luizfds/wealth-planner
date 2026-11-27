# Wealth Planner’s landing page

The [approved defaults](../decisions/0017-public-landing-page.md) keep the Wealth Planner name, GitHub Pages address and independent maker credit. The page introduces a free Australian household planner and lets visitors see the actual app before starting.

## Structure

- The hero keeps both ways into the app on the first phone screen, with a third link for a shared backup.
- The privacy explanation covers local data, backups, encrypted sync, market prices and Ask Claude.
- The Today screenshot and four more examples show Money, Accounts, Plan and Tax, with a short explanation for each.
- The FAQ covers getting started, two people, offline and phone use, and general financial information.
- The footer links to the GitHub repository and feedback. The avatar menu takes app users to the same feedback section.

## Routes and assets

The app stays at the repository root. A first visit without an existing household or app history redirects to `about/`. A saved household, app link, bookmark or bank-app share continues into the app. `onboarding.html` redirects to the landing page. The service worker keeps landing-page navigations separate from the app shell used for offline deep links.

The landing page uses static HTML and CSS with a small, same-origin script. Content, sample and setup links are available without the landing script. Screenshots use the app’s invented sample household and alternate with the reader’s light or dark setting. To refresh them, run `SHOTS_ONLY=today,money,accounts,plan,tax node scripts/landing-shots.mjs /tmp/wealth-planner-shots`, convert the Today phone and other desktop screenshots to WebP, and replace the matching images in `about/img/`. Refresh `about/img/share.jpg` if the Today screenshot or hero copy changes. The share image is 1200×630.

## Deployment settings

GitHub Pages serves `about/index.html` directly. Its two optional public settings are attributes on the opening `<html>` element.

- **`data-goatcounter-site`** takes the site code from an owner-managed `<code>.goatcounter.com` dashboard. Enable the tracking pixel for that site in GoatCounter. The page counts visits only on the published GitHub Pages origin, using a fixed path with no cookies, query, referrer or household data. It honours browser Do Not Track and Global Privacy Control signals. A blank setting sends no request and hides the disclosure.
- **`data-feedback-form`** takes a published `https://tally.so/r/…` URL. Set up two short prompts (“What were you trying to do?” and “What got in the way?”), with an optional email for a reply. Add the reminder about leaving out statements and financial details to the form itself. The app fetches nothing from Tally. A visitor opens the form in their browser by following the link. GitHub Issues stays available when the URL is blank.

The repository’s sitemap names the public canonical landing page. GitHub Pages serves the repository’s `robots.txt` under `/wealth-planner/`. Crawlers use the host’s root robots file for host-wide rules.

## Verification

Smoke checks read the landing page at the existing phone, tablet and desktop widths in both themes. The journey covers a new root visit, the old onboarding link, shared-file welcome, sample data, a returning household, offline deep links and a fresh setup. Axe scans the landing page and its expanded details.
