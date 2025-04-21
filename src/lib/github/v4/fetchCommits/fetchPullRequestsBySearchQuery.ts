import { isEmpty } from 'lodash';
import { PullRequestBySearchQueryQuery } from '../../../../graphql/generated';
import { filterNil } from '../../../../utils/filterEmpty';
import { filterUnmergedCommits } from '../../../../utils/filterUnmergedCommits';
import { BackportError } from '../../../BackportError';
import { swallowMissingConfigFileException } from '../../../remoteConfig';
import {
  Commit,
  parseSourceCommit,
} from '../../../sourceCommit/parseSourceCommit';
import { getV4Client } from '../apiRequestV4';

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

  let data: PullRequestBySearchQueryQuery;
  try {
    const client = getV4Client({ githubApiBaseUrlV4, accessToken });
    const res = await client.PullRequestBySearchQuery({
      query: searchQuery,
      maxNumber,
    });
    data = res.data;
  } catch (e) {
    data = swallowMissingConfigFileException<PullRequestBySearchQueryQuery>(e);
  }

  const commits = (data.search.nodes ?? [])
    .map((pullRequestNode) => {
      if (
        pullRequestNode?.__typename !== 'PullRequest' ||
        !pullRequestNode.mergeCommit
      ) {
        return;
      }

      const sourceCommit = pullRequestNode.mergeCommit;
      return parseSourceCommit({ options, sourceCommit });
    })
    .filter(filterNil);

  // terminate if not commits were found
  if (isEmpty(commits)) {
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
