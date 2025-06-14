import { graphql } from '../../../graphql/generated';
import type { ValidConfigOptions } from '../../../options/options';
import { getGraphQLClient, GithubV4Exception } from './client/graphql-client';
import { fetchPullRequestId } from './fetch-pull-request-id2';

export async function enablePullRequestAutoMerge(
  options: ValidConfigOptions,
  targetPullRequestNumber: number,
) {
  const {
    accessToken,
    githubApiBaseUrlV4,
    autoMergeMethod = 'merge',
  } = options;

  const pullRequestId = await fetchPullRequestId(
    options,
    targetPullRequestNumber,
  );

  const query = graphql(`
    mutation EnablePullRequestAutoMerge(
      $pullRequestId: ID!
      $mergeMethod: PullRequestMergeMethod!
    ) {
      enablePullRequestAutoMerge(
        input: { pullRequestId: $pullRequestId, mergeMethod: $mergeMethod }
      ) {
        pullRequest {
          number
        }
      }
    }
  `);

  const variables = {
    pullRequestId,
    mergeMethod: autoMergeMethod.toUpperCase() as any,
  };

  const client = getGraphQLClient({ accessToken, githubApiBaseUrlV4 });
  const result = await client.mutation(query, variables);

  if (result.error) {
    throw new GithubV4Exception(result);
  }

  return result.data?.enablePullRequestAutoMerge?.pullRequest?.number;
}

export function isMissingStatusChecksError(e: GithubV4Exception<unknown>) {
  return e.result.error?.graphQLErrors.some(
    (e) =>
      e.extensions.type === 'UNPROCESSABLE' &&
      (e.message.includes(
        'Branch does not have required protected branch rules',
      ) ||
        e.message.includes('Pull request is in clean status')),
  );
}
