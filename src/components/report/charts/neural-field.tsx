import styles from "./charts.module.css";

// Fixed, deterministic points so the server and client render identically.
const NODES = [
  [80, 60], [210, 140], [330, 50], [460, 170], [560, 80], [700, 150], [820, 60], [950, 170], [1080, 90], [1150, 220],
  [140, 260], [300, 300], [520, 280], [660, 330], [880, 300], [1020, 350], [400, 390], [760, 400],
];
const LINKS = [
  [0, 1], [1, 2], [1, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [1, 10], [10, 11], [11, 3],
  [11, 12], [12, 13], [13, 5], [13, 14], [14, 7], [14, 15], [15, 9], [12, 16], [16, 11], [13, 17], [17, 14],
];

/** The connected-nodes motif from the NeuroX logo, as a decorative background layer. */
export function NeuralField({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 1200 420" className={`${styles.field} ${className}`} aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      {LINKS.map(([a, b], i) => (
        <line key={i} x1={NODES[a][0]} y1={NODES[a][1]} x2={NODES[b][0]} y2={NODES[b][1]} stroke="var(--accent-strong)" strokeOpacity="0.14" strokeWidth="1" />
      ))}
      {NODES.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={i % 4 === 0 ? 3.5 : 2.2} fill="var(--cyan)" fillOpacity={i % 4 === 0 ? 0.7 : 0.35} />
      ))}
    </svg>
  );
}
