import { HandledError } from '../../HandledError';
import { logger } from '../../logger';
import { AxiosError } from 'axios';

// Docs: https://developer.github.com/v3/#client-errors
type GithubV3Error = AxiosError<{
  message: string;
  errors?: Array<{
    resource: string;
    code: string;
    field: string;
    message?: string;
  }>;
  documentation_url: string;
}>;

export function handleGithubV3Error(e: GithubV3Error) {
  logger.info('Response headers (Github v3):', e.response?.headers);
  logger.info('Response data (Github v3):', e.response?.data);

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
