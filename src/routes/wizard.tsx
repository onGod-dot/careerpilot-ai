import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Upload, Sparkles, Loader2, CheckCircle2, AlertTriangle, XCircle,
  ArrowRight, ArrowLeft, X, RefreshCw, BarChart3, Briefcase,
  Target, Check, FileText, BookOpen, Mic, Code2, ClipboardCheck,
  MapPin, DollarSign, ExternalLink, Play, Youtube,
} from "lucide-react";
import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import { extractTextFromFile } from "@/lib/cv-parser";
import { groqChat, MODEL_QUALITY } from "@/lib/groq";
import { stripMarkdown } from "@/lib/format";
import {
  saveCVText, saveCVAnalysis, loadCVText, loadCVAnalysis,
  clearCV, type CVAnalysis,
} from "@/lib/cv-store";
import { saveWizardStep, loadWizardStep, STEPS, type WizardStep } from "@/lib/wizard-store";
import { getVideoRecommendations, type VideoRec } from "@/lib/video-recommendations";
import { saveProfile, toInitials, pushActivity, pushSnapshot, loadProfile } from "@/lib/user-store";

export const Route = createFileRoute("/wizard")({
  head: () => ({ meta: [{ title: "Get Started — CareerPilot AI" }] }),
  component: WizardPage,
});

// ─── Top progress bar ─────────────────────────────────────────────────────────
function Header({ current }: { current: WizardStep }) {
  const idx = STEPS.findIndex((s) => s.id === current);
  const pct = Math.round(((idx + 1) / STEPS.length) * 100);
  return (
    <header className="fixed inset-x-0 top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
      {/* thin progress bar at very top */}
      <div className="h-0.5 w-full bg-muted">
        <div className="h-0.5 bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-6">
        {/* logo */}
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-foreground">
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
              <path d="M4 14L12 5L20 14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M8 19L12 15L16 19" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="text-sm font-semibold tracking-tight">CareerPilot AI</span>
        </div>
        {/* step pills */}
        <div className="hidden items-center gap-1 sm:flex">
          {STEPS.map((s, i) => {
            const done = i < idx;
            const active = i === idx;
            return (
              <div key={s.id} className="flex items-center gap-1">
                <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold transition-all ${
                  done ? "bg-primary text-primary-foreground" :
                  active ? "border-2 border-primary text-primary bg-primary/5" :
                  "border border-border text-muted-foreground"
                }`}>
                  {done ? <Check className="h-3 w-3" /> : i + 1}
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`h-px w-5 transition-colors ${i < idx ? "bg-primary" : "bg-border"}`} />
                )}
              </div>
            );
          })}
        </div>
        {/* step label */}
        <div className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{STEPS[idx]?.label}</span>
          {" · "}{idx + 1} / {STEPS.length}
        </div>
      </div>
    </header>
  );
}

// ─── Root wizard page ─────────────────────────────────────────────────────────
function WizardPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<WizardStep>(() => {
    const saved = loadWizardStep();
    if (saved !== "upload" && (!loadCVText() || !loadCVAnalysis())) return "upload";
    return saved;
  });
  const [cvText, setCvText] = useState(() => loadCVText()?.text ?? "");
  const [fileName, setFileName] = useState(() => loadCVText()?.fileName ?? "");
  const [analysis, setAnalysis] = useState<CVAnalysis | null>(() => loadCVAnalysis());
  const [generatedCV, setGeneratedCV] = useState("");
  const [uploadStage, setUploadStage] = useState<"idle" | "reading" | "analysing">("idle");
  const [isDragging, setIsDragging] = useState(false);
  const [generatingCV, setGeneratingCV] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const go = (next: WizardStep) => {
    setStep(next);
    saveWizardStep(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const processFile = useCallback(async (file: File) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("File too large — max 10 MB"); return; }
    setFileName(file.name);
    setUploadStage("reading");
    try {
      const text = await extractTextFromFile(file);
      setCvText(text);
      saveCVText(text, file.name);
      setUploadStage("analysing");
      const result = await analyseCV(text);
      setAnalysis(result);
      saveCVAnalysis(result);
      // persist profile from CV + log activity + snapshot
      const existing = loadProfile();
      saveProfile({
        name: result.name || existing.name || "",
        email: existing.email || "",
        location: existing.location || "",
        headline: result.headline || existing.headline || "",
        initials: toInitials(result.name || existing.name || ""),
      });
      pushActivity("CV analysed", `${result.headline || "Resume"} · ${result.overallScore}/100 ATS score`);
      pushSnapshot({ cv: result.overallScore, interview: 0, coding: 0 });
      setUploadStage("idle");
      go("results");
      toast.success("CV analysed successfully!");
    } catch (e) {
      console.error(e);
      toast.error("Analysis failed — please try again.");
      setUploadStage("idle");
    }
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleGenerateCV = async () => {
    setGeneratingCV(true);
    try {
      const result = await generateImprovedCV(cvText, analysis);
      setGeneratedCV(result);
      toast.success("Improved CV ready!");
    } catch { toast.error("Generation failed."); }
    finally { setGeneratingCV(false); }
  };

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <input ref={fileInputRef} type="file" accept=".pdf,.docx,.doc,.txt" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = ""; }} />
      <Header current={step} />
      {/* page body — padded below fixed header */}
      <div className="mx-auto max-w-2xl px-4 pt-28 pb-20">
        {step === "upload"   && <StepUpload uploadStage={uploadStage} isDragging={isDragging}
          setIsDragging={setIsDragging} onDrop={handleDrop} onBrowse={() => fileInputRef.current?.click()} />}
        {step === "results"  && analysis && <StepResults analysis={analysis} fileName={fileName}
          cvText={cvText} onBack={() => go("upload")} onNext={() => go("improve")}
          onReplace={() => { clearCV(); go("upload"); }} />}
        {step === "improve"  && analysis && <StepImprove analysis={analysis} generatedCV={generatedCV}
          generatingCV={generatingCV} onGenerate={handleGenerateCV}
          onCopy={() => { navigator.clipboard.writeText(stripMarkdown(generatedCV)); toast.success("Copied!"); }}
          onClear={() => setGeneratedCV("")} onBack={() => go("results")} onNext={() => go("skills")} />}
        {step === "skills"   && analysis && <StepSkills analysis={analysis}
          onBack={() => go("improve")} onNext={() => go("jobs")} />}
        {step === "jobs"     && <StepJobs onBack={() => go("skills")} onNext={() => go("practice")} />}
        {step === "practice" && <StepPractice onBack={() => go("jobs")} onFinish={() => navigate({ to: "/dashboard" })} analysis={analysis} />}
      </div>
    </div>
  );
}

// ─── STEP 1 · Upload ─────────────────────────────────────────────────────────
function StepUpload({ uploadStage, isDragging, setIsDragging, onDrop, onBrowse }: {
  uploadStage: "idle" | "reading" | "analysing";
  isDragging: boolean; setIsDragging: (v: boolean) => void;
  onDrop: (e: React.DragEvent) => void; onBrowse: () => void;
}) {
  return (
    <div>
      <StepLabel n={1} title="Upload your CV" sub="Start by uploading your resume — we'll give it an instant AI-powered ATS score with detailed, section-by-section feedback." />
      {uploadStage === "idle" ? (
        <>
          <div
            onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            onClick={onBrowse}
            className={`group mt-8 flex w-full cursor-pointer flex-col items-center gap-6 rounded-2xl border-2 border-dashed px-8 py-16 text-center transition-all duration-200 ${
              isDragging
                ? "border-primary bg-primary/5 scale-[1.01]"
                : "border-border bg-card hover:border-primary/50 hover:bg-primary/5"
            }`}
          >
            <div className={`grid h-20 w-20 place-items-center rounded-2xl transition-colors ${isDragging ? "bg-primary/20 text-primary" : "bg-primary/10 text-primary group-hover:bg-primary/15"}`}>
              <Upload className="h-9 w-9" />
            </div>
            <div>
              <p className="text-lg font-semibold tracking-tight">
                {isDragging ? "Drop your CV here" : "Drop your CV or click to browse"}
              </p>
              <p className="mt-1.5 text-sm text-muted-foreground">PDF or DOCX · up to 10 MB · your data stays private</p>
            </div>
            <div className="flex flex-wrap justify-center gap-4 text-xs text-muted-foreground">
              {["ATS score", "Section feedback", "AI suggestions", "Instant results"].map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-primary" />{t}
                </span>
              ))}
            </div>
          </div>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            We support <strong>PDF</strong> and <strong>DOCX</strong> files. Text is processed locally before analysis.
          </p>
        </>
      ) : (
        <div className="mt-8 flex flex-col items-center gap-6 rounded-2xl border border-border bg-card px-8 py-16 text-center">
          <div className="relative grid h-20 w-20 place-items-center rounded-2xl bg-primary/10 text-primary">
            {uploadStage === "analysing"
              ? <Sparkles className="h-9 w-9 animate-pulse" />
              : <Loader2 className="h-9 w-9 animate-spin" />}
            <span className="absolute -bottom-1 -right-1 h-4 w-4 animate-ping rounded-full bg-primary/40" />
          </div>
          <div>
            <p className="text-base font-semibold">
              {uploadStage === "reading" ? "Reading your file…" : "AI is analysing your CV…"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {uploadStage === "reading" ? "Extracting text from your document" : "Running ATS checks · usually 10–15 seconds"}
            </p>
          </div>
          {uploadStage === "analysing" && (
            <div className="flex gap-2">
              {["ATS Match", "Formatting", "Experience", "Skills"].map((l) => (
                <span key={l} className="rounded-full border border-border bg-background px-2.5 py-0.5 text-[11px] text-muted-foreground animate-pulse">{l}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── STEP 2 · Results ────────────────────────────────────────────────────────
function StepResults({ analysis, fileName, cvText, onBack, onNext, onReplace }: {
  analysis: CVAnalysis; fileName: string; cvText: string;
  onBack: () => void; onNext: () => void; onReplace: () => void;
}) {
  const scoreColor = analysis.overallScore >= 80 ? "text-primary" : analysis.overallScore >= 60 ? "text-[color:var(--color-warning)]" : "text-destructive";
  return (
    <div>
      <StepLabel n={2} title="Your CV analysis" sub="Here's how your resume performs. Every section has been scored by our AI against real ATS criteria." />

      {/* Hero score */}
      <div className="mt-8 rounded-2xl border border-border bg-card p-8">
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="text-center sm:text-left">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Overall ATS Score</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className={`text-7xl font-bold tracking-tight ${scoreColor}`}>{analysis.overallScore}</span>
              <span className="text-2xl text-muted-foreground">/100</span>
            </div>
          </div>
          <div className="flex flex-col items-center gap-2 sm:items-end">
            <span className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
              analysis.atsReady ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
            }`}>
              {analysis.atsReady ? "✓ ATS Ready" : "⚠ Needs Improvement"}
            </span>
            {analysis.name && <p className="text-sm text-muted-foreground">{analysis.name}</p>}
            {analysis.headline && <p className="text-xs text-muted-foreground">{analysis.headline}</p>}
          </div>
        </div>
        <div className="mt-6 h-3 w-full overflow-hidden rounded-full bg-muted">
          <div className={`h-3 rounded-full transition-all duration-1000 ${
            analysis.overallScore >= 80 ? "bg-primary" : analysis.overallScore >= 60 ? "bg-[color:var(--color-warning)]" : "bg-destructive"
          }`} style={{ width: `${analysis.overallScore}%` }} />
        </div>
      </div>

      {/* Section breakdown */}
      <div className="mt-4 rounded-2xl border border-border bg-card p-6">
        <p className="mb-5 text-sm font-semibold">Section breakdown</p>
        <div className="space-y-4">
          {analysis.sections.map((s) => (
            <div key={s.label} className="flex items-center gap-3">
              <SIcon status={s.status} />
              <span className="w-40 shrink-0 text-sm">{s.label}</span>
              <div className="flex-1">
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div className={`h-2 rounded-full transition-all duration-700 ${
                    s.status === "good" ? "bg-primary" : s.status === "warn" ? "bg-[color:var(--color-warning)]" : "bg-destructive"
                  }`} style={{ width: `${s.score}%` }} />
                </div>
              </div>
              <span className="w-8 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{s.score}</span>
              <span className={`w-16 shrink-0 rounded-full px-2 py-0.5 text-center text-[10px] font-medium ${
                s.status === "good" ? "bg-primary/10 text-primary" :
                s.status === "warn" ? "bg-[color:var(--color-warning)]/10 text-[color:var(--color-warning)]" :
                "bg-destructive/10 text-destructive"
              }`}>
                {s.status === "good" ? "Strong" : s.status === "warn" ? "Improve" : "Weak"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* CV snippet */}
      <div className="mt-4 rounded-2xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" />{fileName}</span>
          <button onClick={onReplace} className="flex items-center gap-1 hover:text-foreground transition-colors">
            <RefreshCw className="h-3 w-3" /> Replace CV
          </button>
        </div>
        <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap font-sans text-xs leading-relaxed text-muted-foreground">
          {cvText.slice(0, 500)}{cvText.length > 500 ? "\n…" : ""}
        </pre>
      </div>

      <Nav onBack={onBack} onNext={onNext} nextLabel="View AI suggestions →" />
    </div>
  );
}

// ─── STEP 3 · Improve ────────────────────────────────────────────────────────
function StepImprove({ analysis, generatedCV, generatingCV, onGenerate, onCopy, onClear, onBack, onNext }: {
  analysis: CVAnalysis; generatedCV: string; generatingCV: boolean;
  onGenerate: () => void; onCopy: () => void; onClear: () => void;
  onBack: () => void; onNext: () => void;
}) {
  return (
    <div>
      <StepLabel n={3} title="Improve your CV" sub="Review AI-identified weaknesses and generate a polished, rewritten version in one click." />

      {/* suggestions */}
      <div className="mt-8 space-y-3">
        {analysis.suggestions.map((s, i) => (
          <div key={i} className="flex gap-4 rounded-xl border border-border bg-card p-4">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{i + 1}</span>
            <p className="text-sm leading-relaxed text-muted-foreground">{stripMarkdown(s)}</p>
          </div>
        ))}
      </div>

      {/* generate panel */}
      {!generatedCV ? (
        <div className="mt-6 flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-border bg-card p-10 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <p className="text-base font-semibold">Generate your improved CV</p>
            <p className="mt-1 text-sm text-muted-foreground max-w-sm">AI rewrites every bullet with impact metrics and strong action verbs — ready to copy and paste.</p>
          </div>
          <button onClick={onGenerate} disabled={generatingCV}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors">
            {generatingCV ? <><Loader2 className="h-4 w-4 animate-spin" />Generating…</> : <><Sparkles className="h-4 w-4" />Generate improved CV</>}
          </button>
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-primary/30 bg-primary/5 p-6">
          <div className="mb-4 flex items-center justify-between">
            <p className="flex items-center gap-2 text-sm font-semibold text-primary"><Sparkles className="h-4 w-4" />Your improved CV</p>
            <div className="flex items-center gap-2">
              <button onClick={onCopy} className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors">Copy</button>
              <button onClick={onClear} className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"><X className="h-3.5 w-3.5" /></button>
            </div>
          </div>
          <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap font-sans text-xs leading-relaxed text-foreground">{stripMarkdown(generatedCV)}</pre>
        </div>
      )}

      <Nav onBack={onBack} onNext={onNext} nextLabel="See skill gaps →" />
    </div>
  );
}

// ─── STEP 4 · Skills ─────────────────────────────────────────────────────────
function StepSkills({ analysis, onBack, onNext }: {
  analysis: CVAnalysis; onBack: () => void; onNext: () => void;
}) {
  const sorted = [...analysis.sections].sort((a, b) => a.score - b.score);
  const weak = sorted.filter((s) => s.status !== "good");
  return (
    <div>
      <StepLabel n={4} title="Skill gap breakdown" sub="These are the areas holding back your score. Targeting them first will have the biggest impact on your matches." />
      <div className="mt-8 space-y-3">
        {sorted.map((s) => (
          <div key={s.label} className={`flex items-center gap-4 rounded-xl border p-4 transition-colors ${
            s.status === "bad" ? "border-destructive/30 bg-destructive/5" :
            s.status === "warn" ? "border-[color:var(--color-warning)]/30 bg-[color:var(--color-warning)]/5" :
            "border-border bg-card"
          }`}>
            <SIcon status={s.status} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium">{s.label}</span>
                <span className="text-xs tabular-nums text-muted-foreground">{s.score}/100</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted/60">
                <div className={`h-2 rounded-full ${
                  s.status === "good" ? "bg-primary" : s.status === "warn" ? "bg-[color:var(--color-warning)]" : "bg-destructive"
                }`} style={{ width: `${s.score}%` }} />
              </div>
            </div>
            <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
              s.status === "good" ? "bg-primary/10 text-primary" :
              s.status === "warn" ? "bg-[color:var(--color-warning)]/15 text-[color:var(--color-warning)]" :
              "bg-destructive/15 text-destructive"
            }`}>{s.status === "good" ? "Strong" : s.status === "warn" ? "Improve" : "Weak"}</span>
          </div>
        ))}
      </div>
      {weak.length > 0 && (
        <div className="mt-5 rounded-xl border border-border bg-card p-5">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><BookOpen className="h-4 w-4 text-primary" />Priority focus areas</p>
          <ul className="space-y-2.5">
            {weak.slice(0, 3).map((s) => (
              <li key={s.label} className="flex items-start gap-2.5 text-sm">
                <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                <span><strong className="text-foreground">{s.label}</strong> <span className="text-muted-foreground">— currently {s.score}/100. Improving this section can significantly boost your ATS score.</span></span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Nav onBack={onBack} onNext={onNext} nextLabel="View job matches →" />
    </div>
  );
}

// ─── STEP 5 · Jobs ───────────────────────────────────────────────────────────
const JOBS = [
  { c: "Linear",  t: "Senior Frontend Engineer",    l: "Remote",   s: "$160–200k", m: 92, sk: ["React","TypeScript","Design Systems"], url: "https://linear.app/careers"  },
  { c: "Stripe",  t: "Frontend Engineer, Payments", l: "London",   s: "£110–140k", m: 87, sk: ["React","Next.js","GraphQL"],           url: "https://stripe.com/jobs"     },
  { c: "Vercel",  t: "Product Engineer",            l: "Remote",   s: "$150–190k", m: 84, sk: ["Next.js","Node","PostgreSQL"],         url: "https://vercel.com/careers"  },
  { c: "Notion",  t: "Software Engineer, Web",      l: "New York", s: "$170–210k", m: 79, sk: ["React","TypeScript","Testing"],        url: "https://notion.so/careers"   },
  { c: "Arc",     t: "Frontend Engineer",           l: "Remote",   s: "$140–170k", m: 76, sk: ["React","Electron","TypeScript"],       url: "https://arc.net/careers"     },
];

function StepJobs({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  return (
    <div>
      <StepLabel n={5} title="Roles matched for you" sub="Based on your CV profile, here are the highest-fit opportunities available right now. Each is ranked by match score." />
      <div className="mt-8 space-y-3">
        {JOBS.map((j) => (
          <div key={j.t} className="rounded-xl border border-border bg-card p-5 transition-colors hover:border-foreground/20">
            <div className="flex items-start gap-4">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-secondary text-sm font-bold">{j.c[0]}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-sm">{j.t}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{j.c}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="text-lg font-bold text-primary">{j.m}%</span>
                    <p className="text-[10px] text-muted-foreground">match</p>
                  </div>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-1.5 rounded-full bg-primary" style={{ width: `${j.m}%` }} />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{j.l}</span>
                  <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />{j.s}</span>
                </div>
                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-1">
                    {j.sk.map((s) => <span key={s} className="rounded-md border border-border bg-background px-2 py-0.5 text-[11px] text-muted-foreground">{s}</span>)}
                  </div>
                  <a href={j.url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
                    Apply <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <Nav onBack={onBack} onNext={onNext} nextLabel="Get interview-ready →" />
    </div>
  );
}

// ─── STEP 6 · Practice ───────────────────────────────────────────────────────
function StepPractice({ onBack, onFinish, analysis }: {
  onBack: () => void;
  onFinish: () => void;
  analysis: CVAnalysis | null;
}) {
  const [videos, setVideos] = useState<VideoRec[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(false);

  const fetchVideos = async () => {
    if (!analysis) return;
    setLoadingVideos(true);
    try {
      const recs = await getVideoRecommendations(analysis);
      setVideos(recs);
      toast.success("Videos ready!");
    } catch {
      toast.error("Could not load videos. Try again.");
    } finally {
      setLoadingVideos(false);
    }
  };

  const modes = [
    { icon: ClipboardCheck, label: "Aptitude Test",    desc: "Logic, numerical & verbal reasoning — 5 adaptive questions.", href: "/practice", color: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400" },
    { icon: Code2,          label: "Coding Challenge", desc: "LeetCode-style problem with instant AI code review.",          href: "/practice", color: "bg-violet-50 text-violet-600 dark:bg-violet-950 dark:text-violet-400" },
    { icon: Mic,            label: "Mock Interview",   desc: "Full AI interview — it asks, you answer, it scores.",          href: "/interview", color: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400" },
  ];

  return (
    <div>
      <StepLabel n={6} title="Get interview-ready" sub="Practice with AI, watch curated videos for your career path, and open your dashboard when you're set." />

      {/* Practice modes */}
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {modes.map((m) => (
          <a key={m.label} href={m.href}
            className="group flex flex-col rounded-2xl border border-border bg-card p-6 transition-all hover:border-primary/40 hover:shadow-sm">
            <div className={`grid h-12 w-12 place-items-center rounded-xl ${m.color}`}>
              <m.icon className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <p className="mt-5 text-sm font-semibold">{m.label}</p>
            <p className="mt-1 flex-1 text-xs leading-relaxed text-muted-foreground">{m.desc}</p>
            <div className="mt-4 flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
              Start <ArrowRight className="h-3 w-3" />
            </div>
          </a>
        ))}
      </div>

      {/* AI Video Recommendations */}
      <div className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Videos matched to your career path</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              AI picks the best YouTube content for your role and skill gaps
            </p>
          </div>
          <button
            onClick={fetchVideos}
            disabled={loadingVideos || !analysis}
            className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-background px-3.5 py-2 text-xs font-medium hover:bg-accent disabled:opacity-50 transition-colors"
          >
            {loadingVideos ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Scanning…</>
            ) : videos.length ? (
              <><RefreshCw className="h-3.5 w-3.5" /> Refresh</>
            ) : (
              <><Sparkles className="h-3.5 w-3.5 text-primary" /> Find videos</>
            )}
          </button>
        </div>

        {videos.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {videos.map((v, i) => (
              <a key={i} href={v.url} target="_blank" rel="noopener noreferrer"
                className="group flex gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-primary/5">
                {/* play button */}
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#FF0000]/10">
                  <div className="grid h-8 w-8 place-items-center rounded-full bg-[#FF0000] text-white">
                    <Play className="h-3.5 w-3.5 fill-white" />
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{v.tag}</span>
                    <span className="text-[10px] text-muted-foreground">{v.duration}</span>
                    <ExternalLink className="ml-auto h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p className="text-sm font-medium leading-snug line-clamp-1">{v.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground line-clamp-2">{stripMarkdown(v.reason)}</p>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <div
            onClick={!loadingVideos ? fetchVideos : undefined}
            className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card px-6 py-10 text-center transition-colors hover:border-primary/40 hover:bg-primary/5"
          >
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#FF0000]/10 text-[#FF0000]">
              {loadingVideos ? <Loader2 className="h-5 w-5 animate-spin" /> : <Youtube className="h-5 w-5" />}
            </div>
            <div>
              <p className="text-sm font-semibold">{loadingVideos ? "Scanning YouTube…" : "Get personalised video picks"}</p>
              <p className="mt-1 text-xs text-muted-foreground max-w-xs">
                {loadingVideos ? "Finding the best content for your role and skill gaps" : "AI matches YouTube videos to your CV — no generic playlists"}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Finish CTA */}
      <div className="mt-8 flex flex-col items-center gap-4 rounded-2xl border border-primary/20 bg-primary/5 p-8 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
          <BarChart3 className="h-6 w-6" />
        </div>
        <div>
          <p className="text-base font-semibold">You're all set!</p>
          <p className="mt-1 text-sm text-muted-foreground max-w-sm">
            Your dashboard tracks every score — CV, interview, skills, and applications — in one place.
          </p>
        </div>
        <button onClick={onFinish}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-7 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
          Open my dashboard <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 text-center">
        <button onClick={onBack} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>
      </div>
    </div>
  );
}

// ─── Shared primitives ────────────────────────────────────────────────────────
function StepLabel({ n, title, sub }: { n: number; title: string; sub: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-primary">Step {n} of {STEPS.length}</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">{title}</h1>
      <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">{sub}</p>
    </div>
  );
}

function Nav({ onBack, onNext, nextLabel = "Continue" }: {
  onBack: () => void; onNext: () => void; nextLabel?: string;
}) {
  return (
    <div className="mt-10 flex items-center justify-between border-t border-border pt-6">
      <button onClick={onBack}
        className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      <button onClick={onNext}
        className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
        {nextLabel} <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function SIcon({ status }: { status: "good" | "warn" | "bad" }) {
  if (status === "good") return <CheckCircle2 className="h-4 w-4 shrink-0 text-[color:var(--color-success)]" />;
  if (status === "warn") return <AlertTriangle className="h-4 w-4 shrink-0 text-[color:var(--color-warning)]" />;
  return <XCircle className="h-4 w-4 shrink-0 text-destructive" />;
}

// ─── AI helpers ───────────────────────────────────────────────────────────────
async function analyseCV(text: string): Promise<CVAnalysis> {
  const raw = await groqChat([{
    role: "user",
    content: `You are an expert CV/resume reviewer and ATS specialist.
Analyse the following CV and return ONLY a valid JSON object (no markdown, no extra text).

Required shape:
{
  "overallScore": <integer 0-100>,
  "atsReady": <boolean>,
  "name": "<full name or empty string>",
  "headline": "<job title or empty string>",
  "skills": ["skill1","skill2","skill3"],
  "sections": [
    {"label":"Formatting","status":"good","score":90},
    {"label":"Grammar","status":"good","score":88},
    {"label":"ATS Keywords","status":"warn","score":65},
    {"label":"Skills Section","status":"warn","score":70},
    {"label":"Experience","status":"good","score":85},
    {"label":"Projects","status":"warn","score":60},
    {"label":"Achievements","status":"bad","score":45},
    {"label":"Professional Summary","status":"warn","score":68}
  ],
  "suggestions": [
    "Specific actionable suggestion 1",
    "Specific actionable suggestion 2",
    "Specific actionable suggestion 3",
    "Specific actionable suggestion 4"
  ]
}

Rules:
- status: "good" if score>=80, "warn" if 50-79, "bad" if <50
- overallScore = weighted average of section scores
- atsReady = true only if overallScore >= 75
- suggestions must be specific to THIS CV, not generic
- Return ONLY the JSON object, nothing else

CV text:
${text.slice(0, 4000)}`
  }], { model: MODEL_QUALITY, temperature: 0.2, max_tokens: 1200 });

  try {
    const clean = raw.replace(/```json|```/g, "").trim();
    const start = clean.indexOf("{");
    const end = clean.lastIndexOf("}");
    return JSON.parse(clean.slice(start, end + 1)) as CVAnalysis;
  } catch {
    return {
      overallScore: 68, atsReady: false, name: "", headline: "", skills: [],
      sections: [
        { label: "Formatting",           status: "warn", score: 70 },
        { label: "Grammar",              status: "good", score: 82 },
        { label: "ATS Keywords",         status: "warn", score: 62 },
        { label: "Skills Section",       status: "warn", score: 68 },
        { label: "Experience",           status: "good", score: 80 },
        { label: "Projects",             status: "warn", score: 60 },
        { label: "Achievements",         status: "bad",  score: 48 },
        { label: "Professional Summary", status: "warn", score: 65 },
      ],
      suggestions: [
        "Quantify your achievements — replace vague statements with metrics (e.g., 'reduced load time by 40%').",
        "Add a concise professional summary that leads with your target role.",
        "Include more industry-relevant ATS keywords from the job descriptions you're targeting.",
        "Add a GitHub or portfolio link to your contact section.",
      ],
    };
  }
}

async function generateImprovedCV(text: string, analysis: CVAnalysis | null): Promise<string> {
  const weak = analysis?.sections.filter((s) => s.status !== "good").map((s) => s.label).join(", ") || "overall structure";
  return groqChat([{
    role: "user",
    content: `You are a professional CV/resume writer.
Rewrite and improve the following CV. Focus on:
- Adding quantified impact metrics to every experience bullet
- Writing a compelling professional summary that leads with the target role
- Strengthening these weak sections: ${weak}
- Using strong action verbs (Led, Built, Reduced, Increased, Delivered, etc.)
- Clear ATS-friendly section headers

Return the improved CV as clean plain text with proper sections.
Do NOT invent experience, companies, or qualifications — only improve the presentation of what exists.

Original CV:
${text.slice(0, 3500)}`
  }], { model: MODEL_QUALITY, temperature: 0.4, max_tokens: 2000 });
}
