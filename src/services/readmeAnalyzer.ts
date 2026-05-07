import * as cheerio from "cheerio";
import type { ReadmeAnalysis, ReadmeSection } from "../types/index.js";

interface SectionDef { name: string; required: boolean; keywords: string[] }

const SECTIONS: SectionDef[] = [
  { name: "Installation",   required: true,  keywords: ["install", "installation", "setup", "getting started", "quick start"] },
  { name: "Usage",          required: true,  keywords: ["usage", "how to use", "example", "examples", "demo"] },
  { name: "Contributing",   required: true,  keywords: ["contribut", "contributing", "contribution"] },
  { name: "License",        required: false, keywords: ["license", "licence", "mit", "apache", "gpl"] },
  { name: "Requirements",   required: false, keywords: ["prerequisite", "requirement", "dependencies"] },
  { name: "Configuration",  required: false, keywords: ["configuration", "config", "environment", "env"] },
  { name: "Tests",          required: false, keywords: ["test", "testing", "run tests", "jest", "vitest"] },
  { name: "API Reference",  required: false, keywords: ["api reference", "api docs", "documentation"] },
  { name: "Changelog",      required: false, keywords: ["changelog", "history", "release"] },
];

export function analyzeReadme(content: string | null): ReadmeAnalysis {
  if (!content?.trim()) return empty();

  const lower = content.toLowerCase();
  let $: ReturnType<typeof cheerio.load>;
  try { $ = cheerio.load(content); } catch { $ = cheerio.load(""); }

  const sections: ReadmeSection[] = SECTIONS.map(def => ({
    name: def.name,
    required: def.required,
    present: def.keywords.some(kw => lower.includes(kw)),
  }));

  const missingSections = sections.filter(s => s.required && !s.present).map(s => s.name);
  const hasCodeExamples = /```[\s\S]*?```/.test(content) || lower.includes("<code>");
  const hasBadges       = content.includes("shields.io") || content.includes("badge") || /!\[.*?\]\(https?:\/\/.+?\)/.test(content);
  const hasImages       = (content.match(/!\[.*?\]\(.*?\)/g) ?? []).length > 0 || $("img").length > 0;

  const wordCount = content.replace(/```[\s\S]*?```/g, "").split(/\s+/).filter(Boolean).length;

  let score = 0;
  const req = sections.filter(s => s.required);
  score += (req.filter(s => s.present).length / req.length) * 5;
  if (wordCount >= 200) score += 1;
  if (wordCount >= 500) score += 1;
  if (hasCodeExamples)  score += 1;
  if (hasBadges)        score += 0.5;
  if (hasImages)        score += 0.5;
  const opt = sections.filter(s => !s.required);
  score += Math.min(1, (opt.filter(s => s.present).length / Math.max(1, opt.length)) * 2);
  score = Math.min(10, Math.round(score * 10) / 10);

  const improvements: string[] = [];
  if (missingSections.includes("Installation"))  improvements.push('Add an "Installation" section with step-by-step instructions.');
  if (missingSections.includes("Usage"))         improvements.push('Add a "Usage" section with concrete examples.');
  if (missingSections.includes("Contributing"))  improvements.push('Add a "Contributing" section or link to CONTRIBUTING.md.');
  if (!hasCodeExamples)                          improvements.push("Add code snippets — people want to see what using this looks like.");
  if (!hasBadges)                                improvements.push("Add CI/coverage badges to signal project health at a glance.");
  if (wordCount < 200)                           improvements.push(`README is thin (${wordCount} words) — expand it.`);

  return { score, length: wordCount, sections, missingSections, improvements, hasCodeExamples, hasBadges, hasImages };
}

function empty(): ReadmeAnalysis {
  return {
    score: 0, length: 0,
    sections: SECTIONS.map(s => ({ name: s.name, required: s.required, present: false })),
    missingSections: SECTIONS.filter(s => s.required).map(s => s.name),
    improvements: ["No README found — this is the single most important thing to fix."],
    hasCodeExamples: false, hasBadges: false, hasImages: false,
  };
}
