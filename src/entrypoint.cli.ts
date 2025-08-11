import './lib/apm';
import apm from 'elastic-apm-node';
import { backportRun } from './backport-run';
import { getRuntimeArguments } from './options/cli-args';
const processArgs = process.argv.slice(2);

const apmTransaction = apm.startTransaction('CLI: backportRun');

// this is the entrypoint when running from command line
void backportRun({ processArgs, exitCodeOnFailure: true, apmTransaction }).then(
  (backportResponse) => {
    const { interactive, ls } = getRuntimeArguments(processArgs);

    if (!interactive || ls) {
      console.log(JSON.stringify(backportResponse));
    }

    apm.endTransaction(backportResponse.status);
  },
);
