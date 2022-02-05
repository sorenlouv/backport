import { GithubV4Response } from './github/v4/apiRequestV4';
import { Commit } from './sourceCommit/parseSourceCommit';

type ErrorContext =
  | {
      code: 'merge-conflict-exception';
      commitsWithoutBackports: {
        formatted: string;
        commit: Commit;
      }[];
    }
  | {
      code: 'no-branches-exception' | 'abort-exception';
    }
  | {
      code: 'github-v4-exception';
      errors: NonNullable<GithubV4Response<any>['errors']>;
    };

function getMessage(errorContext: ErrorContext | string): string {
  if (typeof errorContext === 'string') {
    return errorContext;
  }

  switch (errorContext.code) {
    case 'merge-conflict-exception':
      return `Commit could not be cherrypicked due to conflicts`;
    case 'no-branches-exception':
      return 'There are no branches to backport to. Aborting.';
    case 'abort-exception':
      return 'Aborted';
    case 'github-v4-exception':
      return `Github v4 error: ${errorContext.errors
        .map((error) => error.message)
        .join(',')}`;
  }
}

export class HandledError extends Error {
  errorContext?: ErrorContext;
  constructor(errorContext: ErrorContext | string) {
    super(getMessage(errorContext));
    Error.captureStackTrace(this, HandledError);
    this.name = 'HandledError';

    if (typeof errorContext !== 'string') {
      this.errorContext = errorContext;
    }
  }
}
