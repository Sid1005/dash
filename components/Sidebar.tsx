"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ListTodo,
  Lightbulb,
  UtensilsCrossed,
  DollarSign,
  BookOpen,
} from "lucide-react";

const nav = [
  { label: "Tasks", href: "/", icon: ListTodo },
  { label: "Today", href: "/today", icon: LayoutDashboard },
  { label: "Ideas", href: "/ideas", icon: Lightbulb },
  { label: "Food", href: "/food", icon: UtensilsCrossed },
  { label: "Spending", href: "/spending", icon: DollarSign },
  { label: "Learnings", href: "/learnings", icon: BookOpen },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="hidden w-60 flex-shrink-0 flex-col border-r pt-5 pb-6 lg:flex"
      style={{ background: "var(--background)", borderColor: "var(--line)" }}
    >
      <div className="px-6 mb-9 flex items-center gap-3">
        <div
          className="grid size-6 place-items-center rounded-[4px] text-[11px] font-medium"
          style={{ background: "var(--blue)", color: "var(--background)", fontFamily: "var(--font-label)" }}
        >
          D
        </div>
        <div>
          <p className="mono uc text-[11px] font-medium" style={{ color: "var(--text)", letterSpacing: "0.28em" }}>
            Dash
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted-ink)" }}>
            Personal OS
          </p>
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-1">
        {nav.map(({ label, href, icon: Icon }) => {
          const active = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 border-b border-dashed px-2 py-3 text-sm transition-colors"
              style={{
                borderColor: "var(--line)",
                color: active ? "var(--text)" : "var(--muted-ink)",
              }}
            >
              <Icon size={16} strokeWidth={1.5} style={{ color: active ? "var(--blue)" : "var(--dim)" }} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="px-6 pt-5 border-t" style={{ borderColor: "var(--line)", color: "var(--muted-ink)" }}>
        <p className="mono uc text-[10px] leading-snug" style={{ letterSpacing: "0.18em" }}>
          Cmd K · log anything
        </p>
      </div>
    </aside>
  );
}
