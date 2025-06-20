import type { Commit } from '../../entrypoint.api';
import type { ValidConfigOptions } from '../../options/options';
import { getIsMergeCommit, getShasInMergeCommit } from '../git';
import { fetchCommitBySha } from '../github/v4/fetchCommits/fetch-commit-by-sha';

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
        shas.reverse().map((sha) => fetchCommitBySha({ ...options, sha })),
      );
    }
  }

  return [commit];
}
