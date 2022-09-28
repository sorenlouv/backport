import { backportRun } from './backportRun';
import { apm } from './lib/apm';
import { getRuntimeArguments } from './options/cliArgs';
const processArgs = process.argv.slice(2);

apm.startTransaction('cli backport');

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
