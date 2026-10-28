// The daily price file (v3.133.0) — run by .github/workflows/prices.yml each weekday.
//
//   node scripts/prices/fetch.mjs
//
// Reads prices/universe.json (a fixed public list), asks Twelve Data for every ticker
// (TWELVE_DATA_KEY; without it ASX is skipped and US falls back to Stooq, which GitHub's runners
// mostly can't reach), and rewrites prices/latest.json and
// prices/weekly.json. One weekly series per ticker gives both the five-year history and the latest
// close (the week to date). Twelve Data's free plan allows 8 requests a minute and 800 a day, so the
// ~400 tickers are paced and take about 50 minutes. A ticker that fails keeps yesterday's price for up to ten
// days. Writes a summary to GITHUB_STEP_SUMMARY when there is one. Never exits non-zero for a
// ticker that failed — only for nothing working at all.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseStooqCsv, parseTwelveData, mergeFiles, latestFromWeekly, stooqSymbol } from "./lib.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dir = path.join(root, "prices");
const read = (f, d) => { try { return JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); } catch(e){ return d; } };
const universe = read("universe.json", { asx: [], us: [] });
const KEY = process.env.TWELVE_DATA_KEY || "", STOOQ_KEY = process.env.STOOQ_APIKEY || "";
const PER_MINUTE = Number(process.env.TWELVE_DATA_PER_MINUTE || 8);
const today = new Date().toISOString().slice(0, 10);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fresh = {}, failed = { asx: [], us: [] };

async function get(url, as){
  const r = await fetch(url, { headers: { "user-agent": "wealth-planner price file (github.com/luizfds/wealth-planner)" } });
  if(!r.ok) throw new Error("HTTP " + r.status);
  return as === "json" ? r.json() : r.text();
}

// One ticker's five years of weekly closes from Twelve Data (1 credit), paced to the plan's limit.
async function twelve(t, exchange){
  const started = Date.now();
  try {
    // Twelve Data says why in the body (a plan limit, an unknown symbol) even on an HTTP error, so
    // read it rather than stopping at the status.
    const r = await fetch("https://api.twelvedata.com/time_series?symbol=" + encodeURIComponent(t) + (exchange ? "&exchange=" + exchange : "") + "&interval=1week&outputsize=262&apikey=" + KEY);
    let json = null; try { json = await r.json(); } catch(e){}
    const rows = parseTwelveData(json);
    if(!rows || !rows.length) throw new Error("HTTP " + r.status + (json && json.message ? ": " + json.message.slice(0, 120) : ""));
    return rows;
  } finally { await sleep(Math.max(0, 60000 / PER_MINUTE - (Date.now() - started))); }
}
async function stooq(t){
  const rows = parseStooqCsv(await get("https://stooq.com/q/d/l/?s=" + stooqSymbol(t) + "&i=w" + (STOOQ_KEY ? "&apikey=" + STOOQ_KEY : ""), "text"));
  if(!rows.length) throw new Error("no rows");
  await sleep(1000);
  return rows;
}
const total = universe.asx.length + universe.us.length;
let done = 0;
const progress = () => { if(++done % 50 === 0) console.log(done + " of " + total + " asked…"); };
// v3.136.2: US through Twelve Data as well — Stooq answers GitHub's runners with 403. Stooq is only
// tried for a US ticker Twelve Data couldn't give, and only with STOOQ_APIKEY, or with no Twelve Data key.
for(const t of universe.us){
  try {
    let rows = null;
    if(KEY){ try { rows = await twelve(t, ""); } catch(e){ if(!STOOQ_KEY) throw e; } }
    if(!rows) rows = await stooq(t);
    fresh["US:" + t] = { weekly: rows, latest: latestFromWeekly(rows) };
  } catch(e){ failed.us.push(t + " (" + e.message + ")"); }
  progress();
}
if(KEY){
  for(const t of universe.asx){
    try {
      const rows = await twelve(t, "ASX");
      fresh["ASX:" + t] = { weekly: rows, latest: latestFromWeekly(rows) };
    } catch(e){ failed.asx.push(t + " (" + e.message + ")"); }
    progress();
    // When the first dozen all fail, the plan doesn't cover the market — say so and stop, rather
    // than spend another 40 minutes and 300 credits learning the same thing.
    if(failed.asx.length === 12 && !Object.keys(fresh).some(k => k.startsWith("ASX:"))){
      console.log("The first 12 ASX tickers all failed (" + failed.asx[0] + ") — skipping the rest.");
      failed.asx.push("… and the other " + (universe.asx.length - 12) + ", not tried");
      break;
    }
  }
}

const out = mergeFiles(read("latest.json", null), read("weekly.json", null), fresh, today);
fs.writeFileSync(path.join(dir, "latest.json"), JSON.stringify(out.latest));
fs.writeFileSync(path.join(dir, "weekly.json"), JSON.stringify(out.weekly));
const got = Object.keys(fresh).length;
const summary = ["### Price file " + today, "",
  "Fresh today: " + got + " of " + (universe.us.length + (KEY ? universe.asx.length : 0)) + " (US " + Object.keys(fresh).filter(k => k.startsWith("US:")).length + ", ASX " + Object.keys(fresh).filter(k => k.startsWith("ASX:")).length + ")" + " · in the file: " + Object.keys(out.latest.prices).length + ".",
  KEY ? "" : "ASX skipped: no TWELVE_DATA_KEY secret.",
  failed.us.length ? "US failed (" + failed.us.length + "): " + failed.us.slice(0, 30).join(", ") : "",
  failed.asx.length ? "ASX failed (" + failed.asx.length + "): " + failed.asx.slice(0, 30).join(", ") : ""].filter(Boolean).join("\n");
console.log(summary);
if(process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + "\n");
if(!got && !Object.keys(out.latest.prices).length) process.exit(1);
