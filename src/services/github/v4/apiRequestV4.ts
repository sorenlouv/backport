import axios, { AxiosResponse } from 'axios';
import { HandledError } from '../../HandledError';
import { logger } from '../../logger';

export interface GithubError {
  type: string;
  path: string[];
  locations: {
    line: number;
    column: number;
  }[];
  message: string;
}

export interface GithubV4Response<DataResponse> {
  data: DataResponse;
  errors?: GithubError[];
}

export async function apiRequestV4<DataResponse>({
  githubApiBaseUrlV4 = 'https://api.github.com/graphql',
  accessToken,
  query,
  variables,
}: {
  githubApiBaseUrlV4?: string;
  accessToken: string;
  query: string;
  variables?: {
    [key: string]: string | number | null;
  };
}) {
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
      throw new GithubV4Exception(response);
    }

    logger.info(`POST ${githubApiBaseUrlV4} (status: ${response.status})`);
    logger.verbose('Query:', query);
    logger.verbose('Variables:', variables);
    logger.verbose('Response headers:', response.headers);
    logger.verbose('Response data:', response.data);

    return response.data.data;
  } catch (e) {
    logger.info(`POST ${githubApiBaseUrlV4} (status: ${e.response?.status})`);
    logger.info('Query:', query);
    logger.info('Variables:', variables);
    logger.verbose('Response headers:', e.response?.headers);
    logger.info('Response data:', e.response?.data);

    if (e.response.data) {
      throw new HandledError(
        `Unexpected response (Github API v4):\n${JSON.stringify(
          e.response.data,
          null,
          2
        )}`
      );
    }

    throw e;
  }
}

type Response<DataResponse> = AxiosResponse<
  GithubV4Response<DataResponse | null>,
  any
>;
export class GithubV4Exception<DataResponse> extends Error {
  response: Response<DataResponse>;

  constructor(response: Response<DataResponse>) {
    const message = `${response.data.errors
      ?.map((error) => error.message)
      .join(',')} (Github API v4)`;

    super(message);
    Error.captureStackTrace(this, HandledError);
    this.name = 'GithubV4Exception';
    this.response = response;
  }
}
