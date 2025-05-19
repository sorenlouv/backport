import { graphql } from '../graphql/generated';
import { parseConfigFile } from '../options/config/readConfigFile';
import { GithubV4Exception } from './github/v4/fetchCommits/graphqlClient';
import { logger } from './logger';

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

export function parseRemoteConfigFile(remoteConfig: any) {
  try {
    return parseConfigFile(remoteConfig.file.object.text);
  } catch (e) {
    logger.info('Parsing remote config failed', e);
    return;
  }
}

export function swallowMissingConfigFileException<T>(
  error: GithubV4Exception<T> | unknown,
) {
  if (!(error instanceof GithubV4Exception)) {
    throw error;
  }

  const data = error.result.data;
  const errors = error.result.error?.graphQLErrors;

  const missingConfigError = errors?.some((error) => {
    return (
      error.path?.includes('remoteConfig') &&
      // @ts-expect-error
      error.originalError?.type === 'NOT_FOUND'
    );
  });

  // swallow error if it's just the config file that's missing
  if (missingConfigError && data != null) {
    return data as T;
  }

  // Throw unexpected error
  throw error;
}
