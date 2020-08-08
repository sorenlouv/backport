import gql from 'graphql-tag';
import nock from 'nock';

export function mockGqlRequest({
  name,
  statusCode,
  body,
  headers,
}: {
  name: string;
  statusCode: number;
  body?: any;
  headers?: any;
}) {
  // use localhost as host to avoid CORS issues
  const scope = nock('http://localhost')
    .post('/graphql', (body) => getGqlName(body.query) === name)
    .reply(statusCode, { data: body }, headers);

  return getNockCallsForScope(scope) as { query: string; variables: string }[];
}

function getGqlName(query: string) {
  const obj = gql`
    ${query}
  `;

  // @ts-expect-error
  return obj.definitions[0].name.value;
}

export function getNockCallsForScope(scope: nock.Scope) {
  const calls: unknown[] = [];
  scope.on('request', (req, interceptor, body) => {
    calls.push(JSON.parse(body));
  });
  return calls;
}
