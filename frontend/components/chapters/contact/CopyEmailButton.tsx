"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";

import { toast } from "@/components/game/toast/toast";
import { cn } from "@/lib/utils";

/** Clipboard API first; the legacy execCommand route covers insecure origins and old browsers. */
async function copyText(text: string): Promise<boolean> {
  try {
    if (window.isSecureContext && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // permission denied / document not focused: try the fallback
  }
  const previous = document.activeElement as HTMLElement | null;
  const area = document.createElement("textarea");
  try {
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.left = "-9999px";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    area.remove();
    previous?.focus({ preventScroll: true }); // selecting moved the focus into the textarea
  }
}

/**
 * "Copy email" next to the big mailto link (spec §4.1 contact): copies the address and confirms
 * with a toast (announced politely) plus a 2 s "Copied" state. Both labels share one grid cell,
 * so the button keeps the width of the longer one (no shift). Hidden without JavaScript (CSS on
 * `html:not([data-lite])`): the mailto link above is the no-JS way.
 */
export function CopyEmailButton({ email, className }: { email: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    if (await copyText(email)) {
      setCopied(true);
      toast("Email copied", { icon: <Check className="size-4" strokeWidth={3} /> });
    } else {
      toast("Couldn't copy. Select the address above instead.");
    }
  };

  return (
    <button type="button" className={cn("hk-btn hk-copy-email", className)} onClick={copy}>
      <span className="grid">
        <span
          className={cn("col-start-1 row-start-1 flex items-center gap-2", copied && "invisible")}
        >
          <Copy aria-hidden="true" className="size-4" />
          Copy email
        </span>
        <span
          className={cn("col-start-1 row-start-1 flex items-center gap-2", !copied && "invisible")}
        >
          <Check aria-hidden="true" className="size-4" strokeWidth={3} />
          Copied
        </span>
      </span>
    </button>
  );
}
