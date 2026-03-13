import type { Commit } from '../entrypoint.api.js';

export function filterUnmergedCommits(commit: Commit) {
  return commit.targetPullRequestStates.some((pr) => pr.state !== 'MERGED');
}
