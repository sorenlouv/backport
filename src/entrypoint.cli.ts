import { backportRun } from './backport-run.js';
import { getRuntimeArguments } from './options/cli-args.js';
const processArgs = process.argv.slice(2);

// this is the entrypoint when running from command line
void backportRun({ processArgs, exitCodeOnFailure: true }).then(
  (backportResponse) => {
    const { interactive, ls } = getRuntimeArguments(processArgs);

    if (!interactive || ls) {
      console.log(JSON.stringify(backportResponse));
    }
  },
);
