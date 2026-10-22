"use client";

import { useEffect } from "react";

/**
 * Radix portals (Dialog, Sheet, Select, Popover, Tooltip, DropdownMenu) render into
 * `document.body`, outside the `.admin-theme` wrapper that scopes the shadcn tokens and the
 * admin font variable. Mirroring those classes onto <body> while the admin is mounted gives
 * portalled content the same tokens. Removed again on unmount (leaving the admin).
 */
export function AdminBodyTheme({ className }: { className: string }) {
  useEffect(() => {
    const classes = className.split(/\s+/).filter(Boolean);
    document.body.classList.add(...classes);
    return () => document.body.classList.remove(...classes);
  }, [className]);

  return null;
}
