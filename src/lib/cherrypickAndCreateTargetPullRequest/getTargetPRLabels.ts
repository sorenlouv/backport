import { uniq } from 'lodash';
import { Commit } from '../../entrypoint.api';
import { filterNil } from '../../utils/filterEmpty';
import { getSourceBranchFromCommits } from '../getSourceBranchFromCommits';
import { logger } from '../logger';

export function getTargetPRLabels({
  interactive,
  targetPRLabels,
  commits,
  targetBranch,
}: {
  interactive: boolean;
  targetPRLabels: string[];
  commits: Commit[];
  targetBranch: string;
}) {
  const sourceBranch = getSourceBranchFromCommits(commits);
  const labels = commits
    .flatMap((c) => {
      const targetPullRequest = c.targetPullRequestStates.find(
        (pr) => pr.branch === targetBranch,
      );

      if (!targetPullRequest?.labelRegex) {
        logger.info('Missing labelRegex for target pull request');

        // remove dynamic labels like `$1` in interactive mode
        return targetPRLabels.filter((l) => {
          return l.match(/\$\d/) === null || !interactive;
        });
      }

      const regex = new RegExp(targetPullRequest.labelRegex);

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

  return uniq(labels);
}
