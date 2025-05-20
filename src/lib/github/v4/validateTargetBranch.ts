import { graphql } from '../../../graphql/generated';
import { BackportError } from '../../BackportError';
import { ora } from '../../ora';
import { GithubV4Exception, getGraphQLClient } from './client/graphqlClient';

export interface TargetBranchResponse {
  repository: { ref: { id: string } | null };
}

export async function validateTargetBranch({
  accessToken,
  repoName,
  repoOwner,
  branchName,
  githubApiBaseUrlV4 = 'https://api.github.com/graphql',
  interactive,
}: {
  accessToken: string;
  repoOwner: string;
  repoName: string;
  branchName: string;
  githubApiBaseUrlV4?: string;
  interactive: boolean;
}) {
  const query = graphql(`
    query GetBranchId(
      $repoOwner: String!
      $repoName: String!
      $branchName: String!
    ) {
      repository(owner: $repoOwner, name: $repoName) {
        ref(qualifiedName: $branchName) {
          id
        }
      }
    }
  `);

  const spinner = ora(interactive, '').start();
  const variables = { repoOwner, repoName, branchName };
  const client = getGraphQLClient({ accessToken, githubApiBaseUrlV4 });
  const result = await client.query(query, variables);

  if (result.error) {
    throw new GithubV4Exception(result);
  }

  if (!result.data?.repository?.ref) {
    spinner.fail(`The branch "${branchName}" does not exist`);
    throw new BackportError({
      code: 'invalid-branch-exception',
      branchName: branchName,
    });
  }

  spinner.stop();

  return;
}
