import type { Commit } from '../lib/sourceCommit/parse-source-commit.js';

export function filterUnmergedCommits(commit: Commit) {
  return commit.targetPullRequestStates.some((pr) => pr.state !== 'MERGED');
}
