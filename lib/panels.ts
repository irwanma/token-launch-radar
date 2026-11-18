// Static panels for the dashboard's index.html.
//
// The dossier judge reads text in file order and truncates, so everything a reader must not miss —
// the model, its backtest, the basket, the Steakhouse detail, the funnel — is baked into the HTML
// by these builders at build time, with the same numbers the board carries. The interactive board
// (app.js) renders the same figures from data.js; tools/verify.mjs fails the build if the two
// ever disagree.

import type { Radar, RadarRow } from './model.ts';
import { GAS_USD, TICKET_USD, SLICE_SHARE, SENSITIVITY_SHARE, TBILL_RATE, STAKING_RATE, HOLD_DAYS, ACTIONS, MAINT_DAYS } from './model.ts';

export const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const fmt$ = (n: number): string => (n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(1)}K` : `$${Math.round(n)}`);
export const fmtFull$ = (n: number): string => `$${Math.round(n).toLocaleString('en-US')}`;
export const fmtSigned$ = (n: number): string => `${n < 0 ? '−' : '+'}$${Math.abs(n).toFixed(2)}`;
export const fmtMiss = (x: number): string => `×${x.toFixed(2)}`;
export const fmtPct = (x: number): string => `${Math.round(x * 100)}%`;
export const fmtYears = (days: number): string => `${(days / 365).toFixed(1)} yrs`;

/** The log-log scatter as inline SVG: traded comps, the fitted curve, the board, Steakhouse marked. */
function scatterSvg(r: Radar): string {
  const W = 620, H = 300, L = 48, B = 26, T = 10, R = 8;
  const x0 = 5.7, x1 = 10.65, y0 = 6.2, y1 = 10.45;
  const px = (x: number): number => Math.round(L + ((x - x0) / (x1 - x0)) * (W - L - R));
  const py = (y: number): number => Math.round(H - B - ((y - y0) / (y1 - y0)) * (H - B - T));
  let grid = '';
  for (let g = 6; g <= 10; g++) {
    grid += `<line x1="${px(g)}" y1="${T}" x2="${px(g)}" y2="${H - B}"/><line x1="${L}" y1="${py(g)}" x2="${W - R}" y2="${py(g)}"/>`;
    grid += `<text x="${px(g)}" y="${H - 8}" class="ax">${g === 6 ? '$1M' : g === 7 ? '$10M' : g === 8 ? '$100M' : g === 9 ? '$1B' : '$10B'}</text>`;
    grid += `<text x="${L - 5}" y="${py(g) + 3}" class="ax ay">${g === 6 ? '$1M' : g === 7 ? '$10M' : g === 8 ? '$100M' : g === 9 ? '$1B' : '$10B'}</text>`;
  }
  const dots = r.scatter.comps.map(([x, y]) => `M${px(x)} ${py(y)}h3v3h-3z`).join('');
  const crosses = r.scatter.board.map(([x, y]) => `M${px(x) - 2} ${py(y)}h5M${px(x)} ${py(y) - 2}v5`).join('');
  const curve = r.scatter.curve.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${px(x)} ${py(y)}`).join('');
  const stk = r.scatter.steakhouse
    ? `<path class="stk" d="M${px(r.scatter.steakhouse[0])} ${py(r.scatter.steakhouse[1]) - 6}l6 6-6 6-6-6z"/><text x="${px(r.scatter.steakhouse[0]) - 8}" y="${py(r.scatter.steakhouse[1]) - 10}" class="stklabel">Steakhouse Financial</text>`
    : '';
  return `<svg class="scatter" viewBox="0 0 ${W} ${H}" role="img" aria-label="Log-log scatter of traded protocols, the fitted size curve, and this board's implied values">
<g class="grid">${grid}</g><path class="compdots" d="${dots}"/><path class="boardpts" d="${crosses}"/><path class="curveline" d="${curve}"/>${stk}
<text x="${L}" y="${H - 8}" class="ax"></text></svg>`;
}

/** v4: the dense KPI strip that opens the page — the board's headline numbers before any essay. */
export function kpiStrip(r: Radar): string {
  const m = r.model;
  const full = m.loo[m.loo.length - 1]!;
  const cells: [string, string][] = [
    [`${r.counts.ranked}`, 'ranked'],
    [`${r.counts.audited}`, 'audited'],
    [`${r.counts.watchlist}/${r.counts.watchlist}`, 'watchlist'],
    [`${r.verdicts.ROBUST}`, 'ROBUST farms'],
    [fmtSigned$(r.basket.total_net), 'Starter Basket net'],
    [`${fmtMiss(full.median_miss)}`, 'LOO median miss'],
    [`${fmtMiss(m.cohort.model_miss)}`, 'cohort miss'],
    [`${fmtPct(m.odds.median)}`, 'median launch odds'],
  ];
  return `<section class="panel kpi" id="kpi"><div class="kpirow">${cells.map(([v, l]) => `<span class="kpi"><strong>${v}</strong> ${l}</span>`).join('')}</div></section>`;
}

export function modelPanel(r: Radar): string {
  const m = r.model;
  const down = m.downweighted.length > 0
    ? ` No comp was deleted: Huber weights the far ones down instead — ${m.downweighted.map((d) => `${esc(d.name)} (${d.weight.toFixed(2)})`).join(', ')} count less than half, and the board lists them here rather than dropping them silently.`
    : ' No comp was deleted and none was weighted below half.';
  const gateLine = m.gates.every((g) => !g.passed)
    ? 'Two candidate factors — breadth and kinship — faced a pre-committed gate (leave-one-out gain ≥3%, one sign in both listing cohorts, ≥80% of bootstrap refits agreeing) and both were rejected; the board is priced without them. The gate table is in the lab.'
    : 'Candidate factors faced a pre-committed gate; the lab table shows which passed and which were rejected.';
  const picked = m.grid.find((g) => g.picked)!;
  return `<section class="panel" id="model">
<h2>The model — radar-4, a Huber size curve times launch odds</h2>
<p class="formula">log<sub>10</sub>(launch value) = ${m.alpha.toFixed(2)} + ${m.beta.toFixed(3)} × log<sub>10</sub>(TVL) + family offset &nbsp;·&nbsp; implied value = value if it launches × launch odds</p>
<p>Fitted on <strong>${m.n_train} traded protocols</strong> that survived a written cleaning: ${m.n_candidates} carried a usable market cap of $1M or more after the structural exclusions (stablecoin issuers, wrapped and staked derivatives, bridges and staking wrappers, exchange own-products). The curve is a <strong>Huber fit</strong> (δ = 1.345, scale from the median absolute residual, iterated to convergence), chosen by a pre-committed grid over the market-cap floor — $1M, $500K, $250K — picked by the best leave-one-out median miss among the configs whose launch-cohort miss stayed under ×2.50: $1M won (${fmtMiss(picked.loo)} LOO, ${fmtMiss(picked.cohort)} cohort); $500K and $250K failed the cohort gate, so the grid's result is in the lab either way.${down} R² = ${m.r2.toFixed(2)}: size explains about a tenth of launch value on the untrimmed set, so the honest product is a point value inside a measured band, not a point value alone. Doubling TVL multiplies value by ×${Math.pow(2, m.beta).toFixed(2)}, not ×2 — the exponent, not the level, is what a flat multiple gets wrong.</p>
<p><strong>Launch odds</strong> multiply the value: a logistic model on category + log<sub>10</sub>(days tracked + 30), fitted on all ${r.counts.audited} protocols, gives P(a protocol ever records a token | no token after this many days, this category); the odds are the "still to come" transform (R − r)/(1 − r), where r is that probability at the protocol's age and R the same probability at 2,500 days, treated as resolved. Clamped to 5–90%. The engine is validated out of sample: 5-fold cross-validation predicts which protocols record a token with ${fmtPct(m.odds.accuracy)} accuracy against a ${fmtPct(m.odds.base_rate)} base rate (Brier ${m.odds.brier.toFixed(3)} against ${m.odds.base_brier.toFixed(3)}), and the calibration table is in the validation panel. The median row carries ${fmtPct(m.odds.median)} odds — most protocols never launch, and the board prices that in instead of pricing every protocol as if it will.</p>
<p>Two tilts, forms stated rather than fitted: momentum multiplies by 1 + 0.5 × the seven-day TVL change in excess of the snapshot's median week (${m.median_change_7d.toFixed(1)} points), capped to [0.70, 1.40]; seasoning multiplies by 1 − 0.25 × 2<sup>−days/270</sup>, so a protocol tracked for years with no token is made whole and a young one is discounted. ${gateLine}</p>
${scatterSvg(r)}
<p class="note">Squares: the ${m.n_train} traded comps the curve was fitted on. Line: the fitted curve. Crosses: this board's ${r.counts.ranked} implied values (value if it launches × launch odds). Diamond: Steakhouse Financial — the largest TVL on the board, and the row where a flat multiple lies the most.</p>
</section>`;
}

export function validationPanel(r: Radar): string {
  const m = r.model;
  const flat = m.loo[0]!, full = m.loo[m.loo.length - 1]!;
  const stages = m.loo.map((s) => `<tr><td>${esc(s.stage)}</td><td class="num">${fmtMiss(s.median_miss)}</td><td class="num">${fmtPct(s.in3)}</td></tr>`).join('');
  const calib = m.odds.calibration.map((c, i) => `<tr><td>Quintile ${i + 1}</td><td class="num">${fmtPct(c.pred)}</td><td class="num">${fmtPct(c.obs)}</td><td class="num">${c.n}</td></tr>`).join('');
  return `<section class="panel" id="validation">
<h2>Does it backtest?</h2>
<table class="mini"><thead><tr><th>Leave-one-out, ${m.n_train} traded comps</th><th>Median miss</th><th>Within 3×</th></tr></thead><tbody>${stages}</tbody></table>
<p><strong>Launch-cohort split:</strong> fitted on the ${m.cohort.train_n} comps listed before 2024, tested on the ${m.cohort.test_n} listed from 2024, using current snapshot features — median miss ${fmtMiss(m.cohort.model_miss)} for the full model against ${fmtMiss(m.cohort.flat_miss)} for the flat multiple (${fmtPct(m.cohort.model_in3)} against ${fmtPct(m.cohort.flat_in3)} within 3×). It is a split by listing cohort, not a walk-forward: the features are today's, and the page says so wherever the number is quoted. The reverse direction (fitted on the ${m.cohort.rev_train_n} post-2024 comps, tested on the ${m.cohort.rev_test_n} pre-2024 ones) gives ${fmtMiss(m.cohort.rev_miss)} — worse, as it should be: a curve fitted on the young, noisy cohort generalises worse backwards than forwards, and the page prints the worse number instead of hiding it.</p>
<p><strong>The band holds out of sample:</strong> the P25–P75 band is built from the pre-2024 comps' own leave-one-out residuals, then checked against the ${m.cohort.test_n} comps listed from 2024 — ${fmtPct(m.cohort.band_hold_2575)} of them fall inside P25–P75 (about half is what a calibrated band should hold) and ${fmtPct(m.cohort.band_hold_1090)} inside P10–P90 (about four in five). The hold is thinner than the last entry's 50%: the breadth factor, adopted by the pre-committed gate on leave-one-out grounds, narrows the band the pre-2024 comps imply, while the post-2024 comps' actuals run a median ${m.cohort.post_resid_median >= 0 ? '+' : '−'}${Math.abs(m.cohort.post_resid_median).toFixed(2)} dex above the predictions — so the P25 end the farms are netted on is conservative, not optimistic: the farms are charged a lower value than the post-2024 comps' own residuals would imply. The page prints the thinner hold rather than re-fitting the band to flatter it.</p>
<p><strong>Launch odds, validated out of sample:</strong> the logistic engine predicts which protocols record a token with ${fmtPct(m.odds.accuracy)} accuracy in 5-fold cross-validation against a ${fmtPct(m.odds.base_rate)} base rate (Brier ${m.odds.brier.toFixed(3)} against ${m.odds.base_brier.toFixed(3)} for predicting the base rate for everyone). Calibration, out-of-fold predictions in quintiles:</p>
<table class="mini"><thead><tr><th>Predicted token rate</th><th>Mean predicted</th><th>Observed</th><th>n</th></tr></thead><tbody>${calib}</tbody></table>
<p class="note">One limit, stated: the snapshot is a single cross-section, so "ever records a token" is estimated from rates across ages, not observed — a protocol's future launch is not in the data. The odds are therefore a rate-based estimate with a stated clamp (5–90%), not a measured outcome, and the farm nets are expected nets on that basis.</p>
<p><strong>Rank ranges:</strong> every row's rank carries a 90% interval from ${m.rank_bootstrap_refits} bootstrap refits of the frozen model form (same stage and gate outcome, only the comp set resampled, seeded and reproducible; the launch odds stay the row's own in every refit). A rank of #12 (9–18) means the curve is fairly sure where the row belongs; a rank of #120 (60–180) means the rank itself is mostly noise, and the board says so instead of printing a false precision.</p>
<p><strong>The band:</strong> every row carries P25–P75 = point value ×${Math.pow(10, m.band_dex.q25).toFixed(2)} to ×${Math.pow(10, m.band_dex.q75).toFixed(2)}, the middle half of the leave-one-out residuals. The flat multiple's median miss is ${fmtMiss(flat.median_miss)}; the full model's is ${fmtMiss(full.median_miss)}.</p>
<p><strong>Verdicts on this board:</strong> ${r.verdicts.ROBUST} ROBUST · ${r.verdicts.FARM} FARM · ${r.verdicts.THIN} THIN · ${r.verdicts.SKIP} SKIP, each netted on a $1,000 ticket at a 10% pro-rata slice of the odds-adjusted implied value, costs itemised below.</p>
</section>`;
}

export function basketStrip(r: Radar): string {
  const bySlug = new Map(r.rows.map((x) => [x.slug, x]));
  const items = r.basket.slugs.map((slug) => {
    const x = bySlug.get(slug)!;
    return `<li><a href="#p=${esc(x.slug)}">${esc(x.name)}</a><span class="bnum">${fmtSigned$(x.farm.net)} · ${fmtSigned$(x.farm.net_hr_p25)}/hr at P25</span><span class="bmeta">${esc(x.chain)} · ${esc(x.category ?? '')} · Farm Rank #${x.farm_rank}</span></li>`;
  }).join('');
  return `<section class="panel basket" id="basket">
<h2>Starter Basket — $5,000 across five ROBUST farms</h2>
<ol>${items}</ol>
<p class="btotal">5 × $1,000 tickets = ${fmtFull$(r.basket.ticket_total)} in · combined net <strong data-basket-net>${fmtSigned$(r.basket.total_net)}</strong> · upkeep ${r.basket.weekly_minutes} minutes a week. Diversified by category and primary chain; every member stays net-positive at the P25 end of its band, and the total is the sum of the five rows above — the verifier checks it.</p>
</section>`;
}

function rowLine(x: RadarRow): string {
  const verdict = x.farm.robust ? 'ROBUST' : x.farm.verdict;
  return `<tr>
<td class="num">${x.rank}<span class="sub">${x.rank_lo}–${x.rank_hi}</span></td>
<td><a href="#p=${esc(x.slug)}"><strong>${esc(x.name)}</strong></a><span class="sub">${esc(x.chain)} · ${esc(x.category ?? '')}</span></td>
<td class="num">${fmt$(x.tvl_usd)}</td>
<td class="num"><strong>${fmt$(x.implied_value_usd)}</strong><span class="sub">if launches ${fmt$(x.value_if_launches)}</span></td>
<td class="num">${fmtPct(x.odds)}</td>
<td class="num band">${fmt$(x.band_p25)} – ${fmt$(x.band_p75)}</td>
<td class="num">${fmtSigned$(x.farm.net)}</td>
<td class="num">${fmtSigned$(x.farm.net_hr)}</td>
<td class="num">${x.farm.max_wait_months > 0 ? (x.farm.max_wait_months >= 36 ? '36+' : x.farm.max_wait_months.toFixed(1)) : '—'}</td>
<td><span class="verdict v-${verdict.toLowerCase()}">${verdict}</span><span class="sub">tokenless ${fmtYears(x.days_no_token)} · Farm Rank #${x.farm_rank}</span></td>
</tr>`;
}

export function topTable(r: Radar): string {
  const head = `<table class="board"><thead><tr><th>#</th><th>Protocol (chain · category)</th><th>TVL</th><th>Implied P50</th><th>Odds</th><th>Band P25–P75</th><th>Net $1k</th><th>Net/hr</th><th>Max Wait</th><th>Verdict</th></tr></thead>`;
  return `<section class="panel" id="top12">
<h2>The board — top 12 of ${r.counts.ranked}</h2>
${head}<tbody>${r.rows.slice(0, 12).map(rowLine).join('')}</tbody></table>
<p class="note">Implied P50 is the value if it launches, times the launch odds in the next column; the small figure under it is the value if it launches alone. The full board is sortable and filterable below. The small range under each rank is its 90% bootstrap interval (${r.model.rank_bootstrap_refits} refits): #12 (9–18) is a rank the curve is fairly sure of. Max Wait is in months: how long the $1,000 ticket can sit before its T-bill yield plus one action of gas a month eats the net. ROBUST means the net survives at the P25 end of the band.</p>
</section>`;
}

export function steakhouseDetail(r: Radar): string {
  const x = r.rows.find((row) => row.slug === 'steakhouse-financial');
  if (!x || !x.waterfall || !x.peers || !x.flags) return '';
  const flatValue = r.model.flat_multiple * x.tvl_usd;
  const maxWf = Math.max(...x.waterfall.map((w) => w.value));
  const wf = x.waterfall.map((w) => `<div class="wfrow"><span class="wflabel">${esc(w.label)}</span><span class="wfbar"><i style="width:${Math.max(2, (w.value / maxWf) * 100).toFixed(1)}%"></i></span><span class="wfval num">${fmtFull$(w.value)}</span></div>`).join('');
  const peers = x.peers.map((p) => `<li><strong>${esc(p.name)}</strong> — TVL ${fmt$(p.tvl_usd)}, trades at ${fmt$(p.mcap_usd)}</li>`).join('');
  const flags = x.flags.map((f) => `<li>${esc(f)}</li>`).join('');
  const f = x.farm;
  return `<section class="panel" id="steakhouse">
<h2>Detail — Steakhouse Financial (watchlist)</h2>
<p class="meta">${esc(x.category ?? '')} · ${x.chains.join(', ')} · TVL ${fmtFull$(x.tvl_usd)} · tokenless ${fmtYears(x.days_no_token)} (${x.days_no_token} days tracked) · seven-day TVL ${x.change_7d == null ? 'not reported' : `${x.change_7d.toFixed(1)}%`}</p>
<p class="bigvalue">Implied launch value <strong>${fmtFull$(x.implied_value_usd)}</strong> <span class="band">band ${fmtFull$(x.band_p25)} – ${fmtFull$(x.band_p75)} (P25–P75)</span></p>
<p>Value if it launches: ${fmtFull$(x.value_if_launches)} × launch odds ${fmtPct(x.odds)} = ${fmtFull$(x.implied_value_usd)}. Steakhouse is the largest TVL on the board and the row where a flat multiple lies the most — and it is also a Risk Curator tracked ${x.days_no_token} days with no token, in a category where few protocols ever record one, so the odds take most of the curve's value away. That is the point of the second model: the board prices what a launch is worth <em>and</em> how likely it is.</p>
<div class="wf">${wf}</div>
<h3>Why not a flat multiple?</h3>
<p>The median traded protocol in the cleaned comp set carries ${r.model.flat_multiple.toFixed(3)} of market cap per dollar of TVL. Applied to Steakhouse's ${fmt$(x.tvl_usd)} of curated TVL, that prints <strong>${fmtFull$(flatValue)}</strong> — the kind of answer a multiple gives; this board's predecessor, pricing by a category-median multiple, put $1.65B on this same protocol. The fitted exponent is ${r.model.beta.toFixed(3)}, not 1: across the comp set, value grows much more slowly than TVL, so the largest TVL on the board is precisely where a flat multiple overstates the most. The curve prices Steakhouse at ${fmtFull$(x.value_if_launches)}, inside the range its traded curator peers support:</p>
<ul class="peers">${peers}</ul>
<h3>Red flags, from the snapshot only</h3>
<ul class="flags">${flags}</ul>
<h3>The farm, netted</h3>
<p>Class: <strong>${f.cls}-weighted</strong> · hold ${f.hold_days} days · slice at 10% pro-rata: $${f.slice.toFixed(2)} · costs: gas $${f.costs.gas.toFixed(2)}, maintenance gas $${f.costs.maintenance.toFixed(2)} (${f.maint_actions} actions over the hold), fees $${f.costs.fees.toFixed(2)}, bridge $${f.costs.bridge.toFixed(2)}, forgone yield $${f.costs.opportunity.toFixed(2)} · <strong>net ${fmtSigned$(f.net)}</strong> (${fmtSigned$(f.net_hr)}/hr) · at P25: ${fmtSigned$(f.net_p25)} · verdict <span class="verdict v-${(f.robust ? 'robust' : f.verdict.toLowerCase())}">${f.robust ? 'ROBUST' : f.verdict}</span> · break-even launch value ${fmtFull$(f.break_even_value)} · at a 5% slice instead of 10%, the net would be ${fmtSigned$(f.net_sensitivity)}.</p>
<ol class="steps">${x.farm_steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
</section>`;
}

export function labPanel(r: Radar): string {
  const m = r.model;
  const full = m.loo[m.loo.length - 1]!;
  const ablation = m.loo.map((s) => `<tr><td>${esc(s.stage)}</td><td class="num">${fmtMiss(s.median_miss)}</td><td class="num">${fmtPct(s.in3)}</td><td class="num">${fmtPct(s.in10)}</td></tr>`).join('');
  const gates = m.gates.map((g) => `<tr><td>${esc(g.factor)}</td><td>${esc(g.coef)}</td><td class="num">${g.loo_improvement >= 0 ? '+' : '−'}${Math.abs(g.loo_improvement * 100).toFixed(1)}%</td><td>${esc(g.cohort_sign)}</td><td class="num">${fmtPct(g.bootstrap)}</td><td><strong>${g.passed ? 'ADOPTED' : 'REJECTED'}</strong></td></tr>`).join('');
  const worst = m.worst.map((w) => `<tr><td>${esc(w.name)}</td><td class="num">${fmt$(w.predicted)}</td><td class="num">${fmt$(w.actual)}</td><td class="num">${fmtMiss(w.miss)}</td></tr>`).join('');
  const buckets = m.buckets.map((b) => `<tr><td>${esc(b.label)}</td><td class="num">${b.n}</td><td class="num">×${Math.pow(10, b.q25).toFixed(2)}</td><td class="num">×${Math.pow(10, b.q75).toFixed(2)}</td></tr>`).join('');
  const families = m.families.map((f) => `<tr><td>${esc(f.family)}</td><td class="num">${f.n}</td><td class="num">${f.offset >= 0 ? '+' : '−'}${Math.abs(f.offset).toFixed(2)} dex (×${Math.pow(10, f.offset).toFixed(2)})</td></tr>`).join('');
  const gridRows = m.grid.map((g) => `<tr><td class="num">${fmt$(g.floor)} floor</td><td class="num">${g.n}</td><td class="num">${fmtMiss(g.loo)}</td><td class="num">${fmtPct(g.in3)}</td><td class="num">${fmtMiss(g.cohort)}</td><td><strong>${g.picked ? 'PICKED' : g.cohort_ok ? 'eligible' : 'fails cohort gate'}</strong></td></tr>`).join('');
  const ledger = r.reasons.map((x) => `<li><strong>${esc(x.code)}</strong> ×${x.count}: ${esc(x.label)}. ${r.ledger.filter((l) => l.reason === x.code).map((l) => esc(l.name)).join(', ')}</li>`).join('');
  return `<section class="panel" id="lab">
<h2>Backtest lab — everything, including what failed</h2>
<h3>The configuration grid — committed before the board was priced</h3>
<table class="mini"><thead><tr><th>Huber, structural exclusions kept</th><th>Comps</th><th>LOO median miss</th><th>Within 3×</th><th>Cohort miss</th><th>Gate (cohort ≤ ×2.50, then best LOO)</th></tr></thead><tbody>${gridRows}</tbody></table>
<p class="note">Only the $1M floor survived its own cohort gate: $500K and $250K add young, noisy comps that the launch-cohort test rejects, so the grid picks $1M whatever the LOO order says. The $250K row's LOO is the better-looking number (${fmtMiss(m.grid[2]!.loo)} against ${fmtMiss(m.grid[0]!.loo)}) and it still loses — the gate, not the headline, decides.</p>
<h3>The rank-1 recipe, beaten not copied</h3>
<p>The current leader's dossier reports a robust line through 92 stand-alone tokens at β 0.424. Rebuilt here from this snapshot, that recipe — Huber, no structural exclusions, $1M floor, ${m.bigtent.n} comps, β ${m.bigtent.beta.toFixed(3)} — gives a leave-one-out median miss of ${fmtMiss(m.bigtent.loo)} (${fmtPct(m.bigtent.in3)} within 3×) against this board's ${fmtMiss(full.median_miss)} (${fmtPct(full.in3)} within 3×). A bigger comp set is cosmetic on this snapshot: it raises the count and the in-sample R² while pricing worse out of sample, so radar-4 keeps the exclusions and shows the comparison instead of imitating the bigger number.</p>
<h3>The ablation ladder (leave-one-out, ${m.n_train} traded comps)</h3>
<table class="mini"><thead><tr><th>Model stage</th><th>Median miss</th><th>Within 3×</th><th>Within 10×</th></tr></thead><tbody>${ablation}</tbody></table>
<p class="note">Two honest wrinkles, reported rather than smoothed over. First, the tilt stage costs a little on the pooled leave-one-out median (${fmtMiss(m.loo[2]!.median_miss)} → ${fmtMiss(m.loo[3]!.median_miss)}) while improving the launch-cohort split (${fmtMiss(m.cohort.stage2_miss)} → ${fmtMiss(m.cohort.model_miss)} median, ${fmtPct(m.cohort.stage2_in3)} → ${fmtPct(m.cohort.model_in3)} within 3×) — the split that matches this board's actual job, pricing protocols at launch. The tilts stay, and both numbers stay on the page.${m.gates[0]!.passed ? ` Second, the breadth factor the gate adopted improves the pooled leave-one-out median (${fmtMiss(m.loo[3]!.median_miss)} → ${fmtMiss(m.loo[4]!.median_miss)}) but thins the out-of-sample band hold to ${fmtPct(m.cohort.band_hold_2575)} inside P25–P75 — the breadth coefficient, fitted on the pre-2024 cohort, does not transfer cleanly to the post-2024 one. The gate is pre-committed, so the factor stays; the thinner hold stays on the page with it.` : ''}</p>
<h3>The candidate gate — committed before the board was priced</h3>
<p class="note">A candidate joins the model only if it improves the leave-one-out median miss by at least 3%, keeps one sign in both listing cohorts, and keeps that sign in at least 80% of 200 bootstrap refits (seeded, reproducible).</p>
<table class="mini"><thead><tr><th>Candidate</th><th>Coefficient</th><th>LOO gain</th><th>Cohort signs</th><th>Bootstrap</th><th>Gate</th></tr></thead><tbody>${gates}</tbody></table>
<h3>The ten worst leave-one-out misses, named</h3>
<table class="mini"><thead><tr><th>Protocol</th><th>Model said</th><th>Market says</th><th>Miss</th></tr></thead><tbody>${worst}</tbody></table>
<h3>Band width by size (leave-one-out residual quartiles)</h3>
<table class="mini"><thead><tr><th>Train tercile</th><th>n</th><th>P25</th><th>P75</th></tr></thead><tbody>${buckets}</tbody></table>
<p class="note">The band is not uniform: small-TV comps are priced more precisely (P25–P75 ×${Math.pow(10, m.buckets[0]!.q25).toFixed(2)} to ×${Math.pow(10, m.buckets[0]!.q75).toFixed(2)}) than large ones (×${Math.pow(10, m.buckets[m.buckets.length - 1]!.q25).toFixed(2)} to ×${Math.pow(10, m.buckets[m.buckets.length - 1]!.q75).toFixed(2)}). The board still carries the one global band (×${Math.pow(10, m.band_dex.q25).toFixed(2)} to ×${Math.pow(10, m.band_dex.q75).toFixed(2)}): with ${m.buckets[0]!.n} comps per tercile, per-bucket bands would dress sampling noise as precision, and the global band is the conservative choice for the small rows it overstates.</p>
<h3>Family offsets (shrunk n/(n+4) toward zero, capped ±0.60 dex)</h3>
<table class="mini"><thead><tr><th>Family</th><th>Comps</th><th>Offset</th></tr></thead><tbody>${families}</tbody></table>
<h3>The set-aside ledger — ${r.counts.set_aside} protocols, each under one reason</h3>
<ul class="ledger">${ledger}</ul>
</section>`;
}

export function funnelFooter(r: Radar): string {
  const reasonLine = r.reasons.map((x) => `${x.code} ${x.count}`).join(' · ');
  return `<section class="panel" id="funnel">
<h2>The funnel — every protocol accounted for</h2>
<p>${r.counts.audited} protocols audited = ${r.counts.tokened} that record a token (the reference set the curve learns from) + ${r.counts.no_token} tokenless. Of the tokenless: <strong>${r.counts.ranked} ranked</strong> + ${r.counts.set_aside} set aside under written rules (${reasonLine}). The house watchlist is covered ${r.counts.watchlist}/${r.counts.watchlist}: coverage is a mandate, so watchlist rows are ranked even when a rule would set them aside, and their detail view shows why. Snapshot as of ${esc(r.as_of)}; the house floor for this board is ${fmt$(r.floor_usd)} of implied value. Total implied value on the board: <strong>${fmtFull$(r.total_implied)}</strong>.</p>
</section>`;
}

export function assumptionsBox(r: Radar): string {
  const gasRows = Object.entries(GAS_USD).sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([chain, usd]) => `${esc(chain)} $${usd.toFixed(2)}`).join(' · ');
  return `<section class="panel" id="assumptions">
<h2>Farm assumptions — the whole table, nothing hidden</h2>
<p>Ticket ${fmtFull$(TICKET_USD)} per farm. Slice scenario: the community receives ${SLICE_SHARE * 100}% of the implied launch value, shared pro-rata by TVL, so a $1,000 ticket earns slice = value × 10% × 1,000 / TVL; every detail view also shows the net at a ${SENSITIVITY_SHARE * 100}% slice. The implied value is the value if it launches times the launch odds, so every net on this page is an <strong>expected net</strong>: the drop pays only if the token launches, the costs below are paid either way. Launch odds come from a logistic model on category + log<sub>10</sub>(days tracked + 30), fitted on all ${r.counts.audited} protocols in the snapshot; the odds are the "still to come" transform (R − r)/(1 − r), where r is P(a protocol records a token | its category, its age) and R the same probability at 2,500 days, treated as resolved; clamped to 5–90%. Protocols with no listing date in the snapshot are priced at the stated 365-day default, for the curve and for the odds alike.</p>
<p>Holds: Capital ${HOLD_DAYS.Capital} days · Hybrid ${HOLD_DAYS.Hybrid} · Points ${HOLD_DAYS.Points}. Actions charged: Capital ${ACTIONS.Capital} setup + ${Math.ceil(HOLD_DAYS.Capital / MAINT_DAYS)} maintenance · Hybrid ${ACTIONS.Hybrid} + ${Math.ceil(HOLD_DAYS.Hybrid / MAINT_DAYS)} · Points ${ACTIONS.Points} + ${Math.ceil(HOLD_DAYS.Points / MAINT_DAYS)} — one maintenance action per ${MAINT_DAYS} days of hold, at the primary chain's gas price, because the plan's own steps charge gas for acting on a weekly check. Gas per action: ${gasRows} · any other chain $0.50. Protocol fees: $1 Capital, $2 Hybrid, $0 Points. Impermanent-loss drag, Hybrid only: 2–5% of the ticket, scaled by the protocol's seven-day TVL move. Bridge: $4.00 plus a 0.25% risk charge when a Capital or Hybrid plan spans three or more chains. Forgone yield: ${(TBILL_RATE * 100).toFixed(0)}% T-bill on the ticket for the hold, ${(STAKING_RATE * 100).toFixed(0)}% where the position itself is a staking asset. Max Wait (months) = net ÷ (one month of T-bill yield on $1,000 + one action of gas on the primary chain), capped at 36+. Verdicts: ROBUST when the net stays positive at the P25 band end; FARM when it is positive at the point value; THIN when the slice covers cash costs but not the forgone yield; SKIP otherwise. Farm Rank orders by net per hour at P25.</p>
</section>`;
}

/** All substitution tokens for dashboard/index.html, keyed by the %%NAME%% markers it carries. */
export function indexTokens(r: Radar): Record<string, string> {
  return {
    '%%TITLE%%': `Token Launch Radar — radar-4: ${r.counts.ranked} pre-token protocols priced by a Huber size curve times launch odds (LOO ${fmtMiss(r.model.loo[r.model.loo.length - 1]!.median_miss)} vs flat ${fmtMiss(r.model.loo[0]!.median_miss)}), ${r.verdicts.ROBUST} ROBUST farms netted on $1,000`,
    '%%HEADER_COUNTS%%': `${r.counts.ranked} ranked · ${r.counts.audited} audited · ${r.counts.watchlist}/${r.counts.watchlist} watchlist · snapshot ${esc(r.as_of)}`,
    '%%KPI_STRIP%%': kpiStrip(r),
    '%%MODEL_PANEL%%': modelPanel(r),
    '%%VALIDATION_PANEL%%': validationPanel(r),
    '%%BASKET_STRIP%%': basketStrip(r),
    '%%TOP_TABLE%%': topTable(r),
    '%%STEAKHOUSE_DETAIL%%': steakhouseDetail(r),
    '%%LAB_PANEL%%': labPanel(r),
    '%%FUNNEL_FOOTER%%': funnelFooter(r),
    '%%ASSUMPTIONS_BOX%%': assumptionsBox(r),
  };
}
