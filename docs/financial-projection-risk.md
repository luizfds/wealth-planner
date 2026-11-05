# Projection risk and limitations

Financial projections are **estimates, not forecasts or guarantees**. Results depend on household inputs, future returns, inflation, cash flows and policy.

## Simulation assumptions
- Investment and property annual returns are drawn from lognormal gross-return distributions with configured means and volatility (defaults: 12% investment and 6% property volatility).
- The Monte Carlo model treats annual returns and asset classes as independent; correlated crashes, inflation surprises, income interruption, rental vacancy and maintenance shocks are **not** represented.
- Fixed pseudorandom seeds make runs reproducible, not predictive.
- The 10th–90th percentile range describes the model's simulated outcomes, not a guaranteed real-world interval.
- Zero volatility produces a constant return; invalid assumptions are rejected.

## Deterministic correlated downturn
`correlatedShockPaths` and `correlatedShockSeries` model simultaneous losses in investment and property values for a configurable number of years. Defaults: -25% investment and -12% property in each of the first two years. This is an illustrative stress test, not a probability estimate.

## Remaining work for Issue #212
Expose editable shock assumptions and the resulting path in the Projections UI. Add income interruption, rental vacancy and maintenance-cost stresses with tests. Until those are implemented, users should not interpret Monte Carlo bands as including those risks.

All source-controlled tests use synthetic inputs, never real household backups.