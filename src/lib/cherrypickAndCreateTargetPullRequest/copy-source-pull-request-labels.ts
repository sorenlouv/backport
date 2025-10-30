import type { ValidConfigOptions } from '../../options/options';
import { addLabelsToPullRequest } from '../github/v3/add-labels-to-pull-request';
import type { Commit } from '../sourceCommit/parse-source-commit';

export async function copySourcePullRequestLabelsToTargetPullRequest(
  options: ValidConfigOptions,
  commits: Commit[],
  pullNumber: number,
) {
  const labels = getLabelsToCopy({
    commits,
    copySourcePRLabels: options.copySourcePRLabels,
  });

  if (labels.length > 0) {
    await addLabelsToPullRequest({ ...options, pullNumber, labels });
  }
}

export function getLabelsToCopy({
  commits,
  copySourcePRLabels,
}: {
  commits: Commit[];
  copySourcePRLabels: ValidConfigOptions['copySourcePRLabels'];
}) {
  const labels = commits.flatMap((commit) => {
    if (!commit.sourcePullRequest) {
      return [];
    }

    const backportLabels = commit.targetPullRequestStates.map((pr) => pr.label);
    const sourceLabels = commit.sourcePullRequest.labels.filter(
      (label) => !backportLabels.includes(label),
    );

    return sourceLabels;
  });

  if (copySourcePRLabels === true) {
    return labels;
  }

  const patterns = Array.isArray(copySourcePRLabels)
    ? copySourcePRLabels
    : typeof copySourcePRLabels === 'string'
      ? [copySourcePRLabels]
      : [];

  if (patterns.length === 0) {
    return [];
  }

  const regexes = patterns.map((pattern) => new RegExp(pattern));
  return labels.filter((label) => regexes.some((regex) => regex.test(label)));
}
