// The token radar's advanced model: one snapshot of the protocol universe in, one ranked board out.
// Model version: radar-advanced-v2

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

export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

export interface ModelConstants {
  base_multiple: number;
  tvl_power: number;
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  recency_weight: number;
  unknown_age_days: number;
}

export const MODEL: ModelConstants = {
  base_multiple: 0.35,
  tvl_power: 0.82,
  growth_weight: 0.4,
  growth_floor: -50,
  growth_cap: 150,
  recency_weight: 0.25,
  unknown_age_days: 365,
};

export const MODEL_VERSION = 'radar-advanced-v2';

export const TOTAL_BOARD_ROWS = 180;

export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

export interface BoardRow {
  rank: number;
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
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    base_multiple: number;
    tvl_power: number;
    growth_pct: number;
    momentum_multiplier: number;
    category_multiplier: number;
    chain_multiplier: number;
    recency_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  farm_steps?: string[];
  watchlist?: boolean;
}

export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  rows: RadarRow[];
  live: LiveRow[];
}

export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

function categoryMultiplier(category: string | null): number {
  if (!category) return 1.0;
  const c = category.toLowerCase();
  if (c.includes('restak') || c.includes('liquid restaking')) return 1.35;
  if (c.includes('lend') || c.includes('lending') || c.includes('cdp')) return 1.25;
  if (c.includes('derivative') || c.includes('perpetual') || c.includes('options') || c.includes('synthetics')) return 1.20;
  if (c.includes('ai') || c.includes('decentralized ai') || c.includes('agent')) return 1.30;
  if (c.includes('dex') || c.includes('yield') || c.includes('liquidity')) return 1.15;
  if (c.includes('bridge') || c.includes('cross chain')) return 1.10;
  return 1.05;
}

const DERIVATIVE_CATEGORIES = new Set([
  'bridge',
  'canonical bridge',
  'liquid staking',
  'liquid restaking',
  'restaked btc',
  'cex',
  'bridged',
]);

const DERIVATIVE_WORDS = /\b(wrapped|staked|staking|bridged)\b/i;
const VERSION_SUFFIX = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

export function isWrappedDerivative(p: SnapshotProtocol): boolean {
  const noToken = p.gecko_id === null && p.symbol === null;
  const cat = p.category ? p.category.toLowerCase().trim() : '';
  const catMatch = DERIVATIVE_CATEGORIES.has(cat);
  const wordMatch = DERIVATIVE_WORDS.test(p.name);
  const versionMatch = VERSION_SUFFIX.test(p.name);
  return noToken && (catMatch || wordMatch || versionMatch);
}

export function impliedValue(protocol: SnapshotProtocol, asOf: string, model: ModelConstants): {
  implied: number;
  growthPct: number;
  momentumMult: number;
  categoryMult: number;
  chainMult: number;
  recencyMult: number;
  derivativeMult: number;
  age: number | null;
} {
  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const momentumMult = 1 + (growthPct / 100) * model.growth_weight;
  
  const categoryMult = categoryMultiplier(protocol.category);
  const chainCount = Math.max(1, protocol.chains.length);
  const chainMult = 1 + Math.min(chainCount - 1, 5) * 0.04;

  const ageForModel = age ?? model.unknown_age_days;
  const recencyMult = 1.0 + Math.max(0, (730 - ageForModel) / 730) * model.recency_weight;
  const derivativeMult = isWrappedDerivative(protocol) ? 0.10 : 1.0;

  const scaledTvl = Math.pow(Math.max(1, protocol.tvl_usd), model.tvl_power);
  const rawImplied = scaledTvl * model.base_multiple * momentumMult * categoryMult * chainMult * recencyMult * derivativeMult;
  const implied = Math.max(1, Math.min(100_000_000_000_000, Math.round(rawImplied)));

  return { implied, growthPct, momentumMult, categoryMult, chainMult, recencyMult, derivativeMult, age };
}

const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && p.category !== 'CEX' && !VERSIONED.test(p.name);
}

function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  const watchlistSet = new Set(snapshot.watchlist);

  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }

  const needed = Math.max(0, TOTAL_BOARD_ROWS - chosen.size);
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p))
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .slice(0, needed);

  for (const p of early) chosen.set(p.slug, p);

  const scored = [...chosen.values()].map((p) => {
    const res = impliedValue(p, snapshot.as_of, model);
    return { p, isWatchlist: watchlistSet.has(p.slug), ...res };
  });

  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));

  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.age,
    implied_value_usd: s.implied,
    model: {
      base_multiple: model.base_multiple,
      tvl_power: model.tvl_power,
      growth_pct: s.growthPct,
      momentum_multiplier: round4(s.momentumMult),
      category_multiplier: round4(s.categoryMult),
      chain_multiplier: round4(s.chainMult),
      recency_multiplier: round4(s.recencyMult),
      age_days: s.age,
    },
    farm_steps: generateProtocolFarmSteps(s.p, s.age).map(stepText),
  }));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Maintain active engagement on the protocol's official application interface.`;
  return s;
}

function formatTvl(tvl: number): string {
  if (tvl >= 1e9) return `$${(tvl / 1e9).toFixed(2)}B`;
  if (tvl >= 1e6) return `$${(tvl / 1e6).toFixed(1)}M`;
  return `$${tvl.toLocaleString()}`;
}

export function generateProtocolFarmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chainsStr = p.chains.length > 0 ? p.chains.join(', ') : 'multi-chain network';
  const catStr = p.category ? p.category : 'DeFi protocol';
  const tvlStr = formatTvl(p.tvl_usd);
  const name = p.name;

  return [
    {
      text: `Initialize a dedicated non-custodial farming wallet funded with native assets on ${chainsStr} to interact with ${name} (${catStr}, TVL ${tvlStr}).`,
      cost: 'approx. $5 in native gas tokens',
      time: '10 minutes',
    },
    {
      text: `Bridge and deposit capital into ${name} across supported chains (${chainsStr}), leveraging its core ${catStr} mechanisms to accumulate loyalty points and protocol credits.`,
      cost: 'variable capital allocation ($100+ recommended) and $3-5 gas',
      time: '20 minutes',
    },
    {
      text: `Engage in weekly recurring on-chain interactions on ${name}, such as liquidity provisioning, borrowing, staking, or participating in governance proposals.`,
      cost: '$2-4 weekly transaction fees',
      time: '15 minutes per week',
    },
    {
      text: `Maintain the position consistently over a sustained vesting window (minimum 45-60 days) to qualify for tier-1 airdrop snapshot epochs and multi-season reward multipliers.`,
      cost: 'opportunity cost of locked liquidity',
      time: '45 to 60 days',
    },
    {
      text: `Verify reward accumulation through ${name}'s official dashboard interface and ensure compliance with security best practices before final distribution claims.`,
      cost: 'zero fee for checking',
      time: '10 minutes',
    },
  ];
}

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
    }));
}

export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    growth_multiplier: row.model.momentum_multiplier,
    maturity_multiplier: row.model.recency_multiplier,
    watchlist: row.slug ? true : false,
  };
}

export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    rows: board.map((r) => ({
      rank: r.rank,
      slug: r.slug,
      name: r.name,
      category: r.category,
      chains: r.chains,
      tvl_usd: r.tvl_usd,
      change_7d: r.change_7d,
      mcap_usd: r.mcap_usd,
      listed_at: r.listed_at,
      age_days: r.age_days,
      implied_value_usd: r.implied_value_usd,
      growth_multiplier: r.model.momentum_multiplier,
      maturity_multiplier: r.model.recency_multiplier,
      farm_steps: r.farm_steps,
      watchlist: snapshot.watchlist.includes(r.slug),
    })),
    live,
  };
  return { board, radar };
}

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

export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
