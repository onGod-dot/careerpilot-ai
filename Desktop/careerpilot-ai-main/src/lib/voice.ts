/**
 * Voice helpers for AI Interview
 *
 * STT: Groq Whisper (whisper-large-v3-turbo) — FREE tier, 2000 RPD
 *      Records mic via MediaRecorder → sends WebM to Groq → instant transcript
 *
 * TTS: Web Speech API (SpeechSynthesis) — 100% FREE, built into every browser
 *      Groq Orpheus requires paid terms acceptance ($22/1M chars) — not used.
 *      Browser TTS gives male/female voice selection and works everywhere.
 */

import { getApiKey } from "./groq";

// ─── Voice definitions ────────────────────────────────────────────────────────

export type VoiceGender = "female" | "male";

export interface VoiceOption {
  id: string;
  label: string;
  gender: VoiceGender;
}

export const VOICE_OPTIONS: VoiceOption[] = [
  { id: "female-1", label: "Sarah (Female)",   gender: "female" },
  { id: "female-2", label: "Emma (Female)",    gender: "female" },
  { id: "female-3", label: "Jessica (Female)", gender: "female" },
  { id: "male-1",   label: "James (Male)",     gender: "male"   },
  { id: "male-2",   label: "David (Male)",     gender: "male"   },
  { id: "male-3",   label: "Robert (Male)",    gender: "male"   },
];

// ─── TTS via Web Speech API ───────────────────────────────────────────────────

let _voicesLoaded = false;
function ensureVoicesLoaded(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    const voices = speechSynthesis.getVoices();
    if (voices.length > 0) { _voicesLoaded = true; resolve(voices); return; }
    if (_voicesLoaded)      { resolve([]); return; }
    speechSynthesis.onvoiceschanged = () => {
      _voicesLoaded = true;
      resolve(speechSynthesis.getVoices());
    };
  });
}

/** Score a browser voice for quality — prefer en-US, neural, named voices */
function scoreVoice(v: SpeechSynthesisVoice, gender: VoiceGender): number {
  let s = 0;
  const n = v.name.toLowerCase();
  const l = v.lang.toLowerCase();
  if (l.startsWith("en-us")) s += 40;
  else if (l.startsWith("en"))  s += 20;
  // macOS high-quality voices
  if (n.includes("samantha") || n.includes("karen") || n.includes("moira"))  { if (gender === "female") s += 30; }
  if (n.includes("alex") || n.includes("daniel") || n.includes("fred"))      { if (gender === "male")   s += 30; }
  // Windows/Chrome neural voices
  if (n.includes("jenny") || n.includes("aria") || n.includes("michelle"))   { if (gender === "female") s += 25; }
  if (n.includes("guy") || n.includes("ryan") || n.includes("eric"))         { if (gender === "male")   s += 25; }
  // generic gender hints
  if (gender === "female" && (n.includes("female") || n.includes("woman") || n.includes("girl"))) s += 10;
  if (gender === "male"   && (n.includes("male")   || n.includes("man")   || n.includes("boy")))  s += 10;
  // prefer non-compact voices
  if (!n.includes("compact")) s += 5;
  return s;
}

function pickBestVoice(gender: VoiceGender, voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const englishVoices = voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
  if (englishVoices.length === 0) return voices[0] ?? null;
  return englishVoices.reduce((best, v) =>
    scoreVoice(v, gender) > scoreVoice(best, gender) ? v : best,
  );
}

/** Speak text using the browser's SpeechSynthesis API */
export async function speakText(
  text: string,
  voiceOption: VoiceOption,
  onStart?: () => void,
  onEnd?: () => void,
): Promise<void> {
  return new Promise(async (resolve) => {
    if (!window.speechSynthesis) { resolve(); return; }
    window.speechSynthesis.cancel();

    const voices = await ensureVoicesLoaded();
    const best   = pickBestVoice(voiceOption.gender, voices);

    const clean = text.replace(/\[.*?\]/g, "").trim().slice(0, 500);
    const utt   = new SpeechSynthesisUtterance(clean);

    utt.lang  = "en-US";
    utt.rate  = 0.92;
    utt.pitch = voiceOption.gender === "female" ? 1.1 : 0.9;
    if (best) utt.voice = best;

    utt.onstart = () => onStart?.();
    utt.onend   = () => { onEnd?.(); resolve(); };
    utt.onerror = () => resolve();

    window.speechSynthesis.speak(utt);
  });
}

export function stopSpeaking(): void {
  window.speechSynthesis?.cancel();
}

// ─── STT via Groq Whisper (FREE) ─────────────────────────────────────────────

const STT_MODEL = "whisper-large-v3-turbo";
const STT_URL   = "https://api.groq.com/openai/v1/audio/transcriptions";

/** Send recorded audio blob to Groq Whisper, get transcript back */
export async function transcribeWithGroq(blob: Blob): Promise<string> {
  const form = new FormData();
  form.append("file", blob, "audio.webm");
  form.append("model", STT_MODEL);
  form.append("language", "en");
  form.append("response_format", "json");

  const res = await fetch(STT_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${getApiKey()}` },
    body: form,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Whisper error ${res.status}: ${err}`);
  }

  const data = (await res.json()) as { text: string };
  return data.text?.trim() ?? "";
}
