import axios from 'axios';
import { logger, logLevel } from '../../logger';
import { AxiosError } from 'axios';
import { HandledError } from '../../HandledError';

export interface GithubV4Response<DataResponse> {
  data: DataResponse;
  errors?: {
    type: string;
    path: string[];
    locations: {
      line: number;
      column: number;
    }[];
    message: string;
  }[];
}

export async function apiRequestV4<DataResponse>({
  githubApiBaseUrlV4,
  accessToken,
  query,
  variables,
  handleError = true,
}: {
  githubApiBaseUrlV4: string;
  accessToken: string;
  query: string;
  variables?: {
    [key: string]: string | number | null;
  };
  handleError?: boolean;
}) {
  logger.debug('Query (Github v4):', query);
  logger.debug('Variables (Github v4):', variables);

  try {
    const response = await axios.post<GithubV4Response<DataResponse>>(
      githubApiBaseUrlV4,
      { query, variables },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `bearer ${accessToken}`,
        },
      }
    );

    if (response.data.errors) {
      const newError = new Error();
      //@ts-ignore
      newError.response = response;
      throw newError;
    }

    logger.debug('Response headers (Github v4):', response.headers);
    logger.debug('Response data (Github v4)', response.data);

    return response.data.data;
  } catch (e) {
    if (logLevel !== 'debug') {
      logger.info('Query (Github v4):', query);
      logger.info('Variables (Github v4):', variables);
    }

    logger.info('Response headers (Github v4):', e.response?.headers);
    logger.info('Response data (Github v4)', e.response?.data);

    if (handleError) {
      throw handleGithubV4Error(e);
    }
    throw e;
  }
}

export function handleGithubV4Error(e: AxiosError<GithubV4Response<null>>) {
  // not github api error
  if (!e.response?.data) {
    return e;
  }

  const errorMessages = e.response.data.errors?.map((error) => error.message);
  if (errorMessages) {
    return new HandledError(`${errorMessages.join(', ')} (Github v4)`);
  }

  return new HandledError(
    `Unexpected response from Github API (v4):\n${JSON.stringify(
      e.response.data,
      null,
      2
    )}`
  );
}
