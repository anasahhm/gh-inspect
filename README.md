# gh-inspect

> Analyze any GitHub repository in seconds — health score, README quality, issue insights, dependency rot, contributor burnout detection, and dead repo verdict.

![Node.js](https://img.shields.io/badge/Node.js-≥20-brightgreen) ![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue) ![License](https://img.shields.io/badge/license-MIT-yellow)

---

## Why

When doing open source contributions, I kept running into the same problem — spending time setting up a repo only to realize mid-way that it was unmaintained, had rotting dependencies, or had a single maintainer who hadn't been active in months.

So I built a tool that tells me all of that in one shot before I invest time in a project.

---

## What it checks

| Feature | What it does |
|---|---|
| **Repo health score** | Weighted 0–10 score across 7 dimensions |
| **README analysis** | Detects missing sections, scores quality, lists improvements |
| **Issue insights** | Open ratio, avg response time, contributor-friendliness labels |
| **Dependency rot** | Hits npm registry, finds outdated + majorly-behind packages |
| **Contributor burnout** | Detects bus factor risk, dominant + absent maintainers |
| **Dead repo detector** | Signal-based verdict: active → slowing → stale → abandoned → dead |
| **AI suggestions** | Optional Groq/OpenAI-powered actionable recommendations |

---

## Installation

```bash
# 1. Clone
git clone https://github.com/your-username/gh-inspect.git
cd gh-inspect

# 2. Install dependencies
npm install

# 3. Set up environment
cp .env.example .env
# Fill in your tokens (see below)

# 4. Build
npm run build

# 5. Optional: use globally from anywhere
npm link
```

---

## .env setup

```env
# Required — https://github.com/settings/tokens → public_repo scope
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx

# Optional — enables AI suggestions (free via Groq)
OPENAI_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxx
```

### Using Groq (free tier)

1. Sign up at [console.groq.com](https://console.groq.com) - free tier
2. Create an API key

---

## Usage

```bash
# Basic
gh-inspect https://github.com/expressjs/express

# Short form works too
gh-inspect facebook/react

# Skip AI (no API key needed)
gh-inspect vuejs/vue --no-ai

# Pass tokens inline
gh-inspect user/repo --token ghp_xxx --openai-key gsk_xxx
```

---


## Project structure

```
src/
├── cli.ts                      entry point, Commander setup
├── index.ts                    orchestrator, runs all steps
├── services/
│   ├── githubService.ts        GitHub REST API — metadata, README, issues, commits, package.json
│   ├── readmeAnalyzer.ts       section detection, quality scoring
│   ├── issueAnalyzer.ts        response time, ratios, label analysis
│   ├── dependencyRotAnalyzer.ts  npm registry checks, version gap detection
│   ├── burnoutAnalyzer.ts      commit ownership, bus factor, absence detection
│   ├── deadRepoAnalyzer.ts     signal-based vitality scoring
│   ├── scoringService.ts       weighted score assembly, problems + suggestions
│   └── aiService.ts            Groq/OpenAI wrapper
├── utils/
│   ├── formatter.ts            terminal output renderer
│   └── logger.ts               chalk logger
└── types/
    └── index.ts                all TypeScript interfaces
```

---

## Tech stack

- **Runtime**: Node.js ≥ 20
- **Language**: TypeScript (strict mode, no `any`)
- **CLI**: commander
- **HTTP**: axios
- **HTML parsing**: cheerio
- **Styling**: chalk
- **Spinner**: ora
- **AI**: Groq (free) or OpenAI (optional)

---

## Contributing

1. Fork and clone
2. `npm install && npm run build`
3. Create a branch: `git checkout -b feat/your-feature`
4. Commit and open a PR

---

## License

MIT
