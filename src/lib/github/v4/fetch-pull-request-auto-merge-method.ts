import { graphql } from '../../../graphql/generated';
import type { ValidConfigOptions } from '../../../options/options';
import { GithubV4Exception, getGraphQLClient } from './client/graphql-client';

export async function fetchPullRequestAutoMergeMethod(
  options: ValidConfigOptions,
  pullNumber: number,
) {
  const { accessToken, githubApiBaseUrlV4, repoName, repoOwner } = options;

  const query = graphql(`
    query PullRequestAutoMergeMethod(
      $repoOwner: String!
      $repoName: String!
      $pullNumber: Int!
    ) {
      repository(owner: $repoOwner, name: $repoName) {
        pullRequest(number: $pullNumber) {
          autoMergeRequest {
            enabledAt
            mergeMethod
          }
        }
      }
    }
  `);
  const variables = {
    repoOwner,
    repoName,
    pullNumber,
  };
  const client = getGraphQLClient({ accessToken, githubApiBaseUrlV4 });
  const result = await client.query(query, variables);

  if (result.error) {
    throw new GithubV4Exception(result);
  }

  return result.data?.repository?.pullRequest?.autoMergeRequest?.mergeMethod;
}
