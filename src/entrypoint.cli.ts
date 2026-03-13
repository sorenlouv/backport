import { backportRun } from './backport-run.js';
import { getRuntimeArguments } from './options/cli-args.js';
const processArgs = process.argv.slice(2);

// Suppress readline ERR_USE_AFTER_CLOSE errors that occur when running
// non-interactively (e.g. via spawnSync without a TTY). In ESM mode Node.js
// surfaces these as unhandled exceptions whereas CJS silently ignored them.
process.on('uncaughtException', (err) => {
  if (err && 'code' in err && err.code === 'ERR_USE_AFTER_CLOSE') {
    return;
  }
  console.error(err);
  process.exitCode = 1;
});

// this is the entrypoint when running from command line
void backportRun({ processArgs, exitCodeOnFailure: true }).then(
  (backportResponse) => {
    const { interactive, ls } = getRuntimeArguments(processArgs);

    if (!interactive || ls) {
      console.log(JSON.stringify(backportResponse));
    }
  },
);
