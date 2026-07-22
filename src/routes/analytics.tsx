import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import {
  Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
  CartesianGrid, Area, AreaChart,
} from "recharts";
import { loadCVAnalysis } from "@/lib/cv-store";
import { loadSnapshots, buildTrend } from "@/lib/user-store";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — CareerPilot AI" },
      { name: "description", content: "Track your career readiness progress over time." },
    ],
  }),
  component: AnalyticsPage,
});

const tooltipStyle = {
  backgroundColor: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  fontSize: 12,
} as const;

function AnalyticsPage() {
  const cv = loadCVAnalysis();
  const snaps = loadSnapshots();
  const trend = buildTrend(snaps);

  // Application readiness from actual CV sections
  const readinessBars = cv
    ? [
        { l: "Resume",       v: cv.overallScore },
        { l: "ATS Keywords", v: cv.sections.find((s) => s.label === "ATS Keywords")?.score ?? cv.overallScore },
        { l: "Formatting",   v: cv.sections.find((s) => s.label === "Formatting")?.score ?? cv.overallScore },
        { l: "Experience",   v: cv.sections.find((s) => s.label === "Experience")?.score ?? cv.overallScore },
        { l: "Achievements", v: cv.sections.find((s) => s.label === "Achievements")?.score ?? cv.overallScore },
      ]
    : [];

  const hasData = trend.length > 0;
  const weekCount = trend.length;
  const descLine = cv
    ? hasData
      ? `${weekCount} ${weekCount === 1 ? "session" : "sessions"} tracked. CV score: ${cv.overallScore}/100.`
      : "Upload your CV and practice to start building your progress history."
    : "No data yet — upload your CV to begin.";

  return (
    <AppShell title="Analytics">
      <PageHeader eyebrow="Progress" title="Your trajectory" description={descLine} />

      {!cv ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border bg-card px-6 py-20 text-center">
          <p className="text-sm font-semibold">No data yet</p>
          <p className="text-xs text-muted-foreground">
            Analyse your CV and complete practice sessions to see your progress charts here.
          </p>
          <a href="/wizard"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Get started
          </a>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* CV score trend */}
          <ChartCard title="CV score trend">
            {hasData ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend}>
                  <defs>
                    <linearGradient id="cvArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="w" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="cv" stroke="var(--color-primary)" strokeWidth={2} fill="url(#cvArea)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart label={`Current: ${cv.overallScore}/100`} value={cv.overallScore} />
            )}
          </ChartCard>

          {/* Application readiness */}
          <ChartCard title="Application readiness">
            <div className="flex h-full flex-col justify-center gap-4">
              {readinessBars.map((r) => (
                <div key={r.l}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-foreground">{r.l}</span>
                    <span className="tabular-nums text-muted-foreground">{r.v}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted">
                    <div className={`h-1.5 rounded-full transition-all ${
                      r.v >= 80 ? "bg-primary" : r.v >= 55 ? "bg-[color:var(--color-warning)]" : "bg-destructive"
                    }`} style={{ width: `${r.v}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </ChartCard>

          {/* Interview trend */}
          <ChartCard title="Interview improvement">
            {hasData && trend.some((t) => t.int > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend}>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="w" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="int" stroke="var(--color-primary)" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                <p className="text-sm text-muted-foreground">Complete a mock interview to see your score here.</p>
                <a href="/interview" className="text-xs font-medium text-primary hover:underline">Start interview →</a>
              </div>
            )}
          </ChartCard>

          {/* Coding trend */}
          <ChartCard title="Coding performance">
            {hasData && trend.some((t) => t.code > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend}>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="w" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="code" stroke="var(--color-primary)" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                <p className="text-sm text-muted-foreground">Complete a coding challenge to see your score here.</p>
                <a href="/practice" className="text-xs font-medium text-primary hover:underline">Start practice →</a>
              </div>
            )}
          </ChartCard>
        </div>
      )}
    </AppShell>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-4 h-64">{children}</div>
    </div>
  );
}

function EmptyChart({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3">
      <div className="text-3xl font-bold text-primary">{value}<span className="text-lg text-muted-foreground">/100</span></div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xs text-muted-foreground">Analyse again to build a trend line.</p>
    </div>
  );
}
