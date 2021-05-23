import { URL } from 'url';
import gql from 'graphql-tag';
import nock from 'nock';

export function mockGqlRequest<T>({
  name,
  statusCode,
  body,
  headers,
  apiBaseUrl,
}: {
  name: string;
  statusCode: number;
  body?: { data: T } | { errors: any[] };
  headers?: any;
  apiBaseUrl?: string;
}) {
  const { origin, pathname } = new URL(
    // default to localhost as host to avoid CORS issues
    apiBaseUrl ?? 'http://localhost/graphql'
  );

  const scope = nock(origin)
    .post(pathname, (body) => getGqlName(body.query) === name)
    .reply(statusCode, body, headers);

  return createNockListener<{ query: string; variables: string }>(scope);
}

function getGqlName(query: string) {
  const obj = gql`
    ${query}
  `;

  // @ts-expect-error
  return obj.definitions[0].name.value;
}

// will register all calls to the nock scope
export function createNockListener<T>(scope: nock.Scope) {
  const calls: T[] = [];
  scope.on('request', (req, interceptor, body) => {
    calls.push(JSON.parse(body));
  });
  return () => {
    return calls;
  };
}
