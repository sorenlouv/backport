import gql from 'graphql-tag';
import { BackportError } from '../../BackportError';
import { apiRequestV4 } from './apiRequestV4';

export interface TargetBranchResponse {
  repository: { ref: { id: string } | null };
}

async function fetchTargetBranch({
  accessToken,
  repoName,
  repoOwner,
  branchName,
  githubApiBaseUrlV4 = 'https://api.github.com/graphql',
}: {
  accessToken: string;
  repoOwner: string;
  repoName: string;
  branchName: string;
  githubApiBaseUrlV4?: string;
}) {
  const query = gql`
    query doesBranchExist(
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
  `;

  const res = await apiRequestV4<TargetBranchResponse>({
    githubApiBaseUrlV4,
    accessToken,
    query,
    variables: { repoOwner, repoName, branchName },
  });

  if (!res.repository.ref) {
    throw new BackportError(`The branch "${branchName}" does not exist`);
  }

  return res.repository.ref;
}

export async function validateTargetBranches({
  accessToken,
  repoName,
  repoOwner,
  targetBranches = [],
  githubApiBaseUrlV4,
}: {
  accessToken: string;
  repoOwner: string;
  repoName: string;
  targetBranches?: string[];
  githubApiBaseUrlV4?: string;
}) {
  await Promise.all(
    targetBranches.map((targetBranch) => {
      return fetchTargetBranch({
        accessToken,
        repoName,
        repoOwner,
        branchName: targetBranch,
        githubApiBaseUrlV4,
      });
    })
  );
}
