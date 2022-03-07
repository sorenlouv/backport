import childProcess from 'child_process';
import { promisify } from 'util';
import { logger } from './logger';
const execPromisified = promisify(childProcess.exec);

export async function exec(
  cmd: string,
  options: childProcess.ExecOptions & { cwd: string }
) {
  try {
    const res = await execPromisified(cmd, {
      maxBuffer: 100 * 1024 * 1024,
      ...options,
    });
    logger.verbose(`exec success '${cmd}':`, res);
    return res;
  } catch (e) {
    logger.info(`exec error '${cmd}': ${JSON.stringify(e, null, 2)}`);
    throw e;
  }
}

export async function spawn(cmd: string, cmdArgs: string[], cwd: string) {
  return new Promise(function (resolve, reject) {
    const subprocess = childProcess.spawn(cmd, cmdArgs, { cwd });
    let stderr = '';
    let stdout = '';

    subprocess.stdout.on('data', (data) => {
      stdout += data;
    });

    subprocess.stderr.on('data', (data) => {
      stderr += data;
    });

    subprocess.on('close', (code) => {
      if (code === 0) {
        resolve({ cmdArgs, code, stderr, stdout });
      } else {
        reject(new SpawnError(cmdArgs, code, stderr, stdout));
      }
    });

    subprocess.on('error', (err) => {
      reject(err);
    });
  });
}

export const execAsCallback = (
  ...args: Parameters<typeof childProcess.exec>
) => {
  return childProcess.exec(...args);
};

export class SpawnError extends Error {
  constructor(
    public cmdArgs: string[],
    public code: number | null,
    public stderr: string,
    public stdout: string
  ) {
    super(`SpawnError (code: ${code}): ${stderr}`);
    Error.captureStackTrace(this, SpawnError);
    this.name = 'SpawnError';
    this.message = `SpawnError (code: ${code}): ${stderr}`;
  }
}
