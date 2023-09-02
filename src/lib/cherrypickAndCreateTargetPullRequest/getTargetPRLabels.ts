import { uniq } from 'lodash';
import { Commit } from '../../entrypoint.api';
import { filterNil } from '../../utils/filterEmpty';
import { getSourceBranchFromCommits } from '../getSourceBranchFromCommits';
import { logger } from '../logger';

export function getTargetPRLabels({
  syncSourcePRLabels,
  interactive,
  targetPRLabels,
  commits,
  targetBranch,
}: {
  syncSourcePRLabels: boolean;
  interactive: boolean;
  targetPRLabels: string[];
  commits: Commit[];
  targetBranch: string;
}) {
  const sourceBranch = getSourceBranchFromCommits(commits);
  const nonBackportLabels = getNonBackportLabels(syncSourcePRLabels, commits);

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

  return uniq([...labels, ...nonBackportLabels]);
}

function getNonBackportLabels(syncSourcePRLabels: boolean, commits: Commit[]) {
  const initialCommit = commits[0];
  if (!syncSourcePRLabels || !initialCommit.sourcePullRequest) {
    return [];
  }

  const backportLabels = initialCommit.targetPullRequestStates.map(
    (pr) => pr.label,
  );

  const labels = initialCommit.sourcePullRequest.labels.filter(
    (label) => !backportLabels.includes(label),
  );

  return labels;
}
