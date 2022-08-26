import { Commit } from '../../../entrypoint.module';
import { ValidConfigOptions } from '../../../options/options';
import { getPullRequestBody, getTitle } from './createPullRequest';

describe('getPullRequestBody', () => {
  it('when single pull request is backported', () => {
    expect(
      getPullRequestBody({
        options: {} as ValidConfigOptions,
        commits: [
          {
            author: {
              email: 'soren.louv@elastic.co',
              name: 'Søren Louv-Jansen',
            },
            sourcePullRequest: {
              labels: [],
              number: 55,
              url: 'https://github.com/backport-org/different-merge-strategies/pull/55',
              mergeCommit: {
                sha: 'abcdefghi',
                message: 'My commit message (#55)',
              },
            },

            suggestedTargetBranches: [],
            sourceCommit: {
              branchLabelMapping: {},
              committedDate: '2020',
              sha: 'abcdefghi',
              message: 'My commit message (#55)',
            },

            targetPullRequestStates: [],
            sourceBranch: 'master',
          },
        ],

        targetBranch: '7.x',
      })
    ).toMatchInlineSnapshot(`
      "# Backport

      This will backport the following commits from \`master\` to \`7.x\`:
       - [My commit message (#55)](https://github.com/backport-org/different-merge-strategies/pull/55)

      <!--- Backport version: 1.2.3-mocked -->

      ### Questions ?
      Please refer to the [Backport tool documentation](https://github.com/sqren/backport)"
    `);
  });

  it('when a single commit (non pull request) is backported', () => {
    expect(
      getPullRequestBody({
        options: {} as ValidConfigOptions,
        commits: [
          {
            author: {
              email: 'soren.louv@elastic.co',
              name: 'Søren Louv-Jansen',
            },
            suggestedTargetBranches: [],
            sourceCommit: {
              branchLabelMapping: {},
              committedDate: '',
              sha: 'abcdefghijklmw',
              message: 'My commit message',
            },

            sourceBranch: 'main',
            targetPullRequestStates: [],
          },
        ],

        targetBranch: '7.x',
      })
    ).toMatchInlineSnapshot(`
      "# Backport

      This will backport the following commits from \`main\` to \`7.x\`:
       - My commit message (abcdefgh)

      <!--- Backport version: 1.2.3-mocked -->

      ### Questions ?
      Please refer to the [Backport tool documentation](https://github.com/sqren/backport)"
    `);
  });

  it('when multiple commits are backported', () => {
    expect(
      getPullRequestBody({
        options: {} as ValidConfigOptions,
        commits: [
          {
            author: {
              email: 'soren.louv@elastic.co',
              name: 'Søren Louv-Jansen',
            },
            sourcePullRequest: {
              labels: [],
              number: 55,
              url: 'https://github.com/backport-org/different-merge-strategies/pull/55',
              mergeCommit: {
                sha: 'abcdefghijklm',
                message: 'My commit message (#55)',
              },
            },

            suggestedTargetBranches: [],
            sourceCommit: {
              branchLabelMapping: {},
              committedDate: '',
              sha: 'abcdefghijklm',
              message: 'My commit message (#55)',
            },

            sourceBranch: 'main',
            targetPullRequestStates: [],
          },

          {
            author: {
              email: 'soren.louv@elastic.co',
              name: 'Søren Louv-Jansen',
            },
            suggestedTargetBranches: [],
            sourceCommit: {
              branchLabelMapping: {},
              committedDate: '',
              sha: 'qwertyuiop',
              message: 'Another commit message',
            },

            sourceBranch: 'main',
            targetPullRequestStates: [],
          },
        ],

        targetBranch: '7.x',
      })
    ).toMatchInlineSnapshot(`
      "# Backport

      This will backport the following commits from \`main\` to \`7.x\`:
       - [My commit message (#55)](https://github.com/backport-org/different-merge-strategies/pull/55)
       - Another commit message (qwertyui)

      <!--- Backport version: 1.2.3-mocked -->

      ### Questions ?
      Please refer to the [Backport tool documentation](https://github.com/sqren/backport)"
    `);
  });

  it('when a PR is merged (instead of squashed) and the individual commits are selected', () => {
    expect(
      getPullRequestBody({
        options: {} as ValidConfigOptions,
        commits: [
          {
            suggestedTargetBranches: [],
            sourceCommit: {
              branchLabelMapping: {},
              committedDate: '2022-02-07T23:53:14Z',
              message: 'Merge strategy: Second commit',
              sha: 'e8df5eaa4db7b94474b48e2320b02d33a830d9fb',
            },

            author: {
              email: 'soren.louv@elastic.co',
              name: 'Søren Louv-Jansen',
            },
            sourcePullRequest: {
              labels: [],
              number: 1,
              url: 'https://github.com/backport-org/different-merge-strategies/pull/1',
              mergeCommit: {
                message:
                  'Merge pull request #1 from backport-org/merge-strategy\n\nMerge commits to `main`',
                sha: '0db7f1ac1233461563d8708511d1c14adbab46da',
              },
            },

            sourceBranch: 'main',
            targetPullRequestStates: [],
          },

          {
            suggestedTargetBranches: [],
            sourceCommit: {
              branchLabelMapping: {},
              committedDate: '2022-02-07T23:51:59Z',
              message: 'Merge strategy: First commit',
              sha: '5411b1c1144093e422220008f23f2c2b909ed113',
            },

            author: {
              email: 'soren.louv@elastic.co',
              name: 'Søren Louv-Jansen',
            },
            sourcePullRequest: {
              labels: [],
              number: 1,
              url: 'https://github.com/backport-org/different-merge-strategies/pull/1',
              mergeCommit: {
                message:
                  'Merge pull request #1 from backport-org/merge-strategy\n\nMerge commits to `main`',
                sha: '0db7f1ac1233461563d8708511d1c14adbab46da',
              },
            },

            sourceBranch: 'main',
            targetPullRequestStates: [],
          },
        ],

        targetBranch: '7.x',
      })
    ).toMatchInlineSnapshot(`
      "# Backport

      This will backport the following commits from \`main\` to \`7.x\`:
       - [Merge strategy: Second commit](https://github.com/backport-org/different-merge-strategies/pull/1)
       - [Merge strategy: First commit](https://github.com/backport-org/different-merge-strategies/pull/1)

      <!--- Backport version: 1.2.3-mocked -->

      ### Questions ?
      Please refer to the [Backport tool documentation](https://github.com/sqren/backport)"
    `);
  });

  it('replaces template variables in PR description', () => {
    expect(
      getPullRequestBody({
        options: {
          prDescription:
            'Backporting the following to {targetBranch}:\n{commitMessages}',
        } as ValidConfigOptions,
        commits: [
          {
            author: {
              email: 'soren.louv@elastic.co',
              name: 'Søren Louv-Jansen',
            },
            sourcePullRequest: {
              labels: [],
              number: 55,
              url: 'https://github.com/backport-org/different-merge-strategies/pull/55',
              mergeCommit: {
                sha: 'abcdefghijklm',
                message: 'My commit message (#55)',
              },
            },
            suggestedTargetBranches: [],
            sourceCommit: {
              branchLabelMapping: {},
              committedDate: '',
              sha: 'abcdefghijklm',
              message: 'My commit message (#55)',
            },
            sourceBranch: 'main',
            targetPullRequestStates: [],
          },
          {
            author: {
              email: 'soren.louv@elastic.co',
              name: 'Søren Louv-Jansen',
            },
            suggestedTargetBranches: [],
            sourceCommit: {
              branchLabelMapping: {},
              committedDate: '',
              sha: 'qwertyuiop',
              message: 'Another commit message',
            },
            sourceBranch: 'main',
            targetPullRequestStates: [],
          },
        ],

        targetBranch: '7.x',
      })
    ).toMatchInlineSnapshot(`
      "Backporting the following to 7.x:
       - [My commit message (#55)](https://github.com/backport-org/different-merge-strategies/pull/55)
       - Another commit message (qwertyui)"
    `);
  });

  it('replaces {defaultPrDescription} with the default pr description', () => {
    const commits = [
      {
        sourcePullRequest: {
          url: 'https://github.com/backport-org/different-merge-strategies/pull/55',
        },
        sourceCommit: {
          sha: 'abcdefghijklm',
          message: 'My commit message (#55)',
        },
        sourceBranch: 'main',
      },
      {
        sourceCommit: {
          sha: 'qwertyuiop',
          message: 'Another commit message',
        },
      },
    ] as Commit[];

    const options = {
      prDescription: '{defaultPrDescription}\n\ntext to append',
    } as ValidConfigOptions;

    expect(getPullRequestBody({ options, commits, targetBranch: '7.x' }))
      .toMatchInlineSnapshot(`
      "# Backport

      This will backport the following commits from \`main\` to \`7.x\`:
       - [My commit message (#55)](https://github.com/backport-org/different-merge-strategies/pull/55)
       - Another commit message (qwertyui)

      <!--- Backport version: 1.2.3-mocked -->

      ### Questions ?
      Please refer to the [Backport tool documentation](https://github.com/sqren/backport)

      text to append"
    `);
  });

  it('replaces {commits} with a stringified commits object', () => {
    const commits = [
      {
        sourceCommit: {
          sha: 'foo',
          message: 'My commit message (#55)',
        },
      },
      {
        sourceCommit: {
          sha: 'bar',
          message: 'Another commit message',
        },
      },
    ] as Commit[];

    const options = {
      prDescription: 'Just output the commits: {commits}',
    } as ValidConfigOptions;

    expect(
      getPullRequestBody({ options, commits, targetBranch: '7.x' })
    ).toMatchInlineSnapshot(
      `"Just output the commits: [{"sourceCommit":{"sha":"foo","message":"My commit message (#55)"}},{"sourceCommit":{"sha":"bar","message":"Another commit message"}}]"`
    );
  });
});

describe('getTitle', () => {
  it('has the default title', () => {
    expect(
      getTitle({
        options: {} as ValidConfigOptions,
        commits: [
          {
            author: {
              email: 'soren.louv@elastic.co',
              name: 'Søren Louv-Jansen',
            },
            sourceBranch: 'main',
            sourcePullRequest: {
              labels: [],
              number: 55,
              url: 'https://github.com/backport-org/different-merge-strategies/pull/55',
              mergeCommit: {
                sha: 'abcdefghi',
                message: 'My commit message (#55)',
              },
            },
            suggestedTargetBranches: [],
            sourceCommit: {
              branchLabelMapping: {},
              committedDate: '2020',
              sha: 'abcdefghi',
              message: 'My commit message (#55)',
            },
            targetPullRequestStates: [],
          },
          {
            author: {
              email: 'soren.louv@elastic.co',
              name: 'Søren Louv-Jansen',
            },
            sourcePullRequest: {
              labels: [],
              number: 56,
              url: 'https://github.com/backport-org/different-merge-strategies/pull/56',
              mergeCommit: {
                sha: 'jklmnopqr',
                message: 'Another commit message (#56)',
              },
            },
            suggestedTargetBranches: [],
            sourceCommit: {
              branchLabelMapping: {},
              committedDate: '2020',
              sha: 'jklmnopqr',
              message: 'Another commit message (#56)',
            },
            sourceBranch: 'main',
            targetPullRequestStates: [],
          },
        ],
        targetBranch: '7.x',
      })
    ).toEqual('[7.x] My commit message (#55) | Another commit message (#56)');
  });

  it('replaces template variables in PR title', () => {
    expect(
      getTitle({
        options: {
          prTitle: 'Branch: "{targetBranch}". Messages: {commitMessages}',
        } as ValidConfigOptions,
        commits: [
          {
            author: {
              email: 'soren.louv@elastic.co',
              name: 'Søren Louv-Jansen',
            },
            sourcePullRequest: {
              labels: [],
              number: 55,
              url: 'https://github.com/backport-org/different-merge-strategies/pull/55',
              mergeCommit: {
                sha: 'abcdefghi',
                message: 'My commit message (#55)',
              },
            },
            suggestedTargetBranches: [],
            sourceCommit: {
              branchLabelMapping: {},
              committedDate: '',
              sha: 'abcdefghi',
              message: 'My commit message (#55)',
            },
            sourceBranch: 'main',
            targetPullRequestStates: [],
          },
        ],
        targetBranch: '7.x',
      })
    ).toEqual('Branch: "7.x". Messages: My commit message (#55)');
  });
});
