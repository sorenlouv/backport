import {
  BackportFailureResponse,
  BackportSuccessResponse,
} from './backportRun';
import { backportRun, Commit, getCommits } from './entrypoint.module';
import { getFirstLine } from './lib/github/commitFormatters';
import { getDevAccessToken } from './test/private/getDevAccessToken';

const accessToken = getDevAccessToken();

jest.unmock('del');
jest.unmock('make-dir');
jest.unmock('find-up');

describe('entrypoint.module', () => {
  describe('backportRun', () => {
    describe('when running into merge conflict', () => {
      let response: BackportSuccessResponse;
      beforeAll(async () => {
        response = (await backportRun({
          options: {
            repoOwner: 'backport-org',
            repoName: 'repo-with-conflicts',
            interactive: false,
            accessToken,
            pullNumber: 12,
            targetBranches: ['7.x'],
          },
        })) as BackportSuccessResponse;
      });

      it('should have overall status=success', async () => {
        expect(response.status).toBe('success');
      });

      it('should fail with "handled-error"', () => {
        expect(response.results[0].status).toBe('handled-error');
      });

      it('should have correct error code', () => {
        //@ts-expect-error
        expect(response.results[0].error.errorContext.code).toBe(
          'merge-conflict-exception'
        );

        //@ts-expect-error
        expect(response.results[0].error.message).toBe(
          'Commit could not be cherrypicked due to conflicts in: la-liga.md'
        );
      });

      it('contains a list of conflicting files', () => {
        //@ts-expect-error
        expect(response.results[0].error.errorContext.conflictingFiles).toEqual(
          ['la-liga.md']
        );
      });
    });

    describe('when target branch in branchLabelMapping is invalid', () => {
      let response: BackportSuccessResponse;
      beforeAll(async () => {
        response = (await backportRun({
          options: {
            accessToken,
            branchLabelMapping: {
              [`^backport-to-(.+)$`]: '$1',
            },
            interactive: false,
            pullNumber: 1,
            repoName: 'repo-with-invalid-target-branch-label',
            repoOwner: 'backport-org',
          },
        })) as BackportSuccessResponse;
      });

      it('should return handled error', async () => {
        expect(response.status).toBe('success');
        // @ts-expect-error
        expect(response.results[0].error.errorContext).toEqual({
          code: 'invalid-branch-exception',
          message: 'The branch "--foo" does not exist',
        });
      });
    });

    describe('when missing branches to backport to', () => {
      let response: BackportFailureResponse;
      beforeAll(async () => {
        response = (await backportRun({
          options: {
            repoOwner: 'backport-org',
            repoName: 'repo-with-conflicts',
            interactive: false,
            accessToken,
            pullNumber: 12,
          },
        })) as BackportFailureResponse;
      });

      it('should correct error code', async () => {
        expect(response.status).toBe('aborted');
        //@ts-expect-error
        expect(response.error.errorContext.code).toBe('no-branches-exception');
        expect(response.error.message).toBe(
          'There are no branches to backport to. Aborting.'
        );
      });
    });

    describe('when backporting', () => {
      let response: BackportSuccessResponse;
      beforeAll(async () => {
        response = (await backportRun({
          options: {
            repoOwner: 'backport-org',
            repoName: 'repo-with-conflicts',
            interactive: false,
            accessToken,
            pullNumber: 8,
            dryRun: true,
          },
        })) as BackportSuccessResponse;
      });

      it('should return successful backport response', async () => {
        expect(response.status).toBe('success');
        expect(response).toEqual({
          status: 'success',
          results: [
            {
              status: 'success',
              didUpdate: false,
              pullRequestNumber: 1337,
              pullRequestUrl: 'https://localhost/dry-run',
              targetBranch: '7.x',
            },
          ],
          commits: [
            {
              author: {
                email: 'sorenlouv@gmail.com',
                name: 'Søren Louv-Jansen',
              },
              suggestedTargetBranches: ['7.x'],
              pullRequestStates: [
                {
                  branch: '7.x',
                  label: 'backport-to-7.x',
                  isSourceBranch: false,
                  state: 'NOT_CREATED',
                },
              ],
              sourceBranch: 'main',
              sourceCommit: {
                committedDate: '2021-12-16T00:03:34Z',
                message: 'Change Barca to Braithwaite (#8)',
                sha: '343402a748be2375325b2730fa979bcea5b96ba1',
              },
              sourcePullRequest: {
                mergeCommit: {
                  message: 'Change Barca to Braithwaite (#8)',
                  sha: '343402a748be2375325b2730fa979bcea5b96ba1',
                },
                number: 8,
                url: 'https://github.com/backport-org/repo-with-conflicts/pull/8',
              },
            },
          ],
        });
      });
    });
  });

  describe('getCommits', () => {
    it('pullNumber', async () => {
      const commits = await getCommits({
        accessToken: accessToken,
        repoName: 'kibana',
        repoOwner: 'elastic',
        pullNumber: 88188,
      });

      const expectedCommits: Commit[] = [
        {
          author: { name: 'Søren Louv-Jansen', email: 'sorenlouv@gmail.com' },
          suggestedTargetBranches: [],
          sourceCommit: {
            branchLabelMapping: {
              '^v(\\d+).(\\d+).\\d+$': '$1.$2',
              '^v7.12.0$': '7.x',
              '^v8.0.0$': 'master',
            },
            committedDate: '2021-01-13T20:01:44Z',
            message:
              '[APM] Fix incorrect table column header (95th instead of avg) (#88188)',
            sha: 'd1b348e6213c5ad48653dfaad6eaf4928b2c688b',
          },
          sourcePullRequest: {
            number: 88188,
            url: 'https://github.com/elastic/kibana/pull/88188',
            mergeCommit: {
              message:
                '[APM] Fix incorrect table column header (95th instead of avg) (#88188)',
              sha: 'd1b348e6213c5ad48653dfaad6eaf4928b2c688b',
            },
          },
          sourceBranch: 'master',
          pullRequestStates: [
            {
              branch: '7.11',
              isSourceBranch: false,
              label: 'v7.11.0',
              mergeCommit: {
                message:
                  '[APM] Fix incorrect table column header (95th instead of avg) (#88188) (#88289)',
                sha: 'b8194e9ec27d69f485d8b194d1cb5e4f6d8fef6d',
              },
              number: 88289,
              state: 'MERGED',
              url: 'https://github.com/elastic/kibana/pull/88289',
            },
            {
              branch: '7.x',
              mergeCommit: {
                message:
                  '[7.x] [APM] Fix incorrect table column header (95th instead of avg) (#88188) (#88288)\n\nCo-authored-by: Kibana Machine <42973632+kibanamachine@users.noreply.github.com>',
                sha: '52710be7add6811ec4783c7d383d4159c0aa76f5',
              },
              number: 88288,
              state: 'MERGED',
              url: 'https://github.com/elastic/kibana/pull/88288',
            },
          ],
        },
      ];
      expect(commits).toEqual(expectedCommits);
    });

    it('sha', async () => {
      const commits = await getCommits({
        accessToken: accessToken,
        repoName: 'kibana',
        repoOwner: 'elastic',
        sha: 'd1b348e6213c5ad48653dfaad6eaf4928b2c688b',
      });

      const expectedCommits: Commit[] = [
        {
          author: { name: 'Søren Louv-Jansen', email: 'sorenlouv@gmail.com' },
          suggestedTargetBranches: [],
          sourceCommit: {
            branchLabelMapping: {
              '^v(\\d+).(\\d+).\\d+$': '$1.$2',
              '^v7.12.0$': '7.x',
              '^v8.0.0$': 'master',
            },
            committedDate: '2021-01-13T20:01:44Z',
            message:
              '[APM] Fix incorrect table column header (95th instead of avg) (#88188)',
            sha: 'd1b348e6213c5ad48653dfaad6eaf4928b2c688b',
          },
          sourcePullRequest: {
            number: 88188,
            url: 'https://github.com/elastic/kibana/pull/88188',
            mergeCommit: {
              message:
                '[APM] Fix incorrect table column header (95th instead of avg) (#88188)',
              sha: 'd1b348e6213c5ad48653dfaad6eaf4928b2c688b',
            },
          },
          sourceBranch: 'master',
          pullRequestStates: [
            {
              url: 'https://github.com/elastic/kibana/pull/88289',
              number: 88289,
              branch: '7.11',
              label: 'v7.11.0',
              isSourceBranch: false,
              state: 'MERGED',
              mergeCommit: {
                sha: 'b8194e9ec27d69f485d8b194d1cb5e4f6d8fef6d',
                message:
                  '[APM] Fix incorrect table column header (95th instead of avg) (#88188) (#88289)',
              },
            },
            {
              url: 'https://github.com/elastic/kibana/pull/88288',
              number: 88288,
              branch: '7.x',
              state: 'MERGED',
              mergeCommit: {
                sha: '52710be7add6811ec4783c7d383d4159c0aa76f5',
                message:
                  '[7.x] [APM] Fix incorrect table column header (95th instead of avg) (#88188) (#88288)\n\nCo-authored-by: Kibana Machine <42973632+kibanamachine@users.noreply.github.com>',
              },
            },
          ],
        },
      ];

      expect(commits).toEqual(expectedCommits);
    });

    it('prFilter', async () => {
      const commits = await getCommits({
        accessToken: accessToken,
        repoName: 'kibana',
        repoOwner: 'elastic',
        dateUntil: '2021-06-02',
        prFilter: 'label:Team:apm base:master',
        maxNumber: 3,
      });

      const commitMessage = commits.map((commit) => {
        return {
          ...commit.sourceCommit,
          message: getFirstLine(commit.sourceCommit.message),
          branchLabelMapping: undefined,
        };
      });

      expect(commitMessage).toMatchInlineSnapshot(`
        Array [
          Object {
            "branchLabelMapping": undefined,
            "committedDate": "2021-05-28T12:41:42Z",
            "message": "[Observability] Fix typo in readme for new navigation (#100861)",
            "sha": "79945fe0275b2ec9c93747e26154110133ec51fb",
          },
          Object {
            "branchLabelMapping": undefined,
            "committedDate": "2021-05-28T19:43:30Z",
            "message": "[APM] Move APM tutorial from apm_oss to x-pack/apm (#100780)",
            "sha": "0bcd78b0e999feb95057f5e6eafdb572b9b2fe39",
          },
          Object {
            "branchLabelMapping": undefined,
            "committedDate": "2021-05-18T10:33:16Z",
            "message": "Migrate from Joi to @kbn/config-schema in \\"home\\" and \\"features\\" plugins (#100201)",
            "sha": "574f6595ad2e5452fa90e6a3111220a599e473c0",
          },
        ]
      `);
    });

    it('author', async () => {
      const commits = await getCommits({
        accessToken: accessToken,
        repoName: 'kibana',
        repoOwner: 'elastic',
        author: 'sqren',
        dateUntil: '2021-01-01T10:00:00Z',
        maxNumber: 3,
      });

      expect(commits).toMatchInlineSnapshot(`
        Array [
          Object {
            "author": Object {
              "email": "sorenlouv@gmail.com",
              "name": "Søren Louv-Jansen",
            },
            "pullRequestStates": Array [
              Object {
                "branch": "7.x",
                "isSourceBranch": false,
                "label": "v7.11.0",
                "mergeCommit": Object {
                  "message": "[APM] Fix broken link to ML when time range is not set (#85976) (#86227)

        Co-authored-by: Kibana Machine <42973632+kibanamachine@users.noreply.github.com>",
                  "sha": "2d361f018e0776c237d03b84ca8aa24615d16d99",
                },
                "number": 86227,
                "state": "MERGED",
                "url": "https://github.com/elastic/kibana/pull/86227",
              },
              Object {
                "branch": "7.11",
                "mergeCommit": Object {
                  "message": "[APM] Fix broken link to ML when time range is not set (#85976) (#86228)",
                  "sha": "c6c0015e01601cd852730d5cd20e1a906cbee900",
                },
                "number": 86228,
                "state": "MERGED",
                "url": "https://github.com/elastic/kibana/pull/86228",
              },
            ],
            "sourceBranch": "master",
            "sourceCommit": Object {
              "branchLabelMapping": Object {
                "^v(\\\\d+).(\\\\d+).\\\\d+$": "$1.$2",
                "^v7.11.0$": "7.x",
                "^v8.0.0$": "master",
              },
              "committedDate": "2020-12-16T15:17:03Z",
              "message": "[APM] Fix broken link to ML when time range is not set (#85976)",
              "sha": "744d6809ded7e1055bfda280c351cee3e8c0e3bf",
            },
            "sourcePullRequest": Object {
              "mergeCommit": Object {
                "message": "[APM] Fix broken link to ML when time range is not set (#85976)",
                "sha": "744d6809ded7e1055bfda280c351cee3e8c0e3bf",
              },
              "number": 85976,
              "url": "https://github.com/elastic/kibana/pull/85976",
            },
            "suggestedTargetBranches": Array [],
          },
          Object {
            "author": Object {
              "email": "sorenlouv@gmail.com",
              "name": "Søren Louv-Jansen",
            },
            "pullRequestStates": Array [
              Object {
                "branch": "7.x",
                "isSourceBranch": false,
                "label": "v7.11.0",
                "mergeCommit": Object {
                  "message": "[7.x] [APM] Correlations polish (#85116) (#85940)

        Co-authored-by: Kibana Machine <42973632+kibanamachine@users.noreply.github.com>",
                  "sha": "42b3ecb40c344cd57800b8fa387ae32bad24bfc4",
                },
                "number": 85940,
                "state": "MERGED",
                "url": "https://github.com/elastic/kibana/pull/85940",
              },
            ],
            "sourceBranch": "master",
            "sourceCommit": Object {
              "branchLabelMapping": Object {
                "^v(\\\\d+).(\\\\d+).\\\\d+$": "$1.$2",
                "^v7.11.0$": "7.x",
                "^v8.0.0$": "master",
              },
              "committedDate": "2020-12-15T12:15:00Z",
              "message": "[APM] Correlations polish (#85116)

        Co-authored-by: Kibana Machine <42973632+kibanamachine@users.noreply.github.com>",
              "sha": "20638a64e2a895d4e4a6597d4a37b5db7003f1e9",
            },
            "sourcePullRequest": Object {
              "mergeCommit": Object {
                "message": "[APM] Correlations polish (#85116)

        Co-authored-by: Kibana Machine <42973632+kibanamachine@users.noreply.github.com>",
                "sha": "20638a64e2a895d4e4a6597d4a37b5db7003f1e9",
              },
              "number": 85116,
              "url": "https://github.com/elastic/kibana/pull/85116",
            },
            "suggestedTargetBranches": Array [],
          },
          Object {
            "author": Object {
              "email": "sorenlouv@gmail.com",
              "name": "Søren Louv-Jansen",
            },
            "pullRequestStates": Array [
              Object {
                "branch": "7.x",
                "isSourceBranch": false,
                "label": "v7.11.0",
                "mergeCommit": Object {
                  "message": "[7.x] [APM] Improve pointer event hook (#85117) (#85142)",
                  "sha": "3b72a4f3cc7c0abd0541073e1d0246b85cea3def",
                },
                "number": 85142,
                "state": "MERGED",
                "url": "https://github.com/elastic/kibana/pull/85142",
              },
            ],
            "sourceBranch": "master",
            "sourceCommit": Object {
              "branchLabelMapping": Object {
                "^v(\\\\d+).(\\\\d+).\\\\d+$": "$1.$2",
                "^v7.11.0$": "7.x",
                "^v8.0.0$": "master",
              },
              "committedDate": "2020-12-07T14:43:58Z",
              "message": "[APM] Improve pointer event hook (#85117)",
              "sha": "cee681afb3c5f87371112fab9a7e5dddbafea0a8",
            },
            "sourcePullRequest": Object {
              "mergeCommit": Object {
                "message": "[APM] Improve pointer event hook (#85117)",
                "sha": "cee681afb3c5f87371112fab9a7e5dddbafea0a8",
              },
              "number": 85117,
              "url": "https://github.com/elastic/kibana/pull/85117",
            },
            "suggestedTargetBranches": Array [],
          },
        ]
      `);
    });

    it('throws when missing a filter', async () => {
      await expect(() =>
        getCommits({
          accessToken: accessToken,
          repoName: 'kibana',
          repoOwner: 'elastic',
          maxNumber: 3,
        })
      ).rejects.toThrowError(
        'Must supply one of: `pullNumber`, `sha`, `prFilter` or `author`'
      );
    });
  });
});
