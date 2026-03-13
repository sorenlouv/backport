// Post-process GraphQL codegen output to add .js extensions to relative imports
// Required for ESM compatibility with Node16 module resolution

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

const dir = 'src/graphql/generated';

for (const file of readdirSync(dir)) {
  if (!file.endsWith('.ts')) continue;
  const filePath = join(dir, file);
  let content = readFileSync(filePath, 'utf8');
  const updated = content.replace(
    /(from\s+['"])(\.\/[^'"]+)(?<!\.js)(['"])/g,
    '$1$2.js$3',
  );
  if (updated !== content) {
    writeFileSync(filePath, updated);
    console.log(`Fixed imports in ${filePath}`);
  }
}
