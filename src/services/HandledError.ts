import { Commit } from './sourceCommit/parseSourceCommit';

type ErrorAttributes =
  | {
      code: 'merge-conflict-exception';
      commitsWithoutBackports: {
        formatted: string;
        commit: Commit;
      }[];
    }
  | {
      code: 'no-branches-exception' | 'abort-exception';
    };

function getMessage(errorAttributes: ErrorAttributes | string): string {
  if (typeof errorAttributes === 'string') {
    return errorAttributes;
  }

  switch (errorAttributes.code) {
    case 'merge-conflict-exception':
      return `Commit could not be cherrypicked due to conflicts`;
    case 'no-branches-exception':
      return 'There are no branches to backport to. Aborting.';
    case 'abort-exception':
      return 'Aborted';
  }
}

export class HandledError extends Error {
  attributes?: ErrorAttributes;
  constructor(errorAttributes: ErrorAttributes | string) {
    super(getMessage(errorAttributes));
    Error.captureStackTrace(this, HandledError);
    this.name = 'HandledError';

    if (typeof errorAttributes !== 'string') {
      this.attributes = errorAttributes;
    }
  }
}
