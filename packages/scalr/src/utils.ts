/**
 * Converts an array to a dictionary.
 * @param array An array.
 * @param getId A function that returns the key for each element.
 * @returns A dictionary of the array's values with stringified indexes as keys.
 */
export function arrayToObject<T, K extends string | number = string>(
  array: Array<T>,
  getId: (v: T, i: number) => string | number = (v, i) => i.toString()
): Record<K, T> {
  return array.reduce(
    (l, value, i) => ({ ...l, [getId(value, i)]: value }),
    {} as Record<K, T>
  );
}
