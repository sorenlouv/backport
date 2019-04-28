import mockAxios from 'axios';
import * as childProcess from 'child_process';
import {
  doBackportVersion,
  getReferenceLong
} from '../../src/steps/doBackportVersions';
import { PromiseReturnType } from '../../src/types/commons';

describe('doBackportVersion', () => {
  let axiosMock: jest.Mock;
  afterEach(() => {
    axiosMock.mockReset();
  });

  describe('when commit has a pull request reference', () => {
    let execSpy: jest.SpyInstance;
    let res: PromiseReturnType<typeof doBackportVersion>;
    beforeEach(async () => {
      // mock: createPullRequest
      axiosMock = (mockAxios.post as jest.Mock)
        .mockImplementationOnce(() => {
          return {
            data: {
              number: 1337,
              html_url: 'myHtmlUrl'
            }
          };
        })
        // mock: addLabelsToPullRequest
        .mockResolvedValueOnce(null);

      const commits = [
        {
          sha: 'mySha',
          message: 'myCommitMessage',
          pullNumber: 1000
        },
        {
          sha: 'mySha2',
          message: 'myOtherCommitMessage',
          pullNumber: 2000
        }
      ];

      execSpy = jest.spyOn(childProcess, 'exec');

      res = await doBackportVersion(
        'elastic',
        'kibana',
        commits,
        '6.x',
        'sqren',
        ['backport']
      );
    });

    it('should make correct git commands', () => {
      expect(execSpy.mock.calls).toMatchSnapshot();
    });

    it('should return correct response', () => {
      expect(res).toEqual({ html_url: 'myHtmlUrl', number: 1337 });
    });

    it('should create pull request and add labels', () => {
      expect(axiosMock).toHaveBeenCalledTimes(2);
      expect(axiosMock).toHaveBeenNthCalledWith(
        1,
        'https://api.github.com/repos/elastic/kibana/pulls?access_token=undefined',
        {
          title: '[6.x] myCommitMessage | myOtherCommitMessage',
          body:
            'Backports the following commits to 6.x:\n - myCommitMessage (#1000)\n - myOtherCommitMessage (#2000)',
          head: 'sqren:backport/6.x/pr-1000_pr-2000',
          base: '6.x'
        }
      );

      expect(axiosMock).toHaveBeenNthCalledWith(
        2,
        'https://api.github.com/repos/elastic/kibana/issues/1337/labels?access_token=undefined',
        ['backport']
      );
    });
  });

  describe('when commit does not have a pull request reference', () => {
    let axiosMock: jest.Mock;
    beforeEach(async () => {
      // mock: createPullRequest
      axiosMock = (mockAxios.post as jest.Mock)
        .mockImplementationOnce(() => {
          return {
            data: {
              number: 1337,
              html_url: 'myHtmlUrl'
            }
          };
        })
        // mock: addLabelsToPullRequest
        .mockResolvedValueOnce(null);

      const commits = [
        {
          sha: 'mySha',
          message: 'myCommitMessage'
        }
      ];

      await doBackportVersion('elastic', 'kibana', commits, '6.x', 'sqren', [
        'backport'
      ]);
    });

    it('should create pull request and add labels', () => {
      expect(axiosMock).toHaveBeenCalledTimes(2);
      expect(axiosMock).toHaveBeenNthCalledWith(
        1,
        'https://api.github.com/repos/elastic/kibana/pulls?access_token=undefined',
        {
          title: '[6.x] myCommitMessage',
          body:
            'Backports the following commits to 6.x:\n - myCommitMessage (mySha)',
          head: 'sqren:backport/6.x/commit-mySha',
          base: '6.x'
        }
      );

      expect(axiosMock).toHaveBeenNthCalledWith(
        2,
        'https://api.github.com/repos/elastic/kibana/issues/1337/labels?access_token=undefined',
        ['backport']
      );
    });
  });
});

describe('getReferenceLong', () => {
  it('should return a sha', () => {
    expect(
      getReferenceLong({ sha: 'mySha1234567', message: 'myMessage' })
    ).toEqual('mySha12');
  });

  it('should return a pr', () => {
    expect(
      getReferenceLong({
        pullNumber: 1337,
        sha: 'mySha1234567',
        message: 'myMessage'
      })
    ).toEqual('#1337');
  });
});
