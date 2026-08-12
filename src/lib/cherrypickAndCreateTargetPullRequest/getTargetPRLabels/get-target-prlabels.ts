import { uniq } from 'lodash-es';
import type { Commit } from '../../sourceCommit/parse-source-commit.js';
import { getConfiguredTargetPRLabels } from './get-configured-target-pr-labels.js';
import { getSourcePRLabelsToCopy } from './get-source-pr-labels-to-copy.js';

export function getTargetPRLabels({
  interactive,
  targetPRLabels,
  commits,
  targetBranch,
  copySourcePRLabels,
  conflictLabel,
  hasConflicts,
}: {
  interactive: boolean;
  targetPRLabels: string[];
  commits: Commit[];
  targetBranch: string;
  copySourcePRLabels: boolean | string | string[];
  conflictLabel: string;
  hasConflicts: boolean;
}) {
  const configuredTargetPRLabels = getConfiguredTargetPRLabels({
    commits,
    targetBranch,
    targetPRLabels,
    interactive,
  });

  const sourcePRLabelsToCopy = getSourcePRLabelsToCopy({
    commits,
    copySourcePRLabels: copySourcePRLabels,
  });

  return uniq([
    ...configuredTargetPRLabels,
    ...sourcePRLabelsToCopy,
    ...(hasConflicts ? [conflictLabel] : []),
  ]);
}
