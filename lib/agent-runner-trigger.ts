import { spawn } from "node:child_process";
import path from "node:path";

export function triggerAgentRunnerOnce() {
  if (process.env.DASH_AGENT_AUTORUN === "false") return;
  if (process.env.VERCEL) return;

  const child = spawn(process.execPath, [path.join(process.cwd(), "scripts", "agent-runner.mjs"), "--once"], {
    cwd: process.cwd(),
    detached: true,
    stdio: "ignore",
    env: process.env,
  });

  child.unref();
}
