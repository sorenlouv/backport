import type { ValidConfigOptions } from '../../options/options';
import { addLabelsToPullRequest } from '../github/v3/add-labels-to-pull-request';
import type { Commit } from '../sourceCommit/parse-source-commit';

export async function copySourcePullRequestLabelsToTargetPullRequest(
  options: ValidConfigOptions,
  commits: Commit[],
  pullNumber: number,
) {
  const labels = getNonBackportLabels(commits);
  if (labels.length > 0) {
    await addLabelsToPullRequest({ ...options, pullNumber, labels });
  }
}

function getNonBackportLabels(commits: Commit[]) {
  return commits.flatMap((commit) => {
    if (!commit.sourcePullRequest) {
      return [];
    }

    const backportLabels = commit.targetPullRequestStates.map((pr) => pr.label);
    const labels = commit.sourcePullRequest.labels.filter(
      (label) => !backportLabels.includes(label),
    );

    return labels;
  });
}
