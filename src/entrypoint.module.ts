import { backportRun as run } from './backportRun';
import { BackportResponse } from './backportRun';
import { fetchCommitByPullNumber } from './lib/github/v4/fetchCommits/fetchCommitByPullNumber';
import { fetchCommitBySha } from './lib/github/v4/fetchCommits/fetchCommitBySha';
import { fetchCommitsByAuthor } from './lib/github/v4/fetchCommits/fetchCommitsByAuthor';
import { fetchPullRequestsBySearchQuery } from './lib/github/v4/fetchCommits/fetchPullRequestsBySearchQuery';
import { getOptionsFromGithub } from './lib/github/v4/getOptionsFromGithub/getOptionsFromGithub';
import { initLogger } from './lib/logger';
import type { Commit } from './lib/sourceCommit/parseSourceCommit';
import { ConfigFileOptions } from './options/ConfigOptions';
import { ValidConfigOptions } from './options/options';
import { excludeUndefined } from './utils/excludeUndefined';

// public API
export type {
  HandledErrorResult,
  SuccessResult,
  UnhandledErrorResult,
} from './runSequentially';
export type {
  BackportAbortResponse,
  BackportFailureResponse,
  BackportResponse,
  BackportSuccessResponse,
} from './backportRun';
export { BackportError } from './errors/BackportError';
export type { Commit } from './lib/sourceCommit/parseSourceCommit';
export type { ConfigFileOptions } from './options/ConfigOptions';
export { fetchRemoteProjectConfig as getRemoteProjectConfig } from './lib/github/v4/fetchRemoteProjectConfig';
export { getGlobalConfig as getLocalGlobalConfig } from './options/config/globalConfig';

export function backportRun({
  options,
  processArgs = [],
  exitCodeOnFailure = true,
}: {
  options: ConfigFileOptions;

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
  githubApiBaseUrlV4?: string;
  maxNumber?: number;
  onlyMissing?: boolean;
  prFilter?: string;
  pullNumber?: number;
  sha?: string | string[];
  skipRemoteConfig?: boolean;
  sourceBranch?: string;
  dateUntil?: string;
  dateSince?: string;
}): Promise<Commit[]> {
  initLogger({ interactive: false, accessToken: options.accessToken });

  const optionsFromGithub = await getOptionsFromGithub(options);

  if (options.pullNumber) {
    return [
      await fetchCommitByPullNumber({
        ...optionsFromGithub,
        ...options,
        pullNumber: options.pullNumber,
      }),
    ];
  }

  if (options.sha) {
    const shas = Array.isArray(options.sha) ? options.sha : [options.sha];

    return Promise.all(
      shas.map((sha) =>
        fetchCommitBySha({ ...optionsFromGithub, ...options, sha })
      )
    );
  }

  if (options.prFilter) {
    return fetchPullRequestsBySearchQuery({
      ...optionsFromGithub,
      ...options,
      prFilter: options.prFilter,
      author: options.author ?? null,
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
    'Must supply one of: `pullNumber`, `sha`, `prFilter` or `author`'
  );
}
