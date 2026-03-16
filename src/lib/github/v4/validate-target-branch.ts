import { graphql } from '../../../graphql/generated/index.js';
import { BackportError } from '../../backport-error.js';
import { ora } from '../../ora.js';
import { graphqlRequest } from './client/graphql-client.js';

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
  const result = await graphqlRequest(
    { accessToken, githubApiBaseUrlV4 },
    query,
    variables,
  );

  if (result.error) {
    throw new BackportError({
      code: 'github-api-exception',
      message: result.error.message,
    });
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
