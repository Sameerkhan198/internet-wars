/**
 * Visual identity for a campaign side, resolved from Team.accentTheme.
 *
 * Side A defaults to BULL (green), side B to BEAR (red). A team can opt into
 * another theme by setting accentTheme to one of the keys below (admin
 * campaign editor). Unknown values — including the legacy "emerald"/"violet"
 * from the original seed — fall back to the slot default, so old rows keep
 * the bull/bear look.
 */
export const SIDE_THEMES = {
  bull: { label: "Bull (green)", color: "#16c784", rgb: "22, 199, 132", icon: "bull" },
  bear: { label: "Bear (red)", color: "#f6465d", rgb: "246, 70, 93", icon: "bear" },
  blue: { label: "Blue", color: "#3b82f6", rgb: "59, 130, 246", icon: "mark" },
  amber: { label: "Amber", color: "#f0b90b", rgb: "240, 185, 11", icon: "mark" },
  cyan: { label: "Cyan", color: "#22d3ee", rgb: "34, 211, 238", icon: "mark" },
  orange: { label: "Orange", color: "#fb923c", rgb: "251, 146, 60", icon: "mark" },
} as const;

export type SideThemeKey = keyof typeof SIDE_THEMES;
export type SideIcon = "bull" | "bear" | "mark";

export type SideVisual = {
  theme: SideThemeKey;
  color: string;
  glow: string;
  dim: string;
  icon: SideIcon;
  /** ▲ for side A, ▼ for side B — a non-colour cue for which side is which. */
  glyph: "▲" | "▼";
};

export function isSideThemeKey(v: unknown): v is SideThemeKey {
  return typeof v === "string" && v in SIDE_THEMES;
}

export function sideVisual(accentTheme: string | null | undefined, slot: "a" | "b"): SideVisual {
  const theme: SideThemeKey = isSideThemeKey(accentTheme) ? accentTheme : slot === "a" ? "bull" : "bear";
  const t = SIDE_THEMES[theme];
  return {
    theme,
    color: t.color,
    glow: `rgba(${t.rgb}, 0.35)`,
    dim: `rgba(${t.rgb}, 0.12)`,
    icon: t.icon,
    glyph: slot === "a" ? "▲" : "▼",
  };
}
