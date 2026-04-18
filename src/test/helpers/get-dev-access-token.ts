import 'dotenv/config';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface ProcessEnv {
      GITHUB_TOKEN?: string;
    }
  }
}

export function getDevAccessToken(): string {
  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken) {
    throw new Error(
      'Please create ".env" file containing: `GITHUB_TOKEN="ghp_very_secret"`',
    );
  }

  return githubToken;
}
