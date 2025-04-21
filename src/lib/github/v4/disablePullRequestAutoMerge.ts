import { ValidConfigOptions } from '../../../options/options';
import { fetchPullRequestId } from './FetchPullRequestId';
import { getV4Client } from './apiRequestV4';

export async function disablePullRequestAutoMerge(
  options: ValidConfigOptions,
  pullNumber: number,
) {
  const { accessToken, githubApiBaseUrlV4 } = options;
  const pullRequestId = await fetchPullRequestId(options, pullNumber);
  const client = getV4Client({ githubApiBaseUrlV4, accessToken });

  if (!pullRequestId) {
    throw new Error(`Pull request with number ${pullNumber} not found`);
  }

  const res = await client.DisablePullRequestAutoMerge({ pullRequestId });
  return res.data.disablePullRequestAutoMerge?.pullRequest?.number;
}
