import './lib/apm';
import apm from 'elastic-apm-node';
import { backportRun } from './backportRun';
import { getRuntimeArguments } from './options/cliArgs';
const processArgs = process.argv.slice(2);

// this is the entrypoint when running from command line
backportRun({ processArgs, exitCodeOnFailure: true }).then(
  (backportResponse) => {
    const { interactive, ls } = getRuntimeArguments(processArgs);

    if (!interactive || ls) {
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(backportResponse));
    }

    apm.endTransaction(backportResponse.status);
  }
);
