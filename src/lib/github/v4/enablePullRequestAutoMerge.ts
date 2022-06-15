import gql from 'graphql-tag';
import { ora } from '../../../lib/ora';
import { ValidConfigOptions } from '../../../options/options';
import { logger } from '../../logger';
import { fetchPullRequestId } from './FetchPullRequestId';
import { apiRequestV4 } from './apiRequestV4';

interface Response {
  enablePullRequestAutoMerge: { pullRequest?: { number: number } };
}

export async function enablePullRequestAutoMerge(
  options: ValidConfigOptions,
  targetPullRequestNumber: number
) {
  const {
    accessToken,
    githubApiBaseUrlV4,
    autoMergeMethod = 'merge',
  } = options;
  const text = `Enabling auto merging via ${options.autoMergeMethod}`;
  logger.info(text);
  const spinner = ora(options.interactive, text).start();

  if (options.dryRun) {
    spinner.succeed();
    return;
  }

  const pullRequestId = await fetchPullRequestId(
    options,
    targetPullRequestNumber
  );

  const query = gql`
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
  `;

  try {
    const res = await apiRequestV4<Response>({
      githubApiBaseUrlV4,
      accessToken,
      query,
      variables: {
        pullRequestId,
        mergeMethod: autoMergeMethod.toUpperCase(),
      },
    });
    spinner.succeed();
    return res.enablePullRequestAutoMerge.pullRequest?.number;
  } catch (e) {
    const err = e as Error;
    spinner.fail();
    logger.info(
      `Could not enable auto merging for ${targetPullRequestNumber} due to ${err.message}`,
      e
    );
  }
}
