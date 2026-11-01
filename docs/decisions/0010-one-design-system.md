# 0010 — One design system: tokens for type, numbers, buttons, cards and categories

**Decided:** v3.155–159; navigation v3.140; phone floors v3.167.

**Decision.**
- **Type:** every `font-size` is a `--fs-*` token from `base.css` (12 · 13 · 14 · 17 · 20 · 26 · 32px); weights 400 or 600.
- **Numbers:** every figure uses `var(--font-num)` with tabular figures — whole dollars in totals and summaries, cents
  only on single items. A figure read at a glance (a chart axis, a long-horizon card) is `fmtCompact`
  (`lib/format.js`), the exact one in its tooltip; there is no other compact formatter.
- **Colour for meaning:** text coloured up/down/warning uses `--good-ink` / `--bad-ink` / `--warn-ink` (4.5:1);
  `--good` / `--bad` are for fills, bars and dots. Light and dark are custom properties in `base.css`.
- **Buttons:** `.btn`, `.btn-primary`, `.btn-ghost`, `.btn-danger` (every delete), `.link-btn`, each with `.btn-sm`; a
  fold-out inside a card is `.tax-advanced` or `.row-more-options`.
- **Cards and charts:** a top-level card takes `--card-radius` and `--card-py`/`--card-px`, a card inside a card
  `--inner-radius`, its title `--fs-lg`. `renderLineChart` and `renderStackedAreaChart` share `wireChartTooltip`.
- **Categories:** colour (`.cat-c-0`…`11`) and icon from `calc/categorylook.js` (`state.categoryLooks[name]` or the
  name); a rename or delete carries or drops the look.
- **Navigation:** desktop sidebar; on a phone (≤880px) the page title is the header and a bottom bar of five tabs;
  both have the avatar menu. Every control at least 44px on a phone.
- **Parts:** a property and shares are *parts* (`calc/parts.js`); off adds `no-part-<key>` to `<body>`, hiding
  anything marked `data-part`. Something new about a property or shares gets a `data-part` or a `part`.
- **Home you arrange:** Home's cards carry `data-home-card`; `lib/homelayout.js` orders and hides them per device.

**Checked by:** `tests/typescale.test.js`, `tests/buttons.test.js`, `tests/cards.test.js`, the smoke run (44px at 390px,
an empty household with parts off).
