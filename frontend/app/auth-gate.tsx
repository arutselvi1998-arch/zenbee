"use client";
import { FormEvent, ReactNode, useEffect, useState } from "react";
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
type Status = {
  required: boolean;
  setup_required: boolean;
  authenticated: boolean;
  username: string | null;
};
export default function AuthGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() {
    try {
      const r = await fetch(`${API}/api/auth/status`, {
        credentials: "include",
      });
      if (!r.ok) throw new Error("Sign-in service unavailable");
      setStatus(await r.json());
    } catch {
      setError("Cannot reach the backend. Start ZENBEE Studio, then retry.");
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      const r = await fetch(
        `${API}/api/auth/${status?.setup_required ? "setup" : "login"}`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "X-Setup-Token": String(data.get("setup_token") || ""),
          },
          body: JSON.stringify({
            username: data.get("username"),
            password: data.get("password"),
          }),
        },
      );
      const result = await r.json();
      if (!r.ok)
        throw new Error(
          typeof result.detail === "string"
            ? result.detail
            : "Check your username and password (at least 12 characters).",
        );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }
  if (status && (!status.required || status.authenticated))
    return (
      <>
        {status.required && (
          <div
            style={{ position: "fixed", right: 20, bottom: 14, zIndex: 1000 }}
          >
            <button
              onClick={async () => {
                await fetch(`${API}/api/auth/logout`, {
                  method: "POST",
                  credentials: "include",
                });
                window.location.reload();
              }}
            >
              Sign out · {status.username}
            </button>
          </div>
        )}
        {children}
      </>
    );
  if (!status)
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#f8f5ff",
          padding: 24,
        }}
      >
        <div role="status">
          <h1>Opening ZENBEE Studio…</h1>
          {error && (
            <>
              <p>{error}</p>
              <button onClick={load}>Retry connection</button>
            </>
          )}
        </div>
      </main>
    );
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#190d35",
        padding: 24,
      }}
    >
      <form
        onSubmit={submit}
        style={{
          display: "grid",
          gap: 18,
          background: "white",
          padding: 36,
          borderRadius: 20,
          width: "min(440px,100%)",
        }}
      >
        <h1>🐝 ZENBEE Studio</h1>
        <h2>{status?.setup_required ? "Create workspace owner" : "Sign in"}</h2>
        {!status ? (
          <button type="button" onClick={load}>
            Retry connection
          </button>
        ) : (
          <>
            <label>
              Username
              <input
                name="username"
                required
                minLength={3}
                maxLength={80}
                autoComplete="username"
                style={{ display: "block", width: "100%", padding: 10 }}
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                required
                minLength={12}
                maxLength={200}
                autoComplete={
                  status.setup_required ? "new-password" : "current-password"
                }
                style={{ display: "block", width: "100%", padding: 10 }}
              />
            </label>
            {status.setup_required && (
              <>
                <p>
                  Use at least 12 characters. Keep this password for future
                  sign-ins.
                </p>
                <label>
                  Server setup token (if configured)
                  <input
                    name="setup_token"
                    type="password"
                    autoComplete="off"
                    style={{ display: "block", width: "100%", padding: 10 }}
                  />
                </label>
              </>
            )}
            <button disabled={busy}>
              {busy
                ? "Please wait…"
                : status.setup_required
                  ? "Create owner & open studio"
                  : "Open studio"}
            </button>
          </>
        )}
        {error && <p role="alert">{error}</p>}
      </form>
    </main>
  );
}
