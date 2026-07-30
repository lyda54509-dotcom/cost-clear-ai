export function formatKES(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : (value ?? 0);
  if (!isFinite(n as number)) return "KES 0";
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(n as number);
}

export function formatPct(value: number | null | undefined, digits = 1): string {
  if (value == null || !isFinite(value)) return "—";
  return `${value.toFixed(digits)}%`;
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Canonical key for grouping item names (case/spacing insensitive). */
export function itemKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Display form for a grouped item name: "chips" -> "Chips". */
export function itemLabel(name: string): string {
  const t = name.trim().replace(/\s+/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}
