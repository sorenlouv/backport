import { ConfigFileOptions } from '../../../../options/ConfigOptions';
import { BackportError } from '../../../BackportError';
import {
  getLocalConfigFileCommitDate,
  isLocalConfigFileUntracked,
  isLocalConfigFileModified,
} from '../../../git';
import { logger } from '../../../logger';
import {
  parseRemoteConfig,
  swallowMissingConfigFileException,
} from '../../../remoteConfig';
import { apiRequestV4, GithubV4Exception } from '../apiRequestV4';
import { throwOnInvalidAccessToken } from '../throwOnInvalidAccessToken';
import { GithubConfigOptionsResponse, query } from './query';

// fetches the default source branch for the repo (normally "master")
// startup checks:
// - verify the access token
// - ensure no branch named "backport" exists

export type OptionsFromGithub = Awaited<
  ReturnType<typeof getOptionsFromGithub>
>;
export async function getOptionsFromGithub(options: {
  accessToken: string;
  cwd?: string;
  githubApiBaseUrlV4?: string;
  repoName: string;
  repoOwner: string;
  skipRemoteConfig?: boolean;
  globalConfigFile?: string;
}) {
  const {
    accessToken,
    githubApiBaseUrlV4,
    repoName,
    repoOwner,
    globalConfigFile,
  } = options;

  let res: GithubConfigOptionsResponse;

  try {
    res = await apiRequestV4<GithubConfigOptionsResponse>({
      githubApiBaseUrlV4,
      accessToken,
      query,
      variables: { repoOwner, repoName },
    });
  } catch (e) {
    if (!(e instanceof GithubV4Exception)) {
      throw e;
    }

    throwOnInvalidAccessToken({
      error: e,
      repoName,
      repoOwner,
      globalConfigFile,
    });
    res = swallowMissingConfigFileException<GithubConfigOptionsResponse>(e);
  }

  // it is not possible to have a branch named "backport"
  if (res.repository.illegalBackportBranch) {
    throw new BackportError(
      'You must delete the branch "backport" to continue. See https://github.com/sqren/backport/issues/155 for details'
    );
  }

  const remoteConfig = await getRemoteConfigFileOptions(
    res,
    options.cwd,
    options.skipRemoteConfig
  );

  return {
    authenticatedUsername: res.viewer.login,
    sourceBranch: res.repository.defaultBranchRef.name,
    isRepoPrivate: res.repository.isPrivate,
    ...remoteConfig,
  };
}

async function getRemoteConfigFileOptions(
  res: GithubConfigOptionsResponse,
  cwd?: string,
  skipRemoteConfig?: boolean
): Promise<ConfigFileOptions | undefined> {
  if (skipRemoteConfig) {
    logger.info(
      'Remote config: Skipping. `--skip-remote-config` specified via config file or cli'
    );
    return;
  }

  const remoteConfig =
    res.repository.defaultBranchRef.target.remoteConfigHistory.edges?.[0]
      ?.remoteConfig;

  if (!remoteConfig) {
    logger.info("Remote config: Skipping. Remote config doesn't exist");
    return;
  }

  if (cwd) {
    const [isLocalConfigModified, isLocalConfigUntracked, localCommitDate] =
      await Promise.all([
        isLocalConfigFileModified({ cwd }),
        isLocalConfigFileUntracked({ cwd }),
        getLocalConfigFileCommitDate({ cwd }),
      ]);

    if (isLocalConfigUntracked) {
      logger.info('Remote config: Skipping. Local config is new');
      return;
    }

    if (isLocalConfigModified) {
      logger.info('Remote config: Skipping. Local config is modified');
      return;
    }

    if (
      localCommitDate &&
      localCommitDate > Date.parse(remoteConfig.committedDate)
    ) {
      logger.info(
        `Remote config: Skipping. Local config is newer: ${new Date(
          localCommitDate
        ).toISOString()} > ${remoteConfig.committedDate}`
      );
      return;
    }
  }

  logger.info('Remote config: Parsing.');
  return parseRemoteConfig(remoteConfig);
}
