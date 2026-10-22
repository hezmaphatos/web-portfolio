import { ArrowUpRight } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Social } from "@/lib/types";

/** Social links as hard-edged tags (label + ↗). Brand logos are not used. */
export function SocialLinks({ socials, className }: { socials: Social[]; className?: string }) {
  if (socials.length === 0) return null;
  return (
    <ul className={cn("flex flex-wrap gap-3", className)}>
      {socials.map((social) => (
        <li key={social.url}>
          <a
            href={social.url}
            target="_blank"
            rel="noopener noreferrer me"
            className="hk-btn text-sm"
          >
            {social.label}
            <ArrowUpRight aria-hidden="true" className="size-4" />
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
