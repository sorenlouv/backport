import { BackportOptions } from '../options/options';
import { CommitSelected } from '../types/Commit';

export function shouldBackportViaApi(
  options: BackportOptions,
  commits: CommitSelected[]
) {
  return (
    // has exactly 1 PR to backport
    commits.length === 1 &&
    commits[0].pullNumber != undefined &&
    // restrict to ci for now
    options.ci &&
    // fork mode not supported via API
    (options.username === options.repoName || !options.fork) &&
    // `autoFixConflicts` is not supported via API
    !options.autoFixConflicts &&
    // `mainline` (merge commits) is not supported via API
    !options.mainline &&
    // `resetAuthor` is not supported via API
    !options.resetAuthor
  );
}
