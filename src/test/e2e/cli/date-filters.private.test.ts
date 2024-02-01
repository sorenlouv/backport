import { getDevAccessToken } from '../../private/getDevAccessToken';
import { runBackportViaCli } from './runBackportViaCli';

const accessToken = getDevAccessToken();
jest.setTimeout(15_000);

describe('date filters (dateSince, dateUntil)', () => {
  it(`filters commits by "since" and "until"`, async () => {
    const { output } = await runBackportViaCli(
      [
        '--branch=7.x',
        '--repo=backport-org/backport-e2e',
        `--accessToken=${accessToken}`,
        '--since=2020-08-15T10:00:00.000Z',
        '--until=2020-08-15T10:30:00.000Z',
      ],
      { waitForString: 'Select commit' },
    );

    expect(output).toMatchInlineSnapshot(`
"repo: backport-org/backport-e2e • since: 2020-08-15T10:00:00.000Z • until: 2020-08-15T10:30:00.000Z

? Select commit (Use arrow keys)
❯ 1. Bump to 8.0.0  
  2. Add package.json  
  3. Update .backportrc.json  
  4. Create .backportrc.json"
`);
  });

  it('combined with --pr-filter', async () => {
    const { output } = await runBackportViaCli(
      [
        '--branch=7.x',
        '--repo=elastic/kibana',
        `--accessToken=${accessToken}`,
        `--author=sorenlouv`,
        '--since=2021-09-20',
        '--until=2021-10-01',
      ],
      { waitForString: 'Select commit' },
    );

    const { output: outputFromPrFilter } = await runBackportViaCli(
      [
        '--branch=7.x',
        '--repo=elastic/kibana',
        `--accessToken=${accessToken}`,
        `--pr-filter="author:sorenlouv"`,
        '--since=2021-09-20',
        '--until=2021-10-01',
        '--source-branch=master',
      ],
      { waitForString: 'Select commit' },
    );
    expect(output).toMatchInlineSnapshot(`
"repo: elastic/kibana • autoMerge: true • since: 2021-09-20T00:00:00.000Z • until: 2021-10-01T00:00:00.000Z

? Select commit (Use arrow keys)
❯ 1. [APM] Add link to officials docs for APM UI settings (#113396) 7.x"
`);
    expect(output).toEqual(outputFromPrFilter);
  });
});
