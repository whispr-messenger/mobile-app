/**
 * Convert a camelCase string to snake_case.
 */
export function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/**
 * Recursively convert all keys in an object/array from camelCase to snake_case.
 * The backend sends camelCase keys but our types use snake_case.
 */
export function snakecaseKeys<T = unknown>(obj: T): T {
  if (Array.isArray(obj)) {
    return obj.map((item) => snakecaseKeys(item)) as unknown as T;
  }
  if (obj !== null && typeof obj === "object" && !(obj instanceof Date)) {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([key, value]) => [
        toSnakeCase(key),
        snakecaseKeys(value),
      ]),
    ) as T;
  }
  return obj;
}
