# gh-inspect

> **CLI tool to analyze GitHub repositories for health scores, README quality, and issue insights — with optional AI-powered recommendations.**

![Node.js](https://img.shields.io/badge/Node.js->=20.0.0-brightgreen)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)
![License](https://img.shields.io/badge/License-MIT-yellow)

---

## Features

- **Repo Health Score** (0–10) with weighted breakdown
- **README Analysis** — detects missing sections, code examples, badges
- **Issue Insights** — open ratio, average response time, label diversity
- **Activity Score** — days since last push, star/fork signals
- **Community Score** — license, contributors, topics, wiki
- **AI Suggestions** — llama-3.1 powered recommendations (optional)
- Clean, color-coded terminal output with progress spinners

---

## Installation

### Prerequisites

- Node.js >= 20.0.0
- npm >= 9

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/your-username/gh-inspect.git
cd gh-inspect

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env and fill in your tokens (see .env Setup below)

# 4. Build the TypeScript source
npm run build

# 5. (Optional) Link globally to use from anywhere
npm link
```

---

## .env Setup

Create a `.env` file in the project root:

```env
# Required — GitHub Personal Access Token
# Scopes: public_repo (read access is enough)
GITHUB_TOKEN=ghp_your_token_here

# Optional — Enables AI-powered suggestions
OPENAI_API_KEY=sk-your_openai_key_here
```

> **Tip:** Without `OPENAI_API_KEY`, the tool still works fully , it just skips AI suggestions.

---

## Usage

```bash
# Basic usage
npm start -- https://github.com/facebook/react

# Or if globally linked
gh-inspect https://github.com/facebook/react

# Disable AI suggestions (faster, no AI key needed)
gh-inspect https://github.com/expressjs/express --no-ai

# Short-hand owner/repo format also works
gh-inspect facebook/react
```

---

## Project Structure

```
gh-inspect/
├── src/
│   ├── cli.ts                  # Commander CLI entry point
│   ├── index.ts                # Main orchestration logic
│   ├── services/
│   │   ├── githubService.ts    # GitHub REST API calls
│   │   ├── readmeAnalyzer.ts   # README section & quality analysis
│   │   ├── issueAnalyzer.ts    # Issue metrics & insights
│   │   ├── scoringService.ts   # Score computation & result assembly
│   │   └── aiService.ts        # AI API wrapper
│   ├── utils/
│   │   ├── logger.ts           # Chalk-based logger
│   │   └── formatter.ts        # Terminal output formatter
│   └── types/
│       └── index.ts            # All shared TypeScript types
├── dist/                       # Compiled output (after npm run build)
├── .env                        # Your environment variables (git-ignored)
├── .env.example                # Environment variable template
├── package.json
├── tsconfig.json
└── README.md
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Compile TypeScript → `dist/` |
| `npm start -- <url>` | Build + run analysis |
| `npm run dev -- <url>` | Run directly with ts-node (dev mode) |
| `npm run clean` | Remove `dist/` folder |

---

## Architecture

```
CLI (cli.ts)
    │
    ▼
inspectRepo() (index.ts)
    │
    ├── GitHubService     → fetch metadata, README, issues, contributors
    ├── analyzeReadme()   → section detection, scoring, improvements
    ├── analyzeIssues()   → response time, open ratio, label analysis
    ├── AiService         → AI suggestions (optional)
    └── assembleResult()  → compute scores, problems, suggestions
            │
            ▼
    formatResult()        → styled terminal output
```

---

## Scoring Weights

| Dimension | Weight |
|-----------|--------|
| README Quality | 30% |
| Issue Health | 25% |
| Recent Activity | 20% |
| Community | 15% |
| Documentation | 10% |

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Commit your changes: `git commit -m "feat: add my feature"`
4. Push and open a Pull Request

---

## License

MIT © gh-inspect contributors
