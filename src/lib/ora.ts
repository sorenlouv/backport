import oraOriginal, { type Ora } from 'ora';

export const oraNonInteractiveMode = {
  start: () => oraNonInteractiveMode,
  succeed: () => {},
  stop: () => {},
  fail: () => {},
  stopAndPersist: () => {},
  set text(value: string) {},
} as Ora;

export function ora(
  interactive: boolean | undefined,
  text?: string | undefined,
): Ora {
  return interactive ? oraOriginal({ text }) : oraNonInteractiveMode;
}

export type { Ora };
