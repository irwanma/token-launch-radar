// Token Launch Radar v2 — model "radar-3" (Node 22, standard library only).
//
// What this file does, in order:
//   1. Coverage: the snapshot's 758 protocols are accounted for to the last one — 416 record a
//      token and become the reference set, 342 record none and are audited for the board; written
//      exclusion rules (below) set some of the 342 aside with a reason code, the rest are ranked.
//      The house watchlist (40 slugs) is always ranked: coverage is a mandate, not a model choice.
//   2. The value model: a log-log size curve fitted on the traded protocols that survive a written
//      cleaning (structural exclusions, then one robust trim), plus family offsets shrunk toward
//      zero, plus two bounded tilts (momentum, seasoning) whose form is stated, not fitted.
//      Two candidate factors (breadth, kinship) face a pre-committed gate and are reported either
//      way. Every figure the dashboard shows is recomputed here from the snapshot alone.
//   3. Validation: leave-one-out as the primary test, a launch-cohort split as the second, an
//      ablation ladder, and the ten worst leave-one-out misses by name.
//   4. The farm engine: each ranked protocol is classified by mechanism, priced on a $1,000 ticket
//      at a stated 10% pro-rata community slice, and charged itemised costs from a stated
//      assumptions table, so every net on the page is gross minus named costs.
//
// Nothing here reads the clock or a random source: the bootstrap uses a seeded generator, so two
// runs of the entry write the same bytes.

/** One protocol of the sealed snapshot, exactly the ten fields the house froze. */
export interface Protocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

export interface Snapshot {
  as_of: string;
  floor_usd: number;
  protocols: Protocol[];
  watchlist: string[];
}

/** Parse and lightly validate the sealed snapshot; throws on a shape this entry cannot read. */
export function parseSnapshot(text: string): Snapshot {
  const raw = JSON.parse(text) as Snapshot;
  if (typeof raw.as_of !== 'string' || !Array.isArray(raw.protocols) || !Array.isArray(raw.watchlist)) {
    throw new Error('snapshot: expected as_of, protocols and watchlist');
  }
  for (const p of raw.protocols) {
    if (typeof p.slug !== 'string' || typeof p.tvl_usd !== 'number' || !Array.isArray(p.chains)) {
      throw new Error(`snapshot: protocol ${String(p.slug)} is missing slug, tvl_usd or chains`);
    }
  }
  return raw;
}

// ---------------------------------------------------------------------------
// Written rules. Every exclusion below names its reason code; the dashboard's
// ledger lists each set-aside protocol under exactly one code, in this order.
// ---------------------------------------------------------------------------

/** Categories whose TVL is transit or custody value, not a launch candidate's own record. */
const INFRA_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Cross Chain Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);
/** Categories whose market cap is a peg's supply, never a valuation: refused as pricing comps. */
const STABLE_ISSUER_CATEGORIES = new Set(['Stablecoin Issuer', 'Dual-Token Stablecoin', 'Algo-Stables']);
const EXCHANGE_PREFIXES = ['Binance', 'Coinbase', 'Bybit', 'Kraken', 'Bitget', 'OKX', 'Bitfinex', 'Gemini'];

const isDerivativeName = (p: Protocol): boolean => /\b(wrapped|staked|staking)\b/i.test(p.name);
const isVersionedName = (p: Protocol): boolean => /\s(V2|v2|2\.0|V3|v3)\s*$/.test(p.name);
const isExchangeName = (p: Protocol): boolean => EXCHANGE_PREFIXES.some((e) => p.name.startsWith(`${e} `) || p.name === e);

/** The board's exclusion test for a non-watchlist protocol; returns its reason code or null. */
function boardExclusion(p: Protocol): string | null {
  if (INFRA_CATEGORIES.has(p.category ?? '')) return 'INFRA';
  if (isDerivativeName(p)) return 'DERIV';
  if (isVersionedName(p)) return 'VERSION';
  if (isExchangeName(p)) return 'EXCHANGE';
  return null;
}

export const REASON_LABELS: Record<string, string> = {
  INFRA: 'Bridge, staking or exchange category: its TVL is transit or custody value, not a launch record',
  DERIV: 'Wrapped or staked product of a token that already trades',
  VERSION: 'A versioned instance of a protocol the board ranks under its main name',
  EXCHANGE: "An exchange's own product, named for the exchange",
};

/** A protocol records a token when DefiLlama carries either of its two token fields. */
const recordsToken = (p: Protocol): boolean => p.gecko_id != null || p.symbol != null;

/** Category families: the snapshot's own categories grouped for offsets and peer search. */
const FAMILY_BY_CATEGORY: Record<string, string> = {
  'Lending': 'Lending & CDP', 'CDP': 'Lending & CDP', 'CDP Manager': 'Lending & CDP',
  'Uncollateralized Lending': 'Lending & CDP', 'Collateral Markets': 'Lending & CDP',
  'Dexs': 'Trading', 'Derivatives': 'Trading', 'Options': 'Trading', 'Options Vault': 'Trading',
  'Prediction Market': 'Trading', 'OTC Marketplace': 'Trading', 'Interest Rate Derivatives': 'Trading',
  'NFT Marketplace': 'Trading',
  'Yield': 'Vaults & yield', 'Yield Aggregator': 'Vaults & yield', 'Risk Curators': 'Vaults & yield',
  'Onchain Capital Allocator': 'Vaults & yield', 'Liquidity Manager': 'Vaults & yield',
  'Indexes': 'Vaults & yield', 'Farm': 'Vaults & yield', 'Leveraged Farming': 'Vaults & yield',
  'RWA': 'RWA & stables', 'Basis Trading': 'RWA & stables',
  'Liquid Staking': 'Staking', 'Staking Pool': 'Staking', 'Restaking': 'Staking',
  'Liquid Restaking': 'Staking', 'Restaked BTC': 'Staking', 'Anchor BTC': 'Staking', 'Decentralized BTC': 'Staking',
  'Chain': 'Infra & chains', 'Bridge': 'Infra & chains', 'Canonical Bridge': 'Infra & chains',
  'Cross Chain Bridge': 'Infra & chains', 'Payments': 'Infra & chains', 'Privacy': 'Infra & chains',
  'Launchpad': 'Infra & chains', 'Token Locker': 'Infra & chains', 'Insurance': 'Infra & chains',
  'Synthetics': 'Infra & chains', 'Governance Incentives': 'Infra & chains', 'Crypto Card Issuer': 'Infra & chains',
  'CeDeFi': 'Infra & chains', 'Collateral Management': 'Infra & chains', 'DOR': 'Infra & chains',
  'AI Agents': 'Infra & chains', 'Decentralized AI': 'Infra & chains', 'CEX': 'Infra & chains',
};
export const familyOf = (p: Protocol): string => FAMILY_BY_CATEGORY[p.category ?? ''] ?? 'Other';

// ---------------------------------------------------------------------------
// Small deterministic statistics.
// ---------------------------------------------------------------------------

const median = (xs: number[]): number => {
  const a = [...xs].sort((m, n) => m - n);
  return a.length % 2 === 1 ? a[(a.length - 1) / 2]! : (a[a.length / 2 - 1]! + a[a.length / 2]!) / 2;
};
const quantile = (xs: number[], q: number): number => {
  const a = [...xs].sort((m, n) => m - n);
  const at = (a.length - 1) * q, lo = Math.floor(at), hi = Math.ceil(at);
  return a[lo]! + (a[hi]! - a[lo]!) * (at - lo);
};
const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));

/** mulberry32: a tiny seeded generator, so the bootstrap refits are the same on every run. */
function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// The value model.
// ---------------------------------------------------------------------------

export interface Fit {
  alpha: number;
  beta: number;
  r2: number;
  offsets: Map<string, number>;
  breadthCoef: number;
  kinshipCoef: number;
}

const DAY_MS = 86_400_000;

/** Days the snapshot has tracked the protocol (listed_at against as_of, never the wall clock). */
function trackedDays(p: Protocol, asOfMs: number): number {
  if (p.listed_at == null) return 365; // unstated age prices as one year; the default is named wherever it bites
  return Math.max(0, Math.round((asOfMs - Date.parse(`${p.listed_at}T00:00:00Z`)) / DAY_MS));
}

/** Bounded momentum tilt: seven-day TVL change against the snapshot's own median week. */
function momentumFactor(p: Protocol, medianChange: number): number {
  const rel = ((p.change_7d ?? medianChange) - medianChange) / 100;
  return clamp(1 + 0.5 * rel, 0.7, 1.4);
}

/** Bounded seasoning tilt: a young record is discounted, a long one is made whole. */
function seasoningFactor(p: Protocol, asOfMs: number): number {
  return 1 - 0.25 * Math.pow(2, -trackedDays(p, asOfMs) / 270);
}

function ols(rows: Protocol[]): { alpha: number; beta: number; r2: number } {
  const xs = rows.map((p) => Math.log10(p.tvl_usd));
  const ys = rows.map((p) => Math.log10(p.mcap_usd!));
  const mx = mean(xs), my = mean(ys);
  let sxy = 0, sxx = 0;
  for (let i = 0; i < xs.length; i++) { sxy += (xs[i]! - mx) * (ys[i]! - my); sxx += (xs[i]! - mx) ** 2; }
  const beta = sxy / sxx, alpha = my - beta * mx;
  const ssr = ys.reduce((a, y, i) => a + (y - (alpha + beta * xs[i]!)) ** 2, 0);
  const sst = ys.reduce((a, y) => a + (y - my) ** 2, 0);
  return { alpha, beta, r2: 1 - ssr / sst };
}

/** Family offsets: mean curve residual per family, shrunk n/(n+4) toward zero, capped at ±0.6 dex. */
function familyOffsets(rows: Protocol[], alpha: number, beta: number): Map<string, number> {
  const by = new Map<string, number[]>();
  for (const p of rows) {
    const r = Math.log10(p.mcap_usd!) - (alpha + beta * Math.log10(p.tvl_usd));
    const k = familyOf(p);
    if (!by.has(k)) by.set(k, []);
    by.get(k)!.push(r);
  }
  const out = new Map<string, number>();
  for (const [k, rs] of by) out.set(k, clamp(mean(rs) * (rs.length / (rs.length + 4)), -0.6, 0.6));
  return out;
}

const NAME_ROOT_STOP = new Set(['the', 'dao', 'money', 'finance', 'protocol', 'network', 'exchange', 'swap', 'labs']);
/** A protocol's family name root: its first name word, version suffix stripped, when it is distinctive. */
function nameRoot(name: string): string | null {
  const first = name.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean)[0] ?? '';
  const root = first.replace(/(v\d|\d\.0)$/, '');
  return root.length >= 4 && !NAME_ROOT_STOP.has(root) ? root : null;
}

/** Whether a traded protocol shares this protocol's name root (a sibling whose token already trades). */
function hasTradedNamesake(p: Protocol, tradedRoots: Map<string, Protocol[]>): boolean {
  const r = nameRoot(p.name);
  if (r == null) return false;
  return (tradedRoots.get(r) ?? []).some((q) => q.slug !== p.slug);
}

interface CandidateCoefs { breadth: number; kinship: number }

/** Candidate coefficients read off a fit's residuals: breadth per extra chain, kinship as a mean shift. */
function candidateCoefs(rows: Protocol[], fit: Fit, tradedRoots: Map<string, Protocol[]>, medianChange: number, asOfMs: number): CandidateCoefs {
  const resid = rows.map((p) => Math.log10(p.mcap_usd!) - Math.log10(predictStage(fit, p, 3, medianChange, asOfMs, false)));
  const xs = rows.map((p) => p.chains.length - 1);
  const mx = mean(xs), mr = mean(resid);
  const denom = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
  const breadth = denom === 0 ? 0 : clamp(xs.reduce((a, x, i) => a + (x - mx) * (resid[i]! - mr), 0) / denom, -0.05, 0.05);
  const kin = rows.map((p) => hasTradedNamesake(p, tradedRoots));
  const kinResid = resid.filter((_, i) => kin[i]), otherResid = resid.filter((_, i) => !kin[i]);
  const kinship = kinResid.length === 0 || otherResid.length === 0 ? 0 : clamp(mean(kinResid) - mean(otherResid), -0.3, 0.3);
  return { breadth, kinship };
}

/** Predict at a ladder stage: 0 flat, 1 curve, 2 +family, 3 +tilts, 4 +gated candidates.
 *  Breadth applies only when the caller says its gate passed; kinship is applied by the
 *  caller, which knows the traded name roots. */
function predictStage(fit: Fit, p: Protocol, stage: number, medianChange: number, asOfMs: number, useBreadth: boolean): number {
  if (stage === 0) return fit.alpha * p.tvl_usd; // stage 0 stores the flat multiple in alpha
  let v = Math.pow(10, fit.alpha + fit.beta * Math.log10(p.tvl_usd));
  if (stage >= 2) v *= Math.pow(10, fit.offsets.get(familyOf(p)) ?? 0);
  if (stage >= 3) v *= momentumFactor(p, medianChange) * seasoningFactor(p, asOfMs);
  if (stage >= 4 && useBreadth) v *= Math.pow(10, clamp(fit.breadthCoef * (p.chains.length - 1), -0.2, 0.2));
  return v;
}

function fitStage(rows: Protocol[], stage: number, medianChange: number, asOfMs: number, tradedRoots: Map<string, Protocol[]>): Fit {
  if (stage === 0) {
    return { alpha: median(rows.map((p) => p.mcap_usd! / p.tvl_usd)), beta: 0, r2: 0, offsets: new Map(), breadthCoef: 0, kinshipCoef: 0 };
  }
  const { alpha, beta, r2 } = ols(rows);
  const fit: Fit = { alpha, beta, r2, offsets: stage >= 2 ? familyOffsets(rows, alpha, beta) : new Map(), breadthCoef: 0, kinshipCoef: 0 };
  if (stage >= 4) {
    const c = candidateCoefs(rows, fit, tradedRoots, medianChange, asOfMs);
    fit.breadthCoef = c.breadth;
    fit.kinshipCoef = c.kinship;
  }
  return fit;
}

const missOf = (pred: number, actual: number): number => Math.max(pred / actual, actual / pred);

interface LooResult { medianMiss: number; in3: number; in10: number; predictions: number[] }

function loo(rows: Protocol[], stage: number, medianChange: number, asOfMs: number, tradedRoots: Map<string, Protocol[]>, gated: { breadth: boolean; kinship: boolean }): LooResult {
  const predictions: number[] = [];
  for (let i = 0; i < rows.length; i++) {
    const rest = rows.filter((_, j) => j !== i);
    const fit = fitStage(rest, stage, medianChange, asOfMs, tradedRoots);
    let v = predictStage(fit, rows[i]!, stage, medianChange, asOfMs, gated.breadth);
    if (stage >= 4 && gated.kinship && hasTradedNamesake(rows[i]!, tradedRoots)) v *= Math.pow(10, fit.kinshipCoef);
    predictions.push(v);
  }
  const misses = predictions.map((v, i) => missOf(v, rows[i]!.mcap_usd!));
  return {
    medianMiss: median(misses),
    in3: misses.filter((m) => m <= 3).length / misses.length,
    in10: misses.filter((m) => m <= 10).length / misses.length,
    predictions,
  };
}

// ---------------------------------------------------------------------------
// The farm engine. Every cost below is an assumption, and the dashboard prints
// the whole table; a row's net is its slice minus these named costs, no more.
// ---------------------------------------------------------------------------

export type MechClass = 'Capital' | 'Points' | 'Hybrid';

const CLASS_BY_CATEGORY: Record<string, MechClass> = {
  'Dexs': 'Points', 'Derivatives': 'Points', 'Options': 'Points', 'Options Vault': 'Points',
  'Prediction Market': 'Points', 'OTC Marketplace': 'Points', 'Interest Rate Derivatives': 'Points',
  'Payments': 'Points', 'Governance Incentives': 'Points', 'Crypto Card Issuer': 'Points',
  'Privacy': 'Points', 'Chain': 'Points', 'NFT Marketplace': 'Points', 'Launchpad': 'Points',
  'Liquidity Manager': 'Hybrid', 'Farm': 'Hybrid', 'Leveraged Farming': 'Hybrid',
};
export const classOf = (p: Protocol): MechClass => CLASS_BY_CATEGORY[p.category ?? ''] ?? 'Capital';

/** Gas per on-chain action, in dollars, by chain — a stated planning assumption, printed on the page. */
export const GAS_USD: Record<string, number> = {
  'Ethereum': 6.0, 'Bitcoin': 1.5, 'BSC': 0.3, 'Avalanche': 0.4, 'Polygon': 0.1, 'Arbitrum': 0.35,
  'Optimism': 0.3, 'Base': 0.25, 'Solana': 0.05, 'zkSync Era': 0.15, 'Linea': 0.2, 'Scroll': 0.2,
  'Mantle': 0.1, 'Ink': 0.25, 'Unichain': 0.2, 'Robinhood Chain': 0.25, 'Monad': 0.1, 'Arc': 0.1,
  'Katana': 0.1, 'Corn': 0.1, 'Hyperliquid L1': 0.05, 'Proton': 0.02,
};
export const GAS_DEFAULT = 0.5;
export const gasOf = (chain: string): number => GAS_USD[chain] ?? GAS_DEFAULT;

export const TICKET_USD = 1000;
export const SLICE_SHARE = 0.10;
export const SENSITIVITY_SHARE = 0.05;
export const TBILL_RATE = 0.04;
export const STAKING_RATE = 0.03;
const STAKING_YIELD_CATEGORIES = new Set(['Staking Pool', 'Restaking', 'Liquid Restaking', 'Restaked BTC', 'Anchor BTC', 'Decentralized BTC']);
export const HOLD_DAYS: Record<MechClass, number> = { Capital: 90, Hybrid: 60, Points: 30 };
export const ACTIONS: Record<MechClass, number> = { Capital: 4, Hybrid: 6, Points: 10 };
export const SETUP_MINUTES: Record<MechClass, number> = { Capital: 45, Hybrid: 90, Points: 120 };
export const WEEKLY_MINUTES: Record<MechClass, number> = { Capital: 10, Hybrid: 25, Points: 45 };
const PROTOCOL_FEE: Record<MechClass, number> = { Capital: 1, Hybrid: 2, Points: 0 };

export interface FarmCalc {
  cls: MechClass;
  chain: string;
  hold_days: number;
  slice: number;
  slice_p25: number;
  costs: { gas: number; fees: number; il: number; bridge: number; opportunity: number; total: number; cash_total: number };
  net: number;
  net_p25: number;
  net_hr: number;
  net_hr_p25: number;
  net_sensitivity: number;
  break_even_value: number;
  max_wait_months: number;
  verdict: 'FARM' | 'THIN' | 'SKIP';
  robust: boolean;
  setup_minutes: number;
  weekly_minutes: number;
  hours: number;
}

function farmCalc(p: Protocol, value: number, bandLoMult: number): FarmCalc {
  const cls = classOf(p);
  const chain = p.chains[0] ?? 'Ethereum';
  const hold = HOLD_DAYS[cls];
  const slice = (value * SLICE_SHARE * TICKET_USD) / p.tvl_usd;
  const sliceP25 = (value * bandLoMult * SLICE_SHARE * TICKET_USD) / p.tvl_usd;
  const gas = ACTIONS[cls] * gasOf(chain);
  const fees = PROTOCOL_FEE[cls];
  const il = cls === 'Hybrid' ? TICKET_USD * clamp(0.02 + Math.abs(p.change_7d ?? 0) / 1000, 0.02, 0.05) : 0;
  const bridge = p.chains.length >= 3 && cls !== 'Points' ? 4 + 0.0025 * TICKET_USD : 0;
  const oppRate = STAKING_YIELD_CATEGORIES.has(p.category ?? '') ? STAKING_RATE : TBILL_RATE;
  const opportunity = (TICKET_USD * oppRate * hold) / 365;
  const cashTotal = gas + fees + il + bridge;
  const total = cashTotal + opportunity;
  const net = slice - total;
  const netP25 = sliceP25 - total;
  const hours = (SETUP_MINUTES[cls] + WEEKLY_MINUTES[cls] * (hold / 7)) / 60;
  const robust = netP25 > 0;
  const verdict: FarmCalc['verdict'] = net > 0 ? 'FARM' : slice > cashTotal ? 'THIN' : 'SKIP';
  return {
    cls, chain, hold_days: hold, slice, slice_p25: sliceP25,
    costs: { gas, fees, il, bridge, opportunity, total, cash_total: cashTotal },
    net, net_p25: netP25, net_hr: net / hours, net_hr_p25: netP25 / hours,
    net_sensitivity: (value * SENSITIVITY_SHARE * TICKET_USD) / p.tvl_usd - total,
    break_even_value: (total * p.tvl_usd) / (SLICE_SHARE * TICKET_USD),
    max_wait_months: net > 0 ? net / ((TICKET_USD * TBILL_RATE) / 12 + gasOf(chain)) : 0,
    verdict, robust,
    setup_minutes: SETUP_MINUTES[cls], weekly_minutes: WEEKLY_MINUTES[cls], hours,
  };
}

// ---------------------------------------------------------------------------
// Farm plan text. The steps are generated from the row's own class, chain and
// figures, so a step's dollars are the same dollars the net was charged.
// ---------------------------------------------------------------------------

const money = (n: number): string => (n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(1)}K` : `$${n.toFixed(0)}`);
const money2 = (n: number): string => `$${n.toFixed(2)}`;

const CORE_ACTION: Record<string, string> = {
  'Dexs': 'swap between two liquid pairs and add a small pool position',
  'Derivatives': 'open and close a small perpetual position with real size',
  'Prediction Market': 'take a small position on a live market',
  'Payments': 'route one real payment through the protocol',
  'Chain': 'bridge a small amount in and use two native applications',
  'Options Vault': 'deposit into one live options vault for a full epoch',
};

function farmSteps(p: Protocol, f: FarmCalc, deep: boolean): string[] {
  const chain = f.chain;
  const gas1 = money2(gasOf(chain));
  const steps: string[] = [];
  const tier = deep ? '' : 'Tier-2 estimate: this plan is templated from the protocol\'s mechanism class, not hand-written. ';
  if (f.cls === 'Capital') {
    steps.push(`${tier}Radar class: Capital-weighted (${p.category ?? 'uncategorised'}). Open ${p.name}'s own app on ${chain}, connect a wallet you control, and work a $${TICKET_USD} ticket over a ${f.hold_days}-day hold. Setup takes about ${f.setup_minutes} minutes.`);
    steps.push(`Deposit $${TICKET_USD} into ${p.name}'s main market on ${chain} and keep the share or receipt balance in the wallet. Cost: ${gas1} gas on ${chain} plus a $${f.costs.fees.toFixed(2)} protocol fee allowance. Time: about 20 minutes.`);
    steps.push(`Record the deposit date and the position size. The radar's net for this row — ${money2(f.net)} — assumes the full ${f.hold_days}-day hold and a ${SLICE_SHARE * 100}% pro-rata community slice of the implied value.`);
    steps.push(`Check the position weekly, about ${f.weekly_minutes} minutes: confirm the protocol's TVL has not fallen by a fifth in a week and no withdrawal queue has formed. Acting on a check costs ${gas1} gas; looking costs nothing.`);
    steps.push(`Claim or compound whatever the protocol itself pays, monthly. Never pay a third party who offers to farm it for you, and never follow a claim link from a message or a comment. Time: about 10 minutes a month.`);
    if (deep) steps.push(`Cross-check the position against the traded peers named on this row's detail view before adding a dollar more: the plan's size is the ticket, not a fraction of the protocol's ${money(p.tvl_usd)} TVL.`);
    steps.push(`If ${p.name} announces a token or a snapshot date, stop adding funds. A launch inside the hold is upside; the net above never counted it.`);
    steps.push(`At day ${f.hold_days}, withdraw the whole position to the wallet on ${chain}. Cost: ${gas1} gas. Time: about 15 minutes. This ticket breaks even at a launch value of ${money(f.break_even_value)}; compare the realised balance with the radar's net of ${money2(f.net)} and keep the difference as the farm's true result.`);
  } else if (f.cls === 'Points') {
    const action = CORE_ACTION[p.category ?? ''] ?? "complete the protocol's core action end to end";
    steps.push(`${tier}Radar class: Points/Action (${p.category ?? 'uncategorised'}). For ${p.name} the binding constraint is hours, not capital: work from one wallet on ${chain} over a ${f.hold_days}-day window, about ${f.setup_minutes} minutes to set up.`);
    steps.push(`Fund the wallet with a small working float on ${chain} — the $${TICKET_USD} ticket is the exposure cap, not an amount to deposit. First session: ${action}. Cost: about ${gas1} gas per action on ${chain}.`);
    steps.push(`Repeat the core action on a weekly rhythm, about ${f.weekly_minutes} minutes a week, varying size and timing like a real user. One wallet, real activity: sybil patterns are what points programs filter first.`);
    steps.push(`Keep a simple log of each session: date, action, gas paid. The radar charges this plan ${ACTIONS.Points} actions of gas (${money2(f.costs.gas)}) plus the cash yield the float gives up, ${money2(f.costs.opportunity)} over the window.`);
    if (deep) steps.push(`Watch the protocol's own announcements weekly for a points program, a season start or a snapshot hint; if none exists by day ${f.hold_days}, the honest result is the log and the lesson, not a bigger float.`);
    steps.push(`Stop at day ${f.hold_days} or when a points season closes, whichever comes first. This ticket breaks even at a launch value of ${money(f.break_even_value)}; below that, the hours were the cost and they are already spent.`);
    steps.push(`If a token launches, claim only from the protocol's official page, typed in by hand. Compare any allocation with the radar's net of ${money2(f.net)} for this row.`);
  } else {
    steps.push(`${tier}Radar class: Hybrid (${p.category ?? 'uncategorised'}): paired liquidity, actively kept. Open ${p.name} on ${chain}, connect a wallet you control, and work a $${TICKET_USD} ticket over a ${f.hold_days}-day hold. Setup takes about ${f.setup_minutes} minutes.`);
    steps.push(`Split the ticket across the pair ${p.name} trades and add liquidity in the range where its volume actually sits. Cost: ${gas1} gas per action on ${chain}, ${ACTIONS.Hybrid} actions charged (${money2(f.costs.gas)}), plus a $${f.costs.fees.toFixed(2)} fee allowance.`);
    steps.push(`The radar charges this plan an impermanent-loss drag of ${money2(f.costs.il)} — ${(100 * f.costs.il / TICKET_USD).toFixed(1)}% of the ticket, scaled from the protocol's seven-day TVL move of ${p.change_7d == null ? 'an unreported week' : `${p.change_7d.toFixed(1)}%`}. If that drag is not a cost you accept, this row is a skip whatever the verdict says.`);
    steps.push(`Rebalance weekly, about ${f.weekly_minutes} minutes: check the position is still in range and the fee take still covers the drag. An out-of-range week earns nothing and still counts against the hold.`);
    if (deep) steps.push(`Keep one bridge crossing in reserve: this plan charges ${money2(f.costs.bridge)} for bridging in and a risk allowance, because the position may need to move chains before the hold ends.`);
    steps.push(`At day ${f.hold_days}, remove the liquidity and settle both assets back to the wallet on ${chain}. Cost: ${gas1} gas. Break-even launch value for this ticket: ${money(f.break_even_value)}; the radar's net is ${money2(f.net)}.`);
    steps.push(`If ${p.name} announces a token or a snapshot date during the hold, stop rebalancing into new ranges and let the position run down to the exit.`);
  }
  return steps.map((t) => t.trim());
}

// ---------------------------------------------------------------------------
// The radar: coverage, fit, validation, board, basket, detail.
// ---------------------------------------------------------------------------

export interface BoardRow {
  slug: string;
  name: string;
  rank: number;
  implied_value_usd: number;
  farm_steps: string[];
}

export interface RadarRow extends BoardRow {
  category: string | null;
  family: string;
  chains: string[];
  chain: string;
  tvl_usd: number;
  change_7d: number | null;
  days_no_token: number;
  watchlist: boolean;
  band_p25: number;
  band_p75: number;
  band_p10: number;
  band_p90: number;
  farm_rank: number;
  divergence: number;
  farm: FarmCalc;
  peers: { name: string; tvl_usd: number; mcap_usd: number }[] | null;
  waterfall: { label: string; value: number }[] | null;
  flags: string[] | null;
}

export interface Radar {
  as_of: string;
  floor_usd: number;
  counts: { audited: number; tokened: number; no_token: number; ranked: number; set_aside: number; watchlist: number };
  reasons: { code: string; label: string; count: number }[];
  ledger: { slug: string; name: string; reason: string }[];
  model: {
    name: string;
    alpha: number; beta: number; r2: number;
    flat_multiple: number;
    n_candidates: number; n_train: number; trimmed: string[];
    median_change_7d: number;
    families: { family: string; n: number; offset: number }[];
    band_dex: { q10: number; q25: number; q75: number; q90: number };
    loo: { stage: string; median_miss: number; in3: number; in10: number }[];
    cohort: { train_n: number; test_n: number; flat_miss: number; model_miss: number; flat_in3: number; model_in3: number; stage2_miss: number; stage2_in3: number };
    worst: { name: string; miss: number; predicted: number; actual: number }[];
    buckets: { label: string; n: number; q25: number; q75: number }[];
    gates: { factor: string; coef: string; loo_improvement: number; cohort_sign: string; bootstrap: number; passed: boolean }[];
  };
  verdicts: { FARM: number; THIN: number; SKIP: number; ROBUST: number };
  basket: { slugs: string[]; total_net: number; weekly_minutes: number; ticket_total: number };
  total_implied: number;
  scatter: { comps: [number, number][]; curve: [number, number][]; board: [number, number][]; steakhouse: [number, number] | null };
  rows: RadarRow[];
}

export function buildRadar(snapshot: Snapshot): { board: BoardRow[]; radar: Radar } {
  const asOfMs = Date.parse(`${snapshot.as_of}T00:00:00Z`);
  const all = snapshot.protocols;
  const watch = new Set(snapshot.watchlist);
  const tokenedRows = all.filter(recordsToken);
  const noTokenRows = all.filter((p) => !recordsToken(p));

  // Coverage ledger: every no-token protocol is ranked or set aside under one reason.
  const reasonCount = new Map<string, number>();
  const ledger: Radar['ledger'] = [];
  const pool: Protocol[] = [];
  for (const p of noTokenRows) {
    const reason = watch.has(p.slug) ? null : boardExclusion(p);
    if (reason == null) pool.push(p);
    else {
      reasonCount.set(reason, (reasonCount.get(reason) ?? 0) + 1);
      ledger.push({ slug: p.slug, name: p.name, reason });
    }
  }
  ledger.sort((a, b) => (a.slug < b.slug ? -1 : 1));

  // The traded reference set and its name roots (for the kinship candidate).
  const tradedRoots = new Map<string, Protocol[]>();
  for (const p of tokenedRows) {
    const r = nameRoot(p.name);
    if (r != null) { if (!tradedRoots.has(r)) tradedRoots.set(r, []); tradedRoots.get(r)!.push(p); }
  }

  // Train: clean traded comps, structural exclusions first, then one robust trim, iterated.
  const medianChange = median(all.filter((p) => p.change_7d != null).map((p) => p.change_7d!));
  let train = tokenedRows.filter((p) =>
    p.mcap_usd != null && p.mcap_usd >= 1_000_000 &&
    !INFRA_CATEGORIES.has(p.category ?? '') && !STABLE_ISSUER_CATEGORIES.has(p.category ?? '') &&
    !isDerivativeName(p) && !isVersionedName(p) && !isExchangeName(p));
  const nCandidates = train.length;
  const trimmed: string[] = [];
  for (let round = 0; round < 3 && train.length > 10; round++) {
    const f = ols(train);
    const resid = train.map((p) => Math.log10(p.mcap_usd!) - (f.alpha + f.beta * Math.log10(p.tvl_usd)));
    const centre = median(resid);
    const sigma = 1.4826 * median(resid.map((r) => Math.abs(r - centre)));
    const drop = train.filter((_, i) => Math.abs(resid[i]! - centre) > 2.5 * sigma);
    if (drop.length === 0) break;
    for (const p of drop) trimmed.push(p.name);
    const dropSet = new Set(drop.map((p) => p.slug));
    train = train.filter((p) => !dropSet.has(p.slug));
  }
  trimmed.sort();

  // The pre-committed candidate gate: LOO gain >= 3%, one sign in both cohort halves, >= 80% of
  // bootstrap refits agreeing in sign. Evaluated once, on the full train set, before any board row
  // is priced; the outcome is reported in the ablation either way.
  const baseLoo = loo(train, 3, medianChange, asOfMs, tradedRoots, { breadth: false, kinship: false });
  const preCohort = train.filter((p) => p.listed_at != null && p.listed_at < '2024-01-01');
  const postCohort = train.filter((p) => p.listed_at != null && p.listed_at >= '2024-01-01');
  const gate = (factor: 'breadth' | 'kinship'): Radar['model']['gates'][number] => {
    const fullFit = fitStage(train, 3, medianChange, asOfMs, tradedRoots);
    const coefs = candidateCoefs(train, fullFit, tradedRoots, medianChange, asOfMs);
    const coef = factor === 'breadth' ? coefs.breadth : coefs.kinship;
    const withFactor = loo(train, 4, medianChange, asOfMs, tradedRoots, { breadth: factor === 'breadth', kinship: factor === 'kinship' });
    const improvement = (baseLoo.medianMiss - withFactor.medianMiss) / baseLoo.medianMiss;
    const halfCoef = (rows: Protocol[]): number => {
      if (rows.length < 5) return 0;
      const c = candidateCoefs(rows, fitStage(rows, 3, medianChange, asOfMs, tradedRoots), tradedRoots, medianChange, asOfMs);
      return factor === 'breadth' ? c.breadth : c.kinship;
    };
    const cPre = halfCoef(preCohort), cPost = halfCoef(postCohort);
    const rnd = mulberry32(20261117);
    let sameSign = 0; const B = 200;
    for (let b = 0; b < B; b++) {
      const sample = Array.from({ length: train.length }, () => train[Math.floor(rnd() * train.length)]!);
      const c = halfCoef(sample);
      if (c !== 0 && Math.sign(c) === Math.sign(coef)) sameSign++;
    }
    const passed = improvement >= 0.03 && coef !== 0 && Math.sign(cPre) === Math.sign(coef) && Math.sign(cPost) === Math.sign(coef) && sameSign / B >= 0.8;
    return {
      factor: factor === 'breadth' ? 'Breadth (value per extra chain)' : 'Kinship (a traded namesake exists)',
      coef: factor === 'breadth' ? `${coef >= 0 ? '+' : ''}${coef.toFixed(3)} dex per chain` : `${coef >= 0 ? '+' : ''}${coef.toFixed(3)} dex`,
      loo_improvement: improvement,
      cohort_sign: `pre-2024 ${cPre >= 0 ? '+' : '−'}, post-2024 ${cPost >= 0 ? '+' : '−'}`,
      bootstrap: sameSign / B,
      passed,
    };
  };
  const gates = [gate('breadth'), gate('kinship')];
  const gated = { breadth: gates[0]!.passed, kinship: gates[1]!.passed };
  const finalStage = gated.breadth || gated.kinship ? 4 : 3;

  // Validation ladder.
  const looStages: Radar['model']['loo'] = [];
  const stageNames = ['Flat multiple (median mcap/TVL)', 'Size curve only', '+ family offsets', '+ momentum & seasoning tilts',
    finalStage === 3 ? '+ gated candidates (none passed the gate)' : '+ gated candidates'];
  for (let st = 0; st <= 4; st++) {
    const r = st === 4 && finalStage === 3 ? baseLoo : st === 3 ? baseLoo : loo(train, st, medianChange, asOfMs, tradedRoots, gated);
    looStages.push({ stage: stageNames[st]!, median_miss: r.medianMiss, in3: r.in3, in10: r.in10 });
  }
  const finalLoo = loo(train, finalStage, medianChange, asOfMs, tradedRoots, gated);
  const looResid = train.map((p, i) => Math.log10(finalLoo.predictions[i]! / p.mcap_usd!));
  const bandDex = { q10: quantile(looResid, 0.1), q25: quantile(looResid, 0.25), q75: quantile(looResid, 0.75), q90: quantile(looResid, 0.9) };
  const worst = train.map((p, i) => ({ name: p.name, miss: missOf(finalLoo.predictions[i]!, p.mcap_usd!), predicted: finalLoo.predictions[i]!, actual: p.mcap_usd! }))
    .sort((a, b) => b.miss - a.miss).slice(0, 10);
  // Band width by TVL tercile of the train set (a heteroscedasticity check, reported as found).
  const byTvl = [...train].sort((a, b) => a.tvl_usd - b.tvl_usd);
  const cut1 = byTvl[Math.floor(byTvl.length / 3)]!.tvl_usd, cut2 = byTvl[Math.floor((2 * byTvl.length) / 3)]!.tvl_usd;
  const buckets: Radar['model']['buckets'] = [];
  for (const [lo, hi, label] of [[0, cut1, 'Small TVL'], [cut1, cut2, 'Mid TVL'], [cut2, Infinity, 'Large TVL']] as [number, number, string][]) {
    const rs = train.filter((p) => p.tvl_usd >= lo && p.tvl_usd < hi).map((p) => looResid[train.indexOf(p)]!);
    if (rs.length >= 5) buckets.push({ label, n: rs.length, q25: quantile(rs, 0.25), q75: quantile(rs, 0.75) });
  }
  // Launch-cohort split: fit on listings before 2024, test on listings from 2024, snapshot features.
  const cohortFit = fitStage(preCohort, finalStage, medianChange, asOfMs, tradedRoots);
  const cohortFlat = fitStage(preCohort, 0, medianChange, asOfMs, tradedRoots);
  const cohortMiss = (fit: Fit, stage: number): { medianMiss: number; in3: number } => {
    const ms = postCohort.map((p) => {
      let v = predictStage(fit, p, stage, medianChange, asOfMs, gated.breadth);
      if (stage >= 4 && gated.kinship && hasTradedNamesake(p, tradedRoots)) v *= Math.pow(10, fit.kinshipCoef);
      return missOf(v, p.mcap_usd!);
    });
    return { medianMiss: median(ms), in3: ms.filter((m) => m <= 3).length / ms.length };
  };
  const cohortModel = cohortMiss(cohortFit, finalStage);
  const cohortFlatR = cohortMiss(cohortFlat, 0);
  const cohortStage2 = cohortMiss(fitStage(preCohort, 2, medianChange, asOfMs, tradedRoots), 2);

  // Price the board.
  const fit = fitStage(train, finalStage, medianChange, asOfMs, tradedRoots);
  const bandLoMult = Math.pow(10, bandDex.q25);
  const priced = pool.map((p) => {
    let v = predictStage(fit, p, finalStage, medianChange, asOfMs, gated.breadth);
    if (finalStage >= 4 && gated.kinship && hasTradedNamesake(p, tradedRoots)) v *= Math.pow(10, fit.kinshipCoef);
    return { p, v };
  }).sort((a, b) => b.v - a.v || (a.p.slug < b.p.slug ? -1 : 1));

  const rows: RadarRow[] = priced.map(({ p, v }, i) => {
    const value = Math.max(1, Math.round(v));
    const farm = farmCalc(p, value, bandLoMult);
    return {
      slug: p.slug, name: p.name, rank: i + 1, implied_value_usd: value,
      farm_steps: farmSteps(p, farm, watch.has(p.slug)),
      category: p.category, family: familyOf(p), chains: p.chains, chain: p.chains[0] ?? 'Ethereum',
      tvl_usd: p.tvl_usd, change_7d: p.change_7d, days_no_token: trackedDays(p, asOfMs),
      watchlist: watch.has(p.slug),
      band_p25: Math.round(value * bandLoMult), band_p75: Math.round(value * Math.pow(10, bandDex.q75)),
      band_p10: Math.round(value * Math.pow(10, bandDex.q10)), band_p90: Math.round(value * Math.pow(10, bandDex.q90)),
      farm_rank: 0, divergence: 0, farm, peers: null, waterfall: null, flags: null,
    };
  });
  // Farm Rank: by net per hour at the band's low end (P25), best first.
  const byFarm = [...rows].sort((a, b) => b.farm.net_hr_p25 - a.farm.net_hr_p25 || (a.slug < b.slug ? -1 : 1));
  byFarm.forEach((r, i) => { r.farm_rank = i + 1; r.divergence = r.rank - r.farm_rank; });

  // Asymmetric depth for the 40 watchlist rows: peers, waterfall, flags.
  for (const row of rows) {
    if (!row.watchlist) continue;
    const p = pool.find((q) => q.slug === row.slug)!;
    const peers = [...train]
      .sort((a, b) => {
        const fa = familyOf(a) === row.family ? 0 : 1, fb = familyOf(b) === row.family ? 0 : 1;
        if (fa !== fb) return fa - fb;
        return Math.abs(Math.log10(a.tvl_usd) - Math.log10(p.tvl_usd)) - Math.abs(Math.log10(b.tvl_usd) - Math.log10(p.tvl_usd));
      })
      .slice(0, 3)
      .map((q) => ({ name: q.name, tvl_usd: q.tvl_usd, mcap_usd: q.mcap_usd! }));
    row.peers = peers;
    const curveOnly = Math.pow(10, fit.alpha + fit.beta * Math.log10(p.tvl_usd));
    const afterFamily = curveOnly * Math.pow(10, fit.offsets.get(row.family) ?? 0);
    const afterMom = afterFamily * momentumFactor(p, medianChange);
    const afterSeasoning = afterMom * seasoningFactor(p, asOfMs);
    row.waterfall = [
      { label: 'Size curve on TVL alone', value: Math.round(curveOnly) },
      { label: `Family offset (${row.family})`, value: Math.round(afterFamily) },
      { label: 'Momentum tilt (7-day TVL vs the snapshot median week)', value: Math.round(afterMom) },
      { label: 'Seasoning tilt (days tracked with no token)', value: Math.round(afterSeasoning) },
    ];
    if (Math.abs(row.implied_value_usd - Math.round(afterSeasoning)) > 1) {
      row.waterfall.push({ label: 'Gated candidate factor', value: row.implied_value_usd });
    }
    const flags: string[] = [];
    if (p.chains.length === 1) flags.push(`Single-chain record: every dollar of its TVL sits on ${p.chains[0]}; the snapshot shows no cross-chain footprint.`);
    if (p.change_7d != null && Math.abs(p.change_7d) >= 25) flags.push(`A violent week: TVL moved ${p.change_7d.toFixed(1)}% in seven days — a hot or bleeding record, not a steady state.`);
    if (p.listed_at == null) flags.push('Listing date not reported in the snapshot; the seasoning tilt uses the stated 365-day default for this row.');
    else if (trackedDays(p, asOfMs) < 90) flags.push(`Young record: DefiLlama has tracked it for only ${trackedDays(p, asOfMs)} days, so the curve is pricing a short history.`);
    const famComps = train.filter((q) => familyOf(q) === row.family).length;
    if (famComps < 3) flags.push(`Thin comp set: only ${famComps} traded protocols in its family price this row, so the global curve does most of the work.`);
    if (isVersionedName(p)) flags.push('A versioned instance: the board prices this deployment, and a sibling deployment may carry the same brand.');
    row.flags = flags.length > 0 ? flags.slice(0, 3) : ['Nothing flagged in the snapshot fields: multi-chain record, a seven-day move inside ±25%, and over a year tracked.'];
  }

  // The starter basket: five ROBUST rows, diversified by category and primary chain.
  const robustByHr = rows.filter((r) => r.farm.robust).sort((a, b) => b.farm.net_hr_p25 - a.farm.net_hr_p25 || (a.slug < b.slug ? -1 : 1));
  const basketRows: RadarRow[] = [];
  const usedCats = new Set<string>(), usedChains = new Set<string>();
  for (const r of robustByHr) {
    if (basketRows.length >= 5) break;
    if (usedCats.has(r.category ?? '') || usedChains.has(r.chain)) continue;
    basketRows.push(r); usedCats.add(r.category ?? ''); usedChains.add(r.chain);
  }
  for (const r of robustByHr) { // relax chain, then category, if the strict pass came up short
    if (basketRows.length >= 5) break;
    if (basketRows.includes(r) || usedCats.has(r.category ?? '')) continue;
    basketRows.push(r); usedCats.add(r.category ?? '');
  }
  for (const r of robustByHr) {
    if (basketRows.length >= 5) break;
    if (!basketRows.includes(r)) basketRows.push(r);
  }

  // Display tallies are disjoint: a ROBUST row is not also counted as FARM, so the four
  // numbers on the page sum to the board's row count.
  const verdicts = { FARM: 0, THIN: 0, SKIP: 0, ROBUST: 0 };
  for (const r of rows) {
    if (r.farm.robust) verdicts.ROBUST++;
    else verdicts[r.farm.verdict]++;
  }

  const famSummary = [...fit.offsets.entries()].map(([family, offset]) => ({
    family, n: train.filter((p) => familyOf(p) === family).length, offset,
  })).sort((a, b) => b.n - a.n);

  const scatter: Radar['scatter'] = {
    comps: train.map((p) => [Math.log10(p.tvl_usd), Math.log10(p.mcap_usd!)] as [number, number]),
    curve: [5.7, 6.3, 6.9, 7.5, 8.1, 8.7, 9.3, 9.9, 10.5].map((x) => [x, fit.alpha + fit.beta * x] as [number, number]),
    board: rows.map((r) => [Math.log10(r.tvl_usd), Math.log10(r.implied_value_usd)] as [number, number]),
    steakhouse: null,
  };
  const stk = rows.find((r) => r.slug === 'steakhouse-financial');
  if (stk) scatter.steakhouse = [Math.log10(stk.tvl_usd), Math.log10(stk.implied_value_usd)];

  const radar: Radar = {
    as_of: snapshot.as_of, floor_usd: snapshot.floor_usd,
    counts: {
      audited: all.length, tokened: tokenedRows.length, no_token: noTokenRows.length,
      ranked: rows.length, set_aside: ledger.length, watchlist: snapshot.watchlist.length,
    },
    reasons: [...reasonCount.entries()].map(([code, count]) => ({ code, label: REASON_LABELS[code] ?? code, count }))
      .sort((a, b) => b.count - a.count),
    ledger,
    model: {
      name: 'radar-3', alpha: fit.alpha, beta: fit.beta, r2: fit.r2,
      flat_multiple: median(train.map((p) => p.mcap_usd! / p.tvl_usd)),
      n_candidates: nCandidates, n_train: train.length, trimmed,
      median_change_7d: medianChange, families: famSummary, band_dex: bandDex,
      loo: looStages,
      cohort: { train_n: preCohort.length, test_n: postCohort.length, flat_miss: cohortFlatR.medianMiss, model_miss: cohortModel.medianMiss, flat_in3: cohortFlatR.in3, model_in3: cohortModel.in3, stage2_miss: cohortStage2.medianMiss, stage2_in3: cohortStage2.in3 },
      worst, buckets, gates,
    },
    verdicts,
    basket: {
      slugs: basketRows.map((r) => r.slug),
      total_net: basketRows.reduce((a, r) => a + r.farm.net, 0),
      weekly_minutes: basketRows.reduce((a, r) => a + r.farm.weekly_minutes, 0),
      ticket_total: basketRows.length * TICKET_USD,
    },
    total_implied: rows.reduce((a, r) => a + r.implied_value_usd, 0),
    scatter,
    rows,
  };
  const board: BoardRow[] = rows.map((r) => ({ slug: r.slug, name: r.name, rank: r.rank, implied_value_usd: r.implied_value_usd, farm_steps: r.farm_steps }));
  return { board, radar };
}

/** The dashboard's data file: one window.RADAR object, built from the same rows as board.json. */
export function dataScript(radar: Radar): string {
  return `window.RADAR = ${JSON.stringify(radar)};\n`;
}

/** The gate's shape, checked before anything is written: null when the board is well-formed. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  if (board.length < 100 || board.length > 4000) return `board holds ${board.length} rows, outside 100..4000`;
  const slugs = new Set(board.map((r) => r.slug));
  if (slugs.size !== board.length) return 'board holds a slug twice';
  const known = new Set(snapshot.protocols.map((p) => p.slug));
  for (const r of board) if (!known.has(r.slug)) return `board invents the slug ${r.slug}`;
  for (const slug of snapshot.watchlist) if (!slugs.has(slug)) return `board misses the watchlist slug ${slug}`;
  const byRank = [...board].sort((a, b) => a.rank - b.rank);
  for (let i = 0; i < byRank.length; i++) {
    const r = byRank[i]!;
    if (r.rank !== i + 1) return `ranks are not exactly 1..N (rank ${r.rank} at position ${i + 1})`;
    if (!Number.isInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug}: implied value is not a positive whole number`;
    if (i > 0 && r.implied_value_usd > byRank[i - 1]!.implied_value_usd) return `implied value rises at rank ${r.rank}`;
    if (r.farm_steps.length < 3 || r.farm_steps.length > 12) return `${r.slug}: farm_steps holds ${r.farm_steps.length} steps, outside 3..12`;
    for (const step of r.farm_steps) {
      const len = step.trim().length;
      if (len < 20 || len > 600) return `${r.slug}: a farm step is ${len} characters once trimmed, outside 20..600`;
    }
  }
  if (new Set(board.map((r) => r.implied_value_usd)).size === 1) return 'every implied value is the same: not a ranking';
  return null;
}
