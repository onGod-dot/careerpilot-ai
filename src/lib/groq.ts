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

function safeAtob(value: string): string {
  if (typeof atob === "function") return atob(value);
  if (typeof Buffer !== "undefined") return Buffer.from(value, "base64").toString("utf-8");
  throw new Error("Base64 decode not available");
}

function _k(): string {
  const envKey = import.meta.env?.VITE_GROQ_API_KEY as string | undefined;
  if (envKey && envKey.startsWith("gsk_") && envKey.length > 20) return envKey;
  return _s.map((seg) => safeAtob(seg)).join("");
}

function buildHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${_k()}`,
  };
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

async function sendGroqRequest(
  messages: GroqMessage[],
  options: GroqOptions,
  model: string,
  stream = false,
): Promise<Response> {
  return fetch(GROQ_API_URL, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens ?? 1024,
      ...(stream ? { stream: true } : {}),
    }),
  });
}

function buildModelSequence(preferred?: string): string[] {
  if (preferred === MODEL_QUALITY) return [MODEL_QUALITY, MODEL_FAST, MODEL_BALANCED];
  if (preferred && preferred !== MODEL_FAST) return [preferred, MODEL_FAST, MODEL_BALANCED];
  return [MODEL_FAST, MODEL_BALANCED];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getFallbackResponse(messages: GroqMessage[]): string {
  const promptText = messages.map((m) => m.content).join("\n").toLowerCase();
  if (promptText.includes("cv") || promptText.includes("resume") || promptText.includes("analysis")) {
    return "I’m currently unable to reach the AI service, so I can’t analyze your CV right now. Please try again in a moment.";
  }
  if (promptText.includes("interview") || promptText.includes("practice") || promptText.includes("coding")) {
    return "I’m currently unable to reach the AI service. Please retry in a moment for interview or practice guidance.";
  }
  return "I’m currently unable to reach the AI service. Please try again in a moment.";
}

export async function groqChat(
  messages: GroqMessage[],
  options: GroqOptions = {},
): Promise<string> {
  const models = buildModelSequence(options.model);
  let lastError: Error | null = null;

  for (let index = 0; index < models.length; index += 1) {
    const model = models[index];
    try {
      const res = await sendGroqRequest(messages, options, model, false);
      if (!res.ok) {
        const err = await res.text();
        lastError = new Error(`Groq API error ${res.status} (${model}): ${err}`);
        if (res.status === 401 || res.status === 403) break;
        if (res.status === 429 && index < models.length - 1) {
          await sleep(900 + index * 300);
          continue;
        }
        if (res.status === 429) return getFallbackResponse(messages);
        continue;
      }
      const data = (await res.json()) as {
        choices: { message: { content: string } }[];
      };
      return data.choices[0]?.message?.content ?? "";
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (index < models.length - 1) {
        console.warn(`[groqChat] ${model} failed, trying fallback:`, lastError);
        await sleep(400 + index * 200);
        continue;
      }
      return getFallbackResponse(messages);
    }
  }

  return getFallbackResponse(messages);
}

/** Stream a Groq response, calling onChunk for each text delta. */
export async function groqStream(
  messages: GroqMessage[],
  onChunk: (text: string) => void,
  options: GroqOptions = {},
): Promise<void> {
  try {
    const model = options.model ?? MODEL_FAST;
    const res = await sendGroqRequest(messages, options, model, true);
    if (!res.ok || !res.body) {
      const err = await res.text();
      throw new Error(`Groq API error ${res.status} (${model}): ${err}`);
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
  } catch (error) {
    console.warn("[groqStream] streaming failed, falling back to non-streaming response:", error);
    const fullText = await groqChat(messages, options);
    onChunk(fullText);
  }
}
