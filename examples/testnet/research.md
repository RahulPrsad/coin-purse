# Monsoon research

# Research Note — Wetter Monsoon Forecast vs. Karnataka Rice & Maize Mandi Prices

**Prepared for:** Arjun
**Scope:** Directional, not causal. All purchased inputs are **synthetic fixtures**, not live observations.

## 1. Evidence purchased (with endpoint IDs)

| Evidence | Endpoint ID | What it says (synthetic) |
|---|---|---|
| Rainfall forecast | `rainfall` | Bengaluru monsoon fixture: +18% rainfall anomaly for 2026-06, *medium* confidence; "above-normal rain may improve sowing but disrupt transport." |
| Mandi prices | `prices` | Karnataka mandi fixture (INR/quintal): rice 3100 → 3020; maize 2250 → 2180. Caveat: "two illustrative observations cannot establish causation." |
| Condition summary | `satellite` | Synthetic satellite summary: positive vegetation anomaly, above-baseline soil moisture; "no actual satellite product was fetched." |

*No policy/budget refused here — the three requested sources were purchased and returned OK. No endpoint was declined.*

## 2. What the (synthetic) signals suggest — directional only
- **Yield/availability channel (bearish on price):** above-normal rain + higher soil moisture + positive vegetation anomaly are *typically* associated with better sowing and yields, which can push mandi prices **down**. The fixture's "after" prices are indeed lower for both crops (rice −80, maize −70 INR/qtl).
- **Transport/quality channel (bullish risk):** the rainfall fixture itself flags that heavy rain can disrupt transport and raise post-harvest loss/quality risk, which would push prices **up**, partly offsetting the yield effect.
- Net qualitative implication: a *wetter* forecast is **ambiguous-to-slightly-bearish** on short-run mandi prices, with the transport/quality disruption being the main upside risk.

## 3. Corners to hold (epistemics)
1. **These are synthetic fixtures, explicitly not live data.** The rice/maize moves shown are illustrative and **do not establish causation** (the prices endpoint says so directly). I will not present them as observed outcomes or as proof that a wet monsoon lowered prices.
2. **Confidence is medium** on the rainfall anomaly; a ±18% figure at medium confidence is not a firm forecast.
3. **No satellite product was actually retrieved** — the `satellite` return is a summary, not imagery or a measured index.
4. **Small/N=2 evidence base:** one before, one after. Direction can be noted; magnitude and significance cannot.
5. **Correlation ≠ causation:** even a verified price drop could stem from MSP, arrivals, demand, or logistics rather than the monsoon.

## 4. Missing evidence (not purchased / not available in scope)
- Arrivals/volume data (mandi trade stats) — needed to link wetness → supply.
- MSP / policy and subsidy context that independently move mandi prices.
- Transport-impact indicators (road closure days, grain spoilage rates) to quantify the upside-risk channel.
- A genuine satellite/NRT rainfall or soil-moisture product (the fixture disclaims one).
- Historical multi-year panels to separate weather effect from trend.
- Weather **realization** data (forecast ≠ what actually fell).

## 5. Bottom line
A wetter monsoon forecast is *plausibly* mildly bearish on Karnataka rice and maize mandi prices via improved sowing/yields, with concurrent transport and quality-disruption risk that could partially offset it. **This is a directional hypothesis from synthetic fixtures — treat as illustrative, not causal, and confirm with live arrivals, MSP context, and verified rainfall/soil-moisture products before acting.**

*Sources: `rainfall`, `prices`, `satellite` (all synthetic fixtures).*
