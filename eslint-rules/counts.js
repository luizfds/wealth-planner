// What the ratchet counts in a file's syntax tree (v3.207.0, item 235c): a persist() with no word on what
// changed, and a write straight into `state` (state.x = …, state.x.push(…), delete state.x…). Shared by the
// ESLint rule and the script that writes the baseline.
const MUTATORS = /^(push|splice|pop|shift|unshift|sort|reverse)$/;
function rootIsState(m){ while(m && m.type === "MemberExpression") m = m.object; return !!m && m.type === "Identifier" && m.name === "state"; }
export function isBarePersist(node){
  return node.type === "CallExpression" && node.callee.type === "Identifier" && node.callee.name === "persist" && node.arguments.length === 0;
}
export function isStateWrite(node){
  if(node.type === "AssignmentExpression") return node.left.type === "MemberExpression" && rootIsState(node.left);
  if(node.type === "UpdateExpression") return node.argument.type === "MemberExpression" && rootIsState(node.argument);
  if(node.type === "UnaryExpression") return node.operator === "delete" && rootIsState(node.argument);
  if(node.type === "CallExpression"){ const c = node.callee; return c.type === "MemberExpression" && !c.computed && c.property.type === "Identifier" && MUTATORS.test(c.property.name) && rootIsState(c.object); }
  return false;
}
export function countIn(ast){
  const out = { persist: 0, stateWrites: 0 };
  (function visit(n){
    if(!n || typeof n.type !== "string") return;
    if(isBarePersist(n)) out.persist++;
    if(isStateWrite(n)) out.stateWrites++;
    for(const k in n){ if(k === "parent") continue; const v = n[k]; if(Array.isArray(v)) v.forEach(visit); else if(v && typeof v.type === "string") visit(v); }
  })(ast);
  return out;
}
// Where it applies: the app's wiring, its components and lib — the code that edits on a person's behalf.
export function inScope(file){ return /(^|\/)src\/(app\.js|components\/|lib\/)/.test(file.replace(/\\/g, "/")); }
