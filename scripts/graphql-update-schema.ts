import { writeFileSync } from 'node:fs';
import { buildClientSchema, getIntrospectionQuery, printSchema } from 'graphql';
import { getDevAccessToken } from '../src/test/helpers/get-dev-access-token.js';
import { SCHEMA_PATH } from './graphql-extract.js';

async function main() {
  const accessToken = getDevAccessToken();

  console.log('Fetching GitHub GraphQL schema via introspection...');

  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `bearer ${accessToken}`,
    },
    body: JSON.stringify({ query: getIntrospectionQuery() }),
  });

  if (!response.ok) {
    console.error(
      `GitHub API returned ${response.status} ${response.statusText}`,
    );
    process.exit(1);
  }

  const { data, errors } = await response.json();

  if (errors?.length) {
    console.error('GraphQL errors:', errors);
    process.exit(1);
  }

  const schema = buildClientSchema(data);
  const sdl = printSchema(schema);

  writeFileSync(SCHEMA_PATH, sdl + '\n');
  console.log(`Schema written to ${SCHEMA_PATH}`);
  console.log('Run "npm run codegen" to regenerate types.');
}

void main();
