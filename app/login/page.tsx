"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorMsg(error.message);
      setLoading(false);
    } else {
      router.push(nextPath);
      router.refresh();
    }
  };

  return (
    <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      <div>
        <label
          htmlFor="email"
          className="mono uc"
          style={{
            display: "block",
            fontSize: "10px",
            letterSpacing: "0.18em",
            color: "var(--muted)",
            marginBottom: "8px",
          }}
        >
          Email Address
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          style={{
            width: "100%",
            padding: "12px 14px",
            background: "rgba(0, 0, 0, 0.25)",
            border: "1px solid rgba(223, 208, 184, 0.25)",
            borderRadius: "6px",
            color: "#fffaf0",
            fontSize: "14px",
            fontFamily: "var(--font-sans)",
            outline: "none",
            transition: "border-color 0.2s",
          }}
          onFocus={(e) => (e.target.style.borderColor = "var(--blue)")}
          onBlur={(e) => (e.target.style.borderColor = "rgba(223, 208, 184, 0.25)")}
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className="mono uc"
          style={{
            display: "block",
            fontSize: "10px",
            letterSpacing: "0.18em",
            color: "var(--muted)",
            marginBottom: "8px",
          }}
        >
          Password
        </label>
        <input
          id="password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          style={{
            width: "100%",
            padding: "12px 14px",
            background: "rgba(0, 0, 0, 0.25)",
            border: "1px solid rgba(223, 208, 184, 0.25)",
            borderRadius: "6px",
            color: "#fffaf0",
            fontSize: "14px",
            fontFamily: "var(--font-sans)",
            outline: "none",
            transition: "border-color 0.2s",
          }}
          onFocus={(e) => (e.target.style.borderColor = "var(--blue)")}
          onBlur={(e) => (e.target.style.borderColor = "rgba(223, 208, 184, 0.25)")}
        />
      </div>

      {errorMsg && (
        <div
          style={{
            fontSize: "12px",
            color: "#ff8b8b",
            background: "rgba(255, 139, 139, 0.1)",
            padding: "10px 12px",
            borderRadius: "4px",
            border: "1px solid rgba(255, 139, 139, 0.2)",
            lineHeight: "1.4",
          }}
        >
          {errorMsg}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="mono uc"
        style={{
          width: "100%",
          padding: "14px",
          background: "var(--blue)",
          border: "none",
          borderRadius: "6px",
          color: "#fffaf0",
          fontSize: "12px",
          fontWeight: 600,
          letterSpacing: "0.2em",
          cursor: "pointer",
          transition: "opacity 0.2s, transform 0.1s",
          opacity: loading ? 0.6 : 1,
          marginTop: "10px",
        }}
        onMouseEnter={(e) => !loading && (e.currentTarget.style.opacity = "0.9")}
        onMouseLeave={(e) => !loading && (e.currentTarget.style.opacity = "1")}
      >
        {loading ? "Authenticating..." : "Access Control Center"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "radial-gradient(circle at center, #1b1613 0%, #0c0a09 100%)",
        padding: "20px",
        color: "#fffaf0",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          padding: "40px",
          borderRadius: "16px",
          background: "rgba(27, 22, 19, 0.65)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(223, 208, 184, 0.18)",
          boxShadow: "0 20px 40px rgba(0, 0, 0, 0.45)",
          display: "flex",
          flexDirection: "column",
          gap: "24px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "14px", alignSelf: "center" }}>
          <div
            style={{
              width: "26px",
              height: "26px",
              borderRadius: "5px",
              background: "var(--blue)",
              display: "grid",
              placeItems: "center",
              fontFamily: "var(--font-label)",
              fontSize: "13px",
              fontWeight: 700,
              color: "#fffaf0",
            }}
          >
            D
          </div>
          <div
            className="mono uc"
            style={{ fontSize: "14px", letterSpacing: "0.3em", fontWeight: 500 }}
          >
            DASH
          </div>
        </div>

        <div style={{ textAlign: "center", marginBottom: "8px" }}>
          <h1
            style={{
              fontSize: "22px",
              fontWeight: 300,
              marginBottom: "8px",
              letterSpacing: "-0.01em",
            }}
          >
            Welcome Back
          </h1>
          <p style={{ fontSize: "13px", color: "var(--muted)", lineHeight: "1.4" }}>
            Identify yourself to access the operating console.
          </p>
        </div>

        <Suspense fallback={<div className="mono uc" style={{ color: "var(--muted)" }}>Loading...</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
