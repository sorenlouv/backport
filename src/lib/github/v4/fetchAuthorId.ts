import { getV4Client } from './apiRequestV4';

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

  const client = getV4Client({ githubApiBaseUrlV4, accessToken });
  const res = await client.AuthorId({ author });
  return res.data.user?.id;
}
