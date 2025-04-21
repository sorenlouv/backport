import { BackportError } from '../../BackportError';
import { ora } from '../../ora';
import { getV4Client } from './apiRequestV4';

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
  const spinner = ora(interactive, '').start();

  const client = getV4Client({ githubApiBaseUrlV4, accessToken });
  const res = await client.GetBranchId({ repoOwner, repoName, branchName });

  if (!res.data.repository?.ref) {
    spinner.fail(`The branch "${branchName}" does not exist`);
    throw new BackportError({
      code: 'invalid-branch-exception',
      branchName: branchName,
    });
  }

  spinner.stop();

  return;
}
