import type { SourceCommitWithTargetPullRequestFragmentFragment } from '../../graphql/generated/graphql.js';

export type SourcePullRequestNode = NonNullable<
  ReturnType<typeof getSourcePullRequest>
>;

export function getSourcePullRequest(
  sourceCommit: SourceCommitWithTargetPullRequestFragmentFragment,
) {
  return sourceCommit.associatedPullRequests?.edges?.[0]?.node;
}
