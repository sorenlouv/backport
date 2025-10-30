import { uniq } from 'lodash';
import type { Commit } from '../../../entrypoint.api';
import { getConfiguredTargetPRLabels } from './get-configured-target-pr-labels';
import { getSourcePRLabelsToCopy } from './get-source-pr-labels-to-copy';

export function getTargetPRLabels({
  interactive,
  targetPRLabels,
  commits,
  targetBranch,
  copySourcePRLabels,
}: {
  interactive: boolean;
  targetPRLabels: string[];
  commits: Commit[];
  targetBranch: string;
  copySourcePRLabels: boolean | string | string[];
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

  return uniq([...configuredTargetPRLabels, ...sourcePRLabelsToCopy]);
}
