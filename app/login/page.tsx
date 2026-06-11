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
  const [googleLoading, setGoogleLoading] = useState(false);
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

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setErrorMsg("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
      },
    });

    if (error) {
      setErrorMsg(error.message);
      setGoogleLoading(false);
    }
  };

  const isAnyLoading = loading || googleLoading;

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
          disabled={isAnyLoading}
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
            opacity: isAnyLoading ? 0.6 : 1,
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
          disabled={isAnyLoading}
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
            opacity: isAnyLoading ? 0.6 : 1,
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
        disabled={isAnyLoading}
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
          cursor: isAnyLoading ? "not-allowed" : "pointer",
          transition: "opacity 0.2s, transform 0.1s",
          opacity: isAnyLoading ? 0.6 : 1,
          marginTop: "10px",
        }}
        onMouseEnter={(e) => !isAnyLoading && (e.currentTarget.style.opacity = "0.9")}
        onMouseLeave={(e) => !isAnyLoading && (e.currentTarget.style.opacity = "1")}
      >
        {loading ? "Authenticating..." : "Access Control Center"}
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "8px 0" }}>
        <div style={{ flex: 1, height: "1px", background: "rgba(223, 208, 184, 0.12)" }} />
        <span className="mono" style={{ fontSize: "10px", color: "var(--muted)", letterSpacing: "0.15em" }}>OR</span>
        <div style={{ flex: 1, height: "1px", background: "rgba(223, 208, 184, 0.12)" }} />
      </div>

      <button
        type="button"
        disabled={isAnyLoading}
        onClick={handleGoogleLogin}
        className="mono uc"
        style={{
          width: "100%",
          padding: "14px",
          background: "rgba(223, 208, 184, 0.04)",
          border: "1px solid rgba(223, 208, 184, 0.2)",
          borderRadius: "6px",
          color: "#fffaf0",
          fontSize: "12px",
          fontWeight: 600,
          letterSpacing: "0.2em",
          cursor: isAnyLoading ? "not-allowed" : "pointer",
          transition: "background-color 0.2s, border-color 0.2s, opacity 0.2s",
          opacity: isAnyLoading ? 0.6 : 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "10px",
        }}
        onMouseEnter={(e) => !isAnyLoading && (e.currentTarget.style.backgroundColor = "rgba(223, 208, 184, 0.12)")}
        onMouseLeave={(e) => !isAnyLoading && (e.currentTarget.style.backgroundColor = "rgba(223, 208, 184, 0.04)")}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        <span>{googleLoading ? "Redirecting..." : "Access via Google"}</span>
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
