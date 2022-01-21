import { getRepoOwnerAndNameFromGitRemotes } from '../../services/git';

export async function getOptionsFromGit({ cwd }: { cwd: string }) {
  const remotes = await getRepoOwnerAndNameFromGitRemotes({ cwd });
  return remotes[0];
}
