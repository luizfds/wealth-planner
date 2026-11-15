import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const source = readFileSync(process.env.SW_TEST_SOURCE || new URL("../sw.js", import.meta.url), "utf8");
const SCOPE = "https://example.test/planner/", SHARE = "wealth-planner-share", APP = "wealth-planner-cache-v1";
const FILE = SCOPE + "shared-statement", SHELL = SCOPE + "index.html";
const bytes = new TextEncoder().encode("Date,Description,Amount\n01/10/2026,Example Market,-100\n");
const headers = { "Content-Type": "text/csv", "X-File-Name": encodeURIComponent("Example statement.csv") };

function worker(options = {}){
  const handlers = {}, entries = new Map(), requests = [], replies = [];
  let claims = 0;
  const caches = {
    keys: async () => [...entries.keys()],
    delete: async name => entries.delete(name),
    open: async name => {
      if(!entries.has(name)) entries.set(name, new Map());
      const data = entries.get(name);
      return {
        put: async (key, response) => {
          const url = typeof key === "string" ? key : key.url;
          if(options.failPut?.(name, url)) throw new Error("Synthetic cache write failure");
          data.set(url, response.clone());
        },
        match: async key => data.get(typeof key === "string" ? key : key.url)?.clone()
      };
    }
  };
  const self = { registration: { scope: SCOPE }, clients: { claim: async () => { claims++; } }, skipWaiting(){},
    addEventListener(type, fn){ (handlers[type] ||= []).push(fn); } };
  runInNewContext(source, { self, caches, URL, Request, Response, fetch: async request => {
    requests.push(request); return options.fetch ? options.fetch(request) : new Response("fresh app shell");
  } });
  async function event(type, extra = {}){
    const pending = []; let response;
    const e = { ...extra, waitUntil(p){ pending.push(p); }, respondWith(p){ response = p; } };
    for(const fn of handlers[type] || []) fn(e);
    const result = await response; await Promise.all(pending); return result;
  }
  return { caches, entries, requests, replies, claims: () => claims, event,
    update: () => event("message", { data: { type: "purge-and-reprime" }, ports: [{ postMessage: value => replies.push(value.ok) }] }) };
}
async function seed(w){
  await (await w.caches.open(SHARE)).put(FILE, new Response(bytes, { headers }));
  await (await w.caches.open(APP)).put(SHELL, new Response("stale shell"));
  await (await w.caches.open("wealth-planner-cache-old")).put(SCOPE + "old.js", new Response("stale script"));
}
async function preserved(w){
  assert.ok(w.entries.has(SHARE), "pending statement cache must survive app cleanup");
  const file = await (await w.caches.open(SHARE)).match(FILE);
  assert.ok(file, "pending statement must still be available");
  assert.deepEqual(new Uint8Array(await file.arrayBuffer()), bytes);
  for(const [name, value] of Object.entries(headers)) assert.equal(file.headers.get(name), value);
}

test("an accepted app update preserves a pending statement and refreshes the shell", async () => {
  const w = worker(); await seed(w); await w.update(); await preserved(w);
  assert.deepEqual(w.replies, [true]);
  assert.deepEqual([...w.entries.keys()].sort(), [APP, SHARE].sort());
  assert.equal(await (await (await w.caches.open(APP)).match(SHELL)).text(), "fresh app shell");
  assert.equal(w.requests.length, 1); assert.equal(w.requests[0].url, SHELL); assert.equal(w.requests[0].cache, "no-store");
});

test("failed and repeated update refreshes retain the original file and metadata", async () => {
  let offline = true;
  const w = worker({ fetch: () => { if(offline) throw new Error("Synthetic offline refresh"); return new Response("fresh app shell"); } });
  await seed(w);
  await w.update(); await preserved(w); await w.update(); await preserved(w);
  offline = false; await w.update(); await preserved(w);
  assert.deepEqual(w.replies, [false, false, true]);
});

test("an HTTP refresh error keeps the file and the existing update reply behavior", async () => {
  const w = worker({ fetch: () => new Response("Synthetic unavailable shell", { status: 503 }) });
  await seed(w); await w.update(); await preserved(w);
  assert.deepEqual(w.replies, [true]); assert.ok(!w.entries.has(APP));
});

test("a shell-cache write failure keeps the pending statement", async () => {
  let fail = false;
  const w = worker({ failPut: name => fail && name === APP });
  await seed(w); fail = true; await w.update(); await preserved(w);
  assert.deepEqual(w.replies, [false]);
});

test("activation keeps pending shares and the current app cache while removing stale app caches", async () => {
  const w = worker(); await seed(w); await w.event("activate"); await preserved(w);
  assert.deepEqual([...w.entries.keys()].sort(), [APP, SHARE].sort()); assert.equal(w.claims(), 1);
});

test("a real share-target POST remains available through update cleanup", async () => {
  const w = worker(), form = new FormData();
  form.set("statement", new File([bytes], "Example statement.csv", { type: "text/csv" }));
  const response = await w.event("fetch", { request: new Request(SCOPE + "share-target", { method: "POST", body: form }) });
  assert.equal(response.status, 303); assert.equal(response.headers.get("Location"), SCOPE + "?shared=1");
  await w.update(); await preserved(w);
});
