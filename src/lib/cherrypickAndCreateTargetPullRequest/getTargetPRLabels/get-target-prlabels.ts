import _ from 'lodash';
import type { Commit } from '../../../entrypoint.api.js';
import { getConfiguredTargetPRLabels } from './get-configured-target-pr-labels.js';
import { getSourcePRLabelsToCopy } from './get-source-pr-labels-to-copy.js';

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

  return _.uniq([...configuredTargetPRLabels, ...sourcePRLabelsToCopy]);
}
