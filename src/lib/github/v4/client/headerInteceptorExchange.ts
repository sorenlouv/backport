// headerInterceptorExchange.ts (or your chosen filename)
import { Exchange } from '@urql/core'; // Removed OperationResult as it's used via OperationResultWithMeta
import { pipe, map } from 'wonka';
import { OperationResultWithMeta } from '../fetchCommits/graphqlClient';

interface StoredResponseData {
  headers: Headers;
  statusCode: number;
}

// A Map to temporarily store headers and status code
const temporaryResponseDataStore = new Map<number, StoredResponseData>();

export const responseMetaInterceptorExchange: Exchange = ({
  client,
  forward,
}) => {
  // Renamed for clarity
  return (operations$) => {
    // 1. Modify outgoing operations to use a wrapped fetch
    const operationsWithWrappedFetch$ = pipe(
      operations$,
      map((operation) => {
        const originalFetch = operation.context.fetch || client.fetch || fetch;

        const newContext = {
          ...operation.context,
          fetch: async (
            input: RequestInfo | URL,
            init?: RequestInit,
          ): Promise<Response> => {
            const response = await originalFetch(input, init);
            // Store both headers and status code when the response is received
            temporaryResponseDataStore.set(operation.key, {
              headers: response.headers,
              statusCode: response.status, // Capture status code here
            });
            return response;
          },
        };
        return { ...operation, context: newContext };
      }),
    );

    // 2. Forward the modified operations
    const resultsFromNextExchange$ = forward(operationsWithWrappedFetch$);

    // 3. Modify incoming results to attach the stored data
    return pipe(
      resultsFromNextExchange$,
      map((result) => {
        const storedData = temporaryResponseDataStore.get(result.operation.key);
        if (storedData) {
          temporaryResponseDataStore.delete(result.operation.key); // Clean up
          return {
            ...result,
            responseHeaders: storedData.headers,
            statusCode: storedData.statusCode, // Attach status code here
          } as OperationResultWithMeta<any>; // Use the updated interface
        }
        return result as OperationResultWithMeta<any>; // Cast even if not found, though it should be
      }),
    );
  };
};
