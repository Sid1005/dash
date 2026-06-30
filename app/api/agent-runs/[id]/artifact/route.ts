import { readFile } from "node:fs/promises";
import { NextRequest, NextResponse } from "next/server";
import { agentRunArtifactPath, loadAgentRun } from "@/lib/agent-runs";
import { getUserScopedDb, isUnauthorizedError } from "@/lib/owner-scope";

type ArtifactKind = "md" | "html";

function parseKind(value: string | null): ArtifactKind {
  return value === "html" ? "html" : "md";
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const kind = parseKind(req.nextUrl.searchParams.get("kind"));
    const scope = await getUserScopedDb();
    const run = await loadAgentRun(scope, id);
    const filePath = agentRunArtifactPath(run.artifact_dir, kind);
    const body = await readFile(filePath, "utf8");
    const filename = kind === "html" ? "idea.html" : "idea.md";
    const contentType = kind === "html"
      ? "text/html; charset=utf-8"
      : "text/markdown; charset=utf-8";

    return new Response(body, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${filename}"`,
      },
    });
  } catch (error) {
    const status = isUnauthorizedError(error)
      ? 401
      : error instanceof Error && (error.message === "Invalid agent artifact path" || error.message.includes("ENOENT"))
        ? 404
        : 500;
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status });
  }
}
