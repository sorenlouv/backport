import { isEmpty, uniqBy, orderBy, first } from 'lodash';
import { graphql } from '../../../../graphql/generated';
import { CommitsByAuthorQuery } from '../../../../graphql/generated/graphql';
import { ValidConfigOptions } from '../../../../options/options';
import { filterNil } from '../../../../utils/filterEmpty';
import { filterUnmergedCommits } from '../../../../utils/filterUnmergedCommits';
import { BackportError } from '../../../BackportError';
import { swallowMissingConfigFileException } from '../../../remoteConfig';
import {
  Commit,
  parseSourceCommit,
} from '../../../sourceCommit/parseSourceCommit';
import { fetchAuthorId } from '../fetchAuthorId';
import { getGraphQLClient, GithubV4Exception } from './graphqlClient';

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

  try {
    const client = getGraphQLClient({ accessToken, githubApiBaseUrlV4 });
    const result = await client.query(query, variables);

    if (result.error) {
      throw new GithubV4Exception(result);
    }

    return result.data;
  } catch (e) {
    if (e instanceof GithubV4Exception) {
      if (e.result.statusCode === 502 && maxNumber > 50) {
        throw new BackportError(
          `The GitHub API returned a 502 error. Try reducing the number of commits to display: "--max-number 20"`,
        );
      }
    }
    return swallowMissingConfigFileException<CommitsByAuthorQuery>(e);
  }
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
  const responses = (
    await Promise.all(
      isEmpty(commitPaths)
        ? [fetchByCommitPath({ options, authorId, commitPath: null })]
        : commitPaths.map((commitPath) =>
            fetchByCommitPath({ options, authorId, commitPath }),
          ),
    )
  ).filter(filterNil);

  // we only need to check if the first item is `null` (if the first is `null` they all are)
  if (first(responses)?.repository?.ref === null) {
    throw new BackportError(
      `The upstream branch "${sourceBranch}" does not exist. Try specifying a different branch with "--source-branch <your-branch>"`,
    );
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

    throw new BackportError(errorText);
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
