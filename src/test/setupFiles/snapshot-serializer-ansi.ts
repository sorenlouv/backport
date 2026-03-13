import stripAnsi from 'strip-ansi';

export default {
  serialize(val: string) {
    return stripAnsi(val);
  },
  test(val: unknown) {
    return typeof val === 'string' && val !== stripAnsi(val as string);
  },
};
