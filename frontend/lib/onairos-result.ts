/**
 * Onairos completion-payload normalizer.
 * ----------------------------------------------------------------------------
 * The SDK's `onComplete(result)` payload is schema-loose and its shape depends on
 * which flags/branches ran. Two facts drive this module:
 *
 * 1. `result.connectedSources` / `result.ascendContext` are ONLY attached for
 *    "Ascend" white-label apps (the SDK gates them on `isAscendApp`, derived from
 *    `webpageName`). For PHENYX they are ALWAYS undefined — reading them was why a
 *    perfectly good connection surfaced as "connect at least one platform".
 * 2. With `autoFetch` (our default) the traits/insights HTTP response — the body
 *    visible in the network tab — is merged in as `result.apiResponse`, NOT
 *    spread onto the result root. Its documented shape is:
 *
 *      { success, userProfile, trainingResults: { traits, userTraits, ... },
 *        inferenceResults, user, connectedPlatforms: [...], metadata }
 *
 * So the connected platforms live at `result.apiResponse.connectedPlatforms` and
 * the trait block at `result.apiResponse.trainingResults.traits`. Rather than
 * hard-coding that one path (and breaking on the next SDK shape change) we probe
 * every root/key the SDK is known to use and take the first hit.
 *
 * The normalizer also collapses the payload's heavy triplication — the same
 * summary / explanation / nudges appear verbatim under `userProfile`,
 * `trainingResults.traits` AND `trainingResults.userTraits.DataAnalysis
 * .personality_traits` — into ONE canonical trait block. That block is what we
 * persist and what we hand to synthesis, so the Claude call and the stored
 * snapshots carry one copy instead of three.
 */
import type { OnairosCompleteData } from "onairos";

type Json = Record<string, unknown>;

/** Bumped whenever `buildOnairosTraitObject`'s output shape changes. */
export const ONAIROS_TRAIT_SCHEMA_VERSION = 1;

export interface OnairosNudge {
  text: string;
}

/**
 * Canonical trait block. Mirrors the SDK's documented `traits` shape (see
 * node_modules/onairos/docs/DEVELOPER_SDK_CHANGES.md §2) so downstream readers —
 * notably the backend's `trait_object.traits.archetype` lookup — keep working
 * against the vendor's own vocabulary rather than a PHENYX-only invention.
 */
export interface OnairosTraitBlock {
  positive_traits: Record<string, number>;
  traits_to_improve: Record<string, number>;
  user_summary: string | null;
  top_traits_explanation: string | null;
  archetype: string | null;
  nudges: OnairosNudge[];
}

export interface NormalizedOnairosResult {
  /** Lowercased, deduped connector ids (e.g. ["youtube"]). */
  platforms: string[];
  /** Canonical trait block, or null when the payload carried no trait content. */
  traits: OnairosTraitBlock | null;
  /** True when `traits` carries usable content (scores or prose). */
  hasTraits: boolean;
  archetype: string | null;
  training: { completed: boolean; lastTrainingDate: string | null };
  metadata: {
    traitsSource: string | null;
    /** The payload's own platform count — a cross-check on `platforms.length`. */
    platformCount: number | null;
    totalItemsAnalyzed: number | null;
    coverage: string | null;
  };
  /** False when the SDK explicitly reported a cancel / failure / error. */
  ok: boolean;
  cancelled: boolean;
  error: string | null;
}

/** Atomically claims the first accepted completion in a synchronous callback. */
export function claimOnairosCompletion(flag: { current: boolean }): boolean {
  if (flag.current) return false;
  flag.current = true;
  return true;
}

// ----------------------------------------------------------------------------
// Primitives
// ----------------------------------------------------------------------------

function isRecord(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readPath(root: unknown, path: readonly string[]): unknown {
  let current: unknown = root;
  for (const key of path) {
    if (!isRecord(current)) return undefined;
    current = current[key];
  }
  return current;
}

function toText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** `{ "Tech-Curious Builder": 96, ... }` — non-numeric entries are dropped. */
function toScoreMap(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {};
  const out: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value)) {
    const score = toFiniteNumber(raw);
    if (score !== null) out[key] = score;
  }
  return out;
}

/** Accepts `[{ text }]`, `[{ nudge }]`, `[{ message }]` or a bare string array. */
function toNudges(value: unknown): OnairosNudge[] {
  if (!Array.isArray(value)) return [];
  const out: OnairosNudge[] = [];
  for (const entry of value) {
    const text =
      typeof entry === "string"
        ? toText(entry)
        : isRecord(entry)
          ? toText(entry.text) ?? toText(entry.nudge) ?? toText(entry.message)
          : null;
    if (text) out.push({ text });
  }
  return out;
}

// ----------------------------------------------------------------------------
// Root probing
// ----------------------------------------------------------------------------

/**
 * Objects the traits/platform payload can hang off, most likely first.
 * `apiResponse` leads because that is where `autoFetch` merges the fetched body;
 * the result root itself is kept for the branches that spread it in directly.
 */
function candidateRoots(result: unknown): Json[] {
  const roots: Json[] = [];
  const push = (value: unknown) => {
    if (isRecord(value) && !roots.includes(value)) roots.push(value);
  };

  push(result);
  if (isRecord(result)) {
    const api = result.apiResponse;
    push(api);
    push(readPath(api, ["data"]));
    push(readPath(api, ["result"]));
    push(result.userData);
    push(result.userDataSummary);
    push(result.data);
  }
  return roots;
}

/** Returns the first defined value found at `paths` across `roots`. */
function firstHit(roots: readonly Json[], paths: readonly (readonly string[])[]): unknown {
  for (const root of roots) {
    for (const path of paths) {
      const value = readPath(root, path);
      if (value !== undefined && value !== null) return value;
    }
  }
  return undefined;
}

// ----------------------------------------------------------------------------
// Platforms
// ----------------------------------------------------------------------------

// Every key the SDK is known to publish a connected-platform list under. The
// first three are the real ones today; the rest are legacy/branch-specific
// aliases kept so a shape change degrades to "still works" instead of "blocked".
const PLATFORM_LIST_PATHS: readonly (readonly string[])[] = [
  ["connectedPlatforms"],
  ["connected_platforms"],
  ["connectedSources"],
  ["connectedAccounts"],
  ["platforms"],
  ["accountStatus", "connectedPlatforms"],
  ["accountStatus", "connected_platforms"],
  ["ascendContext", "connectedSources"],
  ["userProfile", "connectedPlatforms"],
  ["metadata", "connectedPlatforms"],
];

/** Entries may be plain strings or account objects — pull the connector id. */
function toPlatformName(entry: unknown): string | null {
  if (typeof entry === "string") return toText(entry)?.toLowerCase() ?? null;
  if (!isRecord(entry)) return null;
  for (const key of ["platform", "name", "provider", "connector", "source", "type", "id"]) {
    const name = toText(entry[key]);
    if (name) return name.toLowerCase();
  }
  return null;
}

/**
 * Connected platform ids from an Onairos completion payload — deduped, lowercased,
 * first-seen order preserved. Empty when the payload names none (which is NOT the
 * same as "nothing connected"; see `hasTraits`).
 */
export function getConnectedPlatforms(result: OnairosCompleteData | unknown): string[] {
  const roots = candidateRoots(result);
  const seen = new Set<string>();
  const out: string[] = [];

  // Union across every root/alias rather than first-hit: a payload can name
  // youtube under `connectedPlatforms` and linkedin under `connectedAccounts`.
  for (const root of roots) {
    for (const path of PLATFORM_LIST_PATHS) {
      const list = readPath(root, path);
      if (!Array.isArray(list)) continue;
      for (const entry of list) {
        const name = toPlatformName(entry);
        if (name && !seen.has(name)) {
          seen.add(name);
          out.push(name);
        }
      }
    }
  }
  return out;
}

// ----------------------------------------------------------------------------
// Traits
// ----------------------------------------------------------------------------

// Trait blocks, richest first. `trainingResults.traits` carries the score maps AND
// the prose; `userProfile` carries prose only, so it ranks last and is also used
// to backfill prose fields missing from a score-only block.
const TRAIT_BLOCK_PATHS: readonly (readonly string[])[] = [
  ["trainingResults", "traits"],
  ["traits"],
  ["trainingResults", "userTraits", "DataAnalysis", "personality_traits"],
  ["userTraits", "DataAnalysis", "personality_traits"],
  ["personality_traits"],
  ["userProfile"],
  ["profile"],
];

const PROSE_FALLBACK_PATHS: readonly (readonly string[])[] = [
  ["userProfile"],
  ["trainingResults", "traits"],
  ["trainingResults", "userTraits", "DataAnalysis", "personality_traits"],
  ["profile"],
];

/** A block is only usable if it actually carries trait content. */
function looksLikeTraitBlock(value: unknown): value is Json {
  if (!isRecord(value)) return false;
  return (
    isRecord(value.positive_traits) ||
    isRecord(value.traits_to_improve) ||
    typeof value.user_summary === "string" ||
    typeof value.archetype === "string" ||
    Array.isArray(value.nudges)
  );
}

function extractTraits(roots: readonly Json[]): OnairosTraitBlock | null {
  let primary: Json | null = null;
  for (const root of roots) {
    for (const path of TRAIT_BLOCK_PATHS) {
      const block = readPath(root, path);
      if (looksLikeTraitBlock(block)) {
        primary = block;
        break;
      }
    }
    if (primary) break;
  }
  if (!primary) return null;

  // Prose can live on a different block than the scores (score-only trait maps
  // are a documented SDK shape), so backfill each missing field independently.
  const proseBlocks: Json[] = [primary];
  for (const root of roots) {
    for (const path of PROSE_FALLBACK_PATHS) {
      const block = readPath(root, path);
      if (isRecord(block) && !proseBlocks.includes(block)) proseBlocks.push(block);
    }
  }
  const prose = (key: string): string | null => {
    for (const block of proseBlocks) {
      const text = toText(block[key]);
      if (text) return text;
    }
    return null;
  };
  const nudges = (): OnairosNudge[] => {
    for (const block of proseBlocks) {
      const list = toNudges(block.nudges);
      if (list.length > 0) return list;
    }
    return [];
  };

  return {
    positive_traits: toScoreMap(primary.positive_traits),
    traits_to_improve: toScoreMap(primary.traits_to_improve),
    user_summary: prose("user_summary"),
    top_traits_explanation: prose("top_traits_explanation"),
    archetype: prose("archetype"),
    nudges: nudges(),
  };
}

function traitBlockHasContent(traits: OnairosTraitBlock | null): boolean {
  if (!traits) return false;
  return (
    Object.keys(traits.positive_traits).length > 0 ||
    Object.keys(traits.traits_to_improve).length > 0 ||
    traits.user_summary !== null ||
    traits.top_traits_explanation !== null ||
    traits.archetype !== null ||
    traits.nudges.length > 0
  );
}

// ----------------------------------------------------------------------------
// Status
// ----------------------------------------------------------------------------

/**
 * A completion is a failure only when the SDK SAYS so. `success` is absent on the
 * happy path (the SDK sets it explicitly to `false` on its training-guard branch),
 * so we must test for `=== false` rather than falsiness.
 */
function readStatus(result: unknown): {
  ok: boolean;
  cancelled: boolean;
  error: string | null;
} {
  if (!isRecord(result)) {
    return { ok: false, cancelled: false, error: "empty onairos result" };
  }

  const error =
    toText(result.error) ??
    toText(readPath(result, ["apiResponse", "error"])) ??
    null;

  const cancelled = result.cancelled === true;
  const explicitFailure =
    cancelled ||
    result.success === false ||
    readPath(result, ["apiResponse", "success"]) === false ||
    error !== null;

  return { ok: !explicitFailure, cancelled, error };
}

// ----------------------------------------------------------------------------
// Public API
// ----------------------------------------------------------------------------

export function normalizeOnairosResult(
  result: OnairosCompleteData | unknown
): NormalizedOnairosResult {
  const roots = candidateRoots(result);
  const traits = extractTraits(roots);
  const status = readStatus(result);

  return {
    platforms: getConnectedPlatforms(result),
    traits,
    hasTraits: traitBlockHasContent(traits),
    archetype: traits?.archetype ?? toText(firstHit(roots, [["archetype"]])),
    training: {
      completed:
        firstHit(roots, [
          ["trainingResults", "trainingCompleted"],
          ["trainingCompleted"],
        ]) === true,
      lastTrainingDate: toText(
        firstHit(roots, [
          ["trainingResults", "lastTrainingDate"],
          ["lastTrainingDate"],
        ])
      ),
    },
    metadata: {
      traitsSource: toText(firstHit(roots, [["metadata", "traitsSource"]])),
      platformCount: toFiniteNumber(firstHit(roots, [["metadata", "platformCount"]])),
      totalItemsAnalyzed: toFiniteNumber(
        firstHit(roots, [
          ["trainingResults", "userTraits", "metadata", "total_items_analyzed"],
          ["userTraits", "metadata", "total_items_analyzed"],
        ])
      ),
      coverage: toText(
        firstHit(roots, [
          ["trainingResults", "userTraits", "metadata", "coverage"],
          ["userTraits", "metadata", "coverage"],
        ])
      ),
    },
    ok: status.ok,
    cancelled: status.cancelled,
    error: status.error,
  };
}

/**
 * The compact, allowlisted snapshot we persist and hand to synthesis.
 *
 * Deliberately NOT the raw completion payload:
 *  - ONE copy of the summary/explanation/nudges instead of the payload's three.
 *  - `traits.archetype` kept at the vendor path the backend already reads
 *    (`persona.service.ts` → `onairosData?.traits?.archetype`).
 *  - No `user.email` / `user.username`: the payload carries PII we have no use
 *    for, and an allowlist is the only construction that cannot leak it.
 *  - NOTHING time-varying. The backend derives its synthesis `event_id` from a
 *    hash of this object, so a `captured_at`-style field would defeat that
 *    idempotency and let one connection synthesize twice.
 */
export function buildOnairosTraitObject(
  normalized: NormalizedOnairosResult
): Record<string, unknown> {
  const traits: OnairosTraitBlock = normalized.traits ?? {
    positive_traits: {},
    traits_to_improve: {},
    user_summary: null,
    top_traits_explanation: null,
    archetype: null,
    nudges: [],
  };

  return {
    schema_version: ONAIROS_TRAIT_SCHEMA_VERSION,
    platforms: normalized.platforms,
    archetype: normalized.archetype,
    traits,
    training: {
      completed: normalized.training.completed,
      last_training_date: normalized.training.lastTrainingDate,
    },
    metadata: {
      traits_source: normalized.metadata.traitsSource,
      platform_count: normalized.metadata.platformCount ?? normalized.platforms.length,
      total_items_analyzed: normalized.metadata.totalItemsAnalyzed,
      coverage: normalized.metadata.coverage,
    },
  };
}
