import winston, { format } from 'winston';
import { getLogfilePath } from './env';

export let logger: winston.Logger;
let _accessToken: string | undefined;
let _interactive: boolean;

export function initLogger({
  interactive,
  accessToken,
  logFilePath,
}: {
  interactive: boolean;
  accessToken?: string;
  logFilePath?: string;
}) {
  _accessToken = accessToken;
  _interactive = interactive;

  logger = winston.createLogger({
    format: format.combine(
      format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      // Format the metadata object
      format.metadata({
        fillExcept: ['message', 'level', 'timestamp', 'label'],
      })
    ),
    transports: new winston.transports.File({
      filename: getLogfilePath({ logFilePath }),
      level: 'debug',
      format: format.json({
        replacer: (key, value) => {
          return typeof value === 'string' ? redactAccessToken(value) : value;
        },
      }),
    }),
  });

  return logger;
}

// wrapper around console.log
export function consoleLog(message: string) {
  if (_interactive) {
    // eslint-disable-next-line no-console
    console.log(redactAccessToken(message));
  }
}

export function setAccessToken(accessToken: string) {
  _accessToken = accessToken;
}

export function redactAccessToken(str: string) {
  // `redactAccessToken` might be called before access token is set
  if (_accessToken) {
    return str.replaceAll(_accessToken, '<REDACTED>');
  }

  return str;
}

// log levels:
// - error
// - warn
// - info
// - verbose
// - debug
