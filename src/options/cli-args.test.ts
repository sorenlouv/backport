import { getRuntimeArguments, getOptionsFromCliArgs } from './cli-args';

describe('getOptionsFromCliArgs', () => {
  describe('yargs settings', () => {
    it('should accept both camel-case and dashed-case and convert them to camel cased', () => {
      const argv = [
        '--access-token',
        'my access token',
        '--githubApiBaseUrlV3',
        'my api hostname',
      ];

      const res = getOptionsFromCliArgs(argv);
      expect(res.accessToken).toEqual('my access token');
      expect('access-token' in res).toEqual(false);
      expect(res.githubApiBaseUrlV3).toEqual('my api hostname');
      expect('api-hostname' in res).toEqual(false);
    });

    it('strips undefined values from the object', () => {
      const argv = [
        '--access-token',
        'my access token',
        '--repo-owner',
        'elastic',
        '--repo-name',
        'kibana',
      ];
      const res = getOptionsFromCliArgs(argv);
      expect(res).toEqual({
        accessToken: 'my access token',
        repoOwner: 'elastic',
        repoName: 'kibana',
      });
    });
  });

  describe('sourcePRLabels', () => {
    it('should handle all variations', () => {
      const argv = [
        '--sourcePRLabel',
        'label a',
        '--sourcePrLabel',
        'label b',
        '--source-pr-label',
        'label c',
      ];

      const res = getOptionsFromCliArgs(argv);
      expect(res.sourcePRLabels).toEqual(['label a', 'label b', 'label c']);
    });
  });

  describe('reviewers', () => {
    it('should handle all variations', () => {
      const argv = ['--reviewer=peter'];

      const res = getOptionsFromCliArgs(argv);
      expect(res.reviewers).toEqual(['peter']);
    });
  });

  describe('author', () => {
    it('has a default author', () => {
      const res = getOptionsFromCliArgs([]);
      expect(res.author).toEqual(undefined);
    });

    it('sets the author', () => {
      const res = getOptionsFromCliArgs(['--author=sorenlouv']);
      expect(res.author).toEqual('sorenlouv');
    });

    it('sets the author to null', () => {
      const res = getOptionsFromCliArgs(['--all']);
      expect(res.author).toEqual(null);
    });
  });

  describe('pullNumber', () => {
    it('should accept `--pr` alias but only return the full representation (`pullNumber`)', () => {
      const argv = ['--pr', '1337'];

      const res = getOptionsFromCliArgs(argv);

      expect(res.pullNumber).toEqual(1337);
      expect(res).not.toHaveProperty('pr');
    });
  });

  describe('assignees', () => {
    it('--assignee', () => {
      const argv = ['--assignee', 'john'];
      const res = getOptionsFromCliArgs(argv);
      expect(res.assignees).toEqual(['john']);
    });

    it('--assign', () => {
      const argv = ['--assign', 'john'];
      const res = getOptionsFromCliArgs(argv);
      expect(res.assignees).toEqual(['john']);
    });
  });

  describe('multipleBranches', () => {
    it('should be undefined by default', () => {
      const argv = [] as const;
      const res = getOptionsFromCliArgs(argv);
      expect(res.multipleBranches).toBe(undefined);
    });

    it('should set to true', () => {
      const argv = ['--multiple-branches', 'true'];
      const res = getOptionsFromCliArgs(argv);
      expect(res.multipleBranches).toBe(true);
    });

    it('should set to false', () => {
      const argv = ['--multiple-branches', 'false'];
      const res = getOptionsFromCliArgs(argv);
      expect(res.multipleBranches).toBe(false);
    });

    it('should respect `multiple` option', () => {
      const argv = ['--multiple'];
      const res = getOptionsFromCliArgs(argv);
      expect(res.multipleBranches).toBe(true);
    });

    it('should conflict when using both', () => {
      const argv = ['--multiple', '--multiple-branches', 'false'];

      expect(() => getOptionsFromCliArgs(argv)).toThrow(
        'Arguments multiple and multipleBranches are mutually exclusive',
      );
    });
  });

  describe('fork', () => {
    it('--fork', () => {
      const argv = ['--fork'];
      const res = getOptionsFromCliArgs(argv);
      expect(res.fork).toEqual(true);
    });

    it('--no-fork', () => {
      const argv = ['--no-fork'];
      const res = getOptionsFromCliArgs(argv);
      expect(res.fork).toEqual(false);
    });

    it('defaults to undefined', () => {
      const argv = [] as const;
      const res = getOptionsFromCliArgs(argv);
      expect(res.fork).toEqual(undefined);
    });
  });

  describe('interactive', () => {
    it('defaults to undefined', () => {
      const res = getOptionsFromCliArgs([]);
      expect(res.interactive).toEqual(undefined);
    });

    it('noStatusComment', () => {
      const res = getOptionsFromCliArgs(['--non-interactive']);
      expect(res.interactive).toEqual(false);
    });
  });

  describe('publishStatusCommentOnFailure', () => {
    it('defaults to undefined', () => {
      const res = getOptionsFromCliArgs([]);
      expect(res.publishStatusCommentOnFailure).toEqual(undefined);
    });

    it('noStatusComment', () => {
      const res = getOptionsFromCliArgs(['--noStatusComment']);
      expect(res.publishStatusCommentOnFailure).toEqual(false);
    });
  });

  describe('publishStatusCommentOnSuccess', () => {
    it('defaults to undefined', () => {
      const res = getOptionsFromCliArgs([]);
      expect(res.publishStatusCommentOnSuccess).toEqual(undefined);
    });

    it('noStatusComment', () => {
      const res = getOptionsFromCliArgs(['--noStatusComment']);
      expect(res.publishStatusCommentOnSuccess).toEqual(false);
    });
  });

  describe('noVerify', () => {
    it('should be undefined by default', () => {
      const argv = [] as const;
      const res = getOptionsFromCliArgs(argv);
      expect(res.noVerify).toBe(undefined);
    });

    it('should set to false', () => {
      const argv = ['--no-verify', 'false'];
      const res = getOptionsFromCliArgs(argv);
      expect(res.noVerify).toBe(false);
    });

    it('should set to true', () => {
      const argv = ['--no-verify', 'true'];
      const res = getOptionsFromCliArgs(argv);
      expect(res.noVerify).toBe(true);
    });

    it('should be enabled by `verify`', () => {
      const argv = ['--verify'];
      const res = getOptionsFromCliArgs(argv);
      expect(res.noVerify).toBe(true);
    });
  });

  describe('cherrypickRef', () => {
    it('should be undefined by default', () => {
      const res = getOptionsFromCliArgs([]);
      expect(res.cherrypickRef).toBe(undefined);
    });

    it('can be disabled', () => {
      const res = getOptionsFromCliArgs(['--no-cherrypick-ref']);
      expect(res.cherrypickRef).toBe(false);
    });
  });

  describe('mainline', () => {
    it('should default to 1', () => {
      const argv = ['--mainline'];
      const res = getOptionsFromCliArgs(argv);
      expect(res.mainline).toEqual(1);
    });

    it('should accept numbers', () => {
      const argv = ['--mainline', '2'];
      const res = getOptionsFromCliArgs(argv);
      expect(res.mainline).toEqual(2);
    });

    it('should throw on invalid values', () => {
      const argv = ['--mainline', 'foo'];
      expect(() => getOptionsFromCliArgs(argv)).toThrow(
        '--mainline must be an integer. Received: NaN',
      );
    });
  });

  describe('targetBranches', () => {
    it('should not coerce 6.0 to 6', () => {
      const argv = ['-b', '6.0'];
      const res = getOptionsFromCliArgs(argv);
      expect(res.targetBranches).toEqual(['6.0']);
    });
  });

  describe('repo', () => {
    it('splits into repoOwner and repoName', () => {
      const argv = ['--repo', 'elastic/kibana'];
      const res = getOptionsFromCliArgs(argv);
      expect(res.repoOwner).toEqual('elastic');
      expect(res.repoName).toEqual('kibana');
    });

    it('accepts --repo-name and --repo-owner', () => {
      const argv = ['--repo-owner=elastic', '--repo-name=kibana'];
      const res = getOptionsFromCliArgs(argv);
      expect(res.repoOwner).toEqual('elastic');
      expect(res.repoName).toEqual('kibana');
    });

    it('throw if both --repo and --repo-name is given', () => {
      const argv = ['--repo', 'elastic/kibana', '--repo-name', 'foo'];
      expect(() => getOptionsFromCliArgs(argv)).toThrow(
        'Arguments repo and repoName are mutually exclusive',
      );
    });
  });

  describe('dateSince and dateUntil', () => {
    it('should always be UTC time (configured globally in jest.config.js)', () => {
      expect(new Date().getTimezoneOffset()).toBe(0);
    });

    it('accepts ISO dates', () => {
      const argv = [
        '--since',
        '2020-08-15T00:00:00.000Z',
        '--until',
        '2020-08-15T14:00:00.000Z',
      ];
      const res = getOptionsFromCliArgs(argv);
      expect(res.dateSince).toEqual('2020-08-15T00:00:00.000Z');
      expect(res.dateUntil).toEqual('2020-08-15T14:00:00.000Z');
    });

    it('accepts non-ISO dates', () => {
      const argv = ['--since', '2020-08-15', '--until', '2020-08-15 14:00'];
      const res = getOptionsFromCliArgs(argv);
      expect(res.dateSince).toEqual('2020-08-15T00:00:00.000Z');
      expect(res.dateUntil).toEqual('2020-08-15T14:00:00.000Z');
    });

    it('accepts years', () => {
      const argv = ['--since', '2020', '--until', '2021'];
      const res = getOptionsFromCliArgs(argv);
      expect(res.dateSince).toEqual('2020-01-01T00:00:00.000Z');
      expect(res.dateUntil).toEqual('2021-01-01T00:00:00.000Z');
    });
  });

  describe('zod validation', () => {
    it('should validate and accept valid options', () => {
      const argv = [
        '--access-token',
        'my-token',
        '--auto-merge-method',
        'squash',
      ];
      const res = getOptionsFromCliArgs(argv);
      expect(res.accessToken).toEqual('my-token');
      expect(res.autoMergeMethod).toEqual('squash');
    });

    it('should reject invalid enum values', () => {
      const argv = ['--auto-merge-method', 'invalid-method'];
      expect(() => getOptionsFromCliArgs(argv)).toThrow();
    });

    it('should allow properties not in schema but accepted by yargs', () => {
      // Zod's loose schema allows extra properties that pass yargs validation
      // Note: yargs will reject truly unknown flags, but allows known aliases
      const argv = ['--access-token', 'my-token'];
      const res = getOptionsFromCliArgs(argv);
      expect(res.accessToken).toEqual('my-token');
    });

    it('should validate array types', () => {
      const argv = ['--assignee', 'john', '--assignee', 'jane'];
      const res = getOptionsFromCliArgs(argv);
      expect(res.assignees).toEqual(['john', 'jane']);
    });

    it('should validate boolean types', () => {
      const argv = ['--fork', 'true', '--dry-run'];
      const res = getOptionsFromCliArgs(argv);
      expect(res.fork).toEqual(true);
      expect(res.dryRun).toEqual(true);
    });

    it('should validate number types', () => {
      const argv = ['--max-number', '20', '--mainline', '2'];
      const res = getOptionsFromCliArgs(argv);
      expect(res.maxNumber).toEqual(20);
      expect(res.mainline).toEqual(2);
    });
  });
});

describe('getRuntimeArguments', () => {
  describe('interactive', () => {
    it('--non-interactive flag', () => {
      const { interactive } = getRuntimeArguments(['--non-interactive']);
      expect(interactive).toEqual(false);
    });

    it('--json flag', () => {
      const { interactive } = getRuntimeArguments(['--json']);
      expect(interactive).toEqual(false);
    });

    it('default', () => {
      const { interactive } = getRuntimeArguments([]);
      expect(interactive).toEqual(true);
    });

    it('setting via module options', () => {
      const { interactive } = getRuntimeArguments([], { interactive: false });
      expect(interactive).toEqual(false);
    });
  });

  describe('ls', () => {
    it('by default', () => {
      const { ls } = getRuntimeArguments([]);
      expect(ls).toEqual(undefined);
    });

    it('--ls flag', () => {
      const { ls } = getRuntimeArguments(['--ls']);
      expect(ls).toEqual(true);
    });
  });

  describe('logFilePath', () => {
    it('by default', () => {
      const { logFilePath } = getRuntimeArguments([]);
      expect(logFilePath).toEqual(undefined);
    });

    it('--log-file-path flag', () => {
      const { logFilePath } = getRuntimeArguments(['--log-file-path']);
      expect(logFilePath).toEqual(true);
    });
  });
});
