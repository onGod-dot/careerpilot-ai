import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  FileText,
  Briefcase,
  BarChart3,
  Target,
  Mic,
  BookOpen,
  LineChart,
  Settings,
  Sparkles,
  Search,
  Bell,
  ChevronsUpDown,
  Wand2,
  X,
  Send,
  Loader2,
} from "lucide-react";
import { useState, useRef, useEffect, type ReactNode } from "react";
import { groqStream, MODEL_FAST, type GroqMessage } from "@/lib/groq";
import { loadCVAnalysis } from "@/lib/cv-store";
import { stripMarkdown } from "@/lib/format";
import { loadProfile, toShortName, toInitials } from "@/lib/user-store";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/cv", label: "My CV", icon: FileText },
  { to: "/jobs", label: "Job Matches", icon: Briefcase },
  { to: "/skills", label: "Skill Analysis", icon: BarChart3 },
  { to: "/practice", label: "Practice", icon: Target },
  { to: "/interview", label: "Interview", icon: Mic },
  { to: "/learning", label: "Learning", icon: BookOpen },
  { to: "/analytics", label: "Analytics", icon: LineChart },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

const QUICK_PROMPTS = [
  "What should I improve on my CV?",
  "Generate a cover letter for a Frontend role.",
  "Give me a common React interview question.",
  "What skills should I focus on next?",
];

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const SYSTEM_PROMPT = `You are CareerPilot AI, an expert career coach embedded in the CareerPilot app.
You help users with CV writing, interview prep, skill development, job searching, and career planning.
Be concise, warm, and actionable. Format responses with bullet points or short paragraphs.
If the user shares CV data, use it to give personalised advice.
ALWAYS keep responses short, simple, and precise. Avoid lengthy explanations.`;

export function AppShell({ title, children }: { title: string; children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const historyRef = useRef<GroqMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // live user info from stores
  const cv = loadCVAnalysis();
  const profile = loadProfile();
  const displayName = toShortName(profile.name || cv?.name || "");
  const initials = toInitials(profile.name || cv?.name || "") || "?";
  const email = profile.email || "";

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (assistantOpen) setTimeout(() => inputRef.current?.focus(), 100);
  }, [assistantOpen]);

  const sendMessage = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || streaming) return;
    setInput("");

    // Attach CV context on first message if available
    let systemWithContext = SYSTEM_PROMPT;
    if (historyRef.current.length === 0) {
      const cv = loadCVAnalysis();
      if (cv) {
        systemWithContext += `\n\nUser's CV data: Score ${cv.overallScore}/100. Skills: ${cv.skills?.join(", ") || "unknown"}. Weak areas: ${cv.sections
          .filter((s) => s.status !== "good")
          .map((s) => s.label)
          .join(", ")}.`;
      }
    }

    const userMsg: ChatMessage = { role: "user", content: msg };
    setMessages((m) => [...m, userMsg]);
    historyRef.current = [...historyRef.current, { role: "user", content: msg }];

    // Placeholder for streaming reply
    setMessages((m) => [...m, { role: "assistant", content: "" }]);
    setStreaming(true);

    let fullReply = "";
    try {
      await groqStream(
        [{ role: "system", content: systemWithContext }, ...historyRef.current],
        (chunk) => {
          fullReply += chunk;
          setMessages((m) => {
            const copy = [...m];
            copy[copy.length - 1] = { role: "assistant", content: fullReply };
            return copy;
          });
        },
        { model: MODEL_FAST, temperature: 0.7, max_tokens: 600 },
      );
      historyRef.current = [...historyRef.current, { role: "assistant", content: fullReply }];
    } catch {
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = {
          role: "assistant",
          content: "Sorry, I couldn't connect. Please try again.",
        };
        return copy;
      });
    } finally {
      setStreaming(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    historyRef.current = [];
  };

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="flex min-h-dvh">
        {/* Sidebar */}
        <aside className="hidden w-60 shrink-0 border-r border-border bg-sidebar lg:flex lg:flex-col">
          <div className="flex h-16 items-center gap-2 border-b border-border px-5">
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
            <span className="text-sm font-semibold tracking-tight">CareerPilot</span>
          </div>
          <nav className="flex-1 space-y-0.5 p-3">
            {nav.map((item) => {
              const active = pathname === item.to || pathname.startsWith(item.to + "/");
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors ${
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  }`}
                >
                  <item.icon className="h-4 w-4" strokeWidth={1.75} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-border p-3">
            <button className="flex w-full items-center gap-2.5 rounded-md p-2 text-left hover:bg-sidebar-accent">
              <div className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{displayName || "Your profile"}</div>
                <div className="truncate text-xs text-muted-foreground">{email || "Set up in Settings"}</div>
              </div>
              <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
        </aside>

        {/* Main */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-background/80 px-6 backdrop-blur">
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-base font-semibold tracking-tight">{title}</h1>
            </div>
            <div className="hidden items-center gap-2 rounded-lg border border-input bg-card px-3 py-1.5 text-sm text-muted-foreground md:flex md:w-72">
              <Search className="h-4 w-4" />
              <input
                placeholder="Search…"
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
              />
              <kbd className="rounded border border-border px-1.5 text-[10px] text-muted-foreground">
                ⌘K
              </kbd>
            </div>
            <button
              aria-label="Notifications"
              className="grid h-9 w-9 place-items-center rounded-lg border border-input bg-card text-muted-foreground hover:text-foreground"
            >
              <Bell className="h-4 w-4" />
            </button>
          </header>
          <main className="flex-1 px-6 py-8">
            <div className="mx-auto max-w-6xl">{children}</div>
          </main>
        </div>
      </div>

      {/* AI Assistant floating button */}
      <button
        onClick={() => setAssistantOpen(true)}
        aria-label="Open AI assistant"
        className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-[var(--shadow-elevated)] transition-transform hover:scale-[1.02]"
      >
        <Sparkles className="h-4 w-4" />
        Ask AI
      </button>

      {/* AI Assistant panel */}
      {assistantOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-foreground/20 backdrop-blur-sm"
          onClick={() => setAssistantOpen(false)}
        >
          <div
            className="flex h-full w-full max-w-md flex-col border-l border-border bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Panel header */}
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-2">
                <div className="grid h-7 w-7 place-items-center rounded-md bg-primary/10 text-primary">
                  <Wand2 className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold">AI Assistant</div>
                  <div className="text-xs text-muted-foreground">
                    {streaming ? "Thinking…" : "Ask anything about your career"}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <button
                    onClick={clearChat}
                    className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
                  >
                    Clear
                  </button>
                )}
                <button
                  onClick={() => setAssistantOpen(false)}
                  className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground px-1 pb-1">Quick questions</p>
                  {QUICK_PROMPTS.map((q) => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      className="w-full rounded-lg border border-border bg-background p-3 text-left text-sm text-foreground hover:border-foreground/20 hover:bg-secondary/40"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              ) : (
                messages.map((m, i) => (
                  <div
                    key={i}
                    className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                        m.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "border border-border bg-background text-foreground"
                      }`}
                    >
                      {m.role === "assistant"
                        ? stripMarkdown(m.content) || (
                            <span className="flex items-center gap-1.5 text-muted-foreground">
                              <Loader2 className="h-3 w-3 animate-spin" /> thinking…
                            </span>
                          )
                        : m.content}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Input */}
            <div className="border-t border-border p-4">
              <div className="flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder="Ask CareerPilot AI…"
                  disabled={streaming}
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70 disabled:opacity-50"
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || streaming}
                  className="grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-foreground disabled:opacity-40 hover:bg-primary/90"
                >
                  {streaming ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <div className="text-xs font-medium uppercase tracking-wider text-primary">{eyebrow}</div>
        )}
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h2>
        {description && (
          <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
