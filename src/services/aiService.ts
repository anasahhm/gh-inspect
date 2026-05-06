import OpenAI from "openai";
import type { ReadmeAnalysis, IssueInsights, RepoMetadata } from "../types/index.js";


// AI Service

export class AiService {
  private client: OpenAI;

  constructor(apiKey: string) {
  this.client = new OpenAI({
  apiKey,
  baseURL: "https://api.groq.com/openai/v1",
});
  }

  // Core text analysis 

  async analyzeText(prompt: string): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "system",
          content:
            "You are an expert open-source maintainer and technical writer. " +
            "Provide concise, actionable, specific suggestions for improving GitHub repositories. " +
            "Focus on practical steps that can be taken immediately. " +
            "Be direct and specific — avoid vague advice.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: 500,
      temperature: 0.4,
    });

    return response.choices[0]?.message?.content?.trim() ?? "";
  }

  // Repo-specific suggestions 

  async generateRepoSuggestions(
    metadata: RepoMetadata,
    readme: ReadmeAnalysis,
    issues: IssueInsights
  ): Promise<string[]> {
    const context = buildContext(metadata, readme, issues);

    const prompt = `
Analyze this GitHub repository and provide 3–5 specific, actionable improvement suggestions.

${context}

Return ONLY a JSON array of strings (the suggestions), no other text.
Example format: ["Suggestion one.", "Suggestion two.", "Suggestion three."]
Each suggestion should be a complete, standalone action item.
`.trim();

    try {
      const raw = await this.analyzeText(prompt);
      const cleaned = raw.replace(/```json\n?|```\n?/g, "").trim();
      const parsed: unknown = JSON.parse(cleaned);

      if (Array.isArray(parsed) && parsed.every((s) => typeof s === "string")) {
        return parsed as string[];
      }

      return [raw];
    } catch {

      // If JSON parsing fails, split by newlines and clean up

      const raw = await this.analyzeText(
        `List 3–5 specific improvements for this repository:\n\n${context}\n\nUse a simple numbered list.`
      );

      return raw
        .split(/\n/)
        .map((line) => line.replace(/^\d+[.)]\s*/, "").trim())
        .filter((line) => line.length > 10)
        .slice(0, 5);
    }
  }
}


// Context Builder


function buildContext(
  metadata: RepoMetadata,
  readme: ReadmeAnalysis,
  issues: IssueInsights
): string {
  return `
Repository: ${metadata.fullName}
Language: ${metadata.language ?? "Unknown"}
Stars: ${metadata.stars} | Forks: ${metadata.forks}
License: ${metadata.license ?? "None"}
Description: ${metadata.description ?? "None"}
Topics: ${metadata.topics.join(", ") || "None"}

README Score: ${readme.score}/10
README Length: ${readme.length} words
Missing Sections: ${readme.missingSections.join(", ") || "None"}
Has Code Examples: ${readme.hasCodeExamples}
Has Badges: ${readme.hasBadges}

Issue Activity: ${issues.activityLevel}
Open Issues: ${issues.totalOpen} | Closed: ${issues.totalClosed}
Open Ratio: ${(issues.openRatio * 100).toFixed(1)}%
Avg Response Time: ${issues.averageResponseTimeHours !== null ? `${issues.averageResponseTimeHours.toFixed(0)} hours` : "N/A"}
Good First Issue Label: ${issues.hasGoodFirstIssue}
Help Wanted Label: ${issues.hasHelpWanted}
`.trim();
}
