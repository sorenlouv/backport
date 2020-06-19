import yargs from 'yargs';
import { OptionsFromConfigFiles } from './config/config';

type Maybe<T> = T | undefined;
type BranchLabelMapping = Record<string, string> | undefined;

export type OptionsFromCliArgs = ReturnType<typeof getOptionsFromCliArgs>;
export function getOptionsFromCliArgs(
  configOptions: OptionsFromConfigFiles,
  argv: readonly string[]
) {
  const cliArgs = yargs(argv)
    .parserConfiguration({
      'strip-dashed': true,
      'strip-aliased': true,
      'boolean-negation': false,
    })
    .usage('$0 [args]')
    .wrap(Math.max(100, Math.min(120, yargs.terminalWidth())))

    .option('accessToken', {
      default: configOptions.accessToken as Maybe<string>,
      alias: 'accesstoken',
      description: 'Github access token',
      type: 'string',
    })

    .option('all', {
      default: configOptions.all,
      description: 'List all commits',
      alias: 'a',
      type: 'boolean',
    })

    .option('author', {
      default: configOptions.author as Maybe<string>,
      description: 'Show commits by specific author',
      type: 'string',
    })

    .option('dryRun', {
      default: false,
      description: 'Perform backport without pushing to Github',
      type: 'boolean',
    })

    .option('editor', {
      default: configOptions.editor as Maybe<string>,
      description: 'Editor to be opened during conflict resolution',
      type: 'string',
    })

    .option('fork', {
      default: configOptions.fork,
      description: 'Create backports in fork or origin repo',
      type: 'boolean',
    })

    .option('gitHostname', {
      hidden: true,
      default: configOptions.gitHostname,
      description: 'Hostname for Github',
      type: 'string',
    })

    .option('githubApiBaseUrlV3', {
      hidden: true,
      default: configOptions.githubApiBaseUrlV3,
      description: `Base url for Github's REST (v3) API`,
      type: 'string',
    })

    .option('githubApiBaseUrlV4', {
      hidden: true,
      default: configOptions.githubApiBaseUrlV4,
      description: `Base url for Github's GraphQL (v4) API`,
      type: 'string',
    })

    .option('mainline', {
      description:
        'Parent id of merge commit. Defaults to 1 when supplied without arguments',
      type: 'number',
      coerce: (mainline) => {
        // `--mainline` (default to 1 when no parent is given)
        if (mainline === undefined) {
          return 1;
        }

        // use specified mainline parent
        if (Number.isInteger(mainline)) {
          return mainline as number;
        }

        // Invalid value provided
        throw new Error(`--mainline must be an integer. Received: ${mainline}`);
      },
    })

    .option('maxNumber', {
      default: configOptions.maxNumber,
      description: 'Number of commits to choose from',
      alias: ['number', 'n'],
      type: 'number',
    })

    // cli-only
    .option('multiple', {
      description: 'Select multiple branches/commits',
      type: 'boolean',
    })

    .option('multipleCommits', {
      default: configOptions.multipleCommits,
      description: 'Backport multiple commits',
      type: 'boolean',
    })

    .option('multipleBranches', {
      default: configOptions.multipleBranches,
      description: 'Backport to multiple branches',
      type: 'boolean',
    })

    .option('noVerify', {
      default: configOptions.noVerify,
      description: 'Bypasses the pre-commit and commit-msg hooks',
      type: 'boolean',
    })

    .option('path', {
      default: configOptions.path as Maybe<string>,
      description: 'Only list commits touching files under the specified path',
      alias: 'p',
      type: 'string',
    })

    .option('prTitle', {
      default: configOptions.prTitle,
      description: 'Title of pull request',
      alias: 'title',
      type: 'string',
    })

    .option('prDescription', {
      default: configOptions.prDescription as Maybe<string>,
      description: 'Description to be added to pull request',
      alias: 'description',
      type: 'string',
    })

    .option('prFilter', {
      default: configOptions.prFilter as Maybe<string>,
      conflicts: ['pullNumber', 'sha'],
      description: `Filter source pull requests by a query`,
      type: 'string',
    })

    // cli-only
    .option('pullNumber', {
      conflicts: ['sha', 'prFilter'],
      description: 'Pull request to backport',
      alias: 'pr',
      type: 'number',
    })

    // cli-only
    .option('resetAuthor', {
      default: false,
      description: 'Set yourself as commit author',
      type: 'boolean',
    })

    // cli-only
    .option('sha', {
      conflicts: ['pullNumber', 'prFilter'],
      description: 'Commit sha to backport',
      alias: 'commit',
      type: 'string',
    })

    .option('sourceBranch', {
      default: configOptions.sourceBranch as Maybe<string>,
      description: `List commits to backport from another branch than master`,
      type: 'string',
    })

    .option('sourcePRLabels', {
      default: configOptions.sourcePRLabels,
      description: 'Add labels to the source (original) PR',
      alias: 'sourcePRLabel',
      type: 'array',
    })

    .option('targetBranches', {
      default: (configOptions.targetBranches || []) as string[],
      description: 'Branch(es) to backport to',
      alias: ['targetBranch', 'branch', 'b'],
      type: 'array',
      string: true, // ensure `6.0` is not coerced to `6`
    })

    .option('targetPRLabels', {
      default: configOptions.targetPRLabels,
      description: 'Add labels to the target (backport) PR',
      alias: ['labels', 'label', 'l'],
      type: 'array',
    })

    // cli-only
    .option('verify', {
      description: `Opposite of no-verify`,
      type: 'boolean',
    })

    .option('upstream', {
      default: configOptions.upstream as Maybe<string>,
      description: 'Name of repository',
      alias: 'up',
      type: 'string',
    })

    .option('username', {
      default: configOptions.username as Maybe<string>,
      description: 'Github username',
      type: 'string',
    })

    .option('verbose', {
      default: false,
      description: 'Show additional debug information',
      type: 'boolean',
    })
    .alias('version', 'v')
    .alias('version', 'V')
    .help()
    .epilogue(
      'For bugs, feature requests or questions: https://github.com/sqren/backport/issues\nOr contact me directly: https://twitter.com/sorenlouv'
    ).argv;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
  const { $0, _, verify, multiple, ...rest } = cliArgs;

  return {
    ...rest,

    // `branchLabelMapping` is not available as cli argument
    branchLabelMapping: configOptions.branchLabelMapping as BranchLabelMapping,

    // `multiple` is a cli-only flag to override `multipleBranches` and `multipleCommits`
    multipleBranches: multiple ?? cliArgs.multipleBranches,
    multipleCommits: multiple ?? cliArgs.multipleCommits,

    // `verify` is a cli-only flag to flip the default of `no-verify`
    noVerify: verify ?? rest.noVerify,

    // `targetBranchChoices` is not available as cli argument
    targetBranchChoices: configOptions.targetBranchChoices,
  };
}
