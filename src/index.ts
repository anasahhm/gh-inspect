import "dotenv/config";
import { GitHubService, parseGitHubUrl } from "./services/githubService.js";
import { analyzeReadme } from "./services/readmeAnalyzer.js";
import { analyzeIssues } from "./services/issueAnalyzer.js";
import { assembleResult } from "./services/scoringService.js";
import { AiService } from "./services/aiService.js";
import { formatResult } from "./utils/formatter.js";
import { logger } from "./utils/logger.js";
import type { AppConfig, InspectResult } from "./types/index.js";
import ora from "ora";


// Main Inspect Function


export async function inspectRepo(
  repoUrl: string,
  config: AppConfig
): Promise<InspectResult> {

  // Parse URL

  const { owner, repo } = parseGitHubUrl(repoUrl);

  // Fetch GitHub data

  const githubSpinner = ora({
    text: `Fetching repository data for ${owner}/${repo}…`,
    color: "gray",
  }).start();

  let repoData;
  try {
    const githubService = new GitHubService(config.githubToken);
    repoData = await githubService.fetchRepoData(owner, repo);
    githubSpinner.succeed(`Repository data fetched — ${repoData.issues.length} issues found.`);
  } catch (err) {
    githubSpinner.fail("Failed to fetch repository data.");
    throw err;
  }

  // Analyze README

  const readmeSpinner = ora({ text: "Analyzing README…", color: "yellow" }).start();
  const readmeAnalysis = analyzeReadme(repoData.readme);
  readmeSpinner.succeed(`README analyzed — score: ${readmeAnalysis.score}/10`);

  // 4. Analyze Issues

  const issueSpinner = ora({ text: "Analyzing issues…", color: "magenta" }).start();
  const issueInsights = analyzeIssues(repoData.issues);
  issueSpinner.succeed(`Issues analyzed — activity: ${issueInsights.activityLevel}`);

  // AI suggestions (optional)

  let aiSuggestions: string[] = [];

  if (config.useAi && config.openaiApiKey) {
    const aiSpinner = ora({
      text: "Generating AI-powered recommendations…",
      color: "blue",
    }).start();

    try {
      const aiService = new AiService(config.openaiApiKey);
      aiSuggestions = await aiService.generateRepoSuggestions(
        repoData.metadata,
        readmeAnalysis,
        issueInsights
      );
      aiSpinner.succeed(`${aiSuggestions.length} AI recommendations generated.`);
    } catch (err) {
      aiSpinner.warn("AI suggestions unavailable — continuing without them.");
      logger.debug(`AI error: ${String(err)}`);
    }
  }

  // Assemble result

  const result = assembleResult(repoData, readmeAnalysis, issueInsights, aiSuggestions);

  // Print output
  
  formatResult(result, repoUrl);

  return result;
}

// Config loader


export function loadConfig(options: {
  token?: string;
  openaiKey?: string;
  noAi?: boolean;
}): AppConfig {
  const githubToken = options.token ?? process.env["GITHUB_TOKEN"] ?? "";
  const openaiApiKey = options.openaiKey ?? process.env["OPENAI_API_KEY"] ?? "";

  if (!githubToken) {
    throw new Error(
      "GitHub token is required.\n" +
        "Set GITHUB_TOKEN in your .env file or pass --token <token>."
    );
  }

  const useAi = !options.noAi && openaiApiKey.length > 0;

  return { githubToken, openaiApiKey, useAi };
}
