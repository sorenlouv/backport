import { parseConfigFile } from './read-config-file.js';

describe('parseConfigFile', () => {
  describe('personal access token', () => {
    it('should read githubToken', () => {
      const config = parseConfigFile('{ "githubToken": "my-github-token" }');
      expect(config.githubToken).toEqual('my-github-token');
    });

    it('should map accessToken to githubToken', () => {
      const config = parseConfigFile('{ "accessToken": "my-access-token" }');
      expect(config.githubToken).toEqual('my-access-token');
    });

    it('should prefer githubToken over accessToken if both are present in global config', () => {
      const config = parseConfigFile(
        '{ "githubToken": "my-github-token", "accessToken": "my-access-token" }',
      );
      expect(config.githubToken).toEqual('my-github-token');
      expect('accessToken' in config).toBe(false);
    });
  });

  describe('branches', () => {
    it('should map branches to targetBranchChoices', () => {
      const config = parseConfigFile('{ "branches": ["main", "staging"] }');
      expect(config.targetBranchChoices).toEqual(['main', 'staging']);
      expect('branches' in config).toBe(false);
    });
  });

  describe('upstream', () => {
    it('should map upstream to repoOwner and repoName', () => {
      const config = parseConfigFile('{ "upstream": "elastic/kibana" }');
      expect(config.repoOwner).toEqual('elastic');
      expect(config.repoName).toEqual('kibana');
      expect('upstream' in config).toBe(false);
    });
  });

  describe('labels', () => {
    it('should map labels to targetPRLabels', () => {
      const config = parseConfigFile('{ "labels": ["backport"] }');
      expect(config.targetPRLabels).toEqual(['backport']);
      expect('labels' in config).toBe(false);
    });
  });

  describe('conflictResolution', () => {
    it('should map commitConflicts to conflictResolution: commit', () => {
      const config = parseConfigFile('{ "commitConflicts": true }');
      expect(config.conflictResolution).toEqual('commit');
      expect('commitConflicts' in config).toBe(false);
    });

    it('should map autoResolveConflictsWithTheirs to conflictResolution: theirs', () => {
      const config = parseConfigFile(
        '{ "autoResolveConflictsWithTheirs": true }',
      );
      expect(config.conflictResolution).toEqual('theirs');
      expect('autoResolveConflictsWithTheirs' in config).toBe(false);
    });

    it('should prefer theirs if both autoResolveConflictsWithTheirs and commitConflicts are present', () => {
      const config = parseConfigFile(
        '{ "autoResolveConflictsWithTheirs": true, "commitConflicts": true }',
      );
      expect(config.conflictResolution).toEqual('theirs');
    });

    it('should not map if conflictResolution is already present', () => {
      const config = parseConfigFile(
        '{ "conflictResolution": "abort", "commitConflicts": true }',
      );
      expect(config.conflictResolution).toEqual('abort');
    });
  });

  describe('renamed cli arguments', () => {
    it('should map maxNumber to maxCount', () => {
      const config = parseConfigFile('{ "maxNumber": 20 }');
      expect(config.maxCount).toEqual(20);
      expect('maxNumber' in config).toBe(false);
    });

    it('should map prFilter to prQuery', () => {
      const config = parseConfigFile('{ "prFilter": "is:pr" }');
      expect(config.prQuery).toEqual('is:pr');
      expect('prFilter' in config).toBe(false);
    });

    it('should map dateSince and dateUntil', () => {
      const config = parseConfigFile(
        '{ "dateSince": "2020", "dateUntil": "2021" }',
      );
      expect(config.since).toEqual('2020');
      expect(config.until).toEqual('2021');
      expect('dateSince' in config).toBe(false);
      expect('dateUntil' in config).toBe(false);
    });

    it('should map dir to workdir', () => {
      const config = parseConfigFile('{ "dir": "/tmp" }');
      expect(config.workdir).toEqual('/tmp');
      expect('dir' in config).toBe(false);
    });

    it('should map cherrypickRef to cherryPickRef', () => {
      const config = parseConfigFile('{ "cherrypickRef": false }');
      expect(config.cherryPickRef).toEqual(false);
      expect('cherrypickRef' in config).toBe(false);
    });

    it('should map details to verbose', () => {
      const config = parseConfigFile('{ "details": true }');
      expect(config.verbose).toEqual(true);
      expect('details' in config).toBe(false);
    });
  });

  describe('all', () => {
    it('should map all: true to author: null', () => {
      const config = parseConfigFile('{ "all": true }');
      expect(config.author).toEqual(null);
      expect('all' in config).toBe(false);
    });

    it('should map all: false to leave author undefined', () => {
      const config = parseConfigFile('{ "all": false }');
      expect(config.author).toBeUndefined();
      expect('all' in config).toBe(false);
    });
  });
});
