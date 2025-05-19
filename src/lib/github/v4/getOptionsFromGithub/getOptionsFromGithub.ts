import { OperationResult } from '@urql/core';
import { graphql } from '../../../../graphql/generated';
import { GithubConfigOptionsQuery } from '../../../../graphql/generated/graphql';
import { ConfigFileOptions } from '../../../../options/ConfigOptions';
import { BackportError } from '../../../BackportError';
import {
  getLocalConfigFileCommitDate,
  isLocalConfigFileUntracked,
  isLocalConfigFileModified,
} from '../../../git';
import { logger } from '../../../logger';
import {
  parseRemoteConfigFile,
  swallowMissingConfigFileException,
} from '../../../remoteConfig';
import {
  getGraphQLClient,
  GithubV4Exception,
} from '../fetchCommits/graphqlClient';
import { throwOnInvalidAccessToken } from '../throwOnInvalidAccessToken';

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
  sourceBranch?: string;
}) {
  const {
    accessToken,
    githubApiBaseUrlV4,
    repoName,
    repoOwner,
    globalConfigFile,
  } = options;

  let data: GithubConfigOptionsQuery | undefined;

  try {
    const query = graphql(`
      query GithubConfigOptions($repoOwner: String!, $repoName: String!) {
        viewer {
          login
        }
        repository(owner: $repoOwner, name: $repoName) {
          # check to see if a branch named "backport" exists
          illegalBackportBranch: ref(qualifiedName: "refs/heads/backport") {
            id
          }
          isPrivate
          defaultBranchRef {
            name
            target {
              ...RemoteConfigHistoryFragment
            }
          }
        }
      }
    `);

    const variables = { repoOwner, repoName };
    const client = getGraphQLClient({ accessToken, githubApiBaseUrlV4 });
    const result = await client.query(query, variables);

    if (result.error) {
      throw new GithubV4Exception(result);
    }

    throwIfInsufficientPermissions(result);

    data = result.data;
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
    data = swallowMissingConfigFileException<GithubConfigOptionsQuery>(e);
  }

  // it is not possible to have a branch named "backport"
  if (data?.repository?.illegalBackportBranch) {
    throw new BackportError(
      'You must delete the branch "backport" to continue. See https://github.com/sorenlouv/backport/issues/155 for details',
    );
  }

  const remoteConfig = await getRemoteConfigFileOptions(
    data,
    options.cwd,
    options.skipRemoteConfig,
  );

  if (!data) {
    throw new BackportError(
      'Failed to fetch options from GitHub. Please check your access token and repository settings.',
    );
  }

  return {
    authenticatedUsername: data.viewer.login,
    sourceBranch:
      options.sourceBranch ?? data.repository?.defaultBranchRef?.name ?? 'main',
    isRepoPrivate: data.repository?.isPrivate,
    ...remoteConfig,
  };
}

async function getRemoteConfigFileOptions(
  res: GithubConfigOptionsQuery | undefined,
  cwd?: string,
  skipRemoteConfig?: boolean,
): Promise<ConfigFileOptions | undefined> {
  if (skipRemoteConfig) {
    logger.info(
      'Remote config: Skipping. `--skip-remote-config` specified via config file or cli',
    );
    return;
  }

  if (res?.repository?.defaultBranchRef?.target?.__typename !== 'Commit') {
    logger.info('Remote config: Skipping. Default branch is not a commit');
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
          localCommitDate,
        ).toISOString()} > ${remoteConfig.committedDate}`,
      );
      return;
    }
  }

  logger.info('Remote config: Parsing.');
  return parseRemoteConfigFile(remoteConfig);
}

function throwIfInsufficientPermissions(
  res: OperationResult<
    GithubConfigOptionsQuery,
    {
      repoOwner: string;
      repoName: string;
    }
  >,
) {
  const responseHeaders = (res as any).responseHeaders as Headers;

  const accessScopesHeader = responseHeaders.get('x-oauth-scopes');
  if (accessScopesHeader == null) {
    return;
  }

  const accessTokenScopes = accessScopesHeader
    .split(',')
    .map((scope) => scope.trim());

  const isRepoPrivate = res.data?.repository?.isPrivate;

  if (isRepoPrivate && !accessTokenScopes.includes('repo')) {
    throw new BackportError(
      `You must grant the "repo" scope to your personal access token`,
    );
  }

  if (
    !accessTokenScopes.includes('repo') &&
    !accessTokenScopes.includes('public_repo')
  ) {
    throw new BackportError(
      `You must grant the "repo" or "public_repo" scope to your personal access token`,
    );
  }
}
