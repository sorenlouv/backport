import type { Commit } from '../../entrypoint.api.js';
import type { ValidConfigOptions } from '../../options/options.js';
import { getIsMergeCommit, getShasInMergeCommit } from '../git/index.js';
import { fetchCommitBySha } from '../github/v4/fetchCommits/fetch-commit-by-sha.js';

export async function getMergeCommits(
  options: ValidConfigOptions,
  commit: Commit,
): Promise<Commit[]> {
  const { sha } = commit.sourceCommit;
  if (!options.mainline) {
    const isMergeCommit = await getIsMergeCommit(options, sha);
    if (isMergeCommit) {
      const shas = await getShasInMergeCommit(options, sha);
      return Promise.all(
        shas.toReversed().map((sha) => fetchCommitBySha({ ...options, sha })),
      );
    }
  }

  return [commit];
}
