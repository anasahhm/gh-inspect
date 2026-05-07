import OpenAI from "openai";
import type { ReadmeAnalysis, IssueInsights, RepoMetadata, DependencyRotAnalysis, BurnoutAnalysis } from "../types/index.js";

export class AiService {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({
  apiKey,
  baseURL: "https://api.groq.com/openai/v1",
});
  }

  async analyzeText(prompt: string, model = "llama-3.1-8b-instant"): Promise<string> {
    const res = await this.client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are a senior open-source maintainer. Give specific, actionable repo improvement suggestions. " +
            "Be direct. No generic advice. Reference the actual data given.",
        },
        { role: "user", content: prompt },
      ],
      max_tokens: 500,
      temperature: 0.4,
    });
    return res.choices[0]?.message?.content?.trim() ?? "";
  }

  async generateRepoSuggestions(
    metadata: RepoMetadata,
    readme: ReadmeAnalysis,
    issues: IssueInsights,
    depRot: DependencyRotAnalysis,
    burnout: BurnoutAnalysis,
  ): Promise<string[]> {
    const prompt = `
Repo: ${metadata.fullName} (${metadata.language ?? "unknown language"})
Stars: ${metadata.stars} | Forks: ${metadata.forks} | License: ${metadata.license ?? "none"}

README: ${readme.score}/10, missing: ${readme.missingSections.join(", ") || "none"}
Issues: ${issues.activityLevel} activity, ${(issues.openRatio * 100).toFixed(0)}% open ratio
Deps: ${depRot.hasPackageJson ? `${depRot.rotPercent}% outdated, ${depRot.majorBehind} major gaps` : "no package.json"}
Burnout: top contributor owns ${burnout.topOwnershipPercent}% of commits, absent: ${burnout.maintainerAbsent}

Give 4 specific improvement suggestions as a JSON array of strings. Nothing else.
    `.trim();

    try {
      const raw = await this.analyzeText(prompt);
      const cleaned = raw.replace(/```json\n?|```\n?/g, "").trim();
      const parsed: unknown = JSON.parse(cleaned);
      if (Array.isArray(parsed) && parsed.every(s => typeof s === "string")) {
        return parsed as string[];
      }
      return [raw];
    } catch {
      const raw = await this.analyzeText(
        `List 4 improvements for ${metadata.fullName}:\n${prompt}\nNumbered list.`
      );
      return raw
        .split(/\n/)
        .map(l => l.replace(/^\d+[.)]\s*/, "").trim())
        .filter(l => l.length > 10)
        .slice(0, 4);
    }
  }
}
