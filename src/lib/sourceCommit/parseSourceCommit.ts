import { differenceBy } from 'lodash';
import { graphql } from '../../graphql/generated';
import type { SourceCommitWithTargetPullRequestFragmentFragment } from '../../graphql/generated/graphql';
import type { ValidConfigOptions } from '../../options/options';
import { filterNil } from '../../utils/filterEmpty';
import { parseRemoteConfigFile } from '../remoteConfig';
import type { TargetPullRequest } from './getPullRequestStates';
import { getPullRequestStates } from './getPullRequestStates';
import { getSourcePullRequest } from './getSourcePullRequest';

export interface Commit {
  author: SourceCommitWithTargetPullRequestFragmentFragment['author'];
  sourceCommit: {
    committedDate: string;
    message: string;
    sha: string;
    branchLabelMapping: ValidConfigOptions['branchLabelMapping'];
  };
  sourcePullRequest?: {
    title: string;
    labels: string[];
    number: number;
    url: string;
    mergeCommit?: {
      message: string;
      sha: string;
    };
  };
  sourceBranch: string;
  suggestedTargetBranches: string[];
  targetPullRequestStates: TargetPullRequest[];
}

function getSuggestedTargetBranches(
  sourceCommit: SourceCommitWithTargetPullRequestFragmentFragment,
  targetPullRequestStates: TargetPullRequest[],
  branchLabelMapping?: ValidConfigOptions['branchLabelMapping'],
) {
  const missingPrs = getPullRequestStates({
    sourceCommit,
    branchLabelMapping,
  }).filter((pr) => pr.state === 'NOT_CREATED' || pr.state === 'CLOSED');

  const mergedPrs = targetPullRequestStates.filter(
    (pr) => pr.state === 'MERGED',
  );

  return differenceBy(missingPrs, mergedPrs, (pr) => pr.label).map(
    (pr) => pr.branch,
  );
}

export function parseSourceCommit({
  sourceCommit,
  options,
}: {
  sourceCommit: SourceCommitWithTargetPullRequestFragmentFragment;
  options: {
    branchLabelMapping?: ValidConfigOptions['branchLabelMapping'];
    sourceBranch: string;
  };
}): Commit {
  const sourcePullRequest = getSourcePullRequest(sourceCommit);

  const sourceCommitBranchLabelMapping =
    getSourceCommitBranchLabelMapping(sourceCommit);

  const branchLabelMapping =
    sourceCommitBranchLabelMapping ?? options.branchLabelMapping;

  const targetPullRequestStates = getPullRequestStates({
    sourceCommit,
    branchLabelMapping,
  });

  const suggestedTargetBranches = getSuggestedTargetBranches(
    sourceCommit,
    targetPullRequestStates,
    options.branchLabelMapping,
  );

  return {
    author: sourceCommit.author,
    sourceCommit: {
      committedDate: sourceCommit.committedDate,
      message: sourceCommit.message,
      sha: sourceCommit.sha,
      branchLabelMapping: sourceCommitBranchLabelMapping,
    },
    sourcePullRequest: sourcePullRequest
      ? {
          labels:
            sourcePullRequest.labels?.nodes
              ?.map((label) => label?.name)
              .filter(filterNil) ?? [],
          title: sourcePullRequest.title,
          number: sourcePullRequest.number,
          url: sourcePullRequest.url,
          mergeCommit: sourcePullRequest.mergeCommit
            ? {
                message: sourcePullRequest.mergeCommit.message,
                sha: sourcePullRequest.mergeCommit.sha,
              }
            : undefined,
        }
      : undefined,
    sourceBranch: sourcePullRequest?.baseRefName ?? options.sourceBranch,
    suggestedTargetBranches,
    targetPullRequestStates: targetPullRequestStates,
  };
}

export const SourceCommitWithTargetPullRequestFragment = graphql(`
  fragment SourceCommitWithTargetPullRequestFragment on Commit {
    __typename
    # Source Commit
    repository {
      name
      owner {
        login
      }
    }
    sha: oid
    message
    committedDate

    author {
      name
      email
    }

    # Source pull request: PR where source commit was merged in
    associatedPullRequests(first: 1) {
      edges {
        node {
          title
          url
          number
          labels(first: 50) {
            nodes {
              name
            }
          }
          baseRefName

          # source merge commit (the commit that actually went into the source branch)
          mergeCommit {
            __typename
            ...RemoteConfigHistoryFragment
            sha: oid
            message
          }

          # (possible) backport pull requests referenced in the source pull request
          timelineItems(last: 20, itemTypes: CROSS_REFERENCED_EVENT) {
            edges {
              node {
                ... on CrossReferencedEvent {
                  __typename
                  targetPullRequest: source {
                    __typename

                    # Target PRs (backport PRs)
                    ... on PullRequest {
                      __typename
                      # target merge commit: the backport commit that was merged into the target branch
                      targetMergeCommit: mergeCommit {
                        sha: oid
                        message
                      }
                      repository {
                        name
                        owner {
                          login
                        }
                      }
                      url
                      title
                      state
                      baseRefName
                      number
                      commits(first: 20) {
                        edges {
                          node {
                            targetCommit: commit {
                              message
                              sha: oid
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
        }
      }
    }
  }
`);

function getSourceCommitBranchLabelMapping(
  sourceCommit: SourceCommitWithTargetPullRequestFragmentFragment,
): ValidConfigOptions['branchLabelMapping'] {
  const sourcePullRequest = getSourcePullRequest(sourceCommit);

  const remoteConfig =
    sourcePullRequest?.mergeCommit?.remoteConfigHistory.edges?.[0]
      ?.remoteConfig;

  if (remoteConfig) {
    return parseRemoteConfigFile(remoteConfig)?.branchLabelMapping;
  }
}
