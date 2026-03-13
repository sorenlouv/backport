import { readFileSync, readdirSync } from 'fs';
import { join, resolve } from 'path';
import { parse, Kind, type DocumentNode, type ASTNode } from 'graphql';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export const ROOT = resolve(__dirname, '..');
export const SRC_DIR = join(ROOT, 'src');
export const SCHEMA_PATH = join(ROOT, 'schema.graphql');

export interface ExtractedOperation {
  operationName: string;
  query: string;
  filePath: string;
  kind: 'query' | 'mutation' | 'fragment';
}

/**
 * Recursively find all .ts files under a directory, excluding non-source directories.
 */
function findTsFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name === 'node_modules' ||
        entry.name === 'dist' ||
        entry.name === 'generated'
      )
        continue;
      results.push(...findTsFiles(fullPath));
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Extract all GraphQL operations from source files using the graphql(`...`) tagged template pattern.
 */
export function extractQueries(srcDir: string): ExtractedOperation[] {
  const files = findTsFiles(srcDir);
  const operations: ExtractedOperation[] = [];
  const pattern = /graphql\(\s*`([\s\S]*?)`\s*\)/g;

  for (const filePath of files) {
    const content = readFileSync(filePath, 'utf-8');
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const queryString = match[1];
      try {
        const doc: DocumentNode = parse(queryString);
        for (const def of doc.definitions) {
          if (def.kind === Kind.OPERATION_DEFINITION && def.name) {
            operations.push({
              operationName: def.name.value,
              query: queryString,
              filePath,
              kind: def.operation as 'query' | 'mutation',
            });
          } else if (def.kind === Kind.FRAGMENT_DEFINITION) {
            operations.push({
              operationName: def.name.value,
              query: queryString,
              filePath,
              kind: 'fragment',
            });
          }
        }
      } catch (e) {
        console.warn(
          `Warning: Failed to parse GraphQL in ${filePath}: ${(e as Error).message}`,
        );
      }
    }
  }

  return operations;
}

/**
 * Build a map of operation name to extracted operation.
 */
export function extractQueriesMap(
  srcDir: string,
): Map<string, ExtractedOperation> {
  const operations = extractQueries(srcDir);
  const map = new Map<string, ExtractedOperation>();
  for (const op of operations) {
    map.set(op.operationName, op);
  }
  return map;
}

/**
 * Find all fragment names spread in a GraphQL document AST.
 */
function findReferencedFragments(node: ASTNode): Set<string> {
  const names = new Set<string>();
  const visit = (n: any) => {
    if (n.kind === Kind.FRAGMENT_SPREAD) {
      names.add(n.name.value);
    }
    for (const key of Object.keys(n)) {
      const child = n[key];
      if (Array.isArray(child)) {
        child.forEach(visit);
      } else if (child && typeof child === 'object' && child.kind) {
        visit(child);
      }
    }
  };
  visit(node);
  return names;
}

/**
 * Given a query source string, resolve and append all transitively referenced
 * fragment definitions from the fragment map.
 */
export function resolveFragments(
  querySource: string,
  fragmentMap: Map<string, string>,
): string {
  const resolved = new Set<string>();
  let combined = querySource;

  const resolve = (source: string) => {
    const doc = parse(source);
    const refs = findReferencedFragments(doc);
    for (const name of refs) {
      if (resolved.has(name)) continue;
      resolved.add(name);
      const fragSource = fragmentMap.get(name);
      if (fragSource) {
        combined += '\n' + fragSource;
        resolve(fragSource);
      }
    }
  };

  resolve(querySource);
  return combined;
}

/**
 * Build a map of fragment name -> source string from extracted operations.
 */
export function buildFragmentMap(
  operations: ExtractedOperation[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const op of operations) {
    if (op.kind === 'fragment') {
      map.set(op.operationName, op.query);
    }
  }
  return map;
}
