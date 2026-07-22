import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Github } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — CareerPilot AI" },
      { name: "description", content: "Sign in or create your CareerPilot AI account." },
      { property: "og:title", content: "Sign in — CareerPilot AI" },
      { property: "og:description", content: "Access your AI career workspace." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto grid min-h-dvh max-w-md flex-col place-items-center px-6 py-10">
        <div className="w-full">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>

          <div className="mt-10">
            <h1 className="text-2xl font-semibold tracking-tight">
              {mode === "signin" ? "Welcome back" : "Create your account"}
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {mode === "signin"
                ? "Sign in to continue to CareerPilot."
                : "Start your career journey in seconds."}
            </p>
          </div>

          <div className="mt-8 grid gap-2">
            <button
              onClick={() => navigate({ to: "/wizard" })}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-input bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              <GoogleIcon />
              Continue with Google
            </button>
            <button
              onClick={() => navigate({ to: "/wizard" })}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-input bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              <Github className="h-4 w-4" />
              Continue with GitHub
            </button>
          </div>

          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            or
            <div className="h-px flex-1 bg-border" />
          </div>

          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              navigate({ to: "/wizard" });
            }}
          >
            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-foreground">Email</label>
              <input
                type="email"
                required
                placeholder="you@work.com"
                className="rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/70 focus:border-ring focus:ring-2 focus:ring-ring/20"
              />
            </div>
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-foreground">Password</label>
                {mode === "signin" && (
                  <a href="#" className="text-xs text-muted-foreground hover:text-foreground">
                    Forgot?
                  </a>
                )}
              </div>
              <input
                type="password"
                required
                placeholder="••••••••"
                className="rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/70 focus:border-ring focus:ring-2 focus:ring-ring/20"
              />
            </div>
            <button
              type="submit"
              className="mt-2 inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              {mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signin" ? "New here?" : "Already have an account?"}{" "}
            <button
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="font-medium text-foreground hover:underline"
            >
              {mode === "signin" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.2s2.7-6.2 6-6.2c1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.9 3.2 14.7 2.2 12 2.2 6.9 2.2 2.8 6.3 2.8 12s4.1 9.8 9.2 9.8c5.3 0 8.8-3.7 8.8-9 0-.6-.1-1-.1-1.6H12z"
      />
    </svg>
  );
}
