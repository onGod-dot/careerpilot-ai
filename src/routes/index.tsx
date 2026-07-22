import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Upload,
  Sparkles,
  Target,
  Briefcase,
  FileText,
  Mic,
  BarChart3,
  BookOpen,
  Code2,
  ClipboardCheck,
  ShieldCheck,
  Check,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CareerPilot AI — Prepare Smarter. Get Hired Faster." },
      {
        name: "description",
        content:
          "AI-powered career coaching that analyzes your CV, prepares you for interviews, identifies skill gaps, and helps you land the right opportunities.",
      },
      { property: "og:title", content: "CareerPilot AI" },
      {
        property: "og:description",
        content: "Your AI career companion — from CV analysis to interview-ready in one workspace.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <SiteHeader />
      <main>
        <Hero />
        <HowItWorks />
        <Features />
        <Testimonials />
        <CTASection />
      </main>
      <SiteFooter />
    </div>
  );
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2">
          <Logo />
          <span className="text-sm font-semibold tracking-tight">CareerPilot AI</span>
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          <a href="#features" className="hover:text-foreground">
            Features
          </a>
          <a href="#how" className="hover:text-foreground">
            How it works
          </a>
          <a href="#testimonials" className="hover:text-foreground">
            Customers
          </a>
          <a href="#pricing" className="hover:text-foreground">
            Pricing
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <Link
            to="/auth"
            className="hidden rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground sm:inline-flex"
          >
            Sign in
          </Link>
          <Link
            to="/auth"
            className="inline-flex items-center gap-1 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Start free
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </header>
  );
}

function Logo() {
  return (
    <div className="grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-foreground">
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
        <path
          d="M4 14 L12 5 L20 14"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M8 19 L12 15 L16 19"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function Hero() {
  return (
    <section className="border-b border-border/70">
      <div className="mx-auto grid max-w-7xl gap-12 px-6 py-20 md:grid-cols-2 md:gap-16 md:py-28">
        <div className="flex flex-col justify-center">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            AI Career Companion — in private beta
          </div>
          <h1 className="mt-6 text-5xl font-semibold tracking-tight text-foreground md:text-6xl">
            Prepare smarter.
            <br />
            <span className="text-primary">Get hired faster.</span>
          </h1>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-muted-foreground">
            AI-powered career coaching that analyzes your CV, prepares you for interviews,
            identifies your skill gaps, and helps you land the right opportunities.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Start free
              <ArrowRight className="h-4 w-4" />
            </Link>
            <button className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent">
              Watch demo
            </button>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-primary" /> No credit card
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-primary" /> ATS-optimized
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-primary" /> Private by default
            </span>
          </div>
        </div>
        <DashboardMock />
      </div>
    </section>
  );
}

function DashboardMock() {
  return (
    <div className="relative">
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-elevated)]">
        <div className="flex items-center gap-1.5 border-b border-border px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
          <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
          <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
          <span className="ml-3 text-xs text-muted-foreground">CareerPilot — Dashboard</span>
        </div>
        <div className="grid grid-cols-[140px_1fr] gap-0">
          <aside className="border-r border-border p-3 text-xs">
            {[
              "Dashboard",
              "My CV",
              "Job Matches",
              "Skill Analysis",
              "Practice",
              "Interview",
              "Learning",
              "Analytics",
            ].map((label, i) => (
              <div
                key={label}
                className={`mb-1 rounded-md px-2 py-1.5 ${
                  i === 0 ? "bg-primary/10 text-primary" : "text-muted-foreground"
                }`}
              >
                {label}
              </div>
            ))}
          </aside>
          <div className="p-5">
            <div className="text-xs text-muted-foreground">Good morning, Cyril</div>
            <div className="mt-1 text-lg font-semibold tracking-tight">Career Score</div>
            <div className="mt-3 grid grid-cols-4 gap-3">
              {[
                { l: "Career", v: 82 },
                { l: "CV", v: 87 },
                { l: "Interview", v: 74 },
                { l: "Skills", v: 68 },
              ].map((s) => (
                <div key={s.l} className="rounded-lg border border-border p-3">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {s.l}
                  </div>
                  <div className="mt-1 text-lg font-semibold">{s.v}</div>
                  <div className="mt-2 h-1 w-full rounded-full bg-muted">
                    <div className="h-1 rounded-full bg-primary" style={{ width: `${s.v}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-lg border border-border p-3">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="font-medium">CV Analysis</span>
                <span className="text-primary">87 / 100</span>
              </div>
              {["Formatting", "ATS Match", "Experience", "Skills"].map((row, i) => (
                <div key={row} className="mb-1.5 flex items-center gap-2 text-[11px]">
                  <span className="w-20 text-muted-foreground">{row}</span>
                  <div className="h-1 flex-1 rounded-full bg-muted">
                    <div
                      className="h-1 rounded-full bg-primary/80"
                      style={{ width: `${70 + i * 6}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HowItWorks() {
  const steps = [
    { icon: Upload, title: "Upload CV", desc: "Drop your PDF or DOCX to get started in seconds." },
    {
      icon: Sparkles,
      title: "AI Analysis",
      desc: "Get an ATS-ready score with actionable feedback.",
    },
    { icon: Target, title: "Practice", desc: "Coding, aptitude, and voice interview simulations." },
    { icon: Briefcase, title: "Get Hired", desc: "Apply confidently to matched, high-fit roles." },
  ];
  return (
    <section id="how" className="border-b border-border/70">
      <div className="mx-auto max-w-7xl px-6 py-20">
        <div className="mb-12 max-w-2xl">
          <div className="text-xs font-medium uppercase tracking-wider text-primary">
            How it works
          </div>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
            A guided path from CV to offer.
          </h2>
          <p className="mt-3 text-muted-foreground">
            Four calm steps. No noise. Just progress you can measure.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {steps.map((s, i) => (
            <div
              key={s.title}
              className="rounded-xl border border-border bg-card p-5 transition-colors hover:border-foreground/20"
            >
              <div className="flex items-center justify-between">
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
                  <s.icon className="h-4.5 w-4.5" />
                </div>
                <span className="text-xs text-muted-foreground">0{i + 1}</span>
              </div>
              <div className="mt-4 text-sm font-semibold">{s.title}</div>
              <div className="mt-1 text-sm text-muted-foreground">{s.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Features() {
  const items = [
    {
      icon: FileText,
      title: "AI CV Analyzer",
      desc: "ATS scoring, grammar, and structural feedback.",
    },
    {
      icon: Sparkles,
      title: "AI CV Generator",
      desc: "Craft a tailored resume with live suggestions.",
    },
    {
      icon: Briefcase,
      title: "Job Matching",
      desc: "Ranked opportunities based on your skill profile.",
    },
    {
      icon: BarChart3,
      title: "Skill Gap Analysis",
      desc: "See exactly which skills unlock better roles.",
    },
    {
      icon: ClipboardCheck,
      title: "Aptitude Tests",
      desc: "Adaptive quizzes with detailed diagnostics.",
    },
    {
      icon: Code2,
      title: "Coding Assessments",
      desc: "LeetCode-style problems with AI code review.",
    },
    {
      icon: Mic,
      title: "Voice Interviews",
      desc: "Realistic mock interviews with scored feedback.",
    },
    {
      icon: BookOpen,
      title: "Learning Roadmap",
      desc: "Curated courses, videos, and practice sets.",
    },
  ];
  return (
    <section id="features" className="border-b border-border/70 bg-secondary/40">
      <div className="mx-auto max-w-7xl px-6 py-20">
        <div className="mb-12 max-w-2xl">
          <div className="text-xs font-medium uppercase tracking-wider text-primary">Platform</div>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
            Everything you need to get job-ready.
          </h2>
          <p className="mt-3 text-muted-foreground">
            One workspace for your resume, practice, and applications.
          </p>
        </div>
        <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-4">
          {items.map((f) => (
            <div key={f.title} className="bg-card p-6">
              <f.icon className="h-5 w-5 text-primary" strokeWidth={1.75} />
              <div className="mt-4 text-sm font-semibold">{f.title}</div>
              <div className="mt-1 text-sm text-muted-foreground">{f.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Testimonials() {
  const items = [
    {
      quote:
        "CareerPilot rewrote how I prepare. My CV went from ignored to shortlisted at three companies in two weeks.",
      name: "Amelia R.",
      role: "Frontend Engineer",
    },
    {
      quote:
        "The voice interview feedback is uncannily accurate. It felt like getting notes from a senior manager.",
      name: "Jonah K.",
      role: "Product Manager",
    },
    {
      quote:
        "Finally, a career tool that isn't cluttered. The skill gap radar changed how I plan my learning.",
      name: "Priya S.",
      role: "Data Analyst",
    },
  ];
  return (
    <section id="testimonials" className="border-b border-border/70">
      <div className="mx-auto max-w-7xl px-6 py-20">
        <div className="mb-12 max-w-2xl">
          <div className="text-xs font-medium uppercase tracking-wider text-primary">Customers</div>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
            Trusted by candidates who mean business.
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {items.map((t) => (
            <figure key={t.name} className="rounded-xl border border-border bg-card p-6">
              <blockquote className="text-sm leading-relaxed text-foreground">
                “{t.quote}”
              </blockquote>
              <figcaption className="mt-6 flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-full border border-border bg-secondary text-xs font-semibold text-foreground">
                  {t.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </div>
                <div>
                  <div className="text-sm font-medium">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.role}</div>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTASection() {
  return (
    <section id="pricing" className="border-b border-border/70">
      <div className="mx-auto max-w-7xl px-6 py-20">
        <div className="rounded-2xl border border-border bg-card p-10 md:p-14">
          <div className="grid gap-8 md:grid-cols-[1.5fr_1fr] md:items-end">
            <div>
              <ShieldCheck className="h-6 w-6 text-primary" strokeWidth={1.75} />
              <h2 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">
                Ready when you are.
              </h2>
              <p className="mt-3 max-w-xl text-muted-foreground">
                Free to start. Upgrade when you want deeper practice sessions, unlimited AI
                feedback, and premium job matches.
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-3">
              <Link
                to="/auth"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Start free
                <ArrowRight className="h-4 w-4" />
              </Link>
              <button className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent">
                Book a walkthrough
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-border/70">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-10 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <Logo />
          <span className="text-sm font-semibold">CareerPilot AI</span>
          <span className="ml-3 text-xs text-muted-foreground">
            © {new Date().getFullYear()} CareerPilot AI. All rights reserved.
          </span>
        </div>
        <nav className="flex flex-wrap gap-6 text-sm text-muted-foreground">
          <a href="#" className="hover:text-foreground">
            Privacy
          </a>
          <a href="#" className="hover:text-foreground">
            Terms
          </a>
          <a href="#" className="hover:text-foreground">
            Security
          </a>
          <a href="#" className="hover:text-foreground">
            Contact
          </a>
        </nav>
      </div>
    </footer>
  );
}
