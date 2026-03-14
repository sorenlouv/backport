import { graphql } from '../graphql/generated/index.js';
import type { RemoteConfigHistoryFragmentFragment } from '../graphql/generated/graphql.js';
import { parseConfigFile } from '../options/config/read-config-file.js';
import type {
  GitHubGraphQLError,
  OperationResultWithMeta,
} from './github/v4/client/graphql-client.js';
import { logger } from './logger.js';

type RemoteConfigNode = NonNullable<
  NonNullable<
    RemoteConfigHistoryFragmentFragment['remoteConfigHistory']['edges']
  >[number]
>['remoteConfig'];

export const RemoteConfigHistoryFragment = graphql(`
  fragment RemoteConfigHistoryFragment on Commit {
    remoteConfigHistory: history(first: 1, path: ".backportrc.json") {
      edges {
        remoteConfig: node {
          committedDate
          file(path: ".backportrc.json") {
            ... on TreeEntry {
              __typename
              object {
                ... on Blob {
                  __typename
                  text
                }
              }
            }
          }
        }
      }
    }
  }
`);

export function parseRemoteConfigFile(remoteConfig: RemoteConfigNode) {
  try {
    const text =
      remoteConfig?.file?.object?.__typename === 'Blob'
        ? remoteConfig.file.object.text
        : undefined;
    if (!text) return;
    return parseConfigFile(text);
  } catch (e) {
    logger.info('Parsing remote config failed', e);
    return;
  }
}

export function isMissingConfigFileException(
  result: OperationResultWithMeta<unknown>,
): boolean {
  const data = result.data;
  const errors = (result.error?.graphQLErrors ?? []) as GitHubGraphQLError[];

  const isMissingConfigError = errors.some((error) => {
    return (
      error.path?.includes('remoteConfig') &&
      error.originalError?.type === 'NOT_FOUND'
    );
  });

  const isMissingConfigFileException = isMissingConfigError && data != null;
  return isMissingConfigFileException;
}
