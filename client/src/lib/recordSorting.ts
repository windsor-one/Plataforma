export const timestampMilliseconds = (value: unknown) => {
  if (value && typeof value === "object" && "toMillis" in value && typeof (value as { toMillis?: unknown }).toMillis === "function") {
    return (value as { toMillis: () => number }).toMillis();
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

export function sortRecordsNewest<T>(records: T[], timestamp: (record: T) => unknown) {
  return [...records].sort((left, right) => timestampMilliseconds(timestamp(right)) - timestampMilliseconds(timestamp(left)));
}
