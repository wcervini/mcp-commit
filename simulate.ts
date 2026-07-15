/**
 * Simulación del MCP Server — git-auto-commit
 * Prueba el flujo completo sin usar comandos git reales.
 *
 * Uso: npx tsx simulate.ts
 */

// ─── Mock de cambios git (simula lo que devolvería getGitChanges) ───

const mockChanges = {
  modified: ["src/auth/login.ts", "src/utils/validation.ts"],
  added: ["src/auth/register.ts", "src/types/user.d.ts"],
  deleted: ["src/legacy/old-auth.ts"],
  details: {
    "src/auth/login.ts": [
      "+  const user = await findUser(email);",
      "+  if (!user) throw new AuthError('User not found');",
      "-  const user = db.query('SELECT * FROM users WHERE email = ?', [email]);",
      "+  logger.info('Login attempt', { email });",
    ],
    "src/auth/register.ts": [
      "+  export async function register(email: string, password: string) {",
      "+    const hashed = await bcrypt.hash(password, 12);",
      "+    return db.insert({ email, password: hashed });",
      "+  }",
    ],
    "src/types/user.d.ts": [
      "+  export interface User {",
      "+    id: string;",
      "+    email: string;",
      "+    createdAt: Date;",
      "+  }",
    ],
    "src/legacy/old-auth.ts": [
      "-  function authenticate(user, pass) {",
      "-    return pass === 'admin123';",
      "-  }",
    ],
  },
};

// ─── buildDefaultMessage (copia exacta de index.ts) ───

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

// ─── Construcción del summary (copia exacta del tool handler) ───

function buildSummary(changes: typeof mockChanges): string {
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

  return summary;
}

// ─── Simulación principal ───

function simulate() {
  console.log("╔════════════════════════════════════════════════════╗");
  console.log("║   MCP Server Simulation — git-auto-commit        ║");
  console.log("╚════════════════════════════════════════════════════╝\n");

  // 1. Tool metadata
  console.log("📦 Tool Registration");
  console.log(`   Name:        git-changes-commit-message`);
  console.log(`   Description: Analyzes current git changes and executes a commit with auto-generated message`);
  console.log(`   Parameters:  { autoCommitPath: string (optional) }\n`);

  // 2. Input
  console.log("📥 Input Received");
  console.log(`   { autoCommitPath: undefined } (uses cwd)\n`);

  // 3. Git changes analysis
  console.log("🔍 getGitChanges() — Analyzing changes");
  console.log(`   CWD:          ${process.cwd()}`);
  console.log(`   Git repo:     ✅ Valid (simulated)`);
  console.log(`   Has commits:  ✅ Yes (simulated)`);

  console.log(`\n   📝 Modified (${mockChanges.modified.length}):`);
  mockChanges.modified.forEach(f => console.log(`      • ${f}`));
  console.log(`   ✨ Added (${mockChanges.added.length}):`);
  mockChanges.added.forEach(f => console.log(`      • ${f}`));
  console.log(`   🗑️ Deleted (${mockChanges.deleted.length}):`);
  mockChanges.deleted.forEach(f => console.log(`      • ${f}`));

  // 4. Summary generation
  console.log(`\n📄 Summary generated (${Object.keys(mockChanges.details).length} files with diffs):`);
  const summary = buildSummary(mockChanges);
  console.log(summary.split('\n').map(l => `   ${l}`).join('\n'));

  // 5. Commit message generation (fallback — no API key in sim)
  console.log("\n🤖 generateCommitMessage()");
  const hasApiKey = !!process.env.OPENCODE_API_KEY || !!process.env.OPENAI_API_KEY;
  console.log(`   API Key:      ${hasApiKey ? '✅ Found' : '❌ Not found — using fallback'}`);

  const generatedMessage = buildDefaultMessage(mockChanges);
  console.log(`   Message:      "${generatedMessage}"`);

  // 6. Build final commit message (with signature)
  console.log("\n🔨 Building Final Commit Message");
  const commitMessage = [generatedMessage];
  commitMessage.push(`🤖 auto-commit by: [mcp-server-auto-commit](https://github.com/jatinsandilya/mcp-server-auto-commit)`);
  commitMessage.forEach((msg, i) => console.log(`   ${i === 0 ? '📝' : '🔖'}  "${msg}"`));

  // 7. Git operations (simulated — not actually run)
  console.log("\n⚡ Git Operations (simulated — not executed)");
  console.log(`   $ git rev-parse --show-toplevel`);
  console.log(`   → ${process.cwd()}`);
  console.log(`   $ git add .`);
  console.log(`   → ✅ Staged (simulated)`);
  console.log(`   $ git commit -m "${generatedMessage}" -m "🤖 auto-commit..."`);
  console.log(`   → ✅ Committed (simulated)`);

  // 8. MCP Response
  console.log("\n📤 MCP Response (JSON-RPC)");
  const response = {
    content: [
      {
        type: "text",
        text: `✅ Commit successful:\n\n${generatedMessage}\n\n[created 123abc7] simulated commit\n 4 files changed, 15 insertions(+), 3 deletions(-)`,
      },
    ],
  };
  console.log(JSON.stringify(response, null, 2));

  console.log("\n╔════════════════════════════════════════════════════╗");
  console.log("║   ✅ Simulation completed successfully           ║");
  console.log("╚════════════════════════════════════════════════════╝");
}

simulate();
