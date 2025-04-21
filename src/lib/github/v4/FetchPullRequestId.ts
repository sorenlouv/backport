import { ValidConfigOptions } from '../../../options/options';
import { getV4Client } from './apiRequestV4';

export async function fetchPullRequestId(
  options: ValidConfigOptions,
  pullNumber: number,
) {
  const { accessToken, githubApiBaseUrlV4, repoName, repoOwner } = options;
  const client = getV4Client({ githubApiBaseUrlV4, accessToken });
  const res = await client.PullRequestId({ repoOwner, repoName, pullNumber });
  return res.data.repository?.pullRequest?.id;
}
