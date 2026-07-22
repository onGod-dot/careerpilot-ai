import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { useState } from "react";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { loadCVAnalysis } from "@/lib/cv-store";
import { loadProfile, saveProfile, toInitials } from "@/lib/user-store";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — CareerPilot AI" },
      { name: "description", content: "Manage your profile, preferences, and account." },
      { property: "og:title", content: "Settings — CareerPilot AI" },
      { property: "og:description", content: "Configure CareerPilot to fit your goals." },
    ],
  }),
  component: SettingsPage,
});

const sections = [
  { id: "profile", label: "Profile" },
  { id: "notifications", label: "Notifications" },
  { id: "theme", label: "Theme" },
];

function SettingsPage() {
  const [activeSection, setActiveSection] = useState("profile");
  const cv = loadCVAnalysis();
  const stored = loadProfile();

  // Profile state — seeded from CV analysis + profile store
  const [profile, setProfile] = useState({
    name: stored.name || cv?.name || "",
    email: stored.email || "",
    location: stored.location || "",
    headline: stored.headline || cv?.headline || "",
  });
  const [saved, setSaved] = useState(false);
  const original = {
    name: stored.name || cv?.name || "",
    email: stored.email || "",
    location: stored.location || "",
    headline: stored.headline || cv?.headline || "",
  };

  // Notifications state
  const [notifications, setNotifications] = useState({
    weeklyProgress: true,
    newJobs: true,
    aiRecommendations: true,
    interviewReminders: false,
  });

  // Theme state
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");

  const handleSaveProfile = () => {
    saveProfile({ ...profile, initials: toInitials(profile.name) });
    setSaved(true);
    toast.success("Profile saved!");
    setTimeout(() => setSaved(false), 2000);
  };

  const handleCancelProfile = () => {
    setProfile(original);
    toast("Changes discarded.");
  };

  const handleThemeChange = (t: "light" | "dark" | "system") => {
    setTheme(t);
    const root = document.documentElement;
    if (t === "dark") {
      root.classList.add("dark");
    } else if (t === "light") {
      root.classList.remove("dark");
    } else {
      // system
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      prefersDark ? root.classList.add("dark") : root.classList.remove("dark");
    }
    toast.success(`Theme set to ${t}.`);
  };

  const handleSaveNotifications = () => {
    toast.success("Notification preferences saved!");
  };

  return (
    <AppShell title="Settings">
      <PageHeader
        eyebrow="Account"
        title="Settings"
        description="Fine-tune your CareerPilot workspace."
      />
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        {/* Sidebar nav */}
        <aside className="h-fit rounded-xl border border-border bg-card p-3">
          <nav className="text-sm">
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`block w-full rounded-md px-3 py-2 text-left transition-colors ${
                  activeSection === s.id
                    ? "bg-secondary font-medium text-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                {s.label}
              </button>
            ))}
          </nav>
        </aside>

        <div className="space-y-6">
          {/* Profile section */}
          {activeSection === "profile" && (
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="text-sm font-semibold">Profile</div>
              <p className="mt-1 text-xs text-muted-foreground">
                This information is used to tailor your matches and recommendations.
              </p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field
                  label="Full name"
                  value={profile.name}
                  onChange={(v) => setProfile((p) => ({ ...p, name: v }))}
                />
                <Field
                  label="Email"
                  value={profile.email}
                  onChange={(v) => setProfile((p) => ({ ...p, email: v }))}
                  type="email"
                />
                <Field
                  label="Location"
                  value={profile.location}
                  onChange={(v) => setProfile((p) => ({ ...p, location: v }))}
                />
                <Field
                  label="Headline"
                  value={profile.headline}
                  onChange={(v) => setProfile((p) => ({ ...p, headline: v }))}
                />
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button
                  onClick={handleCancelProfile}
                  className="rounded-lg border border-input bg-background px-3.5 py-2 text-sm font-medium hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveProfile}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  {saved ? (
                    <>
                      <Check className="h-4 w-4" /> Saved
                    </>
                  ) : (
                    "Save changes"
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Notifications section */}
          {activeSection === "notifications" && (
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="text-sm font-semibold">Notifications</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Choose what you'd like to be notified about.
              </p>
              <div className="mt-4 space-y-3 text-sm">
                {(
                  [
                    { key: "weeklyProgress", label: "Weekly progress summary" },
                    { key: "newJobs", label: "New matching jobs" },
                    { key: "aiRecommendations", label: "AI recommendations" },
                    { key: "interviewReminders", label: "Interview reminders" },
                  ] as { key: keyof typeof notifications; label: string }[]
                ).map(({ key, label }) => (
                  <label
                    key={key}
                    className="flex cursor-pointer items-center justify-between rounded-lg border border-border bg-background px-4 py-3 hover:bg-secondary/40"
                  >
                    <span>{label}</span>
                    <input
                      type="checkbox"
                      checked={notifications[key]}
                      onChange={(e) => setNotifications((n) => ({ ...n, [key]: e.target.checked }))}
                      className="h-4 w-4 accent-[color:var(--color-primary)]"
                    />
                  </label>
                ))}
              </div>
              <div className="mt-6 flex justify-end">
                <button
                  onClick={handleSaveNotifications}
                  className="rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Save preferences
                </button>
              </div>
            </div>
          )}

          {/* Theme section */}
          {activeSection === "theme" && (
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="text-sm font-semibold">Appearance</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Choose how CareerPilot looks for you.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {(["light", "dark", "system"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => handleThemeChange(t)}
                    className={`rounded-xl border p-4 text-left transition-colors ${
                      theme === t
                        ? "border-primary bg-primary/5"
                        : "border-border bg-background hover:border-foreground/20"
                    }`}
                  >
                    <div className="mb-3 grid h-10 w-10 place-items-center rounded-lg bg-secondary text-lg">
                      {t === "light" ? "☀️" : t === "dark" ? "🌙" : "💻"}
                    </div>
                    <div className="text-sm font-medium capitalize">{t}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {t === "light"
                        ? "Always use light mode"
                        : t === "dark"
                          ? "Always use dark mode"
                          : "Follow system preference"}
                    </div>
                    {theme === t && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-primary">
                        <Check className="h-3 w-3" /> Active
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div className="grid gap-1.5">
      <label className="text-xs font-medium text-foreground">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
      />
    </div>
  );
}
