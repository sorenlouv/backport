import winston, { format } from 'winston';
import yargs from 'yargs';
import isString from 'lodash.isstring';
import { getLogfilePath } from './env';

const { combine, timestamp, printf } = format;
const { argv } = yargs.help(false);

// wrapper around console.log
export function consoleLog(...args: unknown[]) {
  console.log(...args);
}

const level = argv.verbose ? 'verbose' : argv.debug ? 'debug' : 'info';

export let logger = ({
  info: () => {},
  verbose: () => {},
  debug: () => {},
} as unknown) as winston.Logger;

export function initLogger() {
  logger = winston.createLogger({
    transports: [
      // log to file
      new winston.transports.File({
        level,
        format: combine(
          timestamp(),
          printf(
            ({ message, timestamp }) => `${timestamp} ${formatMessage(message)}`
          )
        ),
        filename: getLogfilePath(),
      }),
    ],
  });
  return logger;
}

function formatMessage(message: string | Record<any, any>) {
  if (message == null) {
    return '';
  }

  if (isString(message)) {
    return message;
  }

  if (typeof message === 'object') {
    return JSON.stringify(message, Object.getOwnPropertyNames(message), 2);
  }
}

// log levels:
// - error
// - warn
// - info
// - verbose
// - debug
