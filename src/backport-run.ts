import chalk from 'chalk';
import type { Transaction } from 'elastic-apm-node';
import apm from 'elastic-apm-node';
import { disableApm } from './lib/apm';
import { BackportError } from './lib/backport-error';
import { getLogfilePath } from './lib/env';
import { getCommits } from './lib/get-commits';
import { getTargetBranches } from './lib/get-target-branches';
import { createStatusComment } from './lib/github/v3/create-status-comment';
import { GithubV4Exception } from './lib/github/v4/client/graphql-client';
import { consoleLog, initLogger } from './lib/logger';
import { ora } from './lib/ora';
import { registerHandlebarsHelpers } from './lib/register-handlebars-helpers';
import type { Result } from './lib/run-sequentially';
import { runSequentially } from './lib/run-sequentially';
import { setupRepo } from './lib/setup-repo';
import type { Commit } from './lib/sourceCommit/parse-source-commit';
import type { OptionsFromCliArgs } from './options/cli-args';
import { getRuntimeArguments, getOptionsFromCliArgs } from './options/cli-args';
import type { ConfigFileOptions } from './options/config-options';
import type { ValidConfigOptions } from './options/options';
import { getActiveOptionsFormatted, getOptions } from './options/options';

registerHandlebarsHelpers();

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

let _apmTransaction: apm.Transaction | null;

export async function backportRun({
  processArgs,
  optionsFromModule = {},
  exitCodeOnFailure,
  apmTransaction,
}: {
  processArgs: string[];
  optionsFromModule?: ConfigFileOptions;
  exitCodeOnFailure: boolean;
  apmTransaction: Transaction | null;
}): Promise<BackportResponse> {
  _apmTransaction = apmTransaction;
  const { interactive, logFilePath } = getRuntimeArguments(
    processArgs,
    optionsFromModule,
  );
  const logger = initLogger({ interactive, logFilePath });

  let optionsFromCliArgs: OptionsFromCliArgs;
  try {
    optionsFromCliArgs = getOptionsFromCliArgs(processArgs);
  } catch (e) {
    apm.captureError(e as Error);
    if (e instanceof Error) {
      consoleLog(e.message);
      consoleLog(`Run "backport --help" to see all options`);
      return {
        status: 'failure',
        error: e,
        errorMessage: e.message,
        commits: [],
      } as BackportResponse;
    }

    throw e;
  }

  let options: ValidConfigOptions | null = null;
  let commits: Commit[] = [];
  const spinner = ora(interactive).start('Initializing...');

  try {
    options = await getOptions({ optionsFromCliArgs, optionsFromModule });

    if (!options.telemetry) {
      disableApm();
    }

    apmTransaction?.setLabel('cli_options', JSON.stringify(optionsFromCliArgs));
    Object.entries(options).forEach(([key, value]) => {
      apmTransaction?.setLabel(`option__${key}`, JSON.stringify(value));
    });

    logger.info('Backporting options', options);
    spinner.stop();

    consoleLog(getActiveOptionsFormatted(options));

    const commitsSpan = apm.startSpan(`Get commits`);
    commits = await getCommits(options);
    commitsSpan?.setLabel('commit_count', commits.length);
    commitsSpan?.end();
    logger.info('Commits', commits);

    if (options.ls) {
      return { status: 'success', commits, results: [] } as BackportResponse;
    }

    const targetBranchesSpan = apm.startSpan('Get target branches');
    const targetBranches = await getTargetBranches(options, commits);
    targetBranchesSpan?.setLabel(
      'target-branches-count',
      targetBranches.length,
    );
    targetBranchesSpan?.end();
    logger.info('Target branches', targetBranches);

    const setupRepoSpan = apm.startSpan('Setup repository');
    await setupRepo(options);
    setupRepoSpan?.end();

    const backportCommitsSpan = apm.startSpan('Backport commits');
    const results = await runSequentially({
      options,
      commits,
      targetBranches,
    });
    logger.info('Results', results);
    backportCommitsSpan?.end();

    const backportResponse: BackportResponse = {
      status: 'success',
      commits,
      results,
    };

    await createStatusComment({ options, backportResponse });

    return backportResponse;
  } catch (e) {
    spinner.stop();
    let backportResponse: BackportResponse;

    if (
      e instanceof BackportError &&
      e.errorContext.code === 'no-branches-exception'
    ) {
      backportResponse = {
        status: 'aborted',
        commits,
        error: e,
        errorMessage: e.message,
      };

      // this will catch both BackportError and Error
    } else if (e instanceof Error) {
      backportResponse = {
        status: 'failure',
        commits,
        error: e,
        errorMessage: e.message,
      };
    } else {
      throw e;
    }

    if (options) {
      await createStatusComment({ options, backportResponse });
    }

    outputError({ e, logFilePath });

    // only change exit code for failures while in cli mode
    if (exitCodeOnFailure && backportResponse.status === 'failure') {
      process.exitCode = 1;
    }

    logger.error('Unhandled exception:', e);

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
    consoleLog(chalk.bold('⚠️  Ouch! An unhandled error occured 😿'));
    consoleLog(e.stack ?? e.message);
    consoleLog(
      'Please open an issue in https://github.com/sorenlouv/backport/issues or contact me directly on https://twitter.com/sorenlouv',
    );

    const infoLogPath = getLogfilePath({ logFilePath, logLevel: 'info' });
    consoleLog(
      chalk.italic(`For additional details see the logs: ${infoLogPath}`),
    );
  }
}

let didFlush = false;

process.on('exit', () => {
  if (!didFlush) {
    didFlush = true;
    _apmTransaction?.end('exit');
    apm.flush(() => process.exit());
  }
});

process.on('uncaughtException', () => {
  if (!didFlush) {
    didFlush = true;
    _apmTransaction?.end('exit');
    apm.flush(() => process.exit());
  }
});

process.on('SIGINT', () => {
  if (!didFlush) {
    didFlush = true;
    _apmTransaction?.end('SIGINT');
    apm.flush(() => process.exit());
  }
});
