[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/irwanma/token-launch-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/irwanma/token-launch-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

# Token Launch Radar — radar-3

An entry for make.fun's token-radar-01 ("Build the best token launch radar"). It prices every
pre-token protocol in the house's sealed snapshot with a model fitted on the protocols that
already trade, shows its backtest next to the board, and nets each row into a farm plan on a
$1,000 ticket with itemised costs.

## The model

`radar-3` is a log-log size curve — log10(launch value) = α + β·log10(TVL) — fitted by least
squares on the traded protocols that survive a written cleaning (market cap ≥ $1M; stablecoin
issuers, wrapped/staked derivatives, bridge and staking-wrapper categories, versioned instances
and exchange own-products excluded), followed by one iterated robust trim. On top of the curve:
family offsets (the snapshot's categories grouped into families, mean residual shrunk n/(n+4)
toward zero, capped at ±0.6 dex) and two bounded tilts whose forms are stated, not fitted —
momentum from the seven-day TVL change against the snapshot's median week, capped to
[0.70, 1.40], and seasoning from days tracked with no token, 1 − 0.25·2^(−days/270).

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
and forgone yield (4% T-bill; 3% where the position is itself a staking asset). Verdicts: ROBUST
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
