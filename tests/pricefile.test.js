import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { parseStooqCsv, parseTwelveData, parseYahooChart, twelveSymbol, mergeFiles, latestFromWeekly, stooqSymbol, KEEP_WEEKS } from "../scripts/prices/lib.mjs";

test("Stooq's CSV and Twelve Data's JSON into dated closes, oldest first", () => {
  assert.deepEqual(parseStooqCsv("Date,Open,High,Low,Close,Volume\n2026-10-17,10,11,9,10.5,100\n2026-10-24,10.5,12,10,11.25,120\n"), [["2026-10-17", 10.5], ["2026-10-24", 11.25]]);
  assert.deepEqual(parseStooqCsv("No data"), []);
  assert.deepEqual(parseTwelveData({ status: "ok", values: [{ datetime: "2026-10-20", close: "101.2" }, { datetime: "2026-10-13", close: "99.8" }] }), [["2026-10-13", 99.8], ["2026-10-20", 101.2]]);
  assert.equal(parseTwelveData({ status: "error", code: 429, message: "limit" }), null);
  assert.deepEqual(latestFromWeekly([["2026-10-17", 1], ["2026-10-24", 2]]), { close: 2, date: "2026-10-24" });
  assert.equal(stooqSymbol("BRK.B"), "brk-b.us"); assert.equal(stooqSymbol("AAPL"), "aapl.us");
});

test("a day's results merge into the files; a failed ticker keeps its price ten days, then drops", () => {
  const prev = { updated: "2026-10-20", prices: { "US:AAA": { close: 5, date: "2026-10-20" }, "US:OLD": { close: 9, date: "2026-10-01" } } };
  const prevW = { weekly: { "US:AAA": [["2026-10-17", 5]] } };
  const long = Array.from({ length: 300 }, (_, i) => ["2020-01-" + String((i % 28) + 1).padStart(2, "0"), i + 1]);
  const out = mergeFiles(prev, prevW, { "ASX:BBB": { weekly: long, latest: { close: 1.234567, date: "2026-10-24" } } }, "2026-10-27");
  assert.deepEqual(Object.keys(out.latest.prices), ["ASX:BBB", "US:AAA"]);
  assert.equal(out.latest.prices["ASX:BBB"].close, 1.2346);
  assert.equal(out.weekly.weekly["ASX:BBB"].length, KEEP_WEEKS);
  assert.deepEqual(out.weekly.weekly["US:AAA"], [["2026-10-17", 5]]);
  assert.equal(out.latest.updated, "2026-10-27");
});

test("Yahoo's chart answer into weekly closes and the latest close, on the exchange's own dates", () => {
  // Invented figures. Sydney is UTC+11 here: a Monday 10:00 open is Sunday 23:00 UTC.
  const json = { chart: { error: null, result: [{
    meta: { gmtoffset: 39600, regularMarketPrice: 52.3, regularMarketTime: 1793163600 }, // Wed 28 Oct 2026, 16:00 Sydney
    timestamp: [1792364400, 1792969200, 1793059200, 1793163600],                        // Mon 19 Oct, Mon 26 Oct, a null, Wed 28 Oct
    indicators: { quote: [{ close: [50.1, 51.75, null, 52.3] }] } }] } };
  const got = parseYahooChart(json);
  assert.deepEqual(got.weekly, [["2026-10-19", 50.1], ["2026-10-26", 51.75], ["2026-10-28", 52.3]]);
  assert.deepEqual(got.latest, { close: 52.3, date: "2026-10-28" });
  // Without the meta price, the last bar.
  json.chart.result[0].meta = { gmtoffset: 39600 };
  assert.deepEqual(parseYahooChart(json).latest, { close: 52.3, date: "2026-10-28" });
  assert.equal(parseYahooChart({ chart: { result: null, error: { code: "Not Found", description: "No data found" } } }), null);
  assert.equal(parseYahooChart({ chart: { result: [{ meta: {}, timestamp: [1792364400], indicators: { quote: [{ close: [null] }] } }] } }), null);
  assert.equal(parseYahooChart(null), null);
});

test("Twelve Data's class-share spelling", () => {
  assert.equal(twelveSymbol("BRK-B"), "BRK.B"); assert.equal(twelveSymbol("AAPL"), "AAPL");
});
