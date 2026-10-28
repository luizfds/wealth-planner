// ---------------- Income, shown per year, month, fortnight, week, day or hour (v3.138.0) ----------------
//
// Every income figure is kept and summed per month (ledger.js periodsOf). This re-expresses a
// monthly figure in whichever period someone wants to read it in: a year is 12 months, a fortnight
// 2 of the 52 weeks, a day one of 365 (a calendar day, not a working one), and an hour one of the
// hours a person works in a week — which only a person has, so a household's or a shared row's
// hourly figure is the household's income over everyone's hours together, and a row that belongs
// to no one has none. Pure: the caller says whose hours.

export var SHOW_AS = [
  { key: "year", label: "Year", suffix: "/yr", long: "Yearly" },
  { key: "month", label: "Month", suffix: "/mo", long: "Monthly" },
  { key: "fortnight", label: "Fortnight", suffix: "/fn", long: "Fortnightly" },
  { key: "week", label: "Week", suffix: "/wk", long: "Weekly" },
  { key: "day", label: "Day", suffix: "/day", long: "Daily" },
  { key: "hour", label: "Hour", suffix: "/hr", long: "Hourly" }
];
export var DEFAULT_HOURS_PER_WEEK = 38;

export function showAsOption(key){ return SHOW_AS.find(function(o){ return o.key === key; }) || SHOW_AS[1]; }

// A monthly amount in the chosen period, or null for "per hour" with no hours to divide by.
export function fromMonthly(monthly, key, hoursPerWeek){
  var m = Number(monthly) || 0;
  switch(key){
    case "year": return m * 12;
    case "fortnight": return m * 12 / 26;
    case "week": return m * 12 / 52;
    case "day": return m * 12 / 365;
    case "hour": {
      var h = Number(hoursPerWeek);
      return h > 0 ? m * 12 / 52 / h : null;
    }
    default: return m;
  }
}
