import type { ValidConfigOptions } from '../../../options/options.js';
import { createOctokitClient, retryOctokitRequest } from './octokit-client.js';

export function mergePullRequest(
  options: ValidConfigOptions,
  pullNumber: number,
) {
  const { githubToken, githubApiBaseUrlV3 } = options;
  const octokit = createOctokitClient({ githubToken, githubApiBaseUrlV3 });

  return retryOctokitRequest(() =>
    octokit.request('PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge', {
      owner: options.repoOwner,
      repo: options.repoName,
      pull_number: pullNumber,
    }),
  );
}
