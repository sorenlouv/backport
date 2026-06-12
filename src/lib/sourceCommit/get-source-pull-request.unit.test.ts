import type { SourceCommitWithTargetPullRequestFragmentFragment } from '../../graphql/generated/graphql.js';
import { getSourcePullRequest } from './get-source-pull-request.js';

/**
 * Build a minimal sourceCommit shape with the fields getSourcePullRequest reads.
 * Other fragment fields are not referenced here, so we cast through unknown.
 */
function makeSourceCommit(input: {
  sha: string;
  pullRequests: Array<{
    number: number;
    mergeCommitSha: string | null;
  }>;
}): SourceCommitWithTargetPullRequestFragmentFragment {
  const edges = input.pullRequests.map((pr) => ({
    node: {
      number: pr.number,
      mergeCommit:
        pr.mergeCommitSha === null
          ? null
          : { sha: pr.mergeCommitSha, __typename: 'Commit' },
    },
  }));
  return {
    sha: input.sha,
    associatedPullRequests: { edges },
  } as unknown as SourceCommitWithTargetPullRequestFragmentFragment;
}

describe('getSourcePullRequest', () => {
  it('returns undefined when there are no associated PRs', () => {
    const sourceCommit = makeSourceCommit({
      sha: 'abc123',
      pullRequests: [],
    });
    expect(getSourcePullRequest(sourceCommit)).toBeUndefined();
  });

  it('returns the only associated PR when there is just one', () => {
    const sourceCommit = makeSourceCommit({
      sha: 'abc123',
      pullRequests: [{ number: 42, mergeCommitSha: 'abc123' }],
    });
    expect(getSourcePullRequest(sourceCommit)?.number).toBe(42);
  });

  // Regression test for sorenlouv/backport#502.
  //
  // GitHub's `associatedPullRequests` returns every PR whose head branch
  // *contains* the queried commit — including unrelated open PRs that
  // recently merged the target branch into themselves. With `first: 1` +
  // `.at(0)`, that wrong PR was returned. The fix picks the PR whose
  // mergeCommit produced the queried commit.
  it('picks the PR whose mergeCommit.sha matches the source commit sha', () => {
    const sourceCommit = makeSourceCommit({
      sha: 'abc123',
      pullRequests: [
        // Open PR whose head happens to contain abc123 (came first from GitHub).
        { number: 5, mergeCommitSha: null },
        // The PR that actually merged abc123 into the target branch.
        { number: 6, mergeCommitSha: 'abc123' },
      ],
    });
    expect(getSourcePullRequest(sourceCommit)?.number).toBe(6);
  });

  it('falls back to the first PR when no node has a matching mergeCommit (e.g. rebase strategy)', () => {
    const sourceCommit = makeSourceCommit({
      sha: 'abc123',
      pullRequests: [
        // Rebase-merged PR: per-commit oid (abc123) differs from PR.mergeCommit.sha.
        { number: 7, mergeCommitSha: 'def456' },
      ],
    });
    expect(getSourcePullRequest(sourceCommit)?.number).toBe(7);
  });

  it('prefers the merge match over an unrelated first node even when both exist before and after the matcher', () => {
    const sourceCommit = makeSourceCommit({
      sha: 'abc123',
      pullRequests: [
        { number: 1, mergeCommitSha: 'unrelated1' },
        { number: 2, mergeCommitSha: 'abc123' },
        { number: 3, mergeCommitSha: 'unrelated3' },
      ],
    });
    expect(getSourcePullRequest(sourceCommit)?.number).toBe(2);
  });
});
