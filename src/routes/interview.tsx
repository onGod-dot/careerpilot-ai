import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Mic, MicOff, Play, Square, RotateCcw, Loader2 } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { groqChat, MODEL_FAST, type GroqMessage } from "@/lib/groq";
import { stripMarkdown } from "@/lib/format";
import { pushActivity, pushSnapshot, loadSnapshots } from "@/lib/user-store";

export const Route = createFileRoute("/interview")({
  head: () => ({
    meta: [
      { title: "AI Interview — CareerPilot AI" },
      {
        name: "description",
        content: "Practice voice-based interviews with real-time AI feedback.",
      },
      { property: "og:title", content: "AI Interview — CareerPilot AI" },
      { property: "og:description", content: "Realistic mock interviews, scored." },
    ],
  }),
  component: InterviewPage,
});

interface Message {
  role: "ai" | "user";
  text: string;
}

interface Score {
  label: string;
  value: number;
}

const SYSTEM_PROMPT = `You are a senior technical interviewer conducting a realistic job interview for a Senior Frontend Engineer position. 

Rules:
- Ask one question at a time. Keep questions concise.
- After the candidate answers, give brief constructive feedback (1-2 sentences), then ask the next question.
- Cover: React/TypeScript experience, system design, problem-solving, behavioral questions, and career motivation.
- Be professional but warm. Push back gently to test depth of knowledge.
- After 6-8 exchanges, end the interview and provide a structured score in this exact JSON format on its own line:
SCORE_JSON:{"confidence":85,"communication":78,"technical":88,"problemSolving":74,"professionalism":91}
- Start by greeting the candidate and asking your first question immediately.`;

type Stage = "idle" | "live" | "thinking" | "done";

export default function InterviewPage() {
  const [stage, setStage] = useState<Stage>("idle");
  const [messages, setMessages] = useState<Message[]>([]);
  const [history, setHistory] = useState<GroqMessage[]>([]);
  const [scores, setScores] = useState<Score[]>([
    { label: "Confidence",      value: 0 },
    { label: "Communication",   value: 0 },
    { label: "Technical",       value: 0 },
    { label: "Problem Solving", value: 0 },
    { label: "Professionalism", value: 0 },
  ]);
  const [elapsed, setElapsed] = useState(0);
  const [questionCount, setQuestionCount] = useState(0);
  const [userInput, setUserInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const transcriptRef = useRef("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const SR =
      window.SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: typeof SpeechRecognition })
        .webkitSpeechRecognition;
    setIsSpeechSupported(!!SR);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (stage === "live") {
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [stage]);

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const addAIMessage = useCallback((text: string) => {
    // Strip the SCORE_JSON line from displayed text
    const display = text.replace(/SCORE_JSON:\{.*\}/g, "").trim();
    if (display) setMessages((m) => [...m, { role: "ai", text: display }]);

    // Parse scores if present
    const scoreMatch = text.match(/SCORE_JSON:(\{.*\})/);
    if (scoreMatch) {
      try {
        const s = JSON.parse(scoreMatch[1]) as Record<string, number>;
        const newScores = [
          { label: "Confidence",      value: s.confidence    ?? 80 },
          { label: "Communication",   value: s.communication ?? 80 },
          { label: "Technical",       value: s.technical     ?? 80 },
          { label: "Problem Solving", value: s.problemSolving ?? 80 },
          { label: "Professionalism", value: s.professionalism ?? 80 },
        ];
        setScores(newScores);
        setStage("done");
        // persist to activity feed + analytics snapshots
        const avgScore = Math.round(newScores.reduce((a, n) => a + n.value, 0) / newScores.length);
        pushActivity("Mock interview completed", `Score: ${avgScore}/100 · Technical ${s.technical ?? 80} · Confidence ${s.confidence ?? 80}`);
        const lastSnap = loadSnapshots().slice(-1)[0];
        pushSnapshot({ cv: lastSnap?.cv ?? 0, interview: avgScore, coding: lastSnap?.coding ?? 0 });
        toast.success("Interview complete! Scores saved.");
      } catch {
        setStage("done");
      }
    }
  }, []);

  const sendToAI = useCallback(
    async (userText: string, currentHistory: GroqMessage[]) => {
      setStage("thinking");
      const newHistory: GroqMessage[] = [...currentHistory, { role: "user", content: userText }];
      try {
        const reply = await groqChat([{ role: "system", content: SYSTEM_PROMPT }, ...newHistory], {
          model: MODEL_FAST,
          temperature: 0.7,
          max_tokens: 400,
        });
        const updated: GroqMessage[] = [...newHistory, { role: "assistant", content: reply }];
        setHistory(updated);
        addAIMessage(reply);
        setQuestionCount((q) => q + 1);

        const hasScore = reply.includes("SCORE_JSON:");
        if (!hasScore) setStage("live");
      } catch {
        toast.error("Connection error. Please try again.");
        setStage("live");
      }
    },
    [addAIMessage],
  );

  const startInterview = async () => {
    setMessages([]);
    setHistory([]);
    setElapsed(0);
    setQuestionCount(0);
    setStage("thinking");
    try {
      const reply = await groqChat(
        [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: "Hello, I'm ready to start." },
        ],
        { model: MODEL_FAST, temperature: 0.7, max_tokens: 300 },
      );
      const initialHistory: GroqMessage[] = [
        { role: "user", content: "Hello, I'm ready to start." },
        { role: "assistant", content: reply },
      ];
      setHistory(initialHistory);
      addAIMessage(reply);
      setQuestionCount(1);
      setStage("live");
    } catch {
      toast.error("Failed to start interview. Check your connection.");
      setStage("idle");
    }
  };

  const sendMessage = async () => {
    const text = userInput.trim();
    if (!text || stage === "thinking" || stage === "done") return;
    setMessages((m) => [...m, { role: "user", text }]);
    setUserInput("");
    await sendToAI(text, history);
  };

  const startListening = () => {
    const SR =
      window.SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: typeof SpeechRecognition })
        .webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    transcriptRef.current = "";
    rec.onresult = (e) => {
      let interim = "";
      let final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      transcriptRef.current += final;
      setUserInput(transcriptRef.current + interim);
    };
    rec.onerror = () => {
      setIsListening(false);
    };
    rec.onend = () => {
      setIsListening(false);
    };
    recognitionRef.current = rec;
    rec.start();
    setIsListening(true);
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
  };

  const reset = () => {
    setStage("idle");
    setMessages([]);
    setHistory([]);
    setElapsed(0);
    setQuestionCount(0);
    setUserInput("");
  };

  return (
    <AppShell title="Interview">
      <PageHeader
        eyebrow="Voice"
        title="AI Interview"
        description="Speak naturally. The AI listens, asks follow-ups, and scores you at the end."
      />

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        {/* Controls */}
        <div className="rounded-xl border border-border bg-card p-8">
          <div className="flex flex-col items-center py-6">
            <div className="relative grid h-40 w-40 place-items-center">
              <div
                className={`absolute inset-0 rounded-full border border-border ${stage === "live" ? "animate-ping opacity-30" : ""}`}
              />
              <div
                className={`absolute inset-3 rounded-full border border-primary/30 ${stage === "live" ? "animate-pulse" : ""}`}
              />
              <div
                className={`grid h-24 w-24 place-items-center rounded-full text-primary-foreground transition-colors ${
                  stage === "thinking"
                    ? "bg-muted text-muted-foreground"
                    : stage === "done"
                      ? "bg-primary/70"
                      : stage === "live"
                        ? "bg-primary"
                        : "bg-muted text-muted-foreground"
                }`}
              >
                {stage === "thinking" ? (
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                ) : stage === "live" ? (
                  <Mic className="h-8 w-8" />
                ) : (
                  <MicOff className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
            </div>

            <div className="mt-6 text-sm text-muted-foreground">
              {stage === "idle" && "Tap start to begin your AI interview"}
              {stage === "thinking" && "AI is thinking…"}
              {stage === "live" && "Interview in progress"}
              {stage === "done" && "Interview complete!"}
            </div>

            <div className="mt-4 flex items-center gap-2">
              {stage === "idle" && (
                <button
                  onClick={startInterview}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  <Play className="h-4 w-4" /> Start interview
                </button>
              )}
              {(stage === "live" || stage === "thinking") && (
                <button
                  onClick={reset}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
                >
                  <Square className="h-4 w-4" /> End
                </button>
              )}
              {stage === "done" && (
                <button
                  onClick={reset}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  <RotateCcw className="h-4 w-4" /> New interview
                </button>
              )}
              {stage !== "idle" && (
                <>
                  <div className="rounded-md border border-border bg-background px-2.5 py-1 text-xs tabular-nums text-muted-foreground">
                    {fmt(elapsed)}
                  </div>
                  <div className="rounded-md border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground">
                    Q {questionCount} / 8
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Text input for answering */}
          {(stage === "live" || stage === "thinking") && (
            <div className="mt-4 flex items-end gap-2">
              <textarea
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Type your answer… (or use mic below)"
                rows={3}
                disabled={stage === "thinking"}
                className="flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:opacity-50"
              />
              <div className="flex flex-col gap-2">
                {isSpeechSupported && (
                  <button
                    onClick={isListening ? stopListening : startListening}
                    disabled={stage === "thinking"}
                    className={`grid h-9 w-9 place-items-center rounded-lg border ${
                      isListening
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input bg-background hover:bg-accent"
                    } disabled:opacity-50`}
                    title={isListening ? "Stop recording" : "Start recording"}
                  >
                    {isListening ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </button>
                )}
                <button
                  onClick={sendMessage}
                  disabled={!userInput.trim() || stage === "thinking"}
                  className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  <Play className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Transcript */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="text-sm font-semibold">Transcript</div>
          <div
            ref={scrollRef}
            className="mt-5 flex max-h-[380px] flex-col gap-3 overflow-y-auto pr-1"
          >
            {messages.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                The conversation will appear here once you start.
              </p>
            ) : (
              messages.map((m, i) => <Bubble key={i} side={m.role} text={m.role === "ai" ? stripMarkdown(m.text) : m.text} />)
            )}
            {stage === "thinking" && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3.5 py-2.5 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> thinking…
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Scores */}
      <div className="mt-8 rounded-xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-sm font-semibold">
            {stage === "done" ? "Your interview scores" : "Session scores"}
          </div>
          {stage === "done" && (
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              Updated
            </span>
          )}
        </div>
        {scores.every((r) => r.value === 0) ? (
          <p className="text-sm text-muted-foreground">
            Complete an interview session to see your scores here.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {scores.map((r) => (
              <div key={r.label} className="rounded-lg border border-border bg-background p-4">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {r.label}
                </div>
                <div className="mt-1 text-xl font-semibold">{r.value}</div>
                <div className="mt-2 h-1 w-full rounded-full bg-muted">
                  <div
                    className="h-1 rounded-full bg-primary transition-all duration-700"
                    style={{ width: `${r.value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Bubble({ side, text }: { side: "ai" | "user"; text: string }) {
  return (
    <div className={`flex ${side === "user" ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-lg px-3.5 py-2.5 text-sm ${
          side === "user"
            ? "bg-primary text-primary-foreground"
            : "border border-border bg-background text-foreground"
        }`}
      >
        {text}
      </div>
    </div>
  );
}
