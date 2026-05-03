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
  githubToken: string;
  author: string | null;
  since: string | null;
  until: string | null;
  githubApiBaseUrlV4?: string;
  maxCount?: number;
  onlyMissing?: boolean;
  prQuery: string;
  repoName: string;
  repoOwner: string;
  sourceBranch: string;
}): Promise<Commit[]> {
  const {
    githubToken,
    author,
    since,
    until,
    githubApiBaseUrlV4 = 'https://api.github.com/graphql',
    maxCount = 10,
    prQuery,
    repoName,
    repoOwner,
    sourceBranch,
  } = options;

  const query = graphql(`
    query PullRequestBySearchQuery($query: String!, $maxCount: Int!) {
      search(query: $query, type: ISSUE, first: $maxCount) {
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
    if (until && since) {
      return [`merged:${since}..${until}`];
    }

    if (until) {
      return [`merged:<${until}`];
    }

    if (since) {
      return [`merged:>${since}`];
    }

    return [];
  }

  const searchQuery = [
    'type:pr',
    'is:merged',
    'sort:created-desc',
    `repo:${repoOwner}/${repoName}`,
    ...(options.author ? [`author:${options.author}`] : []),
    ...(prQuery.includes('base:') ? [] : [`base:${sourceBranch}`]),
    ...dateFilter(),
    prQuery,
  ].join(' ');

  const variables = {
    query: searchQuery,
    maxCount,
  };

  const result = await graphqlRequest(
    { githubToken, githubApiBaseUrlV4 },
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
