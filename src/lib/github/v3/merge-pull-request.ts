import type { ValidConfigOptions } from '../../../options/options.js';
import { createOctokitClient } from './octokit-client.js';

export function mergePullRequest(
  options: ValidConfigOptions,
  pullNumber: number,
) {
  const { accessToken, githubApiBaseUrlV3 } = options;
  const octokit = createOctokitClient({ accessToken, githubApiBaseUrlV3 });

  return octokit.request(
    'PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge',
    {
      owner: options.repoOwner,
      repo: options.repoName,
      pull_number: pullNumber,
    },
  );
}
