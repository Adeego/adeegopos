# RESTOCK — Replacing the old restock equation with Equation 5.2 (full implementation guide)

This guide explains how to replace the **current restock quantity calculation** inside `calculateRestock(...)` with the **Equation 5.2** framework you generated (60-day history, **seasonality normalization**, **weighted moving average + trend**, and **safety stock that includes both demand variability and variable lead time 1–3 days**).

It is written to be directly implementable in your existing Node/Electron + CouchDB/PouchDB style code.

---

## 0) Why the old equation must be replaced (what’s wrong / missing)

Your current computation:

- Blends `μw` (recent mean over `period`) and `μh` (historical mean) via `BETA`.
- Uses `σ * sqrt(period)` for uncertainty.
- Uses a single constant `SEASONAL_FACTOR` (1%).
- **Does not subtract current inventory (or inventory position)** when computing order quantity.

Key gaps relative to the requirements:

- **Seasonality is not modeled correctly**
  - Requirement: the Week 1 and Week 4 uplift should be **estimated from the last 60 days** (i.e., by how many percent sales increased during Week 1 and Week 4 vs Weeks 2 and 3 for the last 2 months present in the data).
  - Old code: a flat `+1%` uplift.

- **Trend is not modeled**
  - Requirement: account for increasing/decreasing sales trends.
  - Old code: only mean blending; no explicit trend slope.

- **Variable lead time (1–3 days) is not integrated**
  - Requirement: lead time uncertainty must affect safety stock.
  - Old code: assumes a single horizon = `period`.

- **Daily series is incomplete / unstable**
  - The code uses `Object.values(dailySales)` which:
    - drops days with zero sales (important!)
    - can be unordered by date
  - The new method requires an ordered **60-day vector** including zeros.

Equation 5.2 fixes all of these and produces a balanced system that avoids both stockouts and overstock.

---

## 1) Target behavior (what the new system will do)

For each product:

1. Build a **60-day daily demand series** (including zero-sale days).
2. Estimate the **monthly week pattern** (Week 1 & 4 vs Week 2 & 3) from the last 60 days, then apply it using normalized seasonality factors.
3. De-seasonalize history and compute:
   - level \(\mu\) via **weighted moving average**
   - trend \(g\) via **two WMAs** (short vs long)
4. Forecast demand for the **protection horizon** \(H = R + \mu_L\).
5. Compute safety stock:
   \[
   SS = z\sqrt{H\sigma_D^2 + (\bar{d})^2\sigma_L^2}
   \]
6. Compute order quantity using **inventory position**:
   \[
   Q = \max(0,\; (\hat{D}_H + SS) - IP)
   \]
7. Special handling for perishables: add a **waste multiplier**.

---

## 2) Mapping old variables to Equation 5.2 variables

Old code concept | New (Equation 5.2) concept
---|---
`period` | Split into `R` (review period) and `C` (coverage objective). You will typically set `R` by product type.
`μw`, `μh`, `BETA` | Replace with WMA level `μ` plus trend `g` derived from WMA short/long windows.
`σ * sqrt(period)` | Replace with \(\sigma_H\) that includes both demand uncertainty and lead time uncertainty.
`SEASONAL_FACTOR` | Replace with normalized seasonal multipliers derived from the last 60 days (Week 1/4 high, Week 2/3 mid) applied *per day*.
`restockQuantity` | Replace with `Q` computed from order-up-to target and `IP`.

---

## 3) Required configuration inputs (add to product or choose defaults)

You can implement Equation 5.2 even if some fields are missing by using safe defaults.

### 3.1 Product classification
Your products are already categorized. Use your existing categories as follows:

Product category | Stock calculation behavior | Default ordering cadence
---|---|---
`Primary` | Calculate restock using Equation 5.2 | Weekly-style cadence
`Secondary` | Calculate restock using Equation 5.2 | Monthly-style cadence
`Perishable` | Calculate restock using Equation 5.2 + waste factor | Daily-style cadence
`Drinks` | Calculate restock using Equation 5.2 | Treat like `Primary` unless you decide otherwise
`Reserve` | **Skip stock calculations** | N/A

Important:

- In the code examples below, I’ll refer to the category field as `product.category`. If your schema uses a different field name, swap it in.

### 3.2 Review period `R` and coverage `C`
You already store the stock period in `product.restockPeriod`.

Use it as the primary driver of coverage:

- `C = product.restockPeriod` (coverage days)

For non-perishables (`Primary`, `Secondary`, `Drinks`), the simplest and most consistent implementation is:

- `R = C` (review period equals coverage period)

Defaults if `product.restockPeriod` is missing:

- `Primary`: `C=7`, `R=7`
- `Secondary`: `C=30`, `R=30`
- `Drinks`: `C=7`, `R=7`

For `Perishable`, enforce daily ordering:

- `R = 1`
- `C = product.restockPeriod` (recommend keeping `C` at 1–2)

### 3.3 Lead time distribution
Requirement says: variable lead time 1–3 days.

If no supplier-specific data exists, assume uniform `L ∈ {1,2,3}`:

- `μ_L = 2`
- `σ_L ≈ 0.816`

If you *do* store supplier performance, compute `μ_L` and `σ_L` from actual delivery timestamps.

### 3.4 Service factor `z` (balanced)
Recommended:

- Non-perishables: `z = 1.28` (balanced)
- Perishables: `z = 1.04` to `1.28` (to avoid waste)

Important: your old comment `// Service level 99%` does not match `Z_SCORE=1.32` (1.32 is closer to ~90%). With Equation 5.2, choose `z` explicitly and document it.

### 3.5 Waste rate (perishables only)
Add:

- `product.wasteRate` (e.g., `0.05` for 5%)

Waste multiplier:

\[
\alpha = \frac{1}{1-p_w}
\]

---

## 4) Implementation steps (drop-in sequence)

### Step 1 — Build an ordered 60-day daily sales vector (including zeros)

**Do not** use `Object.values(dailySales)`.

Instead:

- Create a date list of exactly 60 days: `dates[0..59]`.
- For each date, sum sales quantity into `dailySalesByDate[YYYY-MM-DD]`.
- Produce `S_t` in chronological order with zeros when missing.

This is mandatory for correct standard deviation, trend detection, and seasonality alignment.

### Step 2 — Estimate and compute normalized seasonality factor per day (from the last 60 days)

Instead of using a fixed uplift (like 40%), estimate the uplift from the last 60 days by comparing Week 1 & 4 vs Week 2 & 3 for the last **two calendar months** present in the data.

A practical week-of-month bucket:

- days 1–7 → Week 1
- days 8–14 → Week 2
- days 15–21 → Week 3
- days 22–end → Week 4

Estimate uplift and normalize:

- For each of the last two calendar months in the 60-day window, compute:
  - \(\bar{S}^{(hi)}\): average daily sales for Week 1 & 4 days
  - \(\bar{S}^{(mid)}\): average daily sales for Week 2 & 3 days
- Monthly uplift: \(u_p = \bar{S}^{(hi)} / \bar{S}^{(mid)} - 1\) (if \(\bar{S}^{(mid)} > 0\), else 0)
- Combine the two months into `u` (weighted by the number of mid-week days)
- Convert to normalized factors:
  - raw multipliers: \(m_{hi}=1+u\), \(m_{mid}=1\)
  - normalize: \(\overline{m}=(m_{hi}+m_{mid})/2\)
  - factors: \(s_{hi}=m_{hi}/\overline{m}\), \(s_{mid}=m_{mid}/\overline{m}\)

Then for any date:

- `s_t = seasonalityFactor(date_t, { sHi, sMid })`
- de-seasonalize: `X_t = S_t / s_t`

### Step 3 — Compute WMA level `μ`

Pick parameters:

- `λ` in `[0.90, 0.97]` (typical: `0.94`)
- `N` in `[28, 42]` (typical: `42`, bounded by 60)

\[
\mu = \frac{\sum_{i=1}^{N} \lambda^{i-1} X_{60-i+1}}{\sum_{i=1}^{N} \lambda^{i-1}}
\]

### Step 4 — Compute trend `g` via short vs long WMA

Choose:

- `N_s = 14`
- `N_l = 42`

Compute `μ_s` and `μ_l` using the same WMA formula.

\[
 g = \frac{\mu_s - \mu_l}{(N_l - N_s)/2}
\]

### Step 5 — Forecast future daily demand with seasonality

Define protection horizon:

\[
H = R + \mu_L
\]

For each future day `d = 1..H`:

- baseline: \(\hat{X}_d = \max(0,\mu + g\cdot d)\)
- seasonalize: \(\hat{D}_d = \hat{X}_d\, s^{(f)}_d\)

Total:

\[
\hat{D}_H = \sum_{d=1}^{H} \hat{D}_d
\]

### Step 6 — Compute demand variability `σ_D` from residuals

Compute residuals on de-seasonalized history:

\[
 e_t = X_t - (\mu + g\cdot k_t)
\]

Then:

- `σ_D = stdev(e_t)`

(Using residuals avoids inflating `σ` due to the known seasonality pattern.)

### Step 7 — Compute safety stock with variable lead time

Average daily forecast over horizon:

\[
\bar{d} = \frac{\hat{D}_H}{H}
\]

Combined uncertainty:

\[
\sigma_H = \sqrt{H\sigma_D^2 + (\bar{d})^2\sigma_L^2}
\]

Safety stock:

\[
SS = z\,\sigma_H
\]

### Step 8 — Compute inventory position `IP`

Equation 5.2 uses:

\[
IP = OH + OO - BO
\]

Your current code only uses `product.stock` as `OH`.

To fully implement:

- Ensure you can compute `OO` (on-order units). Options:
  - store `product.onOrder` and update when purchase orders are placed/received
  - compute from purchase order docs in the DB (`type: 'po'`, states like `Open`, `Received`)

If you cannot get `OO` yet, set `OO=0` (works but is less accurate).

### Step 9 — Compute order quantity (non-perishables)

Order-up-to target:

\[
T = \hat{D}_H + SS
\]

Order quantity:

\[
Q = \max(0,\, T - IP)
\]

Round appropriately:

- `Q_int = Math.ceil(Q)`

### Step 10 — Perishable adjustment for waste

For perishables, order for coverage `C` (often 1–2 days) and apply waste rate `p_w`:

\[
\alpha = \frac{1}{1-p_w}
\qquad
Q_p = \max(0,\, \alpha(\hat{D}_C + SS_C) - IP)
\]

Where `SS_C` is computed with `H` replaced by `C`:

\[
\sigma_C = \sqrt{C\sigma_D^2 + (\bar{d}_C)^2\sigma_L^2},
\quad
SS_C = z_p\sigma_C
\]

---

## 5) Reference implementation outline (JS) — replace only the math block

The goal is to replace the section that currently computes:

- `μw`, `μh`, `σ`, and `restockQuantity`

with a new block computing:

- `μ`, `g`, `σ_D`, `Dhat`, `SS`, `IP`, `Q`

Below is a **reference structure** you can adapt (names chosen to be close to your current code). It is intentionally modular so you can unit test each piece.

### 5.1 Helper: date utilities

```js
function toYmd(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function weekOfMonthBucket(date) {
  const day = date.getDate();
  if (day <= 7) return 1;
  if (day <= 14) return 2;
  if (day <= 21) return 3;
  return 4;
}

function monthKey(date) {
  // YYYY-MM
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function seasonalityFactor(date, factors) {
  const w = weekOfMonthBucket(date);
  return (w === 1 || w === 4) ? factors.sHi : factors.sMid;
}

function estimateSeasonalityFactorsFromHistory(dates, S) {
  // Estimate Week 1/4 uplift u from the last 60 days using the last two calendar months in the data.
  // Returns normalized factors where average across the 4 week buckets is 1.
  const byMonth = new Map();

  for (let i = 0; i < dates.length; i++) {
    const d = dates[i];
    const mk = monthKey(d);
    if (!byMonth.has(mk)) byMonth.set(mk, { hiSum: 0, hiN: 0, midSum: 0, midN: 0 });
    const b = byMonth.get(mk);
    const w = weekOfMonthBucket(d);
    const v = S[i] ?? 0;
    if (w === 1 || w === 4) {
      b.hiSum += v;
      b.hiN += 1;
    } else {
      b.midSum += v;
      b.midN += 1;
    }
  }

  const months = Array.from(byMonth.keys()).sort();
  const lastTwo = months.slice(-2);
  if (lastTwo.length === 0) {
    return { sHi: 1, sMid: 1 };
  }

  let num = 0;
  let den = 0;

  for (const mk of lastTwo) {
    const b = byMonth.get(mk);
    const midAvg = b.midN > 0 ? (b.midSum / b.midN) : 0;
    const hiAvg = b.hiN > 0 ? (b.hiSum / b.hiN) : 0;
    const u_p = midAvg > 0 ? (hiAvg / midAvg - 1) : 0;

    // Weight by number of mid-week days to stabilize the ratio.
    num += b.midN * u_p;
    den += b.midN;
  }

  const u = den > 0 ? (num / den) : 0;

  const mHi = 1 + u;
  const mMid = 1;
  const mBar = (mHi + mMid) / 2;

  // Fallback if something degenerate happens.
  if (!isFinite(mBar) || mBar <= 0) {
    return { sHi: 1, sMid: 1 };
  }

  return { sHi: mHi / mBar, sMid: mMid / mBar };
}
```

### 5.2 Helper: build ordered 60-day demand series

```js
function build60DaySeries({ salesDocs, productId, startDate, endDate }) {
  // Build a map date->units
  const byDate = Object.create(null);
  for (const sale of salesDocs) {
    const date = sale.createdAt.split('T')[0];
    const item = sale.items?.find(i => i.productId === productId);
    const qty = item?.quantity;
    if (!qty) continue;
    byDate[date] = (byDate[date] || 0) + qty;
  }

  // Build an ordered array including zeros
  const dates = [];
  const S = [];

  const start = new Date(startDate);
  const end = new Date(endDate);

  for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
    dates.push(new Date(d));
    const ymd = toYmd(d);
    S.push(byDate[ymd] || 0);
  }

  return { dates, S };
}
```

### 5.3 Helper: weighted moving average and trend

```js
function wmaRecent(values, lambda, N) {
  const n = Math.min(N, values.length);
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const v = values[values.length - 1 - i]; // most recent first
    const w = Math.pow(lambda, i);
    num += w * v;
    den += w;
  }
  return den === 0 ? 0 : num / den;
}

function trendFromTwoWmas(values, lambda, Ns, Nl) {
  const muS = wmaRecent(values, lambda, Ns);
  const muL = wmaRecent(values, lambda, Nl);
  const denom = (Nl - Ns) / 2;
  if (denom <= 0) return 0;
  return (muS - muL) / denom;
}

function stdev(values) {
  if (!values.length) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const v = values.reduce((acc, x) => acc + Math.pow(x - mean, 2), 0) / values.length;
  return Math.sqrt(v);
}
```

### 5.4 Core compute: Equation 5.2 order quantity

```js
function leadTimeStatsUniform1to3() {
  return { muL: 2, sigmaL: Math.sqrt(2 / 3) };
}

function getCadenceParams(product) {
  // Adjust based on your actual schema.
  // This guide assumes your category lives at `product.category` and is one of:
  // Primary | Secondary | Perishable | Drinks | Reserve
  const category = product.category;

  if (category === 'Reserve') {
    return { type: 'reserve', R: 0, C: 0 };
  }

  if (category === 'Perishable') {
    return { type: 'perishable', R: 1, C: product.restockPeriod ?? 1 };
  }

  if (category === 'Secondary') {
    const C = product.restockPeriod ?? 30;
    return { type: 'slow', R: C, C };
  }

  // Primary + Drinks (default)
  const C = product.restockPeriod ?? 7;
  return { type: 'fast', R: C, C };
}

function computeOrderQtyEq52({
  product,
  dates,      // 60-day date array
  S,          // 60-day sales array aligned with dates
  OH,
  OO = 0,
  BO = 0,
  lambda = 0.94,
  Ns = 14,
  Nl = 42,
}) {
  const { type, R, C } = getCadenceParams(product);
  const { muL, sigmaL } = leadTimeStatsUniform1to3();

  if (type === 'reserve') {
    return { Q: 0, mu: 0, g: 0, sigmaD: 0, DhatH: 0, SS: 0, H: 0, IP: OH + OO - BO };
  }

  const seasonality = estimateSeasonalityFactorsFromHistory(dates, S);
  const sHist = dates.map(d => seasonalityFactor(d, seasonality));
  const X = S.map((st, i) => (sHist[i] ? st / sHist[i] : 0));

  // Level and trend on de-seasonalized series
  const mu = wmaRecent(X, lambda, Nl);
  const g = trendFromTwoWmas(X, lambda, Ns, Nl);

  // Residuals (k_t: days before today; last day has k=0)
  const residuals = X.map((xt, idx) => {
    const k = (X.length - 1) - idx;
    return xt - (mu + g * k);
  });
  const sigmaD = stdev(residuals);

  // Choose horizon and z
  const H = R + muL;
  const z = (type === 'perishable') ? 1.04 : 1.28;

  // Forecast daily demand over horizon
  const today = new Date();
  const Dhat = [];
  for (let d = 1; d <= H; d++) {
    const baseline = Math.max(0, mu + g * d);
    const futureDate = addDays(today, d);
    const sf = seasonalityFactor(futureDate, seasonality);
    Dhat.push(baseline * sf);
  }

  // Total forecast demand and average
  const DhatH = Dhat.reduce((a, b) => a + b, 0);
  const dbar = H > 0 ? (DhatH / H) : 0;

  // Safety stock
  const sigmaH = Math.sqrt(H * sigmaD * sigmaD + (dbar * dbar) * (sigmaL * sigmaL));
  const SS = z * sigmaH;

  // Inventory position and target
  const IP = OH + OO - BO;

  // Perishables: use coverage C and waste factor
  if (type === 'perishable') {
    const pw = Math.max(0, Math.min(0.5, product.wasteRate ?? 0.05));
    const alpha = 1 / (1 - pw);

    const DhatC = Dhat.slice(0, C).reduce((a, b) => a + b, 0);
    const dbarC = C > 0 ? (DhatC / C) : 0;

    const sigmaC = Math.sqrt(C * sigmaD * sigmaD + (dbarC * dbarC) * (sigmaL * sigmaL));
    const SSC = z * sigmaC;

    const Qp = Math.max(0, alpha * (DhatC + SSC) - IP);
    return { Q: Math.ceil(Qp), mu, g, sigmaD, DhatH: DhatC, SS: SSC, H: C, IP };
  }

  // Non-perishables
  const T = DhatH + SS;
  const Q = Math.max(0, T - IP);

  return { Q: Math.ceil(Q), mu, g, sigmaD, DhatH, SS, H, IP };
}
```

### 5.5 Where to plug this into your current function

In your current `calculateRestock(...)`:

1. Keep the DB fetching and message creation flow.
2. Replace the block starting at:
   - `// Calculate μw ...`
   through:
   - `const restockQuantity = ...`
3. Instead compute:
   - `OH = product.stock`
   - `OO` (if available)
   - build `{ dates, S }` for 60 days
   - call `computeOrderQtyEq52(...)`
4. Set:
   - `restockQuantity = result.Q`
   - `metrics` should include `mu`, `g`, `sigmaD`, `SS`, `H`, `IP`, `DhatH`

---

## 6) Updating “dates” and messaging outputs (orderDate/restockedDate/stockEndDate)

Your current date logic uses:

- `restockDays = Math.max(1, Math.round(period * 0.15))`

With Equation 5.2, replace it with a lead-time-based expectation:

- `expectedLeadDays = Math.round(μ_L)` (defaults to 2)
- `restockedDate = orderDate + expectedLeadDays`

For the “stock lasts exactly X days” statement:

- For perishables: use `C` (usually 1–2)
- For weekly/monthly: use `C = R` (7 or 30)

So:

- `stockEndDate = restockedDate + C`

---

## 7) Restock threshold recommendation (optional but strongly suggested)

The current threshold is `15%` of the computed order quantity:

- `restockThreshold = Math.ceil(restockQuantity * 0.15)`

This is not tied to stockout risk.

A more meaningful threshold is:

- forecast demand during expected lead time plus a fraction of safety stock

Example:

- `threshold = ceil( sum_{d=1..μ_L} Dhat_d + 0.5*SS )`

If you want to keep backward compatibility for now, keep your 15% rule, but plan to migrate.

---

## 8) Validation checklist (to confirm the replacement is correct)

- **60-day series length is exactly 60**
  - includes zeros
  - is chronological

- **Seasonality is normalized**
  - Week 1/4 factor > 1
  - Week 2/3 factor < 1
  - average across the 4 weeks is 1

- **Trend behaves correctly**
  - if recent sales > older sales, `g > 0`
  - if recent sales < older sales, `g < 0`

- **Inventory is accounted for**
  - `Q` decreases if on-hand is high
  - `Q` becomes 0 when `IP >= T`

- **Lead time variability changes safety stock**
  - increasing `σ_L` increases `SS`

- **Perishables**
  - increasing `wasteRate` increases `Q_p`

---

## 9) What you should remove from the old code

After implementing Equation 5.2 you no longer need:

- `BETA`
- `Z_SCORE` (replace with `z` by product type)
- `SEASONAL_FACTOR`
- `μw`, `μh` calculation
- `restockDays = period * 0.15` heuristic (replace with `μ_L`-based expected date)

---

## 10) Recommended defaults (ready to use)

- `DAYS_FOR_HISTORICAL = 60`
- `λ = 0.94`
- `N_s = 14`
- `N_l = 42`
- Lead time: uniform 1–3 → `μ_L=2`, `σ_L=0.816`
- `z`:
  - perishables: `1.04`
  - non-perishables: `1.28`
- perishables `wasteRate` default: `0.05`

---

## Next step (if you want)

If you tell me where `calculateRestock(...)` lives in your codebase (file path), I can implement the actual code changes and wire in `OO` (on-order) if those documents/fields exist.
