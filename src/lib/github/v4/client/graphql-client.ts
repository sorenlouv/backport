import type { GraphQLError } from '@0no-co/graphql.web';
import type { OperationResult } from '@urql/core';
import { fetchExchange, Client } from '@urql/core';
import type { ValidConfigOptions } from '../../../../options/options';
import { responseMetaInterceptorExchange } from './response-meta-interceptor-exchange';

export interface GitHubGraphQLError extends GraphQLError {
  type?: 'FORBIDDEN';
  extensions: { saml_failure?: boolean };
  originalError:
    | ({
        type?: 'NOT_FOUND';
      } & GraphQLError['originalError'])
    | undefined;
}

export interface OperationResultWithMeta<Data = any>
  extends OperationResult<Data> {
  responseHeaders?: Headers;
  statusCode?: number;
}

export function getGraphQLClient({
  githubApiBaseUrlV4 = 'https://api.github.com/graphql',
  accessToken,
}: Pick<ValidConfigOptions, 'githubApiBaseUrlV4' | 'accessToken'>): Client {
  return new Client({
    url: githubApiBaseUrlV4,
    exchanges: [responseMetaInterceptorExchange, fetchExchange],
    fetchOptions: () => {
      return {
        'Content-Type': 'application/json',
        headers: { Authorization: `bearer ${accessToken}` },
      };
    },
  });
}

export class GithubV4Exception<T> extends Error {
  constructor(public result: OperationResultWithMeta<T>) {
    const message = `${result.error?.message} (Github API v4)`;

    super(message);
    Error.captureStackTrace(this, GithubV4Exception);
    this.name = 'GithubV4Exception';
  }
}
