/**
 * Central re-exports of key domain types.
 * Definitions stay in their source modules; this barrel provides a single import location.
 */

// Commit types
export type { Commit } from '../lib/sourceCommit/parse-source-commit.js';
export type { CommitAuthor } from '../lib/author.js';

// Backport result types
export type {
  Result,
  SuccessResult,
  ErrorResult,
} from '../lib/run-sequentially.js';

// Backport response type (returned by backportRun)
export type { BackportResponse } from '../backport-run.js';

// Configuration types
export type { ValidConfigOptions } from '../options/option-schema.js';
export type { ConfigFileOptions } from '../options/config-options.js';
