import { Octokit } from '@octokit/rest';
import { ora } from '../../../lib/ora';
import { ValidConfigOptions } from '../../../options/options';
import { PACKAGE_VERSION } from '../../../utils/packageVersion';
import { BackportError } from '../../BackportError';
import { logger } from '../../logger';
import { Commit } from '../../sourceCommit/parseSourceCommit';
import { getFirstLine, getShortSha } from '../commitFormatters';
import { fetchExistingPullRequest } from '../v4/fetchExistingPullRequest';
import { getGithubV3ErrorMessage } from './getGithubV3ErrorMessage';

export interface PullRequestPayload {
  owner: string;
  repo: string;
  title: string;
  body: string;
  head: string;
  base: string;
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
  logger.info(
    `Creating PR with title: "${prPayload.title}". ${prPayload.head} -> ${prPayload.base}`
  );

  const { accessToken, githubApiBaseUrlV3 } = options;
  const spinner = ora(options.interactive, `Creating pull request`).start();

  if (options.dryRun) {
    spinner.succeed();
    return { didUpdate: false, number: 1337, url: 'this-is-a-dry-run' };
  }

  try {
    const octokit = new Octokit({
      auth: accessToken,
      baseUrl: githubApiBaseUrlV3,
      log: logger,
    });

    const res = await octokit.pulls.create(prPayload);

    spinner.succeed();

    return {
      url: res.data.html_url,
      number: res.data.number,
      didUpdate: false,
    };
  } catch (e) {
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
    } catch (e) {
      logger.error('Could not retrieve existing pull request', e);
      // swallow error
    }

    spinner.fail();
    throw new BackportError(
      //@ts-expect-error
      `Could not create pull request: ${getGithubV3ErrorMessage(e)}`
    );
  }
}

export function getPullRequestBody({
  options,
  commits,
  targetBranch,
}: {
  options: ValidConfigOptions;
  commits: Commit[];
  targetBranch: string;
}) {
  const commitMessages = commits
    .map((c) => {
      const message = c.sourcePullRequest
        ? `[${getFirstLine(c.sourceCommit.message)}](${
            c.sourcePullRequest.url
          })`
        : `${getFirstLine(c.sourceCommit.message)} (${getShortSha(
            c.sourceCommit.sha
          )})`;

      return ` - ${message}`;
    })
    .join('\n');

  const defaultPrDescription = `# Backport

This will backport the following commits from \`${commits[0].sourceBranch}\` to \`${targetBranch}\`:
${commitMessages}

<!--- Backport version: ${PACKAGE_VERSION} -->

### Questions ?
Please refer to the [Backport tool documentation](https://github.com/sqren/backport)`;

  return (options.prDescription ?? defaultPrDescription)
    .replaceAll('{targetBranch}', targetBranch)
    .replaceAll('{commitMessages}', commitMessages)
    .replaceAll('{defaultPrDescription}', defaultPrDescription);
}

export function getTitle({
  options,
  commits,
  targetBranch,
}: {
  options: ValidConfigOptions;
  commits: Commit[];
  targetBranch: string;
}) {
  const commitMessages = commits
    .map((c) => getFirstLine(c.sourceCommit.message))
    .join(' | ');

  const defaultPrTitle = '[{targetBranch}] {commitMessages}';

  return (options.prTitle ?? defaultPrTitle)
    .replaceAll('{targetBranch}', targetBranch)
    .replaceAll('{commitMessages}', commitMessages)
    .slice(0, 240);
}
