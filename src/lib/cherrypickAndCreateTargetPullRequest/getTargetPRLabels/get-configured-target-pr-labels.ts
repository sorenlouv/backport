import type { Commit } from '../../../entrypoint.api';
import { filterNil } from '../../../utils/filter-empty';
import { getSourceBranchFromCommits } from '../../get-source-branch-from-commits';
import { logger } from '../../logger';

// Resolve labels defined in configuration (`targetPRLabels`) into their concrete
// values for the current target branch. This includes expanding regex captures,
// replacing template placeholders and skipping dynamic labels when we lack
// branch mapping context in interactive mode.
export function getConfiguredTargetPRLabels({
  commits,
  targetBranch,
  targetPRLabels,
  interactive,
}: {
  commits: Commit[];
  targetBranch: string;
  targetPRLabels: string[];
  interactive: boolean;
}) {
  const sourceBranch = getSourceBranchFromCommits(commits);
  const labels = commits
    .flatMap((c) => {
      const targetPullRequest = c.targetPullRequestStates.find(
        (pr) => pr.branch === targetBranch,
      );

      if (!targetPullRequest?.branchLabelMappingKey) {
        logger.info('Missing branchLabelMappingKey for target pull request');

        // remove dynamic labels like `$1` in interactive mode
        return targetPRLabels.filter((l) => {
          return l.match(/\$\d/) === null || !interactive;
        });
      }

      const regex = new RegExp(targetPullRequest.branchLabelMappingKey);

      return targetPRLabels.map((targetPRLabel) => {
        return targetPullRequest.label?.replace(regex, targetPRLabel);
      });
    })
    .filter(filterNil)
    .map((label) => {
      return label
        .replaceAll('{{targetBranch}}', targetBranch)
        .replaceAll('{{sourceBranch}}', sourceBranch);
    });

  return labels;
}
