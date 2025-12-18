export function parseCsvParam(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function setCsvParam(sp: URLSearchParams, key: string, values: string[]) {
  if (!values.length) sp.delete(key);
  else sp.set(key, values.join(","));
}

export function toggleInList(list: string[], value: string): string[] {
  const exists = list.some((x) => x === value);
  if (exists) return list.filter((x) => x !== value);
  return [...list, value];
}


