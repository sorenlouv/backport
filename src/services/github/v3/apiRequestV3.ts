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
    logRequest({ config, response, level: 'debug' });
    return response.data;
  } catch (e) {
    logRequest({ config, response: e.response, level: 'info' });
    throw handleGithubV3Error(e);
  }
}

function logRequest<T>({
  config,
  response,
  level,
}: {
  config: AxiosRequestConfig;
  response?: AxiosResponse<T>;
  level: typeof logLevel;
}) {
  logger[level](
    `Request (Github v3): ${config.method?.toUpperCase()} ${config.url}`
  );
  logger[level]('Response headers (Github v3):', response?.headers);
  logger[level]('Response data (Github v3):', response?.data);
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
