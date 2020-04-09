import chalk from 'chalk';
import ora from 'ora';
import { getOptions } from './options/options';
import { runWithOptions } from './runWithOptions';
import { HandledError } from './services/HandledError';
import { getLogfilePath } from './services/env';
import { initLogger } from './services/logger';

export async function runWithArgs(args: string[]) {
  const logger = initLogger();

  const spinner = ora().start('Initializing');
  try {
    const options = await getOptions(args);
    spinner.stop();
    await runWithOptions(options);
  } catch (e) {
    spinner.stop();

    if (e instanceof HandledError) {
      console.error(e.message);
    } else {
      console.error('\n');
      console.error(chalk.bold('⚠️  An unknown error occurred  ⚠️'));
      console.error(e.message);
      console.error(
        chalk.italic(
          `Please check the logs for addtional details: ${getLogfilePath()}`
        )
      );
      logger.info('Unknown error:', e);
    }

    // wait exiting until logs have been flushed to disc
    logger.on('finish', () => {
      process.exit(1);
    });
  }
}
