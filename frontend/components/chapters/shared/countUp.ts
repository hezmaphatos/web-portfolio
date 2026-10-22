import { gsap } from "@/lib/gsap";

/**
 * Stat counters (spec §4.1 About stats, Journey metrics). The server HTML already holds the final
 * value, so without JS — or for screen readers, which read a separate sr-only copy — nothing
 * changes. With motion on, every `[data-counter]` that is still below the fold is reset to 0 and
 * counts up once when it scrolls into view.
 *
 * Returns a cleanup that puts the exact final text back (GSAP's revert only restores styles it
 * set, not text we wrote ourselves).
 */
export function setupCounters(root: Element): () => void {
  const restores: Array<() => void> = [];
  const pending = new Map<Element, () => void>();

  // IntersectionObserver rather than a ScrollTrigger: it also fires after a jump (chapter menu,
  // anchor link) straight past the counter, so a counter can never stay stuck at 0.
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        pending.get(entry.target)?.();
        pending.delete(entry.target);
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: "0px 0px -6% 0px" }, // start once the counter is clearly on screen
  );

  root.querySelectorAll<HTMLElement>("[data-counter]").forEach((el) => {
    const raw = el.dataset.counter ?? "";
    const target = Number(raw);
    if (raw === "" || !Number.isFinite(target)) return;
    // Already on screen (or scrolled past): leave the final value alone, no flash back to 0.
    if (el.getBoundingClientRect().top < window.innerHeight) return;

    const finalText = el.textContent ?? raw;
    const decimals = raw.includes(".") ? raw.split(".")[1].length : 0; // "3.91" counts 0.00 → 3.91
    const format = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      useGrouping: finalText.includes(","),
    });

    // Lock the box to the final width: "0" is narrower than "1,000", and a counter that grows
    // would push its suffix sideways (a layout shift) on every frame.
    const width = el.getBoundingClientRect().width;
    el.style.display = "inline-block";
    el.style.width = `${width}px`;
    el.textContent = format.format(0);

    const proxy = { value: 0 };
    const tween = gsap.to(proxy, {
      value: target,
      duration: 1.4,
      ease: "power3.out",
      paused: true,
      onUpdate: () => {
        el.textContent = format.format(proxy.value);
      },
      onComplete: () => {
        el.textContent = finalText; // the exact string from the server, e.g. "1,000"
      },
    });

    pending.set(el, () => tween.play());
    observer.observe(el);
    restores.push(() => {
      tween.kill();
      el.textContent = finalText;
      el.style.display = "";
      el.style.width = "";
    });
  });

  return () => {
    observer.disconnect();
    restores.forEach((restore) => restore());
  };
}
