import Handlebars from 'handlebars';
import type { ValidConfigOptions } from '../../../../options/options.js';
import { getPackageVersion } from '../../../../utils/package-version.js';
import { getSourceBranchFromCommits } from '../../../get-source-branch-from-commits.js';
import { logger } from '../../../logger.js';
import type { Commit } from '../../../sourceCommit/parse-source-commit.js';
import { getFirstLine, getShortSha } from '../../commit-formatters.js';

export function getPullRequestBody({
  options,
  commits,
  targetBranch,
  hasAnyCommitWithConflicts = false,
  unresolvedFiles = [],
}: {
  options: ValidConfigOptions;
  commits: Commit[];
  targetBranch: string;
  hasAnyCommitWithConflicts?: boolean;
  unresolvedFiles?: string[];
}) {
  const commitMessagesAsString = commits
    .map((c) => {
      const message = c.sourcePullRequest
        ? `[${getFirstLine(c.sourceCommit.message)}](${c.sourcePullRequest.url})`
        : `${getFirstLine(c.sourceCommit.message)} (${getShortSha(
            c.sourceCommit.sha,
          )})`;

      return ` - ${message}`;
    })
    .join('\n');

  const sourceBranch = getSourceBranchFromCommits(commits);

  const defaultPrDescription =
    '# Backport\n\n' +
    'This will backport the following commits from `{{sourceBranch}}` to `{{targetBranch}}`:\n' +
    '{{commitMessages}}\n\n' +
    '<!--- Backport version: {{PACKAGE_VERSION}} -->\n\n' +
    '### Questions ?\n' +
    'Please refer to the [Backport tool documentation](https://github.com/sorenlouv/backport)';

  const commitsStringified = stripMarkdownComments(
    `{{{{raw}}}}${JSON.stringify(commits)}{{{{/raw}}}}`,
  );

  const prDescription = (options.prDescription ?? defaultPrDescription)

    // replace defaultPrDescription
    .replaceAll('{{defaultPrDescription}}', defaultPrDescription)
    .replaceAll('{defaultPrDescription}', defaultPrDescription) // for backwards compatibility

    // replace commitMessages
    .replaceAll(
      '{{commitMessages}}',
      `{{{{raw}}}}${commitMessagesAsString}{{{{/raw}}}}`,
    )

    // replace commits
    .replaceAll('{{commits}}', '{{commitsAsJson}}')
    .replaceAll('{commits}', commitsStringified) // for backwards compatibility
    .replaceAll('{{commitsStringified}}', commitsStringified)
    .replaceAll('{{commitsAsJson}}', '{{commits}}')

    // replace sourceBranch and targetBranch
    .replaceAll('{{sourceBranch}}', sourceBranch)
    .replaceAll('{{targetBranch}}', targetBranch)

    // replace package version
    .replaceAll('{{PACKAGE_VERSION}}', getPackageVersion());

  let body: string;
  try {
    const template = Handlebars.compile(prDescription, { noEscape: true });
    body = template({
      sourcePullRequest: commits.at(0)?.sourcePullRequest, // assume that all commits are from the same PR
      commits,
    });
  } catch (error) {
    logger.error('Could not compile PR description', error);
    body = prDescription
      .replaceAll('{{{{raw}}}}', '')
      .replaceAll('{{{{/raw}}}}', '');
  }

  if (hasAnyCommitWithConflicts) {
    body += getConflictResolutionNote(
      options.conflictResolution,
      unresolvedFiles,
    );
  }

  return body;
}

function getConflictResolutionNote(
  conflictResolution: ValidConfigOptions['conflictResolution'],
  unresolvedFiles: string[],
): string {
  const header = '\n\n---\n';

  // `commit` mode commits files with raw conflict markers checked in;
  // `theirs` retries the cherry-pick with --strategy-option=theirs. Both end
  // up with files the reviewer must look at — same trailer shape, different
  // base text and file-list label.
  const { base, fileListLabel } =
    conflictResolution === 'commit'
      ? {
          base:
            '**Note:** This PR was created with conflict markers committed verbatim ' +
            "to the affected files (`conflictResolution: 'commit'`). " +
            'The conflicting hunks must be resolved manually before this PR can be merged.',
          fileListLabel:
            'The following files contain committed conflict markers:',
        }
      : {
          base:
            '**Note:** This PR was created with conflicts auto-resolved in favor of the source commit ' +
            '(`--strategy-option=theirs`). Please review the changes carefully.',
          fileListLabel:
            'The following files still had unresolved conflicts after the retry:',
        };

  const note = header + base;
  if (unresolvedFiles.length === 0) {
    return note;
  }

  const fileList = unresolvedFiles.map((f) => `\n - \`${f}\``).join('');
  return note + `\n\n${fileListLabel}${fileList}`;
}

function stripMarkdownComments(str: string): string {
  return str.replaceAll(/<!--[\s\S]*?-->/g, '');
}
