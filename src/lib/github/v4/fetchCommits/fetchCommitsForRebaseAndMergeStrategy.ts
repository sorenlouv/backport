import gql from 'graphql-tag';
import { Commit } from '../../../../entrypoint.module';
import { apiRequestV4 } from '../apiRequestV4';
import { fetchCommitBySha } from './fetchCommitBySha';

export async function fetchCommitsForRebaseAndMergeStrategy(
  options: {
    accessToken: string;
    githubApiBaseUrlV4?: string;
    pullNumber: number;
    repoName: string;
    repoOwner: string;
    sourceBranch: string;
  },
  commitsTotalCount: number
): Promise<Commit[] | undefined> {
  const {
    accessToken,
    githubApiBaseUrlV4 = 'https://api.github.com/graphql',
    pullNumber,
    repoName,
    repoOwner,
  } = options;

  const query = gql`
    query CommitByPullNumber(
      $repoOwner: String!
      $repoName: String!
      $pullNumber: Int!
      $commitsTotalCount: Int!
    ) {
      repository(owner: $repoOwner, name: $repoName) {
        pullRequest(number: $pullNumber) {
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
                }
              }
            }
          }
        }
      }
    }
  `;

  const res = await apiRequestV4<Response>({
    githubApiBaseUrlV4,
    accessToken,
    query,
    variables: {
      repoOwner,
      repoName,
      pullNumber,
      commitsTotalCount,
    },
  });

  const pullRequestNode = res.repository.pullRequest;

  if (!pullRequestNode?.mergeCommit) {
    throw new Error('Pull request is not merged');
  }

  if (pullRequestNode.commits.totalCount !== commitsTotalCount) {
    throw new Error(
      `Specified number of commits is ${commitsTotalCount} whereas the actual number is ${pullRequestNode.commits.totalCount}`
    );
  }

  const commitsInPullRequest = pullRequestNode.commits.edges;
  const commitsInBaseBranch =
    pullRequestNode.mergeCommit.history.edges.reverse();

  const didUseRebaseAndMergeStrategy = commitsInBaseBranch.every((c, i) => {
    const hasIdenticalCommittedDate =
      c.node.committedDate === pullRequestNode.mergeCommit?.committedDate;

    const hasIdenticalCommitMessages =
      c.node.message === commitsInPullRequest[i].node.commit.message;

    return hasIdenticalCommittedDate && hasIdenticalCommitMessages;
  });

  if (didUseRebaseAndMergeStrategy) {
    const commits = await Promise.all(
      commitsInBaseBranch.map((c) =>
        fetchCommitBySha({ ...options, sha: c.node.oid })
      )
    );

    return commits;
  }
}

interface Response {
  repository: {
    pullRequest: {
      commits: {
        totalCount: number;
        edges: {
          node: {
            commit: {
              message: string;
            };
          };
        }[];
      };

      mergeCommit: {
        committedDate: string;
        history: {
          edges: {
            node: {
              oid: string;
              message: string;
              committedDate: string;
            };
          }[];
        };
      } | null;
    } | null;
  };
}
