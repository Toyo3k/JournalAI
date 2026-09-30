import { socialLinks } from "@/lib/site";
import type { SocialKind } from "@/lib/site";
import styles from "./brand.module.css";

const ICONS: Record<SocialKind, React.ReactNode> = {
  x: <path d="M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.2-8.3L1.8 3h6.4l4.4 5.8L17.8 3Zm-1.1 16.2h1.7L7.2 4.7H5.4l11.3 14.5Z" fill="currentColor" />,
  telegram: <path d="M21.4 4.2 2.9 11.3c-1.3.5-1.2 1.2-.2 1.5l4.7 1.5 1.8 5.6c.2.6.4.8.9.8.4 0 .6-.2.9-.4l2.3-2.2 4.7 3.5c.9.5 1.5.2 1.7-.8l3.1-14.5c.3-1.3-.5-1.8-1.4-1.5ZM9.6 14.2l8.6-5.4c.4-.3.8-.1.5.2l-7.1 6.4-.3 3.1-1.7-4.3Z" fill="currentColor" />,
  discord: <path d="M19.3 5.3A17 17 0 0 0 15 4l-.5 1a15.7 15.7 0 0 0-5 0L9 4a17 17 0 0 0-4.3 1.3C2 9.4 1.2 13.4 1.6 17.3A17 17 0 0 0 6.9 20l1.1-1.8a11 11 0 0 1-1.7-.8l.4-.3a12.2 12.2 0 0 0 10.6 0l.4.3c-.5.3-1.1.6-1.7.8l1.1 1.8a17 17 0 0 0 5.3-2.7c.5-4.5-.8-8.5-3.1-12ZM8.7 14.9c-1 0-1.9-1-1.9-2.1s.8-2.1 1.9-2.1 1.9 1 1.9 2.1-.8 2.1-1.9 2.1Zm6.6 0c-1 0-1.9-1-1.9-2.1s.8-2.1 1.9-2.1 1.9 1 1.9 2.1-.8 2.1-1.9 2.1Z" fill="currentColor" />,
  github: <path d="M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.3-3.4-1.3-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.4 1.1 2.9.8.1-.7.4-1.1.6-1.3-2.2-.3-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.7 0 0 .8-.3 2.8 1a9.6 9.6 0 0 1 5 0c1.9-1.3 2.8-1 2.8-1 .5 1.4.2 2.4.1 2.7.6.7 1 1.6 1 2.7 0 3.9-2.3 4.7-4.6 5 .4.3.7.9.7 1.9V21c0 .3.2.6.7.5A10 10 0 0 0 12 2Z" fill="currentColor" />,
  website: (
    <path
      d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0 0c2.2-2.3 3.3-5.3 3.3-9S14.2 5.3 12 3m0 18c-2.2-2.3-3.3-5.3-3.3-9S9.8 5.3 12 3M3.5 9h17M3.5 15h17"
      stroke="currentColor"
      strokeWidth="1.6"
      fill="none"
    />
  ),
};

/** The official social accounts as icon links. Renders nothing until some are configured in lib/site.ts. */
export function Socials({ className = "", variant = "boxed" }: { className?: string; variant?: "boxed" | "plain" }) {
  const links = socialLinks();
  if (!links.length) return null;
  return (
    <ul className={`${styles.socials} ${className}`} data-variant={variant} aria-label="NeuroX on social media">
      {links.map((link) => (
        <li key={link.href}>
          <a href={link.href} target="_blank" rel="noopener noreferrer" aria-label={`NeuroX on ${link.label}`} title={link.label}>
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              {ICONS[link.kind]}
            </svg>
          </a>
        </li>
      ))}
    </ul>
  );
}
