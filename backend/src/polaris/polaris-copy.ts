// Verbatim honest-limits + sparse copy (ticket §7). The honest-limits line is
// produced by the model (instructed in the grounding block); the sparse nudge is
// appended server-side so its wording is guaranteed byte-exact (AC3). Kept apart
// from polaris.service so scripts/voice-check.ts can read it without Nest.

export const SPARSE_NUDGE =
  "the more you connect, the clearer this gets. ask again as your constellation fills in.";

/** How the honest-limits line opens. A reply starting with it is fixed copy around an observation. */
export const HONEST_LIMITS_OPENER =
  "that’s not something polaris has a clear read on yet.";
