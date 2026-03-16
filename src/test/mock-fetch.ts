/**
 * Test helper that replaces nock with vi.spyOn(globalThis, 'fetch').
 *
 * Both the GraphQL client (native fetch) and Octokit REST client use
 * globalThis.fetch, so spying on fetch intercepts all HTTP traffic.
 */

interface MockConfig {
  /** URL string to match (uses `url.includes(...)`) */
  url: string;
  /** HTTP method to match (default: matches any) */
  method?: string;
  /** Predicate to further filter by parsed JSON body */
  bodyMatcher?: (body: any) => boolean;
  /** Response status code (default: 200) */
  statusCode?: number;
  /** Response body — will be JSON.stringified */
  responseBody?: any;
  /** Response headers */
  responseHeaders?: Record<string, string>;
}

interface RegisteredMock extends MockConfig {
  /** Request bodies captured when this mock was matched */
  calls: any[];
  /** Whether this mock has been consumed */
  consumed: boolean;
}

let mocks: RegisteredMock[] = [];
let fetchSpy: ReturnType<typeof vi.spyOn> | null = null;

/**
 * Install the fetch mock. Call this in beforeEach.
 */
export function setupFetchMock() {
  mocks = [];
  fetchSpy = vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;
        const method = init?.method ?? 'GET';

        let body: any;
        try {
          body = init?.body ? JSON.parse(init.body as string) : undefined;
        } catch {
          body = init?.body;
        }

        const mock = mocks.find((m) => {
          if (m.consumed) return false;
          if (!url.includes(m.url)) return false;
          if (m.method && m.method.toUpperCase() !== method.toUpperCase())
            return false;
          if (m.bodyMatcher && !m.bodyMatcher(body)) return false;
          return true;
        });

        if (!mock) {
          throw new Error(
            `Unmocked fetch: ${method} ${url}\nBody: ${JSON.stringify(body, null, 2)}\nRegistered mocks: ${mocks.map((m) => `${m.method ?? '*'} ${m.url} (consumed=${m.consumed})`).join(', ')}`,
          );
        }

        mock.consumed = true;
        mock.calls.push(body);

        return new Response(
          mock.responseBody === undefined
            ? ''
            : JSON.stringify(mock.responseBody),
          {
            status: mock.statusCode ?? 200,
            headers: {
              'Content-Type': 'application/json',
              ...mock.responseHeaders,
            },
          },
        );
      },
    );
}

/**
 * Tear down the fetch mock. Call this in afterEach.
 */
export function cleanupFetchMock() {
  fetchSpy?.mockRestore();
  fetchSpy = null;
  mocks = [];
}

/**
 * Register a mock for a specific URL/method/body pattern.
 * Returns the array of captured request bodies for this mock.
 */
export function mockFetchResponse(config: MockConfig): any[] {
  const registered: RegisteredMock = {
    ...config,
    calls: [],
    consumed: false,
  };
  mocks.push(registered);
  return registered.calls;
}

/**
 * Drop-in replacement for the nock-based `mockGraphqlRequest`.
 * Matches POST requests to the GraphQL endpoint by operationName.
 * Returns captured request bodies (same shape as the old nock helper).
 */
export function mockGraphqlRequest<
  TData = any,
  TVariables = Record<string, any>,
>({
  operationName,
  statusCode = 200,
  body,
  headers,
  apiBaseUrl = 'http://localhost/graphql',
}: {
  operationName: string;
  statusCode?: number;
  body?: { data: TData } | { errors: ReadonlyArray<any> };
  headers?: Record<string, string>;
  apiBaseUrl?: string;
}): CapturedGraphqlCall<TVariables>[] {
  return mockFetchResponse({
    url: apiBaseUrl,
    method: 'POST',
    bodyMatcher: (b: any) => b?.operationName === operationName,
    statusCode,
    responseBody: body,
    responseHeaders: headers,
  });
}

export interface CapturedGraphqlCall<TVariables = Record<string, any>> {
  query: string;
  variables?: TVariables;
  operationName?: string;
}
