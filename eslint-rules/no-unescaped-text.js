// no-unescaped-text (v3.202.0, item 233): text a person typed, or a bank file brought in — a row's name, a
// payee, a note, an account — must go through escapeAttr()/escapeHtml() before it's joined into HTML.
// A transaction description imported from a statement is data from outside; unescaped, `<img onerror=…>`
// in it would run. The rule looks at string building: in a `"<…" + x + "…"` chain that builds markup, a
// field read straight off a row (`r.what`, `t.description`, `a.name`…) is flagged unless it's inside a call
// (escapeAttr(r.what), fmt(t.amount)…). Numbers and ids aren't on the list, and neither are `label` and
// `title`: across this code those name the app's own tables (report names, tabs, account types).
// When it was added, nothing a person types reached HTML unescaped — this keeps it that way.
const TEXT_FIELDS = new Set(["what", "name", "description", "note", "notes", "payee", "merchant", "memo",
  "account", "category", "person", "who", "text", "reason", "detail", "owner", "lender", "employer", "address", "nickname"]);

function operands(node, out){
  if(node.type === "BinaryExpression" && node.operator === "+"){ operands(node.left, out); operands(node.right, out); }
  else out.push(node);
  return out;
}
function looksLikeMarkup(parts){
  return parts.some(function(p){
    const s = p.type === "Literal" && typeof p.value === "string" ? p.value : p.type === "TemplateLiteral" ? p.quasis.map(q => q.value.raw).join("") : "";
    return /<[a-z/!]|="?$|^"?>/i.test(s);
  });
}
export default {
  meta: { type: "problem", docs: { description: "text from a row must be escaped before it's joined into HTML" }, schema: [],
    messages: { raw: "{{field}} goes into HTML unescaped — wrap it in escapeAttr() (or escapeHtml())." } },
  create(context){
    return {
      BinaryExpression(node){
        if(node.operator !== "+" || (node.parent && node.parent.type === "BinaryExpression" && node.parent.operator === "+")) return;
        const parts = operands(node, []);
        if(!looksLikeMarkup(parts)) return;
        parts.forEach(function(p){
          let m = p;
          // `(r.what || "")` and `r.what || "A line"` are still the raw field.
          while(m.type === "LogicalExpression") m = m.left;
          if(m.type === "ConditionalExpression") return;
          if(m.type === "MemberExpression" && !m.computed && m.property.type === "Identifier" && TEXT_FIELDS.has(m.property.name)){
            context.report({ node: p, messageId: "raw", data: { field: context.sourceCode.getText(m) } });
          }
        });
      }
    };
  }
};
