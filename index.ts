import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import OpenAI from 'openai';
import * as path from 'path';
import * as fs from 'fs';
import minimist from "minimist";

// Parse command line arguments
const argv = minimist(process.argv.slice(2));

const execAsync = promisify(exec);

/** Run a git subcommand via spawn (avoids shell injection) */
function runGitCommand(subcommand: string, args: string[], cwd: string): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn('git', [subcommand, ...args], { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
    child.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });
    child.on('close', (code: number | null) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`git ${subcommand} failed (exit ${code}): ${stderr || stdout}`));
    });
    child.on('error', reject);
  });
}

const apiKey = argv.key || process.env.OPENCODE_API_KEY || process.env.OPENAI_API_KEY;

const baseURL = argv.baseUrl || process.env.OPENAI_BASE_URL || "https://opencode.ai/zen/v1";

const openai = apiKey
  ? new OpenAI({ apiKey, baseURL })
  : null;

if (apiKey) {
  console.error("OpenCode Zen API key detected — AI commit messages enabled");
} else {
  console.error("No API key found — using fallback commit messages");
}

// Create server instance
const server = new McpServer({
  name: "git-auto-commit",
  version: "0.0.1",
});

// Function to get git changes
async function getGitChanges(input: string) {
  try {
    // Get staged and unstaged changes
    const cwd = input || process.cwd();
    
    // Validate that cwd is a valid directory
    if (!fs.existsSync(cwd)) {
      throw new Error(`Directory does not exist: ${cwd}`);
    }
    
    const resolvedCwd = path.resolve(cwd);
    console.error("cwd", resolvedCwd);

    // Validate it's a git repository
    try {
      await execAsync('git rev-parse --git-dir', { cwd: resolvedCwd });
    } catch {
      throw new Error(`Not a git repository: ${resolvedCwd}`);
    }
    
    // Check if repo has commits (HEAD exists)
    let hasInitialCommit = true;
    try {
      await execAsync('git rev-parse HEAD', { cwd: resolvedCwd });
    } catch {
      hasInitialCommit = false;
    }

    const diffCommand = hasInitialCommit ? 'git diff HEAD' : 'git diff --cached';
    const { stdout: diffOutput } = await execAsync(diffCommand, { cwd: resolvedCwd });
    const { stdout: statusOutput } = await execAsync('git status --porcelain', { cwd: resolvedCwd });
    
    // Process the changes
    const changes = {
      modified: [] as string[],
      added: [] as string[],
      deleted: [] as string[],
      details: {} as Record<string, string[]>
    };

    // Process status output to categorize files
    statusOutput.split('\n').filter(Boolean).forEach(line => {
      const [status, file] = [line.slice(0, 2).trim(), line.slice(3)];
      if (status.includes('M')) changes.modified.push(file);
      if (status.includes('A')) changes.added.push(file);
      if (status.includes('D')) changes.deleted.push(file);
    });

    // Process diff output to get detailed changes
    let currentFile = '';
    diffOutput.split('\n').forEach(line => {
      if (line.startsWith('diff --git')) {
        currentFile = line.split(' b/')[1];
        changes.details[currentFile] = [];
      } else if (line.startsWith('+') || line.startsWith('-')) {
        if (currentFile && !line.startsWith('+++') && !line.startsWith('---')) {
          changes.details[currentFile].push(line);
        }
      }
    });

    return changes;
  } catch (error: any) {
    throw new Error(`Failed to get git changes: ${error.message}`);
  }
}

/** Infer the most specific scope from file paths */
function inferScope(changes: {
  modified: string[]; added: string[]; deleted: string[];
}): string | undefined {
  const allFiles = [...changes.modified, ...changes.added, ...changes.deleted].filter(Boolean);
  if (allFiles.length === 0) return undefined;

  const dirs = allFiles.map(f => f.startsWith('/') ? f.split('/')[1] : f.split('/')[0]);
  const uniqueDirs = [...new Set(dirs)].filter(Boolean);

  if (uniqueDirs.length === 1) return uniqueDirs[0];

  // Check if there's a common parent directory (2 levels deep)
  const parents = allFiles.map(f => {
    const parts = f.split('/');
    return parts.length >= 2 ? parts.slice(0, 2).join('/') : parts[0];
  });
  const uniqueParents = [...new Set(parents)].filter(Boolean);
  if (uniqueParents.length === 1) return uniqueParents[0];

  return undefined;
}

/** Infer gitmoji and type from the kind of changes detected */
function inferTypeAndEmoji(changes: {
  modified: string[]; added: string[]; deleted: string[];
}): { emoji: string; type: string } {
  const { modified, added, deleted } = changes;
  const hasAdded = added.length > 0;
  const hasModified = modified.length > 0;
  const hasDeleted = deleted.length > 0;

  // Only additions → new feature
  if (hasAdded && !hasModified && !hasDeleted) {
    return { emoji: '✨', type: 'feat' };
  }

  // Only deletions → cleanup
  if (hasDeleted && !hasAdded && !hasModified) {
    return { emoji: '🔥', type: 'chore' };
  }

  // Only modifications → could be a fix or refactor
  if (hasModified && !hasAdded && !hasDeleted) {
    return { emoji: '♻️', type: 'refactor' };
  }

  // Additions + anything else → feature
  if (hasAdded) {
    return { emoji: '✨', type: 'feat' };
  }

  // Modifications + deletions → refactor
  if (hasModified && hasDeleted) {
    return { emoji: '♻️', type: 'refactor' };
  }

  // Fallback
  return { emoji: '🔧', type: 'chore' };
}

/** Build a description in imperative mood summarizing the changes */
function buildDescription(changes: {
  modified: string[]; added: string[]; deleted: string[];
}): string {
  const parts: string[] = [];
  if (changes.added.length > 0) {
    const files = changes.added.length <= 3
      ? changes.added.join(', ')
      : `${changes.added.length} files`;
    parts.push(`add ${files}`);
  }
  if (changes.modified.length > 0) {
    const files = changes.modified.length <= 3
      ? changes.modified.join(', ')
      : `${changes.modified.length} files`;
    parts.push(`update ${files}`);
  }
  if (changes.deleted.length > 0) {
    const files = changes.deleted.length <= 3
      ? changes.deleted.join(', ')
      : `${changes.deleted.length} files`;
    parts.push(`remove ${files}`);
  }
  return parts.join(' and ') || 'update codebase';
}

/** Build a fallback commit message following conventional commits + gitmoji spec */
function buildDefaultMessage(changes: {
  modified: string[]; added: string[]; deleted: string[];
}): string {
  const { emoji, type } = inferTypeAndEmoji(changes);
  const scope = inferScope(changes);
  const description = buildDescription(changes);

  const scopePart = scope ? `(${scope})` : '';
  return `${emoji} ${type}${scopePart}: ${description}`;
}

// Function to generate commit message using OpenAI (or fallback)
async function generateCommitMessage(
  summary: string,
  changes: { modified: string[]; added: string[]; deleted: string[] }
): Promise<string> {
  if (!openai) return buildDefaultMessage(changes);

  try {
    const response = await openai.chat.completions.create({
      model: "mimo-v2.5-free",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that generates concise and descriptive git commit messages based on code changes. Follow conventional commits format with gitmoji (https://gitmoji.dev). Start each commit message with the appropriate emoji followed by a colon and space. Common gitmojis: ✨ for new features, 🐛 for bug fixes, 📝 for docs, ♻️ for refactor, 🔧 for config, 🎨 for style, ⚡ for performance, 🔒 for security, 🚀 for deployment, 📦 for dependencies."
        },
        {
          role: "user",
          content: `Generate a concise commit message for these changes:\n${summary}`
        }
      ],
      max_tokens: 100,
      temperature: 0.7,
    });

    return response.choices[0].message.content || buildDefaultMessage(changes);
  } catch (error) {
    console.error("Error generating commit message:", error);
    return buildDefaultMessage(changes);
  }
}

// MCP git-auto-commit server with gitmoji support

// Define the git changes summary tool
server.tool(
  "git-changes-commit-message",
  "Analyzes current git changes and executes a commit with auto-generated message",
  {
    autoCommitPath: z.string().describe("Optional path to analyze specific directory/file"),
  },
  async ({ autoCommitPath }) => {
    try {
      const changes = await getGitChanges(autoCommitPath);
      
      // Create a human-readable summary
      let summary = "Git Changes Summary:\n\n";
      
      if (changes.modified.length > 0) {
        summary += "📝 Modified Files:\n" + changes.modified.map(f => `  - ${f}`).join('\n') + '\n\n';
      }
      
      if (changes.added.length > 0) {
        summary += "✨ New Files:\n" + changes.added.map(f => `  - ${f}`).join('\n') + '\n\n';
      }
      
      if (changes.deleted.length > 0) {
        summary += "🗑️ Deleted Files:\n" + changes.deleted.map(f => `  - ${f}`).join('\n') + '\n\n';
      }

      summary += "📄 Detailed Changes:\n";
      Object.entries(changes.details).forEach(([file, fileChanges]) => {
        if (fileChanges.length > 0) {
          summary += `\n${file}:\n`;
          summary += fileChanges.slice(0, 10).map(line => `  ${line}`).join('\n');
          if (fileChanges.length > 10) {
            summary += '\n  ... and more changes';
          }
        }
      });

      const generatedMessage = await generateCommitMessage(summary, changes);
      const commitMessage = generatedMessage.split('\n').filter(msg => msg.trim().length > 0) || [];
      commitMessage.push(`🤖 auto-commit by: [mcp-server-auto-commit](https://github.com/jatinsandilya/mcp-server-auto-commit)`);

      // Use repo root so git commands work consistently
      const repoRoot = (await execAsync('git rev-parse --show-toplevel', { cwd: process.cwd() })).stdout.trim();
      const stagePath = autoCommitPath ? path.resolve(autoCommitPath) : repoRoot;

      // Run git add and commit via spawn to avoid shell injection
      await runGitCommand('add', stagePath !== repoRoot ? [stagePath] : ['.'], repoRoot);
      const { stdout: commitOutput, stderr: commitError } = await runGitCommand(
        'commit',
        commitMessage.flatMap(msg => ['-m', msg]),
        repoRoot
      );

      return {
        content: [
          {
            type: "text",
            text: `✅ Commit successful:\n\n${generatedMessage}\n\n${commitOutput}${commitError}`,
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `❌ Error: ${error.message}`,
          },
        ],
      };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
