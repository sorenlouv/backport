import { graphql } from '../../../graphql/generated';
import type { ValidConfigOptions } from '../../../options/options';
import { getGraphQLClient, GithubV4Exception } from './client/graphqlClient';

export async function fetchPullRequestId(
  options: ValidConfigOptions,
  pullNumber: number,
) {
  const { accessToken, githubApiBaseUrlV4, repoName, repoOwner } = options;

  const query = graphql(`
    query PullRequestId(
      $repoOwner: String!
      $repoName: String!
      $pullNumber: Int!
    ) {
      repository(owner: $repoOwner, name: $repoName) {
        pullRequest(number: $pullNumber) {
          id
        }
      }
    }
  `);

  const variables = { repoOwner, repoName, pullNumber };
  const client = getGraphQLClient({ accessToken, githubApiBaseUrlV4 });
  const result = await client.query(query, variables);

  if (result.error) {
    throw new GithubV4Exception(result);
  }

  const pullRequestId = result.data?.repository?.pullRequest?.id;
  if (!pullRequestId) {
    throw new Error(`No pull request found with number "${pullNumber}"`);
  }

  return pullRequestId;
}
