import { graphql } from '../../../graphql/generated/index.js';
import type { ValidConfigOptions } from '../../../options/options.js';
import { BackportError } from '../../backport-error.js';
import { graphqlRequest } from './client/graphql-client.js';

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
  const result = await graphqlRequest(
    { accessToken, githubApiBaseUrlV4 },
    query,
    variables,
  );

  if (result.error) {
    throw new BackportError({
      code: 'github-api-exception',
      message: result.error.message,
    });
  }

  const pullRequestId = result.data?.repository?.pullRequest?.id;
  if (!pullRequestId) {
    throw new BackportError({
      code: 'pr-not-found-exception',
      pullNumber,
    });
  }

  return pullRequestId;
}
