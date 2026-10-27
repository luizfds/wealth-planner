// The daily price file (v3.133.0) — run by .github/workflows/prices.yml each weekday.
//
//   node scripts/prices/fetch.mjs
//
// Reads prices/universe.json (a fixed public list), asks Stooq for the US tickers and Twelve Data
// for the ASX ones (TWELVE_DATA_KEY; without it ASX is skipped), and rewrites prices/latest.json and
// prices/weekly.json. One weekly series per ticker gives both the five-year history and the latest
// close (the week to date). Twelve Data's free plan allows 8 requests a minute and 800 a day, so ASX
// is paced; Stooq is asked one at a time. A ticker that fails keeps yesterday's price for up to ten
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

for(const t of universe.us){
  try {
    const rows = parseStooqCsv(await get("https://stooq.com/q/d/l/?s=" + stooqSymbol(t) + "&i=w" + (STOOQ_KEY ? "&apikey=" + STOOQ_KEY : ""), "text"));
    if(!rows.length) throw new Error("no rows");
    fresh["US:" + t] = { weekly: rows, latest: latestFromWeekly(rows) };
  } catch(e){ failed.us.push(t + " (" + e.message + ")"); }
  await sleep(1000);
}
if(KEY){
  for(const t of universe.asx){
    const started = Date.now();
    try {
      const json = await get("https://api.twelvedata.com/time_series?symbol=" + encodeURIComponent(t) + "&exchange=ASX&interval=1week&outputsize=262&apikey=" + KEY, "json");
      const rows = parseTwelveData(json);
      if(!rows || !rows.length) throw new Error(json && json.message ? json.message.slice(0, 80) : "no rows");
      fresh["ASX:" + t] = { weekly: rows, latest: latestFromWeekly(rows) };
    } catch(e){ failed.asx.push(t + " (" + e.message + ")"); }
    await sleep(Math.max(0, 60000 / PER_MINUTE - (Date.now() - started)));
  }
}

const out = mergeFiles(read("latest.json", null), read("weekly.json", null), fresh, today);
fs.writeFileSync(path.join(dir, "latest.json"), JSON.stringify(out.latest));
fs.writeFileSync(path.join(dir, "weekly.json"), JSON.stringify(out.weekly));
const got = Object.keys(fresh).length;
const summary = ["### Price file " + today, "",
  "Fresh today: " + got + " of " + (universe.us.length + (KEY ? universe.asx.length : 0)) + " · in the file: " + Object.keys(out.latest.prices).length + ".",
  KEY ? "" : "ASX skipped: no TWELVE_DATA_KEY secret.",
  failed.us.length ? "US failed (" + failed.us.length + "): " + failed.us.slice(0, 30).join(", ") : "",
  failed.asx.length ? "ASX failed (" + failed.asx.length + "): " + failed.asx.slice(0, 30).join(", ") : ""].filter(Boolean).join("\n");
console.log(summary);
if(process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + "\n");
if(!got && !Object.keys(out.latest.prices).length) process.exit(1);
