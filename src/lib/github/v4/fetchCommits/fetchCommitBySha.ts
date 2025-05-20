import { graphql } from '../../../../graphql/generated';
import { ValidConfigOptions } from '../../../../options/options';
import { BackportError } from '../../../BackportError';
import { isMissingConfigFileException } from '../../../remoteConfig';
import {
  Commit,
  parseSourceCommit,
} from '../../../sourceCommit/parseSourceCommit';
import { GithubV4Exception, getGraphQLClient } from '../client/graphqlClient';

export async function fetchCommitBySha(options: {
  accessToken: string;
  branchLabelMapping?: ValidConfigOptions['branchLabelMapping'];
  githubApiBaseUrlV4?: string;
  repoName: string;
  repoOwner: string;
  sha: string;
  sourceBranch: string;
}): Promise<Commit> {
  const {
    accessToken,
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
  const client = getGraphQLClient({ accessToken, githubApiBaseUrlV4 });
  const result = await client.query(query, variables);

  if (result.error && !isMissingConfigFileException(result)) {
    throw new GithubV4Exception(result);
  }

  const { data } = result;

  const sourceCommit = data?.repository?.object;
  if (sourceCommit?.__typename !== 'Commit') {
    throw new BackportError(
      `No commit found on branch "${sourceBranch}" with sha "${sha}"`,
    );
  }

  return parseSourceCommit({ options, sourceCommit });
}
