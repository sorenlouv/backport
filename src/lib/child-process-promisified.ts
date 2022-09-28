import childProcess from 'child_process';
import { promisify } from 'util';
import apm from 'elastic-apm-node';
import { logger } from './logger';
const execPromisified = promisify(childProcess.exec);

export async function exec(
  cmd: string,
  options: childProcess.ExecOptions & { cwd: string }
) {
  const res = await execPromisified(cmd, {
    maxBuffer: 100 * 1024 * 1024,
    ...options,

    // ensure that git commands return english error messages
    env: { ...process.env, LANG: 'en_US' },
  });

  return res;
}

type SpawnPromiseResponse = {
  cmdArgs: ReadonlyArray<string>;
  code: number | null;
  stderr: string;
  stdout: string;
};

export async function spawnPromise(
  cmd: string,
  cmdArgs: ReadonlyArray<string>,
  cwd: string
): Promise<SpawnPromiseResponse> {
  const fullCmd = getFullCmd(cmd, cmdArgs);
  logger.info(`Running command: "${fullCmd}"`);
  const span = apm.startSpan(fullCmd);

  const res = new Promise<SpawnPromiseResponse>(function (resolve, reject) {
    const subprocess = childProcess.spawn(cmd, cmdArgs, {
      cwd,

      // ensure that git commands return english error messages
      env: { ...process.env, LANG: 'en_US' },
    });
    let stderr = '';
    let stdout = '';

    subprocess.stdout.on('data', (data: string) => {
      stdout += data;
    });

    subprocess.stderr.on('data', (data: string) => {
      stderr += data;
    });

    subprocess.on('close', (code) => {
      if (code === 0 || code === null) {
        logger.verbose(
          `Spawn success: code=${code} stderr=${stderr} stdout=${stdout}`
        );
        resolve({ cmdArgs, code, stderr, stdout });
      } else {
        const err = new SpawnError({ cmdArgs, code, stderr, stdout });
        logger.verbose(`Error when running command: "${fullCmd}"`, err);
        reject(err);
      }
    });

    subprocess.on('error', (err) => {
      reject(err);
    });
  });

  res
    .then(() => span?.setOutcome('success'))
    .catch(() => span?.setOutcome('failure'))
    .finally(() => span?.end());

  return res;
}

export const spawnStream = (cmd: string, cmdArgs: ReadonlyArray<string>) => {
  const span = apm.startSpan(getFullCmd(cmd, cmdArgs));

  const res = childProcess.spawn(cmd, cmdArgs, {
    env: { ...process.env, LANG: 'en_US' },
  });

  res.on('close', (code) => {
    const isSuccess = code === 0 || code === null;
    span?.setOutcome(isSuccess ? 'success' : 'failure');
    span?.end();
  });

  return res;
};

function getFullCmd(cmd: string, cmdArgs: ReadonlyArray<string>) {
  return `${cmd} ${cmdArgs.join(' ')}`;
}

export type SpawnErrorContext = {
  cmdArgs: ReadonlyArray<string>;
  code: number;
  stderr: string;
  stdout: string;
};

export class SpawnError extends Error {
  context: SpawnErrorContext;
  constructor(context: SpawnErrorContext) {
    const cmdArgs = context.cmdArgs.join(' ');
    const message = `Code: ${
      context.code
    }, Args: "${cmdArgs}", Message: ${context.stderr.trim()}`;

    super(message);
    Error.captureStackTrace(this, SpawnError);
    this.name = 'SpawnError';
    this.message = message;
    this.context = context;
  }
}
