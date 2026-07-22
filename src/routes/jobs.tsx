import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import {
  MapPin, Building2, Sparkles, ArrowRight, X, ExternalLink,
  Briefcase, DollarSign, Globe, Search, Loader2, RefreshCw,
  ChevronDown, ChevronUp,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { loadCVAnalysis } from "@/lib/cv-store";
import { generateJobListings, type JobListing, type JobSource } from "@/lib/job-search";

export const Route = createFileRoute("/jobs")({
  head: () => ({
    meta: [
      { title: "Job Matches — CareerPilot AI" },
      { name: "description", content: "AI-matched roles near your location with direct links to every major jobs board." },
      { property: "og:title", content: "Job Matches — CareerPilot AI" },
      { property: "og:description", content: "Ranked roles tailored to your profile and location." },
    ],
  }),
  component: JobsPage,
});

// Board colour accents for recognisable branding
const BOARD_STYLES: Record<string, { bg: string; text: string }> = {
  LinkedIn:    { bg: "bg-[#0077B5]/10", text: "text-[#0077B5]" },
  "Google Jobs": { bg: "bg-[#4285F4]/10", text: "text-[#4285F4]" },
  Indeed:      { bg: "bg-[#003A9B]/10", text: "text-[#003A9B]" },
  Reed:        { bg: "bg-[#CC0000]/10", text: "text-[#CC0000]" },
  Glassdoor:   { bg: "bg-[#0CAA41]/10", text: "text-[#0CAA41]" },
  Adzuna:      { bg: "bg-[#FF6B00]/10", text: "text-[#FF6B00]" },
};

function BoardBadge({ src }: { src: JobSource }) {
  const style = BOARD_STYLES[src.board] ?? { bg: "bg-secondary", text: "text-foreground" };
  return (
    <a
      href={src.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:opacity-80 ${style.bg} ${style.text}`}
    >
      {src.board}
      <ExternalLink className="h-2.5 w-2.5 opacity-70" />
    </a>
  );
}

function JobsPage() {
  const cv = loadCVAnalysis();
  const [jobs, setJobs]         = useState<JobListing[]>([]);
  const [loading, setLoading]   = useState(false);
  const [fetched, setFetched]   = useState(false);
  const [selected, setSelected] = useState<JobListing | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const fetchJobs = async () => {
    if (!cv) {
      toast.error("Upload your CV in the wizard first to get personalised matches.");
      return;
    }
    setLoading(true);
    try {
      const listings = await generateJobListings(cv);
      setJobs(listings);
      setFetched(true);
      toast.success(`Found ${listings.length} matching roles!`);
    } catch {
      toast.error("Could not load jobs — please try again.");
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (i: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });

  const location = cv?.location || "your area";
  const role     = cv?.headline || "your role";
  const weakAreas = cv?.sections.filter((s) => s.status !== "good").slice(0, 2).map((s) => s.label) ?? [];

  return (
    <AppShell title="Job Matches">
      <PageHeader
        eyebrow="Opportunities"
        title="Roles matched for you"
        description="AI finds the best-fit vacancies near your CV location across every major jobs board."
      />

      {/* AI summary + search trigger */}
      <div className="mb-6 rounded-xl border border-border bg-card p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold">AI Match Summary</div>
              <p className="mt-1 text-sm text-muted-foreground">
                {cv ? (
                  <>
                    Searching for <span className="font-medium text-foreground">{role}</span> roles near{" "}
                    <span className="font-medium text-primary">{location}</span>
                    {weakAreas.length > 0 && (
                      <>
                        {" · "}improving <span className="text-foreground">{weakAreas[0]}</span>
                        {weakAreas[1] && <> and <span className="text-foreground">{weakAreas[1]}</span></>} could raise your match scores
                      </>
                    )}.
                  </>
                ) : (
                  "Upload your CV in the wizard to get personalised job matches and location-based search."
                )}
              </p>
            </div>
          </div>
          <button
            onClick={fetchJobs}
            disabled={loading || !cv}
            className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
          >
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Searching…</>
            ) : fetched ? (
              <><RefreshCw className="h-4 w-4" /> Refresh results</>
            ) : (
              <><Search className="h-4 w-4" /> Find jobs near me</>
            )}
          </button>
        </div>

        {/* Board pills */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {["LinkedIn", "Google Jobs", "Indeed", "Reed", "Glassdoor", "Adzuna"].map((b) => {
            const style = BOARD_STYLES[b] ?? { bg: "bg-secondary", text: "text-foreground" };
            return (
              <span
                key={b}
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${style.bg} ${style.text}`}
              >
                {b}
              </span>
            );
          })}
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] text-muted-foreground">
            + more
          </span>
        </div>
      </div>

      {/* Empty / loading states */}
      {!fetched && !loading && (
        <div
          onClick={cv ? fetchJobs : undefined}
          className={`flex flex-col items-center gap-4 rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center ${cv ? "cursor-pointer transition-colors hover:border-primary/40 hover:bg-primary/5" : "opacity-60"}`}
        >
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Briefcase className="h-7 w-7" />
          </div>
          <div>
            <p className="text-sm font-semibold">
              {cv ? "Click to find matching jobs" : "Upload your CV first"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground max-w-sm">
              {cv
                ? `AI will scan your profile and surface the top roles for ${role} near ${location}.`
                : "Go through the wizard to upload your CV, then come back here for personalised results."}
            </p>
          </div>
          {cv && (
            <div className="flex flex-wrap justify-center gap-2 text-[11px] text-muted-foreground">
              {["LinkedIn", "Google Jobs", "Indeed", "Reed", "Glassdoor", "Adzuna"].map((b) => (
                <span key={b} className="rounded-full border border-border bg-background px-2 py-0.5">{b}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card px-6 py-16 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <div>
            <p className="text-sm font-semibold">Scanning vacancy boards…</p>
            <p className="mt-1 text-xs text-muted-foreground">Finding the best {role} roles near {location}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {["LinkedIn", "Google Jobs", "Indeed", "Reed", "Glassdoor", "Adzuna"].map((b) => (
              <span key={b} className="animate-pulse rounded-full border border-border bg-background px-2.5 py-0.5 text-[11px] text-muted-foreground">{b}</span>
            ))}
          </div>
        </div>
      )}

      {/* Job table */}
      {fetched && jobs.length > 0 && (
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
              {jobs.map((j, i) => (
                <>
                  <tr
                    key={i}
                    className="cursor-pointer hover:bg-secondary/30"
                    onClick={() => setSelected(j)}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-secondary text-xs font-semibold">
                          {j.company[0]}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-medium">{j.title}</div>
                          <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                            <Building2 className="h-3 w-3" /> {j.company}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" /> {j.location}
                        {j.remote && (
                          <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                            Remote
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div className="h-1 w-16 rounded-full bg-muted">
                          <div
                            className={`h-1 rounded-full ${j.matchScore >= 80 ? "bg-primary" : j.matchScore >= 65 ? "bg-[color:var(--color-warning)]" : "bg-muted-foreground/50"}`}
                            style={{ width: `${j.matchScore}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium tabular-nums">{j.matchScore}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 tabular-nums text-muted-foreground">{j.salaryRange}</td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1">
                        {j.requiredSkills.slice(0, 3).map((s) => (
                          <span
                            key={s}
                            className="rounded-md border border-border bg-background px-1.5 py-0.5 text-[11px] text-muted-foreground"
                          >
                            {s}
                          </span>
                        ))}
                        {j.requiredSkills.length > 3 && (
                          <span className="text-[11px] text-muted-foreground">+{j.requiredSkills.length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelected(j); }}
                        className="inline-flex items-center gap-1 rounded-lg border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
                      >
                        View <ArrowRight className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Job detail drawer */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-foreground/20 backdrop-blur-sm"
          onClick={() => setSelected(null)}
        >
          <div
            className="flex h-full w-full max-w-lg flex-col border-l border-border bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between border-b border-border p-6">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-secondary text-sm font-bold">
                  {selected.company[0]}
                </div>
                <div>
                  <div className="font-semibold">{selected.title}</div>
                  <div className="mt-0.5 text-sm text-muted-foreground">{selected.company}</div>
                </div>
              </div>
              <button
                onClick={() => setSelected(null)}
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
                  <span className={`font-semibold ${selected.matchScore >= 80 ? "text-primary" : selected.matchScore >= 65 ? "text-[color:var(--color-warning)]" : "text-muted-foreground"}`}>
                    {selected.matchScore}%
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted">
                  <div
                    className={`h-2 rounded-full transition-all ${selected.matchScore >= 80 ? "bg-primary" : selected.matchScore >= 65 ? "bg-[color:var(--color-warning)]" : "bg-muted-foreground/50"}`}
                    style={{ width: `${selected.matchScore}%` }}
                  />
                </div>
              </div>

              {/* Meta */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2 rounded-lg border border-border bg-background p-3">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="text-xs text-muted-foreground">Location</div>
                    <div className="font-medium">{selected.location}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-border bg-background p-3">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="text-xs text-muted-foreground">Salary</div>
                    <div className="font-medium">{selected.salaryRange}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-border bg-background p-3">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="text-xs text-muted-foreground">Work type</div>
                    <div className="font-medium">{selected.remote ? "Remote" : "On-site / Hybrid"}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-border bg-background p-3">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="text-xs text-muted-foreground">Company</div>
                    <div className="font-medium">{selected.company}</div>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <div className="mb-2 text-sm font-semibold">About the role</div>
                <p className="text-sm leading-relaxed text-muted-foreground">{selected.description}</p>
              </div>

              {/* Skills */}
              <div>
                <div className="mb-2 text-sm font-semibold">Key skills</div>
                <div className="flex flex-wrap gap-2">
                  {selected.requiredSkills.map((s) => (
                    <span
                      key={s}
                      className="rounded-md border border-border bg-background px-2.5 py-1 text-xs text-foreground"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              {/* Search on boards */}
              <div>
                <div className="mb-3 text-sm font-semibold">Search this role on</div>
                <div className="flex flex-wrap gap-2">
                  {selected.sources.map((src) => (
                    <BoardBadge key={src.board} src={src} />
                  ))}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Each link searches for <strong>{selected.title}</strong> near <strong>{selected.location === "Remote" ? location : selected.location}</strong> on that board.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-border p-4 flex gap-2">
              <a
                href={selected.sources[0]?.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Search on LinkedIn <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <button
                onClick={() => setSelected(null)}
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
