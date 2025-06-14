import type { Exchange, Operation, OperationResult } from '@urql/core';
import { print } from 'graphql/language/printer';
import { pipe, tap } from 'wonka';
import { logger } from '../../../logger';

export const loggingExchange: Exchange =
  ({ forward }) =>
  (ops$) => {
    return pipe(
      ops$,
      tap((operation: Operation) => {
        logger.verbose('Query:', print(operation.query));
        logger.verbose('Variables:', operation.variables);
      }),
      forward,
      tap((result: OperationResult) => {
        if (result.error) {
          logger.error('GraphQL Error:', result.error);
        } else {
          logger.verbose('Data:', result.data);
        }
      }),
    );
  };
