import { graphql } from '../../../../graphql/generated';
import type { ValidConfigOptions } from '../../../../options/options';
import { BackportError } from '../../../backport-error';
import { isMissingConfigFileException } from '../../../remote-config';
import type { Commit } from '../../../sourceCommit/parse-source-commit';
import { GithubV4Exception, getGraphQLClient } from '../client/graphql-client';
import { fetchCommitBySha } from './fetch-commit-by-sha';
import { fetchCommitsForRebaseAndMergeStrategy } from './fetch-commits-for-rebase-and-merge-strategy';

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

  const query = graphql(`
    query CommitByPullNumber(
      $repoOwner: String!
      $repoName: String!
      $pullNumber: Int!
    ) {
      repository(owner: $repoOwner, name: $repoName) {
        pullRequest(number: $pullNumber) {
          # used to determine if "Rebase and Merge" strategy was used
          commits(last: 1) {
            totalCount
            edges {
              node {
                commit {
                  message
                }
              }
            }
          }

          mergeCommit {
            oid

            # used to determine if "Rebase and Merge" strategy was used
            committedDate
            history(first: 2) {
              edges {
                node {
                  message
                  committedDate
                }
              }
            }
          }
        }
      }
    }
  `);

  const variables = { repoOwner, repoName, pullNumber };
  const client = getGraphQLClient({ accessToken, githubApiBaseUrlV4 });
  const result = await client.query(query, variables);

  if (result.error && !isMissingConfigFileException(result)) {
    throw new GithubV4Exception(result);
  }

  const { data } = result;

  const pullRequestNode = data?.repository?.pullRequest;
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
