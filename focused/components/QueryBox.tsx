"use client";

import { useState } from "react";
import type { ShortcutQueryDomain, ShortcutResponse } from "@/lib/types";

export function QueryBox({ domain, placeholder, examples }: {
  domain: ShortcutQueryDomain;
  placeholder: string;
  examples: string[];
}) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ShortcutResponse | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const query = input.trim();
    if (!query || loading) return;
    setLoading(true);
    setResult(null);
    try {
      const response = await fetch("/api/shortcut", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: query, query_only: domain }),
      });
      const body = await response.json() as ShortcutResponse & { error?: string };
      setResult(body.message ? body : { ok: false, message: body.error ?? "Query failed." });
    } catch (error) {
      setResult({ ok: false, message: error instanceof Error ? error.message : "Query failed." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel query-box">
      <div className="panel-label blue"><span>Query {domain}</span><span>AI</span></div>
      <form onSubmit={submit}>
        <input value={input} onChange={(event) => setInput(event.target.value)} placeholder={placeholder} aria-label={`Query past ${domain}`} />
        <button type="submit" disabled={loading || !input.trim()}>{loading ? "…" : "Run"}</button>
      </form>
      <div className="query-examples">
        {examples.slice(0, 2).map((example) => <button type="button" key={example} onClick={() => setInput(example)}>{example}</button>)}
      </div>
      {result && <pre className={result.ok ? "query-result" : "query-result error"}>{result.message}</pre>}
    </section>
  );
}
