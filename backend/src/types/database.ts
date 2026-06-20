/**
 * PHE-5 Database Types
 *
 * TypeScript shapes for the constellation data model. Mirrors the schema defined in
 * /supabase/migrations/20260603120000_phe5_enums_and_tables.sql.
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
