import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { debounce } from 'lodash-es';
import stripAnsi from 'strip-ansi';
import {
  getSandboxPath,
  resetSandbox,
  SANDBOX_PATH,
} from '../helpers/sandbox.js';

const tsxBinary = path.resolve('./node_modules/.bin/tsx');
const entrypointFile = path.resolve('./src/entrypoint.cli.ts');

vi.setConfig({ testTimeout: 15_000 });

// Track all spawned processes so they can be cleaned up if the test worker exits
const activeProcesses = new Set<ChildProcessWithoutNullStreams>();

afterAll(() => {
  for (const proc of activeProcesses) {
    if (!proc.killed) {
      proc.kill('SIGKILL');
    }
  }
  activeProcesses.clear();
});

type RunBackportOptions = {
  timeoutSeconds?: number;
  showOra?: boolean;
  waitForString?: string;
  cwd?: string;
  keepAlive?: boolean;
};

export async function runBackportViaCli(
  backportArgs: string[],
  runBackportOptions: RunBackportOptions = {},
) {
  const chunks = '';
  const randomString = Math.random().toString(36).slice(2);
  const sandboxPath = getSandboxPath({
    filename: import.meta.filename,
    specname: randomString,
  });
  await resetSandbox(sandboxPath);

  const cmdArgs = [
    entrypointFile,
    `--log-file-path=${SANDBOX_PATH}/backport.log`,
    ...(backportArgs.some((arg) => arg.includes('--dir'))
      ? []
      : [`--dir=${sandboxPath}`]),
    ...backportArgs,
  ];

  const proc = spawn(tsxBinary, cmdArgs, { cwd: runBackportOptions.cwd });
  activeProcesses.add(proc);
  proc.on('exit', () => activeProcesses.delete(proc));
  return getPromise(proc, runBackportOptions, cmdArgs, chunks);
}

const keyCodeMap = {
  down: '\u001B\u005B\u0042',
  up: '\u001B\u005B\u0041',
  enter: '\u000D',
};
type KeyCode = keyof typeof keyCodeMap;

function getPromise(
  proc: ChildProcessWithoutNullStreams,
  runBackportOptions: RunBackportOptions,
  cmdArgs: string[],
  chunks: string,
) {
  if (proc.killed) {
    throw new Error(
      'Process is already killed. Did you forget `keepAlive: true`?',
    );
  }

  const {
    timeoutSeconds = 10,
    waitForString,
    showOra,
    keepAlive,
  } = runBackportOptions;

  return new Promise<{
    output: string;
    code: number | null;
    keypress: (
      keyCode: KeyCode,
      runBackportOptions?: RunBackportOptions,
    ) => Promise<{ output: string }>;
  }>((resolve, reject) => {
    const postponeTimeout = debounce(
      () => {
        const formattedChunks = formatChunk(chunks);
        const cmd = [tsxBinary, ...cmdArgs].join(' ');
        reject(
          waitForString
            ? `Expectation '${waitForString}' not found within ${timeoutSeconds} second in:\n\n${formattedChunks}\n\nCommand: ${cmd}`
            : `Process did not complete within ${timeoutSeconds} seconds. Received:\n${formattedChunks}\n\nCommand: ${cmd}`,
        );
      },
      timeoutSeconds * 1000,
      { maxWait: timeoutSeconds * 1000 },
    );

    function formatChunk(data: string) {
      return stripAnsi(data.toString()).trim();
    }

    function keypress(
      keyCode: KeyCode,
      runBackportOptions: RunBackportOptions = {},
    ) {
      const p = getPromise(proc, runBackportOptions, cmdArgs, chunks);
      proc.stdin.write(keyCodeMap[keyCode]);
      return p;
    }

    const onChunk = (chunk: string) => {
      chunks += chunk;
      const formattedChunk = formatChunk(chunk);

      if (waitForString && formattedChunk.includes(waitForString)) {
        postponeTimeout.cancel();
        resolve({ output: formatChunk(chunks), code: null, keypress });
      }
    };

    proc.on('exit', (code) => {
      postponeTimeout.cancel();
      if (waitForString) {
        reject(
          `runBackportViaCli exited before finding: ${waitForString}. Output: ${formatChunk(
            chunks,
          )}`,
        );
      } else {
        resolve({ output: formatChunk(chunks), code, keypress });
      }
    });

    proc.stdout.on('data', (chunk: string) => {
      postponeTimeout();
      onChunk(chunk);
    });

    // ora (loading spinner) is redirected to stderr
    proc.stderr.on('data', (chunk: string) => {
      postponeTimeout();
      if (showOra) {
        onChunk(chunk);
      }
    });

    proc.on('error', (err) => {
      reject(`runBackportViaCli failed with: ${err}`);
    });
  }).finally(() => {
    if (keepAlive) {
      proc.removeAllListeners('exit');
      proc.stdout.removeAllListeners('data');
      proc.stderr.removeAllListeners('data');
      proc.removeAllListeners('errors');
    } else {
      proc.kill('SIGKILL');
    }
  });
}
