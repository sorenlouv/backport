import { isEmpty, difference } from 'lodash';
import { maybe } from '../../../utils/maybe';
import { BackportError } from '../../BackportError';
import { getGlobalConfigPath } from '../../env';
import { logger } from '../../logger';
import { GithubV4Exception } from './fetchCommits/graphqlClient';

export function throwOnInvalidAccessToken({
  error,
  repoOwner,
  repoName,
  globalConfigFile,
}: {
  error: GithubV4Exception<unknown>;
  repoOwner: string;
  repoName: string;
  globalConfigFile?: string;
}) {
  function getSSOAuthUrl(ssoHeader?: string | null) {
    const matches = ssoHeader?.match(/url=(.*)/);
    if (matches) {
      return matches[1];
    }
  }

  const { statusCode } = error.result;

  switch (statusCode) {
    case 200: {
      const repoNotFound = error.result.error?.graphQLErrors.some(
        (error) =>
          //@ts-expect-error
          error.originalError.type === 'NOT_FOUND' &&
          error.path?.join('.') === 'repository',
      );

      const grantedScopes =
        error.result.responseHeaders?.get('x-oauth-scopes') || '';
      const requiredScopes =
        error.result.responseHeaders?.get('x-accepted-oauth-scopes') || '';
      const ssoHeader = maybe(
        error.result.responseHeaders?.get('x-github-sso'),
      );

      if (repoNotFound) {
        const hasRequiredScopes = isEmpty(
          difference(requiredScopes.split(','), grantedScopes.split(',')),
        );

        // user does not have permission to the repo
        if (!hasRequiredScopes) {
          throw new BackportError(
            `You do not have access to the repository "${repoOwner}/${repoName}". Please make sure your access token has the required scopes.\n\nRequired scopes: ${requiredScopes}\nAccess token scopes: ${grantedScopes}`,
          );
        }

        // repo does not exist
        throw new BackportError(
          `The repository "${repoOwner}/${repoName}" doesn't exist`,
        );
      }

      const repoAccessForbidden = error.result.error?.graphQLErrors.some(
        // @ts-expect-error
        (error) => error.originalError.type === 'FORBIDDEN',
      );

      const ssoAuthUrl = getSSOAuthUrl(ssoHeader);

      // user does not have permissions
      if (repoAccessForbidden && ssoAuthUrl) {
        throw new BackportError(
          `Please follow the link to authorize your personal access token with SSO:\n\n${ssoAuthUrl}`,
        );
      }
      break;
    }

    case 401:
      throw new BackportError(
        `Please check your access token and make sure it is valid.\nConfig: ${getGlobalConfigPath(
          globalConfigFile,
        )}`,
      );

    default:
      logger.warn(`Unexpected status code: ${statusCode}`);
      return undefined;
  }
}
