import { BackportOptions } from '../options/options';
import { listBranches } from '../services/prompts';
import isEmpty from 'lodash.isempty';
import { BranchChoice } from '../options/config/projectConfig';

export async function getBranches(options: BackportOptions) {
  return !isEmpty(options.branches)
    ? options.branches
    : await listBranches(
        options.branchChoices as BranchChoice[],
        options.multipleBranches
      );
}
