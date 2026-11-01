// stylelint (v3.201.0, item 232): dev-only, run by `npm run check` and in CI. Mistakes, not taste:
// an unknown property or unit, a duplicate property, a rule that can never apply, a misspelled value.
export default {
  rules: {
    "property-no-unknown": true,
    "unit-no-unknown": true,
    "color-no-invalid-hex": true,
    "function-calc-no-unspaced-operator": true,
    "declaration-block-no-duplicate-properties": [true, { ignore: ["consecutive-duplicates-with-different-values"] }],
    "declaration-block-no-shorthand-property-overrides": true,
    "selector-pseudo-class-no-unknown": true,
    "selector-pseudo-element-no-unknown": true,
    "selector-type-no-unknown": [true, { ignore: ["custom-elements"] }],
    "media-feature-name-no-unknown": true,
    "at-rule-no-unknown": true,
    "no-invalid-double-slash-comments": true,
    "block-no-empty": true,
    "string-no-newline": true,
    "custom-property-no-missing-var-function": true,
    "keyframe-declaration-no-important": true
    // `!important` stays allowed until the stylesheets move into cascade layers (item 238): the phone
    // floors in projections.css rely on it to win over component rules today.
  }
};
