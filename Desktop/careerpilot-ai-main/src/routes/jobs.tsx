import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { MapPin, Building2, Sparkles, ArrowRight, X, ExternalLink, Briefcase, DollarSign, Globe } from "lucide-react";
import { useState } from "react";
import { loadCVAnalysis } from "@/lib/cv-store";

export const Route = createFileRoute("/jobs")({
  head: () => ({
    meta: [
      { title: "Job Matches — CareerPilot AI" },
      { name: "description", content: "AI-matched roles based on your skills and goals." },
      { property: "og:title", content: "Job Matches — CareerPilot AI" },
      { property: "og:description", content: "Ranked roles tailored to your profile." },
    ],
  }),
  component: JobsPage,
});

interface Job {
  c: string;
  t: string;
  l: string;
  s: string;
  m: number;
  r: boolean;
  sk: string[];
  desc: string;
  url: string;
}

const jobs: Job[] = [
  {
    c: "Linear",
    t: "Senior Frontend Engineer",
    l: "Remote",
    s: "$160–200k",
    m: 92,
    r: true,
    sk: ["React", "TypeScript", "Design Systems"],
    desc: "Join Linear's product team to build the next generation of issue tracking. You'll own core UI infrastructure, improve performance, and collaborate with world-class designers. We value craftsmanship, speed, and attention to detail.",
    url: "https://linear.app/careers",
  },
  {
    c: "Stripe",
    t: "Frontend Engineer, Payments",
    l: "London",
    s: "£110–140k",
    m: 87,
    r: false,
    sk: ["React", "Next.js", "GraphQL"],
    desc: "Help build the financial infrastructure of the internet. You'll work on Stripe's dashboard and developer tools, making complex payment flows feel simple. Strong focus on accessibility and performance.",
    url: "https://stripe.com/jobs",
  },
  {
    c: "Vercel",
    t: "Product Engineer",
    l: "Remote",
    s: "$150–190k",
    m: 84,
    r: true,
    sk: ["Next.js", "Node", "PostgreSQL"],
    desc: "Build the platform that powers the modern web. Work on core Vercel product features including deployments, edge networking, and developer experience. You'll ship code that reaches millions of developers daily.",
    url: "https://vercel.com/careers",
  },
  {
    c: "Notion",
    t: "Software Engineer, Web",
    l: "New York",
    s: "$170–210k",
    m: 79,
    r: false,
    sk: ["React", "TypeScript", "Testing"],
    desc: "Work on Notion's core web product used by millions of teams worldwide. You'll contribute to the editor, databases, and collaboration features. We're looking for engineers who care deeply about quality and user experience.",
    url: "https://www.notion.so/careers",
  },
  {
    c: "Arc",
    t: "Frontend Engineer",
    l: "Remote",
    s: "$140–170k",
    m: 76,
    r: true,
    sk: ["React", "Electron", "TypeScript"],
    desc: "Help build Arc, the browser for the 21st century. You'll work on Electron-based desktop UI, web integrations, and novel browsing experiences. We value bold ideas and move fast.",
    url: "https://arc.net/careers",
  },
];

function JobsPage() {
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const cv = loadCVAnalysis();

  // compute real match scores from CV skills
  const userSkills = (cv?.skills ?? []).map((s) => s.toLowerCase());
  const cvScore = cv?.overallScore ?? 50;

  const scoredJobs = jobs.map((j) => {
    if (!cv) return j;
    const overlap = j.sk.filter((s) => userSkills.some((u) => u.includes(s.toLowerCase()) || s.toLowerCase().includes(u))).length;
    const skillMatch = j.sk.length > 0 ? Math.round((overlap / j.sk.length) * 100) : 50;
    const match = Math.round(skillMatch * 0.6 + cvScore * 0.4);
    return { ...j, m: Math.min(99, match) };
  }).sort((a, b) => b.m - a.m);

  // derive AI summary from actual CV
  const weakAreas = cv?.sections.filter((s) => s.status !== "good").slice(0, 2).map((s) => s.label) ?? ["your skills"];
  const roleLabel = cv?.headline || "your target role";

  return (
    <AppShell title="Job Matches">
      <PageHeader eyebrow="Opportunities" title="Roles picked for you"
        description="Match scores calculated from your CV skills. Improve weak areas to unlock higher scores." />

      <div className="mb-6 rounded-xl border border-border bg-card p-5">
        <div className="flex items-start gap-3">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold">AI Match Summary</div>
            <p className="mt-1 text-sm text-muted-foreground">
              {cv
                ? <>Your CV scored <span className="text-foreground font-medium">{cv.overallScore}/100</span>. Improving <span className="text-foreground">{weakAreas[0]}</span>{weakAreas[1] ? <> and <span className="text-foreground">{weakAreas[1]}</span></> : ""} could raise your match scores significantly.</>
                : "Upload your CV to get personalised match scores for each role."
              }
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-5 py-3 text-left font-medium">Company & Role</th>
              <th className="px-5 py-3 text-left font-medium">Location</th>
              <th className="px-5 py-3 text-left font-medium">Match</th>
              <th className="px-5 py-3 text-left font-medium">Salary</th>
              <th className="px-5 py-3 text-left font-medium">Skills</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {scoredJobs.map((j) => (
              <tr key={j.t + j.c} className="hover:bg-secondary/30">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-secondary text-xs font-semibold">
                      {j.c[0]}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-medium">{j.t}</div>
                      <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <Building2 className="h-3 w-3" /> {j.c}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" /> {j.l}
                    {j.r && (
                      <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                        Remote
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    <div className="h-1 w-16 rounded-full bg-muted">
                      <div className="h-1 rounded-full bg-primary" style={{ width: `${j.m}%` }} />
                    </div>
                    <span className="text-xs font-medium tabular-nums">{j.m}%</span>
                  </div>
                </td>
                <td className="px-5 py-4 tabular-nums text-muted-foreground">{j.s}</td>
                <td className="px-5 py-4">
                  <div className="flex flex-wrap gap-1">
                    {j.sk.map((s) => (
                      <span
                        key={s}
                        className="rounded-md border border-border bg-background px-1.5 py-0.5 text-[11px] text-muted-foreground"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-5 py-4 text-right">
                  <button
                    onClick={() => setSelectedJob(j)}
                    className="inline-flex items-center gap-1 rounded-lg border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
                  >
                    View <ArrowRight className="h-3 w-3" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Job detail drawer */}
      {selectedJob && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-foreground/20 backdrop-blur-sm"
          onClick={() => setSelectedJob(null)}
        >
          <div
            className="flex h-full w-full max-w-lg flex-col border-l border-border bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between border-b border-border p-6">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-secondary text-sm font-bold">
                  {selectedJob.c[0]}
                </div>
                <div>
                  <div className="font-semibold">{selectedJob.t}</div>
                  <div className="mt-0.5 text-sm text-muted-foreground">{selectedJob.c}</div>
                </div>
              </div>
              <button
                onClick={() => setSelectedJob(null)}
                className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Match score */}
              <div className="rounded-xl border border-border bg-background p-4">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium">Your match score</span>
                  <span className="font-semibold text-primary">{selectedJob.m}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-primary transition-all"
                    style={{ width: `${selectedJob.m}%` }}
                  />
                </div>
              </div>

              {/* Meta */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2 rounded-lg border border-border bg-background p-3">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="text-xs text-muted-foreground">Location</div>
                    <div className="font-medium">{selectedJob.l}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-border bg-background p-3">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="text-xs text-muted-foreground">Salary</div>
                    <div className="font-medium">{selectedJob.s}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-border bg-background p-3">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="text-xs text-muted-foreground">Work type</div>
                    <div className="font-medium">{selectedJob.r ? "Remote" : "On-site"}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-border bg-background p-3">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="text-xs text-muted-foreground">Company</div>
                    <div className="font-medium">{selectedJob.c}</div>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <div className="mb-2 text-sm font-semibold">About the role</div>
                <p className="text-sm leading-relaxed text-muted-foreground">{selectedJob.desc}</p>
              </div>

              {/* Skills */}
              <div>
                <div className="mb-2 text-sm font-semibold">Key skills</div>
                <div className="flex flex-wrap gap-2">
                  {selectedJob.sk.map((s) => (
                    <span
                      key={s}
                      className="rounded-md border border-border bg-background px-2.5 py-1 text-xs text-foreground"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-border p-4 flex gap-2">
              <a
                href={selectedJob.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Apply now <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <button
                onClick={() => setSelectedJob(null)}
                className="rounded-lg border border-input bg-background px-4 py-2.5 text-sm font-medium hover:bg-accent"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
