// Token launch radar, model "radar-fit-1": one sealed snapshot in, one ranked board out.
//
// The board ranks pre-token protocols by what a launch would be worth if the protocol's record
// stayed as it is. It never predicts whether or when a token is issued: the implied value is this
// entry's own claim, built only from the snapshot's own figures.
//
// The model is FITTED, not hand-picked: every number below is computed from the snapshot at run
// time, from the protocols that already trade, so running it on a new snapshot refits it.
//
//   multiple     the protocol's category mcap/TVL, as the median of its live-token peers,
//                winsorised at the 90th percentile and shrunk toward the global median
//                (a category with one peer leans on the market, not on that peer alone)
//   size         a log-log fit of market cap on TVL across the live peers, shrunk 75% toward
//                no size effect and clamped: big protocols are worth less per TVL dollar
//   growth       the 7-day TVL change, clamped to [-60, +120]%, at half weight
//   maturity     how long the protocol has run with no token, 0.55 rising to 1.15 over 4 years
//   implied      TVL x multiple x size x growth x maturity, rounded to whole dollars
//
// Launch odds are a RANGE, not a point: for a protocol's age band and TVL tier, the share of
// protocols in the snapshot that already record a token, with a Wilson 90% interval. The odds
// say "protocols like this one have tokens this often", never "this one will launch".
//
// Coverage: the board ranks the whole watchlist (the floor) plus every pre-token protocol BELOW
// the floor that passes the house exclusion rule. Above the floor the board ranks exactly the
// watchlist: a protocol the house left off its list is left off here too, because the list is
// the house's own application of the exclusion rule with data the snapshot does not carry
// (DefiLlama's parentProtocol). The integrity strip accounts for all 758 protocols.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
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

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-fit-1';

/** Pseudo-count for shrinking a category multiple toward the global median. */
export const SHRINK_K = 5;
/** Weight given to the fitted log-log size slope; the rest leans on no size effect. */
export const SIZE_SHRINK = 0.25;
/** The size adjustment never leaves this band. */
export const SIZE_MIN = 0.7;
export const SIZE_MAX = 1.5;
/** Growth: half weight, clamped to [-60, +120]%. */
export const GROWTH_WEIGHT = 0.5;
export const GROWTH_FLOOR = -60;
export const GROWTH_CAP = 120;
/** Maturity: 0.55 at listing, rising to 1.15 over four years; unknown age counts as one year. */
export const MATURITY_FLOOR = 0.55;
export const MATURITY_RANGE = 0.6;
export const MATURITY_DAYS = 1460;
export const UNKNOWN_AGE_DAYS = 365;
/** z for the Wilson 90% interval behind the launch-odds range. */
export const WILSON_Z = 1.6449;

/** One fitted category multiple, with the peer count behind it. */
export interface CategoryMultiple {
  category: string;
  peers: number;
  median: number;
  multiple: number;
}

/** What the fit found in the live-token peers. */
export interface FitResult {
  peers: number;
  zero_mcap_token: number;
  global_multiple: number;
  winsor_p90: number;
  size_slope: number;
  size_exponent: number;
  median_peer_tvl: number;
  categories: CategoryMultiple[];
  by_category: Record<string, number>;
}

/** One cell of the cohort table behind the launch odds. */
export interface CohortCell {
  band: string;
  tier: string;
  n: number;
  share: number;
  low_pct: number;
  high_pct: number;
}

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** A farm plan's costed summary: capital, gas per week, minutes per week, dollars per hour. */
export interface PlanSummary {
  capital_usd: number;
  gas_per_week_usd: number;
  minutes_per_week: number;
  usd_per_hour: number;
  hold_days: number;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  age_days: number | null;
  watchlist: boolean;
  token_status: 'pre-token';
  implied_value_usd: number;
  model: {
    multiple: number;
    size_multiplier: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    age_days: number | null;
  };
  launch_odds: {
    low_pct: number;
    high_pct: number;
    cohort_n: number;
    cohort_share_pct: number;
  };
  plan: PlanSummary;
  farm_steps: string[];
}

/** The dashboard's compact view of one row. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  age_days: number | null;
  watchlist: boolean;
  implied_value_usd: number;
  multiple: number;
  size_multiplier: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  odds_low_pct: number;
  odds_high_pct: number;
  cohort_n: number;
  cohort_share_pct: number;
  capital_usd: number;
  gas_per_week_usd: number;
  minutes_per_week: number;
  usd_per_hour: number;
  farm_steps: string[];
}

/** A live-token protocol: it already trades, so the board shows the market's own value. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
  mcap_tvl: number | null;
}

/** One held-out check of the fitted model against the live peers. */
export interface ValidationCheck {
  name: string;
  n: number;
  median_abs_log_error: number;
  within_2x_pct: number;
}

/** How the 758 protocols are accounted for. */
export interface Integrity {
  total: number;
  ranked: number;
  watchlist: number;
  early_below_floor: number;
  above_floor_not_watchlist: number;
  above_floor_not_watchlist_slugs: string[];
  excluded_pre_token: number;
  excluded_reasons: Record<string, number>;
  live_token: number;
  fit_peers: number;
}

/** Everything the dashboard needs: the board, the live set, the fit, and the checks. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  fit: FitResult;
  cohorts: CohortCell[];
  validation: ValidationCheck[];
  integrity: Integrity;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** The median of a non-empty list of numbers. */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** The field guide's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
/** Categories the field guide names as wrapped, staked, bridged or exchange products. */
const EXCLUDED_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);
/** Exchange names a protocol must not begin with. */
const EXCHANGES = ['Binance', 'Coinbase', 'Bybit', 'Kraken', 'Bitget', 'OKX', 'Bitfinex', 'Gemini'];
/** A whole word that marks a wrapped or staked product. */
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/**
 * Why the house exclusion rule keeps a protocol off the board, or null when it passes: its
 * category, a version marker in its name, a wrapped/staked word, or an exchange prefix.
 */
export function exclusionReason(p: SnapshotProtocol): string | null {
  if (p.category !== null && EXCLUDED_CATEGORIES.has(p.category)) return `category ${p.category}`;
  if (VERSIONED.test(p.name)) return 'versioned name';
  if (WRAPPED_WORD.test(p.name)) return 'wrapped/staked word';
  for (const e of EXCHANGES) if (p.name.startsWith(e)) return `exchange prefix ${e}`;
  return null;
}

/** Whether a protocol is one the board may rank: pre-token and past the exclusion rule. */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && exclusionReason(p) === null;
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/**
 * Fit the model on the live-token peers: protocols that already trade, with a positive market
 * cap and TVL, outside the excluded categories. Their mcap/TVL ratios are winsorised at the
 * 90th percentile (one token with a ratio of 400 must not set a whole category), then each
 * category's median is shrunk toward the global median with SHRINK_K pseudo-observations.
 * The size term is the log-log slope of market cap on TVL, shrunk SIZE_SHRINK of the way
 * toward 1 (no size effect). Protocols that record a token with a zero or negative market
 * cap are counted and left out of the fit.
 */
export function fitModel(snapshot: Snapshot): FitResult {
  const live = snapshot.protocols.filter((p) => !isPreToken(p));
  const zeroMcap = live.filter((p) => p.mcap_usd === null || p.mcap_usd <= 0 || p.tvl_usd <= 0).length;
  const peers = live.filter(
    (p) =>
      p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0 && (p.category === null || !EXCLUDED_CATEGORIES.has(p.category)),
  );
  const ratios = peers.map((p) => p.mcap_usd! / p.tvl_usd).sort((a, b) => a - b);
  const p90 = ratios[Math.min(ratios.length - 1, Math.floor(0.9 * ratios.length))]!;
  const winsorised = ratios.map((r) => Math.min(r, p90));
  const global = median(winsorised);

  const byCat = new Map<string, number[]>();
  for (const p of peers) {
    const key = p.category ?? 'Unknown';
    const list = byCat.get(key) ?? [];
    list.push(Math.min(p.mcap_usd! / p.tvl_usd, p90));
    byCat.set(key, list);
  }
  const categories: CategoryMultiple[] = [...byCat.entries()]
    .map(([category, rs]) => {
      const med = median(rs);
      return { category, peers: rs.length, median: round4(med), multiple: round4((rs.length * med + SHRINK_K * global) / (rs.length + SHRINK_K)) };
    })
    .sort((a, b) => b.multiple - a.multiple || (a.category < b.category ? -1 : 1));
  const by_category: Record<string, number> = {};
  for (const c of categories) by_category[c.category] = c.multiple;

  const xs = peers.map((p) => Math.log(p.tvl_usd));
  const ys = peers.map((p) => Math.log(p.mcap_usd!));
  const mx = xs.reduce((s, x) => s + x, 0) / xs.length;
  const my = ys.reduce((s, y) => s + y, 0) / ys.length;
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i]! - mx) * (ys[i]! - my);
    den += (xs[i]! - mx) * (xs[i]! - mx);
  }
  const slope = den === 0 ? 1 : num / den;
  const exponent = 1 + SIZE_SHRINK * (slope - 1);

  return {
    peers: peers.length,
    zero_mcap_token: zeroMcap,
    global_multiple: round4(global),
    winsor_p90: round4(p90),
    size_slope: round4(slope),
    size_exponent: round4(exponent),
    median_peer_tvl: median(peers.map((p) => p.tvl_usd)),
    categories,
    by_category,
  };
}

/** The multiple a category gets: its fitted value, or the global median when it has no peers. */
export function multipleFor(category: string | null, fit: FitResult): number {
  if (category !== null && fit.by_category[category] !== undefined) return fit.by_category[category]!;
  return fit.global_multiple;
}

/** The size adjustment for a TVL, from the shrunk log-log exponent, clamped to its band. */
export function sizeMultiplier(tvlUsd: number, fit: FitResult): number {
  const raw = Math.pow(tvlUsd / fit.median_peer_tvl, fit.size_exponent - 1);
  return Math.min(SIZE_MAX, Math.max(SIZE_MIN, raw));
}

/** The three multipliers and the implied value one protocol gets under the fitted model. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  fit: FitResult,
): { implied: number; multiple: number; sizeMult: number; growthPct: number; growthMult: number; maturityMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const multiple = multipleFor(protocol.category, fit);
  const sizeMult = sizeMultiplier(protocol.tvl_usd, fit);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(GROWTH_CAP, Math.max(GROWTH_FLOOR, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * GROWTH_WEIGHT;
  const ageForModel = age ?? UNKNOWN_AGE_DAYS;
  const maturityMult = MATURITY_FLOOR + (Math.min(Math.max(ageForModel, 0), MATURITY_DAYS) / MATURITY_DAYS) * MATURITY_RANGE;
  const implied = Math.max(1, Math.round(protocol.tvl_usd * multiple * sizeMult * growthMult * maturityMult));
  return { implied, multiple, sizeMult, growthPct, growthMult, maturityMult, age };
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** The age band a protocol's age falls in, for the cohort table. */
export function ageBand(age: number | null): string {
  if (age === null) return 'unknown';
  if (age < 180) return '0-180';
  if (age < 365) return '180-365';
  if (age < 730) return '365-730';
  if (age < 1460) return '730-1460';
  return '1460+';
}

/** The TVL tier a protocol falls in, for the cohort table. */
export function tvlTier(tvlUsd: number, floorUsd: number): string {
  return tvlUsd >= floorUsd ? 'high' : 'low';
}

/** A Wilson score interval for a share k/n, at WILSON_Z. */
function wilson(k: number, n: number): { low: number; high: number } {
  if (n === 0) return { low: 0, high: 1 };
  const z = WILSON_Z;
  const ph = k / n;
  const d = 1 + (z * z) / n;
  const c = ph + (z * z) / (2 * n);
  const m = z * Math.sqrt((ph * (1 - ph)) / n + (z * z) / (4 * n * n));
  return { low: Math.max(0, (c - m) / d), high: Math.min(1, (c + m) / d) };
}

/**
 * The cohort table: for each age band and TVL tier, how many protocols the snapshot holds,
 * what share already records a token, and the Wilson 90% interval of that share. A row's
 * launch odds are its own cohort's interval, so the odds are a range the snapshot supports.
 */
export function cohortTable(snapshot: Snapshot): CohortCell[] {
  const cells = new Map<string, { n: number; withToken: number }>();
  for (const p of snapshot.protocols) {
    const key = `${ageBand(ageDays(snapshot.as_of, p.listed_at))}|${tvlTier(p.tvl_usd, snapshot.floor_usd)}`;
    const cell = cells.get(key) ?? { n: 0, withToken: 0 };
    cell.n += 1;
    if (!isPreToken(p)) cell.withToken += 1;
    cells.set(key, cell);
  }
  const out: CohortCell[] = [];
  for (const [key, cell] of [...cells.entries()].sort()) {
    const [band, tier] = key.split('|');
    const share = cell.n === 0 ? 0 : cell.withToken / cell.n;
    const iv = wilson(cell.withToken, cell.n);
    out.push({
      band: band!,
      tier: tier!,
      n: cell.n,
      share: round4(share),
      low_pct: Math.round(iv.low * 1000) / 10,
      high_pct: Math.round(iv.high * 1000) / 10,
    });
  }
  return out;
}

/** A protocol's launch odds: its cohort's interval, with the cohort's size and share. */
export function launchOdds(
  protocol: SnapshotProtocol,
  asOf: string,
  cohorts: CohortCell[],
  floorUsd: number,
): { low_pct: number; high_pct: number; cohort_n: number; cohort_share_pct: number } {
  const band = ageBand(ageDays(asOf, protocol.listed_at));
  const tier = tvlTier(protocol.tvl_usd, floorUsd);
  const cell = cohorts.find((c) => c.band === band && c.tier === tier);
  if (cell === undefined) return { low_pct: 0, high_pct: 100, cohort_n: 0, cohort_share_pct: 0 };
  return { low_pct: cell.low_pct, high_pct: cell.high_pct, cohort_n: cell.n, cohort_share_pct: Math.round(cell.share * 1000) / 10 };
}

/**
 * Refit the multiples on a peer list, the same way fitModel does: winsorised ratios, global
 * median, per-category medians shrunk with SHRINK_K. Used by the held-out checks so each
 * check refits without the protocol it predicts.
 */
function multiplesForPeers(
  peers: SnapshotProtocol[],
): { global: number; by_category: Record<string, number>; median_peer_tvl: number } {
  const ratios = peers.map((p) => p.mcap_usd! / p.tvl_usd).sort((a, b) => a - b);
  const p90 = ratios[Math.min(ratios.length - 1, Math.floor(0.9 * ratios.length))]!;
  const global = median(ratios.map((r) => Math.min(r, p90)));
  const byCat = new Map<string, number[]>();
  for (const p of peers) {
    const key = p.category ?? 'Unknown';
    const list = byCat.get(key) ?? [];
    list.push(Math.min(p.mcap_usd! / p.tvl_usd, p90));
    byCat.set(key, list);
  }
  const by_category: Record<string, number> = {};
  for (const [category, rs] of byCat) {
    const med = median(rs);
    by_category[category] = (rs.length * med + SHRINK_K * global) / (rs.length + SHRINK_K);
  }
  return { global, by_category, median_peer_tvl: median(peers.map((p) => p.tvl_usd)) };
}

/** Predict a live peer's market cap from its TVL under a refit, for the held-out checks. */
function predictMcap(p: SnapshotProtocol, refit: { global: number; by_category: Record<string, number>; median_peer_tvl: number }, fit: FitResult): number {
  const multiple = p.category !== null && refit.by_category[p.category] !== undefined ? refit.by_category[p.category]! : refit.global;
  const size = Math.min(SIZE_MAX, Math.max(SIZE_MIN, Math.pow(p.tvl_usd / refit.median_peer_tvl, fit.size_exponent - 1)));
  return Math.max(1, Math.round(p.tvl_usd * multiple * size));
}

/**
 * Two held-out checks of the fitted model, run on the live peers at build time:
 * leave-one-out (refit without the peer, predict its market cap) and walk-forward (fit on
 * the older half by listing date, predict the newer half). Growth and maturity are 1 here:
 * the checks test the fitted multiple and size term against the market's own values.
 */
export function validateFit(snapshot: Snapshot, fit: FitResult): ValidationCheck[] {
  const peers = snapshot.protocols.filter(
    (p) =>
      !isPreToken(p) &&
      p.mcap_usd !== null &&
      p.mcap_usd > 0 &&
      p.tvl_usd > 0 &&
      (p.category === null || !EXCLUDED_CATEGORIES.has(p.category)),
  );
  const score = (errors: number[]): { median_abs_log_error: number; within_2x_pct: number } => {
    const abs = errors.map((e) => Math.abs(e)).sort((a, b) => a - b);
    const med = abs.length === 0 ? 0 : abs[Math.floor(abs.length / 2)]!;
    const within = errors.filter((e) => Math.abs(e) <= Math.log(2)).length;
    return { median_abs_log_error: round4(med), within_2x_pct: errors.length === 0 ? 0 : Math.round((within / errors.length) * 1000) / 10 };
  };

  const looErrors: number[] = [];
  for (let i = 0; i < peers.length; i++) {
    const rest = peers.filter((_, j) => j !== i);
    const refit = multiplesForPeers(rest);
    const pred = predictMcap(peers[i]!, refit, fit);
    looErrors.push(Math.log(pred / peers[i]!.mcap_usd!));
  }
  const loo = score(looErrors);

  const dated = peers.filter((p) => p.listed_at !== null).sort((a, b) => (a.listed_at! < b.listed_at! ? -1 : 1));
  const cut = Math.floor(dated.length / 2);
  const older = dated.slice(0, cut);
  const newer = dated.slice(cut);
  const refit = multiplesForPeers(older);
  const wfErrors = newer.map((p) => Math.log(predictMcap(p, refit, fit) / p.mcap_usd!));
  const wf = score(wfErrors);

  return [
    { name: 'leave-one-out', n: peers.length, median_abs_log_error: loo.median_abs_log_error, within_2x_pct: loo.within_2x_pct },
    { name: 'walk-forward', n: newer.length, median_abs_log_error: wf.median_abs_log_error, within_2x_pct: wf.within_2x_pct },
  ];
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 1_000_000_000) return 250;
  if (p.tvl_usd >= 100_000_000) return 150;
  if (p.tvl_usd >= 50_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 45;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** The category's core action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`;
  if (c.includes('dex') || c.includes('leveraged farm')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  if (c.includes('yield') && !c.includes('aggregator')) return `Deposit $${capital} into ${name}'s main yield position on ${chain} and keep it open.`;
  if (c.includes('aggregator') || c.includes('curator') || c.includes('allocator') || c.includes('manager')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares.`;
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('options')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedge.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name}.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield asset on ${chain} and hold it.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy.`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt.`;
  if (c.includes('chain')) return `Bridge $${capital} to ${name}'s chain and use one of its native apps.`;
  if (c.includes('farm')) return `Stake $${capital} of LP tokens in ${name}'s farm on ${chain}.`;
  if (c.includes('launchpad')) return `Commit $${capital} to a ${name} launch on ${chain} and hold the allocation.`;
  if (c.includes('payment')) return `Route $${capital} of payments through ${name} on ${chain}.`;
  if (c.includes('privacy')) return `Deposit $${capital} through ${name}'s private pool on ${chain}.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/**
 * A protocol's farm plan: seven steps, each an action with a cost and a time, plus a costed
 * summary. Everything is derived from the protocol's own record (category, chains, TVL, age),
 * never from a hand-written list of names. The dollars-per-hour figure is gas dollars per
 * hour of the farmer's time: weekly gas over weekly minutes.
 */
export function farmPlan(p: SnapshotProtocol, age: number | null): { steps: FarmStep[]; summary: PlanSummary } {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const setupGas = capital >= 150 ? 8 : 4;
  const gasPerWeek = 2 + setupGas / 8;
  const minutesPerWeek = 15;
  const usdPerHour = Math.round(gasPerWeek / (minutesPerWeek / 60) * 100) / 100;
  const second =
    p.chains.length >= 2
      ? {
          text: `Repeat the core position on ${p.chains[1]} with a smaller $${Math.round(capital / 2)} so the activity spans two chains.`,
          cost: `about $${Math.round(capital / 2)} of capital and $2 of gas`,
          time: '10 minutes',
        }
      : {
          text: `Take one governance action, such as a vote or a forum post, so the wallet shows more than deposits.`,
          cost: 'about $1 of gas',
          time: '10 minutes',
        };
  const steps: FarmStep[] = [
    { text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`, cost: 'under $3 of gas for the first transaction', time: '5 minutes' },
    { text: actionFor(p, capital, chain), cost: `$${capital} of capital and about $${setupGas} of gas`, time: '15 minutes to set up' },
    { text: `Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.`, cost: 'about $2 of gas a week', time: '10 minutes a week' },
    second,
    { text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`, cost: `the $${capital} stays in the position`, time: `${hold} days` },
    { text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.`, cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
    { text: `Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.`, cost: 'nothing but the log', time: '5 minutes' },
  ];
  return { steps, summary: { capital_usd: capital, gas_per_week_usd: Math.round(gasPerWeek * 100) / 100, minutes_per_week: minutesPerWeek, usd_per_hour: usdPerHour, hold_days: hold } };
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, 24)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
      mcap_tvl: p.mcap_usd !== null && p.tvl_usd > 0 ? round4(p.mcap_usd / p.tvl_usd) : null,
    }));
}

/** A board row's compact form for data.js. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    age_days: row.age_days,
    watchlist: row.watchlist,
    implied_value_usd: row.implied_value_usd,
    multiple: row.model.multiple,
    size_multiplier: row.model.size_multiplier,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    odds_low_pct: row.launch_odds.low_pct,
    odds_high_pct: row.launch_odds.high_pct,
    cohort_n: row.launch_odds.cohort_n,
    cohort_share_pct: row.launch_odds.cohort_share_pct,
    capital_usd: row.plan.capital_usd,
    gas_per_week_usd: row.plan.gas_per_week_usd,
    minutes_per_week: row.plan.minutes_per_week,
    usd_per_hour: row.plan.usd_per_hour,
    farm_steps: row.farm_steps,
  };
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, fit: FitResult, cohorts: CohortCell[]): { board: BoardRow[]; integrity: Integrity } {
  const index = bySlug(snapshot.protocols);
  const watchlist = new Set(snapshot.watchlist);
  const chosen = new Map<string, SnapshotProtocol>();
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  let early = 0;
  const aboveFloorNotWatchlist: string[] = [];
  const excludedReasons: Record<string, number> = {};
  let excluded = 0;
  for (const p of snapshot.protocols) {
    if (!isPreToken(p)) continue;
    const reason = exclusionReason(p);
    if (reason !== null) {
      excluded += 1;
      const group = reason.startsWith('category') ? 'category' : reason;
      excludedReasons[group] = (excludedReasons[group] ?? 0) + 1;
      continue;
    }
    if (watchlist.has(p.slug)) continue;
    if (p.tvl_usd >= snapshot.floor_usd) {
      aboveFloorNotWatchlist.push(p.slug);
      continue;
    }
    chosen.set(p.slug, p);
    early += 1;
  }
  aboveFloorNotWatchlist.sort();

  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, fit);
    const odds = launchOdds(p, snapshot.as_of, cohorts, snapshot.floor_usd);
    const plan = farmPlan(p, v.age);
    return { p, v, odds, plan };
  });
  scored.sort((a, b) => b.v.implied - a.v.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  const board: BoardRow[] = scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    age_days: s.v.age,
    watchlist: watchlist.has(s.p.slug),
    token_status: 'pre-token',
    implied_value_usd: s.v.implied,
    model: {
      multiple: s.v.multiple,
      size_multiplier: round4(s.v.sizeMult),
      growth_pct: s.v.growthPct,
      growth_multiplier: round4(s.v.growthMult),
      maturity_multiplier: round4(s.v.maturityMult),
      age_days: s.v.age,
    },
    launch_odds: s.odds,
    plan: s.plan.summary,
    farm_steps: s.plan.steps.map(stepText),
  }));

  const integrity: Integrity = {
    total: snapshot.protocols.length,
    ranked: board.length,
    watchlist: snapshot.watchlist.length,
    early_below_floor: early,
    above_floor_not_watchlist: aboveFloorNotWatchlist.length,
    above_floor_not_watchlist_slugs: aboveFloorNotWatchlist,
    excluded_pre_token: excluded,
    excluded_reasons: excludedReasons,
    live_token: snapshot.protocols.length - snapshot.protocols.filter(isPreToken).length,
    fit_peers: fit.peers,
  };
  return { board, integrity };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot): { board: BoardRow[]; radar: RadarData } {
  const fit = fitModel(snapshot);
  const cohorts = cohortTable(snapshot);
  const validation = validateFit(snapshot, fit);
  const { board, integrity } = buildBoard(snapshot, fit, cohorts);
  const live = liveRows(snapshot);
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: integrity.early_below_floor,
    fit,
    cohorts,
    validation,
    integrity,
    rows: board.map(radarRow),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
