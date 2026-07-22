import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import {
  Code2,
  ClipboardCheck,
  ArrowRight,
  Timer,
  ChevronRight,
  Loader2,
  CheckCircle2,
  X,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { groqChat, MODEL_BALANCED } from "@/lib/groq";
import { stripMarkdown } from "@/lib/format";
import { pushActivity, pushSnapshot, loadSnapshots } from "@/lib/user-store";

export const Route = createFileRoute("/practice")({
  head: () => ({
    meta: [
      { title: "Practice — CareerPilot AI" },
      { name: "description", content: "Aptitude tests and coding assessments with AI review." },
      { property: "og:title", content: "Practice — CareerPilot AI" },
      { property: "og:description", content: "Sharpen your skills with adaptive practice." },
    ],
  }),
  component: PracticePage,
});

// ─── Types ────────────────────────────────────────────────────────────────────

interface AptitudeQuestion {
  question: string;
  options: string[];
  answer: number; // index
  explanation: string;
}

interface CodingProblem {
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  description: string;
  examples: { input: string; output: string }[];
  starterCode: string;
}

interface SessionResult {
  type: "aptitude" | "coding";
  title: string;
  score?: string;
  feedback: string;
  time: string;
}

type ActiveSession =
  | {
      type: "aptitude";
      questions: AptitudeQuestion[];
      current: number;
      answers: number[];
      done: boolean;
      feedback: string;
    }
  | { type: "coding"; problem: CodingProblem; code: string; feedback: string; done: boolean };

// ─── Page ─────────────────────────────────────────────────────────────────────

function PracticePage() {
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [loading, setLoading] = useState<"aptitude" | "coding" | null>(null);
  const [history, setHistory] = useState<SessionResult[]>([
    {
      type: "coding",
      title: "Two Sum • Easy",
      score: "Passed",
      feedback: "Runtime 62ms • Memory 42MB",
      time: "2h ago",
    },
    {
      type: "coding",
      title: "Longest Substring • Medium",
      score: "Needs work",
      feedback: "O(n²) → recommend O(n)",
      time: "Yesterday",
    },
    {
      type: "aptitude",
      title: "Verbal Reasoning Set 3",
      score: "78%",
      feedback: "Weakness: analogies",
      time: "2 days ago",
    },
  ]);

  const startAptitude = async () => {
    setLoading("aptitude");
    try {
      const questions = await generateAptitudeQuestions();
      setActiveSession({
        type: "aptitude",
        questions,
        current: 0,
        answers: [],
        done: false,
        feedback: "",
      });
    } catch {
      toast.error("Failed to generate questions. Please try again.");
    } finally {
      setLoading(null);
    }
  };

  const startCoding = async () => {
    setLoading("coding");
    try {
      const problem = await generateCodingProblem();
      setActiveSession({
        type: "coding",
        problem,
        code: problem.starterCode,
        feedback: "",
        done: false,
      });
    } catch {
      toast.error("Failed to generate problem. Please try again.");
    } finally {
      setLoading(null);
    }
  };

  const closeSession = (result?: SessionResult) => {
    if (result) setHistory((h) => [result, ...h]);
    setActiveSession(null);
  };

  if (activeSession?.type === "aptitude") {
    return (
      <AppShell title="Aptitude Test">
        <AptitudeSession
          session={activeSession}
          onUpdate={(s) => setActiveSession(s)}
          onClose={closeSession}
        />
      </AppShell>
    );
  }

  if (activeSession?.type === "coding") {
    return (
      <AppShell title="Coding Assessment">
        <CodingSession
          session={activeSession}
          onUpdate={(s) => setActiveSession(s)}
          onClose={closeSession}
        />
      </AppShell>
    );
  }

  return (
    <AppShell title="Practice">
      <PageHeader
        eyebrow="Sharpen"
        title="Practice arenas"
        description="Choose an arena. Each session ends with detailed AI feedback."
      />

      <div className="grid gap-4 md:grid-cols-2">
        {[
          {
            icon: ClipboardCheck,
            title: "Aptitude Test",
            desc: "Adaptive quiz across logical, numerical, and verbal reasoning.",
            meta: "5 questions • ~10 min",
            action: startAptitude,
            key: "aptitude" as const,
          },
          {
            icon: Code2,
            title: "Coding Assessment",
            desc: "LeetCode-style problem with instant AI code review.",
            meta: "1 problem • any language",
            action: startCoding,
            key: "coding" as const,
          },
        ].map((c) => (
          <div key={c.title} className="rounded-xl border border-border bg-card p-6">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
              <c.icon className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <div className="mt-5 text-lg font-semibold tracking-tight">{c.title}</div>
            <p className="mt-1 text-sm text-muted-foreground">{c.desc}</p>
            <div className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground">
              <Timer className="h-3 w-3" /> {c.meta}
            </div>
            <div className="mt-6">
              <button
                onClick={c.action}
                disabled={loading !== null}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {loading === c.key ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Generating…
                  </>
                ) : (
                  <>
                    Start session <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-xl border border-border bg-card p-6">
        <div className="mb-4 text-sm font-semibold">Recent sessions</div>
        <ul className="divide-y divide-border">
          {history.map((r, i) => (
            <li key={i} className="flex items-center justify-between py-3.5 text-sm">
              <div>
                <div className="font-medium">{r.title}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{r.feedback}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">{r.score}</span>
                <span className="text-xs text-muted-foreground">{r.time}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </AppShell>
  );
}

// ─── Aptitude Session ─────────────────────────────────────────────────────────

function AptitudeSession({
  session,
  onUpdate,
  onClose,
}: {
  session: Extract<ActiveSession, { type: "aptitude" }>;
  onUpdate: (s: ActiveSession) => void;
  onClose: (r?: SessionResult) => void;
}) {
  const [evaluating, setEvaluating] = useState(false);
  const q = session.questions[session.current];
  const total = session.questions.length;

  const answer = async (idx: number) => {
    const newAnswers = [...session.answers, idx];
    if (session.current + 1 >= total) {
      // Done — evaluate
      setEvaluating(true);
      const correct = newAnswers.filter((a, i) => a === session.questions[i].answer).length;
      const pct = Math.round((correct / total) * 100);
      const feedback = await evaluateAptitude(session.questions, newAnswers);
      onUpdate({ ...session, answers: newAnswers, done: true, feedback });
      setEvaluating(false);
      // persist activity + snapshot
      pushActivity("Aptitude test completed", `Score: ${pct}% · ${correct}/${total} correct`);
      const lastSnap = loadSnapshots().slice(-1)[0];
      pushSnapshot({ cv: lastSnap?.cv ?? 0, interview: pct, coding: lastSnap?.coding ?? 0 });
      onClose({
        type: "aptitude",
        title: `Aptitude Test`,
        score: `${pct}%`,
        feedback,
        time: "Just now",
      });
    } else {
      onUpdate({ ...session, current: session.current + 1, answers: newAnswers });
    }
  };

  if (session.done || evaluating) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-border bg-card px-6 py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <div className="text-sm text-muted-foreground">AI is evaluating your answers…</div>
      </div>
    );
  }

  const progress = (session.current / total) * 100;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader eyebrow={`Question ${session.current + 1} of ${total}`} title="Aptitude Test" />
        <button
          onClick={() => onClose()}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" /> Exit
        </button>
      </div>

      <div className="h-1.5 w-full rounded-full bg-muted">
        <div
          className="h-1.5 rounded-full bg-primary transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="rounded-xl border border-border bg-card p-8">
        <div className="mb-6 text-base font-medium leading-relaxed">{q.question}</div>
        <div className="grid gap-3">
          {q.options.map((opt, i) => (
            <button
              key={i}
              onClick={() => answer(i)}
              className="rounded-lg border border-border bg-background px-4 py-3 text-left text-sm transition-colors hover:border-primary hover:bg-primary/5"
            >
              <span className="mr-3 font-semibold text-muted-foreground">
                {["A", "B", "C", "D"][i]}.
              </span>
              {opt}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Coding Session ───────────────────────────────────────────────────────────

function CodingSession({
  session,
  onUpdate,
  onClose,
}: {
  session: Extract<ActiveSession, { type: "coding" }>;
  onUpdate: (s: ActiveSession) => void;
  onClose: (r?: SessionResult) => void;
}) {
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    try {
      const feedback = await reviewCode(session.problem, session.code);
      onUpdate({ ...session, feedback, done: true });
      toast.success("Submission reviewed!");
    } catch {
      toast.error("Review failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const diff = session.problem.difficulty;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <PageHeader eyebrow="Coding" title={session.problem.title} />
        <button
          onClick={() => onClose()}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" /> Exit
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Problem */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="mb-3 flex items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                diff === "Easy"
                  ? "bg-primary/10 text-primary"
                  : diff === "Medium"
                    ? "bg-[color:var(--color-warning)]/10 text-[color:var(--color-warning)]"
                    : "bg-destructive/10 text-destructive"
              }`}
            >
              {diff}
            </span>
          </div>
          <p className="text-sm leading-relaxed text-foreground">{session.problem.description}</p>
          <div className="mt-4 space-y-2">
            {session.problem.examples.map((ex, i) => (
              <div key={i} className="rounded-lg bg-secondary/50 p-3 text-xs font-mono">
                <div>
                  <span className="text-muted-foreground">Input:</span> {ex.input}
                </div>
                <div>
                  <span className="text-muted-foreground">Output:</span> {ex.output}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Editor */}
        <div className="flex flex-col gap-3">
          <textarea
            value={session.code}
            onChange={(e) => onUpdate({ ...session, code: e.target.value })}
            spellCheck={false}
            rows={18}
            className="w-full resize-none rounded-xl border border-border bg-[#1a1a2e] p-4 font-mono text-sm text-green-300 outline-none focus:border-primary"
          />
          {!session.done ? (
            <button
              onClick={submit}
              disabled={submitting || !session.code.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Reviewing…
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" /> Submit & get AI review
                </>
              )}
            </button>
          ) : (
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="h-4 w-4 text-primary" /> AI Feedback
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{stripMarkdown(session.feedback)}</p>
              <button
                onClick={() => {
                  // persist activity + coding snapshot
                  pushActivity(`Coding: ${session.problem.title}`, `${session.problem.difficulty} · AI reviewed`);
                  const lastSnap = loadSnapshots().slice(-1)[0];
                  pushSnapshot({ cv: lastSnap?.cv ?? 0, interview: lastSnap?.interview ?? 0, coding: 75 });
                  onClose({
                    type: "coding",
                    title: session.problem.title,
                    score: "Reviewed",
                    feedback: session.feedback.slice(0, 80),
                    time: "Just now",
                  });
                }}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-input bg-background px-3.5 py-2 text-sm font-medium hover:bg-accent"
              >
                <RotateCcw className="h-4 w-4" /> Back to Practice
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── AI helpers ───────────────────────────────────────────────────────────────

async function generateAptitudeQuestions(): Promise<AptitudeQuestion[]> {
  const raw = await groqChat(
    [
      {
        role: "user",
        content: `Generate 5 aptitude questions for a software engineering candidate. Mix of: logical reasoning, numerical reasoning, and verbal reasoning.

Return ONLY a JSON array (no markdown) with this shape:
[
  {
    "question": "...",
    "options": ["A text", "B text", "C text", "D text"],
    "answer": 0,
    "explanation": "..."
  }
]
answer is the 0-based index of the correct option.`,
      },
    ],
    { model: MODEL_BALANCED, temperature: 0.6, max_tokens: 1500 },
  );
  const clean = raw.replace(/```json|```/g, "").trim();
  return JSON.parse(clean) as AptitudeQuestion[];
}

async function evaluateAptitude(questions: AptitudeQuestion[], answers: number[]): Promise<string> {
  const correct = answers.filter((a, i) => a === questions[i].answer).length;
  const details = questions
    .map((q, i) => `Q${i + 1}: ${answers[i] === q.answer ? "✓" : "✗"} — ${q.explanation}`)
    .join("\n");

  return groqChat(
    [
      {
        role: "user",
        content: `A candidate scored ${correct}/${questions.length} on an aptitude test.

Results:
${details}

Write 2-3 sentences of constructive feedback highlighting strengths and areas to improve. Be specific.`,
      },
    ],
    { model: MODEL_BALANCED, temperature: 0.5, max_tokens: 200 },
  );
}

async function generateCodingProblem(): Promise<CodingProblem> {
  const difficulties = ["Easy", "Medium"];
  const diff = difficulties[Math.floor(Math.random() * difficulties.length)];
  const raw = await groqChat(
    [
      {
        role: "user",
        content: `Generate a ${diff} LeetCode-style coding problem for a Frontend/Full-stack engineer interview.

Return ONLY a JSON object (no markdown):
{
  "title": "Problem Title",
  "difficulty": "${diff}",
  "description": "Full problem description with constraints",
  "examples": [
    { "input": "nums = [2,7,11,15], target = 9", "output": "[0,1]" }
  ],
  "starterCode": "// JavaScript\\nfunction solve(input) {\\n  // your code here\\n}"
}`,
      },
    ],
    { model: MODEL_BALANCED, temperature: 0.7, max_tokens: 800 },
  );
  const clean = raw.replace(/```json|```/g, "").trim();
  return JSON.parse(clean) as CodingProblem;
}

async function reviewCode(problem: CodingProblem, code: string): Promise<string> {
  return groqChat(
    [
      {
        role: "user",
        content: `You are a senior engineer reviewing a code submission.

Problem: ${problem.title}
${problem.description}

Candidate's code:
\`\`\`
${code}
\`\`\`

Provide concise code review feedback (3-5 sentences):
- Does it solve the problem correctly?
- Time and space complexity?
- What's done well?
- What could be improved?`,
      },
    ],
    { model: MODEL_BALANCED, temperature: 0.4, max_tokens: 350 },
  );
}
