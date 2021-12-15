import { isEmpty } from 'lodash';
import ora from 'ora';
import { ValidConfigOptions } from '../../../../options/options';
import {
  Commit,
  SourceCommitWithTargetPullRequest,
  commitWithAssociatedPullRequestsFragment,
  parseSourceCommit,
} from '../../../../types/commitWithAssociatedPullRequests';
import { HandledError } from '../../../HandledError';
import { apiRequestV4 } from '../apiRequestV4';

export async function fetchPullRequestBySearchQuery(
  options: ValidConfigOptions
): Promise<Commit[]> {
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
            mergeCommit {
              ...${commitWithAssociatedPullRequestsFragment.name}
            }
          }
        }
      }
    }

    ${commitWithAssociatedPullRequestsFragment.source}
  `;

  const authorFilter = all ? '' : `author:${author}`;
  const searchQuery = `type:pr is:merged sort:updated-desc repo:${repoOwner}/${repoName} ${authorFilter} ${prFilter} base:${sourceBranch}`;
  const spinner = ora('Loading pull requests...').start();
  let res: PullRequestBySearchQueryResponse;

  try {
    res = await apiRequestV4<PullRequestBySearchQueryResponse>({
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
    const sourceCommit = pullRequestNode.mergeCommit;
    return parseSourceCommit({ options, sourceCommit });
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

export interface PullRequestBySearchQueryResponse {
  search: {
    nodes: Array<{
      mergeCommit: SourceCommitWithTargetPullRequest;
    }>;
  };
}
