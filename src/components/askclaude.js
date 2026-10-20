import { escapeAttr } from "../lib/html.js";
import { deanonymiser } from "../calc/aisummary.js";

// ---------------- Ask Claude (v3.98.0) ----------------
//
// An optional written review from Claude, using the person's own Anthropic API key. The key lives
// in this browser's localStorage only — never in state, so never in a backup or a synced file — and
// nothing is sent until "Ask Claude" is pressed. What's sent is calc/aisummary.js's summary, with
// names, places and account names already swapped for labels; "Preview" shows it word for word.
var KEY = "wealthPlanner.anthropicKey", MODEL = "wealthPlanner.anthropicModel", LAST = "wealthPlanner.lastClaudeReview";
export var MODELS = [
  { id: "claude-sonnet-5-5", label: "Sonnet 5.5 — balanced" },
  { id: "claude-opus-5-5", label: "Opus 5.5 — most thorough" },
  { id: "claude-haiku-5-5", label: "Haiku 5.5 — quickest, cheapest" }
];
function ls(){ try { return window.localStorage; } catch(e){ return null; } }
export function aiKey(){ var s = ls(); try { return (s && s.getItem(KEY)) || ""; } catch(e){ return ""; } }
export function setAiKey(v){ var s = ls(); try { if(!s) return; if(v) s.setItem(KEY, v); else s.removeItem(KEY); } catch(e){} }
export function aiModel(){ var s = ls(), v = ""; try { v = (s && s.getItem(MODEL)) || ""; } catch(e){} return MODELS.some(function(x){ return x.id === v; }) ? v : MODELS[0].id; }
export function setAiModel(v){ var s = ls(); try { if(s) s.setItem(MODEL, v); } catch(e){} }
export function lastReview(){ var s = ls(); try { var r = s && s.getItem(LAST); return r ? JSON.parse(r) : null; } catch(e){ return null; } }
export function setLastReview(r){ var s = ls(); try { if(s) s.setItem(LAST, JSON.stringify(r)); } catch(e){} }

export var askUi = { busy: false, preview: "", error: "", question: "" };

export var SYSTEM_PROMPT = "You are reviewing an Australian household's finances for them, from a summary their own planning app produced. " +
  "Write in plain English for the household itself. Be specific: use their numbers, say what each point is worth a year where you can, and order points by how much they matter. " +
  "Apply Australian rules (income tax and Medicare, negative gearing, the purpose test for interest deductibility, offset accounts, concessional super caps and carry-forward, CGT discount, stamp duty, LMI, PAYG withholding variations). " +
  "Cover: whether planned purchases are affordable and resilient, how debt and cash are structured, tax, super, investments and diversification, spending, and protection (emergency fund, insurance) — skipping anything the data can't support. " +
  "Say what you'd want confirmed by an accountant or licensed adviser. Don't repeat the summary back. Use short headings and bullet points; keep it under 700 words. " +
  "End with one line: these are general observations, not personal financial advice.";

export function askBody(summary, question, model){
  return {
    model: model || aiModel(), max_tokens: 2000, system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: summary + (question ? "\n\nTHEIR QUESTION\n" + question : "\n\nGive them your review.") }]
  };
}
// The Messages API, straight from the browser with the person's own key.
export function askClaude(summary, question){
  return fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": aiKey(), "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
    body: JSON.stringify(askBody(summary, question))
  }).then(function(r){
    return r.json().then(function(j){
      if(!r.ok) throw new Error((j && j.error && j.error.message) || ("HTTP " + r.status));
      return (j.content || []).filter(function(c){ return c.type === "text"; }).map(function(c){ return c.text; }).join("\n");
    });
  });
}

// Just enough Markdown for a review: headings, bullets, bold, paragraphs. Everything escaped first.
export function reviewHtml(md){
  var lines = String(md || "").split(/\r?\n/), html = [], list = false;
  function inline(s){ return escapeAttr(s).replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/`([^`]+)`/g, "<code>$1</code>"); }
  function close(){ if(list){ html.push("</ul>"); list = false; } }
  lines.forEach(function(l){
    var h = /^\s{0,3}#{1,4}\s+(.*)$/.exec(l), b = /^\s*[-*•]\s+(.*)$/.exec(l), n = /^\s*\d+[.)]\s+(.*)$/.exec(l);
    if(h){ close(); html.push("<h4>" + inline(h[1]) + "</h4>"); }
    else if(b || n){ if(!list){ html.push("<ul>"); list = true; } html.push("<li>" + inline((b || n)[1]) + "</li>"); }
    else if(!l.trim()){ close(); }
    else { close(); html.push("<p>" + inline(l) + "</p>"); }
  });
  close();
  return html.join("");
}

export function askClaudeHtml(){
  var key = aiKey();
  var last = lastReview();
  var head = '<div class="ai-box" id="askClaudeBox"><div class="ai-head"><b>Ask Claude for a written review</b><span>optional · uses your own API key</span></div>';
  if(!key){
    return head + '<p class="ledger-note">A deeper, free-form read of everything here — the rules above only find what they were written to look for. It needs an Anthropic API key (console.anthropic.com); each review costs a few cents on your account.</p>' +
      '<p class="ledger-note"><b>What leaves this device:</b> a summary of your figures, sent to Anthropic only when you press Ask, with people, the property address, scenarios, accounts and holdings replaced by labels. You can read it first. The key stays in this browser only — it\'s never in a backup.</p>' +
      '<div class="ai-key"><input type="password" autocomplete="off" placeholder="sk-ant-…" data-ai-key aria-label="Anthropic API key"><button type="button" class="btn btn-sm" data-ai-save-key>Save key</button></div></div>';
  }
  return head +
    '<textarea class="ai-q" rows="2" data-ai-q placeholder="Optional — a question, e.g. &quot;Sydney or Melbourne?&quot; or &quot;What should we do before 30 June?&quot;" aria-label="Your question">' + escapeAttr(askUi.question) + '</textarea>' +
    '<div class="ai-actions"><select data-ai-model aria-label="Model">' + MODELS.map(function(x){ return '<option value="' + x.id + '"' + (x.id === aiModel() ? ' selected' : '') + '>' + escapeAttr(x.label) + '</option>'; }).join("") + '</select>' +
      '<button type="button" class="btn btn-sm btn-ghost" data-ai-preview>Preview what\'s sent</button>' +
      '<button type="button" class="btn btn-sm btn-primary" data-ai-ask' + (askUi.busy ? ' disabled' : '') + '>' + (askUi.busy ? 'Thinking…' : 'Ask Claude') + '</button>' +
      '<button type="button" class="link-btn ai-forget" data-ai-forget>Forget key</button></div>' +
    (askUi.preview ? '<details class="ai-preview" open><summary>Exactly what would be sent</summary><pre>' + escapeAttr(askUi.preview) + '</pre></details>' : '') +
    (askUi.error ? '<p class="ai-error">' + escapeAttr(askUi.error) + '</p>' : '') +
    (last ? '<div class="ai-review"><div class="ai-review-meta">Review from ' + escapeAttr(last.at || "") + (last.question ? ' — “' + escapeAttr(last.question) + '”' : '') + ' · labels shown as your own names here</div>' + reviewHtml(deanonymiser()(last.text)) + '</div>' : '') +
  '</div>';
}
