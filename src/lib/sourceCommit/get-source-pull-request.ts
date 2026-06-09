import type { SourceCommitWithTargetPullRequestFragmentFragment } from '../../graphql/generated/graphql.js';

export type SourcePullRequestNode = NonNullable<
  ReturnType<typeof getSourcePullRequest>
>;

export function getSourcePullRequest(
  sourceCommit: SourceCommitWithTargetPullRequestFragmentFragment,
) {
  const edges = sourceCommit.associatedPullRequests?.edges ?? [];

  // Pick the PR whose merge produced this commit. GitHub also returns PRs
  // whose head branch happens to contain it (e.g. rebased open PRs).
  const merger = edges.find(
    (edge) => edge?.node?.mergeCommit?.sha === sourceCommit.sha,
  )?.node;

  return merger ?? edges.at(0)?.node;
}
