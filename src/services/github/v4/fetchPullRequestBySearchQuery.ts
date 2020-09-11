import isEmpty from 'lodash.isempty';
import ora from 'ora';
import { BackportOptions } from '../../../options/options';
import { CommitSelected } from '../../../types/Commit';
import { HandledError } from '../../HandledError';
import { getFormattedCommitMessage } from '../commitFormatters';
import { apiRequestV4 } from './apiRequestV4';
import { getTargetBranchesFromLabels } from './getTargetBranchesFromLabels';
import {
  pullRequestFragment,
  pullRequestFragmentName,
  PullRequestNode,
  getExistingTargetPullRequests,
  getPullRequestLabels,
} from './sourcePRAndTargetPRs';

export async function fetchPullRequestBySearchQuery(
  options: BackportOptions
): Promise<CommitSelected[]> {
  const {
    accessToken,
    all,
    author,
    githubApiBaseUrlV4,
    maxNumber,
    prFilter,
    repoName,
    repoOwner,
    sourceBranch,
  } = options;
  const query = /* GraphQL */ `
    query PullRequestBySearchQuery($query: String!, $maxNumber: Int!) {
      search(query: $query, type: ISSUE, first: $maxNumber) {
        nodes {
          ... on PullRequest {
            ...${pullRequestFragmentName}
          }
        }
      }
    }

    ${pullRequestFragment}
  `;

  const authorFilter = all ? '' : `author:${author}`;
  const searchQuery = `type:pr is:merged sort:updated-desc repo:${repoOwner}/${repoName} ${authorFilter} ${prFilter} base:${sourceBranch}`;
  const spinner = ora('Loading pull requests...').start();
  let res: DataResponse;

  try {
    res = await apiRequestV4<DataResponse>({
      githubApiBaseUrlV4,
      accessToken,
      query,
      variables: {
        query: searchQuery,
        maxNumber: maxNumber,
      },
    });
    spinner.stop();
  } catch (e) {
    spinner.fail();
    throw e;
  }

  const commits = res.search.nodes.map((pullRequestNode) => {
    // this should never happen
    if (pullRequestNode.mergeCommit == null) {
      throw new Error('Pull Request is not merged');
    }

    const sha = pullRequestNode.mergeCommit.oid;
    const pullNumber = pullRequestNode.number;
    const commitMessage = pullRequestNode.mergeCommit.message;
    const formattedMessage = getFormattedCommitMessage({
      message: commitMessage,
      sha,
      pullNumber,
    });

    const existingTargetPullRequests = getExistingTargetPullRequests(
      commitMessage,
      pullRequestNode
    );

    const targetBranchesFromLabels = getTargetBranchesFromLabels({
      existingTargetPullRequests,
      branchLabelMapping: options.branchLabelMapping,
      labels: getPullRequestLabels(pullRequestNode),
    });

    const choice: CommitSelected = {
      sourceBranch,
      targetBranchesFromLabels,
      sha,
      formattedMessage,
      originalMessage: commitMessage,
      pullNumber,
      existingTargetPullRequests,
    };

    return choice;
  });

  // terminate if not commits were found
  if (isEmpty(commits)) {
    const errorText = options.all
      ? `There are no pull requests matching the filter "${prFilter}"`
      : `There are no commits by "${options.author}" matching the filter "${prFilter}". Try with \`--all\` for commits by all users or \`--author=<username>\` for commits from a specific user`;

    throw new HandledError(errorText);
  }

  return commits;
}

export interface DataResponse {
  search: {
    nodes: PullRequestNode[];
  };
}
