// ESLint (v3.201.0, item 232): dev-only, run by `npm run check` and in CI. What it's for: a name used
// that isn't defined or imported (the bug that twice left a page blank behind a green test suite), an
// import nothing uses, and code that can't run. Style is not its job.
import js from "@eslint/js";
import globals from "globals";
import noUnescapedText from "./eslint-rules/no-unescaped-text.js";

export default [
  { ignores: ["vendor/**", "node_modules/**", "prices/**"] },
  js.configs.recommended,
  {
    files: ["src/**/*.js", "sw.js"],
    plugins: { local: { rules: { "no-unescaped-text": noUnescapedText } } },
    languageOptions: { ecmaVersion: 2022, sourceType: "module", globals: { ...globals.browser } },
    rules: {
      "no-unused-vars": ["error", { args: "none", caughtErrors: "none", varsIgnorePattern: "^_" }],
      "no-empty": ["error", { allowEmptyCatch: true }],
      "local/no-unescaped-text": "error",
      // `var x = null;` before a try, or a default that a branch then sets, is how this code reads.
      "no-useless-assignment": "off"
    }
  },
  { files: ["sw.js"], languageOptions: { sourceType: "script", globals: { ...globals.serviceworker } } },
  {
    // Scripts drive a browser: what they hand to page.evaluate runs there, so both sets of globals.
    files: ["tests/**/*.js", "scripts/**/*.mjs", "eslint.config.js", "eslint-rules/**/*.js", "eslint-rules/**/*.mjs"],
    languageOptions: { ecmaVersion: 2022, sourceType: "module", globals: { ...globals.node, ...globals.browser } },
    rules: { "no-unused-vars": ["error", { args: "none", caughtErrors: "none", varsIgnorePattern: "^_" }], "no-empty": ["error", { allowEmptyCatch: true }], "no-useless-assignment": "off" }
  }
];
