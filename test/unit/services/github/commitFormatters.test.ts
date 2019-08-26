import { getFirstCommitMessageLine } from '../../../../src/services/github/commitFormatters';

describe('getFirstCommitMessageLine', () => {
  it('should only return the first line of the message', () => {
    expect(
      getFirstCommitMessageLine(
        'My commit message (#1234)\n\n Additional commit message body'
      )
    ).toEqual('My commit message (#1234)');
  });

  it('should return the commit message as-is', () => {
    expect(getFirstCommitMessageLine('My commit message')).toEqual(
      'My commit message'
    );
  });
});
