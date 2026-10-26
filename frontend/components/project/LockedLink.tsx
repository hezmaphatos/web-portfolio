import type { LucideIcon } from "lucide-react";

import { LockedLinkView } from "./LockedLinkView";

type Props = {
  href: string;
  projectId: number;
  bossEnabled: boolean;
  icon: LucideIcon;
  children: string;
  className?: string;
};

/**
 * An external project link (Open site / Repo) that stays locked until the boss is defeated
 * (spec §6.4). Both faces share one grid cell, so locking/unlocking never changes the button's
 * size. Without JS the <noscript> rule in the site layout shows the real link.
 *
 * No "use client" on purpose: Server Components (the Project Stage) pass `icon` as a component,
 * and a function can't cross into a Client Component — so the icon is rendered here, as an
 * element, and the lock itself lives in the client half (LockedLinkView). Imported from a client
 * module this simply becomes client code too.
 */
export function LockedLink({ icon: Icon, ...props }: Props) {
  return <LockedLinkView {...props} icon={<Icon aria-hidden="true" className="size-4" />} />;
}
