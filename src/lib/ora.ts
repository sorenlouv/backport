import oraOriginal from 'ora';

/* eslint-disable @typescript-eslint/no-empty-function */
const oraMock = {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  start: (text?: string) => oraMock,
  succeed: () => {},
  stop: () => {},
  fail: () => {},
  stopAndPersist: () => {},
  set text(value: string) {},
} as oraOriginal.Ora;

export function ora(
  interactive: boolean | undefined,
  text?: string | undefined
): oraOriginal.Ora {
  return interactive ? oraOriginal({ text }) : oraMock;
}

export type Ora = oraOriginal.Ora;
