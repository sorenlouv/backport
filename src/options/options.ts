import chalk from 'chalk';
import { isEmpty } from 'lodash-es';
import { BackportError } from '../lib/backport-error.js';
import { getGlobalConfigPath } from '../lib/env.js';
import { getRepoOwnerAndNameFromGitRemotes } from '../lib/github/v4/get-repo-owner-and-name-from-git-remotes.js';
import { getOptionsFromGithub } from '../lib/github/v4/getOptionsFromGithub/get-options-from-github.js';
import { setAccessToken } from '../lib/logger.js';
import type { OptionsFromCliArgs } from './cli-args.js';
import type { OptionsFromConfigFiles } from './config/config.js';
import { getOptionsFromConfigFiles } from './config/config.js';
import type { ConfigFileOptions } from './config-options.js';
import type { ValidConfigOptions } from './option-schema.js';
import { defaultConfigOptions, validOptionsSchema } from './option-schema.js';
export type { ValidConfigOptions } from './option-schema.js';
export { defaultConfigOptions } from './option-schema.js';

const PROJECT_CONFIG_DOCS_LINK =
  'https://github.com/sorenlouv/backport/blob/main/docs/config-file-options.md#project-config-backportrcjson';

const GLOBAL_CONFIG_DOCS_LINK =
  'https://github.com/sorenlouv/backport/blob/main/docs/config-file-options.md#global-config-backportconfigjson';

export async function getOptions({
  optionsFromCliArgs,
  optionsFromModule,
}: {
  optionsFromCliArgs: OptionsFromCliArgs;
  optionsFromModule: ConfigFileOptions;
}): Promise<ValidConfigOptions> {
  const optionsFromConfigFiles = await getOptionsFromConfigFiles({
    optionsFromCliArgs,
    optionsFromModule,
  });

  // combined options from cli and config files
  const combined = getMergedOptionsFromConfigAndCli({
    optionsFromConfigFiles,
    optionsFromCliArgs,
  });

  const { accessToken, repoName, repoOwner } =
    await getRequiredOptions(combined);

  // update logger
  setAccessToken(accessToken);

  const optionsFromGithub = await getOptionsFromGithub({
    ...combined,

    // required options
    accessToken,
    repoName,
    repoOwner,
  });

  const merged = {
    // default author to filter commits by
    author: optionsFromGithub.authenticatedUsername,

    // default fork owner
    repoForkOwner: optionsFromGithub.authenticatedUsername,

    // default values have lowest precedence
    ...defaultConfigOptions,

    // local config options override default options
    ...optionsFromConfigFiles,

    // remote config options override local config options
    ...optionsFromGithub,

    // cli args override the above
    ...optionsFromCliArgs,

    editor: optionsFromCliArgs.editor === 'false' ? undefined : combined.editor,

    // required properties
    accessToken,
    repoName,
    repoOwner,
  };

  throwForRequiredOptions(merged);

  return validOptionsSchema.passthrough().parse(merged) as ValidConfigOptions;
}

async function getRequiredOptions(combined: OptionsFromConfigAndCli) {
  const { accessToken, repoName, repoOwner, globalConfigFile } = combined;

  if (accessToken && repoName && repoOwner) {
    return { accessToken, repoName, repoOwner };
  }

  // require access token
  if (!accessToken) {
    const globalConfigPath = getGlobalConfigPath(globalConfigFile);
    throw new BackportError(
      `Please update your config file: "${globalConfigPath}".\nIt must contain a valid "accessToken".\n\nRead more: ${GLOBAL_CONFIG_DOCS_LINK}`,
    );
  }

  // attempt to retrieve repo-owner and repo-name from git remote
  const gitRemote = await getRepoOwnerAndNameFromGitRemotes({
    cwd: combined.cwd,
    githubApiBaseUrlV4: combined.githubApiBaseUrlV4,
    accessToken,
  });

  if (!gitRemote.repoName || !gitRemote.repoOwner) {
    throw new BackportError(
      `Please specify a repository: "--repo elastic/kibana".\n\nRead more: ${PROJECT_CONFIG_DOCS_LINK}`,
    );
  }

  return {
    accessToken,
    repoName: gitRemote.repoName,
    repoOwner: gitRemote.repoOwner,
  };
}

function throwForRequiredOptions(options: Record<string, any>) {
  // ensure `targetBranches` or `targetBranchChoices` are given
  if (
    isEmpty(options.targetBranches) &&
    isEmpty(options.targetBranchChoices) &&
    // this is primarily necessary on CI where `targetBranches` and `targetBranchChoices` and not given
    isEmpty(options.branchLabelMapping)
  ) {
    throw new BackportError(
      `Please specify a target branch: "--branch 6.1".\n\nRead more: ${PROJECT_CONFIG_DOCS_LINK}`,
    );
  }

  const optionKeys: Array<keyof typeof options> = [
    'accessToken',
    'author',
    'autoMergeMethod',
    'backportBinary',
    'backportBranchName',
    'dir',
    'editor',
    'gitHostname',
    'githubApiBaseUrlV3',
    'githubApiBaseUrlV4',
    'logFilePath',
    'prDescription',
    'projectConfigFile',
    'prTitle',
    'repoForkOwner',
    'repoName',
    'repoOwner',
    'sha',
    'sourceBranch',
  ];

  // Disallow empty strings
  // this is primarily an issue in Github actions where inputs default to empty strings instead of undefined
  // in those cases failing early provides a better UX
  optionKeys.forEach((optionName) => {
    const option = options[optionName] as string;
    if (option === '') {
      throw new BackportError(`"${optionName}" cannot be empty!`);
    }
  });
}

type OptionsFromConfigAndCli = ReturnType<
  typeof getMergedOptionsFromConfigAndCli
>;
function getMergedOptionsFromConfigAndCli({
  optionsFromConfigFiles,
  optionsFromCliArgs,
}: {
  optionsFromConfigFiles: OptionsFromConfigFiles;
  optionsFromCliArgs: OptionsFromCliArgs;
}) {
  return {
    ...defaultConfigOptions,
    ...optionsFromConfigFiles,
    ...optionsFromCliArgs,
  };
}

export function getActiveOptionsFormatted(options: ValidConfigOptions) {
  const customOptions = [
    ['repo', `${options.repoOwner}/${options.repoName}`],
    ['sourceBranch', `${options.sourceBranch}`],
  ];

  if (options.pullNumber) {
    customOptions.push(['pullNumber', `${options.pullNumber}`]);
  }

  if (options.sha) {
    customOptions.push(['sha', `${options.sha}`]);
  }

  if (options.author) {
    customOptions.push(['author', `${options.author}`]);
  }

  if (options.autoMerge === true) {
    customOptions.push(['autoMerge', `${options.autoMerge}`]);
  }

  if (options.maxNumber !== defaultConfigOptions.maxNumber) {
    customOptions.push(['maxNumber', `${options.maxNumber}`]);
  }

  if (options.dateSince) {
    customOptions.push(['since', `${options.dateSince}`]);
  }

  if (options.dateUntil) {
    customOptions.push(['until', `${options.dateUntil}`]);
  }

  return (
    customOptions
      .map(([key, value]) => `${key}: ${chalk.bold(value)}`)
      .join(' 🔹 ') + `\n`
  );
}
