import { graphql } from '../../../graphql/generated/index.js';
import type { ValidConfigOptions } from '../../../options/options.js';
import { BackportError } from '../../backport-error.js';
import { graphqlRequest } from './client/graphql-client.js';

export async function fetchPullRequestAutoMergeMethod(
  options: ValidConfigOptions,
  pullNumber: number,
) {
  const { githubToken, githubApiBaseUrlV4, repoName, repoOwner } = options;

  const query = graphql(`
    query PullRequestAutoMergeMethod(
      $repoOwner: String!
      $repoName: String!
      $pr: Int!
    ) {
      repository(owner: $repoOwner, name: $repoName) {
        pullRequest(number: $pr) {
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
    pr: pullNumber,
  };
  const result = await graphqlRequest(
    { githubToken, githubApiBaseUrlV4 },
    query,
    variables,
  );

  if (result.error) {
    throw new BackportError({
      code: 'github-api-exception',
      message: result.error.message,
    });
  }

  return result.data?.repository?.pullRequest?.autoMergeRequest?.mergeMethod;
}
