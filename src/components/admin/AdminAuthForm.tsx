"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminAuthForm({ mode, minPasswordLength }: { mode: "login" | "setup"; minPasswordLength: number }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [setupSecret, setSetupSecret] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const setup = mode === "setup";
  const mismatch = setup && confirm.length > 0 && confirm !== password;
  const canSubmit =
    !loading && email && password && (!setup || (setupSecret && confirm === password && password.length >= minPasswordLength));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(setup ? "/api/admin/setup" : "/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(setup ? { email, setupSecret, newPassword: password } : { email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Sign-in failed.");
        setLoading(false);
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <Field id="admin-email" label="Email">
        <input id="admin-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} required autoFocus />
      </Field>

      {setup && (
        <Field id="admin-secret" label="Setup secret" hint="The deployment's existing admin setup secret. It is not stored.">
          <input id="admin-secret" type="password" autoComplete="off" value={setupSecret} onChange={(e) => setSetupSecret(e.target.value)} className={inputCls} required />
        </Field>
      )}

      <Field id="admin-password" label={setup ? "New password" : "Password"} hint={setup ? `At least ${minPasswordLength} characters.` : undefined}>
        <input
          id="admin-password"
          type="password"
          autoComplete={setup ? "new-password" : "current-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputCls}
          required
          minLength={setup ? minPasswordLength : undefined}
        />
      </Field>

      {setup && (
        <Field id="admin-confirm" label="Confirm new password">
          <input id="admin-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputCls} aria-invalid={mismatch || undefined} aria-describedby={mismatch ? "admin-confirm-err" : undefined} required />
          {mismatch && <p id="admin-confirm-err" className="mt-1 text-xs text-danger">Passwords don&apos;t match.</p>}
        </Field>
      )}

      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full min-h-11 rounded font-mono text-sm font-bold uppercase tracking-wider bg-foreground text-background disabled:opacity-30"
      >
        {loading ? "Please wait…" : setup ? "Create admin account" : "Sign in"}
      </button>
    </form>
  );
}

const inputCls =
  "w-full rounded border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-foreground/50";

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="label block mb-1.5">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-muted">{hint}</p>}
    </div>
  );
}
