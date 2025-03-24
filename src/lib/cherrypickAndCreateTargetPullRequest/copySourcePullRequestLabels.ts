import { ValidConfigOptions } from '../../options/options';
import { addLabelsToPullRequest } from '../github/v3/addLabelsToPullRequest';
import { Commit } from '../sourceCommit/parseSourceCommit';

export async function copySourcePullRequestLabelsToTargetPullRequest(
  options: ValidConfigOptions,
  commits: Commit[],
  pullNumber: number,
) {
  const labels = getNonBackportLabels(commits, options);
  if (labels.length > 0) {
    await addLabelsToPullRequest({ ...options, pullNumber, labels });
  }
}

function getNonBackportLabels(commits: Commit[], options: ValidConfigOptions) {
  return commits.flatMap((commit) => {
    if (!commit.sourcePullRequest) {
      return [];
    }

    const backportLabels = commit.targetPullRequestStates.map((pr) => pr.label);
    const labels = commit.sourcePullRequest.labels.filter((label) => {
      // If `copySourcePRLabels` is a boolean, it must be true to reach this method.
      // Therefore, we simply copy all labels from the source PR that aren't already on the target PR.
      const copySourcePRLabels = options.copySourcePRLabels;
      if (typeof copySourcePRLabels === 'boolean') {
        return !backportLabels.includes(label);
      }
      // Otherwise, it's an array of regex patterns.
      if (
        typeof copySourcePRLabels === 'object' &&
        copySourcePRLabels.constructor === Array
      ) {
        return copySourcePRLabels.some((sourceLabel) =>
          label.match(new RegExp(sourceLabel)),
        );
      }
      throw new Error(
        'Unexpected type of copySourcePRLabels, must be boolean or array',
      );
    });

    return labels;
  });
}
