import { z } from 'zod';
import type { TargetBranchChoiceOrString } from './config-options';

// Target branch choice schema
const targetBranchChoiceSchema: z.ZodType<TargetBranchChoiceOrString> = z.union(
  [
    z.string(),
    z.object({
      name: z.string(),
      checked: z.boolean().optional(),
    }),
  ],
);

// Base config schema WITHOUT defaults - used for parsing
// Defaults are applied later in the merging process
const baseConfigSchema = z.object({
  accessToken: z.string().optional(),
  assignees: z.array(z.string()).optional(),
  author: z.union([z.string(), z.null()]).optional(),
  autoAssign: z.boolean().optional(),
  autoMerge: z.boolean().optional(),
  autoMergeMethod: z.enum(['merge', 'rebase', 'squash']).optional(),
  backportBinary: z.string().optional(),
  backportBranchName: z.string().optional(),
  cherrypickRef: z.boolean().optional(),
  commitConflicts: z.boolean().optional(),
  commitPaths: z.array(z.string()).optional(),
  copySourcePRLabels: z.boolean().optional(),
  copySourcePRReviewers: z.boolean().optional(),
  details: z.boolean().optional(),
  dir: z.string().optional(),
  draft: z.boolean().optional(),
  dryRun: z.boolean().optional(),
  editor: z.string().optional(),
  fork: z.boolean().optional(),
  gitAuthorEmail: z.string().optional(),
  gitAuthorName: z.string().optional(),
  gitHostname: z.string().optional(),
  githubActionRunId: z.number().optional(),
  githubApiBaseUrlV3: z.string().optional(),
  githubApiBaseUrlV4: z.string().optional(),
  interactive: z.boolean().optional(),
  logFilePath: z.string().optional(),
  ls: z.boolean().optional(),
  maxNumber: z.number().optional(),
  mainline: z.number().optional(),
  multiple: z.boolean().optional(),
  multipleBranches: z.boolean().optional(),
  multipleCommits: z.boolean().optional(),
  noVerify: z.boolean().optional(),
  prDescription: z.string().optional(),
  prFilter: z.string().optional(),
  projectConfigFile: z.string().optional(),
  prTitle: z.string().optional(),
  publishStatusCommentOnAbort: z.boolean().optional(),
  publishStatusCommentOnFailure: z.boolean().optional(),
  publishStatusCommentOnSuccess: z.boolean().optional(),
  pullNumber: z.union([z.number(), z.array(z.number())]).optional(),
  repoForkOwner: z.string().optional(),
  repoName: z.string().optional(),
  repoOwner: z.string().optional(),
  resetAuthor: z.boolean().optional(),
  reviewers: z.array(z.string()).optional(),
  sha: z.union([z.string(), z.array(z.string())]).optional(),
  signoff: z.boolean().optional(),
  skipRemoteConfig: z.boolean().optional(),
  noUnmergedBackportsHelp: z.boolean().optional(),
  sourceBranch: z.string().optional(),
  sourcePRLabels: z.array(z.string()).optional(),
  targetBranchChoices: z.array(targetBranchChoiceSchema).optional(),
  targetBranches: z.array(z.string()).optional(),
  targetPRLabels: z.array(z.string()).optional(),
  telemetry: z.boolean().optional(),
  cwd: z.string().optional(),
  dateSince: z.string().nullable().optional(),
  dateUntil: z.string().nullable().optional(),
  globalConfigFile: z.string().optional(),

  // Deprecated options (for backward compatibility)
  upstream: z.string().optional(),
  branches: z.array(targetBranchChoiceSchema).optional(),
  labels: z.array(z.string()).optional(),
  addOriginalReviewers: z.boolean().optional(),

  // Config file only options
  branchLabelMapping: z.record(z.string(), z.string()).optional(),

  // yargs-only options (for parsing, not for validation)
  help: z.boolean().optional(),
  version: z.boolean().optional(),
  v: z.boolean().optional(),
});

// Schema for partial config (from files/cli) - without defaults applied
// This is used for parsing CLI args and config files where we don't want defaults
// Defaults are applied later via manual merge in options.ts
export const partialConfigSchema = baseConfigSchema.loose();
