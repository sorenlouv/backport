import { fetchExchange, Client, OperationResult } from '@urql/core';
import type { ValidConfigOptions } from '../../../../options/options';
import { responseMetaInterceptorExchange } from '../client/headerInteceptorExchange';

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
  result: OperationResultWithMeta<T>;

  constructor(result: OperationResultWithMeta<T>, contextMessage?: string) {
    const githubMessages =
      result.error?.graphQLErrors.map((e) => e.message).join(', ') ||
      result.error?.message;

    const message = `${contextMessage ?? githubMessages} (Github API v4)`;

    super(message);
    Error.captureStackTrace(this, GithubV4Exception);
    this.name = 'GithubV4Exception';
    this.result = result;
  }
}
