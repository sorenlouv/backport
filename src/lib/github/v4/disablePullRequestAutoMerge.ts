import { graphql } from '../../../graphql/generated';
import type { ValidConfigOptions } from '../../../options/options';
import { getGraphQLClient, GithubV4Exception } from './client/graphqlClient';
import { fetchPullRequestId } from './fetchPullRequestId2';

export async function disablePullRequestAutoMerge(
  options: ValidConfigOptions,
  pullNumber: number,
) {
  const { accessToken, githubApiBaseUrlV4 } = options;
  const pullRequestId = await fetchPullRequestId(options, pullNumber);

  const query = graphql(`
    mutation DisablePullRequestAutoMerge($pullRequestId: ID!) {
      disablePullRequestAutoMerge(input: { pullRequestId: $pullRequestId }) {
        pullRequest {
          number
        }
      }
    }
  `);

  const client = getGraphQLClient({ accessToken, githubApiBaseUrlV4 });
  const result = await client.mutation(query, {
    pullRequestId,
  });

  if (result.error) {
    throw new GithubV4Exception(result);
  }

  return result.data?.disablePullRequestAutoMerge?.pullRequest?.number;
}
