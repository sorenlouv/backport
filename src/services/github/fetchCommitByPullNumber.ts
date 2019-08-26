import { BackportOptions } from '../../options/options';
import { HandledError } from '../HandledError';
import { CommitSelected } from './Commit';
import { getFirstCommitMessageLine } from './commitFormatters';
import { gqlRequest } from './gqlRequest';

export async function fetchCommitByPullNumber(
  options: BackportOptions & { pullNumber: number }
): Promise<CommitSelected> {
  const { apiHostname, repoName, repoOwner, pullNumber, accessToken } = options;
  const query = /* GraphQL */ `
    query getCommitbyPullNumber(
      $repoOwner: String!
      $repoName: String!
      $pullNumber: Int!
    ) {
      repository(owner: $repoOwner, name: $repoName) {
        pullRequest(number: $pullNumber) {
          baseRef {
            name
          }
          mergeCommit {
            oid
            message
          }
        }
      }
    }
  `;

  const res = await gqlRequest<DataResponse>({
    apiHostname,
    accessToken,
    query,
    variables: {
      repoOwner,
      repoName,
      pullNumber
    }
  });

  const baseRef = res.repository.pullRequest.baseRef.name;
  if (baseRef !== 'master') {
    throw new HandledError(
      `The pull request #${pullNumber} was merged into ${baseRef}. Only commits in master can be backported`
    );
  }

  return {
    sha: res.repository.pullRequest.mergeCommit.oid,
    message: getFirstCommitMessageLine(
      res.repository.pullRequest.mergeCommit.message
    ),
    pullNumber
  };
}

interface DataResponse {
  repository: {
    pullRequest: {
      baseRef: {
        name: string;
      };
      mergeCommit: {
        oid: string;
        message: string;
      };
    };
  };
}
