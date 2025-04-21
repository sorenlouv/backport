import { maybe } from '../../../utils/maybe';
import { getRepoInfoFromGitRemotes } from '../../git';
import { logger } from '../../logger';
import { getV4Client, GithubV4Exception } from './apiRequestV4';

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
    const client = getV4Client({ githubApiBaseUrlV4, accessToken });
    const res = await client.RepoOwnerAndName({
      repoOwner: firstRemote.repoOwner,
      repoName: firstRemote.repoName,
    });

    const { repository } = res.data;

    return {
      repoName: repository?.name,
      // get the original owner (not the fork owner)
      repoOwner: repository?.isFork
        ? repository.parent?.owner.login
        : repository?.owner.login,
    };
  } catch (e) {
    if (e instanceof GithubV4Exception) {
      logger.error(e.message);
      return {};
    }
    throw e;
  }
}
