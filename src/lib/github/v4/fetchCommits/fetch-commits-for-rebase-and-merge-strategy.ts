import { first } from 'lodash-es';
import type { Commit } from '../../../../entrypoint.api.js';
import { graphql } from '../../../../graphql/generated/index.js';
import { BackportError } from '../../../backport-error.js';
import { graphqlRequest } from '../client/graphql-client.js';
import { fetchCommitBySha } from './fetch-commit-by-sha.js';

export async function fetchCommitsForRebaseAndMergeStrategy(
  options: {
    githubToken: string;
    githubApiBaseUrlV4?: string;
    pullNumber: number;
    repoName: string;
    repoOwner: string;
    sourceBranch: string;
  },
  commitsTotalCount: number,
): Promise<Commit[] | undefined> {
  const {
    githubToken,
    githubApiBaseUrlV4 = 'https://api.github.com/graphql',
    pullNumber,
    repoName,
    repoOwner,
  } = options;

  const query = graphql(`
    query CommitsForRebaseAndMergeStrategy(
      $repoOwner: String!
      $repoName: String!
      $pr: Int!
      $commitsTotalCount: Int!
    ) {
      repository(owner: $repoOwner, name: $repoName) {
        pullRequest(number: $pr) {
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

  const variables = { repoOwner, repoName, pr: pullNumber, commitsTotalCount };
  const result = await graphqlRequest(
    { githubToken, githubApiBaseUrlV4 },
    query,
    variables,
  );

  if (result.error) {
    throw new BackportError({
      code: 'github-api-exception',
      message: result.error.message,
    });
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
    pullRequestNode.mergeCommit.history.edges?.toReversed() ?? [];

  const didUseRebaseAndMergeStrategy = commitsInBaseBranch.every((c, i) => {
    const hasSameCommittedDate =
      c?.node?.committedDate === pullRequestNode.mergeCommit?.committedDate;

    const hasSameCommitMessages =
      c?.node?.message === commitsInPullRequest.at(i)?.node?.commit.message;

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
