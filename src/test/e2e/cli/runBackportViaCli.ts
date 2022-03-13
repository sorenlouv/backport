import { spawn } from 'child_process';
import path from 'path';
import { debounce } from 'lodash';
import stripAnsi from 'strip-ansi';

const TIMEOUT_IN_SECONDS = 15;
jest.setTimeout(TIMEOUT_IN_SECONDS * 1000);

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
  const cmdArgs = [
    '--transpile-only',
    entrypointFile,
    '--log-file-path=/dev/null',
    ...backportArgs,
  ];

  const proc = spawn(tsNodeBinary, cmdArgs, { cwd });

  return new Promise<string>((resolve, reject) => {
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
        resolve(output);
      }
    };

    proc.on('exit', (code) => {
      const output = formatData(data);
      postponeTimeout.cancel();
      if (code !== null && code === 0) {
        resolve(output);
      } else {
        resolve(output);
      }
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
  }).finally(() => {
    proc.kill();
  });
}
