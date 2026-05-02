import winston, { format } from 'winston';
import { getLogfilePath } from './env.js';

export let logger = winston.createLogger({
  transports: [
    fileTransport({ logLevel: 'info' }),
    fileTransport({ logLevel: 'debug' }),
  ],
});

let _githubToken: string | undefined;
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
  _githubToken = githubToken;
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
    format: format.json({ replacer: githubTokenReplacer }),
  });
}

// wrapper around console.log
export function consoleLog(message: string) {
  if (_interactive) {
    console.log(redactGithubToken(message));
  }
}

export function setGithubToken(githubToken: string) {
  _githubToken = githubToken;
}

export function redactGithubToken(str: string) {
  // `redactGithubToken` might be called before github token is set
  if (_githubToken) {
    return str.replaceAll(_githubToken, '<REDACTED>');
  }

  return str;
}

export function githubTokenReplacer(key: string, value: unknown) {
  return typeof value === 'string' ? redactGithubToken(value) : value;
}

export type LogLevel = 'error' | 'warn' | 'info' | 'verbose' | 'debug';
