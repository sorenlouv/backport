import chalk from 'chalk';
import yargsParser from 'yargs-parser';
import { BackportError } from './errors/BackportError';
import { getLogfilePath } from './lib/env';
import { getCommits } from './lib/getCommits';
import { getGitConfigAuthor } from './lib/getGitConfigAuthor';
import { getTargetBranches } from './lib/getTargetBranches';
import { createStatusComment } from './lib/github/v3/createStatusComment';
import { GithubV4Exception } from './lib/github/v4/apiRequestV4';
import { consoleLog, initLogger } from './lib/logger';
import { ora } from './lib/ora';
import { setupRepo } from './lib/setupRepo';
import { Commit } from './lib/sourceCommit/parseSourceCommit';
import { ConfigFileOptions } from './options/ConfigOptions';
import { CliError } from './options/cliArgs';
import { getOptions, ValidConfigOptions } from './options/options';
import { runSequentially, Result } from './runSequentially';

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
  const argv = yargsParser(processArgs) as ConfigFileOptions;
  const ci = argv.ci ?? optionsFromModule.ci;
  const logFilePath = argv.logFilePath ?? optionsFromModule.logFilePath;
  const logger = initLogger({ ci, logFilePath });

  let options: ValidConfigOptions | null = null;
  let commits: Commit[] = [];

  try {
    const spinner = ora(ci);
    try {
      // don't show spinner for yargs commands that exit the process without stopping the spinner first
      if (!argv.help && !argv.version && !argv.v) {
        spinner.start('Initializing...');
      }

      options = await getOptions(processArgs, optionsFromModule);
      logger.info('Backporting options', options);
      spinner.stop();
    } catch (e) {
      spinner.stop();
      if (e instanceof CliError) {
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

    commits = await getCommits(options);
    logger.info('Commits', commits);

    if (options.ls) {
      return { status: 'success', commits, results: [] } as BackportResponse;
    }

    const targetBranches = await getTargetBranches(options, commits);
    logger.info('Target branches', targetBranches);

    const [gitConfigAuthor] = await Promise.all([
      getGitConfigAuthor(options),
      setupRepo(options),
    ]);

    const results = await runSequentially({
      options,
      commits,
      targetBranches,
      gitConfigAuthor,
    });
    logger.info('Results', results);

    const backportResponse: BackportResponse = {
      status: 'success',
      commits,
      results,
    };
    await createStatusComment({ options, backportResponse });
    return backportResponse;
  } catch (e) {
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

    logger.error('Unhandled exception', e);

    return backportResponse;
  }
}

function outputError({
  e,
  logFilePath,
}: {
  e: BackportError | GithubV4Exception<any> | Error;
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
    consoleLog(e.stack ? e.stack : e.message);
    consoleLog(
      'Please open an issue in https://github.com/sqren/backport/issues or contact me directly on https://twitter.com/sorenlouv'
    );

    consoleLog(
      chalk.italic(
        `For additional details see the logs: ${getLogfilePath({
          logFilePath,
        })}`
      )
    );
  }
}
