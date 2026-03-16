/** Top-level orchestrator: parse args, resolve options, fetch commits, run backports, report results. */
import chalk from 'chalk';
import type { BackportErrorCode } from './lib/backport-error.js';
import { BackportError } from './lib/backport-error.js';
import { getLogfilePath } from './lib/env.js';
import { getCommits } from './lib/get-commits.js';
import { getTargetBranches } from './lib/get-target-branches.js';
import { createStatusComment } from './lib/github/v3/create-status-comment.js';
import { consoleLog, initLogger } from './lib/logger.js';
import { ora } from './lib/ora.js';
import { registerHandlebarsHelpers } from './lib/register-handlebars-helpers.js';
import type { ErrorResult, Result } from './lib/run-sequentially.js';
import { runSequentially } from './lib/run-sequentially.js';
import { setupRepo } from './lib/setup-repo.js';
import type { Commit } from './lib/sourceCommit/parse-source-commit.js';
import type { OptionsFromCliArgs } from './options/cli-args.js';
import {
  getRuntimeArguments,
  getOptionsFromCliArgs,
} from './options/cli-args.js';
import type { ConfigFileOptions } from './options/config-options.js';
import type { ValidConfigOptions } from './options/options.js';
import { getActiveOptionsFormatted, getOptions } from './options/options.js';

export type BackportResponse = {
  commits: Commit[];
  results: Result[];
};

export async function backportRun({
  processArgs,
  optionsFromModule = {},
  exitCodeOnFailure,
}: {
  processArgs: string[];
  optionsFromModule?: ConfigFileOptions;
  exitCodeOnFailure: boolean;
}): Promise<BackportResponse> {
  registerHandlebarsHelpers();

  const { interactive, logFilePath } = getRuntimeArguments(
    processArgs,
    optionsFromModule,
  );
  const logger = initLogger({ interactive, logFilePath });

  let optionsFromCliArgs: OptionsFromCliArgs;
  try {
    optionsFromCliArgs = getOptionsFromCliArgs(processArgs);
  } catch (error) {
    if (error instanceof Error) {
      consoleLog(error.message);
      consoleLog(`Run "backport --help" to see all options`);
      if (exitCodeOnFailure) {
        process.exitCode = 1;
      }
      return {
        commits: [],
        results: [toErrorResult(error)],
      };
    }

    throw error;
  }

  let options: ValidConfigOptions | null = null;
  let commits: Commit[] = [];
  const spinner = ora(interactive).start('Initializing...');

  try {
    options = await getOptions({ optionsFromCliArgs, optionsFromModule });

    logger.info('Backporting options', options);
    spinner.stop();

    consoleLog(getActiveOptionsFormatted(options));

    commits = await getCommits(options);
    logger.info('Commits', commits);

    if (options.ls) {
      return { commits, results: [] };
    }

    const targetBranches = await getTargetBranches(options, commits);
    logger.info('Target branches', targetBranches);

    await setupRepo(options);

    const results = await runSequentially({
      options,
      commits,
      targetBranches,
    });
    logger.info('Results', results);

    const backportResponse: BackportResponse = { commits, results };

    await createStatusComment({ options, backportResponse });

    return backportResponse;
  } catch (error) {
    spinner.stop();

    if (!(error instanceof Error)) {
      throw error;
    }

    const errorResult = toErrorResult(error);
    const backportResponse: BackportResponse = {
      commits,
      results: [errorResult],
    };

    if (options) {
      await createStatusComment({ options, backportResponse });
    }

    outputError({
      errorCode: errorResult.errorCode,
      errorMessage: errorResult.errorMessage,
      error,
      logFilePath,
    });

    if (
      exitCodeOnFailure &&
      errorResult.errorCode !== 'no-branches-exception'
    ) {
      process.exitCode = 1;
    }

    logger.error('Unhandled exception:', error);

    return backportResponse;
  }
}

function toErrorResult(error: Error): ErrorResult {
  const isBackportError = error instanceof BackportError;
  return {
    status: 'error',
    errorMessage: error.message,
    errorCode: isBackportError
      ? error.errorContext.code
      : 'unhandled-exception',
    errorContext: isBackportError ? error.errorContext : undefined,
  };
}

function outputError({
  errorCode,
  errorMessage,
  error,
  logFilePath,
}: {
  errorCode: BackportErrorCode | 'unhandled-exception';
  errorMessage: string;
  error: unknown;
  logFilePath?: string;
}) {
  if (errorCode !== 'unhandled-exception') {
    consoleLog(errorMessage);
    return;
  }

  consoleLog('\n');
  consoleLog(chalk.bold('⚠️  Ouch! An unhandled error occurred 😿'));
  consoleLog(
    error instanceof Error ? (error.stack ?? errorMessage) : errorMessage,
  );
  consoleLog(
    'Please open an issue in https://github.com/sorenlouv/backport/issues',
  );

  const infoLogPath = getLogfilePath({ logFilePath, logLevel: 'info' });
  consoleLog(
    chalk.italic(`For additional details see the logs: ${infoLogPath}`),
  );
}
