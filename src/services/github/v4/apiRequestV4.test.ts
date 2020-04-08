import axios from 'axios';
import { HandledError } from '../../HandledError';
import { apiRequestV4 } from './apiRequestV4';

describe('apiRequestV4', () => {
  describe('when request succeeds', () => {
    let spy: jest.SpyInstance;
    let res: unknown;
    beforeEach(async () => {
      spy = jest.spyOn(axios, 'post').mockResolvedValue({
        data: {
          data: 'some data',
        },
      } as any);

      res = await apiRequestV4({
        accessToken: 'myAccessToken',
        githubApiBaseUrlV4: 'https://my-custom-api.com/graphql',
        query: 'myQuery',
        variables: {
          foo: 'bar',
        },
      });
    });

    it('should return correct response', async () => {
      expect(res).toEqual('some data');
    });

    it('should call with correct args', async () => {
      expect(spy).toHaveBeenCalledWith(
        'https://my-custom-api.com/graphql',
        {
          query: 'myQuery',
          variables: { foo: 'bar' },
        },
        {
          headers: {
            Authorization: 'bearer myAccessToken',
            'Content-Type': 'application/json',
          },
        }
      );
    });
  });

  describe('when request fails with error messages', () => {
    beforeEach(() => {
      jest.spyOn(axios, 'post').mockRejectedValue({
        response: {
          data: {
            errors: [
              { message: 'some error' },
              { message: 'some other error' },
            ],
          },
        },
      } as any);
    });

    it('should return parsed github error', async () => {
      return expect(
        apiRequestV4({
          accessToken: 'myAccessToken',
          githubApiBaseUrlV4: 'myApiHostname',
          query: 'myQuery',
          variables: {
            foo: 'bar',
          },
        })
      ).rejects.toThrowError(
        new HandledError(`some error, some other error (Github v4)`)
      );
    });
  });

  describe('when request fails without error messages', () => {
    beforeEach(() => {
      jest.spyOn(axios, 'post').mockRejectedValue({
        response: {
          data: {
            foo: 'bar',
          },
        },
      } as any);
    });

    it('should return parsed github error', async () => {
      return expect(
        apiRequestV4({
          accessToken: 'myAccessToken',
          githubApiBaseUrlV4: 'myApiHostname',
          query: 'myQuery',
          variables: {
            foo: 'bar',
          },
        })
      ).rejects.toThrowErrorMatchingSnapshot();
    });
  });
});
