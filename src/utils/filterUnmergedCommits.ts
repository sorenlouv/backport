import { Commit } from '../entrypoint.module';

export function filterUnmergedCommits(commit: Commit) {
  return commit.targetPullRequestStates.some((pr) => pr.state !== 'MERGED');
}
