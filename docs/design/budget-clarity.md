# Budget clarity (#336–#338)

Cash flow leads with regular monthly income, spending and leftover. Income, spending groups/loans and
annual income each fold independently, closed by default. Every old statement value remains available.
“Running balance” means the cumulative balance after that row, carried from income through spending
and finally annual income averaged monthly. Annual averages are explicitly distinguished from a normal
month. The shared Home savings explanation keeps the full statement.

Scenario comparison shows baseline and draft side by side, stacked on phones. Needs and Wants use the
existing row classifications and colours; home/investment loan repayments count as Needs once. Other
spending/savings allocations and unclassified changes are explicit, not discarded. Regular leftover is
shown alongside the categories. Amounts and shares of after-tax income accompany each category, with
absolute and percentage-point changes. Annual income is excluded from regular income/buffer; the annual
average is available separately. Negative credits and deficits stay visible as text, never negative pie
slices. The view reconciles to scenarioTotals and changes no financial calculation.

All fixtures and screenshots use invented data. Before/after mobile screenshots are in [before](images/budget-before-390.png) and
[after](images/budget-after-390.png), with the complete screen comparison in the CI artifact; original user screenshots are never copied into this repository.

## Take-home for a Needs target (#389)

Under the comparison, a block shows what take-home it would take for Needs to be at most the household's target share, for the baseline and the scenario. It also shows how much more the scenario needs than today. `calc/needstarget.js` does the arithmetic on `scenarioBudgetComposition()`'s own Needs and regular take-home, so it reconciles with the rings above it: annual income is left out, and loan repayments count as Needs once.

- **The target** is one household setting, `state.needsTarget` (migration step 28). It defaults to 50, the Needs part of Home's 50/30/20. It's changed in the block or in Settings → Preferences → Needs and take-home, saved only as a number from 1 to 100; anything else is said beside the field and not saved (#263).
- **The figures.** Required take-home = Needs ÷ target. "More" is the gap, never below $0, with the increase as a share of today's take-home.
- **Edge cases are said in words:** within the target, no take-home, no Needs, and Needs above the whole take-home (what it takes just to cover them).
- **It's take-home, after tax.** The note says a pay rise before tax would have to be larger, that Needs stay as they are, and that this is a target share, not a spending recommendation.

The `needstarget` journey covers the figures against the comparison's, a change in the block and in Preferences, an out-of-range value, and 320/390/768/1280px in both themes; `NEEDS_A11Y=1` adds axe scans.

