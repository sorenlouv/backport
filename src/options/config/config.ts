import isString from 'lodash.isstring';
import { PromiseReturnType } from '../../types/PromiseReturnType';
import { getGlobalConfig } from './globalConfig';
import { getProjectConfig } from './projectConfig';

export interface BranchChoice {
  name: string;
  checked?: boolean;
}

type BranchChoiceRaw = string | BranchChoice;

export type OptionsFromConfigFiles = PromiseReturnType<
  typeof getOptionsFromConfigFiles
> &
  Record<string, unknown>;
export async function getOptionsFromConfigFiles() {
  const [projectConfig, globalConfig] = await Promise.all([
    getProjectConfig(),
    getGlobalConfig(),
  ]);
  // global and project config combined
  const combinedConfig = { ...globalConfig, ...projectConfig };

  // backwards-compatability: `branches` was renamed `targetBranchChoices`
  const targetBranchChoices = (combinedConfig.targetBranchChoices ??
    combinedConfig.branches) as BranchChoiceRaw[] | undefined;

  // backwards-compatability: `labels` was renamed `targetPRLabels`
  const targetPRLabels = (combinedConfig.targetPRLabels ??
    combinedConfig.labels) as string[] | undefined;

  return {
    // defaults
    all: false, // show users own commits
    fork: true, // push target branch to {username}/{repoName}
    gitHostname: 'github.com',
    githubApiBaseUrlV3: 'https://api.github.com',
    githubApiBaseUrlV4: 'https://api.github.com/graphql',
    maxNumber: 10, // display 10 commits to pick from
    multiple: false,
    multipleBranches: true, // allow user to pick multiple target branches
    multipleCommits: false, // only let user pick a single commit
    noVerify: true,
    prTitle: '[{targetBranch}] {commitMessages}',
    sourcePRLabels: [] as string[],
    targetPRLabels: targetPRLabels || [],

    // merge defaults with config values
    ...combinedConfig,

    // overwrite config values
    targetBranchChoices: getTargetBranchChoicesAsObject(targetBranchChoices),
  };
}

// in the config `branches` can either be a string or an object.
// We need to transform it so that it is always treated as an object troughout the application
function getTargetBranchChoicesAsObject(
  targetBranchChoices?: BranchChoiceRaw[]
) {
  if (!targetBranchChoices) {
    return;
  }

  return targetBranchChoices.map((choice) => {
    if (isString(choice)) {
      return {
        name: choice,
        checked: false,
      };
    }

    return choice;
  });
}
