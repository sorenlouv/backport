import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

function findPackageJson(): string | undefined {
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
  return undefined;
}

const packageJsonPath = findPackageJson();
const packageVersion: string = packageJsonPath
  ? JSON.parse(readFileSync(packageJsonPath, 'utf8')).version
  : 'unknown';

export function getPackageVersion() {
  return packageVersion;
}
