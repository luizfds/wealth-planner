import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { pkcePair, authorizeUrl } from "../src/lib/dropbox.js";

test("sign-in with PKCE: the challenge is the verifier's SHA-256, URL-safe, and the URL asks for offline access", async () => {
  const p = await pkcePair();
  assert.match(p.verifier, /^[A-Za-z0-9_-]{43,128}$/);
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(p.verifier)));
  assert.equal(p.challenge, Buffer.from(h).toString("base64url"));
  const u = new URL(authorizeUrl("key123", p.challenge, "st", "https://example.github.io/wealth-planner/"));
  assert.equal(u.origin + u.pathname, "https://www.dropbox.com/oauth2/authorize");
  assert.equal(u.searchParams.get("client_id"), "key123");
  assert.equal(u.searchParams.get("code_challenge_method"), "S256");
  assert.equal(u.searchParams.get("token_access_type"), "offline");
  assert.equal(u.searchParams.get("redirect_uri"), "https://example.github.io/wealth-planner/");
  assert.equal(u.searchParams.get("state"), "st");
});
