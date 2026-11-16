type OptionalKeys<T> = {
  [K in keyof T]-?: undefined extends T[K] ? K : never;
}[keyof T];

/** `T` with every key whose value may be `undefined` made truly optional. */
export type Compact<T> = {
  [K in Exclude<keyof T, OptionalKeys<T>>]: T[K];
} & {
  [K in OptionalKeys<T>]?: Exclude<T[K], undefined>;
};

/**
 * Drops `undefined` values. Parsed tool input carries `key: undefined` for
 * an omitted optional field; the SDK's parameter types, under
 * `exactOptionalPropertyTypes`, want the key absent.
 */
export const compact = <T extends object>(value: T): Compact<T> =>
  Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Compact<T>;
