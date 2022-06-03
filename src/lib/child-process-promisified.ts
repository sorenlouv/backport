import childProcess from 'child_process';
import { promisify } from 'util';
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

export async function spawnPromise(
  cmd: string,
  cmdArgs: string[],
  cwd: string
): Promise<{
  cmdArgs: string[];
  code: number | null;
  stderr: string;
  stdout: string;
}> {
  const fullCmd = `${cmd} ${cmdArgs.join(' ')}`;
  logger.info(`Running command: "${fullCmd}"`);

  return new Promise(function (resolve, reject) {
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
}

export const spawnStream = (cmd: string, cmdArgs: ReadonlyArray<string>) => {
  return childProcess.spawn(cmd, cmdArgs, {
    env: { ...process.env, LANG: 'en_US' },
  });
};

export type SpawnErrorContext = {
  cmdArgs: string[];
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
