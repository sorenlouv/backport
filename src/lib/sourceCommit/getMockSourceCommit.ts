import {
  PullRequestState,
  RemoteConfigHistoryFragmentFragment,
  SourceCommitWithTargetPullRequestFragmentFragment,
} from '../../graphql/generated/graphql';

export function getMockSourceCommit({
  sourceCommit,
  sourcePullRequest,
  timelineItems = [],
}: {
  sourceCommit: {
    remoteConfig?: {
      branchLabelMapping: Record<string, string>;
      committedDate: string;
    };
    sha?: string;
    message: string;
    commitedDate?: string;
  };
  sourcePullRequest: {
    title?: string;
    number: number;
    labels?: string[];
    sourceBranch?: string;
  } | null;
  timelineItems?: Array<{
    state: PullRequestState;
    targetBranch: string;
    title?: string;
    number: number;
    commitMessages: string[];
    repoName?: string;
    repoOwner?: string;
  }>;
}): SourceCommitWithTargetPullRequestFragmentFragment {
  const defaultTargetPullRequestTitle =
    'DO NOT USE: Please specify a title in test!!!';

  const defaultSourceCommitSha = 'DO NOT USE: please specify a sha in test!!!';

  const baseMockCommit: SourceCommitWithTargetPullRequestFragmentFragment = {
    __typename: 'Commit',
    author: { email: 'soren.louv@elastic.co', name: 'Søren Louv-Jansen' },
    repository: {
      name: 'kibana',
      owner: { login: 'elastic' },
    },
    committedDate: sourceCommit.commitedDate ?? '2021-12-22T00:00:00Z',
    sha: sourceCommit.sha ?? defaultSourceCommitSha,
    message: sourceCommit.message,
    associatedPullRequests: { edges: null },
  };

  if (!sourcePullRequest) {
    return baseMockCommit;
  }

  const remoteConfigHistory: RemoteConfigHistoryFragmentFragment['remoteConfigHistory'] =
    sourceCommit.remoteConfig
      ? {
          edges: [
            {
              remoteConfig: {
                committedDate: sourceCommit.remoteConfig.committedDate,
                file: {
                  __typename: 'TreeEntry',
                  object: {
                    __typename: 'Blob',
                    text: JSON.stringify({
                      branchLabelMapping:
                        sourceCommit.remoteConfig.branchLabelMapping,
                    }),
                  },
                },
              },
            },
          ],
        }
      : { edges: [] };

  return {
    ...baseMockCommit,
    associatedPullRequests: {
      edges: [
        {
          node: {
            mergeCommit: {
              __typename: 'Commit',
              remoteConfigHistory,
              sha: sourceCommit.sha ?? defaultSourceCommitSha,
              message: sourceCommit.message,
            },
            url: `https://github.com/elastic/kibana/pull/${sourcePullRequest.number}`,
            title: sourcePullRequest.title ?? defaultTargetPullRequestTitle,
            labels: {
              nodes: (sourcePullRequest.labels ?? []).map((name) => ({
                name,
              })),
            },
            baseRefName:
              sourcePullRequest.sourceBranch ??
              'source-branch-from-associated-pull-request',
            number: sourcePullRequest.number,
            timelineItems: {
              edges: timelineItems.map((timelineItem) => {
                return {
                  __typename: 'PullRequestTimelineItemsEdge',
                  node: {
                    __typename: 'CrossReferencedEvent',
                    targetPullRequest: {
                      __typename: 'PullRequest',
                      url: `https://github.com/elastic/kibana/pull/${timelineItem.number}`,
                      title:
                        timelineItem.title ?? defaultTargetPullRequestTitle,
                      number: timelineItem.number,
                      state: timelineItem.state,
                      baseRefName: timelineItem.targetBranch,

                      targetMergeCommit:
                        timelineItem.state === 'MERGED'
                          ? {
                              message: timelineItem.commitMessages[0],
                              sha: 'target-merge-commit-sha',
                            }
                          : null,

                      repository: {
                        name: timelineItem.repoName ?? 'kibana',
                        owner: {
                          login: timelineItem.repoOwner ?? 'elastic',
                        },
                      },
                      commits: {
                        edges: timelineItem.commitMessages.map((message) => ({
                          node: {
                            targetCommit: {
                              sha: 'abc',
                              message: message,
                            },
                          },
                        })),
                      },
                    },
                  },
                };
              }),
            },
          },
        },
      ],
    },
  };
}
