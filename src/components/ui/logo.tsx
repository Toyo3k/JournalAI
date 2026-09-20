export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect width="24" height="24" rx="7" fill="var(--accent)" fillOpacity="0.16" />
      <path
        d="M5 16.5 9.5 11l3.2 3.2L19 7.5"
        stroke="var(--accent-strong)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
