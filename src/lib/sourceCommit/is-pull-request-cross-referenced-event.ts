import type { SourcePullRequestNode } from './get-source-pull-request';

type TimelineItemEdge = NonNullable<
  NonNullable<SourcePullRequestNode['timelineItems']['edges']>[number]
>;

type TimelineItemEdgeNode = NonNullable<TimelineItemEdge>['node'];
type TimelineItemCrossReferencedEvent = Extract<
  TimelineItemEdgeNode,
  { __typename?: 'CrossReferencedEvent' }
>;
type CrossReferencedTarget =
  TimelineItemCrossReferencedEvent['targetPullRequest'];
type SpecificTargetPullRequest = Extract<
  CrossReferencedTarget,
  { __typename: 'PullRequest' }
>;

type GuardedCrossReferencedEventEdge = TimelineItemEdge & {
  node: TimelineItemCrossReferencedEvent & {
    targetPullRequest: SpecificTargetPullRequest;
  };
};

export function isPullRequestCrossReferencedEvent(
  item: TimelineItemEdge,
): item is GuardedCrossReferencedEventEdge {
  return (
    item.node?.__typename === 'CrossReferencedEvent' &&
    item.node.targetPullRequest.__typename === 'PullRequest'
  );
}
