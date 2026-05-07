#!/usr/bin/env node
import "dotenv/config";
import { Command } from "commander";
import chalk from "chalk";
import { inspectRepo, loadConfig } from "./index.js";
import { logger } from "./utils/logger.js";

const program = new Command();

program
  .name("gh-inspect")
  .description("GitHub repo analyzer — health score, README, issues, dependency rot, burnout, vitality.")
  .version("1.0.0", "-v, --version")
  .argument("<url>", "GitHub repo URL or owner/repo")
  .option("-t, --token <token>",      "GitHub token (overrides GITHUB_TOKEN)")
  .option("-k, --openai-key <key>",   "OpenAI key (overrides OPENAI_API_KEY)")
  .option("--no-ai",                  "skip AI suggestions")
  .addHelpText("after", `
${chalk.bold("examples:")}
  ${chalk.dim("gh-inspect https://github.com/expressjs/express")}
  ${chalk.dim("gh-inspect facebook/react --no-ai")}
  ${chalk.dim("gh-inspect vuejs/vue --token ghp_xxx")}

${chalk.bold("env:")}
  ${chalk.yellow("GITHUB_TOKEN")}    required
  ${chalk.yellow("OPENAI_API_KEY")}  optional — enables AI suggestions
                   or use Groq free: set baseURL in aiService.ts
`)
  .action(async (url: string, opts: { token?: string; openaiKey?: string; noAi?: boolean }) => {
    console.log();
    console.log(chalk.bold("gh-inspect") + chalk.dim(" v1.0.0"));
    console.log(chalk.dim("─".repeat(30)));

    try {
      if (!isGitHubUrl(url)) {
        throw new Error(`"${url}" doesn't look like a GitHub URL.\n  expected: https://github.com/owner/repo`);
      }
      const config = loadConfig({ token: opts.token, openaiKey: opts.openaiKey, noAi: opts.noAi });
      if (!config.useAi) logger.warn("AI off — pass OPENAI_API_KEY or use Groq to enable it.");
      logger.blank();
      await inspectRepo(url, config);
    } catch (e) {
      logger.blank();
      logger.error(e instanceof Error ? e.message : String(e));
      logger.blank();
      process.exit(1);
    }
  });

program.parse(process.argv);

function isGitHubUrl(url: string): boolean {
  return /^(https?:\/\/github\.com\/[^/]+\/[^/]+|[^/]+\/[^/]+|git@github\.com:[^/]+\/[^/]+)/.test(url.trim());
}
