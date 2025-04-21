import { ValidConfigOptions } from '../../../options/options';
import { fetchPullRequestId } from './FetchPullRequestId';
import { getV4Client, GithubV4Exception } from './apiRequestV4';

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

  if (!pullRequestId) {
    throw new Error(
      `Failed to get pull request ID for pull request #${targetPullRequestNumber}`,
    );
  }

  const client = getV4Client({ githubApiBaseUrlV4, accessToken });
  const res = await client.EnablePullRequestAutoMerge({
    pullRequestId,
    mergeMethod: autoMergeMethod.toUpperCase() as any,
  });

  return res.data.enablePullRequestAutoMerge?.pullRequest?.number;
}

export function parseGithubError(e: GithubV4Exception) {
  const isMissingStatusChecks = e.response.errors?.some(
    (e) =>
      e.extensions.type === 'UNPROCESSABLE' &&
      (e.message.includes(
        'Branch does not have required protected branch rules',
      ) ||
        e.message.includes('Pull request is in clean status')),
  );

  return { isMissingStatusChecks };
}
