import { isEmpty } from 'lodash';
import { graphql } from '../../../../graphql/generated';
import { filterNil } from '../../../../utils/filterEmpty';
import { filterUnmergedCommits } from '../../../../utils/filterUnmergedCommits';
import { BackportError } from '../../../BackportError';
import { isMissingConfigFileException } from '../../../remoteConfig';
import {
  Commit,
  parseSourceCommit,
} from '../../../sourceCommit/parseSourceCommit';
import { GithubV4Exception, getGraphQLClient } from '../client/graphqlClient';

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

  const client = getGraphQLClient({ accessToken, githubApiBaseUrlV4 });
  const result = await client.query(query, variables);

  if (result.error && !isMissingConfigFileException(result)) {
    throw new GithubV4Exception(result);
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

    throw new BackportError(errorText);
  }

  if (options.onlyMissing) {
    return commits.filter(filterUnmergedCommits);
  }

  return commits;
}
