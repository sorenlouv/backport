import {
  cleanupFetchMock,
  mockFetchResponse,
  setupFetchMock,
} from '../../../test/helpers/mock-fetch.js';
import { addAssigneesToPullRequest } from './add-assignees-to-pull-request.js';

describe('addAssigneesToPullRequest', () => {
  beforeEach(() => {
    setupFetchMock();
  });

  afterEach(() => {
    cleanupFetchMock();
  });

  it('should add assignees to PR', async () => {
    const pullNumber = 216;
    const assignees = ['sorenlouv'];

    const calls = mockFetchResponse({
      url: 'https://api.github.com/repos/elastic/kibana/issues/216/assignees',
      method: 'POST',
      responseBody: 'some response',
    });

    const res = await addAssigneesToPullRequest({
      repoName: 'kibana',
      repoOwner: 'elastic',
      accessToken: 'my-token',
      autoAssign: false,
      interactive: false,
      pullNumber,
      assignees,
    });

    expect(res).toBe(undefined);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual(
      expect.objectContaining({ assignees: ['sorenlouv'] }),
    );
  });
});
