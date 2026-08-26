export function escapeAttr(s){ return String(s == null ? "" : s).replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;"); }
export function slug(s){ return s.replace(/[^a-z0-9]/gi, ""); }
