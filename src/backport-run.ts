import chalk from 'chalk';
import { BackportError } from './lib/backport-error.js';
import { getLogfilePath } from './lib/env.js';
import { getCommits } from './lib/get-commits.js';
import { getTargetBranches } from './lib/get-target-branches.js';
import { createStatusComment } from './lib/github/v3/create-status-comment.js';
import { GithubV4Exception } from './lib/github/v4/client/graphql-client.js';
import { consoleLog, initLogger } from './lib/logger.js';
import { ora } from './lib/ora.js';
import { registerHandlebarsHelpers } from './lib/register-handlebars-helpers.js';
import type { Result } from './lib/run-sequentially.js';
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

export type BackportAbortResponse = {
  status: 'aborted';
  commits: Commit[];
  error: BackportError;
  errorMessage: string;
};

export type BackportSuccessResponse = {
  status: 'success';
  commits: Commit[];
  results: Result[];
};

export type BackportFailureResponse = {
  status: 'failure';
  commits: Commit[];
  error: Error | BackportError;
  errorMessage: string;
};

export type BackportResponse =
  | BackportSuccessResponse
  | BackportFailureResponse
  | BackportAbortResponse;

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
        status: 'failure',
        error: error,
        errorMessage: error.message,
        commits: [],
      } satisfies BackportFailureResponse;
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
      return {
        status: 'success',
        commits,
        results: [],
      } satisfies BackportSuccessResponse;
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

    const backportResponse: BackportResponse = {
      status: 'success',
      commits,
      results,
    };

    await createStatusComment({ options, backportResponse });

    return backportResponse;
  } catch (error) {
    spinner.stop();
    let backportResponse: BackportResponse;

    if (
      error instanceof BackportError &&
      error.errorContext.code === 'no-branches-exception'
    ) {
      backportResponse = {
        status: 'aborted',
        commits,
        error: error,
        errorMessage: error.message,
      };

      // this will catch both BackportError and Error
    } else if (error instanceof Error) {
      backportResponse = {
        status: 'failure',
        commits,
        error: error,
        errorMessage: error.message,
      };
    } else {
      throw error;
    }

    if (options) {
      await createStatusComment({ options, backportResponse });
    }

    outputError({ e: error, logFilePath });

    // only change exit code for failures while in cli mode
    if (exitCodeOnFailure && backportResponse.status === 'failure') {
      process.exitCode = 1;
    }

    logger.error('Unhandled exception:', error);

    return backportResponse;
  }
}

function outputError({
  e,
  logFilePath,
}: {
  e: BackportError | GithubV4Exception<unknown> | Error;
  logFilePath?: string;
}) {
  if (e instanceof BackportError || e instanceof GithubV4Exception) {
    consoleLog(e.message);
    return;
  }

  if (e instanceof Error) {
    // output
    consoleLog('\n');
    consoleLog(chalk.bold('⚠️  Ouch! An unhandled error occurred 😿'));
    consoleLog(e.stack ?? e.message);
    consoleLog(
      'Please open an issue in https://github.com/sorenlouv/backport/issues',
    );

    const infoLogPath = getLogfilePath({ logFilePath, logLevel: 'info' });
    consoleLog(
      chalk.italic(`For additional details see the logs: ${infoLogPath}`),
    );
  }
}
