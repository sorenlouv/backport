import { CommitsByShaQuery } from '../../../../graphql/generated';
import { ValidConfigOptions } from '../../../../options/options';
import { BackportError } from '../../../BackportError';
import { swallowMissingConfigFileException } from '../../../remoteConfig';
import {
  Commit,
  parseSourceCommit,
} from '../../../sourceCommit/parseSourceCommit';
import { getV4Client } from '../apiRequestV4';

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

  let data: CommitsByShaQuery;
  try {
    const client = getV4Client({ githubApiBaseUrlV4, accessToken });
    const res = await client.CommitsBySha({ repoOwner, repoName, sha });

    data = res.data;
  } catch (e) {
    data = swallowMissingConfigFileException<CommitsByShaQuery>(e);
  }

  const sourceCommit = data.repository?.object;
  if (!sourceCommit || sourceCommit.__typename !== 'Commit') {
    throw new BackportError(
      `No commit found on branch "${sourceBranch}" with sha "${sha}"`,
    );
  }

  return parseSourceCommit({ options, sourceCommit });
}
