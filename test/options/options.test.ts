import { validateOptions } from '../../src/options/options';

describe('validateOptions', () => {
  it('should not throw when all options are valid', () => {
    expect(() =>
      validateOptions({
        accessToken: 'myAccessToken',
        all: false,
        branchChoices: [],
        branches: ['branchA'],
        labels: [],
        multiple: false,
        multipleBranches: true,
        multipleCommits: false,
        sha: undefined,
        upstream: 'elastic/kibana',
        username: 'sqren'
      })
    ).not.toThrow();
  });

  it('should throw when accessToken is missing', () => {
    expect(() =>
      validateOptions({
        accessToken: undefined,
        all: false,
        branchChoices: [],
        branches: ['branchA'],
        labels: [],
        multiple: false,
        multipleBranches: true,
        multipleCommits: false,
        sha: undefined,
        upstream: 'elastic/kibana',
        username: 'sqren'
      })
    ).toThrowErrorMatchingSnapshot();
  });

  it('should throw when both branches and branchChoices are missing', () => {
    expect(() =>
      validateOptions({
        accessToken: undefined,
        all: false,
        branchChoices: [],
        branches: [],
        labels: [],
        multiple: false,
        multipleBranches: true,
        multipleCommits: false,
        sha: undefined,
        upstream: 'elastic/kibana',
        username: 'sqren'
      })
    ).toThrowErrorMatchingSnapshot();
  });

  it('should throw when upstream is missing', () => {
    expect(() =>
      validateOptions({
        accessToken: 'myAccessToken',
        all: false,
        branchChoices: [],
        branches: ['branchA'],
        labels: [],
        multiple: false,
        multipleBranches: true,
        multipleCommits: false,
        sha: undefined,
        upstream: undefined,
        username: 'sqren'
      })
    ).toThrowErrorMatchingSnapshot();
  });

  it('should throw when username is missing', () => {
    expect(() =>
      validateOptions({
        accessToken: 'myAccessToken',
        all: false,
        branchChoices: [],
        branches: ['branchA'],
        labels: [],
        multiple: false,
        multipleBranches: true,
        multipleCommits: false,
        sha: undefined,
        upstream: 'elastic/kibana',
        username: undefined
      })
    ).toThrowErrorMatchingSnapshot();
  });
});
