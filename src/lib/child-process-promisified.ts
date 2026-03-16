import childProcess from 'node:child_process';
import { BackportError } from './backport-error.js';
import { logger } from './logger.js';

const MAX_BUFFER_SIZE = 100 * 1024 * 1024; // 100MB

type SpawnErrorContext = {
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

    this.name = 'SpawnError';
    this.message = message;
    this.context = context;
  }
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
  cwd: string,
  isInteractive = false,
): Promise<SpawnPromiseResponse> {
  const fullCmd = getFullCmd(cmd, cmdArgs);
  logger.info(`Running command: "${fullCmd}"`);

  return new Promise<SpawnPromiseResponse>(function (resolve, reject) {
    const subprocess = childProcess.spawn(cmd, cmdArgs, {
      cwd,

      // ensure that git commands return English error messages
      env: { ...process.env, LANG: 'C' },
      ...(isInteractive ? { stdio: 'inherit' } : undefined),
    });
    let stderr = '';
    let stdout = '';

    subprocess.stdout?.on('data', (data: string) => {
      stdout += data;
      if (stdout.length > MAX_BUFFER_SIZE) {
        subprocess.kill();
        reject(
          new BackportError({
            code: 'buffer-overflow-exception',
            message: `stdout exceeded ${MAX_BUFFER_SIZE} bytes for: "${fullCmd}"`,
          }),
        );
      }
    });

    subprocess.stderr?.on('data', (data: string) => {
      stderr += data;
      if (stderr.length > MAX_BUFFER_SIZE) {
        subprocess.kill();
        reject(
          new BackportError({
            code: 'buffer-overflow-exception',
            message: `stderr exceeded ${MAX_BUFFER_SIZE} bytes for: "${fullCmd}"`,
          }),
        );
      }
    });

    subprocess.on('close', (code) => {
      if (code === 0 || code === null) {
        logger.verbose(
          `Spawn success: code=${code} stderr=${stderr} stdout=${stdout}`,
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
}

export const spawnStream = (cmd: string, cmdArgs: ReadonlyArray<string>) => {
  return childProcess.spawn(cmd, cmdArgs, {
    env: { ...process.env, LANG: 'C' },
  });
};

function getFullCmd(cmd: string, cmdArgs: ReadonlyArray<string>) {
  return `${cmd} ${cmdArgs.join(' ')}`;
}
