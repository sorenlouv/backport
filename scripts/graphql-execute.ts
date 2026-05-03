import { relative } from 'node:path';
import dotenv from 'dotenv';
import { getDevGithubToken } from '../src/test/helpers/get-dev-github-token.js';
import {
  extractQueries,
  extractQueriesMap,
  buildFragmentMap,
  resolveFragments,
  extractVariableDefinitions,
  ROOT,
  SRC_DIR,
} from './graphql-extract.js';

dotenv.config({ path: new URL('../.env', import.meta.url).pathname });

function printUsage() {
  console.log(`Usage:
  Execute a named project query:
    npm run graphql:execute -- --operation <Name> [--variables '<json>']

  Execute an ad-hoc query:
    npm run graphql:execute -- --query '<graphql>' [--variables '<json>']

  List all available operations:
    npm run graphql:execute -- --list

Examples:
  npm run graphql:execute -- --list
  npm run graphql:execute -- --operation AuthorId --variables '{"author":"sorenlouv"}'
  npm run graphql:execute -- --query 'query { viewer { login } }'
`);
}

function parseArgs(argv: string[]) {
  const args: Record<string, string | boolean> = {};
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--list') {
      args.list = true;
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else if (arg.startsWith('--') && i + 1 < argv.length) {
      args[arg.slice(2)] = argv[++i];
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);

  if (args.help) {
    printUsage();
    process.exit(0);
  }

  if (args.list) {
    const ops = extractQueriesMap(SRC_DIR);
    console.log('Available operations:\n');
    for (const [name, op] of ops) {
      const relPath = relative(ROOT, op.filePath);
      console.log(`  ${op.kind.padEnd(10)} ${name.padEnd(40)} ${relPath}`);
    }
    process.exit(0);
  }

  const githubToken = getDevGithubToken();

  let query: string;

  if (args.operation) {
    const ops = extractQueriesMap(SRC_DIR);
    const op = ops.get(args.operation as string);
    if (!op) {
      console.error(`Error: Operation "${args.operation}" not found.`);
      console.error('Run with --list to see available operations.');
      process.exit(1);
    }

    // Include only transitively referenced fragment definitions
    const allOps = extractQueries(SRC_DIR);
    const fragmentMap = buildFragmentMap(allOps);
    query = resolveFragments(op.query, fragmentMap);
  } else if (args.query) {
    query = args.query as string;
  } else {
    printUsage();
    process.exit(1);
  }

  let variables: Record<string, unknown> | undefined;
  if (args.variables) {
    try {
      variables = JSON.parse(args.variables as string);
    } catch (error) {
      console.error(
        `Error: Invalid JSON for --variables: ${(error as Error).message}`,
      );
      process.exit(1);
    }
  }

  // Check for required variables when --variables is not provided
  if (!args.variables) {
    const varDefs = extractVariableDefinitions(query);
    const requiredVars = varDefs.filter((v) => v.required);
    if (requiredVars.length > 0) {
      const varList = requiredVars
        .map((v) => `  $${v.name} (${v.type})`)
        .join('\n');
      console.error(
        `Error: Operation requires variables:\n${varList}\n\nUsage: npm run graphql:execute -- --operation ${args.operation ?? '<Name>'} --variables '${JSON.stringify(
          Object.fromEntries(requiredVars.map((v) => [v.name, '...'])),
        )}'`,
      );
      process.exit(1);
    }
  }

  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `bearer ${githubToken}`,
      'Content-Type': 'application/json',
      'User-Agent': 'backport-graphql-tool',
    },
    body: JSON.stringify({ query, variables }),
  });

  const result = await response.json();

  if (!response.ok) {
    console.error(`HTTP ${response.status}: ${response.statusText}`);
  }

  console.log(JSON.stringify(result, null, 2));

  if (result.errors) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
