import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import {
  Youtube, BookOpen, FileText, Code2, Clock,
  ExternalLink, Sparkles, Loader2, Play, RefreshCw,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { loadCVAnalysis } from "@/lib/cv-store";
import { getVideoRecommendations, type VideoRec } from "@/lib/video-recommendations";
import { stripMarkdown } from "@/lib/format";

export const Route = createFileRoute("/learning")({
  head: () => ({
    meta: [
      { title: "Learning Hub — CareerPilot AI" },
      { name: "description", content: "Personalized learning based on your skill gaps." },
      { property: "og:title", content: "Learning Hub — CareerPilot AI" },
      { property: "og:description", content: "Videos, courses, and practice tailored to you." },
    ],
  }),
  component: LearningPage,
});

// ─── Static curated resources ─────────────────────────────────────────────────

const buckets = [
  {
    weak: "Docker",
    items: [
      { i: Youtube, t: "Docker in 100 minutes", diff: "Beginner",      h: 2,  type: "YouTube", url: "https://www.youtube.com/watch?v=pTFZFxd5hgI" },
      { i: BookOpen, t: "Docker for Developers", diff: "Intermediate", h: 6,  type: "Course",  url: "https://docs.docker.com/get-started/" },
      { i: FileText, t: "Official Docker docs",  diff: "Reference",    h: 4,  type: "Docs",    url: "https://docs.docker.com/" },
    ],
  },
  {
    weak: "Testing",
    items: [
      { i: Code2,    t: "Vitest hands-on guide",            diff: "Intermediate", h: 3,  type: "Practice", url: "https://vitest.dev/guide/" },
      { i: Youtube,  t: "Testing React — Kent C. Dodds",   diff: "Beginner",     h: 1,  type: "YouTube",  url: "https://www.youtube.com/watch?v=8Xwi6F4_2K0" },
      { i: BookOpen, t: "Playwright end-to-end testing",   diff: "Advanced",     h: 8,  type: "Course",   url: "https://playwright.dev/docs/intro" },
    ],
  },
  {
    weak: "System Design",
    items: [
      { i: FileText, t: "System Design Primer",                     diff: "Intermediate", h: 12, type: "Docs",    url: "https://github.com/donnemartin/system-design-primer" },
      { i: Youtube,  t: "System Design Interview – ByteByteGo",    diff: "Intermediate", h: 4,  type: "YouTube", url: "https://www.youtube.com/@ByteByteGo" },
      { i: BookOpen, t: "Designing Data-Intensive Applications",    diff: "Advanced",     h: 20, type: "Book",    url: "https://dataintensive.net/" },
    ],
  },
];

// ─── Level badge colours ──────────────────────────────────────────────────────

const levelColor: Record<string, string> = {
  Beginner:     "bg-primary/10 text-primary",
  Intermediate: "bg-[color:var(--color-warning)]/10 text-[color:var(--color-warning)]",
  Advanced:     "bg-destructive/10 text-destructive",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

function LearningPage() {
  const [videos, setVideos] = useState<VideoRec[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const cvAnalysis = loadCVAnalysis();

  const fetchVideos = async () => {
    if (!cvAnalysis) {
      toast.error("Upload and analyse your CV first to get personalised video picks.");
      return;
    }
    setLoadingVideos(true);
    try {
      const recs = await getVideoRecommendations(cvAnalysis);
      setVideos(recs);
      toast.success("Video recommendations ready!");
    } catch {
      toast.error("Could not generate recommendations. Please try again.");
    } finally {
      setLoadingVideos(false);
    }
  };

  return (
    <AppShell title="Learning">
      <PageHeader
        eyebrow="Roadmap"
        title="Learn what moves your score"
        description="Personalised video picks from AI, plus curated courses and docs for your weakest areas."
      />

      {/* ── AI Video Recommendations ── */}
      <section className="mb-10">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">AI-picked videos for your career path</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {cvAnalysis
                ? `Based on your CV — ${cvAnalysis.headline || "your role"} · score ${cvAnalysis.overallScore}/100`
                : "Upload your CV first to get personalised picks"}
            </p>
          </div>
          <button
            onClick={videos.length ? fetchVideos : fetchVideos}
            disabled={loadingVideos}
            className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-background px-3.5 py-2 text-xs font-medium hover:bg-accent disabled:opacity-60 transition-colors"
          >
            {loadingVideos ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Scanning…</>
            ) : videos.length ? (
              <><RefreshCw className="h-3.5 w-3.5" /> Refresh</>
            ) : (
              <><Sparkles className="h-3.5 w-3.5 text-primary" /> Find videos for me</>
            )}
          </button>
        </div>

        {videos.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {videos.map((v, i) => (
              <a
                key={i}
                href={v.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-primary/5"
              >
                {/* thumbnail placeholder */}
                <div className="relative mb-3 flex h-28 items-center justify-center overflow-hidden rounded-lg bg-muted">
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-[#FF0000] text-white transition-transform group-hover:scale-110">
                    <Play className="h-4 w-4 fill-white" />
                  </div>
                  <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
                    {v.duration}
                  </span>
                  <span className={`absolute top-2 left-2 rounded-full px-2 py-0.5 text-[10px] font-semibold ${levelColor[v.level] ?? "bg-secondary text-foreground"}`}>
                    {v.level}
                  </span>
                </div>

                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <span className="rounded-md border border-border bg-background px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {v.tag}
                  </span>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>

                <p className="text-sm font-medium leading-snug line-clamp-2">{v.title}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground line-clamp-2">
                  {stripMarkdown(v.reason)}
                </p>
              </a>
            ))}
          </div>
        ) : (
          <div
            className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center transition-colors hover:border-primary/40 hover:bg-primary/5"
            onClick={fetchVideos}
          >
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-[#FF0000]/10 text-[#FF0000]">
              <Youtube className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-semibold">
                {loadingVideos ? "Scanning YouTube for the best videos…" : "Get AI-curated video picks"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {loadingVideos
                  ? "Groq is analysing your CV to find the most relevant content"
                  : "AI scans your CV, finds your weak areas, and surfaces the best YouTube content to close those gaps"}
              </p>
            </div>
            {loadingVideos && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
          </div>
        )}
      </section>

      {/* ── Video Tutorials ── */}
      <section className="mb-10">
        <h3 className="mb-5 text-sm font-semibold text-muted-foreground uppercase tracking-wider">Video Tutorials</h3>
        <p className="mb-4 text-xs text-muted-foreground">Watch these videos directly on this page to improve your career skills.</p>
        <div className="grid gap-6 sm:grid-cols-2">
          {[
            {
              id: "uMf1Y9VtgNk",
              title: "Career Development Fundamentals"
            },
            {
              id: "FNL61tvwBUg",
              title: "Resume Writing Mastery"
            },
            {
              id: "IBjM-F56qS0",
              title: "Interview Success Strategies"
            },
            {
              id: "hqtTEpUcMIY",
              title: "Professional Networking Skills"
            },
          ].map((video) => (
            <div key={video.id} className="flex flex-col">
              <h4 className="mb-3 text-sm font-medium">{video.title}</h4>
              <div className="relative w-full overflow-hidden rounded-xl border border-border bg-card">
                <div className="aspect-video">
                  <iframe
                    src={`https://www.youtube.com/embed/${video.id}`}
                    title={video.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    className="h-full w-full border-0"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Curated static resources ── */}
      <section>
        <h3 className="mb-5 text-sm font-semibold text-muted-foreground uppercase tracking-wider">Curated by topic</h3>
        <div className="space-y-8">
          {buckets.map((b) => (
            <div key={b.weak}>
              <div className="mb-3 flex items-baseline gap-2">
                <h4 className="text-sm font-semibold">{b.weak}</h4>
                <span className="text-xs text-muted-foreground">recommended</span>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {b.items.map((r) => (
                  <a
                    key={r.t}
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group rounded-xl border border-border bg-card p-5 hover:border-foreground/20 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
                        <r.i className="h-4 w-4" />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="rounded-md border border-border bg-background px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                          {r.diff}
                        </span>
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                    <div className="mt-4 text-sm font-medium">{r.t}</div>
                    <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{r.type}</span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {r.h}h
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
