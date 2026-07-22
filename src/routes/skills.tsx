import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { BookOpen, Youtube, FileText, Clock, ArrowUpRight, Loader2, Sparkles } from "lucide-react";
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer,
} from "recharts";
import { useState } from "react";
import { groqChat, MODEL_QUALITY } from "@/lib/groq";
import { loadCVAnalysis } from "@/lib/cv-store";
import { toast } from "sonner";

export const Route = createFileRoute("/skills")({
  head: () => ({
    meta: [
      { title: "Skill Analysis — CareerPilot AI" },
      { name: "description", content: "Find your skill gaps and what to learn next." },
    ],
  }),
  component: SkillsPage,
});

interface AIRec { skill: string; resource: string; url: string; type: string; hours: number; }

function SkillsPage() {
  const cv = loadCVAnalysis();
  const [aiRecs, setAiRecs] = useState<AIRec[] | null>(null);
  const [loadingRecs, setLoadingRecs] = useState(false);

  // Build radar + bars from CV sections — or empty state
  const radarData = cv
    ? cv.sections.map((s) => ({
        skill: s.label,
        you: s.score,
        target: s.status === "good" ? s.score : Math.min(100, s.score + 25),
      }))
    : [];

  const bars = cv
    ? [...cv.sections].sort((a, b) => b.score - a.score)
    : [];

  const headline = cv?.headline || "your target role";
  const weakSections = cv ? cv.sections.filter((s) => s.status !== "good") : [];

  const generateAIRecs = async () => {
    setLoadingRecs(true);
    try {
      const weakSkills = weakSections.length
        ? weakSections.map((s) => s.label).join(", ")
        : "general skills";
      const raw = await groqChat(
        [{
          role: "user",
          content: `A ${headline} needs to improve these areas: ${weakSkills}.

Recommend 3 specific learning resources. Return ONLY a JSON array (no markdown):
[{"skill":"...","resource":"...","url":"https://...","type":"Course|Video|Docs|Practice","hours":4}]
Use real, publicly available resources (MDN, YouTube, official docs, freeCodeCamp, etc.).`,
        }],
        { model: MODEL_QUALITY, temperature: 0.5, max_tokens: 600 },
      );
      const clean = raw.replace(/```json|```/g, "").trim();
      const start = clean.indexOf("[");
      const end = clean.lastIndexOf("]");
      setAiRecs(JSON.parse(clean.slice(start, end + 1)) as AIRec[]);
      toast.success("AI recommendations ready!");
    } catch {
      toast.error("Failed to generate recommendations.");
    } finally {
      setLoadingRecs(false);
    }
  };

  // No CV uploaded yet
  if (!cv) {
    return (
      <AppShell title="Skill Analysis">
        <PageHeader eyebrow="Skills" title="Where you stand"
          description="Upload your CV to see your personalised skill breakdown and gap analysis." />
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border bg-card px-6 py-20 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-xl bg-primary/10 text-primary">
            <BarChart className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-semibold">No CV analysed yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Your skill radar and breakdown will appear here once you upload your CV.
            </p>
          </div>
          <a href="/wizard"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Upload CV
          </a>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Skill Analysis">
      <PageHeader eyebrow="Skills" title="Where you stand"
        description={`Your CV section scores versus target for ${headline}.`} />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Radar */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="text-sm font-semibold">Coverage radar</div>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="var(--color-border)" />
                <PolarAngleAxis dataKey="skill"
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                <Radar name="Target" dataKey="target"
                  stroke="var(--color-border)" fill="var(--color-muted)" fillOpacity={0.5} />
                <Radar name="You" dataKey="you"
                  stroke="var(--color-primary)" fill="var(--color-primary)" fillOpacity={0.25} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bars */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="text-sm font-semibold">Section scores</div>
          <ul className="mt-5 space-y-4 text-sm">
            {bars.map((b) => (
              <li key={b.label}>
                <div className="mb-1.5 flex items-center justify-between">
                  <span>{b.label}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">{b.score}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted">
                  <div className={`h-1.5 rounded-full ${
                    b.score >= 80 ? "bg-primary" :
                    b.score >= 55 ? "bg-[color:var(--color-warning)]" : "bg-destructive"
                  }`} style={{ width: `${b.score}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Detected skills tags */}
      {cv.skills && cv.skills.length > 0 && (
        <div className="mt-6 rounded-xl border border-border bg-card p-5">
          <div className="mb-3 text-sm font-semibold">Detected skills from your CV</div>
          <div className="flex flex-wrap gap-2">
            {cv.skills.map((s) => (
              <span key={s} className="rounded-full border border-border bg-background px-3 py-1 text-xs text-foreground">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Recommended learning */}
      <div className="mt-6 rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">Recommended learning</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {aiRecs
                ? "AI-personalised for your gaps."
                : `Targeting your ${weakSections.length} weak areas.`}
            </div>
          </div>
          <button onClick={generateAIRecs} disabled={loadingRecs}
            className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-60">
            {loadingRecs
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating…</>
              : <><Sparkles className="h-3.5 w-3.5 text-primary" /> AI suggestions</>}
          </button>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {(aiRecs
            ? aiRecs.map((r) => ({
                t: r.resource, type: r.type, h: r.hours, url: r.url,
                i: r.type === "Video" ? Youtube : r.type === "Docs" ? FileText : BookOpen,
              }))
            : weakSections.slice(0, 3).map((s) => ({
                t: `Improve: ${s.label}`,
                type: "Search",
                h: 0,
                url: `https://www.youtube.com/results?search_query=${encodeURIComponent(s.label + " tutorial")}`,
                i: Youtube,
              }))
          ).map((r) => (
            <a key={r.t} href={r.url} target="_blank" rel="noopener noreferrer"
              className="group flex flex-col rounded-lg border border-border bg-background p-4 hover:border-foreground/20">
              <div className="flex items-center justify-between">
                <div className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary">
                  <r.i className="h-4 w-4" />
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
              </div>
              <div className="mt-4 text-sm font-medium">{r.t}</div>
              <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                <span>{r.type}</span>
                {r.h > 0 && <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {r.h}h</span>}
              </div>
            </a>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

// placeholder icon for empty state
function BarChart(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}
