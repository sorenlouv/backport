import Handlebars from 'handlebars';
import type { ValidConfigOptions } from '../../../../options/options';
import { getPackageVersion } from '../../../../utils/package-version';
import { getSourceBranchFromCommits } from '../../../get-source-branch-from-commits';
import { logger } from '../../../logger';
import type { Commit } from '../../../sourceCommit/parse-source-commit';
import { getFirstLine, getShortSha } from '../../commit-formatters';

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
      sourcePullRequest: commits[0].sourcePullRequest, // assume that all commits are from the same PR
      commits,
    });
  } catch (e) {
    logger.error('Could not compile PR description', e);
    body = prDescription
      .replaceAll('{{{{raw}}}}', '')
      .replaceAll('{{{{/raw}}}}', '');
  }

  if (hasAnyCommitWithConflicts) {
    body += getConflictResolutionNote(unresolvedFiles);
  }

  return body;
}

function getConflictResolutionNote(unresolvedFiles: string[]): string {
  const base =
    '\n\n---\n' +
    '**Note:** This PR was created with conflicts auto-resolved in favor of the source commit ' +
    '(`--strategy-option=theirs`). Please review the changes carefully.';

  if (unresolvedFiles.length === 0) {
    return base;
  }

  const fileList = unresolvedFiles.map((f) => `\n - \`${f}\``).join('');
  return (
    base +
    `\n\nThe following files still had unresolved conflicts after the retry:${fileList}`
  );
}

function stripMarkdownComments(str: string): string {
  return str.replace(/<!--[\s\S]*?-->/g, '');
}
