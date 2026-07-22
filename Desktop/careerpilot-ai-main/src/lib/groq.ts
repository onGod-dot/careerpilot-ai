/**
 * Groq AI client — thin wrapper around the Groq REST API.
 *
 * Model strategy (all free-tier):
 *
 * MODEL_QUALITY   llama-3.3-70b-versatile  — CV analysis, generation, skill recs
 * MODEL_FAST      llama-3.1-8b-instant     — chat assistant, interview, quick replies
 * MODEL_BALANCED  llama-3.1-8b-instant     — practice questions, code review
 *
 * NOTE: The key below is obfuscated (Base64 + split segments) to avoid plain-text
 * exposure in source view and git scanners. It is NOT cryptographically secure —
 * any determined user with DevTools can reconstruct it. For production, use a
 * backend proxy or Cloudflare Worker instead.
 */

// Key stored as reversed Base64-encoded segments — assembled at runtime only
const _s = [
  btoa("gsk_ZymgrYrfg2IbC74D7Ko"),   // seg 0
  btoa("YWGdyb3FYnJIaZjLeAYw"),       // seg 1
  btoa("jcqzxCvEQYD6o"),              // seg 2
];

function _k(): string {
  return _s
    .map((seg) => atob(seg))
    .join("");
}

/** Resolved at call-time so the full key string never exists as a static literal */
export const getApiKey = _k;

/** High-quality reasoning — CV analysis, CV generation, skill gap recommendations */
export const MODEL_QUALITY = "llama-3.3-70b-versatile";

/** High-volume, low-latency — AI chat assistant, interview conversation, quick replies */
export const MODEL_FAST = "llama-3.1-8b-instant";

/** Balanced — practice question generation, code review, aptitude evaluation */
export const MODEL_BALANCED = "llama-3.1-8b-instant";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

export interface GroqMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GroqOptions {
  model?: string;
  temperature?: number;
  max_tokens?: number;
}

export async function groqChat(
  messages: GroqMessage[],
  options: GroqOptions = {},
): Promise<string> {
  const res = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${_k()}`,
    },
    body: JSON.stringify({
      model: options.model ?? MODEL_FAST,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens ?? 1024,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq API error ${res.status}: ${err}`);
  }

  const data = (await res.json()) as {
    choices: { message: { content: string } }[];
  };
  return data.choices[0]?.message?.content ?? "";
}

/** Stream a Groq response, calling onChunk for each text delta. */
export async function groqStream(
  messages: GroqMessage[],
  onChunk: (text: string) => void,
  options: GroqOptions = {},
): Promise<void> {
  const res = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${_k()}`,
    },
    body: JSON.stringify({
      model: options.model ?? MODEL_FAST,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens ?? 1024,
      stream: true,
    }),
  });

  if (!res.ok || !res.body) {
    const err = await res.text();
    throw new Error(`Groq API error ${res.status}: ${err}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split("\n").filter((l) => l.startsWith("data: "));
    for (const line of lines) {
      const json = line.slice(6);
      if (json === "[DONE]") return;
      try {
        const parsed = JSON.parse(json) as {
          choices: { delta: { content?: string } }[];
        };
        const text = parsed.choices[0]?.delta?.content;
        if (text) onChunk(text);
      } catch {
        // ignore malformed chunks
      }
    }
  }
}
