/**
 * Wizard state — persists the user's progress through the onboarding steps.
 */

export type WizardStep =
  | "upload" // Step 1: Upload & analyse CV
  | "results" // Step 2: View analysis results
  | "improve" // Step 3: Improve / generate CV
  | "skills" // Step 4: Skill gap review
  | "jobs" // Step 5: Job matches
  | "practice" // Step 6: Practice & interview
  | "done"; // Step 7: All done → full dashboard

const KEY = "careerpilot_wizard_step";

function canUseSessionStorage(): boolean {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

export function saveWizardStep(step: WizardStep) {
  if (!canUseSessionStorage()) return;
  sessionStorage.setItem(KEY, step);
}

export function loadWizardStep(): WizardStep {
  if (!canUseSessionStorage()) return "upload";
  return (sessionStorage.getItem(KEY) as WizardStep) ?? "upload";
}

export function clearWizard() {
  if (!canUseSessionStorage()) return;
  sessionStorage.removeItem(KEY);
}

export const STEPS: { id: WizardStep; label: string; short: string }[] = [
  { id: "upload", label: "Upload CV", short: "Upload" },
  { id: "results", label: "CV Analysis", short: "Analysis" },
  { id: "improve", label: "Improve CV", short: "Improve" },
  { id: "skills", label: "Skill Gaps", short: "Skills" },
  { id: "jobs", label: "Job Matches", short: "Jobs" },
  { id: "practice", label: "Practice", short: "Practice" },
];
