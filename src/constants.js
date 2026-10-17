export var STORAGE_KEY = "wealthPlanner.v1";

export var FREQS = ["Weekly","Fortnightly","Monthly","Quarterly","Half-yearly","Yearly"];

// Starter spending categories, seeded once into state.categories for a fresh save and fully
// user-editable from there (Accounts → Categories). Deliberately coarse: a category earns its
// place by rolling *several* budget lines into one number — "Car" covering rego, insurance,
// fuel and servicing tells you something the individual lines can't. One category per line
// would just restate the line's own name, so the default set is about a dozen buckets rather
// than an exhaustive taxonomy.
export var DEFAULT_CATEGORIES = [
  "Housing", "Investment property", "Utilities", "Groceries", "Transport", "Car", "Health",
  "Insurance", "Education", "Childcare", "Subscriptions", "Eating out", "Shopping", "Personal",
  "Other"
];
// The default every investment-property cost is seeded onto (migrateState, one-shot). Named as a
// constant because both the seeding and the Budget tab's "these came from the Properties tab"
// grouping have to agree on the exact string — a category is matched by name, not by id.
export var IP_CATEGORY = "Investment property";
// What an uncategorised line is called wherever categories are grouped or charted. Not a real
// entry in state.categories — it's the absence of one, named so charts and rollups have
// something honest to label the remainder with.
export var UNCATEGORISED = "Uncategorised";
// Used by the "due month" field on any less-than-monthly item (calc/ledger.js's resolvedDueMonth) and the
// 12-month cash flow forecast (calc/cashflow.js) — index 0 = January, matching Date#getMonth().
export var MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
export var CLASSES = ["Needs","Wants","Savings","N/A"];
export var INCOME_TYPES = ["Net", "Gross"];
export var SUPER_MODES = ["On top", "Included", "N/A"];
export var SACRIFICE_MODES = ["Cash out", "Sacrifice %", "Sacrifice $"];
export function sacrificeModeToLabel(mode){ return mode === "percent" ? "Sacrifice %" : mode === "amount" ? "Sacrifice $" : "Cash out"; }
export function sacrificeLabelToMode(label){ return label === "Sacrifice %" ? "percent" : label === "Sacrifice $" ? "amount" : "none"; }

export var ASSET_CATEGORIES = ["Cash", "Shares", "Super", "Vehicle", "Other"];
export var LIQUID_CATEGORIES = ["Cash", "Shares"];
export var SHARE_MARKETS = ["ASX", "US", "Crypto"];
// What currency a Shares holding's price is actually quoted in, by market — every other figure
// in this app is implicitly AUD, but a US or Crypto holding's price/value is not, and nothing
// said so until now. Crypto is USD to match the GOOGLEFINANCE "SYMBOLUSD" pairing already used
// elsewhere (backup.js's price-template export, the "Paste prices" hint text).
export var MARKET_CURRENCY = { ASX: "AUD", US: "USD", Crypto: "USD" };
export var PURCHASE_STATE_CODES = ["NSW", "VIC", "Other"];

// Long-run compound annual growth in established house prices, 1980-2022 (Landmark
// Valuations analysis of ABS/state-government median price series). These are historical
// averages for context, not a forecast — past growth doesn't predict future growth, which
// is why this is only ever a suggested starting point the user can override per scenario.
export var STATE_GROWTH_RATES = { NSW: 6.8, VIC: 7.2, Other: 6.4 };

export var HOME_CATEGORIES = ["Rent / Home Loan", "Home Insurance", "Council Rates", "Water & Wastewater", "Property Maintenance"];

// A scenario's alternative to buying a property: put the money into one of these instead.
// defaultGrowthRate is just a starting-point suggestion (prefilled the same way
// STATE_GROWTH_RATES prefills the purchase calculator) — not a forecast, fully editable.
export var INVEST_LEG_TYPES = [
  { key: "Shares", label: "Shares / ETFs", defaultGrowthRate: 8 },
  { key: "Crypto", label: "Crypto", defaultGrowthRate: 12 },
  { key: "Other", label: "Other investment", defaultGrowthRate: 6 }
];

// ATO Maximum Super Contribution Base — the annual ordinary-time-earnings ceiling above which
// employer SG isn't compulsory. A single annual figure under the "Payday Super" reform effective
// 1 July 2026; indexed each financial year, so revisit this each July.
export var MAX_SUPER_BASE = 270830;

export var INCOME_COL_DEFS = [
  { key: "person", label: "Person" },
  { key: "type", label: "Type" },
  { key: "super", label: "Super" },
  { key: "sacrifice", label: "Cash / Sacrifice" },
  { key: "account", label: "Account" }
];

// Australian resident individual tax brackets (2024-25, stage-3 rates). Estimates —
// thresholds are indexed / change with policy; confirm with your accountant or the ATO.
export var AU_TAX_BRACKETS = [
  { from: 0, to: 18200, base: 0, rate: 0 },
  { from: 18200, to: 45000, base: 0, rate: 0.16 },
  { from: 45000, to: 135000, base: 4288, rate: 0.30 },
  { from: 135000, to: 190000, base: 31288, rate: 0.37 },
  { from: 190000, to: Infinity, base: 51638, rate: 0.45 }
];

// Compulsory HELP/HECS repayment rates, 2024-25 — same status as AU_TAX_BRACKETS above: an
// estimate, indexed every year, confirm against the ATO.
//
// Note the shape. Unlike income tax, this is NOT marginal: the rate that applies is a flat
// percentage of your WHOLE repayment income, not of the slice above each threshold. Crossing a
// threshold therefore costs real money — a dollar more income can cost tens of dollars of
// repayment — which is why the panel shows the next threshold rather than only the current rate.
//
// (The ATO has flagged moving to a marginal system; if that lands, this table's shape changes, not
// just its numbers. helpRepaymentAnnual() is the single place that reads it.)
export var HELP_REPAYMENT_RATES = [
  { from: 0, rate: 0 },
  { from: 54435, rate: 0.01 },
  { from: 62851, rate: 0.02 },
  { from: 66621, rate: 0.025 },
  { from: 70619, rate: 0.03 },
  { from: 74856, rate: 0.035 },
  { from: 79347, rate: 0.04 },
  { from: 84108, rate: 0.045 },
  { from: 89155, rate: 0.05 },
  { from: 94504, rate: 0.055 },
  { from: 100175, rate: 0.06 },
  { from: 106186, rate: 0.065 },
  { from: 112557, rate: 0.07 },
  { from: 119310, rate: 0.075 },
  { from: 126468, rate: 0.08 },
  { from: 134057, rate: 0.085 },
  { from: 142101, rate: 0.09 },
  { from: 150627, rate: 0.095 },
  { from: 159664, rate: 0.10 }
];

// Medicare levy surcharge, 2024-25 singles thresholds — an extra levy on people WITHOUT private
// hospital cover once income for surcharge purposes crosses the first tier. Same status as every
// other table here: indexed annually, confirm against the ATO.
//
// Like HELP and unlike income tax, this is a flat rate on the WHOLE income, not marginal. Families
// (and singles with dependants) get roughly doubled thresholds, +$1,500 per child after the first —
// modelled as a household toggle rather than by asking for a dependants count, since the app has no
// concept of children and a families/singles switch covers the decision people actually face.
export var MLS_TIERS = [
  { from: 0, rate: 0, label: "Base tier" },
  { from: 97000, rate: 0.01, label: "Tier 1" },
  { from: 113000, rate: 0.0125, label: "Tier 2" },
  { from: 151000, rate: 0.015, label: "Tier 3" }
];
// The family thresholds are the singles ones doubled, which is how the ATO sets them.
export var MLS_FAMILY_MULTIPLIER = 2;

// Standard general (non-concession) transfer-duty marginal brackets.
// Estimates only: state revenue offices update these periodically — confirm before settlement.
export var STAMP_DUTY_BRACKETS = {
  NSW: [
    {from:0, to:17000, base:0, rate:0.0125},
    {from:17000, to:36000, base:212, rate:0.015},
    {from:36000, to:97000, base:497, rate:0.0175},
    {from:97000, to:364000, base:1564, rate:0.035},
    {from:364000, to:1212000, base:10909, rate:0.045},
    {from:1212000, to:Infinity, base:48079, rate:0.055}
  ],
  VIC: [
    {from:0, to:25000, base:0, rate:0.014},
    {from:25000, to:130000, base:350, rate:0.024},
    {from:130000, to:960000, base:2870, rate:0.06}
    // 960k-2m and 2m+ handled as special cases below (VIC duty isn't purely marginal up there)
  ]
};
export var FHB_RULES = {
  NSW: {exemptUpTo:800000, concessionUpTo:1000000},
  VIC: {exemptUpTo:600000, concessionUpTo:750000}
};

// Flat statutory land-registry fees for lodging the Transfer and Mortgage — not value-based,
// unlike stamp duty above, but still indexed annually by each state's land registry. Same
// NSW/VIC-precise, "Other" is a generic estimate scope as STAMP_DUTY_BRACKETS — confirm current
// figures with the relevant land registry before settlement.
export var TRANSFER_FEE_BY_STATE = { NSW: 154, VIC: 118.30, Other: 154 };
export var MORTGAGE_REG_FEE_BY_STATE = { NSW: 154, VIC: 118.30, Other: 154 };

// Indicative single-premium LMI as a % of the loan amount. Real premiums are
// lender/insurer-specific (Helia, QBE, etc.) and vary by loan size and risk fee — estimate only.
export var LMI_BANDS = [
  {upTo:0.80, rate:0},
  {upTo:0.85, rate:0.006},
  {upTo:0.90, rate:0.013},
  {upTo:0.95, rate:0.028},
  {upTo:1.01, rate:0.045}
];

export var PERIODS = [
  {key:"weekly", label:"Weekly", hidden:true},
  {key:"fortnightly", label:"Fortnightly", hidden:true},
  {key:"monthly", label:"Monthly", hidden:false},
  {key:"quarterly", label:"Quarterly", hidden:true},
  {key:"yearly", label:"Yearly", hidden:false}
];

// ---------------- Land tax ----------------
// Land tax is the one recurring property cost this app can't treat as a flat bill you type in,
// which is why it gets a table rather than a row. Four things make it different from rates or
// strata:
//   1. it's charged on **land value**, not the property's market value;
//   2. it's assessed on your **aggregated** holdings per state, not per property — two $700k
//      blocks in the same state are one $1.4m assessment, which can cost far more than twice one;
//   3. there's a **tax-free threshold**, so most single holdings pay nothing at all;
//   4. your **principal home is exempt** in all three states, so it only ever bites investments.
// A flat typed-in figure gets all four wrong, and gets worse every year of a projection as land
// value grows while the figure doesn't.
//
// **These rates are as at the 2025 land tax year and WILL go stale.** They are the same kind of
// annually-revised figure as STAMP_DUTY_BRACKETS above — verify against Revenue NSW, the Victorian
// SRO or the Queensland Revenue Office before relying on a number for a real decision. Each
// bracket is {from, base, rate}: tax = base + rate x (landValue - from), applied to the bracket
// the aggregated value falls in. `from` doubles as the tax-free threshold on the first bracket.
//
// Deliberately the *general* rates for an individual resident owner. Absentee/foreign surcharges,
// trusts, companies, and the NSW premium-vs-general distinction for special trusts are all out of
// scope — modelling them would need an ownership-structure field this app doesn't have, and
// getting them subtly wrong is worse than plainly not offering them.
export var LAND_TAX_YEAR = 2025;
export var LAND_TAX_BRACKETS = {
  // Revenue NSW: $100 + 1.6% above the general threshold, then a premium rate above $6,571,000.
  // Thresholds were frozen at their 2024 values from the 2025 land tax year onward.
  NSW: [
    {from: 0, base: 0, rate: 0},
    {from: 1075000, base: 100, rate: 0.016},
    {from: 6571000, base: 88036, rate: 0.02}
  ],
  // Victorian SRO general rates. The threshold dropped to $50,000 from 1 Jan 2024 and the bottom
  // brackets are flat dollar amounts (not marginal), which is why their `rate` is 0.
  VIC: [
    {from: 0, base: 0, rate: 0},
    {from: 50000, base: 500, rate: 0},
    {from: 100000, base: 975, rate: 0},
    {from: 300000, base: 1350, rate: 0.003},
    {from: 600000, base: 2250, rate: 0.006},
    {from: 1000000, base: 4650, rate: 0.009},
    {from: 1800000, base: 11850, rate: 0.0165},
    {from: 3000000, base: 31650, rate: 0.0265}
  ],
  // Queensland Revenue Office, individuals (companies and trusts use a lower $350,000 threshold
  // and a different scale — out of scope, see above).
  QLD: [
    {from: 0, base: 0, rate: 0},
    {from: 600000, base: 500, rate: 0.01},
    {from: 1000000, base: 4500, rate: 0.0165},
    {from: 3000000, base: 37500, rate: 0.0125},
    {from: 5000000, base: 62500, rate: 0.0175},
    {from: 10000000, base: 150000, rate: 0.0225}
  ]
};
// The states this app can actually compute land tax for. Anything else is "Other", which is
// honest about not knowing rather than quietly using someone else's scale.
export var LAND_TAX_STATES = ["NSW", "VIC", "QLD"];

// Deduction labels on the individual tax return / myTax (v3.24.0). A deductible budget line carries
// one, so the year's claims can be totalled the way the return asks for them. D5 is the default
// because it's where most things an employee buys for work land.
export var DEDUCTION_LABELS = [
  { code: "D1", label: "D1 Car expenses" },
  { code: "D2", label: "D2 Travel" },
  { code: "D3", label: "D3 Clothing, laundry, dry-cleaning" },
  { code: "D4", label: "D4 Self-education" },
  { code: "D5", label: "D5 Other work-related" },
  { code: "D9", label: "D9 Gifts and donations" },
  { code: "D10", label: "D10 Cost of managing tax affairs" },
  { code: "D15", label: "D15 Other deductions (e.g. income protection)" }
];
// The ATO working-from-home fixed rate, per hour, by the year the financial year starts in. It
// covers energy, internet, phone and stationery — those can't also be claimed separately. 67c for
// FY22/23-FY23/24, 70c from FY24/25 (confirmed for FY25/26 on ato.gov.au). A year past the table
// uses the latest rate, labelled as such where it's shown.
export var WFH_FIXED_RATES = { 2022: 0.67, 2023: 0.67, 2024: 0.70, 2025: 0.70 };

// ---------------- Tax tables by financial year (v3.25.0) ----------------
//
// Keyed by the calendar year the financial year starts in (2025 = FY25/26). Every figure below was
// read off ato.gov.au in October 2026: individual rates (tax-rates-australian-residents), study
// loan repayment thresholds, Medicare levy surcharge and private health insurance rebate tiers,
// and the M1 Medicare levy low-income thresholds. A year not listed borrows the nearest one and is
// flagged as assumed wherever it's shown — a table that silently goes stale is the failure this
// replaces (AU_TAX_BRACKETS above is the FY24/25 table and was being used for every year).
//
// Shapes worth knowing:
//   - help.kind "flat" (to FY24/25) charges one rate on the WHOLE repayment income; "marginal"
//     (from FY25/26) charges each band's rate on the slice above it, plus 10% of the whole income
//     above `wholeAbove`.
//   - phi.periods split the year where the rebate percentage is re-indexed (1 April): `share` is
//     the part of the year each covers, `rates` the rebate % for base/tier 1/2/3 by the age of the
//     oldest person on the policy — u65, a65 (65-69), a70 (70 and over).
//   - medicare.lower/upper are the singles low-income shade-in thresholds (10c per $ between).
export var TAX_YEARS = {
  2024: {
    brackets: AU_TAX_BRACKETS,
    medicare: { lower: 27222, upper: 34027 },
    help: { kind: "flat", rates: HELP_REPAYMENT_RATES },
    mls: { single: [97000, 113000, 151000] },
    phi: { periods: [{ share: 0.75, rates: { u65: [24.608, 16.405, 8.202, 0], a65: [28.710, 20.507, 12.303, 0], a70: [32.812, 24.608, 16.405, 0] } }, { share: 0.25, rates: { u65: [24.288, 16.192, 8.095, 0], a65: [28.337, 20.240, 12.143, 0], a70: [32.385, 24.288, 16.192, 0] } }] }
  },
  2025: {
    brackets: AU_TAX_BRACKETS,
    medicare: { lower: 28011, upper: 35013 },
    help: { kind: "marginal", bands: [{ over: 67000, base: 0, rate: 0.15 }, { over: 125000, base: 8700, rate: 0.17 }], wholeAbove: 179285, wholeRate: 0.10 },
    mls: { single: [101000, 118000, 158000] },
    phi: { periods: [{ share: 0.75, rates: { u65: [24.288, 16.192, 8.095, 0], a65: [28.337, 20.240, 12.143, 0], a70: [32.385, 24.288, 16.192, 0] } }, { share: 0.25, rates: { u65: [24.118, 16.079, 8.038, 0], a65: [28.139, 20.098, 12.058, 0], a70: [32.158, 24.118, 16.079, 0] } }] }
  },
  2026: {
    // The 16% rate becomes 15% from 1 July 2026.
    brackets: [
      { from: 0, to: 18200, base: 0, rate: 0 },
      { from: 18200, to: 45000, base: 0, rate: 0.15 },
      { from: 45000, to: 135000, base: 4020, rate: 0.30 },
      { from: 135000, to: 190000, base: 31020, rate: 0.37 },
      { from: 190000, to: Infinity, base: 51370, rate: 0.45 }
    ],
    // FY26/27 low-income thresholds weren't on the ATO's M1 page yet; FY25/26's are carried.
    medicare: { lower: 28011, upper: 35013, assumed: true },
    help: { kind: "marginal", bands: [{ over: 69528, base: 0, rate: 0.15 }, { over: 129717, base: 9028, rate: 0.17 }], wholeAbove: 186050, wholeRate: 0.10 },
    mls: { single: [105000, 123000, 164000] },
    // Rates from 1 April 2027 aren't published until March 2027; the July rates are carried.
    phi: { periods: [{ share: 0.75, rates: { u65: [24.118, 16.079, 8.038, 0], a65: [28.139, 20.098, 12.058, 0], a70: [32.158, 24.118, 16.079, 0] } }, { share: 0.25, rates: { u65: [24.118, 16.079, 8.038, 0], a65: [28.139, 20.098, 12.058, 0], a70: [32.158, 24.118, 16.079, 0] }, assumed: true }] }
  }
};
export var MLS_RATES = [0, 0.01, 0.0125, 0.015];

// ---------------- Household benchmarks (v3.35.0) ----------------
// Published Australian figures the Insights "How you compare" card measures against. Each carries
// its source and the period it describes, and the card prints both — a comparison is only as good
// as the date on it. Refresh once a year; ROADMAP item 67 lists where each comes from.
export var BENCHMARKS = {
  // ATO data via ASFA, "Superannuation account balances by age and gender" (October 2025),
  // balances at 30 June 2023, people with a balance (nil balances excluded). All persons.
  super: {
    source: "ATO via ASFA, balances at 30 June 2023", url: "https://www.superannuation.asn.au/wp-content/uploads/2025/12/Account-Balances-Paper_v3-5.pdf",
    bands: [
      { from: 18, to: 24, median: 5170, average: 8614 },
      { from: 25, to: 29, median: 19187, average: 25943 },
      { from: 30, to: 34, median: 38525, average: 51190 },
      { from: 35, to: 39, median: 65491, average: 86223 },
      { from: 40, to: 44, median: 93351, average: 125332 },
      { from: 45, to: 49, median: 121924, average: 170774 },
      { from: 50, to: 54, median: 147857, average: 222491 },
      { from: 55, to: 59, median: 169146, average: 281921 },
      { from: 60, to: 64, median: 189618, average: 355451 },
      { from: 65, to: 69, median: 208143, average: 420934 },
      { from: 70, to: 74, median: 215009, average: 476268 },
      { from: 75, to: 200, median: 182484, average: 492198 }
    ]
  },
  // ABS, Household Income and Wealth, Australia, 2019-20 — still the latest: the ABS has said no
  // wealth outputs will come from the 2023-24 survey. Mean net worth by age of the household's
  // reference person; the overall median was $579,200 against a mean of $1,042,000.
  netWorth: {
    source: "ABS Household Income and Wealth, 2019-20 (mean, by age of reference person)",
    url: "https://www.abs.gov.au/statistics/economy/finance/household-income-and-wealth-australia/latest-release",
    overallMedian: 579200, overallMean: 1042000,
    bands: [
      { from: 15, to: 19, mean: 129000 }, { from: 20, to: 24, mean: 82000 }, { from: 25, to: 29, mean: 242000 },
      { from: 30, to: 34, mean: 441000 }, { from: 35, to: 39, mean: 555000 }, { from: 40, to: 44, mean: 841000 },
      { from: 45, to: 49, mean: 1055000 }, { from: 50, to: 54, mean: 1212000 }, { from: 55, to: 59, mean: 1453000 },
      { from: 60, to: 64, mean: 1601000 }, { from: 65, to: 69, mean: 1835000 }, { from: 70, to: 74, mean: 1509000 },
      { from: 75, to: 200, mean: 1167000 }
    ]
  },
  // ABS, Australian National Accounts: National Income, Expenditure and Product, June 2026 —
  // household saving as a share of disposable income, seasonally adjusted.
  savingRatio: { value: 0.065, source: "ABS national accounts, June quarter 2026", url: "https://www.abs.gov.au/statistics/economy/national-accounts/australian-national-accounts-national-income-expenditure-and-product/latest-release" },
  // ABS, Housing Occupancy and Costs, 2019-20 — housing costs as a share of gross household income.
  housingShare: { renters: 0.199, mortgage: 0.155, all: 0.136, source: "ABS Housing Occupancy and Costs, 2019-20" },
  // ASFA Retirement Standard (March 2026 update): lump sum at 67 for a comfortable / modest
  // retirement, assuming you own your home.
  retirement: { comfortable: { single: 630000, couple: 730000 }, modest: { single: 110000, couple: 120000 }, source: "ASFA Retirement Standard, March 2026", url: "https://www.superannuation.asn.au/" }
};
