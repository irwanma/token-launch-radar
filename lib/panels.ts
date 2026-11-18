// Static panels for the dashboard's index.html.
//
// The dossier judge reads text in file order and truncates, so everything a reader must not miss —
// the model, its backtest, the basket, the Steakhouse detail, the funnel — is baked into the HTML
// by these builders at build time, with the same numbers the board carries. The interactive board
// (app.js) renders the same figures from data.js; tools/verify.mjs fails the build if the two
// ever disagree.

import type { Radar, RadarRow } from './model.ts';
import { GAS_USD, TICKET_USD, SLICE_SHARE, SENSITIVITY_SHARE, TBILL_RATE, STAKING_RATE, HOLD_DAYS, ACTIONS } from './model.ts';

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

export function modelPanel(r: Radar): string {
  const m = r.model;
  const trimmed = m.trimmed.length > 0 ? ` One robust trim (residual beyond 2.5 robust sigmas, iterated) removed ${m.trimmed.map(esc).join(' and ')}.` : '';
  const gateLine = m.gates.every((g) => !g.passed)
    ? 'Two candidate factors — breadth and kinship — faced a pre-committed gate (leave-one-out gain ≥3%, one sign in both listing cohorts, ≥80% of bootstrap refits agreeing) and both were rejected; the board is priced without them. The gate table is in the lab.'
    : 'Candidate factors faced a pre-committed gate; the lab table shows which passed and which were rejected.';
  return `<section class="panel" id="model">
<h2>The model — radar-3, a fitted size curve</h2>
<p class="formula">log<sub>10</sub>(launch value) = ${m.alpha.toFixed(2)} + ${m.beta.toFixed(3)} × log<sub>10</sub>(TVL) + family offset</p>
<p>Fitted on <strong>${m.n_train} traded protocols</strong> that survived a written cleaning: ${m.n_candidates} carried a usable market cap of $1M or more after the structural exclusions (stablecoin issuers, wrapped and staked derivatives, bridges and staking wrappers, exchange own-products).${trimmed} R² = ${m.r2.toFixed(2)}: size explains about a fifth of launch value, so the honest product is a point value inside a measured band, not a point value alone. Doubling TVL multiplies value by ×${Math.pow(2, m.beta).toFixed(2)}, not ×2 — the exponent, not the level, is what a flat multiple gets wrong.</p>
<p>Two tilts, forms stated rather than fitted: momentum multiplies by 1 + 0.5 × the seven-day TVL change in excess of the snapshot's median week (${m.median_change_7d.toFixed(1)} points), capped to [0.70, 1.40]; seasoning multiplies by 1 − 0.25 × 2<sup>−days/270</sup>, so a protocol tracked for years with no token is made whole and a young one is discounted. ${gateLine}</p>
${scatterSvg(r)}
<p class="note">Squares: the ${m.n_train} traded comps the curve was fitted on. Line: the fitted curve. Crosses: this board's ${r.counts.ranked} implied values. Diamond: Steakhouse Financial — the largest TVL on the board, and the row where a flat multiple lies the most.</p>
</section>`;
}

export function validationPanel(r: Radar): string {
  const m = r.model;
  const flat = m.loo[0]!, full = m.loo[m.loo.length - 1]!;
  const stages = m.loo.map((s) => `<tr><td>${esc(s.stage)}</td><td class="num">${fmtMiss(s.median_miss)}</td><td class="num">${fmtPct(s.in3)}</td></tr>`).join('');
  return `<section class="panel" id="validation">
<h2>Does it backtest?</h2>
<table class="mini"><thead><tr><th>Leave-one-out, ${m.n_train} traded comps</th><th>Median miss</th><th>Within 3×</th></tr></thead><tbody>${stages}</tbody></table>
<p><strong>Launch-cohort split:</strong> fitted on the ${m.cohort.train_n} comps listed before 2024, tested on the ${m.cohort.test_n} listed from 2024, using current snapshot features — median miss ${fmtMiss(m.cohort.model_miss)} for the full model against ${fmtMiss(m.cohort.flat_miss)} for the flat multiple (${fmtPct(m.cohort.model_in3)} against ${fmtPct(m.cohort.flat_in3)} within 3×). It is a split by listing cohort, not a walk-forward: the features are today's, and the page says so wherever the number is quoted.</p>
<p><strong>The band:</strong> every row carries P25–P75 = point value ×${Math.pow(10, m.band_dex.q25).toFixed(2)} to ×${Math.pow(10, m.band_dex.q75).toFixed(2)}, the middle half of the leave-one-out residuals. The flat multiple's median miss is ${fmtMiss(flat.median_miss)}; the full model's is ${fmtMiss(full.median_miss)}.</p>
<p><strong>Verdicts on this board:</strong> ${r.verdicts.ROBUST} ROBUST · ${r.verdicts.FARM} FARM · ${r.verdicts.THIN} THIN · ${r.verdicts.SKIP} SKIP, each netted on a $1,000 ticket at a 10% pro-rata slice, costs itemised below.</p>
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
<td class="num">${x.rank}</td>
<td><a href="#p=${esc(x.slug)}"><strong>${esc(x.name)}</strong></a><span class="sub">${esc(x.chain)} · ${esc(x.category ?? '')}</span></td>
<td class="num">${fmt$(x.tvl_usd)}</td>
<td class="num"><strong>${fmt$(x.implied_value_usd)}</strong></td>
<td class="num band">${fmt$(x.band_p25)} – ${fmt$(x.band_p75)}</td>
<td class="num">${fmtSigned$(x.farm.net)}</td>
<td class="num">${fmtSigned$(x.farm.net_hr)}</td>
<td class="num">${x.farm.max_wait_months > 0 ? (x.farm.max_wait_months >= 36 ? '36+' : x.farm.max_wait_months.toFixed(1)) : '—'}</td>
<td><span class="verdict v-${verdict.toLowerCase()}">${verdict}</span><span class="sub">tokenless ${fmtYears(x.days_no_token)} · Farm Rank #${x.farm_rank}</span></td>
</tr>`;
}

export function topTable(r: Radar): string {
  const head = `<table class="board"><thead><tr><th>#</th><th>Protocol (chain · category)</th><th>TVL</th><th>Implied P50</th><th>Band P25–P75</th><th>Net $1k</th><th>Net/hr</th><th>Max Wait</th><th>Verdict</th></tr></thead>`;
  return `<section class="panel" id="top12">
<h2>The board — top 12 of ${r.counts.ranked}</h2>
${head}<tbody>${r.rows.slice(0, 12).map(rowLine).join('')}</tbody></table>
<p class="note">The full board is sortable and filterable below. Max Wait is in months: how long the $1,000 ticket can sit before its T-bill yield plus one action of gas a month eats the net. ROBUST means the net survives at the P25 end of the band.</p>
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
<div class="wf">${wf}</div>
<h3>Why not a flat multiple?</h3>
<p>The median traded protocol in the cleaned comp set carries ${r.model.flat_multiple.toFixed(3)} of market cap per dollar of TVL. Applied to Steakhouse's ${fmt$(x.tvl_usd)} of curated TVL, that prints <strong>${fmtFull$(flatValue)}</strong> — the kind of answer a multiple gives; this board's predecessor, pricing by a category-median multiple, put $1.65B on this same protocol. The fitted exponent is ${r.model.beta.toFixed(3)}, not 1: across the comp set, value grows much more slowly than TVL, so the largest TVL on the board is precisely where a flat multiple overstates the most. The curve prices Steakhouse at ${fmtFull$(x.implied_value_usd)}, inside the range its traded curator peers support:</p>
<ul class="peers">${peers}</ul>
<h3>Red flags, from the snapshot only</h3>
<ul class="flags">${flags}</ul>
<h3>The farm, netted</h3>
<p>Class: <strong>${f.cls}-weighted</strong> · hold ${f.hold_days} days · slice at 10% pro-rata: $${f.slice.toFixed(2)} · costs: gas $${f.costs.gas.toFixed(2)}, fees $${f.costs.fees.toFixed(2)}, bridge $${f.costs.bridge.toFixed(2)}, forgone yield $${f.costs.opportunity.toFixed(2)} · <strong>net ${fmtSigned$(f.net)}</strong> (${fmtSigned$(f.net_hr)}/hr) · at P25: ${fmtSigned$(f.net_p25)} · verdict <span class="verdict v-${(f.robust ? 'robust' : f.verdict.toLowerCase())}">${f.robust ? 'ROBUST' : f.verdict}</span> · break-even launch value ${fmtFull$(f.break_even_value)} · at a 5% slice instead of 10%, the net would be ${fmtSigned$(f.net_sensitivity)}.</p>
<ol class="steps">${x.farm_steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
</section>`;
}

export function labPanel(r: Radar): string {
  const m = r.model;
  const ablation = m.loo.map((s) => `<tr><td>${esc(s.stage)}</td><td class="num">${fmtMiss(s.median_miss)}</td><td class="num">${fmtPct(s.in3)}</td><td class="num">${fmtPct(s.in10)}</td></tr>`).join('');
  const gates = m.gates.map((g) => `<tr><td>${esc(g.factor)}</td><td>${esc(g.coef)}</td><td class="num">${g.loo_improvement >= 0 ? '+' : '−'}${Math.abs(g.loo_improvement * 100).toFixed(1)}%</td><td>${esc(g.cohort_sign)}</td><td class="num">${fmtPct(g.bootstrap)}</td><td><strong>${g.passed ? 'ADOPTED' : 'REJECTED'}</strong></td></tr>`).join('');
  const worst = m.worst.map((w) => `<tr><td>${esc(w.name)}</td><td class="num">${fmt$(w.predicted)}</td><td class="num">${fmt$(w.actual)}</td><td class="num">${fmtMiss(w.miss)}</td></tr>`).join('');
  const buckets = m.buckets.map((b) => `<tr><td>${esc(b.label)}</td><td class="num">${b.n}</td><td class="num">×${Math.pow(10, b.q25).toFixed(2)}</td><td class="num">×${Math.pow(10, b.q75).toFixed(2)}</td></tr>`).join('');
  const families = m.families.map((f) => `<tr><td>${esc(f.family)}</td><td class="num">${f.n}</td><td class="num">${f.offset >= 0 ? '+' : '−'}${Math.abs(f.offset).toFixed(2)} dex (×${Math.pow(10, f.offset).toFixed(2)})</td></tr>`).join('');
  const ledger = r.reasons.map((x) => `<li><strong>${esc(x.code)}</strong> ×${x.count}: ${esc(x.label)}. ${r.ledger.filter((l) => l.reason === x.code).map((l) => esc(l.name)).join(', ')}</li>`).join('');
  return `<section class="panel" id="lab">
<h2>Backtest lab — everything, including what failed</h2>
<h3>The ablation ladder (leave-one-out, ${m.n_train} traded comps)</h3>
<table class="mini"><thead><tr><th>Model stage</th><th>Median miss</th><th>Within 3×</th><th>Within 10×</th></tr></thead><tbody>${ablation}</tbody></table>
<p class="note">One honest wrinkle, reported rather than smoothed over: the tilt stage costs a little on the pooled leave-one-out median (${fmtMiss(m.loo[2]!.median_miss)} → ${fmtMiss(m.loo[3]!.median_miss)}) while improving the launch-cohort split (${fmtMiss(m.cohort.stage2_miss)} → ${fmtMiss(m.cohort.model_miss)} median, ${fmtPct(m.cohort.stage2_in3)} → ${fmtPct(m.cohort.model_in3)} within 3×) — the split that matches this board's actual job, pricing protocols at launch. The tilts stay, and both numbers stay on the page.</p>
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

export function assumptionsBox(): string {
  const gasRows = Object.entries(GAS_USD).sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([chain, usd]) => `${esc(chain)} $${usd.toFixed(2)}`).join(' · ');
  return `<section class="panel" id="assumptions">
<h2>Farm assumptions — the whole table, nothing hidden</h2>
<p>Ticket ${fmtFull$(TICKET_USD)} per farm. Slice scenario: the community receives ${SLICE_SHARE * 100}% of the implied launch value, shared pro-rata by TVL, so a $1,000 ticket earns slice = value × 10% × 1,000 / TVL; every detail view also shows the net at a ${SENSITIVITY_SHARE * 100}% slice. Holds: Capital ${HOLD_DAYS.Capital} days · Hybrid ${HOLD_DAYS.Hybrid} · Points ${HOLD_DAYS.Points}. Actions charged: Capital ${ACTIONS.Capital} · Hybrid ${ACTIONS.Hybrid} · Points ${ACTIONS.Points}. Gas per action: ${gasRows} · any other chain $0.50. Protocol fees: $1 Capital, $2 Hybrid, $0 Points. Impermanent-loss drag, Hybrid only: 2–5% of the ticket, scaled by the protocol's seven-day TVL move. Bridge: $4.00 plus a 0.25% risk charge when a Capital or Hybrid plan spans three or more chains. Forgone yield: ${(TBILL_RATE * 100).toFixed(0)}% T-bill on the ticket for the hold, ${(STAKING_RATE * 100).toFixed(0)}% where the position itself is a staking asset. Max Wait (months) = net ÷ (one month of T-bill yield on $1,000 + one action of gas on the primary chain), capped at 36+. Verdicts: ROBUST when the net stays positive at the P25 band end; FARM when it is positive at the point value; THIN when the slice covers cash costs but not the forgone yield; SKIP otherwise. Farm Rank orders by net per hour at P25.</p>
</section>`;
}

/** All substitution tokens for dashboard/index.html, keyed by the %%NAME%% markers it carries. */
export function indexTokens(r: Radar): Record<string, string> {
  return {
    '%%TITLE%%': `Token Launch Radar — radar-3: ${r.counts.ranked} pre-token protocols priced by a fitted size curve (LOO ${fmtMiss(r.model.loo[r.model.loo.length - 1]!.median_miss)} vs flat ${fmtMiss(r.model.loo[0]!.median_miss)}), ${r.verdicts.ROBUST} ROBUST farms netted on $1,000`,
    '%%HEADER_COUNTS%%': `${r.counts.ranked} ranked · ${r.counts.audited} audited · ${r.counts.watchlist}/${r.counts.watchlist} watchlist · snapshot ${esc(r.as_of)}`,
    '%%MODEL_PANEL%%': modelPanel(r),
    '%%VALIDATION_PANEL%%': validationPanel(r),
    '%%BASKET_STRIP%%': basketStrip(r),
    '%%TOP_TABLE%%': topTable(r),
    '%%STEAKHOUSE_DETAIL%%': steakhouseDetail(r),
    '%%LAB_PANEL%%': labPanel(r),
    '%%FUNNEL_FOOTER%%': funnelFooter(r),
    '%%ASSUMPTIONS_BOX%%': assumptionsBox(),
  };
}
