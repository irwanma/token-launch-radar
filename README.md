[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/irwanma/token-launch-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/irwanma/token-launch-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

# Token Launch Radar — radar-4 (entry v4)

An entry for make.fun's token-radar-01 ("Build the best token launch radar"). It prices every
pre-token protocol in the house's sealed snapshot with a model fitted on the protocols that
already trade, shows its backtest next to the board, and nets each row into a farm plan on a
$1,000 ticket with itemised costs.

## What v4 changes over v3 (refit + launch odds, same snapshot)

Two changes, both computed from the same snapshot and both verified by an independent
Python replica of the stage-3 pipeline (control row reproduces v2 exactly):

- **The curve is refit, not re-trimmed:** OLS + hard trim is replaced by a Huber fit
  (δ = 1.345, scale from the median absolute residual, iterated to convergence). No comp is
  deleted any more — the two farthest (Rain 0.32, Bitway Earn 0.42) are weighted down and
  listed on the page. The floor is chosen by a pre-committed grid ($1M / $500K / $250K ×
  Huber), picked by the best stage-3 LOO among the configs whose launch-cohort miss stayed
  under ×2.50: $1M won (LOO ×2.44, cohort ×2.22); $500K (cohort ×2.60) and $250K (cohort
  ×2.74) failed the gate. The rank-1 recipe is shown beaten, not copied: Huber with no
  structural exclusions (110 comps, β 0.458) gives LOO ×2.68 against this board's ×2.44.
  On the Huber fit the breadth candidate passes the pre-committed gate (LOO ×2.44 → ×2.28),
  so the final model is stage 4; kinship is still rejected. One cost of breadth is reported,
  not hidden: the out-of-sample band hold thins to 32% inside P25–P75 (v3: 50%), because
  the breadth coefficient fitted on the pre-2024 cohort does not transfer to the post-2024
  one — and the post-2024 actuals run a median +0.18 dex above the predictions, so the P25
  the farms are netted on is conservative, not optimistic.
- **Launch odds multiply the value:** a second model — logistic, category + log10(days
  tracked + 30), fitted on all 758 protocols — gives P(a protocol ever records a token |
  no token after this many days, this category); the odds are the "still to come" transform
  (R − r)/(1 − r), clamped to 5–90%. Validated out of sample: 5-fold cross-validation
  predicts which protocols record a token with 65.8% accuracy against a 54.9% base rate
  (Brier 0.213 against 0.248), calibrated within 5 points per quintile. Implied value =
  value if it launches × odds, and every farm net is an expected net on that basis.
  Verdicts move 88/44/19/49 → 54/30/36/80 (ROBUST/FARM/THIN/SKIP); the Starter Basket
  stays five rows at +$354.03. Steakhouse Financial, the v2/v3 headliner, falls to #52:
  its curve value is $35.9M but its odds are 19%, so the board prices it at $6.9M.

## What v3 changed over v2 (same model, same snapshot)

The fitted curve is untouched (α 4.44, β 0.353, LOO ×2.54, cohort ×2.18 — identical to v2).
Four refinements, all computed from the same snapshot:

- **Netting is complete:** the farm engine now charges one maintenance action per 30 days of
  hold (Capital +3, Hybrid +2, Points +1 actions at the primary chain's gas price). v2's own
  farm steps already said acting on a weekly check costs gas, but the net never charged it.
  Verdicts move 91/53/19/37 → 88/44/19/49 (ROBUST/FARM/THIN/SKIP); the Starter Basket stays
  five rows at +$563.96 (was +$575.20). The P25 band itself was checked, not widened: on the
  32 comps listed from 2024, the pre-2024 band holds 50% inside P25–P75 and 78% inside
  P10–P90, so the band is calibrated out of sample and the verdict level is what the data
  gives — it is not tuned toward any range.
- **Bootstrap rank ranges:** every row's rank carries a 90% interval from 200 seeded refits of
  the frozen model form (same stage and gate outcome, only the comp set resampled). The top
  table shows them (#1 sits 1–16); a wide range means the rank is mostly noise, and the board
  says so instead of printing a false precision.
- **Band hold rate, reported:** the validation panel now states the out-of-sample hold rate
  above, so the P25 the farms are netted on is evidenced, not asserted.
- **Board-first cover:** the page opens with a dense KPI strip and the top-12 board before any
  essay, so the first screenshot shows the radar working, not the model description.

## The model

`radar-4` is a log-log size curve — log10(launch value) = α + β·log10(TVL) — fitted by Huber
IRLS (δ = 1.345, scale from the median absolute residual) on the traded protocols that survive
a written cleaning (market cap ≥ $1M; stablecoin issuers, wrapped/staked derivatives, bridge
and staking-wrapper categories, versioned instances and exchange own-products excluded), with
no comp deleted — the farthest are weighted down and listed. On top of the curve: family
offsets (the snapshot's categories grouped into families, mean residual shrunk n/(n+4)
toward zero, capped at ±0.6 dex) and two bounded tilts whose forms are stated, not fitted —
momentum from the seven-day TVL change against the snapshot's median week, capped to
[0.70, 1.40], and seasoning from days tracked with no token, 1 − 0.25·2^(−days/270). The
breadth candidate (value per extra chain) passed the pre-committed gate on the Huber fit and
is adopted at stage 4; kinship (a traded namesake exists) was rejected.

A second model, launch odds, multiplies the value: a logistic regression on category +
log10(days tracked + 30), fitted on all 758 protocols, gives P(a protocol ever records a
token | no token after this many days, this category); the odds are the "still to come"
transform (R − r)/(1 − r), clamped to 5–90%. Implied value = value if it launches × odds.

Two candidate factors (breadth: value per extra chain; kinship: a traded namesake exists) face a
pre-committed gate — improve leave-one-out by ≥3%, keep one sign in both listing cohorts, keep
that sign in ≥80% of 200 seeded bootstrap refits — and are reported in the dashboard's lab
whether they pass or not. Each row's band is the middle half (P25–P75) of the leave-one-out
residuals; the lab also reports the band by TVL tercile.

Validation is leave-one-out as the primary test and a launch-cohort split as the second (fit on
listings before 2024, test on listings from 2024, current snapshot features — labelled as a
cohort split, never as a walk-forward). The ten worst leave-one-out misses are named on the page.

## Coverage

The funnel accounts for all 758 snapshot protocols: those recording a token form the reference
set; the tokenless are ranked unless a written exclusion rule sets them aside (bridge/staking/
exchange categories, wrapped or staked products, versioned instances, exchange own-products),
each under one reason code in a published ledger. The 40-slug house watchlist is always ranked.

## The farm engine

Each protocol is classified from its category as Capital-weighted, Points/Action or Hybrid. On a
$1,000 ticket at a 10% pro-rata community slice (5% shown as a sensitivity in every detail view),
the engine charges gas per action on the primary chain, protocol fees, an impermanent-loss drag
of 2–5% for liquidity mechanisms, a bridge fee plus risk charge for multi-chain capital plans,
and forgone yield (4% T-bill; 3% where the position is itself a staking asset), plus one
maintenance action per 30 days of hold at the primary chain's gas price. Verdicts: ROBUST
when the net stays positive at the P25 band end, FARM when positive at the point value, THIN when
the slice covers cash costs but not the forgone yield, SKIP otherwise. Farm Rank orders by net
per hour at P25. The dashboard prints the full assumptions table.

## Running it

Node 22, standard library only:

```
node main.ts --input <snapshot.json or its folder> --output <folder>
```

The house runner's contract (`--input`, `MAKEFUN_OUTPUT_DIR`) is honoured. Output: `board.json`,
`data.js`, `dashboard/` (index.html with the static panels baked in, app.css, app.js) and
`dossier.json`. The build is deterministic: two runs write identical bytes.

## Verifying it

```
node tools/verify.mjs --output <folder>
```

Recomputes from the written board.json and data.js and fails on any disagreement: funnel sums,
per-row net = slice − itemised costs, band consistency with the leave-one-out quantiles, basket
total = sum of components, the static HTML numbers against data.js, the dossier against a fresh
build, and the board gate's shape.
