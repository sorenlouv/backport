import { Commit } from '../entrypoint.api';
import { ValidConfigOptions } from '../options/options';

export type CommitAuthor = { name?: string | null; email?: string | null };
export function getCommitAuthor({
  options,
  commit,
}: {
  options: ValidConfigOptions;
  commit: Commit;
}): CommitAuthor {
  if (options.resetAuthor) {
    return {
      name: options.authenticatedUsername,
      email: `<${options.authenticatedUsername}@users.noreply.github.com>`,
    };
  }

  return {
    name: options.gitAuthorName ?? commit.author?.name,
    email: options.gitAuthorEmail ?? commit.author?.email,
  };
}
