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
  return new Promise(function (resolve, reject) {
    const subprocess = childProcess.spawn(cmd, cmdArgs, { cwd });
    let stderr = '';
    let stdout = '';

    subprocess.stdout.on('data', (data: string) => {
      stdout += data;
    });

    subprocess.stderr.on('data', (data: string) => {
      stderr += data;
    });

    subprocess.on('close', (code) => {
      const fullCmd = `${cmd} ${cmdArgs.join(' ')}`;

      if (code === 0 || code === null) {
        logger.verbose(`spawn success: "${fullCmd}"`);
        resolve({ cmdArgs, code, stderr, stdout });
      } else {
        const err = new SpawnError({ cmdArgs, code, stderr, stdout });
        logger.info(`spawn error: "${fullCmd}"`, err);
        reject(err);
      }
    });

    subprocess.on('error', (err) => {
      reject(err);
    });
  });
}

export const spawnOriginal = childProcess.spawn;

export type SpawnErrorContext = {
  cmdArgs: string[];
  code: number;
  stderr: string;
  stdout: string;
};

export class SpawnError extends Error {
  context: SpawnErrorContext;
  constructor(context: SpawnErrorContext) {
    const message = `Code: ${context.code}; Args: ${JSON.stringify(
      context.cmdArgs
    )}; ${context.stderr.trim()}`;

    super(message);
    Error.captureStackTrace(this, SpawnError);
    this.name = 'SpawnError';
    this.message = message;
    this.context = context;
  }
}
