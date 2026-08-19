export function asBusinessDate(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "object" && "toDate" in value && typeof (value as { toDate?: unknown }).toDate === "function") {
    const date = (value as { toDate: () => Date }).toDate();
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === "object" && "seconds" in value) {
    const seconds = Number((value as { seconds?: unknown }).seconds);
    if (Number.isFinite(seconds)) return new Date(seconds * 1000);
  }
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return new Date(`${text}T12:00:00`);
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function businessDateKey(value: unknown, fallback = "") {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = asBusinessDate(value);
  return date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}` : fallback;
}

export function businessPeriodKey(value: unknown, fallback = "") {
  const dateKey = businessDateKey(value);
  return dateKey ? dateKey.slice(0, 7) : fallback;
}

export function businessToday() {
  return businessDateKey(new Date());
}

export function businessDateTimeInput(value?: string) {
  const date = asBusinessDate(value);
  if (!date) return "";
  return `${businessDateKey(date)}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
