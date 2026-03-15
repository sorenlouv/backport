import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { GraphQLError, print, Kind } from 'graphql';
import pRetry from 'p-retry';
import { logger } from '../../../logger.js';

export interface GitHubGraphQLError extends GraphQLError {
  type?: 'FORBIDDEN';
  extensions: { saml_failure?: boolean };
  originalError:
    | ({
        type?: 'NOT_FOUND';
      } & GraphQLError['originalError'])
    | undefined;
}

export interface OperationResultWithMeta<Data = any> {
  data: Data | undefined;
  error: { message: string; graphQLErrors: GraphQLError[] } | undefined;
  responseHeaders: Headers | undefined;
  statusCode: number | undefined;
}

export async function graphqlRequest<TData, TVars>(
  {
    githubApiBaseUrlV4 = 'https://api.github.com/graphql',
    accessToken,
  }: {
    githubApiBaseUrlV4?: string;
    accessToken: string;
  },
  document: TypedDocumentNode<TData, TVars>,
  variables: TVars,
): Promise<OperationResultWithMeta<TData>> {
  const query = print(document);
  const opDef = document.definitions.find(
    (d) => d.kind === Kind.OPERATION_DEFINITION,
  );
  const operationName =
    opDef?.kind === Kind.OPERATION_DEFINITION ? opDef.name?.value : undefined;

  logger.verbose('Query:', query);
  logger.verbose('Variables:', variables);

  const response = await pRetry(
    async () => {
      const res = await fetch(githubApiBaseUrlV4, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `bearer ${accessToken}`,
        },
        body: JSON.stringify({ query, variables, operationName }),
      });

      // Retry on transient server errors and rate limiting
      if (res.status >= 500 || res.status === 429) {
        throw new Error(
          `GitHub GraphQL API returned ${res.status} ${res.statusText}`,
        );
      }

      return res;
    },
    {
      retries: 2,
      minTimeout: 1000,
      onFailedAttempt: ({ error, attemptNumber, retriesLeft }) => {
        logger.info(
          `GraphQL request failed (attempt ${attemptNumber}/${attemptNumber + retriesLeft}): ${error.message}`,
        );
      },
    },
  );

  const responseHeaders = response.headers;
  const statusCode = response.status;

  let json: { data?: TData; errors?: any[] };
  try {
    json = await response.json();
  } catch {
    // Non-JSON response (e.g. 502 Bad Gateway HTML page)
    const error = {
      message: `[Network] ${response.statusText}`,
      graphQLErrors: [] as GraphQLError[],
    };
    logger.error('GraphQL Error:', error.message);
    return { data: undefined, error, responseHeaders, statusCode };
  }

  if (!response.ok && !json.errors) {
    const error = {
      message: `[Network] ${response.statusText}`,
      graphQLErrors: [] as GraphQLError[],
    };
    logger.error('GraphQL Error:', error.message);
    return { data: json.data, error, responseHeaders, statusCode };
  }

  if (json.errors?.length) {
    const graphQLErrors = json.errors.map((e) => {
      const err = new GraphQLError(e.message, {
        path: e.path,
        extensions: e.extensions,
      });
      // Wrap the raw API error as originalError to preserve GitHub-specific
      // properties (e.g. type: "NOT_FOUND") that consumers access via
      // error.originalError?.type
      (err as any).originalError = e;
      return err;
    });
    const error = {
      message: `[GraphQL] ${json.errors[0].message}`,
      graphQLErrors,
    };
    logger.error('GraphQL Error:', error.message);
    return { data: json.data, error, responseHeaders, statusCode };
  }

  logger.verbose('Data:', json.data);
  return { data: json.data, error: undefined, responseHeaders, statusCode };
}

export class GithubV4Exception<T> extends Error {
  constructor(public result: OperationResultWithMeta<T>) {
    const message = `${result.error?.message} (Github API v4)`;

    super(message);
    Error.captureStackTrace(this, GithubV4Exception);
    this.name = 'GithubV4Exception';
  }
}
