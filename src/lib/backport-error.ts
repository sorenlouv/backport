import type { Commit } from './sourceCommit/parse-source-commit.js';

export type ErrorContext =
  | {
      code: 'merge-conflict-exception';
      conflictingFiles: string[];
      commitsWithoutBackports: {
        formatted: string;
        commit: Commit;
      }[];
    }
  | { code: 'invalid-branch-exception'; branchName: string }
  | { code: 'no-branches-exception' }
  | { code: 'abort-conflict-resolution-exception' }
  | { code: 'pr-not-found-exception'; pullNumber: number }
  | { code: 'pr-not-merged-exception'; pullNumber: number }
  | { code: 'commit-not-found-exception'; sha: string; sourceBranch: string }
  | { code: 'no-commits-found-exception'; message: string }
  | { code: 'invalid-credentials-exception'; message: string }
  | {
      code: 'repo-not-found-exception';
      repoOwner: string;
      repoName: string;
      repoForkOwner: string;
    }
  | { code: 'config-error-exception'; message: string }
  | { code: 'pr-creation-exception'; message: string }
  | { code: 'cherrypick-exception'; message: string }
  | { code: 'clone-exception'; message: string }
  | { code: 'buffer-overflow-exception'; message: string }
  | { code: 'branch-not-found-exception'; branchName: string }
  | { code: 'max-retries-exception' }
  | { code: 'github-api-exception'; message: string }
  | { code: 'auto-merge-not-available-exception'; message: string };

export type BackportErrorCode = ErrorContext['code'];

function getMessage(errorContext: ErrorContext): string {
  switch (errorContext.code) {
    case 'merge-conflict-exception': {
      return `Commit could not be cherrypicked due to conflicts in: ${errorContext.conflictingFiles.join(',')}`;
    }
    case 'no-branches-exception': {
      return 'There are no branches to backport to. Aborting.';
    }
    case 'abort-conflict-resolution-exception': {
      return 'Conflict resolution was aborted by the user';
    }
    case 'invalid-branch-exception': {
      return `The branch "${errorContext.branchName}" does not exist`;
    }
    case 'pr-not-found-exception': {
      return `The PR #${errorContext.pullNumber} does not exist`;
    }
    case 'pr-not-merged-exception': {
      return `The PR #${errorContext.pullNumber} is not merged`;
    }
    case 'commit-not-found-exception': {
      return `No commit found on branch "${errorContext.sourceBranch}" with sha "${errorContext.sha}"`;
    }
    case 'no-commits-found-exception':
    case 'invalid-credentials-exception':
    case 'config-error-exception':
    case 'pr-creation-exception':
    case 'cherrypick-exception':
    case 'clone-exception':
    case 'buffer-overflow-exception':
    case 'github-api-exception':
    case 'auto-merge-not-available-exception': {
      return errorContext.message;
    }
    case 'repo-not-found-exception': {
      return `Error pushing to https://github.com/${errorContext.repoForkOwner}/${errorContext.repoName}. Repository does not exist. Either fork the repository (https://github.com/${errorContext.repoOwner}/${errorContext.repoName}) or disable fork mode via "--no-fork".\nRead more about fork mode in the docs: https://github.com/sorenlouv/backport/blob/main/docs/configuration.md#fork`;
    }
    case 'branch-not-found-exception': {
      return `The branch "${errorContext.branchName}" is invalid or doesn't exist`;
    }
    case 'max-retries-exception': {
      return 'Maximum number of retries exceeded';
    }
  }
}

export class BackportError extends Error {
  errorContext: ErrorContext;
  constructor(errorContext: ErrorContext) {
    const message = getMessage(errorContext);
    super(message);

    this.name = 'BackportError';
    this.message = message;
    this.errorContext = errorContext;
  }
}
