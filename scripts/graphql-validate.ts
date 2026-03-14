import { readFileSync } from 'fs';
import { relative } from 'path';
import { buildSchema, parse, validate } from 'graphql';
import {
  extractQueries,
  buildFragmentMap,
  resolveFragments,
  ROOT,
  SRC_DIR,
  SCHEMA_PATH,
} from './graphql-extract.js';

function main() {
  const schemaSource = readFileSync(SCHEMA_PATH, 'utf-8');
  const schema = buildSchema(schemaSource);

  const operations = extractQueries(SRC_DIR);
  const fragmentMap = buildFragmentMap(operations);

  const fragments = operations.filter((op) => op.kind === 'fragment');
  const nonFragments = operations.filter((op) => op.kind !== 'fragment');

  let hasErrors = false;
  let passCount = 0;

  console.log(
    `Validating ${nonFragments.length} operations and ${fragments.length} fragments against schema...\n`,
  );

  // Validate operations with only their referenced fragments
  for (const op of nonFragments) {
    try {
      const fullQuery = resolveFragments(op.query, fragmentMap);
      const doc = parse(fullQuery);
      const errors = validate(schema, doc);
      if (errors.length > 0) {
        hasErrors = true;
        console.error(
          `FAIL  ${op.operationName} (${relative(ROOT, op.filePath)})`,
        );
        for (const err of errors) {
          console.error(`      ${err.message}`);
        }
      } else {
        passCount++;
        console.log(
          `  OK  ${op.operationName} (${relative(ROOT, op.filePath)})`,
        );
      }
    } catch (e) {
      hasErrors = true;
      console.error(
        `FAIL  ${op.operationName} (${relative(ROOT, op.filePath)})`,
      );
      console.error(`      Parse error: ${(e as Error).message}`);
    }
  }

  // Validate fragments with their transitive dependencies
  for (const frag of fragments) {
    try {
      const fullQuery = resolveFragments(frag.query, fragmentMap);
      const doc = parse(fullQuery);
      const errors = validate(schema, doc);
      // Filter "unused fragment" since we validate fragments in isolation
      const realErrors = errors.filter(
        (e) => !e.message.includes('is never used'),
      );
      if (realErrors.length > 0) {
        hasErrors = true;
        console.error(
          `FAIL  fragment ${frag.operationName} (${relative(ROOT, frag.filePath)})`,
        );
        for (const err of realErrors) {
          console.error(`      ${err.message}`);
        }
      } else {
        passCount++;
        console.log(
          `  OK  fragment ${frag.operationName} (${relative(ROOT, frag.filePath)})`,
        );
      }
    } catch (e) {
      hasErrors = true;
      console.error(
        `FAIL  fragment ${frag.operationName} (${relative(ROOT, frag.filePath)})`,
      );
      console.error(`      Parse error: ${(e as Error).message}`);
    }
  }

  console.log(
    `\n${passCount} passed, ${operations.length - passCount} failed out of ${operations.length} total`,
  );

  if (hasErrors) {
    process.exit(1);
  }
}

main();
