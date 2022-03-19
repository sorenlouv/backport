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
              expectedTargetPullRequests: [
                { branch: '7.x', state: 'NOT_CREATED' },
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
          sourceCommit: {
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
          expectedTargetPullRequests: [
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
            {
              url: 'https://github.com/elastic/kibana/pull/88289',
              number: 88289,
              branch: '7.11',
              state: 'MERGED',
              mergeCommit: {
                sha: 'b8194e9ec27d69f485d8b194d1cb5e4f6d8fef6d',
                message:
                  '[APM] Fix incorrect table column header (95th instead of avg) (#88188) (#88289)',
              },
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
          sourceCommit: {
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
          expectedTargetPullRequests: [
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
            {
              url: 'https://github.com/elastic/kibana/pull/88289',
              number: 88289,
              branch: '7.11',
              state: 'MERGED',
              mergeCommit: {
                sha: 'b8194e9ec27d69f485d8b194d1cb5e4f6d8fef6d',
                message:
                  '[APM] Fix incorrect table column header (95th instead of avg) (#88188) (#88289)',
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
        prFilter: 'label:Team:apm merged:<2021-06-02 base:master',
        maxNumber: 3,
      });

      const commitMessage = commits.map((commit) => {
        return {
          ...commit.sourceCommit,
          message: getFirstLine(commit.sourceCommit.message),
        };
      });

      expect(commitMessage).toMatchInlineSnapshot(`
        Array [
          Object {
            "committedDate": "2021-06-01T15:53:07Z",
            "message": "Upgrade EUI to v33.0.0 (#99382)",
            "sha": "38fd8a268ad7661d92f0d84c52d6f0a3d84c9801",
          },
          Object {
            "committedDate": "2021-02-08T09:19:54Z",
            "message": "Migrate most plugins to synchronous lifecycle (#89562)",
            "sha": "3b3327dbc3c3041c9681e0cd86bd31cf411dc460",
          },
          Object {
            "committedDate": "2021-04-01T12:40:47Z",
            "message": "TS Incremental build exclude test files (#95610)",
            "sha": "b6e582c53ebb9c496c232408066b128d2ca2f92c",
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
            "expectedTargetPullRequests": Array [
              Object {
                "branch": "7.x",
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
          },
          Object {
            "author": Object {
              "email": "sorenlouv@gmail.com",
              "name": "Søren Louv-Jansen",
            },
            "expectedTargetPullRequests": Array [
              Object {
                "branch": "7.x",
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
          },
          Object {
            "author": Object {
              "email": "sorenlouv@gmail.com",
              "name": "Søren Louv-Jansen",
            },
            "expectedTargetPullRequests": Array [
              Object {
                "branch": "7.x",
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
