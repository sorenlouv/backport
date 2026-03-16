import { RequestError } from '@octokit/request-error';
import type { ValidConfigOptions } from '../../../../options/options.js';
import { BackportError } from '../../../backport-error.js';
import { logger } from '../../../logger.js';
import { ora } from '../../../ora.js';
import { fetchExistingPullRequest } from '../../v4/fetch-existing-pull-request.js';
import { getGithubV3ErrorMessage } from '../get-github-v3-error-message.js';
import { createOctokitClient, retryOctokitRequest } from '../octokit-client.js';

export interface PullRequestPayload {
  owner: string;
  repo: string;
  title: string;
  body: string;
  head: string;
  base: string;
  draft: boolean;
  // Required by Octokit's RequestParameters type
  [key: string]: unknown;
}

export async function createPullRequest({
  options,
  prPayload,
}: {
  options: ValidConfigOptions;
  prPayload: PullRequestPayload;
}): Promise<{
  url: string;
  number: number;
  didUpdate: boolean;
}> {
  const msg = `Creating ${options.draft ? 'draft ' : ''}pull request`;
  logger.info(
    `${msg} with title: "${prPayload.title}". ${prPayload.head} -> ${prPayload.base}`,
  );

  const { accessToken, githubApiBaseUrlV3 } = options;
  const spinner = ora(options.interactive, msg).start();

  if (options.dryRun) {
    spinner.succeed();
    return { didUpdate: false, number: 1337, url: 'this-is-a-dry-run' };
  }

  try {
    const octokit = createOctokitClient({ accessToken, githubApiBaseUrlV3 });

    const res = await retryOctokitRequest(() =>
      octokit.pulls.create(prPayload),
    );

    spinner.succeed();

    return {
      url: res.data.html_url,
      number: res.data.number,
      didUpdate: false,
    };
  } catch (error) {
    // retrieve url for existing
    try {
      const existingPR = await fetchExistingPullRequest({
        options,
        prPayload,
      });

      if (existingPR) {
        spinner.succeed('Updating existing pull request');
        return {
          url: existingPR.url,
          number: existingPR.number,
          didUpdate: true,
        };
      }
    } catch (error_) {
      logger.error('Could not retrieve existing pull request', error_);
      // swallow error
    }

    spinner.fail();
    const message =
      error instanceof RequestError
        ? getGithubV3ErrorMessage(error)
        : error instanceof Error
          ? error.message
          : String(error);
    throw new BackportError(`Could not create pull request: ${message}`);
  }
}
