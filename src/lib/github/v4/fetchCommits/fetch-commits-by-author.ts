import { isEmpty, first, uniqBy, orderBy } from 'lodash-es';
import { graphql } from '../../../../graphql/generated/index.js';
import type { ValidConfigOptions } from '../../../../options/options.js';
import { filterNil } from '../../../../utils/filter-empty.js';
import { filterUnmergedCommits } from '../../../../utils/filter-unmerged-commits.js';
import { BackportError } from '../../../backport-error.js';
import { isMissingConfigFileException } from '../../../remote-config.js';
import type { Commit } from '../../../sourceCommit/parse-source-commit.js';
import { parseSourceCommit } from '../../../sourceCommit/parse-source-commit.js';
import { graphqlRequest } from '../client/graphql-client.js';
import { fetchAuthorId } from '../fetch-author-id.js';

async function fetchByCommitPath({
  options,
  authorId,
  commitPath,
}: {
  options: {
    accessToken: string;
    dateSince: string | null;
    dateUntil: string | null;
    githubApiBaseUrlV4?: string;
    maxNumber?: number;
    repoName: string;
    repoOwner: string;
    sourceBranch: string;
  };
  authorId: string | null | undefined;
  commitPath: string | null;
}) {
  const {
    accessToken,
    dateSince,
    dateUntil,
    githubApiBaseUrlV4 = 'https://api.github.com/graphql',
    maxNumber = 10,
    repoName,
    repoOwner,
    sourceBranch,
  } = options;

  const query = graphql(`
    query CommitsByAuthor(
      $authorId: ID
      $commitPath: String
      $dateSince: GitTimestamp
      $dateUntil: GitTimestamp
      $maxNumber: Int!
      $repoName: String!
      $repoOwner: String!
      $sourceBranch: String!
    ) {
      repository(owner: $repoOwner, name: $repoName) {
        ref(qualifiedName: $sourceBranch) {
          target {
            ... on Commit {
              __typename
              history(
                first: $maxNumber
                author: { id: $authorId }
                path: $commitPath
                since: $dateSince
                until: $dateUntil
              ) {
                edges {
                  node {
                    __typename
                    ...SourceCommitWithTargetPullRequestFragment
                  }
                }
              }
            }
          }
        }
      }
    }
  `);

  const variables = {
    repoOwner,
    repoName,
    sourceBranch,
    maxNumber,
    authorId,
    commitPath,
    dateSince,
    dateUntil,
  };

  const result = await graphqlRequest(
    { accessToken, githubApiBaseUrlV4 },
    query,
    variables,
  );

  if (result.error) {
    if (result.statusCode === 502 && maxNumber > 50) {
      throw new BackportError({
        code: 'github-api-exception',
        message: `The GitHub API returned a 502 error. Try reducing the number of commits to display: "--max-number 20"`,
      });
    }

    if (!isMissingConfigFileException(result)) {
      throw new BackportError({
        code: 'github-api-exception',
        message: result.error.message,
      });
    }
  }

  return result.data;
}

export async function fetchCommitsByAuthor(options: {
  accessToken: string;
  author: string | null;
  branchLabelMapping?: ValidConfigOptions['branchLabelMapping'];
  commitPaths?: string[];
  dateSince: string | null;
  dateUntil: string | null;
  githubApiBaseUrlV4?: string;
  maxNumber?: number;
  onlyMissing?: boolean;
  repoName: string;
  repoOwner: string;
  sourceBranch: string;
}): Promise<Commit[]> {
  const { sourceBranch, commitPaths = [] } = options;

  const authorId = await fetchAuthorId(options);
  const allResponses = await Promise.all(
    isEmpty(commitPaths)
      ? [fetchByCommitPath({ options, authorId, commitPath: null })]
      : commitPaths.map((commitPath) =>
          fetchByCommitPath({ options, authorId, commitPath }),
        ),
  );
  const responses = allResponses.filter(filterNil);

  // we only need to check if the first item is `null` (if the first is `null` they all are)
  if (first(responses)?.repository?.ref === null) {
    throw new BackportError({
      code: 'branch-not-found-exception',
      branchName: sourceBranch,
    });
  }

  const commits = responses
    .flatMap((res) => {
      const repoRefTarget = res.repository?.ref?.target;
      if (repoRefTarget?.__typename !== 'Commit') {
        return;
      }

      return repoRefTarget.history.edges?.map((edge) => {
        const sourceCommit = edge?.node;
        if (sourceCommit) {
          return parseSourceCommit({ options, sourceCommit });
        }
      });
    })
    .filter(filterNil);

  // terminate if not commits were found
  if (isEmpty(commits)) {
    const pathText =
      commitPaths.length > 0 ? ` touching files in path: "${commitPaths}"` : '';

    const errorText = options.author
      ? `There are no commits by "${options.author}" in this repository${pathText}. Try with \`--all\` for commits by all users or \`--author=<username>\` for commits from a specific user`
      : `There are no commits in this repository${pathText}`;

    throw new BackportError({
      code: 'no-commits-found-exception',
      message: errorText,
    });
  }

  const commitsUnique = uniqBy(commits, (c) => c.sourceCommit.sha);
  const commitsSorted = orderBy(
    commitsUnique,
    (c) => c.sourceCommit.committedDate,
    'desc',
  );

  if (options.onlyMissing) {
    return commitsSorted.filter(filterUnmergedCommits);
  }

  return commitsSorted;
}
