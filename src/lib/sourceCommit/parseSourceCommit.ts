import { differenceBy } from 'lodash';
import { SourceCommitWithTargetPullRequestFragmentFragment } from '../../graphql/generated';
import { ValidConfigOptions } from '../../options/options';
import { filterNil } from '../../utils/filterEmpty';
import { parseRemoteConfigFile } from '../remoteConfig';
import {
  TargetPullRequest,
  getPullRequestStates,
  getSourcePullRequest,
} from './getPullRequestStates';

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

  const currentBranchLabelMapping = options.branchLabelMapping;

  const targetPullRequestStates = getPullRequestStates({
    sourceCommit,
    branchLabelMapping:
      sourceCommitBranchLabelMapping ?? currentBranchLabelMapping,
  });

  const suggestedTargetBranches = getSuggestedTargetBranches(
    sourceCommit,
    targetPullRequestStates,
    currentBranchLabelMapping,
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
          labels: (sourcePullRequest.labels?.nodes ?? [])
            .map((label) => label?.name)
            .filter(filterNil),
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
