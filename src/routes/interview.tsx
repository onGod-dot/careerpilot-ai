import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import {
  Mic, Square, RotateCcw, Loader2, Play, Volume2, VolumeX,
  ChevronDown, User, AlertCircle, CheckCircle2, XCircle, TrendingUp, RefreshCw,
} from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { groqChat, MODEL_FAST, type GroqMessage } from "@/lib/groq";
import { stripMarkdown } from "@/lib/format";
import { pushActivity, pushSnapshot, loadSnapshots } from "@/lib/user-store";
import { loadCVAnalysis } from "@/lib/cv-store";
import {
  VOICE_OPTIONS, speakText, stopSpeaking, transcribeWithGroq, type VoiceOption,
} from "@/lib/voice";

export const Route = createFileRoute("/interview")({
  head: () => ({
    meta: [
      { title: "AI Interview — CareerPilot AI" },
      { name: "description", content: "Voice-based AI mock interview with real-time scoring." },
    ],
  }),
  component: InterviewPage,
});

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message { role: "ai" | "user"; text: string; }
interface Score   { label: string; value: number; tip: string; }
interface QuestionReview {
  question: string;
  yourAnswer: string;
  score: number;
  feedback: string;
  idealAnswer: string;
}
type Stage = "idle" | "speaking" | "live" | "recording" | "transcribing" | "thinking" | "done";

function scoreTextColor(pct: number) {
  return pct >= 80 ? "text-primary" : pct >= 60 ? "text-[color:var(--color-warning)]" : "text-destructive";
}

function scoreBarColor(pct: number) {
  return pct >= 80 ? "bg-primary" : pct >= 60 ? "bg-[color:var(--color-warning)]" : "bg-destructive";
}

// ─── System prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(role: string, skills: string[], seed: number): string {
  // seed changes the question set so "Try again" gives fresh questions
  const sets = [
    "technical deep-dive, system design, a tricky problem-solving scenario, a behavioural (STAR method), and motivation/career goals",
    "architecture decisions, debugging approach, a past project challenge, teamwork & conflict, and where you see yourself in 3 years",
    "code quality & testing, scalability thinking, a time you failed and recovered, communication with non-technical stakeholders, and why this role",
    "core ${role} concepts, a real-world trade-off scenario, a behavioural about ownership, cultural fit, and your biggest technical achievement",
  ];
  const focus = sets[seed % sets.length].replace("${role}", role);
  return `You are a senior technical interviewer conducting a realistic mock job interview for a ${role} position.

Rules:
- Ask exactly 5 questions total, one at a time. Keep each question concise (max 2-3 sentences).
- After each answer (except the last), give 1 short sentence of constructive feedback, then ask the next question.
- After the 5th answer, give brief overall feedback, then IMMEDIATELY output the SCORE_JSON on its own line.
- Cover these 5 areas in order: ${focus}.
- Tailor questions to these skills: ${skills.slice(0, 5).join(", ")}.
- Be professional, warm, and push back gently to test depth.
- Do NOT ask more than 5 questions under any circumstances.
- ALWAYS keep responses short, simple, and precise. Avoid lengthy explanations.

After the 5th answer output ONLY this JSON block (no other text after it):
SCORE_JSON:{"confidence":0,"communication":0,"technical":0,"problemSolving":0,"professionalism":0,"tips":{"confidence":"specific tip","communication":"specific tip","technical":"specific tip","problemSolving":"specific tip","professionalism":"specific tip"},"improvements":["specific area 1","specific area 2","specific area 3"],"reviews":[{"question":"the exact question you asked","yourAnswer":"brief summary of what the candidate actually said","score":0,"feedback":"what was weak, missing, or could be improved in their answer","idealAnswer":"what a strong answer would include — be specific and actionable"}]}

Replace 0s with scores 0-100 based on actual answers given.
reviews must have exactly 5 entries — one per question asked, in order. score = how well they answered that specific question (0-100).
yourAnswer = concise summary of their actual response (not verbatim unless short).
idealAnswer = the key points a strong candidate would cover — this is the "correct" answer guide.
feedback = what they got wrong or missed for that question.
tips = one actionable sentence per dimension telling the candidate exactly how to improve that specific score.
improvements = 3 most impactful areas to work on, written as full sentences referencing what they actually said.
Start by greeting the candidate warmly and immediately asking your first question.`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InterviewPage() {
  const cv = loadCVAnalysis();
  const role   = cv?.headline || "Software Engineer";
  const skills = cv?.skills   || ["React", "TypeScript", "System Design"];

  const [stage,         setStage]         = useState<Stage>("idle");
  const [messages,      setMessages]      = useState<Message[]>([]);
  const [history,       setHistory]       = useState<GroqMessage[]>([]);
  const [scores,        setScores]        = useState<Score[]>([]);
  const [improvements,  setImprovements]  = useState<string[]>([]);
  const [questionReviews, setQuestionReviews] = useState<QuestionReview[]>([]);
  const [elapsed,       setElapsed]       = useState(0);
  const [qCount,        setQCount]        = useState(0);
  const [userInput,     setUserInput]     = useState("");
  const [voiceOption,   setVoiceOption]   = useState<VoiceOption>(VOICE_OPTIONS[0]);
  const [ttsEnabled,    setTtsEnabled]    = useState(true);
  const [ttsStatus,     setTtsStatus]     = useState("");
  const [recordSecs,    setRecordSecs]    = useState(0);
  const [seed,          setSeed]          = useState(0);

  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const recTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const mediaRecRef  = useRef<MediaRecorder | null>(null);
  const chunksRef    = useRef<Blob[]>([]);
  const scrollRef    = useRef<HTMLDivElement>(null);
  const inputRef     = useRef<HTMLTextAreaElement>(null);

  const selectedVoice = voiceOption;

  // auto-scroll transcript
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // session timer
  useEffect(() => {
    if (stage === "live" || stage === "recording" || stage === "transcribing") {
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [stage]);

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  // ─── Speak AI message ─────────────────────────────────────────────────────

  const speakAI = useCallback(async (text: string) => {
    if (!ttsEnabled) return;
    setStage("speaking");
    setTtsStatus(`${voiceOption.label} is speaking…`);
    await speakText(
      text,
      voiceOption,
      () => setTtsStatus(`${voiceOption.label} is speaking…`),
      () => setTtsStatus(""),
    );
    setTtsStatus("");
    setStage("live");
  }, [ttsEnabled, voiceOption]);

  // ─── Handle AI reply ──────────────────────────────────────────────────────

  const handleAIReply = useCallback(async (raw: string) => {
    const display = stripMarkdown(raw.replace(/SCORE_JSON:\{.*\}/gs, "").trim());
    const scoreMatch = raw.match(/SCORE_JSON:(\{.*?\})/s);

    if (display) {
      setMessages((m) => [...m, { role: "ai", text: display }]);
      await speakAI(display);
    }

    if (scoreMatch) {
      try {
        const s = JSON.parse(scoreMatch[1]) as {
          confidence: number; communication: number; technical: number;
          problemSolving: number; professionalism: number;
          tips: { confidence: string; communication: string; technical: string; problemSolving: string; professionalism: string };
          improvements: string[];
          reviews?: QuestionReview[];
        };
        const tips = s.tips ?? { confidence: "", communication: "", technical: "", problemSolving: "", professionalism: "" };
        const newScores: Score[] = [
          { label: "Confidence",      value: s.confidence,      tip: tips.confidence      || "" },
          { label: "Communication",   value: s.communication,   tip: tips.communication   || "" },
          { label: "Technical",       value: s.technical,       tip: tips.technical       || "" },
          { label: "Problem Solving", value: s.problemSolving,  tip: tips.problemSolving  || "" },
          { label: "Professionalism", value: s.professionalism, tip: tips.professionalism || "" },
        ];
        setScores(newScores);
        setImprovements(s.improvements ?? []);
        setQuestionReviews(s.reviews ?? []);
        setStage("done");
        const avg = Math.round(newScores.reduce((a, n) => a + n.value, 0) / newScores.length);
        pushActivity("Mock interview completed", `Score: ${avg}/100 · Technical ${s.technical}`);
        const last = loadSnapshots().slice(-1)[0];
        pushSnapshot({ cv: last?.cv ?? 0, interview: avg, coding: last?.coding ?? 0 });
        toast.success("Interview complete! Scores saved.");
      } catch { setStage("done"); }
    }
  }, [speakAI]);

  // ─── Send user answer to AI ───────────────────────────────────────────────

  const sendAnswer = useCallback(async (text: string, hist: GroqMessage[]) => {
    if (!text.trim()) return;
    setMessages((m) => [...m, { role: "user", text }]);
    setStage("thinking");
    const newHist: GroqMessage[] = [...hist, { role: "user", content: text }];
    try {
      const reply = await groqChat(
        [{ role: "system", content: buildSystemPrompt(role, skills, seed) }, ...newHist],
        { model: MODEL_FAST, temperature: 0.7, max_tokens: 1200 },
      );
      const updated: GroqMessage[] = [...newHist, { role: "assistant", content: reply }];
      setHistory(updated);
      setQCount((q) => q + 1);
      await handleAIReply(reply);
    } catch {
      toast.error("Connection error. Please try again.");
      setStage("live");
    }
  }, [role, skills, seed, handleAIReply]);

  // ─── Start interview ──────────────────────────────────────────────────────

  const startInterview = async () => {
    setMessages([]); setHistory([]); setElapsed(0); setQCount(0);
    setScores([]); setImprovements([]); setQuestionReviews([]); setUserInput("");
    setStage("thinking");
    try {
      const reply = await groqChat(
        [
          { role: "system", content: buildSystemPrompt(role, skills, seed) },
          { role: "user",   content: "Hello, I'm ready to start." },
        ],
        { model: MODEL_FAST, temperature: 0.7, max_tokens: 300 },
      );
      const initHist: GroqMessage[] = [
        { role: "user",      content: "Hello, I'm ready to start." },
        { role: "assistant", content: reply },
      ];
      setHistory(initHist);
      setQCount(1);
      await handleAIReply(reply);
    } catch {
      toast.error("Failed to start. Check your connection.");
      setStage("idle");
    }
  };

  // ─── Text submit ──────────────────────────────────────────────────────────

  const submitText = () => {
    const text = userInput.trim();
    if (!text || stage !== "live") return;
    setUserInput("");
    sendAnswer(text, history);
  };

  // ─── Mic recording via MediaRecorder → Groq Whisper ──────────────────────

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.start(250);
      mediaRecRef.current = mr;
      setRecordSecs(0);
      recTimerRef.current = setInterval(() => setRecordSecs((s) => s + 1), 1000);
      setStage("recording");
    } catch {
      toast.error("Microphone access denied.");
    }
  };

  const stopRecording = async () => {
    if (recTimerRef.current) clearInterval(recTimerRef.current);
    const mr = mediaRecRef.current;
    if (!mr) return;
    setStage("transcribing");
    mr.stop();
    mr.stream.getTracks().forEach((t) => t.stop());
    await new Promise<void>((res) => { mr.onstop = () => res(); });
    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    try {
      const text = await transcribeWithGroq(blob);
      if (text) {
        setUserInput(text);
        // auto-send after transcription
        sendAnswer(text, history);
      } else {
        toast("No speech detected. Try again.");
        setStage("live");
      }
    } catch {
      toast.error("Transcription failed. Type your answer instead.");
      setStage("live");
    }
  };

  const reset = () => {
    mediaRecRef.current?.stop();
    stopSpeaking();
    if (recTimerRef.current) clearInterval(recTimerRef.current);
    setStage("idle"); setMessages([]); setHistory([]);
    setElapsed(0); setQCount(0); setUserInput("");
    setTtsStatus(""); setScores([]); setImprovements([]); setQuestionReviews([]);
  };

  const tryAgain = () => {
    setSeed((s) => s + 1);
    reset();
  };

  const isBusy = ["speaking", "thinking", "transcribing"].includes(stage);

  return (
    <AppShell title="Interview">
      <PageHeader eyebrow="Voice" title="AI Mock Interview"
        description={`Speak or type your answers. The AI interviews you for ${role}, then scores and coaches you.`} />

      {/* Voice + TTS controls */}
      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Interviewer voice</span>
        </div>
        <div className="relative">
          <select
            value={voiceOption.id}
            onChange={(e) => setVoiceOption(VOICE_OPTIONS.find((v) => v.id === e.target.value) ?? VOICE_OPTIONS[0])}
            disabled={stage !== "idle"}
            className="appearance-none rounded-lg border border-input bg-background py-1.5 pl-3 pr-7 text-sm outline-none focus:border-ring disabled:opacity-50"
          >
            <optgroup label="Female">
              {VOICE_OPTIONS.filter((v) => v.gender === "female").map((v) => (
                <option key={v.id} value={v.id}>{v.label}</option>
              ))}
            </optgroup>
            <optgroup label="Male">
              {VOICE_OPTIONS.filter((v) => v.gender === "male").map((v) => (
                <option key={v.id} value={v.id}>{v.label}</option>
              ))}
            </optgroup>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <button
          onClick={() => setTtsEnabled((t) => !t)}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
            ttsEnabled ? "border-primary bg-primary/5 text-primary" : "border-border bg-background text-muted-foreground"
          }`}
        >
          {ttsEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
          {ttsEnabled ? "Voice on" : "Voice off"}
        </button>
        {ttsStatus && (
          <span className="text-xs text-muted-foreground animate-pulse">{ttsStatus}</span>
        )}
        <div className="ml-auto text-xs text-muted-foreground">
          Role: <span className="font-medium text-foreground">{role}</span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">

        {/* Left — controls + input */}
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-8">
            <div className="flex flex-col items-center gap-6">
              {/* Animated orb */}
              <div className="relative grid h-36 w-36 place-items-center">
                <div className={`absolute inset-0 rounded-full border border-border transition-all ${
                  stage === "live" || stage === "recording" ? "animate-ping opacity-20" : "opacity-0"
                }`} />
                <div className={`absolute inset-3 rounded-full border border-primary/20 transition-all ${
                  stage === "speaking" ? "animate-pulse" : ""
                }`} />
                <div className={`grid h-20 w-20 place-items-center rounded-full transition-all duration-300 ${
                  stage === "recording" ? "bg-red-500 text-white shadow-lg shadow-red-500/30" :
                  stage === "speaking"  ? "bg-primary text-primary-foreground scale-110" :
                  stage === "thinking" || stage === "transcribing" ? "bg-muted" :
                  stage === "done"     ? "bg-primary/80 text-primary-foreground" :
                  stage === "live"     ? "bg-primary text-primary-foreground" :
                  "bg-muted text-muted-foreground"
                }`}>
                  {isBusy ? <Loader2 className="h-7 w-7 animate-spin text-primary" /> :
                   stage === "recording" ? <Square className="h-7 w-7" /> :
                   stage === "done"      ? <CheckCircle2 className="h-7 w-7" /> :
                   <Mic className="h-7 w-7" />}
                </div>
              </div>

              {/* Status */}
              <div className="text-center">
                <p className="text-sm font-medium">
                  {stage === "idle"         && "Choose a voice and start"}
                  {stage === "speaking"     && `${voiceOption.label} is speaking…`}
                  {stage === "live"         && "Your turn — speak or type"}
                  {stage === "recording"    && `Recording… ${fmt(recordSecs)}`}
                  {stage === "transcribing" && "Transcribing with Whisper…"}
                  {stage === "thinking"     && "AI is thinking…"}
                  {stage === "done"         && "Interview complete!"}
                </p>
                {stage !== "idle" && stage !== "done" && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {fmt(elapsed)} · Q {qCount} / 5
                  </p>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2">
                {stage === "idle" && (
                  <button onClick={startInterview}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                    <Play className="h-4 w-4" /> Start interview
                  </button>
                )}
                {stage === "live" && (
                  <button onClick={startRecording}
                    className="inline-flex items-center gap-2 rounded-xl bg-red-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-600">
                    <Mic className="h-4 w-4" /> Hold to record
                  </button>
                )}
                {stage === "recording" && (
                  <button onClick={stopRecording}
                    className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 animate-pulse">
                    <Square className="h-4 w-4" /> Stop & send
                  </button>
                )}
                {stage === "done" && (
                  <button onClick={reset}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                    <RotateCcw className="h-4 w-4" /> New interview
                  </button>
                )}
                {(stage === "live" || stage === "speaking" || stage === "thinking") && (
                  <button onClick={reset}
                    className="rounded-xl border border-input bg-background px-4 py-2.5 text-sm font-medium hover:bg-accent">
                    End
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Text input fallback */}
          {(stage === "live" || stage === "speaking") && (
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="mb-2 text-xs text-muted-foreground">Or type your answer:</p>
              <div className="flex gap-2">
                <textarea ref={inputRef} value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitText(); } }}
                  disabled={isBusy}
                  placeholder="Type and press Enter to send…"
                  rows={3}
                  className="flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:opacity-50"
                />
                <button onClick={submitText} disabled={!userInput.trim() || isBusy}
                  className="self-end grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                  <Play className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right — transcript */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="mb-4 text-sm font-semibold">Live transcript</div>
          <div ref={scrollRef} className="flex max-h-[480px] flex-col gap-3 overflow-y-auto pr-1">
            {messages.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                The conversation will appear here as you talk.
              </p>
            ) : (
              messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[88%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-background text-foreground"
                  }`}>
                    {m.text}
                  </div>
                </div>
              ))
            )}
            {stage === "thinking" && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1.5 rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> thinking…
                </div>
              </div>
            )}
            {stage === "transcribing" && (
              <div className="flex justify-end">
                <div className="flex items-center gap-1.5 rounded-xl bg-primary/20 px-3.5 py-2.5 text-xs text-primary">
                  <Loader2 className="h-3 w-3 animate-spin" /> transcribing…
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Scores + improvement report */}
      {stage === "done" && scores.length > 0 && (() => {
        const overallAvg = Math.round(scores.reduce((a, s) => a + s.value, 0) / scores.length);
        const weakAnswers = questionReviews.filter((r) => r.score < 80).length;
        return (
        <div className="mt-8 space-y-4">

          {/* Overall score hero */}
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Interview Result</p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className={`text-6xl font-bold ${scoreTextColor(overallAvg)}`}>
                    {overallAvg}
                  </span>
                  <span className="text-xl text-muted-foreground">/ 100</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {overallAvg >= 80
                    ? "Strong performance — you're interview-ready."
                    : overallAvg >= 60
                      ? "Good effort. Work on the areas below to level up."
                      : "Keep practising. Detailed coaching tips are below."}
                </p>
                {questionReviews.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                      <CheckCircle2 className="h-3.5 w-3.5" /> {questionReviews.length - weakAnswers} strong answers
                    </span>
                    {weakAnswers > 0 && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-3 py-1 text-xs font-medium text-destructive">
                        <XCircle className="h-3.5 w-3.5" /> {weakAnswers} to improve
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={tryAgain}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <RefreshCw className="h-4 w-4" /> Try again — new questions
                </button>
                <button
                  onClick={reset}
                  className="inline-flex items-center gap-2 rounded-xl border border-input bg-background px-4 py-2.5 text-sm font-medium hover:bg-accent transition-colors"
                >
                  <RotateCcw className="h-4 w-4" /> Same set
                </button>
              </div>
            </div>
            <div className="mt-5 h-2.5 w-full rounded-full bg-muted">
              <div
                className={`h-2.5 rounded-full transition-all duration-1000 ${scoreBarColor(overallAvg)}`}
                style={{ width: `${overallAvg}%` }}
              />
            </div>
          </div>

          {/* Per-dimension score cards with improvement tips */}
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="mb-5 flex items-center justify-between">
              <div className="text-sm font-semibold">Score breakdown</div>
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">5 dimensions</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {scores.map((r) => (
                  <div key={r.label} className="rounded-xl border border-border bg-background p-4">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{r.label}</div>
                    <div className={`mt-1 text-3xl font-bold ${scoreTextColor(r.value)}`}>
                      {r.value}
                    </div>
                    <div className="mt-2 h-1.5 w-full rounded-full bg-muted">
                      <div className={`h-1.5 rounded-full transition-all duration-700 ${scoreBarColor(r.value)}`} style={{ width: `${r.value}%` }} />
                    </div>
                    {r.tip && (
                      <p className="mt-2.5 text-[11px] leading-relaxed text-muted-foreground line-clamp-3">{r.tip}</p>
                    )}
                  </div>
              ))}
            </div>
          </div>

          {/* Question-by-question review */}
          {questionReviews.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <AlertCircle className="h-4 w-4 text-primary" />
                  Answer review
                </div>
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                  {questionReviews.length} questions
                </span>
              </div>
              <div className="space-y-4">
                {questionReviews.map((review, i) => {
                  const isStrong = review.score >= 80;
                  return (
                    <div
                      key={i}
                      className={`rounded-xl border p-4 ${
                        isStrong ? "border-border bg-background" : "border-destructive/30 bg-destructive/5"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full ${
                          isStrong ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
                        }`}>
                          {isStrong ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-semibold text-muted-foreground">Q{i + 1}</span>
                            <span className={`ml-auto text-sm font-bold ${scoreTextColor(review.score)}`}>
                              {review.score}/100
                            </span>
                          </div>
                          <p className="mt-1.5 text-sm font-medium leading-relaxed">{review.question}</p>

                          <div className="mt-3 h-1.5 w-full rounded-full bg-muted">
                            <div className={`h-1.5 rounded-full ${scoreBarColor(review.score)}`} style={{ width: `${review.score}%` }} />
                          </div>

                          <div className="mt-3 space-y-2">
                            <div className={`rounded-lg border px-3 py-2.5 ${
                              isStrong ? "border-border bg-secondary/30" : "border-destructive/20 bg-destructive/5"
                            }`}>
                              <p className={`text-[10px] font-semibold uppercase tracking-wider ${
                                isStrong ? "text-muted-foreground" : "text-destructive"
                              }`}>Your answer</p>
                              <p className="mt-1 text-sm leading-relaxed">{stripMarkdown(review.yourAnswer)}</p>
                            </div>

                            {!isStrong && review.feedback && (
                              <div className="rounded-lg border border-[color:var(--color-warning)]/20 bg-[color:var(--color-warning)]/5 px-3 py-2.5">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--color-warning)]">
                                  What to improve
                                </p>
                                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{stripMarkdown(review.feedback)}</p>
                              </div>
                            )}

                            <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5">
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                                {isStrong ? "Why this worked" : "Stronger answer"}
                              </p>
                              <p className="mt-1 text-sm leading-relaxed">{stripMarkdown(review.idealAnswer)}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Top 3 improvement areas */}
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
              <TrendingUp className="h-4 w-4 text-primary" />
              Top areas to work on
            </div>
            {improvements.length > 0 ? (
              <ul className="space-y-3">
                {improvements.map((imp, i) => (
                  <li key={i} className="flex gap-3 rounded-lg border border-border bg-background p-4">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-warning)]/10 text-xs font-bold text-[color:var(--color-warning)]">
                      {i + 1}
                    </span>
                    <span className="text-sm leading-relaxed text-foreground">{stripMarkdown(imp)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No specific areas flagged — great job!</p>
            )}
          </div>

          {/* Bottom CTA */}
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-6 text-center">
            <p className="text-sm font-semibold">Ready to go again with a fresh set of questions?</p>
            <p className="text-xs text-muted-foreground max-w-sm">
              Each session covers different topics — the more you practice, the higher your score.
            </p>
            <button
              onClick={tryAgain}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <RefreshCw className="h-4 w-4" /> Try again — different questions
            </button>
          </div>

        </div>
        );
      })()}
    </AppShell>
  );
}
