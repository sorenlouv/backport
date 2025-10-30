import type { ValidConfigOptions } from '../../../options/options';
import type { Commit } from '../../sourceCommit/parse-source-commit';

export function getSourcePRLabelsToCopy({
  commits,
  copySourcePRLabels,
}: {
  commits: Commit[];
  copySourcePRLabels: ValidConfigOptions['copySourcePRLabels'];
}) {
  if (copySourcePRLabels === true) {
    return commits.flatMap((commit) => {
      if (!commit.sourcePullRequest) {
        return [];
      }

      const backportLabels = commit.targetPullRequestStates.map(
        (pr) => pr.label,
      );

      return commit.sourcePullRequest.labels.filter(
        (label) => !backportLabels.includes(label),
      );
    });
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
  return commits.flatMap((commit) => {
    if (!commit.sourcePullRequest) {
      return [];
    }

    return commit.sourcePullRequest.labels.filter((label) =>
      regexes.some((regex) => regex.test(label)),
    );
  });
}
