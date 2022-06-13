import { keyBy, merge, uniqBy, values } from 'lodash';
import { ValidConfigOptions } from '../../options/options';
import { filterNil } from '../../utils/filterEmpty';
import { getFirstLine } from '../github/commitFormatters';
import { parseRemoteConfig } from '../remoteConfig';
import {
  SourcePullRequestNode,
  SourceCommitWithTargetPullRequest,
  TimelineEdge,
  TimelinePullRequestEdge,
} from './parseSourceCommit';

export type PullRequestState = 'OPEN' | 'CLOSED' | 'MERGED' | 'NOT_CREATED';
type CreatedPullRequest = {
  url: string;
  number: number;
  branch: string;
  state: PullRequestState;
  mergeCommit?: {
    sha: string;
    message: string;
  };
};

type TargetBranchWithLabel = {
  labelRegex: string;
  branch: string;
  label: string;
  isSourceBranch: boolean;
};

export type TargetPullRequest =
  | (CreatedPullRequest & Partial<TargetBranchWithLabel>)
  | ((TargetBranchWithLabel & Partial<CreatedPullRequest>) & {
      state: PullRequestState;
    });

function getSourcePullRequest(
  sourceCommit: SourceCommitWithTargetPullRequest
): SourcePullRequestNode | undefined {
  return sourceCommit.associatedPullRequests.edges?.[0]?.node;
}

export function getSourceCommitBranchLabelMapping(
  sourceCommit: SourceCommitWithTargetPullRequest
): ValidConfigOptions['branchLabelMapping'] {
  const sourcePullRequest = getSourcePullRequest(sourceCommit);

  const remoteConfig =
    sourcePullRequest?.mergeCommit.remoteConfigHistory.edges?.[0]?.remoteConfig;

  if (remoteConfig) {
    return parseRemoteConfig(remoteConfig)?.branchLabelMapping;
  }
}

function mergeByKey<T, K>(
  obj1: T[],
  obj2: K[],
  key: string
): Array<(T & Partial<K>) | (K & Partial<T>)> {
  const merged = merge(keyBy(obj1, key), keyBy(obj2, key));
  const a = values(merged);
  return a;
}

export function getPullRequestStates({
  sourceCommit,
  branchLabelMapping,
}: {
  sourceCommit: SourceCommitWithTargetPullRequest;
  branchLabelMapping: ValidConfigOptions['branchLabelMapping'];
}): TargetPullRequest[] {
  const sourcePullRequest = getSourcePullRequest(sourceCommit);

  // if there is no source pull request the commit was pushed directly to the source branch
  // in that case there will be no labels, and thus not possible to deduce the expected target branches
  if (!sourcePullRequest) {
    return [];
  }

  const createdTargetPullRequests = getCreatedTargetPullRequests(sourceCommit);

  // if there's no `branchLabelMapping`, it's not possible to determine the missing target branches
  if (!branchLabelMapping) {
    return createdTargetPullRequests;
  }

  const targetBranchesFromLabels = getTargetBranchesFromLabels(
    sourcePullRequest,
    branchLabelMapping
  );

  return mergeByKey(
    targetBranchesFromLabels,
    createdTargetPullRequests,
    'branch'
  ).map((res) => {
    if (res.state) {
      return { ...res, state: res.state };
    }

    // MERGED (source branch)
    if (res.isSourceBranch) {
      return {
        ...res,
        state: 'MERGED' as const,
        url: sourcePullRequest.url,
        number: sourcePullRequest.number,
        mergeCommit: {
          message: sourcePullRequest.mergeCommit.message,
          sha: sourcePullRequest.mergeCommit.sha,
        },
      };
    }

    // NOT_CREATED
    return { ...res, state: 'NOT_CREATED' as const };
  });
}

function getCreatedTargetPullRequests(
  sourceCommit: SourceCommitWithTargetPullRequest
): CreatedPullRequest[] {
  const sourcePullRequest = getSourcePullRequest(sourceCommit);

  if (!sourcePullRequest) {
    return [];
  }

  const sourceCommitMessage = getFirstLine(sourceCommit.message);
  return sourcePullRequest.timelineItems.edges
    .filter(filterNil)
    .filter(filterPullRequests)
    .filter((item) => {
      const { targetPullRequest } = item.node;

      // ignore closed PRs
      if (targetPullRequest.state === 'CLOSED') {
        return false;
      }

      // at least one of the commits in `targetPullRequest` should match the merge commit from the source pull request
      const didCommitMatch = targetPullRequest.commits.edges.some(
        (commitEdge) => {
          const { targetCommit } = commitEdge.node;

          const matchingRepoName =
            sourceCommit.repository.name === targetPullRequest.repository.name;

          const matchingRepoOwner =
            sourceCommit.repository.owner.login ===
            targetPullRequest.repository.owner.login;

          const targetCommitMessage = getFirstLine(targetCommit.message);

          const matchingMessage = targetCommitMessage === sourceCommitMessage;
          return matchingRepoName && matchingRepoOwner && matchingMessage;
        }
      );

      const titleIncludesMessage =
        targetPullRequest.title.includes(sourceCommitMessage);

      const titleIncludesNumber = targetPullRequest.title.includes(
        sourcePullRequest.number.toString()
      );

      return didCommitMatch || (titleIncludesMessage && titleIncludesNumber);
    })
    .map((item) => {
      const { targetPullRequest } = item.node;
      return {
        url: targetPullRequest.url,
        number: targetPullRequest.number,
        branch: targetPullRequest.baseRefName,
        state: targetPullRequest.state,
        mergeCommit: targetPullRequest.targetMergeCommit
          ? {
              sha: targetPullRequest.targetMergeCommit.sha,
              message: targetPullRequest.targetMergeCommit.message,
            }
          : undefined,
      };
    });
}

// narrow TimelineEdge to TimelinePullRequestEdge
function filterPullRequests(
  item: TimelineEdge
): item is TimelinePullRequestEdge {
  const { targetPullRequest } = item.node;
  return targetPullRequest.__typename === 'PullRequest';
}

function getTargetBranchesFromLabels(
  sourcePullRequest: SourcePullRequestNode,
  branchLabelMapping: NonNullable<ValidConfigOptions['branchLabelMapping']>
): TargetBranchWithLabel[] {
  const targetBranchesFromLabels = sourcePullRequest.labels.nodes
    .map((label) => label.name)
    .map((label) => {
      const res = getTargetBranchFromLabel({ branchLabelMapping, label });
      if (res) {
        const { labelRegex, targetBranch } = res;
        const isSourceBranch = targetBranch === sourcePullRequest.baseRefName;
        return { branch: targetBranch, label, labelRegex, isSourceBranch };
      }
    })
    .filter(filterNil);

  return uniqBy(targetBranchesFromLabels, ({ branch }) => branch);
}

function getTargetBranchFromLabel({
  branchLabelMapping,
  label,
}: {
  branchLabelMapping: NonNullable<ValidConfigOptions['branchLabelMapping']>;
  label: string;
}) {
  // only get first match
  const result = Object.entries(branchLabelMapping).find(([labelRegex]) => {
    const regex = new RegExp(labelRegex);
    const isMatch = label.match(regex) !== null;
    return isMatch;
  });

  if (result) {
    const [labelRegex, targetBranchReplaceValue] = result;
    const regex = new RegExp(labelRegex);
    const targetBranch = label.replace(regex, targetBranchReplaceValue);

    if (targetBranch) {
      return { targetBranch, labelRegex };
    }
  }
}
