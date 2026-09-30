/** Circular 0 to 100 gauge with the blue-to-cyan brand gradient. `id` keeps gradient ids unique per page. */
export function ScoreRing({ id, score, size = 160, stroke = 12, glow = false, caption = "NeuroX score" }: { id: string; score: number; size?: number; stroke?: number; glow?: boolean; caption?: string }) {
  const radius = (size - stroke) / 2 - (glow ? 6 : 0);
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label={`${caption}: ${score} out of 100`}>
      <defs>
        <linearGradient id={`${id}-ring`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--accent)" />
          <stop offset="100%" stopColor="var(--cyan)" />
        </linearGradient>
        {glow ? (
          <filter id={`${id}-glow`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        ) : null}
      </defs>
      <circle cx={center} cy={center} r={radius} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke={`url(#${id}-ring)`}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${(score / 100) * circumference} ${circumference}`}
        transform={`rotate(-90 ${center} ${center})`}
        filter={glow ? `url(#${id}-glow)` : undefined}
      />
      <text x={center} y={center + size * 0.02} textAnchor="middle" dominantBaseline="middle" fill="var(--text)" style={{ font: `600 ${size * 0.3}px var(--font-display)`, letterSpacing: "-0.02em" }}>
        {score}
      </text>
      <text x={center} y={center + size * 0.22} textAnchor="middle" fill="var(--muted)" style={{ font: `500 ${Math.max(10, size * 0.07)}px var(--font-sans)` }}>
        of 100
      </text>
    </svg>
  );
}
