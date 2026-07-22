/**
 * AI-powered job search engine.
 *
 * Strategy:
 * 1. Groq extracts role, location and key skills from the CVAnalysis.
 * 2. It generates a list of realistic, likely-real job listings with
 *    direct search deep-links to LinkedIn, Google Jobs, Indeed, Reed,
 *    Glassdoor, and Adzuna — no paid API key needed.
 * 3. Each listing includes a match score, salary estimate, and which
 *    vacancy boards to check.
 */

import { groqChat, MODEL_QUALITY } from "./groq";
import { type CVAnalysis } from "./cv-store";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface JobListing {
  title: string;
  company: string;
  location: string;
  remote: boolean;
  salaryRange: string;
  matchScore: number;       // 0-100, AI estimated
  requiredSkills: string[];
  description: string;
  sources: JobSource[];     // direct search links on vacancy boards
}

export interface JobSource {
  board: "LinkedIn" | "Google Jobs" | "Indeed" | "Reed" | "Glassdoor" | "Adzuna";
  url: string;
  label: string;
}

// ─── URL builders ──────────────────────────────────────────────────────────────

function linkedInUrl(title: string, location: string): string {
  const q = encodeURIComponent(title);
  const l = encodeURIComponent(location);
  return `https://www.linkedin.com/jobs/search/?keywords=${q}&location=${l}&f_TPR=r604800`;
}

function googleJobsUrl(title: string, location: string): string {
  const q = encodeURIComponent(`${title} jobs ${location}`);
  return `https://www.google.com/search?q=${q}&ibp=htl;jobs`;
}

function indeedUrl(title: string, location: string): string {
  const q = encodeURIComponent(title);
  const l = encodeURIComponent(location);
  return `https://www.indeed.com/jobs?q=${q}&l=${l}`;
}

function reedUrl(title: string, location: string): string {
  const q = encodeURIComponent(title).replace(/%20/g, "-").toLowerCase();
  const l = encodeURIComponent(location).replace(/%20/g, "-").toLowerCase();
  return `https://www.reed.co.uk/jobs/${q}-jobs-in-${l}`;
}

function glassdoorUrl(title: string, location: string): string {
  const q = encodeURIComponent(title);
  const l = encodeURIComponent(location);
  return `https://www.glassdoor.com/Job/jobs.htm?suggestCount=0&suggestChosen=false&clickSource=searchBtn&typedKeyword=${q}&locT=C&locId=&jobType=all&context=Jobs&sc.keyword=${q}&dropdown=0`;
}

function adzunaUrl(title: string, location: string): string {
  const q = encodeURIComponent(title);
  const l = encodeURIComponent(location);
  // Adzuna supports multiple country TLDs — default to .com which redirects
  return `https://www.adzuna.com/search?q=${q}&loc=${l}`;
}

function buildSources(title: string, location: string): JobSource[] {
  return [
    { board: "LinkedIn",    url: linkedInUrl(title, location),    label: "LinkedIn Jobs"  },
    { board: "Google Jobs", url: googleJobsUrl(title, location),  label: "Google Jobs"    },
    { board: "Indeed",      url: indeedUrl(title, location),      label: "Indeed"         },
    { board: "Reed",        url: reedUrl(title, location),        label: "Reed"           },
    { board: "Glassdoor",   url: glassdoorUrl(title, location),   label: "Glassdoor"      },
    { board: "Adzuna",      url: adzunaUrl(title, location),      label: "Adzuna"         },
  ];
}

// ─── AI-generated job listings ────────────────────────────────────────────────

export async function generateJobListings(analysis: CVAnalysis): Promise<JobListing[]> {
  const role     = analysis.headline || "Software Engineer";
  const location = analysis.location || "Remote";
  const skills   = (analysis.skills ?? []).slice(0, 10).join(", ");
  const years    = analysis.yearsOfExperience ?? 2;
  const score    = analysis.overallScore ?? 60;

  const prompt = `You are a job market specialist with real-time knowledge of vacancies.

Candidate profile:
- Target role: ${role}
- Location: ${location}
- Key skills: ${skills}
- Years of experience: ~${years}
- CV score: ${score}/100

Generate exactly 8 realistic job listings that this candidate would find near "${location}" or remotely.
Base the listings on realistic companies that actually hire for this role in or near that region.
Include a mix of local/hybrid and remote roles.

Return ONLY a JSON array (no markdown, no extra text):
[
  {
    "title": "Exact job title",
    "company": "Realistic company name",
    "location": "City, Country or Remote",
    "remote": true|false,
    "salaryRange": "e.g. $80k–$100k or £50k–£65k",
    "matchScore": <number 60-99>,
    "requiredSkills": ["skill1", "skill2", "skill3"],
    "description": "2-3 sentence role description focused on day-to-day responsibilities"
  }
]

Rules:
- Use realistic company names (real companies that exist in that industry/region)
- matchScore must reflect how well the candidate's skills match (higher overlap = higher score)
- Sort by matchScore descending
- Location must be near "${location}" OR "Remote"
- salaryRange must use the correct currency for the region
- description must be specific and practical — no generic filler
- Keep responses short, simple, and precise. Avoid lengthy explanations.`;

  const raw = await groqChat(
    [{ role: "user", content: prompt }],
    { model: MODEL_QUALITY, temperature: 0.4, max_tokens: 2000 },
  );

  try {
    const clean = raw.replace(/```json|```/g, "").trim();
    const start = clean.indexOf("[");
    const end   = clean.lastIndexOf("]");
    const parsed = JSON.parse(clean.slice(start, end + 1)) as Omit<JobListing, "sources">[];

    return parsed.map((j) => ({
      ...j,
      sources: buildSources(j.title, j.location === "Remote" ? location : j.location),
    }));
  } catch {
    return getFallbackListings(role, location);
  }
}

// ─── Fallback listings (used if AI parse fails) ───────────────────────────────

function getFallbackListings(role: string, location: string): JobListing[] {
  const base: Omit<JobListing, "sources">[] = [
    {
      title: role,
      company: "Tech Company",
      location: location,
      remote: false,
      salaryRange: "Competitive",
      matchScore: 80,
      requiredSkills: ["Problem Solving", "Communication", "Teamwork"],
      description: `Looking for a ${role} to join our growing team. You'll work on challenging projects with a talented group of engineers.`,
    },
    {
      title: `Senior ${role}`,
      company: "Startup",
      location: "Remote",
      remote: true,
      salaryRange: "Competitive",
      matchScore: 75,
      requiredSkills: ["Leadership", "Architecture", "Mentoring"],
      description: `Senior ${role} role at a fast-moving startup. Lead technical decisions and mentor junior engineers.`,
    },
  ];
  return base.map((j) => ({
    ...j,
    sources: buildSources(j.title, j.location === "Remote" ? location : j.location),
  }));
}
