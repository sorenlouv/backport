import { ValidConfigOptions } from '../options/options';
import { getGitConfig, getLocalSourceRepoPath } from '../services/git';

export type GitConfigAuthor = {
  name?: string;
  email?: string;
};

export async function getGitConfigAuthor(
  options: ValidConfigOptions
): Promise<GitConfigAuthor | undefined> {
  const localRepoPath = await getLocalSourceRepoPath(options);
  if (!localRepoPath) {
    return;
  }

  return {
    name: await getGitConfig({ dir: localRepoPath, key: 'user.name' }),
    email: await getGitConfig({ dir: localRepoPath, key: 'user.email' }),
  };
}
