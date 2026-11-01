// The local rules check themselves (npm run check): a rule that silently stops matching is worse than none.
import { RuleTester } from "eslint";
import noUnescapedText from "./no-unescaped-text.js";

new RuleTester({ languageOptions: { ecmaVersion: 2022, sourceType: "module" } }).run("no-unescaped-text", noUnescapedText, {
  valid: [
    "var h = '<b>' + escapeAttr(t.what) + '</b>';",
    "var h = '<b>' + fmtCurrency0.format(t.amount) + '</b>';",
    "var s = 'Paid ' + t.what;",
    "var h = '<option value=\"' + t.key + '\">' + t.label + '</option>';",
    "var h = '<span>' + (t.what ? escapeAttr(t.what) : 'A line') + '</span>';"
  ],
  invalid: [
    { code: "var h = '<b>' + t.what + '</b>';", errors: [{ messageId: "raw" }] },
    { code: "var h = '<td>' + (row.description || '') + '</td>';", errors: [{ messageId: "raw" }] },
    { code: "var h = '<i title=\"' + a.name + '\"></i>';", errors: [{ messageId: "raw" }] },
    { code: "var h = `<li>` + p.payee + '</li>';", errors: [{ messageId: "raw" }] }
  ]
});
console.log("eslint-rules: self-test passed");
