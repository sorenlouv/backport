import chalk from 'chalk';
import ora from 'ora';
import { ValidConfigOptions } from '../../../../options/options';
import {
  Commit,
  CommitWithAssociatedPullRequests,
  commitWithAssociatedPullRequestsFragment,
  parseSourceCommit,
} from '../../../../types/commitWithAssociatedPullRequests';
import { HandledError } from '../../../HandledError';
import { apiRequestV4 } from '../apiRequestV4';

export async function fetchCommitByPullNumber(
  options: ValidConfigOptions & { pullNumber: number }
): Promise<Commit> {
  const {
    accessToken,
    branchLabelMapping,
    githubApiBaseUrlV4,
    pullNumber,
    repoName,
    repoOwner,
    sourceBranch,
  } = options;

  const query = /* GraphQL */ `
    query CommitByPullNumber(
      $repoOwner: String!
      $repoName: String!
      $pullNumber: Int!
    ) {
      repository(owner: $repoOwner, name: $repoName) {
        pullRequest(number: $pullNumber) {
          mergeCommit {
            ...${commitWithAssociatedPullRequestsFragment.name}
          }
        }
      }
    }

    ${commitWithAssociatedPullRequestsFragment.source}
  `;

  const spinner = ora(
    `Loading merge commit from pull request #${options.pullNumber}`
  ).start();

  let res: CommitByPullNumberResponse;
  try {
    res = await apiRequestV4<CommitByPullNumberResponse>({
      githubApiBaseUrlV4,
      accessToken,
      query,
      variables: {
        repoOwner,
        repoName,
        pullNumber,
      },
    });
    spinner.stop();
  } catch (e) {
    spinner.fail();
    throw e;
  }

  const pullRequestNode = res.repository.pullRequest;
  if (!pullRequestNode) {
    throw new HandledError(`The PR #${pullNumber} does not exist`);
  }

  const sourceCommit = pullRequestNode.mergeCommit;
  if (sourceCommit === null) {
    throw new HandledError(`The PR #${pullNumber} is not merged`);
  }
  const commit = parseSourceCommit({
    sourceBranch,
    branchLabelMapping,
    sourceCommit,
  });

  // add styles to make it look like a prompt question
  spinner.stopAndPersist({
    symbol: chalk.green('?'),
    text: `${chalk.bold('Select pull request')} ${chalk.cyan(
      commit.formattedMessage
    )}`,
  });

  return commit;
}

interface CommitByPullNumberResponse {
  repository: {
    pullRequest: {
      mergeCommit: CommitWithAssociatedPullRequests | null;
    } | null;
  };
}
