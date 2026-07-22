/**
 * AI-powered video recommendation engine.
 *
 * Uses Groq to generate targeted search queries based on the CV analysis,
 * then builds YouTube search deep-links. No YouTube API key needed.
 */

import { groqChat, MODEL_FAST } from "./groq";
import { type CVAnalysis } from "./cv-store";

// Helper function to extract YouTube video ID from various URL formats
export function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

export interface VideoRec {
  title: string;       // descriptive title shown in UI
  query: string;       // the actual YouTube search query (fallback)
  url: string;         // direct YouTube video URL or search URL
  reason: string;      // why this is relevant to this CV
  tag: string;         // skill / topic tag  e.g. "Docker" "System Design"
  level: "Beginner" | "Intermediate" | "Advanced";
  duration: string;    // e.g. "~30 min"
}

export async function getVideoRecommendations(analysis: CVAnalysis): Promise<VideoRec[]> {
  const role = analysis.headline || "Software Engineer";
  const skills = analysis.skills?.join(", ") || "programming";
  const weakSections = analysis.sections
    .filter((s) => s.status !== "good")
    .map((s) => s.label)
    .join(", ");
  const weakScore = analysis.sections
    .filter((s) => s.status !== "good")
    .sort((a, b) => a.score - b.score)
    .slice(0, 4)
    .map((s) => `${s.label} (${s.score}/100)`)
    .join(", ");

  const prompt = `You are a career coach recommending YouTube learning videos.

Candidate profile:
- Role: ${role}
- Skills: ${skills}
- CV score: ${analysis.overallScore}/100
- Weak areas needing improvement: ${weakScore}

Generate exactly 6 highly specific YouTube video recommendations to help this person improve and get hired.
Focus on: ${weakSections || "general career skills"}.

IMPORTANT: For each recommendation, try to provide the ACTUAL YouTube video URL if you know a specific video. If you don't know a specific video, provide a search query.

Return ONLY a JSON array (no markdown, no extra text):
[
  {
    "title": "Short descriptive title shown to user (max 60 chars)",
    "query": "YouTube search query (only if you don't have a specific video URL)",
    "url": "ACTUAL YouTube video URL (e.g. https://www.youtube.com/watch?v=VIDEO_ID) if you know a specific video, otherwise omit this field",
    "reason": "One sentence: why this video matters for their specific profile",
    "tag": "Skill or topic tag (e.g. Docker, React, System Design, ATS Resume)",
    "level": "Beginner" | "Intermediate" | "Advanced",
    "duration": "~X min"
  }
]

Rules:
- Mix beginner and intermediate levels
- Prioritize providing actual YouTube video URLs when you know specific high-quality videos
- Use specific, searchable YouTube queries (channel names help: e.g. "Fireship Docker tutorial", "TechLead resume tips")
- Make reasons specific to their weak areas, not generic
- Cover a mix of: technical skills, interview prep, CV improvement
- Return exactly 6 items`;

  const raw = await groqChat(
    [{ role: "user", content: prompt }],
    { model: MODEL_FAST, temperature: 0.5, max_tokens: 1200 },
  );

  try {
    const clean = raw.replace(/```json|```/g, "").trim();
    const start = clean.indexOf("[");
    const end = clean.lastIndexOf("]");
    const parsed = JSON.parse(clean.slice(start, end + 1)) as (Omit<VideoRec, "url"> & { url?: string })[];
    return parsed.map((v) => ({
      ...v,
      url: v.url || `https://www.youtube.com/results?search_query=${encodeURIComponent(v.query)}`,
    }));
  } catch {
    // fallback set if parsing fails
    return getFallbackRecs(role, analysis);
  }
}

function getFallbackRecs(role: string, analysis: CVAnalysis): VideoRec[] {
  const base = [
    { tag: "Resume", query: "how to write ATS resume 2024", title: "ATS Resume Writing Guide", reason: "Improve your CV score with proven ATS strategies.", level: "Beginner" as const, duration: "~20 min" },
    { tag: "Interview", query: "how to answer tell me about yourself interview", title: "Tell Me About Yourself — Best Answer", reason: "Master the most common interview opener.", level: "Beginner" as const, duration: "~15 min" },
    { tag: "System Design", query: "system design interview for beginners", title: "System Design Interview Crash Course", reason: "System design is tested at most senior roles.", level: "Intermediate" as const, duration: "~45 min" },
    { tag: "LinkedIn", query: "how to optimize LinkedIn profile for recruiters 2024", title: "LinkedIn Profile Optimization", reason: "Recruiters screen LinkedIn before your CV.", level: "Beginner" as const, duration: "~18 min" },
    { tag: "Coding", query: "LeetCode patterns for interviews explained", title: "LeetCode Patterns to Master Interviews", reason: "Pattern recognition is faster than brute force grinding.", level: "Intermediate" as const, duration: "~30 min" },
    { tag: "Salary", query: "how to negotiate salary job offer", title: "Salary Negotiation Tactics That Work", reason: "Most candidates leave money on the table by not negotiating.", level: "Beginner" as const, duration: "~12 min" },
  ];
  return base.map((v) => ({
    ...v,
    url: `https://www.youtube.com/results?search_query=${encodeURIComponent(v.query)}`,
  }));
}
