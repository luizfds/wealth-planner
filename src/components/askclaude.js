import { escapeAttr } from "../lib/html.js";
import { deanonymiser } from "../calc/aisummary.js";

// ---------------- Ask Claude (v3.98.0) ----------------
//
// An optional written review from Claude, using the person's own Anthropic API key. The key lives
// in sessionStorage only (cleared when the browser session ends), never in a backup — and
// nothing is sent until "Ask Claude" is pressed. What's sent is calc/aisummary.js's summary, with
// identifying free-text fields excluded; "Preview" shows it word for word.
var KEY = "wealthPlanner.anthropicKey", MODEL = "wealthPlanner.anthropicModel", LAST = "wealthPlanner.lastClaudeReview";
export var MODELS = [
  { id: "claude-sonnet-5-5", label: "Sonnet 5.5 — balanced" },
  { id: "claude-opus-5-5", label: "Opus 5.5 — most thorough" },
  { id: "claude-haiku-5-5", label: "Haiku 5.5 — quickest, cheapest" }
];
function ls(){ try { return window.localStorage; } catch(e){ return null; } }
function ss(){ try { return window.sessionStorage; } catch(e){ return null; } }
// Existing persistent keys are removed rather than silently migrated to another storage lifetime.
// Users who previously saved a key must enter it again for the current browser session.
function clearLegacyKey(){ var s = ls(); try { if(s) s.removeItem(KEY); } catch(e){} }
export function aiKey(){ clearLegacyKey(); var s = ss(); try { return (s && s.getItem(KEY)) || ""; } catch(e){ return ""; } }
export function setAiKey(v){ clearLegacyKey(); var s = ss(); try { if(!s) return; if(v) s.setItem(KEY, v); else s.removeItem(KEY); } catch(e){} }
export function aiModel(){ var s = ls(), v = ""; try { v = (s && s.getItem(MODEL)) || ""; } catch(e){} return MODELS.some(function(x){ return x.id === v; }) ? v : MODELS[0].id; }
export function setAiModel(v){ var s = ls(); try { if(s) s.setItem(MODEL, v); } catch(e){} }
export function lastReview(){ var s = ls(); try { var r = s && s.getItem(LAST); return r ? JSON.parse(r) : null; } catch(e){ return null; } }
export function setLastReview(r){ var s = ls(); try { if(s) s.setItem(LAST, JSON.stringify(r)); } catch(e){} }

export var askUi = { busy: false, preview: "", error: "", question: "", pasteOpen: false, approvalPending: false };

// A cancelled review must clear both the displayed payload and the consent state.
export function cancelAiApproval(){
  askUi.preview = "";
  askUi.approvalPending = false;
  askUi.error = "";
}


// v3.99.0: one standard shape for the answer, whichever AI writes it — so a review pasted back from
// any assistant reads the same here, and two reviews can be compared section by section.
export var REVIEW_FORMAT = [
  "## In short — three bullets: the most important things to know.",
  "## Priorities — a numbered list, most valuable first. Each item: **what to do** — why, from their numbers — what it's worth a year if it can be put in dollars — who should confirm it (accountant, broker, adviser) if anyone.",
  "## Buying a home — affordability, how the deposit is funded, resilience to rate rises and to one income stopping. Skip if no purchase is planned.",
  "## Tax and super",
  "## Debt and cash — loan structure, offsets, what's deductible.",
  "## Spending",
  "## Investments — diversification, what to simplify.",
  "## Protection — emergency fund, insurance, anything the data can't show.",
  "## Questions to take to a professional — a short list."
].join("\n");
export var SYSTEM_PROMPT = "You are reviewing an Australian household's finances for them, from a summary their own planning app produced. " +
  "Write in plain English for the household itself. Be specific: use their numbers, say what each point is worth a year where you can, and order points by how much they matter. " +
  "Apply Australian rules (income tax and Medicare, negative gearing, the purpose test for interest deductibility, offset accounts, concessional super caps and carry-forward, CGT discount, stamp duty, LMI, PAYG withholding variations). " +
  "Skip anything the data can't support, and say what you'd want confirmed by an accountant or licensed adviser. Don't repeat the summary back. Keep it under 800 words. " +
  "The summary contains household aggregates only, not individual people, properties, loans, accounts or scenarios. It is pseudonymised, not anonymous: financial combinations may still identify a household. Do not infer missing individual details. " +
  "Answer in Markdown using exactly these headings, in this order:\n" + REVIEW_FORMAT + "\n" +
  "End with one line: these are general observations, not personal financial advice.";

// The whole thing for any assistant, as one paste: what to do, how to answer, the figures, their question.
// Only the precomputed numeric summary and fixed instructions may leave the app.
// Free-form questions can contain names, addresses or account identifiers and are local-only.
export function copyPrompt(summary, _question){
  return "Please review my household's finances.\n\n" +
    "HOW TO ANSWER\n" + SYSTEM_PROMPT + "\n\n" +
    "MY FINANCES (approved aggregate figures; no free-text questions)\n" + summary + "\n";
}

export function askBody(summary, _question, model){
  return {
    model: model || aiModel(), max_tokens: 2000, system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: summary + "\n\nGive the household a general review of these figures." }]
  };
}
// The Messages API, straight from the browser with the person's own key.
// Fail closed: only send a payload whose exact bytes were previewed and approved.
// The caller must supply the approved serialized body; do not reconstruct it after consent.
export function askClaude(summary, question, approvedBody){
  var expected = JSON.stringify(askBody(summary, question), null, 2);
  if(typeof approvedBody !== "string" || approvedBody !== expected)
    return Promise.reject(new Error("AI request changed or was not approved; review the preview again"));
  return fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": aiKey(), "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
    body: approvedBody
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
  var q = '<p class="ledger-note help">Privacy-first: personal questions and free-text notes are not included in AI requests. The preview shows the exact request. Even aggregate financial figures may be identifying.</p>';
  // v3.99.0: any assistant, no key — copy the prompt, paste the answer back.
  var anyAi = '<div class="ai-any"><div class="ai-sub">Any AI — no key needed</div>' +
    '<p class="ledger-note help">Copies a fixed review prompt and aggregated financial figures without free-text questions. Review the preview before copying or sharing with any AI. Paste its answer back below and it\'s shown here, with your own names.</p>' +
    '<div class="ai-actions"><button type="button" class="btn btn-sm btn-ghost" data-ai-preview>' + (askUi.preview ? "Hide preview" : "Preview what's copied") + '</button>' +
      '<button type="button" class="btn btn-sm" data-ai-copy>Copy for any AI</button></div>' +
    (askUi.pasteOpen
      ? '<textarea class="ai-paste field-control" rows="6" data-ai-paste placeholder="Paste the assistant\'s answer here" aria-label="The assistant\'s answer"></textarea>' +
        '<div class="ai-actions"><input type="text" class="ai-source field-control" data-ai-source placeholder="Which AI? (optional)" aria-label="Which assistant wrote it"><button type="button" class="btn btn-sm" data-ai-save-paste>Save the answer</button><button type="button" class="link-btn" data-ai-paste-toggle>Cancel</button></div>'
      : '<button type="button" class="link-btn ai-paste-open" data-ai-paste-toggle>Paste an answer back →</button>') +
  '</div>';
  var claude = key
    ? '<div class="ai-claude"><div class="ai-sub">Or ask Claude directly — with your API key</div>' +
        '<div class="ai-actions"><select class="field-control" data-ai-model aria-label="Model">' + MODELS.map(function(x){ return '<option value="' + x.id + '"' + (x.id === aiModel() ? ' selected' : '') + '>' + escapeAttr(x.label) + '</option>'; }).join("") + '</select>' +
        '<button type="button" class="btn btn-sm btn-primary" data-ai-ask' + (askUi.busy ? ' disabled' : '') + '>' + (askUi.busy ? 'Thinking…' : askUi.approvalPending ? 'Confirm & send to Claude' : 'Review before sending') + '</button>' +
        '<button type="button" class="link-btn ai-forget" data-ai-forget>Forget key</button></div></div>'
    : '<details class="ai-claude"><summary>Or ask Claude directly, with an API key</summary>' +
        '<p class="ledger-note">Sends the same summary to Anthropic when you press Ask, and shows the answer here — no copying. It needs an Anthropic API key (console.anthropic.com); each review costs a few cents on your account. The key is kept for this browser session only, not in a backup. You may need to enter it again after closing the browser.</p>' +
        '<div class="ai-key"><input class="field-control" type="password" autocomplete="off" placeholder="sk-ant-…" data-ai-key aria-label="Anthropic API key"><button type="button" class="btn btn-sm" data-ai-save-key>Use key for this session</button></div></details>';
  return '<div class="ai-box" id="askClaudeBox"><div class="ai-head"><b>A written review from an AI</b><span>optional · nothing is sent unless you choose to</span></div>' +
    q + anyAi + claude +
    (askUi.preview ? '<details class="ai-preview" open><summary>Exactly what would be copied or sent</summary><pre>' + escapeAttr(askUi.preview) + '</pre><button type="button" class="btn btn-sm btn-ghost" data-ai-cancel>Cancel sharing</button></details>' : '') +
    (askUi.error ? '<p class="ai-error">' + escapeAttr(askUi.error) + '</p>' : '') +
    (last ? '<div class="ai-review"><div class="ai-review-meta">Review from ' + escapeAttr(last.at || "") + (last.source ? ' by ' + escapeAttr(last.source) : '') + (last.question ? ' — “' + escapeAttr(last.question) + '”' : '') + ' · labels shown as your own names here</div>' + reviewHtml(deanonymiser()(last.text)) + '</div>' : '') +
  '</div>';
}
