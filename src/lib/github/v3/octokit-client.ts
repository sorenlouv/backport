import { Octokit } from '@octokit/rest';
import pRetry from 'p-retry';
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

/**
 * Retry-wrapped Octokit request. Retries on transient server errors (5xx)
 * and rate limiting (429). Does not retry client errors (4xx).
 */
export function retryOctokitRequest<T>(fn: () => Promise<T>): Promise<T> {
  return pRetry(fn, {
    retries: 2,
    minTimeout: 1000,
    shouldRetry: (error) => {
      const status = (error as { status?: number }).status;
      return status !== undefined && (status >= 500 || status === 429);
    },
    onFailedAttempt: ({ error, attemptNumber, retriesLeft }) => {
      const status = (error as { status?: number }).status;
      logger.info(
        `Octokit request failed (attempt ${attemptNumber}/${attemptNumber + retriesLeft}): ${status ?? error.message}`,
      );
    },
  });
}
