import { graphql } from '../../../../graphql/generated/index.js';
import type { ValidConfigOptions } from '../../../../options/options.js';
import { BackportError } from '../../../backport-error.js';
import { isMissingConfigFileException } from '../../../remote-config.js';
import type { Commit } from '../../../sourceCommit/parse-source-commit.js';
import { parseSourceCommit } from '../../../sourceCommit/parse-source-commit.js';
import { graphqlRequest } from '../client/graphql-client.js';

export async function fetchCommitBySha(options: {
  githubToken: string;
  branchLabelMapping?: ValidConfigOptions['branchLabelMapping'];
  githubApiBaseUrlV4?: string;
  repoName: string;
  repoOwner: string;
  sha: string;
  sourceBranch: string;
}): Promise<Commit> {
  const {
    githubToken,
    githubApiBaseUrlV4 = 'https://api.github.com/graphql',
    repoName,
    repoOwner,
    sha,
    sourceBranch,
  } = options;

  const query = graphql(`
    query CommitsBySha($repoOwner: String!, $repoName: String!, $sha: String!) {
      repository(owner: $repoOwner, name: $repoName) {
        object(expression: $sha) {
          __typename
          ...SourceCommitWithTargetPullRequestFragment
        }
      }
    }
  `);

  const variables = { repoOwner, repoName, sha };
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

  const sourceCommit = data?.repository?.object;
  if (sourceCommit?.__typename !== 'Commit') {
    throw new BackportError({
      code: 'commit-not-found-exception',
      sha,
      sourceBranch,
    });
  }

  return parseSourceCommit({ options, sourceCommit });
}
