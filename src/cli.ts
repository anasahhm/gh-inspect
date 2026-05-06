#!/usr/bin/env node
import "dotenv/config";
import { Command } from "commander";
import chalk from "chalk";
import { inspectRepo, loadConfig } from "./index.js";
import { logger } from "./utils/logger.js";

// CLI Definition

const program = new Command();

program
  .name("gh-inspect")
  .description(
    chalk.cyan("Analyze GitHub repositories for health, README quality, and issue insights.")
  )
  .version("1.0.0", "-v, --version", "Display the current version")
  .argument("<url>", "GitHub repository URL (e.g., https://github.com/owner/repo)")
  .option("-t, --token <token>", "GitHub Personal Access Token (overrides GITHUB_TOKEN env var)")
  .option("-k, --openai-key <key>", "OpenAI API key (overrides OPENAI_API_KEY env var)")
  .option("--no-ai", "Disable AI-powered suggestions (faster, no OpenAI needed)")
  .addHelpText(
    "after",
    `
${chalk.bold("Examples:")}
  ${chalk.cyan("$ gh-inspect https://github.com/facebook/react")}
  ${chalk.cyan("$ gh-inspect https://github.com/expressjs/express --no-ai")}
  ${chalk.cyan('$ gh-inspect https://github.com/user/repo --token ghp_xxx')}

${chalk.bold("Environment Variables:")}
  ${chalk.yellow("GITHUB_TOKEN")}   GitHub Personal Access Token (required)
  ${chalk.yellow("OPENAI_API_KEY")} OpenAI API key (optional, enables AI suggestions)
`
  )
  .action(async (url: string, options: { token?: string; openaiKey?: string; noAi?: boolean }) => {
    printBanner();

    try {
      
      validateUrl(url);               // Validate URL early for a better UX

      const config = loadConfig({
        token: options.token,
        openaiKey: options.openaiKey,
        noAi: options.noAi,
      });

      if (!config.useAi) {
        logger.warn("AI suggestions disabled (no OPENAI_API_KEY or --no-ai flag).");
      }

      logger.blank();

      await inspectRepo(url, config);
    } catch (err) {
      logger.blank();
      logger.error(err instanceof Error ? err.message : String(err));
      logger.blank();
      process.exit(1);
    }   
  });

program.parse(process.argv);


// Helpers


function printBanner(): void {
  console.log();
  console.log(chalk.bold.cyan("  gh-inspect") + chalk.dim(" v1.0.0"));
  console.log(chalk.dim("  GitHub Repository Health Analyzer"));
  console.log(chalk.gray("  ─".repeat(30)));
}

function validateUrl(url: string): void {
  const githubPattern = /^(https?:\/\/github\.com\/[^/]+\/[^/]+|[^/]+\/[^/]+|git@github\.com:[^/]+\/[^/]+)/;
  if (!githubPattern.test(url.trim())) {
    throw new Error(
      `"${url}" does not look like a valid GitHub repository URL.\n` +
        `  Expected: https://github.com/owner/repo`
    );
  }
}
