// Consistency gate for the Token Launch Radar entry.
//
// Recomputes from the written outputs (board.json + data.js + dashboard/index.html) and exits
// non-zero on the first family of disagreements it finds. This is the check the blueprint
// demands: no number on the page may disagree with the board, the funnel must sum, every net
// must equal its slice minus its itemised costs, the band must match the leave-one-out
// quantiles the model reported, and the basket total must equal the sum of its components.
//
// Usage: node tools/verify.mjs --output <folder> [--snapshot <snapshot.json>]

import { readFile } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const argv = process.argv.slice(2);
const flag = (name) => { const at = argv.indexOf(name); return at >= 0 ? argv[at + 1] : undefined; };
const out = resolve(flag('--output') ?? process.env.MAKEFUN_OUTPUT_DIR ?? '/output');
const kitInput = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'token-radar-01-kit', 'input', 'snapshot.json');
const snapshotPath = flag('--snapshot') ?? kitInput;

const failures = [];
const fail = (msg) => failures.push(msg);
const near = (a, b, tol) => Math.abs(a - b) <= tol;

const board = JSON.parse(await readFile(join(out, 'board.json'), 'utf8'));
const dataJs = await readFile(join(out, 'data.js'), 'utf8');
const radar = JSON.parse(dataJs.replace(/^window\.RADAR = /, '').replace(/;\s*$/, ''));
const html = await readFile(join(out, 'dashboard', 'index.html'), 'utf8');
const snapshot = JSON.parse(await readFile(snapshotPath, 'utf8'));

// 1. The funnel sums, three ways.
const c = radar.counts;
if (c.audited !== snapshot.protocols.length) fail(`funnel: audited ${c.audited} != snapshot ${snapshot.protocols.length}`);
if (c.tokened + c.no_token !== c.audited) fail(`funnel: tokened ${c.tokened} + no-token ${c.no_token} != audited ${c.audited}`);
if (c.ranked + c.set_aside !== c.no_token) fail(`funnel: ranked ${c.ranked} + set aside ${c.set_aside} != no-token ${c.no_token}`);
if (radar.ledger.length !== c.set_aside) fail(`funnel: ledger holds ${radar.ledger.length} rows, counts say ${c.set_aside}`);
const reasonSum = radar.reasons.reduce((a, r) => a + r.count, 0);
if (reasonSum !== c.set_aside) fail(`funnel: reason counts sum to ${reasonSum}, not ${c.set_aside}`);
if (board.length !== c.ranked) fail(`funnel: board.json holds ${board.length} rows, counts say ${c.ranked}`);

// 2. board.json and data.js describe the same board.
const dataBySlug = new Map(radar.rows.map((r) => [r.slug, r]));
for (const b of board) {
  const d = dataBySlug.get(b.slug);
  if (!d) { fail(`board/data: ${b.slug} missing from data.js`); continue; }
  if (d.rank !== b.rank || d.implied_value_usd !== b.implied_value_usd) fail(`board/data: ${b.slug} rank or value differs`);
  if (JSON.stringify(d.farm_steps) !== JSON.stringify(b.farm_steps)) fail(`board/data: ${b.slug} farm steps differ`);
  if (!(d.rank_lo <= d.rank && d.rank <= d.rank_hi)) fail(`board/data: ${b.slug} rank ${d.rank} outside its bootstrap range ${d.rank_lo}–${d.rank_hi}`);
  if (!Number.isInteger(d.rank_lo) || !Number.isInteger(d.rank_hi)) fail(`board/data: ${b.slug} rank range is not whole numbers`);
}

// 3. Every net is its slice minus its itemised costs; verdicts follow their definitions.
for (const r of radar.rows) {
  const f = r.farm;
  const costSum = f.costs.gas + f.costs.fees + f.costs.il + f.costs.bridge + f.costs.opportunity + f.costs.maintenance;
  if (!near(f.costs.total, costSum, 0.011)) fail(`net: ${r.slug} itemised costs sum to ${costSum.toFixed(2)}, total says ${f.costs.total.toFixed(2)}`);
  if (!near(f.net, f.slice - f.costs.total, 0.011)) fail(`net: ${r.slug} net ${f.net.toFixed(2)} != slice ${f.slice.toFixed(2)} - costs ${f.costs.total.toFixed(2)}`);
  const slice = (r.implied_value_usd * 0.10 * 1000) / r.tvl_usd;
  if (!near(f.slice, slice, 0.011)) fail(`net: ${r.slug} slice ${f.slice.toFixed(2)} != 10% pro-rata ${slice.toFixed(2)}`);
  const verdict = f.net > 0 ? 'FARM' : f.slice > f.costs.total - f.costs.opportunity ? 'THIN' : 'SKIP';
  if (f.verdict !== verdict) fail(`verdict: ${r.slug} says ${f.verdict}, its numbers say ${verdict}`);
  if (f.robust !== (f.net_p25 > 0)) fail(`verdict: ${r.slug} ROBUST flag disagrees with its P25 net`);
  if (!near(f.net_p25, (r.band_p25 * 0.10 * 1000) / r.tvl_usd - f.costs.total, 0.02)) fail(`net: ${r.slug} P25 net inconsistent with its P25 band value`);
}

// 4. The band is the model's reported leave-one-out quantiles, applied uniformly.
const loMult = Math.pow(10, radar.model.band_dex.q25);
const hiMult = Math.pow(10, radar.model.band_dex.q75);
for (const r of radar.rows) {
  if (!near(r.band_p25, r.implied_value_usd * loMult, Math.max(2, r.implied_value_usd * 0.002))) fail(`band: ${r.slug} P25 ${r.band_p25} != value x ${loMult.toFixed(3)}`);
  if (!near(r.band_p75, r.implied_value_usd * hiMult, Math.max(2, r.implied_value_usd * 0.002))) fail(`band: ${r.slug} P75 ${r.band_p75} != value x ${hiMult.toFixed(3)}`);
}

// 5. Farm Rank is the order of net-per-hour at P25; divergence is rank minus farm rank.
const byFarm = [...radar.rows].sort((a, b) => b.farm.net_hr_p25 - a.farm.net_hr_p25 || (a.slug < b.slug ? -1 : 1));
byFarm.forEach((r, i) => {
  if (r.farm_rank !== i + 1) fail(`farm rank: ${r.slug} says #${r.farm_rank}, recomputed #${i + 1}`);
  if (r.divergence !== r.rank - r.farm_rank) fail(`farm rank: ${r.slug} divergence ${r.divergence} != ${r.rank - r.farm_rank}`);
});

// 6. The basket total is the sum of its components.
const basketRows = radar.basket.slugs.map((s) => dataBySlug.get(s));
if (basketRows.some((r) => !r)) fail('basket: a member slug is missing from the board');
else {
  const sum = basketRows.reduce((a, r) => a + r.farm.net, 0);
  if (!near(radar.basket.total_net, sum, 0.011)) fail(`basket: total ${radar.basket.total_net.toFixed(2)} != sum of members ${sum.toFixed(2)}`);
  const wk = basketRows.reduce((a, r) => a + r.farm.weekly_minutes, 0);
  if (radar.basket.weekly_minutes !== wk) fail(`basket: weekly minutes ${radar.basket.weekly_minutes} != ${wk}`);
  if (!basketRows.every((r) => r.farm.robust)) fail('basket: a member is not ROBUST');
  const cats = new Set(basketRows.map((r) => r.category));
  if (cats.size !== basketRows.length) fail('basket: members are not diversified by category');
}

// 7. Verdict tallies match the rows (display tallies are disjoint: ROBUST is not also FARM).
const tally = { FARM: 0, THIN: 0, SKIP: 0, ROBUST: 0 };
for (const r of radar.rows) { if (r.farm.robust) tally.ROBUST++; else tally[r.farm.verdict]++; }
for (const k of Object.keys(tally)) if (radar.verdicts[k] !== tally[k]) fail(`tally: ${k} says ${radar.verdicts[k]}, rows give ${tally[k]}`);

// 8. The static HTML carries the same headline numbers as data.js.
const mustContain = [
  `${c.ranked} ranked · ${c.audited} audited`,
  radar.model.alpha.toFixed(2),
  radar.model.beta.toFixed(3),
  `×${radar.model.loo[radar.model.loo.length - 1].median_miss.toFixed(2)}`,
  `×${radar.model.loo[0].median_miss.toFixed(2)}`,
  `${tally.ROBUST} ROBUST`,
];
for (const s of mustContain) if (!html.includes(s)) fail(`html: missing "${s}"`);
const stk = dataBySlug.get('steakhouse-financial');
if (stk) {
  const full = `$${Math.round(stk.implied_value_usd).toLocaleString('en-US')}`;
  if (!html.includes(full)) fail(`html: Steakhouse value ${full} not found in the static detail`);
  const flat = `$${Math.round(radar.model.flat_multiple * stk.tvl_usd).toLocaleString('en-US')}`;
  if (!html.includes(flat)) fail(`html: Steakhouse flat-multiple figure ${flat} not found`);
}

// 9. The dossier on disk has the vendor shape and carries the model text inside its window
// (byte equality with a fresh buildDossier is exercised by re-running main and diffing).
const dossier = JSON.parse(await readFile(join(out, 'dossier.json'), 'utf8'));
if (typeof dossier.text !== 'string' || !Array.isArray(dossier.images)) fail('dossier: missing text or images');
else {
  if (!dossier.text.includes('## Dashboard')) fail('dossier: text does not open with the Dashboard block');
  if (!dossier.text.includes(radar.model.alpha.toFixed(2))) fail('dossier: model alpha not inside the dossier text window');
}

if (failures.length > 0) {
  console.error(`verify: ${failures.length} disagreement(s):`);
  for (const f of failures.slice(0, 25)) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`verify: OK — funnel sums (${c.audited} = ${c.tokened} + ${c.no_token}; ${c.no_token} = ${c.ranked} + ${c.set_aside}), ${board.length} rows netted and banded consistently, basket total = sum of ${radar.basket.slugs.length} members, static HTML matches data.js.`);
