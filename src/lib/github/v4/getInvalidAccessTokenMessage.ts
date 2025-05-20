import { isEmpty, difference } from 'lodash';
import { maybe } from '../../../utils/maybe';
import { getGlobalConfigPath } from '../../env';
import { logger } from '../../logger';
import { OperationResultWithMeta } from './fetchCommits/graphqlClient';

export function getInvalidAccessTokenMessage({
  result,
  repoOwner,
  repoName,
  globalConfigFile,
}: {
  result: OperationResultWithMeta;
  repoOwner: string;
  repoName: string;
  globalConfigFile?: string;
}): string | undefined {
  function getSSOAuthUrl(ssoHeader?: string | null) {
    const matches = ssoHeader?.match(/url=(.*)/);
    if (matches) {
      return matches[1];
    }
  }

  const { statusCode, error } = result;
  switch (statusCode) {
    case 200: {
      const repoNotFound = error?.graphQLErrors.some(
        ({ originalError, path }) =>
          //@ts-expect-error
          originalError.type === 'NOT_FOUND' &&
          path?.join('.') === 'repository',
      );

      const grantedScopes = result.responseHeaders?.get('x-oauth-scopes') || '';
      const requiredScopes =
        result.responseHeaders?.get('x-accepted-oauth-scopes') || '';
      const ssoHeader = maybe(result.responseHeaders?.get('x-github-sso'));

      if (repoNotFound) {
        const hasRequiredScopes = isEmpty(
          difference(requiredScopes.split(','), grantedScopes.split(',')),
        );

        // user does not have permission to the repo
        if (!hasRequiredScopes) {
          return `You do not have access to the repository "${repoOwner}/${repoName}". Please make sure your access token has the required scopes.\n\nRequired scopes: ${requiredScopes}\nAccess token scopes: ${grantedScopes}`;
        }

        // repo does not exist
        return `The repository "${repoOwner}/${repoName}" doesn't exist`;
      }

      const repoAccessForbidden = result.error?.graphQLErrors.some(
        // @ts-expect-error
        ({ originalError }) => originalError.type === 'FORBIDDEN',
      );

      const ssoAuthUrl = getSSOAuthUrl(ssoHeader);

      // user does not have permissions
      if (repoAccessForbidden && ssoAuthUrl) {
        return `Please follow the link to authorize your personal access token with SSO:\n\n${ssoAuthUrl}`;
      }
      break;
    }

    case 401:
      return `Please check your access token and make sure it is valid.\nConfig: ${getGlobalConfigPath(
        globalConfigFile,
      )}`;

    default:
      logger.warn(`Unexpected status code: ${statusCode}`);
      return undefined;
  }
}
