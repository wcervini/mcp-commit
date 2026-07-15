# mcp-commit 🔧

MCP server that analyzes git changes, generates commit messages with **gitmoji + Conventional Commits** via OpenCode Zen (MiMo V2.5 Free) or an intelligent fallback, and executes the commit automatically.

---

## How It Works

```
git diff HEAD
     │
     ▼
┌─────────────────────────────┐
│  Classify changes           │
│  • modified • added • deleted│
└──────────┬──────────────────┘
           ▼
┌─────────────────────────────┐
│  Generate commit message    │
│  ├─ AI (OpenCode Zen)       │
│  └─ Intelligent fallback    │
│     • infer gitmoji ✨ ♻️ 🔧 │
│     • infer scope (src/api) │
│     • infer type feat/refac │
└──────────┬──────────────────┘
           ▼
┌─────────────────────────────┐
│  git add <path> (spawn)     │
│  git commit -m "✨ feat.."  │
│  ✅ No shell injection      │
└─────────────────────────────┘
```

---

## 🎯 Primary Skill: `commit`

This MCP server is the **runtime backend** for the [`commit`](https://github.com/wcervini/skills) skill in [`wcervini/skills`](https://github.com/wcervini/skills) — a curated set of AI skills for development workflows.

The **commit** skill defines the authoritative standard:

```
<gitmoji> <type>[scope]: <description>
```

This MCP implements that standard in two ways:

| Mode | How it works |
|------|-------------|
| **AI** (with API key) | Sends changes to OpenCode Zen (MiMo V2.5 Free) which generates a message following the skill's spec |
| **Intelligent fallback** (no API key) | Analyzes the changes and automatically infers: gitmoji, conventional type, scope from file paths, and an imperative description — all compliant with the skill rules |

Both modes produce messages that satisfy:
- ✅ Gitmoji at the start (`✨`, `🐛`, `♻️`, `🔧`, etc.)
- ✅ Correct type (`feat`, `fix`, `refactor`, `chore`, etc.)
- ✅ Scope inference from directory structure
- ✅ Imperative mood ("add" not "added")
- ✅ No period at the end, no semicolons, no caps

---

## 🧩 All Skills from `wcervini/skills`

The [`wcervini/skills`](https://github.com/wcervini/skills) repository includes the following skills for AI-assisted development:

| Skill | Description |
|-------|-------------|
| ⭐ **commit** | Generate commit messages with gitmoji and Conventional Commits — this MCP is its runtime |
| 🚀 **astro** | Build with the Astro web framework |
| 🏗️ **astro-framework** | Astro framework specialist (islands, SSR, content collections, view transitions) |
| 📋 **changelog-generator** | Auto-create user-facing changelogs from git history |
| 📋 **changelog-maintenance** | Maintain clear changelogs for software releases |
| 🔗 **htmx** | Build dynamic web applications with minimal JavaScript |
| 📐 **javascript-best-practices** | JavaScript & TypeScript clean code principles |
| 🌐 **modern-web-guidance** | Modern web development best practices (CSS, HTML, client-side JS) |
| ✂️ **vscode-snippets** | Generate VS Code snippets from code selection |

---

## Features

- **Gitmoji + Conventional Commits** — messages follow the `<gitmoji> <type>(scope): <description>` format via AI or intelligent fallback
- **Scope inference** — automatically detects the common directory from changed files
- **Type inference** — chooses `feat`, `refactor`, `chore`, etc. based on the change pattern
- **Safe git operations** — uses `spawn` with argument arrays instead of `exec`, preventing shell injection
- **Configurable API** — set `OPENAI_BASE_URL` or `--baseUrl` to use any OpenAI-compatible API
- **Git repo validation** — verifies `.git` exists before running any command
- **No-commit repo support** — handles repositories without an initial commit gracefully
- **Unified output** — all messages in English with consistent formatting
- **Offline simulation** — test the full flow without touching git via `simulate.ts`

---

## Quick Start

```bash
# Clone the repository
git clone https://github.com/wcervini/mcp-commit.git
cd mcp-commit

# Install dependencies
pnpm install

# Set your API key (optional — falls back to intelligent mode)
export OPENCODE_API_KEY=your-api-key

# Build the project
pnpm run build
```

The compiled output will be at `build/index.js`.

---

## Configuration

The server accepts the following configuration sources (flag takes precedence over environment variable):

| Environment Variable | Flag | Description |
|---------------------|------|-------------|
| `OPENCODE_API_KEY` | `--key` | OpenCode Zen API key (recommended) |
| `OPENAI_API_KEY` | — | Fallback OpenAI-compatible API key |
| `OPENAI_BASE_URL` | `--baseUrl` | API base URL (default: `https://opencode.ai/zen/v1`) |

**Example with flags:**

```bash
node build/index.js --key your-api-key --baseUrl https://custom.api.com/v1
```

If no API key is provided, the server runs in **fallback mode** using the intelligent inference engine.

---

## Usage with MCP Hosts

### Cursor

1. Go to **Cursor Settings → MCP → Add new MCP server**
2. Configure:
   - **Name:** `git-auto-commit`
   - **Type:** `command`
   - **Command:** `node /absolute/path/to/mcp-commit/build/index.js --key your-api-key`

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "git-auto-commit": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-commit/build/index.js", "--key", "your-api-key"]
    }
  }
}
```

### OpenCode

Add to your `opencode.json`:

```json
{
  "mcpServers": {
    "git-auto-commit": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-commit/build/index.js", "--key", "your-api-key"]
    }
  }
}
```

---

## Offline Simulation

Test the full commit message generation flow without touching a real git repository:

```bash
npx tsx simulate.ts
```

This runs a complete simulation with mock data, showing:
- File classification (modified, added, deleted)
- Summary generation
- Commit message inference (gitmoji, type, scope)
- Formatted MCP response

---

## Conventional Commits Reference

This server follows the [Conventional Commits](https://www.conventionalcommits.org/) specification with gitmoji, as defined by the `commit` skill.

### Gitmoji Quick Reference

| Emoji | Type | When to use |
|-------|------|-------------|
| ✨ | `feat` | New feature |
| 🐛 | `fix` | Bug fix |
| 📝 | `docs` | Documentation |
| ♻️ | `refactor` | Code restructuring |
| 🎨 | `style` | Formatting (not logic) |
| ⚡️ | `perf` | Performance improvement |
| ✅ | `test` | Adding or passing tests |
| 🔧 | `chore` | Configuration / maintenance |
| 🔥 | `chore` | Removing code or files |
| 👷 | `ci` | CI/CD changes |
| 💥 | `feat!` | Breaking change |
| ⏪️ | `revert` | Reverting changes |

### Format Rules

- Required structure: `<gitmoji> <type>[scope]: <description>`
- **Maximum 50 characters** recommended for the first line (hard limit: 72, excluding gitmoji)
- **Imperative mood**: "add feature" not "added feature"
- **No period** at the end
- **No semicolons**
- **Do not capitalize** the first letter of description

### Examples

```
✨ feat(auth): add JWT refresh token rotation
🐛 fix(api): resolve race condition in user endpoint
♻️ refactor(core): extract auth logic to dedicated module
📝 docs(readme): update installation instructions
🔧 chore(deps): remove unused dotenv dependency
🔥 chore: remove legacy auth module
💥 feat!: drop support for Node 16
```

---

## Project Structure

```
mcp-commit/
├── index.ts        # Main MCP server implementation
├── simulate.ts     # Offline simulation script
├── package.json    # Dependencies
├── tsconfig.json   # TypeScript configuration
├── assets/         # Demo assets
└── build/          # Compiled JavaScript output
```

---

## Credits

The original idea was taken from [`hypermodel-labs/mcp-server-auto-commit`](https://github.com/hypermodel-labs/mcp-server-auto-commit). This version has been substantially modified to:

- Use OpenCode Zen (MiMo V2.5 Free) as the default AI provider
- Add an intelligent fallback engine that infers gitmoji, type, and scope
- Replace `exec` with `spawn` to prevent shell injection
- Validate git repositories before operations
- Handle repositories without initial commits
- Make the API base URL configurable
- Fully comply with the `wcervini/skills/commit` skill specification

---

## License

MIT
