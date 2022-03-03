import { Commit } from './sourceCommit/parseSourceCommit';

type ErrorContext =
  | {
      code: 'merge-conflict-exception';
      conflictingFiles: string[];
      commitsWithoutBackports: {
        formatted: string;
        commit: Commit;
      }[];
    }
  | {
      code: 'custom-exception';
      message: string;
    }
  | {
      code: 'no-branches-exception' | 'abort-exception';
    };

function getMessage(errorContext: ErrorContext): string {
  switch (errorContext.code) {
    case 'merge-conflict-exception':
      return `Commit could not be cherrypicked due to conflicts in: ${errorContext.conflictingFiles.join(
        ','
      )}`;
    case 'no-branches-exception':
      return 'There are no branches to backport to. Aborting.';
    case 'abort-exception':
      return 'Aborted';
    case 'custom-exception':
      return errorContext.message;
  }
}

export class HandledError extends Error {
  errorContext: ErrorContext;
  constructor(errorContextOrString: ErrorContext | string) {
    const errorContext: ErrorContext =
      typeof errorContextOrString === 'string'
        ? { code: 'custom-exception', message: errorContextOrString }
        : errorContextOrString;
    const message = getMessage(errorContext);
    super(message);
    Error.captureStackTrace(this, HandledError);
    this.name = 'HandledError';
    this.message = message;
    this.errorContext = errorContext;
  }
}
