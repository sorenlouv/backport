import { BackportOptions } from './options/options';
import { runWithArgs } from './runWithArgs';
const args = process.argv.slice(2);

// this is the entry point when importing backport as module:
// `import { run } from `backport`
export function run(options: Partial<BackportOptions>) {
  return runWithArgs(args, options);
}
