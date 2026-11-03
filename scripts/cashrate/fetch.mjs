// The RBA cash rate file (item 249) — run by .github/workflows/cashrate.yml each weekday afternoon (Sydney).
//
//   node scripts/cashrate/fetch.mjs
//
// Reads the RBA's statistical table of cash rate decisions (A2) — or, if that can't be read, the daily money
// market table (F1.1) — finds the "Cash Rate Target" column (src/calc/cashrate.js parseRbaCsv) and rewrites
// rates/cash-rate.json when the rate has changed. Exits non-zero when neither table can be read or parsed, so a
// change in the RBA's file shows as a failed run in the Actions tab instead of a quiet stale file; the app keeps
// reading the last good one.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseRbaCsv, cashRateFile } from "../../src/calc/cashrate.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const out = path.join(root, "rates", "cash-rate.json");
const SOURCES = [
  "https://www.rba.gov.au/statistics/tables/csv/a2-data.csv",
  "https://www.rba.gov.au/statistics/tables/csv/f1.1-data.csv"
];
const today = new Date().toISOString().slice(0, 10);
const summary = line => { if(process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, line + "\n"); console.log(line); };

let points = null;
const problems = [];
for(const url of SOURCES){
  try {
    const r = await fetch(url, { headers: { "User-Agent": "wealth-planner cash rate file (GitHub Actions)", "Accept": "text/csv,*/*" } });
    if(!r.ok) throw new Error("HTTP " + r.status);
    points = parseRbaCsv(await r.text());
    summary("Read " + url + ": " + points.length + " changes, latest " + points[points.length - 1].rate + "% from " + points[points.length - 1].effective);
    break;
  } catch(e){ problems.push(url + " — " + e.message); }
}
if(!points){ problems.forEach(p => summary("Couldn't read " + p)); process.exit(1); }

let before = null;
try { before = JSON.parse(fs.readFileSync(out, "utf8")); } catch(e){ before = null; }
const next = cashRateFile(points, today);
const same = before && before.current && before.current.rate === next.current.rate && before.current.effective === next.current.effective &&
  JSON.stringify(before.decisions) === JSON.stringify(next.decisions);
if(same){ summary("No change: " + next.current.rate + "% from " + next.current.effective); process.exit(0); }
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(next, null, 2) + "\n");
summary("Wrote rates/cash-rate.json: " + next.current.rate + "% from " + next.current.effective);
