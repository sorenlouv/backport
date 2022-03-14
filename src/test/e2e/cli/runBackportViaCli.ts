import { spawn } from 'child_process';
import path from 'path';
import { debounce } from 'lodash';
import stripAnsi from 'strip-ansi';
import { getSandboxPath, resetSandbox } from '../../sandbox';

jest.setTimeout(15_000);

export function runBackportViaCli(
  backportArgs: string[],
  {
    timeoutSeconds = 2,
    showOra,
    waitForString,
    cwd,
  }: {
    timeoutSeconds?: number;
    showOra?: boolean;
    waitForString?: string;
    cwd?: string;
  } = {}
) {
  const tsNodeBinary = path.resolve('./node_modules/.bin/ts-node');
  const entrypointFile = path.resolve('./src/entrypoint.cli.ts');
  const randomString = Math.random().toString(36).slice(2);
  const sandboxPath = getSandboxPath({
    filename: __filename,
    specname: randomString,
  });
  resetSandbox(sandboxPath);

  const cmdArgs = [
    '--transpile-only',
    entrypointFile,
    '--log-file-path=/dev/null',
    ...(backportArgs.some((arg) => arg.includes('--dir'))
      ? []
      : [`--dir=${sandboxPath}`]),
    ...backportArgs,
  ];

  const proc = spawn(tsNodeBinary, cmdArgs, { cwd });

  return new Promise<{ output: string; code: number | null }>(
    (resolve, reject) => {
      let data = '';

      const postponeTimeout = debounce(
        () => {
          const formattedData = formatData(data);
          const cmd = [tsNodeBinary, ...cmdArgs].join(' ');
          reject(
            waitForString
              ? `Expectation '${waitForString}' not found within ${timeoutSeconds} second in:\n\n${formattedData}\n\nCommand: ${cmd}`
              : `Timeout. Received:\n${formattedData}\n\nCommand: ${cmd}`
          );
        },
        timeoutSeconds * 1000,
        { maxWait: 15000 }
      );

      function formatData(data: string) {
        return stripAnsi(data.toString()).trim();
      }

      const onChunk = (chunk: any) => {
        data += chunk;
        const output = formatData(data);

        if (waitForString && output.includes(waitForString)) {
          postponeTimeout.cancel();
          resolve({ output, code: null });
        }
      };

      proc.on('exit', (code) => {
        postponeTimeout.cancel();
        resolve({ output: formatData(data), code });
      });

      proc.stdout.on('data', (chunk: any) => {
        postponeTimeout();
        onChunk(chunk);
      });

      // ora (loading spinner) is redirected to stderr
      proc.stderr.on('data', (chunk: any) => {
        postponeTimeout();
        if (showOra) {
          onChunk(chunk);
        }
      });

      proc.on('error', (err) => {
        reject(`runBackportViaCli failed with: ${err}`);
      });
    }
  ).finally(() => {
    proc.kill();
  });
}
