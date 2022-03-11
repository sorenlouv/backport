import yargsParser from 'yargs-parser';
import { backportRun } from './backportRun';
const processArgs = process.argv.slice(2);

// this is the entrypoint when running from command line
backportRun({ processArgs, exitCodeOnFailure: true }).then(
  (backportResponse) => {
    const { interactive, ls } = yargsParser(processArgs);

    if (!interactive || ls) {
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(backportResponse));
    }
  }
);
