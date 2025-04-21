import { DocumentNode } from 'graphql';
import { GraphQLClient, ClientError } from 'graphql-request';
import { getSdk } from '../../../graphql/generated';

export function getV4Client({
  githubApiBaseUrlV4,
  accessToken,
}: {
  githubApiBaseUrlV4?: string;
  accessToken: string;
}) {
  const client = new GraphQLClient(
    githubApiBaseUrlV4 ?? 'https://api.github.com/graphql',
    { headers: { Authorization: `bearer ${accessToken}` } },
  );
  return getSdk(client, async (action, operationName) => {
    try {
      return await action();
    } catch (err: unknown) {
      if (err instanceof ClientError) {
        throw new GithubV4Exception(err, `Error in ${operationName}`);
      }
      throw err;
    }
  });
}

export class GithubV4Exception extends Error {
  public readonly response: ClientError['response'];

  constructor(err: ClientError, contextMessage?: string) {
    const msgs =
      err.response.errors?.map((e) => e.message).join(', ') ||
      err.message ||
      'Unknown GitHub API v4 error';

    super(`${contextMessage ?? msgs} (GitHub API v4)`);
    this.name = 'GithubV4Exception';
    this.response = err.response;
  }
}

export function getQueryName(query: DocumentNode): string | undefined {
  if (query.definitions[0].kind === 'OperationDefinition') {
    return query.definitions[0].name?.value;
  }
}

// function addDebugLogs({
//   githubApiBaseUrlV4,
//   query,
//   variables,
//   githubResponse,
//   didThrow = false,
// }: {
//   githubApiBaseUrlV4: string;
//   query: DocumentNode;
//   variables?: Variables;
//   githubResponse: AxiosResponse<unknown>;
//   didThrow?: boolean;
// }) {
//   const gqlQueryName = getQueryName(query);
//   logger.info(
//     `POST ${githubApiBaseUrlV4} (name:${gqlQueryName}, status: ${
//       githubResponse.status
//     }${didThrow ? ', EXCEPTION THROWN' : ''})`,
//   );

//   logger.verbose(`Query: ${print(query)}`);
//   logger.verbose('Variables:', variables);
//   logger.verbose('Response headers:', githubResponse.headers);
//   logger.verbose('Response data:', githubResponse.data);
// }
