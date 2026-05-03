/**
 * Re-exports config-related types from the canonical schema definition.
 *
 * The types themselves live in `option-schema.ts` (single source of truth).
 * This module exists for backward-compatible import paths; new code should
 * import directly from `option-schema.ts`.
 */
export type {
  AutoFixConflictsHandler,
  ConfigFileOptions,
  TargetBranchChoice,
  TargetBranchChoiceOrString,
} from './option-schema.js';
