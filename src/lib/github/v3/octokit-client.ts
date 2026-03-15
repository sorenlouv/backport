import { Octokit } from '@octokit/rest';
import { logger } from '../../logger.js';

export function createOctokitClient({
  accessToken,
  githubApiBaseUrlV3,
}: {
  accessToken: string;
  githubApiBaseUrlV3?: string;
}): InstanceType<typeof Octokit> {
  return new Octokit({
    auth: accessToken,
    baseUrl: githubApiBaseUrlV3,
    log: logger,
  });
}
