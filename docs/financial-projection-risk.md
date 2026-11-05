# Projection risk and limitations

Financial projections are **estimates, not forecasts or guarantees**. They depend on household inputs, assumptions about future returns and inflation, and the cash-flow model. They do not establish the probability of a real-world outcome.

## Simulation assumptions

- Investment and property annual returns use independent lognormal **gross-return** distributions. The configured return is the arithmetic mean of the simulated annual return; the volatility is its annual standard deviation.
- Defaults: **12% investment volatility** and **6% property volatility**, unless overridden in projection settings. The expected investment/property growth rates come from the selected projection assumptions.
- Annual returns are sampled independently across years and between investment and property assets. The simulation does not model correlations, changing volatility, inflation surprises or other economic regime changes.
- The Monte Carlo net-worth band uses **300 runs** by default and a fixed pseudorandom seed (**20260701**). Retirement odds use **1,000 runs** by default and seed **19640701**. Fixed seeds support repeatability, not prediction.
- The **10th–90th percentile** band means that 80% of simulated endpoints under these specific assumptions fall within the interval. It is not a confidence interval, a promise, or an assessment of real-world likelihood.
- Zero volatility yields constant annual returns. Invalid return-path inputs are rejected. Negative returns can occur, but a single annual investment return cannot be less than -100%.
- The simulation bands **do not include** the separate downside overlays below. Turning on a stress overlay does not change the simulated distribution or its percentiles.

## Illustrative downside scenarios in Plan → Projections

The stress controls are **session-only** and do not change saved household or scenario inputs.

1. **Correlated market downturn:** simultaneous negative investment and property annual returns for the chosen duration (defaults: -25% investment and -12% property, for two years). After the stress period, the engine resumes the normal scenario return assumptions.
2. **Cash-flow shock:** a monthly net income reduction and monthly vacancy shortfall for the selected number of years, plus a one-off repair expense in the first stressed year. Values are simplified net cash impacts, not a tax or benefits calculation.
3. **Combined downside:** when both stress options are enabled, a third series applies the market and cash shocks together. Each stress retains its own duration.

All overlays are deterministic, illustrative scenarios, **not probability estimates**. They appear in the chart, milestones and CSV export but are excluded from the main ranking of saved financial plans.

## Interpretation and limitations

- Compare baseline scenarios to make decisions; use overlays to explore sensitivity to adverse assumptions, not to rank a stressed copy as a separate plan.
- Check whether income, spending, debt, asset values and return assumptions are current. Missing or inaccurate inputs can overwhelm the precision suggested by dollar outputs.
- The model does not estimate tax consequences of job loss, vacancy or repairs, insurance recoveries, emergency borrowing, asset sales or correlated inflation/interest-rate shocks.
- A temporary market loss does not imply that markets must recover; returning to the configured average after a shock is a **model assumption**, not a forecast.
- Model outcomes are sensitive to starting balances, cash flow, chosen horizon, volatility and shock severity. Explore more than one set of assumptions before relying on a comparison.

## Tests and privacy

Synthetic regression tests cover seeded reproducibility, zero-volatility behaviour, correlated multi-year losses, cash-flow inputs, combined shocks, and recovery from a finite return override. No real household backup is included in source-controlled tests.
