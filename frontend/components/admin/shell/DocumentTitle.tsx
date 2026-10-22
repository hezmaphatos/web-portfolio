"use client";

import { useEffect } from "react";

/**
 * Browser tab title for client-rendered admin pages, which can't export `metadata`.
 *
 * Setting `document.title` once is not enough: after a client navigation Next streams the
 * layout's metadata `<title>` into <head> (ahead of the existing one) and `document.title`
 * follows the first `<title>`. So the title is re-applied whenever <head> changes while the
 * page is mounted. Pages that can should still export `metadata` from a server `page.tsx`.
 */
export function DocumentTitle({ title }: { title: string }) {
  useEffect(() => {
    const full = `${title} · Admin · Hackker`;
    const apply = () => {
      if (document.title !== full) document.title = full;
    };
    apply();

    const observer = new MutationObserver(apply);
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [title]);

  return null;
}
