import Axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';
import { HandledError } from '../../HandledError';
import { logger, logLevel } from '../../logger';

// Docs: https://developer.github.com/v3/#client-errors
export type GithubV3Error = AxiosError<{
  message: string;
  errors?: Array<{
    resource: string;
    code: string;
    field: string;
    message?: string;
  }>;
  documentation_url: string;
}>;

export async function apiRequestV3<T>(config: AxiosRequestConfig) {
  try {
    const response = await Axios.request<T>(config);
    logger.info(
      `Request (Github v3): ${config.method?.toUpperCase()} ${config.url}`
    );
    logger.debug('Response headers (Github v3):', response.headers);
    logger.debug('Response data (Github v3):', response.data);

    return response.data;
  } catch (e) {
    logger.info(
      `Request (Github v3): ${config.method?.toUpperCase()} ${config.url}`
    );
    logger.info('Response headers (Github v3):', e.response?.headers);
    logger.info('Response data (Github v3):', e.response?.data);

    throw handleGithubV3Error(e);
  }
}

export function handleGithubV3Error(e: GithubV3Error) {
  if (!e.response?.data) {
    return e;
  }

  const errorMessages = e.response.data.errors?.map((error) => error.message);
  if (errorMessages) {
    return new HandledError(
      `${e.response.data.message}: ${errorMessages.join(', ')} (Github v3)`
    );
  }

  if (e.response.data.message) {
    return new HandledError(`${e.response.data.message} (Github v3)`);
  }

  return new HandledError(
    `Unexpected response from Github API (v3):\n${JSON.stringify(
      e.response.data,
      null,
      2
    )}`
  );
}
