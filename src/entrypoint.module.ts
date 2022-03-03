import { backportRun as run } from './backportRun';
import { ConfigFileOptions } from './options/ConfigOptions';
import { ValidConfigOptions } from './options/options';
import { fetchCommitByPullNumber } from './services/github/v4/fetchCommits/fetchCommitByPullNumber';
import { fetchCommitBySha } from './services/github/v4/fetchCommits/fetchCommitBySha';
import { fetchCommitsByAuthor } from './services/github/v4/fetchCommits/fetchCommitsByAuthor';
import { fetchPullRequestsBySearchQuery } from './services/github/v4/fetchCommits/fetchPullRequestsBySearchQuery';
import { getOptionsFromGithub } from './services/github/v4/getOptionsFromGithub/getOptionsFromGithub';
import { initLogger } from './services/logger';
import { Commit } from './services/sourceCommit/parseSourceCommit';
import { excludeUndefined } from './utils/excludeUndefined';

// public API
export { BackportResponse } from './backportRun';
export { ConfigFileOptions } from './options/ConfigOptions';
export { Commit };
export { fetchRemoteProjectConfig as getRemoteProjectConfig } from './services/github/v4/fetchRemoteProjectConfig';
export { getGlobalConfig as getLocalGlobalConfig } from './options/config/globalConfig';

export function backportRun(
  options: ConfigFileOptions,

  // cli args will not automatically be forwarded when it is consumed as a module
  // It is simple to forward args manually via `process.argv`:
  //
  // import { backportRun } from `backport
  // const args = process.argv.slice(2);
  // backportRun(options, args)
  //
  processArgs: string[] = []
) {
  return run({
    processArgs,
    optionsFromModule: excludeUndefined(options),
    isCliMode: false,
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
  initLogger({ ci: true, accessToken: options.accessToken });

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
