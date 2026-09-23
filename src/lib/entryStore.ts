export function loadEntries<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveEntries<T>(key: string, entries: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(entries));
  } catch {
    // storage full or unavailable — persistence is best-effort
  }
}

/** Inserts an entry, replacing any existing entry for the same date, and keeps the list sorted newest-first. */
export function upsertByDate<T extends { date: string }>(entries: T[], entry: T): T[] {
  const withoutDate = entries.filter((e) => e.date !== entry.date);
  return [...withoutDate, entry].sort((a, b) => b.date.localeCompare(a.date));
}

export function removeByDate<T extends { date: string }>(entries: T[], date: string): T[] {
  return entries.filter((e) => e.date !== date);
}

export function removeById<T extends { id: string }>(entries: T[], id: string): T[] {
  return entries.filter((e) => e.id !== id);
}

export function loadObject<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function saveObject<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or unavailable — persistence is best-effort
  }
}

export function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
