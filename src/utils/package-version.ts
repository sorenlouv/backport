import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

function findPackageJson(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  while (dir !== dirname(dir)) {
    const candidate = join(dir, 'package.json');
    if (existsSync(candidate)) {
      const content = JSON.parse(readFileSync(candidate, 'utf8'));
      if (content.name === 'backport') {
        return candidate;
      }
    }
    dir = dirname(dir);
  }
  throw new Error('Could not find backport package.json');
}

const pkg = JSON.parse(readFileSync(findPackageJson(), 'utf8'));

export function getPackageVersion() {
  return pkg.version;
}
