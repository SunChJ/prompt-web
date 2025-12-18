export function splitQueryParam(value: unknown): string[] | undefined {
  if (value == null) return undefined;
  if (Array.isArray(value)) {
    const items = value.flatMap((v) => (typeof v === "string" ? v.split(",") : []));
    const cleaned = items.map((s) => s.trim()).filter(Boolean);
    return cleaned.length ? cleaned : undefined;
  }
  if (typeof value === "string") {
    const cleaned = value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return cleaned.length ? cleaned : undefined;
  }
  return undefined;
}


