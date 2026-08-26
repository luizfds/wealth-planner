export var STORAGE_KEY = "wealthPlanner.v1";

export var FREQS = ["Weekly","Fortnightly","Monthly","Quarterly","Yearly"];
export var CLASSES = ["Needs","Wants","Savings","N/A"];
export var INCOME_TYPES = ["Net", "Gross"];
export var SUPER_MODES = ["On top", "Included", "N/A"];
export var SACRIFICE_MODES = ["Cash out", "Sacrifice %", "Sacrifice $"];
export function sacrificeModeToLabel(mode){ return mode === "percent" ? "Sacrifice %" : mode === "amount" ? "Sacrifice $" : "Cash out"; }
export function sacrificeLabelToMode(label){ return label === "Sacrifice %" ? "percent" : label === "Sacrifice $" ? "amount" : "none"; }

export var ASSET_CATEGORIES = ["Cash", "Shares", "Super", "Vehicle", "Other"];
export var LIQUID_CATEGORIES = ["Cash", "Shares"];
export var SHARE_MARKETS = ["ASX", "US"];
export var PURCHASE_STATE_CODES = ["NSW", "VIC", "Other"];

// Long-run compound annual growth in established house prices, 1980-2022 (Landmark
// Valuations analysis of ABS/state-government median price series). These are historical
// averages for context, not a forecast — past growth doesn't predict future growth, which
// is why this is only ever a suggested starting point the user can override per scenario.
export var STATE_GROWTH_RATES = { NSW: 6.8, VIC: 7.2, Other: 6.4 };

export var HOME_CATEGORIES = ["Rent / Home Loan", "Home Insurance", "Council Rates", "Water & Wastewater", "Property Maintenance"];

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
