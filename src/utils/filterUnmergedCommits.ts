import { Commit } from '../entrypoint.module';

export function filterUnmergedCommits(commit: Commit) {
  return commit.pullRequestStates.some((pr) => pr.state !== 'MERGED');
}
