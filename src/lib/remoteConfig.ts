import { RemoteConfigHistoryFragmentFragment } from '../graphql/generated';
import { parseConfigFile } from '../options/config/readConfigFile';
import { GithubV4Exception } from './github/v4/apiRequestV4';
import { logger } from './logger';

export function parseRemoteConfigFile(
  remoteConfig: NonNullable<
    NonNullable<
      RemoteConfigHistoryFragmentFragment['remoteConfigHistory']['edges']
    >[number]
  >['remoteConfig'],
) {
  if (remoteConfig?.file?.object?.__typename !== 'Blob') {
    logger.warn('Remote config: Skipping. Object is not a blob');
    return;
  }

  const value = remoteConfig.file.object.text;
  if (!value) {
    logger.warn('Remote config: Skipping. No value');
    return;
  }

  try {
    return parseConfigFile(value);
  } catch (e) {
    logger.info('Parsing remote config failed', e);
    return;
  }
}

export function swallowMissingConfigFileException<T>(
  error: GithubV4Exception | unknown,
) {
  if (!(error instanceof GithubV4Exception)) {
    throw error;
  }

  const missingConfigError = error.response.errors?.some((error) => {
    return (
      error.path?.includes('remoteConfig') &&
      error.extensions.type === 'NOT_FOUND'
    );
  });

  // swallow error if it's just the config file that's missing
  if (missingConfigError && error.response.data != null) {
    return error.response.data as T;
  }

  // Throw unexpected error
  throw error;
}
