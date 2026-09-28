"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SIDE_THEMES, type SideThemeKey } from "@/lib/sides";
import { istInputToIso, isoToIstInput } from "@/lib/ist";
import Mascot from "@/components/Mascot";

export type CampaignFormValues = {
  title: string;
  description: string;
  startAt: string; // ISO
  endAt: string; // ISO
  minimumRupees: number;
  maximumRupees: number;
  sideA: { name: string; shortName: string; theme: SideThemeKey };
  sideB: { name: string; shortName: string; theme: SideThemeKey };
};

/**
 * mode "create": everything editable, POST /api/admin/campaigns
 * mode "edit":   PATCH /api/admin/campaigns/[id]; when `live`, only the
 *                presentation fields + end time are editable (server enforces).
 */
export default function CampaignForm({
  mode,
  campaignId,
  initial,
  live = false,
}: {
  mode: "create" | "edit";
  campaignId?: string;
  initial: CampaignFormValues;
  live?: boolean;
}) {
  const router = useRouter();
  const [v, setV] = useState(() => ({
    ...initial,
    startLocal: isoToIstInput(initial.startAt),
    endLocal: isoToIstInput(initial.endAt),
  }));
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof typeof v>(k: K, value: (typeof v)[K]) => {
    setSaved(false);
    setV((p) => ({ ...p, [k]: value }));
  };
  const setSide = (side: "sideA" | "sideB", patch: Partial<CampaignFormValues["sideA"]>) => {
    setSaved(false);
    setV((p) => ({ ...p, [side]: { ...p[side], ...patch } }));
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const body = {
      title: v.title,
      description: v.description,
      startAt: istInputToIso(v.startLocal),
      endAt: istInputToIso(v.endLocal),
      minimumRupees: v.minimumRupees,
      maximumRupees: v.maximumRupees,
      sideA: v.sideA,
      sideB: v.sideB,
    };
    try {
      const res = await fetch(mode === "create" ? "/api/admin/campaigns" : `/api/admin/campaigns/${campaignId}`, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Couldn't save.");
        return;
      }
      if (mode === "create") {
        router.push(`/admin/campaigns/${data.id}`);
      } else {
        setSaved(true);
        router.refresh();
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      {live && (
        <p className="rounded border border-signal/30 bg-signal/10 px-3 py-2 text-xs text-signal">
          This battle is running. Only the title, description, side names, colours and end time can change. Contributions
          and totals are never edited.
        </p>
      )}

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="label mb-3">Battle</legend>
        <Field id="c-title" label="Title" className="sm:col-span-2">
          <input id="c-title" value={v.title} onChange={(e) => set("title", e.target.value)} className={input} required maxLength={120} />
        </Field>
        <Field id="c-desc" label="Description" className="sm:col-span-2">
          <textarea id="c-desc" value={v.description} onChange={(e) => set("description", e.target.value)} className={`${input} min-h-20`} maxLength={1000} />
        </Field>
        <Field id="c-start" label="Starts (IST)">
          <input id="c-start" type="datetime-local" value={v.startLocal} onChange={(e) => set("startLocal", e.target.value)} className={input} disabled={live} required />
        </Field>
        <Field id="c-end" label="Ends (IST)">
          <input id="c-end" type="datetime-local" value={v.endLocal} onChange={(e) => set("endLocal", e.target.value)} className={input} required />
        </Field>
        <Field id="c-min" label="Minimum support (₹)">
          <input id="c-min" type="number" min={1} step={1} value={v.minimumRupees} onChange={(e) => set("minimumRupees", Number(e.target.value))} className={input} disabled={live} />
        </Field>
        <Field id="c-max" label="Maximum support (₹)">
          <input id="c-max" type="number" min={1} step={1} value={v.maximumRupees} onChange={(e) => set("maximumRupees", Number(e.target.value))} className={input} disabled={live} />
        </Field>
      </fieldset>

      <div className="grid gap-4 md:grid-cols-2">
        <SideFields title="Side A (left, ▲)" side={v.sideA} live={live} onChange={(p) => setSide("sideA", p)} idPrefix="a" />
        <SideFields title="Side B (right, ▼)" side={v.sideB} live={live} onChange={(p) => setSide("sideB", p)} idPrefix="b" />
      </div>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="text-sm text-bull">
          Saved.
        </p>
      )}

      <button type="submit" disabled={busy} className="min-h-11 px-5 rounded font-mono text-sm font-bold uppercase tracking-wider bg-foreground text-background disabled:opacity-40">
        {busy ? "Saving…" : mode === "create" ? "Create draft" : "Save changes"}
      </button>
    </form>
  );
}

function SideFields({
  title,
  side,
  live,
  onChange,
  idPrefix,
}: {
  title: string;
  side: CampaignFormValues["sideA"];
  live: boolean;
  onChange: (p: Partial<CampaignFormValues["sideA"]>) => void;
  idPrefix: string;
}) {
  const t = SIDE_THEMES[side.theme];
  return (
    <fieldset className="panel p-4 space-y-3">
      <legend className="sr-only">{title}</legend>
      <div className="flex items-center gap-3">
        <Mascot icon={t.icon} color={t.color} label={side.shortName} className="h-12 w-12 shrink-0" />
        <div className="label" style={{ color: t.color }}>
          {title}
        </div>
      </div>
      <Field id={`${idPrefix}-name`} label="Name">
        <input id={`${idPrefix}-name`} value={side.name} onChange={(e) => onChange({ name: e.target.value })} className={input} maxLength={60} required />
      </Field>
      <Field id={`${idPrefix}-short`} label="Short name (shown on buttons, max 12)">
        <input id={`${idPrefix}-short`} value={side.shortName} onChange={(e) => onChange({ shortName: e.target.value.toUpperCase() })} className={input} maxLength={12} disabled={live} required />
      </Field>
      <Field id={`${idPrefix}-theme`} label="Colour / emblem">
        <select id={`${idPrefix}-theme`} value={side.theme} onChange={(e) => onChange({ theme: e.target.value as SideThemeKey })} className={input}>
          {(Object.keys(SIDE_THEMES) as SideThemeKey[]).map((k) => (
            <option key={k} value={k}>
              {SIDE_THEMES[k].label}
              {SIDE_THEMES[k].icon === "mark" ? " — generic emblem" : ""}
            </option>
          ))}
        </select>
      </Field>
    </fieldset>
  );
}

const input =
  "w-full rounded border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/50 disabled:opacity-50";

function Field({ id, label, className, children }: { id: string; label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="label block mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}
