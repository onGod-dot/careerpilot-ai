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
  XCircle,
  X,
  RotateCcw,
  Sparkles,
  User,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { groqChat, MODEL_BALANCED, MODEL_QUALITY } from "@/lib/groq";
import { stripMarkdown } from "@/lib/format";
import { pushActivity, pushSnapshot, loadSnapshots } from "@/lib/user-store";
import { loadCVAnalysis } from "@/lib/cv-store";

export const Route = createFileRoute("/practice")({
  head: () => ({
    meta: [
      { title: "Practice — CareerPilot AI" },
      { name: "description", content: "Aptitude tests and coding assessments tailored to your CV." },
      { property: "og:title", content: "Practice — CareerPilot AI" },
      { property: "og:description", content: "Sharpen your skills with adaptive, CV-personalised practice." },
    ],
  }),
  component: PracticePage,
});

// ─── Types ────────────────────────────────────────────────────────────────────

interface AptitudeQuestion {
  question: string;
  options: string[];
  answer: number; // 0-based index
  explanation: string;
  category: "logical" | "numerical" | "verbal" | "domain";
}

interface CodingProblem {
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  description: string;
  examples: { input: string; output: string }[];
  starterCode: string;
  language: string;
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
      scorePct?: number;
      correctCount?: number;
    }
  | { type: "coding"; problem: CodingProblem; code: string; feedback: string; done: boolean };

const OPTION_LABELS = ["A", "B", "C", "D"];

const CATEGORY_LABELS: Record<AptitudeQuestion["category"], string> = {
  logical: "Logical Reasoning",
  numerical: "Numerical Reasoning",
  verbal: "Verbal Reasoning",
  domain: "Domain / Role Knowledge",
};

function scoreTextColor(pct: number) {
  return pct >= 80 ? "text-primary" : pct >= 60 ? "text-[color:var(--color-warning)]" : "text-destructive";
}

function scoreBarColor(pct: number) {
  return pct >= 80 ? "bg-primary" : pct >= 60 ? "bg-[color:var(--color-warning)]" : "bg-destructive";
}

function computeCategoryBreakdown(questions: AptitudeQuestion[], answers: number[]) {
  const byCategory: Record<string, { correct: number; total: number }> = {};
  questions.forEach((q, i) => {
    byCategory[q.category] = byCategory[q.category] ?? { correct: 0, total: 0 };
    byCategory[q.category].total++;
    if (answers[i] === q.answer) byCategory[q.category].correct++;
  });
  return byCategory;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function PracticePage() {
  const cv = loadCVAnalysis();
  const role   = cv?.headline || "Software Engineer";
  const skills = (cv?.skills ?? []).slice(0, 8).join(", ") || "general programming";
  const years  = cv?.yearsOfExperience ?? 2;
  const langs  = (cv?.primaryLanguages ?? []).join(", ") || "JavaScript";

  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [loading, setLoading] = useState<"aptitude" | "coding" | null>(null);
  const [history, setHistory] = useState<SessionResult[]>([]);

  const startAptitude = async () => {
    setLoading("aptitude");
    try {
      const questions = await generateAptitudeQuestions(role, skills, years);
      setActiveSession({ type: "aptitude", questions, current: 0, answers: [], done: false, feedback: "" });
    } catch {
      toast.error("Failed to generate questions. Please try again.");
    } finally {
      setLoading(null);
    }
  };

  const startCoding = async () => {
    setLoading("coding");
    try {
      const problem = await generateCodingProblem(role, skills, langs, years);
      setActiveSession({ type: "coding", problem, code: problem.starterCode, feedback: "", done: false });
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
          onRetry={startAptitude}
        />
      </AppShell>
    );
  }

  if (activeSession?.type === "coding") {
    return (
      <AppShell title="Coding Assessment">
        <CodingSession session={activeSession} onUpdate={(s) => setActiveSession(s)} onClose={closeSession} />
      </AppShell>
    );
  }

  return (
    <AppShell title="Practice">
      <PageHeader
        eyebrow="Sharpen"
        title="Practice arenas"
        description="Every session is tailored to your CV — role, skills, and experience level."
      />

      {/* CV context banner */}
      {cv && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <User className="h-4 w-4" />
          </div>
          <div className="text-sm">
            <span className="font-semibold">Personalised for you</span>
            <span className="text-muted-foreground">
              {" · "}Questions calibrated for a <span className="text-foreground font-medium">{role}</span> with ~{years} year{years !== 1 ? "s" : ""} of experience.
              Skills covered: <span className="text-foreground">{skills}</span>.
            </span>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {[
          {
            icon: ClipboardCheck,
            title: "Aptitude Test",
            desc: cv
              ? `10 questions mixing logical, numerical, verbal reasoning — plus ${role}-specific domain questions.`
              : "Adaptive quiz across logical, numerical, and verbal reasoning.",
            meta: "10 questions · ~15 min",
            action: startAptitude,
            key: "aptitude" as const,
          },
          {
            icon: Code2,
            title: "Coding Assessment",
            desc: cv
              ? `${langs}-focused problem at ${years >= 4 ? "Medium/Hard" : "Easy/Medium"} difficulty — with instant AI code review.`
              : "LeetCode-style problem with instant AI code review.",
            meta: "1 problem · any language",
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
                  <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</>
                ) : (
                  <>Start session <ArrowRight className="h-4 w-4" /></>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      {history.length > 0 && (
        <div className="mt-8 rounded-xl border border-border bg-card p-6">
          <div className="mb-4 text-sm font-semibold">Recent sessions</div>
          <ul className="divide-y divide-border">
            {history.map((r, i) => (
              <li key={i} className="flex items-center justify-between py-3.5 text-sm">
                <div>
                  <div className="font-medium">{r.title}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{r.feedback}</div>
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
      )}
    </AppShell>
  );
}

// ─── Aptitude Session ─────────────────────────────────────────────────────────

function AptitudeResults({
  session,
  onClose,
  onRetry,
}: {
  session: Extract<ActiveSession, { type: "aptitude" }> & { scorePct: number; correctCount: number };
  onClose: (r?: SessionResult) => void;
  onRetry: () => void;
}) {
  const { questions, answers, scorePct, correctCount, feedback } = session;
  const total = questions.length;
  const wrongCount = total - correctCount;
  const byCategory = computeCategoryBreakdown(questions, answers);

  const finish = () =>
    onClose({
      type: "aptitude",
      title: "Aptitude Test",
      score: `${scorePct}%`,
      feedback,
      time: "Just now",
    });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader eyebrow="Results" title="Aptitude Test Complete" />
        <button onClick={finish} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" /> Close
        </button>
      </div>

      {/* Score hero */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <div className="text-center sm:text-left">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Your Score</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className={`text-6xl font-bold ${scoreTextColor(scorePct)}`}>{scorePct}</span>
              <span className="text-xl text-muted-foreground">/ 100</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {correctCount} of {total} correct
              {wrongCount > 0 && <> · {wrongCount} to review below</>}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {scorePct >= 80
                ? "Excellent — strong reasoning across the board."
                : scorePct >= 60
                  ? "Solid effort. Review the missed questions below."
                  : "Keep practising — the breakdown shows where to focus."}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onRetry}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <RotateCcw className="h-4 w-4" /> Try again
            </button>
            <button
              onClick={finish}
              className="inline-flex items-center gap-2 rounded-xl border border-input bg-background px-4 py-2.5 text-sm font-medium hover:bg-accent"
            >
              Back to Practice
            </button>
          </div>
        </div>
        <div className="mt-5 h-2.5 w-full rounded-full bg-muted">
          <div className={`h-2.5 rounded-full transition-all duration-1000 ${scoreBarColor(scorePct)}`} style={{ width: `${scorePct}%` }} />
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <CheckCircle2 className="h-3.5 w-3.5" /> {correctCount} correct
          </span>
          {wrongCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-3 py-1 text-xs font-medium text-destructive">
              <XCircle className="h-3.5 w-3.5" /> {wrongCount} incorrect
            </span>
          )}
        </div>
      </div>

      {/* Category breakdown */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <TrendingUp className="h-4 w-4 text-primary" />
          Category breakdown
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {Object.entries(byCategory).map(([cat, stats]) => {
            const pct = Math.round((stats.correct / stats.total) * 100);
            return (
              <div key={cat} className="rounded-xl border border-border bg-background p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    {CATEGORY_LABELS[cat as AptitudeQuestion["category"]] ?? cat}
                  </span>
                  <span className={`text-lg font-bold ${scoreTextColor(pct)}`}>{stats.correct}/{stats.total}</span>
                </div>
                <div className="mt-2 h-1.5 w-full rounded-full bg-muted">
                  <div className={`h-1.5 rounded-full transition-all ${scoreBarColor(pct)}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* AI feedback */}
      {feedback && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-primary" /> AI Coach Feedback
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">{stripMarkdown(feedback)}</p>
        </div>
      )}

      {/* Per-question review */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="mb-5 flex items-center justify-between">
          <div className="text-sm font-semibold">Answer review</div>
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            {total} questions
          </span>
        </div>
        <div className="space-y-4">
          {questions.map((q, i) => {
            const userIdx = answers[i];
            const isCorrect = userIdx === q.answer;
            return (
              <div
                key={i}
                className={`rounded-xl border p-4 ${
                  isCorrect ? "border-border bg-background" : "border-destructive/30 bg-destructive/5"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full ${
                    isCorrect ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
                  }`}>
                    {isCorrect ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-muted-foreground">Q{i + 1}</span>
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                        {CATEGORY_LABELS[q.category]}
                      </span>
                      <span className={`ml-auto text-xs font-semibold ${isCorrect ? "text-primary" : "text-destructive"}`}>
                        {isCorrect ? "Correct" : "Incorrect"}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm font-medium leading-relaxed">{q.question}</p>

                    {!isCorrect && (
                      <div className="mt-3 space-y-2">
                        <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-destructive">Your answer</p>
                          <p className="mt-1 text-sm">
                            <span className="font-semibold text-destructive">{OPTION_LABELS[userIdx]}.</span>{" "}
                            {q.options[userIdx]}
                          </p>
                        </div>
                        <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">Correct answer</p>
                          <p className="mt-1 text-sm">
                            <span className="font-semibold text-primary">{OPTION_LABELS[q.answer]}.</span>{" "}
                            {q.options[q.answer]}
                          </p>
                        </div>
                      </div>
                    )}

                    {isCorrect && (
                      <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5">
                        <p className="text-sm">
                          <span className="font-semibold text-primary">{OPTION_LABELS[q.answer]}.</span>{" "}
                          {q.options[q.answer]}
                        </p>
                      </div>
                    )}

                    {q.explanation && (
                      <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">
                        <span className="font-medium text-foreground">Why: </span>{q.explanation}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AptitudeSession({
  session,
  onUpdate,
  onClose,
  onRetry,
}: {
  session: Extract<ActiveSession, { type: "aptitude" }>;
  onUpdate: (s: ActiveSession) => void;
  onClose: (r?: SessionResult) => void;
  onRetry: () => void;
}) {
  const [evaluating, setEvaluating] = useState(false);
  const q = session.questions[session.current];
  const total = session.questions.length;

  const answer = async (idx: number) => {
    const newAnswers = [...session.answers, idx];
    if (session.current + 1 >= total) {
      setEvaluating(true);
      const correct = newAnswers.filter((a, i) => a === session.questions[i].answer).length;
      const pct = Math.round((correct / total) * 100);
      const feedback = await evaluateAptitude(session.questions, newAnswers);
      setEvaluating(false);
      pushActivity("Aptitude test completed", `Score: ${pct}% · ${correct}/${total} correct`);
      const lastSnap = loadSnapshots().slice(-1)[0];
      pushSnapshot({ cv: lastSnap?.cv ?? 0, interview: lastSnap?.interview ?? 0, coding: lastSnap?.coding ?? 0 });
      onUpdate({
        ...session,
        answers: newAnswers,
        done: true,
        feedback,
        scorePct: pct,
        correctCount: correct,
      });
    } else {
      onUpdate({ ...session, current: session.current + 1, answers: newAnswers });
    }
  };

  if (session.done && session.scorePct !== undefined && session.correctCount !== undefined) {
    return (
      <AptitudeResults
        session={session as Extract<ActiveSession, { type: "aptitude" }> & { scorePct: number; correctCount: number }}
        onClose={onClose}
        onRetry={onRetry}
      />
    );
  }

  if (evaluating) {
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
        <button onClick={() => onClose()} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" /> Exit
        </button>
      </div>

      <div className="h-1.5 w-full rounded-full bg-muted">
        <div className="h-1.5 rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
      </div>

      <div className="rounded-xl border border-border bg-card p-8">
        {q.category && (
          <div className="mb-3">
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">
              {CATEGORY_LABELS[q.category] ?? q.category}
            </span>
          </div>
        )}
        <div className="mb-6 text-base font-medium leading-relaxed">{q.question}</div>
        <div className="grid gap-3">
          {q.options.map((opt, i) => (
            <button
              key={i}
              onClick={() => answer(i)}
              className="rounded-lg border border-border bg-background px-4 py-3 text-left text-sm transition-colors hover:border-primary hover:bg-primary/5"
            >
              <span className="mr-3 font-semibold text-muted-foreground">{OPTION_LABELS[i]}.</span>
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
        <PageHeader eyebrow={`Coding · ${session.problem.language}`} title={session.problem.title} />
        <button onClick={() => onClose()} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" /> Exit
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Problem */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="mb-3 flex items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              diff === "Easy" ? "bg-primary/10 text-primary"
              : diff === "Medium" ? "bg-[color:var(--color-warning)]/10 text-[color:var(--color-warning)]"
              : "bg-destructive/10 text-destructive"
            }`}>{diff}</span>
            <span className="rounded-full border border-border bg-background px-2.5 py-0.5 text-xs text-muted-foreground">
              {session.problem.language}
            </span>
          </div>
          <p className="text-sm leading-relaxed text-foreground">{session.problem.description}</p>
          <div className="mt-4 space-y-2">
            {session.problem.examples.map((ex, i) => (
              <div key={i} className="rounded-lg bg-secondary/50 p-3 text-xs font-mono">
                <div><span className="text-muted-foreground">Input:</span> {ex.input}</div>
                <div><span className="text-muted-foreground">Output:</span> {ex.output}</div>
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
                <><Loader2 className="h-4 w-4 animate-spin" /> Reviewing…</>
              ) : (
                <><CheckCircle2 className="h-4 w-4" /> Submit & get AI review</>
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
                  pushActivity(`Coding: ${session.problem.title}`, `${session.problem.difficulty} · AI reviewed`);
                  const lastSnap = loadSnapshots().slice(-1)[0];
                  pushSnapshot({ cv: lastSnap?.cv ?? 0, interview: lastSnap?.interview ?? 0, coding: 75 });
                  onClose({ type: "coding", title: session.problem.title, score: "Reviewed", feedback: session.feedback.slice(0, 80), time: "Just now" });
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

// ─── AI helpers — all personalised to CV ──────────────────────────────────────

async function generateAptitudeQuestions(
  role: string,
  skills: string,
  years: number,
): Promise<AptitudeQuestion[]> {
  const level = years >= 5 ? "senior" : years >= 2 ? "mid-level" : "junior";
  const raw = await groqChat(
    [
      {
        role: "user",
        content: `You are a talent assessment specialist generating an aptitude test.

Candidate profile:
- Role: ${role}
- Skills: ${skills}
- Level: ${level} (~${years} years experience)

Generate exactly 10 aptitude questions personalised for this candidate.
Split them as follows:
- 3 logical reasoning questions (patterns, sequences, deductions)
- 2 numerical reasoning questions (data analysis, percentages, ratios)
- 2 verbal reasoning questions (comprehension, analogies, grammar)
- 3 domain knowledge questions specific to "${role}" and their skills (${skills})

Domain questions should test real knowledge relevant to this role — not generic trivia.

Return ONLY a JSON array (no markdown, no extra text):
[
  {
    "question": "Full question text",
    "options": ["Option A text", "Option B text", "Option C text", "Option D text"],
    "answer": <0-based index of correct option>,
    "explanation": "Why the correct answer is right",
    "category": "logical"|"numerical"|"verbal"|"domain"
  }
]

Rules:
- Exactly 4 options per question
- answer is the 0-based index (0, 1, 2, or 3)
- Domain questions must reference actual concepts from ${skills}
- Difficulty appropriate for ${level} candidate`,
      },
    ],
    { model: MODEL_QUALITY, temperature: 0.5, max_tokens: 2500 },
  );

  try {
    const clean = raw.replace(/```json|```/g, "").trim();
    const start = clean.indexOf("[");
    const end   = clean.lastIndexOf("]");
    return JSON.parse(clean.slice(start, end + 1)) as AptitudeQuestion[];
  } catch {
    // Fallback: try parsing as-is
    return JSON.parse(raw.replace(/```json|```/g, "").trim()) as AptitudeQuestion[];
  }
}

async function evaluateAptitude(
  questions: AptitudeQuestion[],
  answers: number[],
): Promise<string> {
  const correct = answers.filter((a, i) => a === questions[i].answer).length;
  const total   = questions.length;
  const details = questions
    .map((q, i) => `Q${i + 1} [${q.category}]: ${answers[i] === q.answer ? "✓" : "✗"} — ${q.explanation}`)
    .join("\n");
  const byCategory: Record<string, { correct: number; total: number }> = {};
  questions.forEach((q, i) => {
    byCategory[q.category] = byCategory[q.category] ?? { correct: 0, total: 0 };
    byCategory[q.category].total++;
    if (answers[i] === q.answer) byCategory[q.category].correct++;
  });
  const catSummary = Object.entries(byCategory)
    .map(([cat, s]) => `${cat}: ${s.correct}/${s.total}`)
    .join(", ");

  return groqChat(
    [
      {
        role: "user",
        content: `A candidate scored ${correct}/${total} on a personalised aptitude test.
Category breakdown: ${catSummary}

Question results:
${details}

Write 3-4 sentences of constructive feedback:
1. Overall performance summary
2. Strongest category and why
3. Weakest category and specific improvement advice
4. One actionable next step

Be direct and specific — not generic.`,
      },
    ],
    { model: MODEL_BALANCED, temperature: 0.4, max_tokens: 250 },
  );
}

async function generateCodingProblem(
  role: string,
  skills: string,
  primaryLanguage: string,
  years: number,
): Promise<CodingProblem> {
  const level = years >= 5 ? "Hard" : years >= 2 ? "Medium" : "Easy";
  const lang  = primaryLanguage.split(",")[0].trim() || "JavaScript";

  const raw = await groqChat(
    [
      {
        role: "user",
        content: `You are a senior engineer creating a coding interview question.

Candidate profile:
- Role: ${role}
- Primary language: ${lang}
- Skills: ${skills}
- Experience level: ~${years} years → target difficulty: ${level}

Generate a single ${level}-difficulty coding problem that:
1. Is relevant to the candidate's actual role (${role}) and skills
2. Uses ${lang} as the primary language
3. Tests a concept they would genuinely encounter in this role
4. Has a clear, unambiguous solution

Return ONLY a JSON object (no markdown):
{
  "title": "Concise problem title",
  "difficulty": "${level}",
  "language": "${lang}",
  "description": "Full problem statement with constraints. Be precise about input/output format.",
  "examples": [
    { "input": "example input", "output": "expected output" },
    { "input": "edge case input", "output": "edge case output" }
  ],
  "starterCode": "// ${lang}\\n// Write your solution below\\n\\n"
}

Rules:
- description must be complete and unambiguous
- starterCode must be valid ${lang} with a function signature appropriate for the problem
- examples must match the description exactly
- Do NOT generate a Two Sum clone unless it's truly relevant — pick something specific to ${role}`,
      },
    ],
    { model: MODEL_QUALITY, temperature: 0.6, max_tokens: 1200 },
  );

  try {
    const clean = raw.replace(/```json|```/g, "").trim();
    const start = clean.indexOf("{");
    const end   = clean.lastIndexOf("}");
    return JSON.parse(clean.slice(start, end + 1)) as CodingProblem;
  } catch {
    // Fallback problem
    return {
      title: "Reverse a String",
      difficulty: "Easy",
      language: lang,
      description: "Write a function that takes a string and returns it reversed.",
      examples: [
        { input: '"hello"', output: '"olleh"' },
        { input: '"CareerPilot"', output: '"tolipreeraC"' },
      ],
      starterCode: `// ${lang}\nfunction reverseString(s) {\n  // your code here\n}`,
    };
  }
}

async function reviewCode(problem: CodingProblem, code: string): Promise<string> {
  return groqChat(
    [
      {
        role: "user",
        content: `You are a senior ${problem.language} engineer conducting a code review.

Problem: ${problem.title} (${problem.difficulty})
${problem.description}

Candidate's solution:
\`\`\`${problem.language.toLowerCase()}
${code}
\`\`\`

Provide a focused code review (4-5 sentences):
1. Does it solve the problem correctly? (yes/no/partial)
2. Time complexity and space complexity
3. What's done well
4. What could be improved (be specific — naming, edge cases, efficiency, idioms for ${problem.language})
5. One concrete suggestion to make it better

Be direct and technical. Avoid generic praise.`,
      },
    ],
    { model: MODEL_BALANCED, temperature: 0.3, max_tokens: 400 },
  );
}
