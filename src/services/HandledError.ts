import dedent from 'dedent';
import { getGlobalConfigPath } from './env';
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
      code: 'no-branches-exception' | 'abort-exception' | 'missing-git-config';
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
    case 'missing-git-config':
      return dedent(`*** Please tell me who you are.
      Run

        git config user.name "Your Name"
        git config user.email "you@example.com"
        
      Or add it to ${getGlobalConfigPath()}
      
        {
          "accessToken": "***",
          "gitUserName": "Your Name",
          "gitUserEmail": "you@example.com"
        }`);
  }
}

export class HandledError extends Error {
  errorContext?: ErrorContext;
  constructor(errorContext: ErrorContext | string) {
    const message = getMessage(errorContext);
    super(message);
    Error.captureStackTrace(this, HandledError);
    this.name = 'HandledError';
    this.message = message;

    if (typeof errorContext !== 'string') {
      this.errorContext = errorContext;
    }
  }
}
