import { PullRequestMergeMethod } from '../../../graphql/generated/graphql.js';
import { graphql } from '../../../graphql/generated/index.js';
import type { ValidConfigOptions } from '../../../options/options.js';
import { BackportError } from '../../backport-error.js';
import type { OperationResultWithMeta } from './client/graphql-client.js';
import { graphqlRequest } from './client/graphql-client.js';
import { fetchPullRequestId } from './fetch-pull-request-id.js';

export async function enablePullRequestAutoMerge(
  options: ValidConfigOptions,
  targetPullRequestNumber: number,
) {
  const {
    githubToken,
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

  const mergeMethodMap: Record<string, PullRequestMergeMethod> = {
    merge: PullRequestMergeMethod.Merge,
    squash: PullRequestMergeMethod.Squash,
    rebase: PullRequestMergeMethod.Rebase,
  };

  const variables = {
    pullRequestId,
    mergeMethod:
      mergeMethodMap[autoMergeMethod] ?? PullRequestMergeMethod.Merge,
  };

  const result = await graphqlRequest(
    { githubToken, githubApiBaseUrlV4 },
    query,
    variables,
  );

  if (result.error) {
    if (isMissingStatusChecksError(result)) {
      throw new BackportError({
        code: 'auto-merge-not-available-exception',
        message: result.error.message,
      });
    }
    throw new BackportError({
      code: 'github-api-exception',
      message: result.error.message,
    });
  }

  return result.data?.enablePullRequestAutoMerge?.pullRequest?.number;
}

function isMissingStatusChecksError(result: OperationResultWithMeta<unknown>) {
  return result.error?.graphQLErrors.some(
    (e) =>
      e.extensions.type === 'UNPROCESSABLE' &&
      (e.message.includes(
        'Branch does not have required protected branch rules',
      ) ||
        e.message.includes('Pull request is in clean status')),
  );
}
