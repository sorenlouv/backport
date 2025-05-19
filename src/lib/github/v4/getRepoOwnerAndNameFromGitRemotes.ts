import { graphql } from '../../../graphql/generated';
import { maybe } from '../../../utils/maybe';
import { getRepoInfoFromGitRemotes } from '../../git';
import { logger } from '../../logger';
import {
  getGraphQLClient,
  GithubV4Exception,
} from './fetchCommits/graphqlClient';

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
  const firstRemote = maybe(remotes[0]);

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

    const client = getGraphQLClient({ accessToken, githubApiBaseUrlV4 });
    const result = await client.query(query, variables);

    if (result.error) {
      throw new GithubV4Exception(result);
    }

    const repo = result.data?.repository;
    return {
      repoName: repo?.name,
      repoOwner: repo?.isFork ? repo.parent?.owner.login : repo?.owner.login, // get the original owner (not the fork owner)
    };
  } catch (e) {
    if (e instanceof GithubV4Exception) {
      logger.error(e.message);
      return {};
    }
    throw e;
  }
}
