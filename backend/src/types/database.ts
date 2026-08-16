/**
 * Database Types
 *
 * TypeScript shapes for the constellation data model. Mirrors the schema defined in
 * /supabase/migrations/20260603120000_phe5_enums_and_tables.sql (PHE-5) and
 * /supabase/migrations/20260625120000_phe31_observation_polaris_model.sql (PHE-31),
 * extended by the v66 evidence hierarchy in PHE-51.
 */

export type Pillar =
  | 'origin'
  | 'emergence'
  | 'self_creation'
  | 'convergence'
  | 'becoming'
  | 'recognition'
  | 'transcendence';

export type PointType = 'standard' | 'follow_up';

export type Tier = 'free' | 'pro' | 'gifted';

export type PillarScores = Partial<Record<Pillar, number | null>>;

export interface UserProfile {
  user_id: string;
  display_name: string | null;
  stellar_color: string | null;
  tier: Tier | string;
  birthday: string | null; // ISO date (YYYY-MM-DD)
  constellation_age: number | null;
  avatar_url: string | null;
  prompt_times: Record<string, unknown>;
  user_intention: string | null;
  constellation_version: number;
  onairos_data: Record<string, unknown> | null;
  // PHE-42: account-lifecycle freeze flag. When true, Onairos pulls, the weekly
  // observation cron, and synthesis triggers all skip this user while every row
  // is retained and still served.
  frozen: boolean;
  created_at: string; // ISO timestamptz
  updated_at: string; // ISO timestamptz
}

export interface UserPersona {
  user_id: string;
  persona_data: Record<string, unknown>;
  connected_platforms: string[];
  archetype: string | null;
  user_summary: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConstellationPoint {
  id: string;
  user_id: string;
  pillar: Pillar;
  prompt: string;
  answer: string;
  type: PointType;
  created_at: string;
}

export interface ConstellationState {
  user_id: string;
  generated_at: string;
  version: number;
  onairos_snapshot: Record<string, unknown>;
  archetype: string | null;

  origin_score: number | null;
  origin_synthesis: string | null;

  emergence_score: number | null;
  emergence_synthesis: string | null;

  self_creation_score: number | null;
  self_creation_synthesis: string | null;

  convergence_score: number | null;
  convergence_synthesis: string | null;

  // Locked pillars — nullable until unlock conditions are met.
  becoming_score: number | null;
  becoming_synthesis: string | null;

  recognition_score: number | null;
  recognition_synthesis: string | null;

  transcendence_score: number | null;
  transcendence_synthesis: string | null;

  portrait: Record<string, unknown> | null;

  // PHE-31: forward-looking one-liner + Daily-tab 2-line mantra (1:1 with version).
  foresight: string | null;
  mantra: string | null;

  // PHE-34: idempotency key — the trigger_event_id of the last applied synthesis.
  // A repeat of the same trigger returns current state without bumping version.
  last_trigger_event_id: string | null;
}

// PHE-20: versioned, DB-backed Polaris Voice Standard. One row is active at a time
// (enforced by the voice_standard_one_active partial unique index).
export interface VoiceStandard {
  id: string;
  version: number;
  body: string;
  is_active: boolean;
  created_at: string;
}

export interface WaitlistEntry {
  id: string;
  email: string;
  created_at: string;
  // Legacy columns that predate PHE-5. Declared in the PHE-5 migration so fresh installs
  // match prod; nullable because the current waitlist-modal flow only writes `email`.
  name: string | null;
  role: string | null;
  platforms: string[] | null;
  why: string | null;
}

// ============================================================================
// PHE-31: Observation + Polaris data model
// Mirrors /supabase/migrations/20260625120000_phe31_observation_polaris_model.sql.
// ============================================================================

/** Optional DB-level enum for observation source platforms (columns stay `text[]`). */
export type ObservationSource =
  | 'linkedin'
  | 'spotify'
  | 'youtube'
  | 'instagram'
  | 'reddit'
  | 'pinterest';

/**
 * Analytics event types (column stays `text`). Mirrors the PHE-35 client queue's
 * actual names plus the PHE-43 ingest allowlist. `upgrade`/`downgrade` are kept
 * as accepted compatibility aliases; `observation_unlock` predates PHE-35.
 */
export type EventType =
  | 'tab_visit'
  | 'tab_duration'
  | 'days_since_last_visit'
  | 'polaris_message'
  | 'login'
  | 'upgrade_to_pro'
  | 'downgrade_to_free'
  | 'upgrade'
  | 'downgrade'
  | 'observation_unlock'
  | 'observation_feedback';

export type PolarisRole = 'user' | 'assistant';

export type SignalType =
  | 'frequency'
  | 'timing'
  | 'duration'
  | 'sequence'
  | 'recurrence'
  | 'vocabulary'
  | 'ratio'
  | 'absence'
  | 'convergence'
  | 'divergence';

export type GenerationRunStatus =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'rejected'
  | 'cancelled';

export type GeneratedArtifactType =
  | 'area_synthesis'
  | 'pillar_narrative'
  | 'opening_portrait'
  | 'daily_line';

/** Append-only feed of "what your data revealed" — many rows per pillar over time. */
export interface Observation {
  id: string;
  user_id: string;
  pillar: Pillar;
  body: string;
  source_platforms: string[];
  meta_label: string | null;
  is_new: boolean;
  locked_for_free: boolean;
  signal_hash: string;
  surfaced_at: string; // ISO timestamptz
  created_at: string; // ISO timestamptz
  area_id: string;
  generation_run_id: string;
  schema_version: number;
  points: string[];
  /** Null only for explicitly marked PHE-31 compatibility provenance. */
  signal_type: SignalType | null;
  evidence_n: number | null;
  evidence_span: string | null;
  span_start: string | null;
  span_end: string | null;
  record_count: number;
  sources: string[];
  prompt_version: string;
  model_version: string;
}

/** PHE-72: one `does this land?` row per user per observation. Never stores body. */
export interface ObservationFeedback {
  id: string;
  user_id: string;
  observation_id: string;
  verdict: 'new' | 'known' | 'reading' | null;
  opened: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// PHE-51: v66 evidence hierarchy
// source record -> signal -> observation -> area -> pillar
// ============================================================================

export interface GenerationRun {
  id: string;
  user_id: string;
  generation_system: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
  prompt_version: string;
  model: string;
  input_hash: string;
  status: GenerationRunStatus;
  started_at: string | null;
  completed_at: string | null;
  error_information: Record<string, unknown> | null;
  usage_input: number | null;
  usage_output: number | null;
  validator_results: Record<string, unknown>;
  created_at: string;
}

export interface SourceRecord {
  id: string;
  user_id: string;
  platform: string;
  external_record_id: string;
  record_type: string;
  occurred_at: string | null;
  ingested_at: string;
  payload_ciphertext: string | null; // PostgREST bytea representation
  encryption_version: number | null;
  encryption_metadata: Record<string, unknown> | null;
  content_hash: string;
  dedupe_key: string;
  schema_version: number;
  provenance_status: 'retained_source' | 'legacy_import';
  created_at: string;
}

export interface Signal {
  id: string;
  user_id: string;
  /** Null only when is_legacy_compatibility is true. */
  signal_type: SignalType | null;
  extractor_version: string;
  deterministic_dedupe_key: string;
  metric_value: Record<string, unknown>;
  evidence_n: number | null;
  span_start: string | null;
  span_end: string | null;
  canonical_span: string | null;
  record_count: number;
  sources: string[];
  version: number;
  supersedes_signal_id: string | null;
  generation_run_id: string | null;
  schema_version: number;
  is_legacy_compatibility: boolean;
  created_at: string;
}

export interface SignalSourceRecord {
  signal_id: string;
  source_record_id: string;
  user_id: string;
  created_at: string;
}

export interface Area {
  id: string;
  user_id: string;
  pillar: Pillar;
  label: string;
  ordinal: 1 | 2 | 3;
  generation_run_id: string | null;
  generation_version: number;
  schema_version: number;
  is_legacy_compatibility: boolean;
  supersedes_area_id: string | null;
  created_at: string;
}

export interface AreaSignalMembership {
  area_id: string;
  signal_id: string;
  user_id: string;
  ordinal: number;
  created_at: string;
}

export interface ObservationSignal {
  observation_id: string;
  signal_id: string;
  user_id: string;
  created_at: string;
}

export interface GeneratedArtifact {
  id: string;
  user_id: string;
  artifact_type: GeneratedArtifactType;
  pillar: Pillar | null;
  area_id: string | null;
  generation_run_id: string;
  output: Record<string, unknown>;
  version: number;
  schema_version: number;
  supersedes_artifact_id: string | null;
  created_at: string;
}

export interface ArtifactObservation {
  artifact_id: string;
  observation_id: string;
  user_id: string;
  ordinal: number;
  created_at: string;
}

export interface UnderneathReading {
  id: string;
  user_id: string;
  observation_id: string;
  generation_run_id: string;
  headline: string;
  belief: { said: string; n: number; where: string };
  record_evidence: Array<{ src: string; what: string }>;
  gap: string;
  mechanism: string;
  tell: string;
  basis: string;
  hedge: string;
  feedback_status: 'accepted' | 'rejected' | null;
  feedback_at: string | null;
  schema_version: number;
  created_at: string;
}

/** Append-only, versioned trait-grounding store. Internal; never surfaced raw. */
export interface UserTrait {
  id: string;
  user_id: string;
  keyword_tags: string[];
  insight: string | null;
  derived_from: string[];
  synthesis_version: number | null;
  created_at: string;
}

/** Per-platform connection state + redacted snapshot. Never stores an Onairos JWT. */
export interface OnairosConnection {
  id: string;
  user_id: string;
  platform: string;
  status: string; // 'connected' | 'disconnected'
  redacted_snapshot: Record<string, unknown> | null;
  connected_at: string;
  disconnected_at: string | null;
}

export interface PolarisConversation {
  id: string;
  user_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

/** Append-only Polaris turns. `body` is AES-256-GCM encrypted at rest. */
export interface PolarisMessage {
  id: string;
  conversation_id: string;
  user_id: string;
  role: PolarisRole;
  body: string;
  pillar_tag: Pillar | null;
  token_count: number;
  created_at: string;
}

/** Weekly Polaris token meter; PK (user_id, week). */
export interface PolarisTokenUsage {
  user_id: string;
  week: string; // ISO date (YYYY-MM-DD), Monday week start, UTC
  tokens_used: number;
  updated_at: string;
}

/** Append-only analytics events; structured props only, never message content. */
export interface AnalyticsEvent {
  id: string;
  user_id: string;
  event_type: EventType | string;
  props: Record<string, unknown>;
  occurred_at: string;
  created_at: string;
  // PHE-43: optional client-supplied idempotency key; unique per (user_id, event_id).
  event_id: string | null;
}

// ============================================================================
// PHE-39: Crisis pre-flight
// Mirrors /supabase/migrations/20260703120000_phe39_crisis_events.sql.
// ============================================================================

/**
 * Append-only audit of crisis pre-flight triggers. `text_hash` is sha256 of the
 * user text (hex) — the plaintext is NEVER persisted or logged.
 */
export interface CrisisEvent {
  id: string;
  user_id: string;
  category: string | null;
  text_hash: string;
  occurred_at: string; // ISO timestamptz
}
