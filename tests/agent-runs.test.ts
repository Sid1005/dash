import { describe, expect, it } from "vitest";
import { agentRunArtifactDir, agentRunArtifactPath, agentRunArtifactUrls, buildAgentPrompt } from "../lib/agent-runs";

describe("agent run helpers", () => {
  it("builds a prompt that constrains output to the two artifact files", () => {
    const prompt = buildAgentPrompt(
      {
        id: "ticket-1",
        title: "Build my personal website",
        source_text: "@Codex build a personal website. Use black and blue.",
        subtasks: ["homepage", "about", "projects", "writing", "contact"],
        agent: "codex",
      },
      "agent-artifacts/ticket-1/run-1",
    );

    expect(prompt).toContain("Do not edit any existing Dash code");
    expect(prompt).toContain("idea.md");
    expect(prompt).toContain("idea.html");
    expect(prompt).toContain("personal website");
    expect(prompt).toContain("homepage, about section, projects, writing, and contact area");
    expect(prompt).toContain("Do not include sections like 'Setup Needed'");
    expect(prompt).toContain("If the user asks for a website saying a phrase, the HTML should primarily show that phrase");
  });

  it("creates stable artifact links for the two served files", () => {
    expect(agentRunArtifactDir("ticket-1", "run-1")).toBe("agent-artifacts/ticket-1/run-1");
    expect(agentRunArtifactUrls("run-1")).toEqual({
      md: "/api/agent-runs/run-1/artifact?kind=md",
      html: "/api/agent-runs/run-1/artifact?kind=html",
    });
  });

  it("rejects invalid artifact directories", () => {
    expect(() => agentRunArtifactPath("../escape", "md")).toThrow("Invalid agent artifact path");
    expect(() => agentRunArtifactPath("agent-artifacts/ticket-1/../../escape", "html")).toThrow("Invalid agent artifact path");
  });
});
