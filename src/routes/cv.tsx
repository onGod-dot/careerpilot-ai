import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import {
  Upload,
  FileText,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  Loader2,
  X,
  RefreshCw,
} from "lucide-react";
import { useState, useRef, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { extractTextFromFile } from "@/lib/cv-parser";
import { groqChat, MODEL_QUALITY, MODEL_FAST } from "@/lib/groq";
import { stripMarkdown } from "@/lib/format";
import {
  saveCVText,
  saveCVAnalysis,
  loadCVText,
  loadCVAnalysis,
  clearCV,
  type CVAnalysis,
} from "@/lib/cv-store";

export const Route = createFileRoute("/cv")({
  head: () => ({
    meta: [
      { title: "CV Analyzer — CareerPilot AI" },
      {
        name: "description",
        content: "Upload your CV and get an ATS-ready score with actionable feedback.",
      },
      { property: "og:title", content: "CV Analyzer — CareerPilot AI" },
      { property: "og:description", content: "AI-driven CV analysis and improvements." },
    ],
  }),
  component: CVPage,
});

type Stage = "empty" | "uploading" | "analysing" | "done" | "generating";

function CVPage() {
  const [stage, setStage] = useState<Stage>("empty");
  const [fileName, setFileName] = useState("");
  const [cvText, setCvText] = useState("");
  const [analysis, setAnalysis] = useState<CVAnalysis | null>(null);
  const [generatedCV, setGeneratedCV] = useState("");
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Restore from session on mount
  useEffect(() => {
    const saved = loadCVText();
    const savedAnalysis = loadCVAnalysis();
    if (saved && savedAnalysis) {
      setFileName(saved.fileName);
      setCvText(saved.text);
      setAnalysis(savedAnalysis);
      setStage("done");
    }
  }, []);

  const processFile = useCallback(async (file: File) => {
    if (!file) return;
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error("File too large. Max 10 MB.");
      return;
    }
    setFileName(file.name);
    setStage("uploading");
    setProgress(0);
    try {
      const text = await extractTextFromFile(file, (p) => setProgress(p));

      if (!text || text.trim().length < 50) {
        toast.error("Could not extract readable text from this file. Try a different CV format or paste the text manually.");
        setStage("empty");
        setProgress(0);
        return;
      }

      console.log("[CV] Extracted text length:", text.length);
      setCvText(text);
      saveCVText(text, file.name);
      setStage("analysing");
      setProgress(45);

      // Simulate progress during AI analysis (40-100%)
      progressIntervalRef.current = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 95) {
            clearInterval(progressIntervalRef.current!);
            return 95;
          }
          return prev + Math.random() * 3 + 1;
        });
      }, 200);

      const result = await analyseCV(text);
      clearInterval(progressIntervalRef.current!);
      setProgress(100);
      setAnalysis(result);
      saveCVAnalysis(result);
      setStage("done");
      setTimeout(() => setProgress(0), 500);
      toast.success("CV analysed successfully!");
    } catch (e) {
      console.error(e);
      clearInterval(progressIntervalRef.current!);
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Analysis failed: ${msg.includes("429") ? "Rate limit reached." : msg}`);
      setStage("empty");
      setProgress(0);
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleGenerateCV = async () => {
    if (!cvText) return;
    setStage("generating");
    setGeneratedCV("");
    try {
      const result = await generateImprovedCV(cvText, analysis);
      setGeneratedCV(result);
      setStage("done");
      toast.success("Improved CV generated!");
    } catch {
      toast.error("Generation failed. Please try again.");
      setStage("done");
    }
  };

  const handleReset = () => {
    clearCV();
    setStage("empty");
    setFileName("");
    setCvText("");
    setAnalysis(null);
    setGeneratedCV("");
    setProgress(0);
  };

  return (
    <AppShell title="My CV">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.txt"
        className="hidden"
        onChange={handleFileInput}
      />
      <PageHeader
        eyebrow="Resume"
        title="CV Analyzer"
        description="Upload your resume to get an ATS-ready score and section-by-section feedback."
        actions={
          <>
            {stage === "done" && (
              <button
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-background px-3.5 py-2 text-sm font-medium hover:bg-accent"
              >
                <X className="h-4 w-4" /> Remove CV
              </button>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={stage === "uploading" || stage === "analysing" || stage === "generating"}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {stage === "uploading" || stage === "analysing" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {stage === "uploading" ? "Reading…" : stage === "analysing" ? "Analysing…" : "Upload"}
            </button>
          </>
        }
      />

      {stage === "empty" && (
        <div
          onDragEnter={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed bg-card px-6 py-20 text-center transition-colors ${
            isDragging
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/40 hover:bg-primary/5"
          }`}
        >
          <div className="grid h-14 w-14 place-items-center rounded-xl bg-primary/10 text-primary">
            <Upload className="h-6 w-6" />
          </div>
          <div>
            <div className="text-sm font-semibold">
              {isDragging ? "Drop it here" : "Drop your CV here or click to browse"}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">PDF or DOCX, up to 10 MB</div>
          </div>
        </div>
      )}

      {(stage === "uploading" || stage === "analysing") && (
        <div className="flex flex-col items-center justify-center gap-6 rounded-xl border border-border bg-card px-6 py-20">
          <div className="grid h-14 w-14 place-items-center rounded-xl bg-primary/10 text-primary">
            {stage === "analysing" ? (
              <Sparkles className="h-6 w-6 animate-pulse" />
            ) : (
              <Loader2 className="h-6 w-6 animate-spin" />
            )}
          </div>
          <div className="w-full max-w-xs space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold">
                {stage === "uploading" ? "Reading your CV…" : "AI is analysing your CV…"}
              </span>
              <span className="text-muted-foreground">{Math.round(progress)}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="text-xs text-muted-foreground text-center">
              {stage === "analysing"
                ? "Analysing content and scoring…"
                : "Extracting text from your file"}
            </div>
          </div>
        </div>
      )}

      {stage === "generating" && (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-border bg-card px-6 py-20">
          <div className="grid h-14 w-14 place-items-center rounded-xl bg-primary/10 text-primary">
            <Sparkles className="h-6 w-6 animate-pulse" />
          </div>
          <div className="text-center">
            <div className="text-sm font-semibold">Generating your improved CV…</div>
            <div className="mt-1 text-xs text-muted-foreground">
              AI is rewriting your resume with impact metrics
            </div>
          </div>
        </div>
      )}

      {stage === "done" && analysis && (
        <div className="space-y-6">
          {generatedCV ? (
            <GeneratedCVPanel content={generatedCV} onClose={() => setGeneratedCV("")} />
          ) : null}

          <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
            {/* CV preview */}
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  <span className="truncate max-w-[200px]">{fileName}</span>
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <RefreshCw className="h-3 w-3" /> Replace
                </button>
              </div>
              <div className="mt-4 max-h-[480px] overflow-y-auto rounded-lg border border-border bg-background p-5">
                {analysis.name && (
                  <>
                    <div className="text-lg font-semibold">{analysis.name}</div>
                    {analysis.headline && (
                      <div className="text-xs text-muted-foreground">{analysis.headline}</div>
                    )}
                    <hr className="my-3 border-border" />
                  </>
                )}
                <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-foreground">
                  {cvText.slice(0, 1800)}
                  {cvText.length > 1800 ? "\n\n[… preview truncated]" : ""}
                </pre>
              </div>
            </div>

            {/* AI Analysis */}
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-card p-6">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">Overall Score</div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      analysis.atsReady
                        ? "bg-primary/10 text-primary"
                        : "bg-warning/10 text-warning"
                    }`}
                  >
                    {analysis.atsReady ? "ATS Ready" : "Needs Work"}
                  </span>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-4xl font-semibold tracking-tight text-primary">
                    {analysis.overallScore}
                  </span>
                  <span className="text-sm text-muted-foreground">/ 100</span>
                </div>
                <div className="mt-3 h-1.5 w-full rounded-full bg-muted">
                  <div
                    className="h-1.5 rounded-full bg-primary transition-all duration-700"
                    style={{ width: `${analysis.overallScore}%` }}
                  />
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-6">
                <div className="mb-4 text-sm font-semibold">Section breakdown</div>
                <ul className="space-y-3 text-sm">
                  {analysis.sections.map((r) => (
                    <li key={r.label} className="flex items-center gap-3">
                      <StatusIcon status={r.status} />
                      <span className="min-w-0 flex-1 truncate">{r.label}</span>
                      <div className="hidden h-1 w-32 rounded-full bg-muted sm:block">
                        <div
                          className={`h-1 rounded-full ${
                            r.status === "good"
                              ? "bg-primary"
                              : r.status === "warn"
                                ? "bg-[color:var(--color-warning)]"
                                : "bg-destructive"
                          }`}
                          style={{ width: `${r.score}%` }}
                        />
                      </div>
                      <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">
                        {r.score}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-xl border border-border bg-card p-6">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Sparkles className="h-4 w-4 text-primary" /> AI Suggestions
                </div>
                <ul className="mt-4 space-y-3 text-sm">
                  {analysis.suggestions.map((s, i) => (
                    <li key={i} className="text-muted-foreground">
                      {stripMarkdown(s)}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={handleGenerateCV}
                  disabled={stage === "generating"}
                  className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                >
                  <Sparkles className="h-4 w-4" /> Improve my CV <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function GeneratedCVPanel({ content, onClose }: { content: string; onClose: () => void }) {
  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-primary">
          <Sparkles className="h-4 w-4" /> Your improved CV
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap font-sans text-xs leading-relaxed text-foreground">
        {stripMarkdown(content)}
      </pre>
      <button
        onClick={() => {
          navigator.clipboard.writeText(stripMarkdown(content));
          toast.success("Copied to clipboard!");
        }}
        className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-input bg-background px-3.5 py-2 text-sm font-medium hover:bg-accent"
      >
        Copy to clipboard
      </button>
    </div>
  );
}

function StatusIcon({ status }: { status: "good" | "warn" | "bad" }) {
  if (status === "good")
    return <CheckCircle2 className="h-4 w-4 shrink-0 text-[color:var(--color-success)]" />;
  if (status === "warn")
    return <AlertTriangle className="h-4 w-4 shrink-0 text-[color:var(--color-warning)]" />;
  return <XCircle className="h-4 w-4 shrink-0 text-destructive" />;
}

// ─── AI helpers ──────────────────────────────────────────────────────────────

async function analyseCV(text: string): Promise<CVAnalysis> {
  const prompt = `You are an expert CV/resume reviewer and ATS specialist.

Analyse the following CV text and return ONLY a valid JSON object.

IMPORTANT: Return ONLY raw JSON. No markdown code blocks, no explanation, no extra text.
Keep responses short, simple, and precise. Avoid lengthy explanations.

The JSON must have this exact shape:
{
  "overallScore": <number 0-100>,
  "atsReady": <boolean>,
  "name": "<candidate name if found, else empty string>",
  "headline": "<job title/headline if found, else empty string>",
  "skills": ["skill1", "skill2", ...],
  "sections": [
    { "label": "Formatting", "status": "good"|"warn"|"bad", "score": <0-100> },
    { "label": "Grammar", "status": "good"|"warn"|"bad", "score": <0-100> },
    { "label": "ATS Keywords", "status": "good"|"warn"|"bad", "score": <0-100> },
    { "label": "Skills Section", "status": "good"|"warn"|"bad", "score": <0-100> },
    { "label": "Experience", "status": "good"|"warn"|"bad", "score": <0-100> },
    { "label": "Projects", "status": "good"|"warn"|"bad", "score": <0-100> },
    { "label": "Achievements", "status": "good"|"warn"|"bad", "score": <0-100> },
    { "label": "Professional Summary", "status": "good"|"warn"|"bad", "score": <0-100> }
  ],
  "suggestions": [
    "<actionable suggestion 1>",
    "<actionable suggestion 2>",
    "<actionable suggestion 3>",
    "<actionable suggestion 4>"
  ]
}

Scoring Criteria:
- Formatting: Check for consistent formatting, proper spacing, clear section headers (score 0-100)
- Grammar: Check for spelling errors, typos, grammatical mistakes (score 0-100)
- ATS Keywords: Check for industry-relevant keywords, action verbs, skills (score 0-100)
- Skills Section: Check if skills are listed, categorized, and relevant (score 0-100)
- Experience: Check for work history, role descriptions, achievements (score 0-100)
- Projects: Check for project descriptions, impact, technologies used (score 0-100)
- Achievements: Check for quantified results, awards, recognitions (score 0-100)
- Professional Summary: Check for compelling summary, target role, value proposition (score 0-100)

Status Rules:
- status "good" = score >= 80
- status "warn" = 50-79  
- status "bad" = < 50
- overallScore = weighted average of all section scores
- atsReady = true if overallScore >= 75

Suggestions must be:
- Specific to the CV content
- Actionable and practical
- Based on actual weaknesses found
- Not generic or template-based

CV text to analyse:
${text.slice(0, 4000)}`;

  console.log("[CV Analysis] Sending request to AI...");
  let raw = "";
  try {
    raw = await groqChat([{ role: "user", content: prompt }], {
      model: MODEL_QUALITY,
      temperature: 0.2,
      max_tokens: 2000,
    });
  } catch (primaryError) {
    console.warn("[CV Analysis] Primary model failed, falling back to fast model:", primaryError);
    raw = await groqChat([{ role: "user", content: prompt }], {
      model: MODEL_FAST,
      temperature: 0.25,
      max_tokens: 2000,
    });
  }

  console.log("[CV Analysis] Raw AI response:", raw);

  try {
    // Extract JSON from response - handle markdown code blocks and extra text
    let clean = raw.trim();
    
    // Remove markdown code blocks if present
    clean = clean.replace(/```json\s*/g, "").replace(/```\s*/g, "");
    
    // Find JSON object boundaries
    const startIdx = clean.indexOf("{");
    const endIdx = clean.lastIndexOf("}");
    
    if (startIdx === -1 || endIdx === -1) {
      throw new Error("No JSON object found in response");
    }
    
    const jsonStr = clean.slice(startIdx, endIdx + 1);
    const parsed = JSON.parse(jsonStr) as CVAnalysis;
    console.log("[CV Analysis] Parsed successfully:", parsed);
    return parsed;
  } catch (error) {
    console.error("[CV Analysis] JSON parse error:", error);
    console.error("[CV Analysis] Failed to parse:", raw);
    // Fallback if JSON is malformed
    return {
      overallScore: 50,
      atsReady: false,
      name: "",
      headline: "",
      skills: [],
      sections: [
        { label: "Formatting", status: "bad", score: 50 },
        { label: "Grammar", status: "warn", score: 60 },
        { label: "ATS Keywords", status: "bad", score: 40 },
        { label: "Skills Section", status: "warn", score: 55 },
        { label: "Experience", status: "warn", score: 60 },
        { label: "Projects", status: "bad", score: 45 },
        { label: "Achievements", status: "bad", score: 40 },
        { label: "Professional Summary", status: "warn", score: 55 },
      ],
      suggestions: [
        "CV analysis failed to parse. Please try uploading your CV again.",
        "Ensure your CV is in PDF or DOCX format with readable text.",
        "If the issue persists, try pasting your CV content manually.",
        "Contact support if the problem continues.",
      ],
    };
  }
}

async function generateImprovedCV(
  originalText: string,
  analysis: CVAnalysis | null,
): Promise<string> {
  const weakAreas = analysis?.sections
    .filter((s) => s.status !== "good")
    .map((s) => s.label)
    .join(", ");

  const prompt = `You are an expert CV writer. Rewrite and improve the following CV.

Focus on:
- Adding quantified impact metrics to experience bullets
- Strengthening the professional summary to lead with target role
- Improving weak areas: ${weakAreas || "overall quality"}
- Making it ATS-friendly with clear section headers
- Using strong action verbs

Return the improved CV as plain text, well-formatted with clear sections.
Do NOT add fake experience or fabricate information — only improve presentation of what's already there.

Original CV:
${originalText.slice(0, 3500)}`;

  try {
    return await groqChat([{ role: "user", content: prompt }], {
      model: MODEL_QUALITY,
      temperature: 0.5,
      max_tokens: 2000,
    });
  } catch (error) {
    console.warn("[generateImprovedCV] quality model failed, falling back to fast model:", error);
    return groqChat([{ role: "user", content: prompt }], {
      model: MODEL_FAST,
      temperature: 0.6,
      max_tokens: 2000,
    });
  }
}
