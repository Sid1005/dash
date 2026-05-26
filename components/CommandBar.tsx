"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Loader2, CheckCircle, AlertCircle } from "lucide-react";

type Status = "idle" | "loading" | "success" | "error";

export default function CommandBar() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback(async () => {
    if (!input.trim()) return;
    setStatus("loading");
    setMessage("");
    try {
      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: input.trim() }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setMessage(data.message);
      setStatus("success");
      setInput("");
      setTimeout(() => {
        setStatus("idle");
        setMessage("");
        setOpen(false);
      }, 2500);
    } catch (e) {
      setMessage(String(e));
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  }, [input]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  return (
    <div
      className="border-b px-4 py-4 sm:px-10 lg:px-12 flex items-center gap-4"
      style={{ background: "var(--background)", borderColor: "var(--line)" }}
    >
      <div className="flex items-center gap-3 lg:hidden">
        <div className="grid size-6 place-items-center rounded-[4px] mono text-[11px]" style={{ background: "var(--blue)", color: "var(--background)" }}>
          D
        </div>
        <span className="mono uc text-[11px]" style={{ color: "var(--text)", letterSpacing: "0.28em" }}>Dash</span>
      </div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-3 text-sm px-3 py-2 border transition-colors flex-1 max-w-2xl text-left"
        style={{
          background: open ? "var(--muted)" : "transparent",
          borderColor: "var(--line)",
          color: "var(--text)",
        }}
      >
        <Search size={16} strokeWidth={1.5} className="shrink-0" style={{ color: "var(--dim)" }} />
        <span className="truncate">Log anything…</span>
        <kbd
          className="mono ml-auto shrink-0 px-2 py-1 text-[10px] tabular-nums"
          style={{ background: "var(--muted)", color: "var(--muted-ink)", border: "1px solid var(--line)" }}
        >
          ⌘K
        </kbd>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[min(20vh,8rem)] px-4" style={{ background: "rgba(23,20,17,0.28)" }}>
          <div
            className="w-full max-w-2xl border shadow-2xl overflow-hidden"
            style={{ background: "var(--background)", borderColor: "var(--line-strong)" }}
          >
            <div className="flex items-center gap-3 px-5 py-4 border-b" style={{ borderColor: "var(--line)" }}>
              {status === "loading" ? (
                <Loader2 size={20} className="animate-spin shrink-0" style={{ color: "var(--blue)" }} />
              ) : status === "success" ? (
                <CheckCircle size={20} className="shrink-0" style={{ color: "var(--blue)" }} />
              ) : status === "error" ? (
                <AlertCircle size={20} className="shrink-0" style={{ color: "var(--rose)" }} />
              ) : (
                <Search size={20} strokeWidth={1.5} className="shrink-0" style={{ color: "var(--dim)" }} />
              )}
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSubmit();
                  if (e.key === "Escape") setOpen(false);
                }}
                placeholder="ate chicken rice $8 lunch · 9-915 email · learned that…"
                className="flex-1 min-w-0 bg-transparent outline-none text-lg placeholder:text-muted-foreground"
                style={{ color: "var(--text)" }}
                disabled={status === "loading"}
              />
            </div>

            {message && (
              <div className="px-5 py-3 text-base leading-relaxed" style={{ color: status === "error" ? "var(--rose)" : "var(--blue)" }}>
                {message}
              </div>
            )}

            {!message && (
              <div className="px-5 py-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm" style={{ color: "var(--muted-ink)" }}>
                  {[
                    "ate oatmeal 350 cal breakfast",
                    "chicken rice $8 lunch",
                    "9-915 email triage",
                    "spent $50 groceries",
                    "learned: X works by Y",
                    "goal: launch by June",
                  ].map((ex) => (
                    <button
                      type="button"
                      key={ex}
                      onClick={() => setInput(ex)}
                      className="text-left px-3 py-2.5 text-foreground transition-colors truncate"
                      style={{ background: "var(--muted)", color: "var(--text)" }}
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
