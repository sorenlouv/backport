import type { MockInstance } from 'vitest';

export type SpyHelper<T extends (...args: any[]) => any> = MockInstance<T>;
