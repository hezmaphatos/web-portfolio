import {
  BriefcaseBusiness,
  FolderKanban,
  IdCard,
  Images,
  Inbox,
  KeyRound,
  LayoutDashboard,
  PanelsTopLeft,
  Trophy,
  Zap,
  type LucideIcon,
} from "lucide-react";

export type AdminNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Shows the unread-messages count next to the label. */
  unreadBadge?: boolean;
};

/** Sidebar order = spec §7 menu order. */
export const ADMIN_NAV: readonly AdminNavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/site", label: "Profile & Site", icon: IdCard },
  { href: "/admin/sections", label: "Sections", icon: PanelsTopLeft },
  { href: "/admin/experiences", label: "Experiences", icon: BriefcaseBusiness },
  { href: "/admin/skills", label: "Skills", icon: Zap },
  { href: "/admin/projects", label: "Projects", icon: FolderKanban },
  { href: "/admin/awards", label: "Awards", icon: Trophy },
  { href: "/admin/messages", label: "Messages", icon: Inbox, unreadBadge: true },
  { href: "/admin/media", label: "Media Library", icon: Images },
  { href: "/admin/account", label: "Account", icon: KeyRound },
];

/** The nav item a pathname belongs to: exact match for /admin, prefix match for the rest. */
export function findNavItem(pathname: string): AdminNavItem | undefined {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  let match: AdminNavItem | undefined;
  for (const item of ADMIN_NAV) {
    const hit =
      item.href === "/admin"
        ? path === "/admin"
        : path === item.href || path.startsWith(`${item.href}/`);
    if (hit && (!match || item.href.length > match.href.length)) match = item;
  }
  return match;
}
