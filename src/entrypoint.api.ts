/** Public module API for programmatic consumers. Re-exports types and wraps backportRun. */
import { backportRun as run } from './backport-run.js';
import type { BackportResponse } from './backport-run.js';
import { fetchCommitsByPullNumber } from './lib/github/v4/fetchCommits/fetch-commit-by-pull-number.js';
import { fetchCommitBySha } from './lib/github/v4/fetchCommits/fetch-commit-by-sha.js';
import { fetchCommitsByAuthor } from './lib/github/v4/fetchCommits/fetch-commits-by-author.js';
import { fetchPullRequestsBySearchQuery } from './lib/github/v4/fetchCommits/fetch-pull-requests-by-search-query.js';
import { getOptionsFromGithub as _getOptionsFromGithub } from './lib/github/v4/getOptionsFromGithub/get-options-from-github.js';
import { initLogger } from './lib/logger.js';
import type { Commit } from './lib/sourceCommit/parse-source-commit.js';
import type { ConfigFileOptions } from './options/config-options.js';
import type { ValidConfigOptions } from './options/options.js';
import { excludeUndefined } from './utils/exclude-undefined.js';

// public API
export type { ErrorResult, SuccessResult } from './lib/run-sequentially.js';
export type { BackportResponse } from './backport-run.js';
export type { Commit } from './lib/sourceCommit/parse-source-commit.js';
export type { ConfigFileOptions } from './options/config-options.js';
export { getTargetBranchFromLabel } from './lib/sourceCommit/get-pull-request-states.js';
export { BackportError } from './lib/backport-error.js';
export type { BackportErrorCode, ErrorContext } from './lib/backport-error.js';
export { getGlobalConfig } from './options/config/global-config.js';
export { getProjectConfig } from './options/config/project-config.js';

// wrap `getOptionsFromGithub` with logger
export function getOptionsFromGithub(
  options: Parameters<typeof _getOptionsFromGithub>[0],
) {
  initLogger({ interactive: false, accessToken: options.accessToken });
  return _getOptionsFromGithub(options);
}

export async function backportRun({
  options = {},
  processArgs = [],
  exitCodeOnFailure = true,
}: {
  options?: ConfigFileOptions;

  // cli args will not automatically be forwarded when backport is consumed as a module
  // It is simple to forward args manually via `process.argv`:
  //
  // import { backportRun } from 'backport'
  // backportRun({ options, processArgs: process.argv.slice(2) })
  //
  processArgs?: string[];
  exitCodeOnFailure?: boolean;
}): Promise<BackportResponse> {
  return run({
    optionsFromModule: excludeUndefined(options),
    processArgs,
    exitCodeOnFailure,
  });
}

export async function getCommits(options: {
  // required
  accessToken: string;
  repoName: string;
  repoOwner: string;

  // optional
  author?: string;
  branchLabelMapping?: ValidConfigOptions['branchLabelMapping'];
  dateSince?: string;
  dateUntil?: string;
  githubApiBaseUrlV4?: string;
  maxNumber?: number;
  onlyMissing?: boolean;
  prFilter?: string;
  pullNumber?: number | number[];
  sha?: string | string[];
  skipRemoteConfig?: boolean;
  sourceBranch?: string;
}): Promise<Commit[]> {
  initLogger({ interactive: false, accessToken: options.accessToken });

  const optionsFromGithub = await _getOptionsFromGithub(options);

  if (options.pullNumber) {
    const pullNumbers = Array.isArray(options.pullNumber)
      ? options.pullNumber
      : [options.pullNumber];

    const nestedCommits = await Promise.all(
      pullNumbers.map((pullNumber) =>
        fetchCommitsByPullNumber({
          ...optionsFromGithub,
          ...options,
          pullNumber,
        }),
      ),
    );

    return nestedCommits.flat();
  }

  if (options.sha) {
    const shas = Array.isArray(options.sha) ? options.sha : [options.sha];

    return Promise.all(
      shas.map((sha) =>
        fetchCommitBySha({ ...optionsFromGithub, ...options, sha }),
      ),
    );
  }

  if (options.prFilter) {
    return fetchPullRequestsBySearchQuery({
      ...optionsFromGithub,
      ...options,
      prFilter: options.prFilter,
      author: options.author ?? null,
      dateSince: options.dateSince ?? null,
      dateUntil: options.dateUntil ?? null,
    });
  }

  if (options.author) {
    return fetchCommitsByAuthor({
      ...optionsFromGithub,
      ...options,
      author: options.author,
      dateSince: options.dateSince ?? null,
      dateUntil: options.dateUntil ?? null,
    });
  }

  throw new Error(
    'Must supply one of: `pullNumber`, `sha`, `prFilter` or `author`',
  );
}
