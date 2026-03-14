import { graphql } from '../../../graphql/generated/index.js';
import type { ValidConfigOptions } from '../../../options/options.js';
import { GithubV4Exception, graphqlRequest } from './client/graphql-client.js';

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
  const result = await graphqlRequest(
    { accessToken, githubApiBaseUrlV4 },
    query,
    variables,
  );

  if (result.error) {
    throw new GithubV4Exception(result);
  }

  return result.data?.repository?.pullRequest?.autoMergeRequest?.mergeMethod;
}
