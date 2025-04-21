import { CommitByPullNumberQuery } from '../../../../graphql/generated';
import { ValidConfigOptions } from '../../../../options/options';
import { BackportError } from '../../../BackportError';
import { swallowMissingConfigFileException } from '../../../remoteConfig';
import { Commit } from '../../../sourceCommit/parseSourceCommit';
import { getV4Client } from '../apiRequestV4';
import { fetchCommitBySha } from './fetchCommitBySha';
import { fetchCommitsForRebaseAndMergeStrategy } from './fetchCommitsForRebaseAndMergeStrategy';

export async function fetchCommitsByPullNumber(options: {
  accessToken: string;
  branchLabelMapping?: ValidConfigOptions['branchLabelMapping'];
  githubApiBaseUrlV4?: string;
  pullNumber: number;
  repoName: string;
  repoOwner: string;
  sourceBranch: string;
}): Promise<Commit[]> {
  const {
    accessToken,
    githubApiBaseUrlV4 = 'https://api.github.com/graphql',
    pullNumber,
    repoName,
    repoOwner,
  } = options;

  let data: CommitByPullNumberQuery;
  try {
    const client = getV4Client({
      githubApiBaseUrlV4,
      accessToken,
    });

    const res = await client.CommitByPullNumber({
      repoOwner,
      repoName,
      pullNumber,
    });
    data = res.data;
  } catch (e) {
    data = swallowMissingConfigFileException<CommitByPullNumberQuery>(e);
  }

  const pullRequestNode = data.repository?.pullRequest;
  if (!pullRequestNode) {
    throw new BackportError(`The PR #${pullNumber} does not exist`);
  }

  const { mergeCommit } = pullRequestNode;
  if (mergeCommit === null) {
    throw new BackportError(`The PR #${pullNumber} is not merged`);
  }

  const lastCommitInPullRequest =
    pullRequestNode.commits.edges?.[0]?.node?.commit;

  const firstCommitInBaseBranch = mergeCommit?.history.edges?.[0]?.node;
  const isRebaseAndMergeStrategy =
    pullRequestNode.commits.totalCount > 0 &&
    mergeCommit?.history.edges?.every(
      (c) => c?.node?.committedDate === mergeCommit.committedDate,
    ) &&
    lastCommitInPullRequest?.message === firstCommitInBaseBranch?.message;

  if (isRebaseAndMergeStrategy) {
    const commits = await fetchCommitsForRebaseAndMergeStrategy(
      options,
      pullRequestNode.commits.totalCount,
    );
    if (commits) {
      return commits;
    }
  }

  const commit = await fetchCommitBySha({ ...options, sha: mergeCommit?.oid });
  return [commit];
}
