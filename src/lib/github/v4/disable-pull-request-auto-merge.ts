import { graphql } from '../../../graphql/generated/index.js';
import type { ValidConfigOptions } from '../../../options/options.js';
import {
  getGraphQLClient,
  GithubV4Exception,
} from './client/graphql-client.js';
import { fetchPullRequestId } from './fetch-pull-request-id2.js';

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
