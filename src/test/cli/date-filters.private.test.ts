import { getDevGithubToken } from '../helpers/get-dev-github-token.js';
import { runBackportViaCli } from './run-backport-via-cli.js';

const githubToken = getDevGithubToken();
vi.setConfig({ testTimeout: 15_000 });

describe('date filters (since, until)', () => {
  it(`filters commits by "since" and "until"`, async () => {
    const { output } = await runBackportViaCli(
      [
        '--branch=7.x',
        '--repo=backport-org/backport-e2e',
        `--github-token=${githubToken}`,
        '--since=2020-08-15T10:00:00.000Z',
        '--until=2020-08-15T10:30:00.000Z',
      ],
      { waitForString: 'Select commit' },
    );

    expect(output).toMatchInlineSnapshot(`
      "repo: backport-org/backport-e2e | sourceBranch: master | author: sorenlouv | since: 2020-08-15T10:00:00.000Z | until: 2020-08-15T10:30:00.000Z

      ? Select commit
      ❯ 1. Bump to 8.0.0
        2. Add package.json
        3. Update .backportrc.json
        4. Create .backportrc.json

      ↑↓ navigate • ⏎ select"
    `);
  });

  it('combined with --pr-query', async () => {
    const options = [
      '--branch=7.x',
      '--repo=backport-org/backport-e2e',
      `--github-token=${githubToken}`,
      '--since=2020-08-15',
      '--until=2020-08-17',
    ];

    const { output: outputWithoutPrQuery } = await runBackportViaCli(options, {
      waitForString: 'Select commit',
    });

    expect(outputWithoutPrQuery).toMatchInlineSnapshot(`
      "repo: backport-org/backport-e2e | sourceBranch: master | author: sorenlouv | since: 2020-08-15T00:00:00.000Z | until: 2020-08-17T00:00:00.000Z

      ? Select commit
      ❯ 1. Add sheep emoji (#9) 7.8
        2. Change Ulysses to Gretha (conflict) (#8) 7.x
        3. Add 🍏 emoji (#5) 7.8, 7.x
        4. Add family emoji (#2) 7.x
        5. Add \`backport\` dep
        6. Merge pull request #1 from backport-org/add-heart-emoji
        7. Add ❤️ emoji
        8. Update .backportrc.json
        9. Bump to 8.0.0
        10.Add package.json

      ↑↓ navigate • ⏎ select"
    `);

    const { output: outputWithPrQuery } = await runBackportViaCli(
      [...options, `--pr-query="label:v7.8.0"`],
      { waitForString: 'Select commit' },
    );

    expect(outputWithPrQuery).toMatchInlineSnapshot(`
      "repo: backport-org/backport-e2e | sourceBranch: master | author: sorenlouv | since: 2020-08-15T00:00:00.000Z | until: 2020-08-17T00:00:00.000Z

      ? Select commit
      ❯ 1. Add sheep emoji (#9) 7.8
        2. Add 🍏 emoji (#5) 7.8, 7.x

      ↑↓ navigate • ⏎ select"
    `);
  });
});
