import type { SideIcon } from "@/lib/sides";

/**
 * Low-poly wireframe side emblem: a bull head, a bear head, or — for campaigns
 * that aren't bull/bear — a generic hexagon mark with the side's initials.
 * Pure SVG in the side's accent colour. Decorative only — the side name is
 * always rendered as text next to it, so these carry aria-hidden.
 */
export default function Mascot({
  icon,
  color,
  label = "",
  className,
}: {
  icon: SideIcon;
  color: string;
  /** Short name; the generic mark shows its first two letters. */
  label?: string;
  className?: string;
}) {
  // Deterministic id (no hooks, so this also renders in Server Components).
  // Two emblems with the same icon+colour share an identical gradient.
  const fillId = `mascot-fill-${icon}-${color.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <svg
      viewBox="0 0 200 200"
      className={`draw-in ${className ?? ""}`}
      aria-hidden="true"
      fill="none"
      stroke={color}
      strokeWidth={1.4}
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      <defs>
        <radialGradient id={fillId} cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor={color} stopOpacity={0.22} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </radialGradient>
      </defs>
      {icon === "bull" ? (
        <Bull fill={`url(#${fillId})`} />
      ) : icon === "bear" ? (
        <Bear fill={`url(#${fillId})`} color={color} />
      ) : (
        <Mark fill={`url(#${fillId})`} color={color} text={label.slice(0, 2).toUpperCase()} />
      )}
    </svg>
  );
}

function Mark({ fill, color, text }: { fill: string; color: string; text: string }) {
  return (
    <g>
      <polygon points="100,28 162,64 162,136 100,172 38,136 38,64" fill={fill} />
      <polygon points="100,48 145,74 145,126 100,152 55,126 55,74" opacity={0.45} />
      <polyline points="100,28 100,48" opacity={0.5} />
      <polyline points="162,64 145,74" opacity={0.5} />
      <polyline points="162,136 145,126" opacity={0.5} />
      <polyline points="100,172 100,152" opacity={0.5} />
      <polyline points="38,136 55,126" opacity={0.5} />
      <polyline points="38,64 55,74" opacity={0.5} />
      <text
        x="100"
        y="112"
        textAnchor="middle"
        fontFamily="var(--font-terminal)"
        fontSize="34"
        fontWeight="700"
        fill={color}
        stroke="none"
      >
        {text}
      </text>
    </g>
  );
}

function Bull({ fill }: { fill: string }) {
  return (
    <g>
      {/* horns */}
      <path d="M72 76 C46 76 26 62 20 26 C34 52 52 60 76 62" />
      <path d="M128 76 C154 76 174 62 180 26 C166 52 148 60 124 62" />
      {/* ears */}
      <polygon points="64,88 30,98 62,108" />
      <polygon points="136,88 170,98 138,108" />
      {/* head silhouette */}
      <polygon
        points="72,64 100,58 128,64 142,108 124,158 100,174 76,158 58,108"
        fill={fill}
      />
      {/* facets */}
      <polyline points="72,64 100,122 128,64" opacity={0.55} />
      <polyline points="58,108 100,122 142,108" opacity={0.55} />
      <line x1="100" y1="58" x2="100" y2="122" opacity={0.4} />
      <polyline points="76,158 100,122 124,158" opacity={0.4} />
      {/* eyes */}
      <polygon points="76,100 88,104 78,108" />
      <polygon points="124,100 112,104 122,108" />
      {/* muzzle + nostrils */}
      <ellipse cx="100" cy="154" rx="22" ry="14" />
      <circle cx="91" cy="155" r="3" />
      <circle cx="109" cy="155" r="3" />
    </g>
  );
}

function Bear({ fill, color }: { fill: string; color: string }) {
  return (
    <g>
      {/* ears */}
      <circle cx="58" cy="58" r="18" />
      <circle cx="58" cy="58" r="8" opacity={0.55} />
      <circle cx="142" cy="58" r="18" />
      <circle cx="142" cy="58" r="8" opacity={0.55} />
      {/* head silhouette */}
      <polygon
        points="62,68 100,56 138,68 160,108 146,148 100,170 54,148 40,108"
        fill={fill}
      />
      {/* facets */}
      <line x1="100" y1="56" x2="100" y2="118" opacity={0.4} />
      <polyline points="40,108 78,118 100,118 122,118 160,108" opacity={0.55} />
      <polyline points="62,68 78,98 78,118" opacity={0.55} />
      <polyline points="138,68 122,98 122,118" opacity={0.55} />
      <polyline points="54,148 78,118" opacity={0.4} />
      <polyline points="146,148 122,118" opacity={0.4} />
      {/* eyes */}
      <polygon points="76,96 88,92 86,102" />
      <polygon points="124,96 112,92 114,102" />
      {/* muzzle + nose */}
      <polygon points="78,118 122,118 130,144 100,160 70,144" />
      <polygon points="90,124 110,124 100,136" fill={color} />
      <polyline points="100,136 100,146 90,150" opacity={0.6} />
      <polyline points="100,146 110,150" opacity={0.6} />
    </g>
  );
}
