import winston, { format } from 'winston';
import { getLogfilePath } from './env.js';

export let logger = winston.createLogger({
  transports: [
    fileTransport({ logLevel: 'info' }),
    fileTransport({ logLevel: 'debug' }),
  ],
});

let _accessToken: string | undefined;
let _interactive: boolean;

export function initLogger({
  interactive,
  githubToken,
  logFilePath,
}: {
  interactive: boolean;
  githubToken?: string;
  logFilePath?: string;
}) {
  _accessToken = githubToken;
  _interactive = interactive;

  logger = winston.createLogger({
    format: format.combine(
      format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      // Format the metadata object
      format.metadata({
        fillExcept: ['message', 'level', 'timestamp', 'label'],
      }),
    ),
    transports: logFilePath
      ? [fileTransport({ logLevel: 'debug', logFilePath })]
      : [
          fileTransport({ logLevel: 'info' }),
          fileTransport({ logLevel: 'debug' }),
        ],
  });

  return logger;
}

function fileTransport({
  logFilePath,
  logLevel,
}: {
  logFilePath?: string;
  logLevel: LogLevel;
}) {
  return new winston.transports.File({
    filename: getLogfilePath({ logFilePath, logLevel }),
    level: logLevel,
    format: format.json({ replacer: accessTokenReplacer }),
  });
}

// wrapper around console.log
export function consoleLog(message: string) {
  if (_interactive) {
    console.log(redactAccessToken(message));
  }
}

export function setAccessToken(githubToken: string) {
  _accessToken = githubToken;
}

export function redactAccessToken(str: string) {
  // `redactAccessToken` might be called before access token is set
  if (_accessToken) {
    return str.replaceAll(_accessToken, '<REDACTED>');
  }

  return str;
}

export function accessTokenReplacer(key: string, value: unknown) {
  return typeof value === 'string' ? redactAccessToken(value) : value;
}

export type LogLevel = 'error' | 'warn' | 'info' | 'verbose' | 'debug';
