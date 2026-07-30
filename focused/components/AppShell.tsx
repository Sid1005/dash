"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV = [
  { href: "/spending", label: "Spending", glyph: "₹" },
  { href: "/tasks", label: "Tasks", glyph: "✓" },
  { href: "/workouts", label: "Workouts", glyph: "↗" },
];

function indiaTime() {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date());
}

function indiaDate() {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
  }).format(new Date());
}

export function AppShell({ children, title }: {
  children: React.ReactNode;
  title: string;
}) {
  const pathname = usePathname();
  const [time, setTime] = useState("--:--");
  const [date, setDate] = useState("-- / --");

  useEffect(() => {
    setTime(indiaTime());
    setDate(indiaDate());
    const timer = window.setInterval(() => {
      setTime(indiaTime());
      setDate(indiaDate());
    }, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="app-shell">
      <header className="ledger-nav">
        <Link href="/spending" className="ledger-brand" aria-label="Dash home">
          <span>D</span>
        </Link>
        <nav className="ledger-navigation" aria-label="Primary navigation">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={pathname === item.href ? "ledger-nav-item active" : "ledger-nav-item"}
              aria-current={pathname === item.href ? "page" : undefined}
            >
              <span aria-hidden="true">{item.glyph}</span>
              <b>{item.label}</b>
            </Link>
          ))}
        </nav>
        <div className="ledger-status">
          <span>{title}</span>
          <span>{date}</span>
          <b>{time}</b>
          <span className="sync-state"><i aria-hidden="true" />synced</span>
        </div>
      </header>
      <div className="ledger-surface">
        <main className="page-shell" aria-label={title}>{children}</main>
      </div>
    </div>
  );
}
