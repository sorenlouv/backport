import { isArray } from 'lodash';
import { ValidConfigOptions } from '../../options/options';
import { addLabelsToPullRequest } from '../github/v3/addLabelsToPullRequest';
import { Commit } from '../sourceCommit/parseSourceCommit';

export async function copySourcePullRequestLabelsToTargetPullRequest(
  options: ValidConfigOptions,
  commits: Commit[],
  pullNumber: number,
) {
  const labels = getLabelsToCopy(commits, options);
  if (labels.length > 0) {
    await addLabelsToPullRequest({ ...options, pullNumber, labels });
  }
}

export function getLabelsToCopy(
  commits: Commit[],
  options: ValidConfigOptions,
) {
  return commits.flatMap((commit) => {
    if (!commit.sourcePullRequest) {
      return [];
    }

    const backportLabels = commit.targetPullRequestStates.map((pr) => pr.label);
    const labels = commit.sourcePullRequest.labels.filter((label) => {
      // If `copySourcePRLabels` is a boolean, it must be true to reach this method.
      // Therefore, we simply copy all labels from the source PR that aren't already on the target PR.
      const copySourcePRLabels = options.copySourcePRLabels;
      if (copySourcePRLabels === true) {
        const isBackportLabel = backportLabels.includes(label);
        return !isBackportLabel;
      }

      // Otherwise, it's an array of regex patterns.
      if (isArray(copySourcePRLabels)) {
        return copySourcePRLabels.some((sourceLabel) =>
          label.match(new RegExp(sourceLabel)),
        );
      }
      throw new Error(
        `Unexpected type of copySourcePRLabels: ${JSON.stringify(copySourcePRLabels)}, must be boolean or array`,
      );
    });

    return labels;
  });
}
