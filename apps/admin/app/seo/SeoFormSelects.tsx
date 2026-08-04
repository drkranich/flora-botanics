"use client";

import { GlassSelect, type GlassSelectOption } from "@/components/GlassSelect";

// ── Redirect ──────────────────────────────────────────────────────────────────

const REDIRECT_CODE_OPTIONS: GlassSelectOption[] = [
  { value: "301", label: "301 Permanente" },
  { value: "302", label: "302 Temporário" },
  { value: "307", label: "307" },
  { value: "308", label: "308" },
];

export function RedirectCodeSelect() {
  return (
    <GlassSelect
      name="code"
      options={REDIRECT_CODE_OPTIONS}
      defaultValue="301"
    />
  );
}

// ── Robots ────────────────────────────────────────────────────────────────────

const ROBOTS_DIRECTIVE_OPTIONS: GlassSelectOption[] = [
  { value: "disallow", label: "Disallow" },
  { value: "allow", label: "Allow" },
];

export function RobotsDirectiveSelect() {
  return (
    <GlassSelect
      name="directive"
      options={ROBOTS_DIRECTIVE_OPTIONS}
      defaultValue="disallow"
    />
  );
}

// ── Sitemap priority ──────────────────────────────────────────────────────────

const PRIORITY_OPTIONS: GlassSelectOption[] = [
  "1.0","0.9","0.8","0.7","0.6","0.5","0.4","0.3","0.2","0.1",
].map(v => ({ value: v, label: v }));

export function SitemapPrioritySelect({
  name,
  defaultValue = "0.5",
}: {
  name: string;
  defaultValue?: string;
}) {
  return (
    <GlassSelect
      name={name}
      options={PRIORITY_OPTIONS}
      defaultValue={defaultValue}
      style={{ width: 100 }}
    />
  );
}

// ── Sitemap frequency ─────────────────────────────────────────────────────────

const FREQ_OPTIONS: GlassSelectOption[] = [
  "always","hourly","daily","weekly","monthly","yearly","never",
].map(v => ({ value: v, label: v }));

export function SitemapFreqSelect({
  name,
  defaultValue = "weekly",
}: {
  name: string;
  defaultValue?: string;
}) {
  return (
    <GlassSelect
      name={name}
      options={FREQ_OPTIONS}
      defaultValue={defaultValue}
      style={{ width: 130 }}
    />
  );
}
