// ratchet (v3.204.1, item 235c): edits go through commit(touched) — see state.js — so a view can redraw
// only what an edit touched (item 236). Moving every edit over is done a piece at a time; meanwhile each
// file may hold no more bare persist() calls and direct writes into `state` than eslint-rules/ratchet.json
// says, and the number written there has to come down when the file's does (node eslint-rules/ratchet.mjs
// --update writes it). So the count only ever falls.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { countIn, inScope } from "./counts.js";

const BASELINE = path.join(path.dirname(fileURLToPath(import.meta.url)), "ratchet.json");
let baseline = null;
function load(){ if(!baseline){ try { baseline = JSON.parse(fs.readFileSync(BASELINE, "utf8")); } catch(e){ baseline = {}; } } return baseline; }

export default {
  meta: { type: "problem", schema: [], messages: {
    more: "{{what}}: {{n}} here, {{max}} allowed (eslint-rules/ratchet.json). Use commit([...what it touches]) from state.js instead.",
    fewer: "{{what}}: down to {{n}} from {{max}} — lower it in eslint-rules/ratchet.json (node eslint-rules/ratchet.mjs --update)." } },
  create(context){
    const rel = path.relative(process.cwd(), context.filename).replace(/\\/g, "/");
    if(!inScope(rel)) return {};
    return {
      "Program:exit"(node){
        const n = countIn(node), max = load()[rel] || { persist: 0, stateWrites: 0 };
        [["persist", "bare persist() calls"], ["stateWrites", "direct writes into state"]].forEach(function([k, what]){
          if(n[k] > max[k]) context.report({ node, messageId: "more", data: { what, n: n[k], max: max[k] } });
          else if(n[k] < max[k]) context.report({ node, messageId: "fewer", data: { what, n: n[k], max: max[k] } });
        });
      }
    };
  }
};
