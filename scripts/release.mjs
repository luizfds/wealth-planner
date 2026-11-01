// Releases on merge (v3.202.0, item 233). The Release workflow runs this after every push to main:
//
//   node scripts/release.mjs decide   — which release, if any (writes bump= and title= to $GITHUB_OUTPUT)
//   node scripts/release.mjs apply <minor|patch>  — the new version into index.html, then npm run stamp
//
// Which release: a label on the merged pull request decides — `release: minor`, `release: patch` or
// `release: none`. Without one: nothing that ships changed (docs, the roadmap, tests, CI) → none; every
// commit titled as a fix → patch; anything else → minor. A push that already moved the version by hand
// is left alone. The decision itself (decideBump, nextVersion) is pure and tested in tests/release.test.js.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// What a visitor gets: anything else is docs, tests or tooling.
export function shipsToUsers(file){
  return /^(src\/|vendor\/|icons\/)/.test(file) || ["index.html", "styles.css", "sw.js", "manifest.webmanifest", "welcome.html", "onboarding.html"].indexOf(file) !== -1;
}
export function nextVersion(current, bump){
  const p = String(current).replace(/^v/, "").split(".").map(Number);
  if(p.length !== 3 || p.some(n => !Number.isInteger(n))) throw new Error("Not a version: " + current);
  if(bump === "major") return (p[0] + 1) + ".0.0";
  if(bump === "minor") return p[0] + "." + (p[1] + 1) + ".0";
  if(bump === "patch") return p[0] + "." + p[1] + "." + (p[2] + 1);
  throw new Error("Not a bump: " + bump);
}
// inp: { labels: [string], titles: [string] (commit subjects), files: [paths changed], versionChanged: bool }
export function decideBump(inp){
  const labels = (inp.labels || []).map(l => String(l).toLowerCase().replace(/\s+/g, ""));
  if(inp.versionChanged) return "none";
  for(const b of ["none", "major", "minor", "patch"]) if(labels.indexOf("release:" + b) !== -1) return b;
  const files = inp.files || [];
  if(!files.some(shipsToUsers)) return "none";
  const titles = (inp.titles || []).filter(t => !/^(Merge |Roadmap:|Bump version)/.test(t));
  if(titles.length && titles.every(t => /^(fix|fixes|fixed)\b/i.test(t))) return "patch";
  return "minor";
}

function sh(cmd, args){ return execFileSync(cmd, args, { cwd: root, encoding: "utf8" }).trim(); }
function gh(api){ try { return JSON.parse(sh("gh", ["api", api])); } catch(e){ return null; } }
function output(k, v){ if(process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, k + "=" + String(v).replace(/\n/g, " ") + "\n"); console.log(k + "=" + v); }

if(process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)){
  const cmd = process.argv[2];
  if(cmd === "decide"){
    const repo = process.env.GITHUB_REPOSITORY, sha = process.env.GITHUB_SHA || sh("git", ["rev-parse", "HEAD"]);
    const before = process.env.BEFORE_SHA && !/^0+$/.test(process.env.BEFORE_SHA) ? process.env.BEFORE_SHA : sh("git", ["rev-parse", "HEAD~1"]);
    const files = sh("git", ["diff", "--name-only", before, sha]).split("\n").filter(Boolean);
    const diff = sh("git", ["diff", before, sha, "--", "index.html"]);
    const versionChanged = /^\+.*app-version-num">v/m.test(diff);
    const pulls = repo ? gh("repos/" + repo + "/commits/" + sha + "/pulls") : null;
    const pr = Array.isArray(pulls) && pulls.find(p => p.merged_at) || null;
    const titles = pr ? (gh("repos/" + repo + "/pulls/" + pr.number + "/commits?per_page=100") || []).map(c => c.commit.message.split("\n")[0])
      : sh("git", ["log", "--format=%s", before + ".." + sha]).split("\n").filter(Boolean);
    const bump = decideBump({ labels: pr ? pr.labels.map(l => l.name) : [], titles, files, versionChanged });
    output("bump", bump);
    output("title", pr ? pr.title : (titles[titles.length - 1] || "release"));
    output("pr", pr ? pr.number : "");
  } else if(cmd === "apply"){
    const indexPath = path.join(root, "index.html");
    const html = fs.readFileSync(indexPath, "utf8");
    const cur = /app-version-num">v([0-9.]+)</.exec(html)[1];
    const next = nextVersion(cur, process.argv[3]);
    fs.writeFileSync(indexPath, html.replace('app-version-num">v' + cur + '<', 'app-version-num">v' + next + '<'));
    sh("node", ["scripts/stamp.mjs"]);
    output("version", next);
  } else {
    console.error("usage: node scripts/release.mjs decide | apply <minor|patch|major>");
    process.exit(2);
  }
}
