export type SpyHelper<T extends (...a: any[]) => any> = jest.SpyInstance<
  ReturnType<T>,
  Parameters<T>
>;
