import fs from 'node:fs/promises';
import stripJsonComments from 'strip-json-comments';
import { BackportError } from '../../lib/backport-error.js';
import { logger } from '../../lib/logger.js';
import { excludeUndefined } from '../../utils/exclude-undefined.js';
import type { ConfigFileOptions } from '../config-options.js';

export async function readConfigFile(
  filepath: string,
): Promise<ConfigFileOptions> {
  const fileContents = await fs.readFile(filepath, 'utf8');

  try {
    return parseConfigFile(fileContents);
  } catch (error) {
    logger.debug(error);
    throw new BackportError({
      code: 'config-error-exception',
      message: `"${filepath}" contains invalid JSON:\n\n${fileContents}`,
    });
  }
}
// ensure backwards compatibility when config options are renamed
export function normalizeDeprecatedOptions(
  options: ConfigFileOptions,
): ConfigFileOptions {
  const {
    upstream,
    labels,
    branches,
    addOriginalReviewers,
    accessToken,
    commitConflicts,
    autoResolveConflictsWithTheirs,
    maxNumber,
    prFilter,
    dateSince,
    dateUntil,
    dir,
    cherrypickRef,
    details,
    all,
    ...config
  } = options;

  // Warn about deprecated options that are actually present
  const deprecatedMappings: Array<[unknown, string, string]> = [
    [accessToken, 'accessToken', 'githubToken'],
    [branches, 'branches', 'targetBranchChoices'],
    [upstream, 'upstream', 'repoOwner/repoName'],
    [addOriginalReviewers, 'addOriginalReviewers', 'copySourcePRReviewers'],
    [labels, 'labels', 'targetPRLabels'],
    [commitConflicts, 'commitConflicts', 'conflictResolution'],
    [
      autoResolveConflictsWithTheirs,
      'autoResolveConflictsWithTheirs',
      'conflictResolution',
    ],
    [maxNumber, 'maxNumber', 'maxCount'],
    [prFilter, 'prFilter', 'prQuery'],
    [dateSince, 'dateSince', 'since'],
    [dateUntil, 'dateUntil', 'until'],
    [dir, 'dir', 'workdir'],
    [cherrypickRef, 'cherrypickRef', 'cherryPickRef'],
    [details, 'details', 'verbose'],
    [all, 'all', 'author'],
  ];

  for (const [value, oldKey, newKey] of deprecatedMappings) {
    if (value !== undefined) {
      logger.warn(`"${oldKey}" is deprecated. Use "${newKey}" instead.`);
    }
  }

  const { repoName, repoOwner } = parseUpstream(upstream, config);

  return excludeUndefined({
    ...config,

    // `accessToken` was renamed `githubToken`
    githubToken: config.githubToken ?? accessToken,

    // `branches` was renamed `targetBranchChoices`
    targetBranchChoices: config.targetBranchChoices ?? branches,

    // `upstream` has been renamed to `repoOwner`/`repoName`
    repoName,
    repoOwner,

    // `addOriginalReviewers` has been renamed to `copySourcePRReviewers`
    copySourcePRReviewers: config.copySourcePRReviewers ?? addOriginalReviewers,

    // `labels` was renamed `targetPRLabels`
    targetPRLabels: config.targetPRLabels ?? labels,

    // `commitConflicts` and `autoResolveConflictsWithTheirs` were merged into `conflictResolution`
    conflictResolution:
      config.conflictResolution ??
      (autoResolveConflictsWithTheirs
        ? 'theirs'
        : commitConflicts
          ? 'commit'
          : undefined),

    // `maxNumber` was renamed `maxCount`
    maxCount: config.maxCount ?? maxNumber,

    // `prFilter` was renamed `prQuery`
    prQuery: config.prQuery ?? prFilter,

    // `dateSince`/`dateUntil` were renamed `since`/`until`
    since: config.since ?? dateSince,
    until: config.until ?? dateUntil,

    // `dir` was renamed `workdir`
    workdir: config.workdir ?? dir,

    // `cherrypickRef` was renamed `cherryPickRef`
    cherryPickRef: config.cherryPickRef ?? cherrypickRef,

    // `details` was renamed `verbose`
    verbose: config.verbose ?? details,

    // `all` was previously merged with CLI options and meant `author: null`
    author: all ? null : config.author,
  });
}

// ensure backwards compatibility when config options are renamed
export function parseConfigFile(fileContents: string): ConfigFileOptions {
  const configWithoutComments = stripJsonComments(fileContents);
  const parsed = JSON.parse(configWithoutComments);

  return normalizeDeprecatedOptions(parsed);
}

function parseUpstream(
  upstream: string | undefined,
  config: ConfigFileOptions,
) {
  if (upstream) {
    const [repoOwner, repoName] = upstream.split('/');
    return { repoOwner, repoName };
  }

  return {
    repoOwner: config.repoOwner,
    repoName: config.repoName,
  };
}
