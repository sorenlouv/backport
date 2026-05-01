/**
 * Merges config from defaults, config files, GitHub remote config, and CLI args
 * into a fully validated `ValidConfigOptions`.
 *
 * Precedence order (highest wins):
 *   1. defaults (from Zod schema)
 *   2. global config file (~/.backport/config.json)
 *   3. project config file (.backportrc.json)
 *   4. module options (programmatic API)
 *   5. remote GitHub config (.backportrc.json on default branch)
 *   6. CLI args (highest precedence)
 */
import chalk from 'chalk';
import { BackportError } from '../lib/backport-error.js';
import { getGlobalConfigPath } from '../lib/env.js';
import { getRepoOwnerAndNameFromGitRemotes } from '../lib/github/v4/get-repo-owner-and-name-from-git-remotes.js';
import type { OptionsFromGithub } from '../lib/github/v4/getOptionsFromGithub/get-options-from-github.js';
import { getOptionsFromGithub } from '../lib/github/v4/getOptionsFromGithub/get-options-from-github.js';
import { setAccessToken } from '../lib/logger.js';
import type { OptionsFromCliArgs } from './cli-args.js';
import { getOptionsFromConfigFiles } from './config/config.js';
import type { ConfigFileOptions, ValidConfigOptions } from './option-schema.js';
import {
  defaultConfigOptions,
  validOptionsSchema,
  GLOBAL_CONFIG_DOCS_LINK,
  PROJECT_CONFIG_DOCS_LINK,
} from './option-schema.js';
export type { ValidConfigOptions } from './option-schema.js';
export { defaultConfigOptions } from './option-schema.js';

export async function getOptions({
  optionsFromCliArgs,
  optionsFromModule,
}: {
  optionsFromCliArgs: OptionsFromCliArgs;
  optionsFromModule: ConfigFileOptions;
}): Promise<ValidConfigOptions> {
  // ── Step 1: load config files ─────────────────────────────────────
  const { globalConfig, projectConfig } = await getOptionsFromConfigFiles({
    optionsFromCliArgs,
    optionsFromModule,
  });

  // ── Step 2: merge to resolve access token + repo ──────────────────
  // Normalize legacy `accessToken` → `githubToken` for programmatic API
  // consumers so that `resolveRequiredOptions` can find the token regardless
  // of which key the caller used.
  const normalizedModuleOptions = {
    ...optionsFromModule,
    githubToken: optionsFromModule.githubToken ?? optionsFromModule.accessToken,
  };

  // Apply layers in precedence order (lowest → highest) to determine
  // the access token, repo owner/name needed for the GitHub API call.
  const combined = {
    ...defaultConfigOptions,
    ...globalConfig,
    ...projectConfig,
    ...normalizedModuleOptions,
    ...optionsFromCliArgs,
  };

  const { githubToken, repoName, repoOwner } =
    await resolveRequiredOptions(combined);

  // update logger
  setAccessToken(githubToken);

  // ── Step 3: fetch options from GitHub ──────────────────────────────
  const optionsFromGithub = await getOptionsFromGithub({
    ...combined,
    githubToken,
    repoName,
    repoOwner,
  });

  // ── Step 4: final merge with full precedence ──────────────────────
  const merged = mergeOptions({
    defaultConfigOptions,
    globalConfig,
    projectConfig,
    optionsFromModule: normalizedModuleOptions,
    optionsFromGithub,
    optionsFromCliArgs,
    githubToken,
    repoName,
    repoOwner,
  });

  // ── Step 5: reject empty strings before Zod parse ─────────────────
  throwForEmptyStringOptions(merged);

  // ── Step 6: validate via Zod ──────────────────────────────────────
  return validOptionsSchema.parse(merged) as ValidConfigOptions;
}

/**
 * Merges all option layers into a single object with explicit precedence.
 * Each subsequent spread wins over previous ones.
 */
function mergeOptions({
  defaultConfigOptions,
  globalConfig,
  projectConfig,
  optionsFromModule,
  optionsFromGithub,
  optionsFromCliArgs,
  githubToken,
  repoName,
  repoOwner,
}: {
  defaultConfigOptions: Record<string, unknown>;
  globalConfig: ConfigFileOptions;
  projectConfig: ConfigFileOptions;
  optionsFromModule: ConfigFileOptions;
  optionsFromGithub: OptionsFromGithub;
  optionsFromCliArgs: OptionsFromCliArgs;
  githubToken: string;
  repoName: string;
  repoOwner: string;
}) {
  return {
    // defaults for author and repoForkOwner come from the authenticated user
    author: optionsFromGithub.authenticatedUsername,
    repoForkOwner: optionsFromGithub.authenticatedUsername,

    // 1. schema defaults (lowest precedence)
    ...defaultConfigOptions,

    // 2. global config (~/.backport/config.json)
    ...globalConfig,

    // 3. project config (.backportrc.json)
    ...projectConfig,

    // 4. module options (programmatic API)
    ...optionsFromModule,

    // 5. remote GitHub config
    ...optionsFromGithub,

    // 6. CLI args (highest precedence)
    ...optionsFromCliArgs,

    // required properties (always set regardless of precedence)
    githubToken,
    repoName,
    repoOwner,
  };
}

/**
 * Resolves access token, repo owner, and repo name — the minimum required
 * options that must be available before we can call the GitHub API.
 */
async function resolveRequiredOptions(combined: {
  githubToken?: string;
  repoName?: string;
  repoOwner?: string;
  globalConfigFile?: string;
  cwd: string;
  githubApiBaseUrlV4?: string;
}) {
  const { githubToken, repoName, repoOwner, globalConfigFile } = combined;

  if (githubToken && repoName && repoOwner) {
    return { githubToken, repoName, repoOwner };
  }

  // require access token
  if (!githubToken) {
    const globalConfigPath = getGlobalConfigPath(globalConfigFile);
    throw new BackportError({
      code: 'invalid-credentials-exception',
      message: `Please update your config file: "${globalConfigPath}".\nIt must contain a valid "githubToken".\n\nRead more: ${GLOBAL_CONFIG_DOCS_LINK}`,
    });
  }

  // attempt to retrieve repo-owner and repo-name from git remote
  const gitRemote = await getRepoOwnerAndNameFromGitRemotes({
    cwd: combined.cwd,
    githubApiBaseUrlV4: combined.githubApiBaseUrlV4,
    githubToken,
  });

  if (!gitRemote.repoName || !gitRemote.repoOwner) {
    throw new BackportError({
      code: 'config-error-exception',
      message: `Please specify a repository: "--repo elastic/kibana".\n\nRead more: ${PROJECT_CONFIG_DOCS_LINK}`,
    });
  }

  return {
    githubToken,
    repoName: gitRemote.repoName,
    repoOwner: gitRemote.repoOwner,
  };
}

// ── Empty string validation ─────────────────────────────────────────
// Disallow empty strings for options that should be undefined instead.
// This is primarily an issue in Github Actions where inputs default to empty
// strings instead of undefined — failing early provides a better UX.
const DISALLOW_EMPTY_STRING_OPTIONS = [
  'githubToken',
  'author',
  'autoMergeMethod',
  'backportBinary',
  'backportBranchName',
  'workdir',
  'editor',
  'gitHostname',
  'githubApiBaseUrlV3',
  'githubApiBaseUrlV4',
  'logFilePath',
  'prDescription',
  'projectConfigFile',
  'prTitle',
  'repoForkOwner',
  'repoName',
  'repoOwner',
  'sha',
  'sourceBranch',
] as const;

function throwForEmptyStringOptions(options: Record<string, unknown>) {
  for (const optionName of DISALLOW_EMPTY_STRING_OPTIONS) {
    if (options[optionName] === '') {
      throw new BackportError({
        code: 'config-error-exception',
        message: `"${optionName}" cannot be empty!`,
      });
    }
  }
}

export function getActiveOptionsFormatted(options: ValidConfigOptions) {
  const customOptions = [
    ['repo', `${options.repoOwner}/${options.repoName}`],
    ['sourceBranch', `${options.sourceBranch}`],
  ];

  if (options.pullNumber) {
    customOptions.push(['pr', `${options.pullNumber}`]);
  }

  if (options.sha) {
    customOptions.push(['sha', `${options.sha}`]);
  }

  if (options.author) {
    customOptions.push(['author', `${options.author}`]);
  }

  if (options.autoMerge === true) {
    customOptions.push(['autoMerge', `${options.autoMerge}`]);
  }

  if (options.maxCount !== defaultConfigOptions.maxCount) {
    customOptions.push(['maxCount', `${options.maxCount}`]);
  }

  if (options.since) {
    customOptions.push(['since', `${options.since}`]);
  }

  if (options.until) {
    customOptions.push(['until', `${options.until}`]);
  }

  return (
    customOptions
      .map(([key, value]) => `${key}: ${chalk.bold(value)}`)
      .join(' | ') + `\n`
  );
}
