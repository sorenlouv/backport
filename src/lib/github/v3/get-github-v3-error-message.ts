// Docs: https://developer.github.com/v3/#client-errors
import type { RequestError } from '@octokit/request-error';

interface GithubV3ResponseErrors {
  errors?: Array<{
    resource: string;
    code: string;
    field: string;
    message?: string;
  }>;
}

export function getGithubV3ErrorMessage(e: RequestError) {
  const data = e.response?.data as GithubV3ResponseErrors | undefined;

  if (!data?.errors) {
    return e.message;
  }

  const errorMessages = data.errors.map((error) => {
    if (error.message) {
      return error.message;
    }

    return JSON.stringify(error);
  });
  return `${errorMessages.join(', ')} (Github v3)`;
}
