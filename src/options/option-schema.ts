import { z } from 'zod';
import { BackportError } from '../lib/backport-error.js';

const PROJECT_CONFIG_DOCS_LINK =
  'https://github.com/sorenlouv/backport/blob/main/docs/config-file-options.md#project-config-backportrcjson';

/**
 * Target branch choice — either a plain string or an object with name/value/checked.
 */
const targetBranchChoiceSchema = z.union([
  z.string(),
  z
    .object({
      name: z.string(),
      value: z.string().optional(),
      checked: z.boolean().optional(),
    })
    .transform((obj) => ({ ...obj, value: obj.value ?? obj.name })),
]);

/**
 * Schema for options that can appear in config files, module API, or CLI.
 * This is the single source of truth for option types and defaults.
 */
export const configOptionsSchema = z.object({
  accessToken: z.string().optional(),
  assignees: z.array(z.string()).default([]),
  author: z.string().nullable().optional(),
  autoAssign: z.boolean().default(false),
  autoFixConflicts: z.any().optional(),
  autoMerge: z.boolean().default(false),
  autoMergeMethod: z.enum(['merge', 'rebase', 'squash']).default('merge'),
  backportBinary: z.string().default('backport'),
  backportBranchName: z.string().optional(),
  branchLabelMapping: z.record(z.string(), z.string()).optional(),
  cherrypickRef: z.boolean().default(true),
  commitConflicts: z.boolean().default(false),
  autoResolveConflictsWithTheirs: z.boolean().default(false),
  commitPaths: z.array(z.string()).default([]),
  copySourcePRLabels: z
    .union([z.boolean(), z.string(), z.array(z.string())])
    .default(false),
  copySourcePRReviewers: z.boolean().default(false),
  cwd: z.string().default(process.cwd()),
  dateSince: z.string().nullable().default(null),
  dateUntil: z.string().nullable().default(null),
  details: z.boolean().default(false),
  dir: z.string().optional(),
  draft: z.boolean().default(false),
  dryRun: z.boolean().optional(),
  editor: z.string().optional(),
  fork: z.boolean().default(true),
  gitAuthorEmail: z.string().optional(),
  gitAuthorName: z.string().optional(),
  gitHostname: z.string().default('github.com'),
  githubActionRunId: z.number().optional(),
  githubApiBaseUrlV3: z.string().optional(),
  githubApiBaseUrlV4: z.string().optional(),
  globalConfigFile: z.string().optional(),
  interactive: z.boolean().default(true),
  logFilePath: z.string().optional(),
  mainline: z.number().optional(),
  ls: z.boolean().optional(),
  maxNumber: z.number().default(10),
  multipleBranches: z.boolean().default(true),
  multipleCommits: z.boolean().default(false),
  noVerify: z.boolean().default(true),
  noUnmergedBackportsHelp: z.boolean().default(false),
  onlyMissing: z.boolean().optional(),
  prDescription: z.string().optional(),
  prFilter: z.string().optional(),
  prTitle: z.string().optional(),
  projectConfigFile: z.string().optional(),
  publishStatusCommentOnAbort: z.boolean().default(false),
  publishStatusCommentOnFailure: z.boolean().default(false),
  publishStatusCommentOnSuccess: z.boolean().default(true),
  pullNumber: z.union([z.number(), z.array(z.number())]).optional(),
  repoForkOwner: z.string().optional(),
  repoName: z.string().optional(),
  repoOwner: z.string().optional(),
  resetAuthor: z.boolean().default(false),
  reviewers: z.array(z.string()).default([]),
  sha: z.union([z.string(), z.array(z.string())]).optional(),
  signoff: z.boolean().default(false),
  skipRemoteConfig: z.boolean().optional(),
  sourceBranch: z.string().optional(),
  sourcePRLabels: z.array(z.string()).default([]),
  targetBranchChoices: z.array(targetBranchChoiceSchema).default([]),
  targetBranches: z.array(z.string()).default([]),
  targetPRLabels: z.array(z.string()).default([]),
});

/**
 * Partial config options — what config files and CLI provide (all fields optional).
 */
export type ConfigOptions = z.input<typeof configOptionsSchema>;

/**
 * Fully resolved config options with defaults applied.
 */
export type ResolvedConfigOptions = z.output<typeof configOptionsSchema>;

/**
 * The default values for all config options, derived from Zod schema.
 */
export const defaultConfigOptions: ResolvedConfigOptions =
  configOptionsSchema.parse({});

/**
 * Schema for the final validated options that include required fields
 * resolved during startup (access token, repo info, authenticated user).
 */
export const validOptionsSchema = configOptionsSchema
  .extend({
    accessToken: z.string().min(1),
    author: z.string().nullable().default(null),
    repoName: z.string().min(1),
    repoOwner: z.string().min(1),
    repoForkOwner: z.string(),
    authenticatedUsername: z.string(),
    sourceBranch: z.string(),
    isRepoPrivate: z.boolean().optional(),
  })
  // Require target branches unless running in list-only mode (--ls)
  .superRefine((data) => {
    if (
      !data.ls &&
      data.targetBranches.length === 0 &&
      data.targetBranchChoices.length === 0 &&
      (!data.branchLabelMapping ||
        Object.keys(data.branchLabelMapping).length === 0)
    ) {
      throw new BackportError(
        `Please specify a target branch: "--branch 6.1".\n\nRead more: ${PROJECT_CONFIG_DOCS_LINK}`,
      );
    }
  });

export type ValidConfigOptions = Readonly<z.output<typeof validOptionsSchema>>;
