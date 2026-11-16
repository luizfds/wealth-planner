// Stamps the app's version onto every script and stylesheet URL, so a browser that loads a new
// index.html can't pair it with an old cached copy of one module (v3.76.0). Run after bumping
// <span class="app-version-num"> — the Release workflow does, after every merge (scripts/release.mjs). A pull request
// doesn't: see stampProblems() for the few things one does have to get right, which tests/stamp.test.js checks.
//
// Modules import each other by relative path ("./state.js"), and a query string on the entry
// script doesn't carry to them. An import map does: it maps every module's plain URL to the same
// URL plus ?v=…, so each import of a file resolves to one versioned URL — one module instance, the
// same as before, just never a stale one.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const START = "<!-- stamp:importmap -->", END = "<!-- /stamp:importmap -->";

export function appVersion(html){
  const m = /app-version-num">v([0-9.]+)</.exec(html);
  if(!m) throw new Error("No app-version-num in index.html");
  return m[1];
}
export function moduleFiles(dir = path.join(root, "src")){
  const out = [];
  for(const e of fs.readdirSync(dir, { withFileTypes: true })){
    const p = path.join(dir, e.name);
    if(e.isDirectory()) out.push(...moduleFiles(p));
    else if(e.name.endsWith(".js")) out.push(path.relative(root, p).split(path.sep).join("/"));
  }
  return out.sort();
}
export function stampedIndex(html, version, files){
  const imports = {};
  files.forEach(f => { imports["./" + f] = "./" + f + "?v=" + version; });
  // v3.138.0: and a modulepreload for each, after the map (which has to come first). Without them the
  // browser finds the ~130 modules an import level at a time — on a phone's latency, a waterfall of
  // seconds. Every file under src/ is in app.js's static import graph, so none is fetched for nothing.
  const preloads = files.map(f => '<link rel="modulepreload" href="./' + f + '?v=' + version + '">').join("\n");
  const block = START + '\n<script type="importmap">\n' + JSON.stringify({ imports }, null, 1) + "\n</script>\n" + preloads + "\n" + END;
  let out = html.includes(START)
    ? html.replace(new RegExp(START + "[\\s\\S]*?" + END), block)
    : html.replace('<script type="module" src="src/app.js', block + '\n<script type="module" src="src/app.js');
  out = out.replace(/<script type="module" src="src\/app\.js(\?v=[0-9.]+)?"><\/script>/, '<script type="module" src="src/app.js?v=' + version + '"></script>');
  out = out.replace(/<link rel="stylesheet" href="styles\.css(\?v=[0-9.]+)?">/, '<link rel="stylesheet" href="styles.css?v=' + version + '">');
  return withScriptHashes(out);
}
// v3.202.0 (item 233): the Content-Security-Policy allows an inline <script> only by the hash of its exact
// text — the import map above changes with every version, so its hash is worked out here, every stamp.
export function inlineScriptHashes(html){
  const out = [], re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
  let m;
  while((m = re.exec(html))) out.push("'sha256-" + crypto.createHash("sha256").update(m[1], "utf8").digest("base64") + "'");
  return out;
}
export function withScriptHashes(html){
  return html.replace(/(<meta http-equiv="Content-Security-Policy" content="[^"]*?script-src 'self')((?: 'sha256-[A-Za-z0-9+/=]+')*)/, function(all, head){
    const hashes = inlineScriptHashes(html);
    return head + (hashes.length ? " " + hashes.join(" ") : "");
  });
}
// What a pull request has to get right without stamping. The release stamps every module after a merge (the
// version moves, so every import-map line changes then anyway) — a PR that stamped too wrote the same lines, and every
// open PR conflicted with every release. So a module or stylesheet not yet versioned is fine: it loads by its plain
// URL until the release adds it. What can't wait for the release, because the app breaks or loads stale code without
// it, is listed: an inline script the CSP doesn't allow, a mapped or preloaded module that no longer exists, and a URL
// carrying some other version.
export function stampProblems(html, css, version, files){
  const out = [], have = new Set(files);
  const csp = /<meta http-equiv="Content-Security-Policy" content="[^"]*?script-src 'self'((?: 'sha256-[A-Za-z0-9+/=]+')*)/.exec(html);
  const allowed = csp ? csp[1].trim().split(/\s+/).filter(Boolean) : [];
  inlineScriptHashes(html).forEach(h => { if(allowed.indexOf(h) === -1) out.push("an inline <script> isn't allowed by the Content-Security-Policy (" + h + ")"); });
  const map = /<script type="importmap">([\s\S]*?)<\/script>/.exec(html);
  const imports = map ? JSON.parse(map[1]).imports || {} : {};
  Object.keys(imports).forEach(k => {
    const f = k.replace(/^\.\//, "");
    if(!have.has(f)) out.push("the import map lists " + f + ", which doesn't exist");
    if(imports[k] !== k + "?v=" + version) out.push("the import map maps " + f + " to " + imports[k] + ", not v" + version);
  });
  (html.match(/<link rel="modulepreload" href="[^"]+">/g) || []).forEach(l => {
    const m = /href="\.\/([^"?]+)(\?v=([0-9.]+))?"/.exec(l);
    if(!m || !have.has(m[1])) out.push("a modulepreload names " + (m ? m[1] : l) + ", which doesn't exist");
    else if(m[3] !== version) out.push("a modulepreload for " + m[1] + " isn't v" + version);
  });
  [[/<script type="module" src="src\/app\.js(\?v=([0-9.]+))?"/, "src/app.js"], [/<link rel="stylesheet" href="styles\.css(\?v=([0-9.]+))?"/, "styles.css"]].forEach(([re, name]) => {
    const m = re.exec(html);
    if(!m) out.push("index.html doesn't load " + name);
    else if(m[2] && m[2] !== version) out.push(name + " is loaded as v" + m[2] + ", not v" + version);
  });
  (css.match(/@import url\("src\/styles\/[a-z-]+\.css\?v=[0-9.]+"\)/g) || []).forEach(l => {
    if(l.indexOf("?v=" + version + '"') === -1) out.push("styles.css imports " + l.replace(/^@import url\("|"\)$/g, "") + ", not v" + version);
  });
  return out;
}
export function stampedStyles(css, version){
  // v3.207.1 (item 238): each import carries its cascade layer, kept as it is.
  return css.replace(/@import url\("(src\/styles\/[a-z-]+\.css)(\?v=[0-9.]+)?"\)( layer\([a-z.-]+\))?;/g, function(m, file, v, layer){ return '@import url("' + file + '?v=' + version + '")' + (layer || "") + ";"; });
}

if(process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)){
  const indexPath = path.join(root, "index.html"), cssPath = path.join(root, "styles.css");
  const html = fs.readFileSync(indexPath, "utf8");
  // --hashes: only the CSP's script hashes, for a pull request that adds or changes an inline <script>. The import
  // map is the release's to stamp — writing it in a PR conflicts with the next release.
  if(process.argv.includes("--hashes")){
    fs.writeFileSync(indexPath, withScriptHashes(html));
    console.log("Rehashed the inline scripts in the Content-Security-Policy");
    process.exit(0);
  }
  const v = appVersion(html);
  fs.writeFileSync(indexPath, stampedIndex(html, v, moduleFiles()));
  fs.writeFileSync(cssPath, stampedStyles(fs.readFileSync(cssPath, "utf8"), v));
  console.log("Stamped v" + v + " on " + moduleFiles().length + " modules and the stylesheets");
}
