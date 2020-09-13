import uniq from 'lodash.uniq';
import { BackportOptions } from '../../../options/options';
import { filterNil } from '../../../utils/filterEmpty';
import { logger } from '../../logger';
import { ExistingTargetPullRequests } from './getExistingTargetPullRequests';

export function getTargetBranchForLabel({
  branchLabelMapping,
  label,
}: {
  branchLabelMapping: NonNullable<BackportOptions['branchLabelMapping']>;
  label: string;
}) {
  // only get first match
  const result = Object.entries(branchLabelMapping).find(([labelPattern]) => {
    const regex = new RegExp(labelPattern);
    const isMatch = label.match(regex) !== null;
    return isMatch;
  });

  if (result) {
    const [labelPattern, targetBranch] = result;
    const regex = new RegExp(labelPattern);
    return label.replace(regex, targetBranch);
  }
}

export function getTargetBranchesFromLabels({
  existingTargetPullRequests,
  branchLabelMapping,
  labels,
}: {
  existingTargetPullRequests: ExistingTargetPullRequests;
  branchLabelMapping: BackportOptions['branchLabelMapping'];
  labels?: string[];
}) {
  if (!branchLabelMapping || !labels) {
    return [];
  }

  const existingBranches = existingTargetPullRequests.map((pr) => pr.branch);

  const targetBranches = labels
    .map((label) => getTargetBranchForLabel({ branchLabelMapping, label }))
    .filter((targetBranch) => targetBranch !== '')
    .filter(filterNil)
    .filter((targetBranch) => !existingBranches.includes(targetBranch));

  logger.info('Inputs when calculating target branches:', {
    labels,
    branchLabelMapping,
    existingTargetPullRequests,
  });

  logger.info('Target branches inferred from labels:', targetBranches);

  return uniq(targetBranches);
}
