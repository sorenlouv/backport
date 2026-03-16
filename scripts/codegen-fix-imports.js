// Post-process GraphQL codegen output to add .js extensions to relative imports.
//
// Why: @graphql-codegen/client-preset generates imports like `from './graphql'`
// without file extensions. This project uses ESM ("type": "module") with Node16
// module resolution, which requires explicit .js extensions on relative imports.
//
// When: Invoked automatically after codegen via the npm "codegen" script
// (see package.json). Also runs as part of `npm run build`.

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'src/graphql/generated';

for (const file of readdirSync(dir)) {
  if (!file.endsWith('.ts')) continue;
  const filePath = join(dir, file);
  let content = readFileSync(filePath, 'utf8');

  // Add "DO NOT EDIT" header so agents and developers don't manually modify generated files
  const doNotEditHeader =
    '/* @generated — DO NOT EDIT MANUALLY. Regenerate with: npm run codegen */\n/* Source queries live in src/lib/github/v4/*.ts as graphql() tagged templates */\n';
  if (!content.includes('@generated')) {
    content = content.replace(
      '/* eslint-disable */\n',
      '/* eslint-disable */\n' + doNotEditHeader,
    );
  }

  const updated = content.replaceAll(
    /(from\s+['"])(\.\/[^'"]+)(?<!\.js)(['"])/g,
    '$1$2.js$3',
  );
  if (updated !== content) {
    writeFileSync(filePath, updated);
    console.log(`Fixed imports in ${filePath}`);
  }
}
