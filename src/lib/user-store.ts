/**
 * Persists user profile + activity history in sessionStorage.
 * Single source of truth read by dashboard, settings, sidebar, analytics.
 */

export interface UserProfile {
  name: string;
  email: string;
  location: string;
  headline: string;
  initials: string;
}

export interface ActivityEntry {
  id: string;
  title: string;
  detail: string;
  ts: number; // unix ms
}

export interface ScoreSnapshot {
  ts: number;
  cv: number;
  interview: number;
  coding: number;
}

const KEY_PROFILE = "cp_profile";
const KEY_ACTIVITY = "cp_activity";
const KEY_SNAPSHOTS = "cp_snapshots";

// ─── Profile ─────────────────────────────────────────────────────────────────

export function saveProfile(p: UserProfile) {
  sessionStorage.setItem(KEY_PROFILE, JSON.stringify(p));
}

export function loadProfile(): UserProfile {
  try {
    const raw = sessionStorage.getItem(KEY_PROFILE);
    if (raw) return JSON.parse(raw) as UserProfile;
  } catch {}
  return { name: "", email: "", location: "", headline: "", initials: "" };
}

/** Derive initials from a full name, e.g. "Jane Doe" → "JD" */
export function toInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

/** Shortened name e.g. "Jane Doe" → "Jane D." */
export function toShortName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "You";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

// ─── Activity feed ────────────────────────────────────────────────────────────

export function loadActivity(): ActivityEntry[] {
  try {
    const raw = sessionStorage.getItem(KEY_ACTIVITY);
    if (raw) return JSON.parse(raw) as ActivityEntry[];
  } catch {}
  return [];
}

export function pushActivity(title: string, detail: string) {
  const entries = loadActivity();
  entries.unshift({ id: crypto.randomUUID(), title, detail, ts: Date.now() });
  sessionStorage.setItem(KEY_ACTIVITY, JSON.stringify(entries.slice(0, 20)));
}

export function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

// ─── Score history ────────────────────────────────────────────────────────────

export function loadSnapshots(): ScoreSnapshot[] {
  try {
    const raw = sessionStorage.getItem(KEY_SNAPSHOTS);
    if (raw) return JSON.parse(raw) as ScoreSnapshot[];
  } catch {}
  return [];
}

export function pushSnapshot(snap: Omit<ScoreSnapshot, "ts">) {
  const snaps = loadSnapshots();
  snaps.push({ ...snap, ts: Date.now() });
  sessionStorage.setItem(KEY_SNAPSHOTS, JSON.stringify(snaps.slice(-12)));
}

/** Build weekly trend data for charts from snapshots */
export function buildTrend(snaps: ScoreSnapshot[]): { w: string; cv: number; int: number; code: number }[] {
  if (snaps.length === 0) return [];
  return snaps.map((s, i) => ({
    w: `W${i + 1}`,
    cv: s.cv,
    int: s.interview,
    code: s.coding,
  }));
}
