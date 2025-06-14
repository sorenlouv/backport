import { URL } from 'url';
import { disableFragmentWarnings } from 'graphql-tag';
import nock from 'nock';

disableFragmentWarnings();

// Interface for the typical GraphQL request payload Urql sends
interface GraphQLRequestBody<TVariables = Record<string, any>> {
  query: string;
  variables?: TVariables;
  operationName?: string;
}

// Interface for the expected structure of captured calls
export interface CapturedCall<TVariables = Record<string, any>> {
  query: string;
  variables?: TVariables;
  operationName?: string;
}

export function mockUrqlRequest<TData = any, TVariables = Record<string, any>>({
  operationName,
  statusCode = 200,
  body,
  headers,
  apiBaseUrl = 'http://localhost/graphql',
}: {
  operationName: string;
  statusCode?: number;
  body?: { data: TData } | { errors: ReadonlyArray<any> };
  headers?: nock.ReplyHeaders;
  apiBaseUrl?: string;
}) {
  const { origin, pathname } = new URL(apiBaseUrl);

  const scope = nock(origin)
    .post(
      pathname,
      (requestBody: GraphQLRequestBody<TVariables>) =>
        requestBody.operationName === operationName,
    )
    .reply(statusCode, body, headers);

  return listenForCallsToNockScope<TVariables>(scope);
}

export function listenForCallsToNockScope<TVariables>(
  scope: nock.Scope,
): CapturedCall<TVariables>[] {
  const calls: CapturedCall<TVariables>[] = [];
  scope.on('request', (req, interceptor, bodyString) => {
    try {
      calls.push(JSON.parse(bodyString));
    } catch (e) {
      console.error('Failed to parse nock request body:', bodyString, e);
      // Push raw body if parsing fails, or handle as appropriate
      calls.push(bodyString as any);
    }
  });

  return calls;
}
