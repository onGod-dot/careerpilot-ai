/**
 * Simple in-memory + sessionStorage store for CV state.
 * Persists the extracted CV text and analysis across page navigations.
 */

export interface CVAnalysis {
  overallScore: number;
  atsReady: boolean;
  sections: {
    label: string;
    status: "good" | "warn" | "bad";
    score: number;
  }[];
  suggestions: string[];
  skills: string[];
  name?: string;
  headline?: string;
  /** City/country extracted from the CV (e.g. "Lagos, Nigeria" or "London, UK") */
  location?: string;
  /** Approximate years of experience detected in CV */
  yearsOfExperience?: number;
  /** Primary programming language(s) detected */
  primaryLanguages?: string[];
}

const SESSION_KEY = "careerpilot_cv";

function canUseSessionStorage(): boolean {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

export function saveCVText(text: string, fileName: string) {
  if (!canUseSessionStorage()) return;
  sessionStorage.setItem(SESSION_KEY + "_text", text);
  sessionStorage.setItem(SESSION_KEY + "_name", fileName);
}

export function loadCVText(): { text: string; fileName: string } | null {
  if (!canUseSessionStorage()) return null;
  const text = sessionStorage.getItem(SESSION_KEY + "_text");
  const fileName = sessionStorage.getItem(SESSION_KEY + "_name");
  if (!text || !fileName) return null;
  return { text, fileName };
}

export function saveCVAnalysis(analysis: CVAnalysis) {
  if (!canUseSessionStorage()) return;
  sessionStorage.setItem(SESSION_KEY + "_analysis", JSON.stringify(analysis));
}

export function loadCVAnalysis(): CVAnalysis | null {
  if (!canUseSessionStorage()) return null;
  const raw = sessionStorage.getItem(SESSION_KEY + "_analysis");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CVAnalysis;
  } catch {
    return null;
  }
}

export function clearCV() {
  if (!canUseSessionStorage()) return;
  sessionStorage.removeItem(SESSION_KEY + "_text");
  sessionStorage.removeItem(SESSION_KEY + "_name");
  sessionStorage.removeItem(SESSION_KEY + "_analysis");
}
