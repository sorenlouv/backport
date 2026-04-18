import { parseConfigFile } from './read-config-file.js';

describe('parseConfigFile', () => {
  describe('tokens', () => {
    it('should map githubToken to githubToken', () => {
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
});
