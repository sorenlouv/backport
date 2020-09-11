import flatMap from 'lodash.flatmap';
import uniq from 'lodash.uniq';
import { BackportOptions } from '../../../options/options';
import { filterEmpty } from '../../../utils/filterEmpty';

export function getTargetBranchesFromLabels({
  branchLabelMapping,
  labels,
}: {
  branchLabelMapping: BackportOptions['branchLabelMapping'];
  labels?: string[];
}) {
  if (!branchLabelMapping || !labels) {
    return [];
  }

  const targetBranches = flatMap(labels, (label) => {
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
  })
    .filter((targetBranch) => targetBranch !== '')
    .filter(filterEmpty);

  return uniq(targetBranches);
}
