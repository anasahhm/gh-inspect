import * as cheerio from "cheerio";
import type { ReadmeAnalysis, ReadmeSection } from "../types/index.js";


// Section Definitions


interface SectionDef {
  name: string;
  required: boolean;
  keywords: string[];
}

const SECTIONS: SectionDef[] = [
  {
    name: "Installation",
    required: true,
    keywords: ["install", "installation", "setup", "getting started", "get started", "quick start"],
  },
  {
    name: "Usage",
    required: true,
    keywords: ["usage", "how to use", "example", "examples", "demo"],
  },
  {
    name: "Contributing",
    required: true,
    keywords: ["contribut", "contributing", "contribution", "how to contribute"],
  },
  {
    name: "License",
    required: false,
    keywords: ["license", "licence", "mit", "apache", "gpl"],
  },
  {
    name: "Prerequisites / Requirements",
    required: false,
    keywords: ["prerequisite", "requirement", "dependencies", "dependency"],
  },
  {
    name: "Configuration",
    required: false,
    keywords: ["configuration", "config", "environment", "env", "settings"],
  },
  {
    name: "Tests",
    required: false,
    keywords: ["test", "testing", "run tests", "jest", "mocha", "vitest"],
  },
  {
    name: "API Reference",
    required: false,
    keywords: ["api reference", "api docs", "documentation", "docs"],
  },
  {
    name: "Changelog",
    required: false,
    keywords: ["changelog", "change log", "history", "release"],
  },
];


// README Analyzer


export function analyzeReadme(readmeContent: string | null): ReadmeAnalysis {
  if (!readmeContent || readmeContent.trim().length === 0) {
    return emptyReadmeResult();
  }

  const lower = readmeContent.toLowerCase();
  const $ = loadHtml(readmeContent);

  // Section detection 

  const sections: ReadmeSection[] = SECTIONS.map((def) => ({
    name: def.name,
    required: def.required,
    present: def.keywords.some((kw) => lower.includes(kw)),
  }));

  const missingSections = sections
    .filter((s) => s.required && !s.present)
    .map((s) => s.name);

  //  Feature flags 

  const hasCodeExamples = /```[\s\S]*?```/.test(readmeContent) || lower.includes("<code>");
  const hasBadges =
    readmeContent.includes("![") ||
    readmeContent.includes("shields.io") ||
    readmeContent.includes("badge");
  const hasImages =
    (readmeContent.match(/!\[.*?\]\(.*?\)/g) ?? []).length > 0 ||
    ($("img").length > 0);

  //  Length & readability 

  const wordCount = readmeContent
    .replace(/```[\s\S]*?```/g, "")
    .split(/\s+/)
    .filter(Boolean).length;

  const lineCount = readmeContent.split("\n").length;

  //  Score calculation 

  let score = 0;

  // Base sections (max 5 points)

  const requiredSections = sections.filter((s) => s.required);
  const presentRequired = requiredSections.filter((s) => s.present).length;
  score += (presentRequired / requiredSections.length) * 5;

  // Length penalty / bonus (max 2 points)

  if (wordCount >= 200) score += 1;
  if (wordCount >= 500) score += 1;

  // Feature bonuses (max 3 points)

  if (hasCodeExamples) score += 1;
  if (hasBadges) score += 0.5;
  if (hasImages) score += 0.5;

  // Optional sections bonus

  const optionalSections = sections.filter((s) => !s.required);
  const presentOptional = optionalSections.filter((s) => s.present).length;
  score += Math.min(1, (presentOptional / Math.max(1, optionalSections.length)) * 2);

  score = Math.min(10, Math.round(score * 10) / 10);

  //  Improvement suggestions 

  const improvements: string[] = [];

  if (missingSections.includes("Installation")) {
    improvements.push('Add an "Installation" section with step-by-step setup instructions.');
  }
  if (missingSections.includes("Usage")) {
    improvements.push('Add a "Usage" section with clear examples of how to use this project.');
  }
  if (missingSections.includes("Contributing")) {
    improvements.push('Add a "Contributing" section or link to a CONTRIBUTING.md file.');
  }
  if (!hasCodeExamples) {
    improvements.push("Include code examples or snippets to illustrate how the project works.");
  }
  if (!hasBadges) {
    improvements.push("Add status badges (CI, coverage, npm version) to communicate project health.");
  }
  if (wordCount < 200) {
    improvements.push(`README is quite short (${wordCount} words). Consider expanding it for clarity.`);
  }
  if (!hasImages && lineCount > 50) {
    improvements.push("Consider adding screenshots or architecture diagrams to aid understanding.");
  }

  return {
    score,
    length: wordCount,
    sections,
    missingSections,
    improvements,
    hasCodeExamples,
    hasBadges,
    hasImages,
  };
}

// Helpers

function emptyReadmeResult(): ReadmeAnalysis {
  return {
    score: 0,
    length: 0,
    sections: SECTIONS.map((s) => ({ name: s.name, required: s.required, present: false })),
    missingSections: SECTIONS.filter((s) => s.required).map((s) => s.name),
    improvements: [
      "No README found. Creating a README.md is the most important first step for any open-source project.",
      "A good README should include: project description, installation, usage, and contribution guidelines.",
    ],
    hasCodeExamples: false,
    hasBadges: false,
    hasImages: false,
  };
}

function loadHtml(markdown: string): ReturnType<typeof cheerio.load> {
  try {
    return cheerio.load(markdown);
  } catch {
    return cheerio.load("");
  }
}

