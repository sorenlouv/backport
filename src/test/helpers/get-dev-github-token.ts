import 'dotenv/config';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface ProcessEnv {
      GITHUB_TOKEN?: string;
    }
  }
}

export function getDevGithubToken(): string {
  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken) {
    throw new Error(
      [
        'Missing GitHub access token: private/mutation tests make live GitHub API calls and require a GITHUB_TOKEN.',
        'Create a ".env" file in the repo root containing: GITHUB_TOKEN="ghp_..."',
        '(any classic personal access token with public-repo read access works for the private tier).',
        'To run only the offline tests (no token needed), use: npm run test:unit',
      ].join('\n'),
    );
  }

  return githubToken;
}
