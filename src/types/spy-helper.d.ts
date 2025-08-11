// eslint-disable-next-line no-undef
export type SpyHelper<T extends (...args: any[]) => any> = jest.SpyInstance<
  ReturnType<T>,
  Parameters<T>
>;
