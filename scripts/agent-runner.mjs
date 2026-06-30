#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const ENV_FILE = path.join(ROOT_DIR, ".env.local");
const DEFAULT_AGENT_TIMEOUT_MS = 20 * 60 * 1000;
const CODEX_MODEL = "gpt-5.4-mini";
const ARTIFACT_FILES = {
  md: "idea.md",
  html: "idea.html",
};

function loadEnvFile(content) {
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex === -1) continue;
    const key = trimmed.slice(0, equalsIndex).trim();
    if (!key) continue;
    let value = trimmed.slice(equalsIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

async function loadLocalEnv() {
  try {
    const content = await readFile(ENV_FILE, "utf8");
    loadEnvFile(content);
  } catch {
    // Intentionally optional. The worker can also be started with exported env vars.
  }
}

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY ?? "").trim();
  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function isValidArtifactDir(artifactDir) {
  const normalized = artifactDir.replace(/\\/g, "/");
  return /^agent-artifacts\/[0-9a-f-]{36}\/[0-9a-f-]{36}$/i.test(normalized);
}

function startProcess(command, args, cwd, timeoutMs = DEFAULT_AGENT_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let killTimer = null;
    const timer = setTimeout(() => {
      timedOut = true;
      stderr += `\n[agent-runner] Process timed out after ${timeoutMs}ms`;
      child.kill("SIGTERM");
      killTimer = setTimeout(() => {
        if (!child.killed) child.kill("SIGKILL");
      }, 5000);
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      process.stdout.write(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      process.stderr.write(chunk);
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (killTimer) clearTimeout(killTimer);
      resolve({ code: timedOut ? 124 : code ?? 1, stdout, stderr });
    });
  });
}

async function claimNextRun(client) {
  const { data, error } = await client.rpc("claim_next_agent_run");
  if (error) throw new Error(error.message);
  if (Array.isArray(data)) return data[0] ?? null;
  return data ?? null;
}

async function getTicket(client, ticketId, ownerUserId) {
  const { data, error } = await client
    .from("tickets")
    .select("*")
    .eq("id", ticketId)
    .eq("owner_user_id", ownerUserId)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

async function writeAgentResult(client, run, ticket, result) {
  if (!isValidArtifactDir(run.artifact_dir)) {
    throw new Error("Invalid agent artifact path");
  }

  const artifactDir = path.resolve(ROOT_DIR, run.artifact_dir);
  const mdPath = path.join(artifactDir, ARTIFACT_FILES.md);
  const htmlPath = path.join(artifactDir, ARTIFACT_FILES.html);
  const visibleFiles = (await readdir(artifactDir, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && !entry.name.startsWith("."))
    .map((entry) => entry.name);

  const fileChecks = await Promise.allSettled([stat(mdPath), stat(htmlPath)]);
  const missing = fileChecks
    .map((check, index) => ({ check, name: index === 0 ? ARTIFACT_FILES.md : ARTIFACT_FILES.html }))
    .filter(({ check }) => check.status !== "fulfilled")
    .map(({ name }) => name);
  const extra = visibleFiles.filter((name) => name !== ARTIFACT_FILES.md && name !== ARTIFACT_FILES.html);

  if (result.code !== 0 || missing.length > 0 || extra.length > 0) {
    const message = result.code !== 0
      ? `Agent exited with code ${result.code}`
      : `Missing expected artifact file(s): ${missing.join(", ")}`;
    const detail = extra.length > 0 ? `Unexpected file(s): ${extra.join(", ")}` : "";
    await client.from("agent_runs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: [message, detail, result.stderr || result.stdout || ""].filter(Boolean).join("\n").trim(),
      })
      .eq("id", run.id);
    console.error(`[agent-runner] ${message}`);
    return;
  }

  const [mdContent, htmlContent] = await Promise.all([
    readFile(mdPath, "utf8"),
    readFile(htmlPath, "utf8"),
  ]);

  await client.from("agent_runs")
    .update({
      status: "succeeded",
      completed_at: new Date().toISOString(),
      md_path: path.posix.join(run.artifact_dir, ARTIFACT_FILES.md),
      html_path: path.posix.join(run.artifact_dir, ARTIFACT_FILES.html),
      md_content: mdContent,
      html_content: htmlContent,
      error_message: null,
    })
    .eq("id", run.id);
}

async function processOneRun(client) {
  const run = await claimNextRun(client);
  if (!run) return false;

  const ticket = await getTicket(client, run.ticket_id, run.owner_user_id);
  if (run.owner_user_id !== ticket.owner_user_id) {
    throw new Error("agent run owner mismatch");
  }
  const artifactDir = path.resolve(ROOT_DIR, run.artifact_dir);
  await mkdir(artifactDir, { recursive: true });

  const isClaude = run.agent === "claude";
  const command = isClaude ? "claude" : "codex";
  const args = isClaude
    ? ["--permission-mode", "bypassPermissions", "--print", "--model", "claude-sonnet-4-6", run.generated_prompt]
    : ["exec", "--model", CODEX_MODEL, "--sandbox", "workspace-write", run.generated_prompt];

  const result = await startProcess(command, args, artifactDir, Number(process.env.AGENT_RUNNER_TIMEOUT_MS ?? DEFAULT_AGENT_TIMEOUT_MS));
  await writeAgentResult(client, run, ticket, result);
  return true;
}

async function main() {
  await loadLocalEnv();
  const client = getSupabaseClient();
  const once = process.argv.includes("--once");
  const intervalMs = Number(process.env.AGENT_RUNNER_INTERVAL_MS ?? "10000");

  while (true) {
    try {
      const handled = await processOneRun(client);
      if (once) break;
      if (!handled) {
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
    } catch (error) {
      console.error("[agent-runner]", error instanceof Error ? error.message : error);
      if (once) break;
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }
}

main().catch((error) => {
  console.error("[agent-runner]", error instanceof Error ? error.message : error);
  process.exit(1);
});
