import { Commit } from '../entrypoint.module';
import { ValidConfigOptions } from '../options/options';
import { getGitConfig, getLocalSourceRepoPath } from './git';

export type GitConfigAuthor = { name?: string; email?: string };
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

export type CommitAuthor = Required<GitConfigAuthor>;
export function getCommitAuthor({
  options,
  gitConfigAuthor,
  commit,
}: {
  options: ValidConfigOptions;
  gitConfigAuthor?: GitConfigAuthor;
  commit: Commit;
}): CommitAuthor {
  if (options.resetAuthor) {
    return {
      name: options.authenticatedUsername,
      email: `<${options.authenticatedUsername}@users.noreply.github.com>`,
    };
  }

  return {
    name: options.gitAuthorName ?? gitConfigAuthor?.name ?? commit.author.name,
    email:
      options.gitAuthorEmail ?? gitConfigAuthor?.email ?? commit.author.email,
  };
}
