import { graphql } from '../../../graphql/generated/index.js';
import { getRepoInfoFromGitRemotes } from '../../git/index.js';
import { logger } from '../../logger.js';
import { BackportError } from '../../backport-error.js';
import { graphqlRequest } from './client/graphql-client.js';

// This method should be used to get the origin owner (instead of a fork owner)
export async function getRepoOwnerAndNameFromGitRemotes({
  accessToken,
  githubApiBaseUrlV4,
  cwd,
}: {
  accessToken: string;
  githubApiBaseUrlV4?: string;
  cwd: string;
}): Promise<{ repoOwner?: string; repoName?: string }> {
  const remotes = await getRepoInfoFromGitRemotes({ cwd });
  const firstRemote = remotes.at(0);

  if (!firstRemote) {
    return {};
  }

  try {
    const variables = {
      repoOwner: firstRemote.repoOwner,
      repoName: firstRemote.repoName,
    };

    const query = graphql(`
      query RepoOwnerAndName($repoOwner: String!, $repoName: String!) {
        repository(owner: $repoOwner, name: $repoName) {
          isFork
          name
          owner {
            login
          }
          parent {
            owner {
              login
            }
          }
        }
      }
    `);

    const result = await graphqlRequest(
      { accessToken, githubApiBaseUrlV4 },
      query,
      variables,
    );

    if (result.error) {
      throw new BackportError({
        code: 'github-api-exception',
        message: result.error.message,
      });
    }

    const repo = result.data?.repository;
    return {
      repoName: repo?.name,
      repoOwner: repo?.isFork ? repo.parent?.owner.login : repo?.owner.login, // get the original owner (not the fork owner)
    };
  } catch (error) {
    if (error instanceof BackportError) {
      logger.error(error.message);
      return {};
    }
    throw error;
  }
}
