import { first } from 'lodash';
import type { Commit } from '../../../../entrypoint.api';
import { graphql } from '../../../../graphql/generated';
import { getGraphQLClient, GithubV4Exception } from '../client/graphql-client';
import { fetchCommitBySha } from './fetch-commit-by-sha';

export async function fetchCommitsForRebaseAndMergeStrategy(
  options: {
    accessToken: string;
    githubApiBaseUrlV4?: string;
    pullNumber: number;
    repoName: string;
    repoOwner: string;
    sourceBranch: string;
  },
  commitsTotalCount: number,
): Promise<Commit[] | undefined> {
  const {
    accessToken,
    githubApiBaseUrlV4 = 'https://api.github.com/graphql',
    pullNumber,
    repoName,
    repoOwner,
  } = options;

  const query = graphql(`
    query CommitsForRebaseAndMergeStrategy(
      $repoOwner: String!
      $repoName: String!
      $pullNumber: Int!
      $commitsTotalCount: Int!
    ) {
      repository(owner: $repoOwner, name: $repoName) {
        pullRequest(number: $pullNumber) {
          number
          commits(first: $commitsTotalCount) {
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
            committedDate
            history(first: $commitsTotalCount) {
              edges {
                node {
                  oid
                  message
                  committedDate
                  associatedPullRequests(first: 1) {
                    edges {
                      node {
                        number
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  `);

  const variables = { repoOwner, repoName, pullNumber, commitsTotalCount };
  const client = getGraphQLClient({ accessToken, githubApiBaseUrlV4 });
  const result = await client.query(query, variables);

  if (result.error) {
    throw new GithubV4Exception(result);
  }

  const pullRequestNode = result.data?.repository?.pullRequest;

  if (!pullRequestNode?.mergeCommit) {
    throw new Error('Pull request is not merged');
  }

  if (pullRequestNode.commits.totalCount !== commitsTotalCount) {
    throw new Error(
      `Specified number of commits is ${commitsTotalCount} whereas the actual number is ${pullRequestNode.commits.totalCount}`,
    );
  }

  const commitsInPullRequest = pullRequestNode.commits.edges ?? [];
  const commitsInBaseBranch =
    pullRequestNode.mergeCommit.history.edges?.reverse() ?? [];

  const didUseRebaseAndMergeStrategy = commitsInBaseBranch.every((c, i) => {
    const hasSameCommittedDate =
      c?.node?.committedDate === pullRequestNode.mergeCommit?.committedDate;

    const hasSameCommitMessages =
      c?.node?.message === commitsInPullRequest[i]?.node?.commit.message;

    const hasSamePullNumber =
      first(c?.node?.associatedPullRequests?.edges)?.node?.number ===
      pullRequestNode.number;

    return hasSameCommittedDate && hasSameCommitMessages && hasSamePullNumber;
  });

  if (didUseRebaseAndMergeStrategy) {
    const commits = await Promise.all(
      commitsInBaseBranch.map((c) =>
        fetchCommitBySha({ ...options, sha: c?.node?.oid }),
      ),
    );

    return commits;
  }
}
