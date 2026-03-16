import { isEmpty } from 'lodash-es';
import { graphql } from '../../../../graphql/generated/index.js';
import { filterNil } from '../../../../utils/filter-empty.js';
import { filterUnmergedCommits } from '../../../../utils/filter-unmerged-commits.js';
import { BackportError } from '../../../backport-error.js';
import { isMissingConfigFileException } from '../../../remote-config.js';
import type { Commit } from '../../../sourceCommit/parse-source-commit.js';
import { parseSourceCommit } from '../../../sourceCommit/parse-source-commit.js';
import { graphqlRequest } from '../client/graphql-client.js';

export async function fetchPullRequestsBySearchQuery(options: {
  accessToken: string;
  author: string | null;
  dateSince: string | null;
  dateUntil: string | null;
  githubApiBaseUrlV4?: string;
  maxNumber?: number;
  onlyMissing?: boolean;
  prFilter: string;
  repoName: string;
  repoOwner: string;
  sourceBranch: string;
}): Promise<Commit[]> {
  const {
    accessToken,
    author,
    dateSince,
    dateUntil,
    githubApiBaseUrlV4 = 'https://api.github.com/graphql',
    maxNumber = 10,
    prFilter,
    repoName,
    repoOwner,
    sourceBranch,
  } = options;

  const query = graphql(`
    query PullRequestBySearchQuery($query: String!, $maxNumber: Int!) {
      search(query: $query, type: ISSUE, first: $maxNumber) {
        nodes {
          ... on PullRequest {
            __typename
            mergeCommit {
              __typename
              ...SourceCommitWithTargetPullRequestFragment
            }
          }
        }
      }
    }
  `);

  function dateFilter() {
    if (dateUntil && dateSince) {
      return [`merged:${dateSince}..${dateUntil}`];
    }

    if (dateUntil) {
      return [`merged:<${dateUntil}`];
    }

    if (dateSince) {
      return [`merged:>${dateSince}`];
    }

    return [];
  }

  const searchQuery = [
    'type:pr',
    'is:merged',
    'sort:created-desc',
    `repo:${repoOwner}/${repoName}`,
    ...(options.author ? [`author:${options.author}`] : []),
    ...(prFilter.includes('base:') ? [] : [`base:${sourceBranch}`]),
    ...dateFilter(),
    prFilter,
  ].join(' ');

  const variables = {
    query: searchQuery,
    maxNumber,
  };

  const result = await graphqlRequest(
    { accessToken, githubApiBaseUrlV4 },
    query,
    variables,
  );

  if (result.error && !isMissingConfigFileException(result)) {
    throw new BackportError({
      code: 'github-api-exception',
      message: result.error.message,
    });
  }
  const { data } = result;

  const commits = data?.search.nodes
    ?.map((pullRequestNode) => {
      if (pullRequestNode?.__typename === 'PullRequest') {
        const sourceCommit = pullRequestNode.mergeCommit;
        if (sourceCommit) {
          return parseSourceCommit({ options, sourceCommit });
        }
      }
    })
    .filter(filterNil);

  // terminate if not commits were found
  if (!commits || isEmpty(commits)) {
    const errorText = author
      ? `No commits found for query:\n    ${searchQuery}\n\nUse \`--all\` to see commits by all users or \`--author=<username>\` for commits from a specific user`
      : `No commits found for query:\n    ${searchQuery}`;

    throw new BackportError({
      code: 'no-commits-found-exception',
      message: errorText,
    });
  }

  if (options.onlyMissing) {
    return commits.filter(filterUnmergedCommits);
  }

  return commits;
}
