import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import {
  FileText, Sparkles, Briefcase, BarChart3, Target, Mic,
  BookOpen, Code2, ClipboardCheck, ArrowRight, ArrowUpRight, Circle,
} from "lucide-react";
import { loadCVAnalysis } from "@/lib/cv-store";
import { loadActivity, relativeTime, loadProfile } from "@/lib/user-store";
import { clearWizard } from "@/lib/wizard-store";
import { stripMarkdown } from "@/lib/format";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — CareerPilot AI" },
      { name: "description", content: "Your career readiness at a glance." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const cv = loadCVAnalysis();
  const profile = loadProfile();
  const activity = loadActivity();

  // derive scores from CV analysis
  const cvScore = cv?.overallScore ?? 0;
  const skillReadiness = cv
    ? Math.round(cv.sections.reduce((a, s) => a + s.score, 0) / cv.sections.length)
    : 0;
  const firstName = (cv?.name || profile.name || "").split(" ")[0] || "there";

  // career score = weighted blend
  const careerScore = cv ? Math.round(cvScore * 0.6 + skillReadiness * 0.4) : 0;

  const stats = [
    { l: "Career Score",    v: careerScore, suffix: "%"  as const },
    { l: "CV Score",        v: cvScore,     suffix: "%"  as const },
    { l: "Skill Readiness", v: skillReadiness, suffix: "%" as const },
    { l: "Sections scored", v: cv?.sections.length ?? 0, suffix: "" as const },
    { l: "Skills detected", v: cv?.skills?.length ?? 0,  suffix: "" as const },
  ];

  // build AI recs from actual weak sections + suggestions
  const weakSections = cv?.sections.filter((s) => s.status !== "good") ?? [];
  const suggestions = cv?.suggestions ?? [];

  return (
    <AppShell title="Dashboard">
      {/* Re-run banner */}
      <div className="mb-6 flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 px-5 py-3">
        <div className="text-sm text-muted-foreground">
          {cv ? `Last analysed: ${cv.headline || "your CV"} · ${cvScore}/100` : "No CV analysed yet."}
        </div>
        <Link to="/wizard" onClick={() => clearWizard()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">
          {cv ? "Re-analyse CV" : "Upload CV"} <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Greeting */}
      <div className="mb-8">
        <div className="text-sm text-muted-foreground">Good morning,</div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{firstName}.</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          {cv
            ? `Your CV scored ${cvScore}/100. ${weakSections.length > 0 ? `Focus on ${weakSections[0].label} to move up.` : "You're looking strong across all sections."}`
            : "Upload your CV to get a full career readiness breakdown."}
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((s) => (
          <div key={s.l} className="rounded-xl border border-border bg-card p-5">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{s.l}</div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-2xl font-semibold tracking-tight">{s.v}</span>
              {s.suffix && <span className="text-sm text-muted-foreground">{s.suffix}</span>}
            </div>
            {s.suffix === "%" && (
              <div className="mt-3 h-1 w-full rounded-full bg-muted">
                <div className="h-1 rounded-full bg-primary transition-all" style={{ width: `${s.v}%` }} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="mt-10">
        <PageHeader eyebrow="Do next" title="Quick actions" />
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: FileText,       title: "Analyse CV",        desc: "Upload and score",    to: "/wizard"    },
            { icon: Sparkles,       title: "Generate CV",       desc: "AI-crafted resume",   to: "/wizard"    },
            { icon: Mic,            title: "Mock Interview",    desc: "Voice-based AI mock", to: "/interview" },
            { icon: Code2,          title: "Coding Practice",   desc: "AI-reviewed",         to: "/practice"  },
            { icon: ClipboardCheck, title: "Aptitude Test",     desc: "Adaptive quiz",       to: "/practice"  },
            { icon: Briefcase,      title: "Job Matches",       desc: "Tailored roles",      to: "/jobs"      },
            { icon: BookOpen,       title: "Learning Roadmap",  desc: "Curated videos",      to: "/learning"  },
            { icon: BarChart3,      title: "Skill Analysis",    desc: "Find gaps",           to: "/skills"    },
          ].map((a) => (
            <Link key={a.title} to={a.to}
              className="group rounded-xl border border-border bg-card p-5 transition-colors hover:border-foreground/20">
              <div className="flex items-center justify-between">
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
                  <a.icon className="h-4 w-4" strokeWidth={1.75} />
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
              <div className="mt-4 text-sm font-semibold">{a.title}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{a.desc}</div>
            </Link>
          ))}
        </div>
      </div>

      {/* Activity + AI recommendations */}
      <div className="mt-10 grid gap-4 lg:grid-cols-3">
        {/* Activity */}
        <div className="rounded-xl border border-border bg-card p-6 lg:col-span-2">
          <h3 className="text-sm font-semibold">Recent activity</h3>
          {activity.length === 0 ? (
            <p className="mt-5 text-sm text-muted-foreground">
              No activity yet — upload your CV to get started.
            </p>
          ) : (
            <ol className="mt-5 space-y-5">
              {activity.slice(0, 5).map((it, i, arr) => (
                <li key={it.id} className="relative flex gap-4">
                  <div className="flex flex-col items-center">
                    <Circle className="h-2.5 w-2.5 fill-primary text-primary" />
                    {i < arr.length - 1 && <div className="mt-1 h-full w-px bg-border" />}
                  </div>
                  <div className="pb-1">
                    <div className="text-sm font-medium">{it.title}</div>
                    <div className="text-xs text-muted-foreground">{it.detail}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground/70">{relativeTime(it.ts)}</div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* AI Recommendations from CV */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-2">
            <div className="grid h-7 w-7 place-items-center rounded-md bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-semibold">AI Recommendations</h3>
          </div>
          {suggestions.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Analyse your CV to get personalised recommendations.
            </p>
          ) : (
            <ul className="mt-5 space-y-4 text-sm">
              {suggestions.slice(0, 3).map((s, i) => {
                const clean = stripMarkdown(s);
                const dot = clean.indexOf("—");
                const title = dot > -1 ? clean.slice(0, dot).trim() : clean.slice(0, 40);
                const body = dot > -1 ? clean.slice(dot + 1).trim() : "";
                return (
                  <li key={i}>
                    <div className="font-medium">{title}</div>
                    {body && <div className="mt-0.5 text-xs text-muted-foreground">{body}</div>}
                  </li>
                );
              })}
            </ul>
          )}
          <Link to="/learning"
            className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            Open learning hub <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
