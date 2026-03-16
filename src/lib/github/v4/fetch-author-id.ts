import { graphql } from '../../../graphql/generated/index.js';
import { BackportError } from '../../backport-error.js';
import { graphqlRequest } from './client/graphql-client.js';

export async function fetchAuthorId({
  accessToken,
  author,
  githubApiBaseUrlV4 = 'https://api.github.com/graphql',
}: {
  accessToken: string;
  author: string | null;
  githubApiBaseUrlV4?: string;
}) {
  if (author === null) {
    return null;
  }

  const query = graphql(`
    query AuthorId($author: String!) {
      user(login: $author) {
        id
      }
    }
  `);
  const variables = { author };

  const result = await graphqlRequest(
    { accessToken, githubApiBaseUrlV4 },
    query,
    variables,
  );

  if (result.error) {
    throw new BackportError({
      code: 'github-api-exception',
      message: result.error.message,
    });
  }

  return result.data?.user?.id;
}
