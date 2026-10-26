"use client";

import { ArrowUpRight, Lock, MonitorSmartphone, RotateCw, Swords } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { scrollToTarget } from "@/components/providers/SmoothScroll";
import { focusElement } from "@/components/ui/focus";
import { Media } from "@/components/ui/Media";
import { useStill } from "@/components/ui/useStill";
import { cn } from "@/lib/utils";
import type { Media as MediaObject } from "@/lib/types";

import { DeviceFrame } from "../DeviceFrame";
import { LockedLink } from "../LockedLink";
import { useBossLock } from "../useBossLock";

type Props = {
  projectId: number;
  bossEnabled: boolean;
  slug: string;
  title: string;
  liveUrl: string;
  allowIframe: boolean;
  /** Screenshot for the idle / locked / fallback screens (cover or first shot). */
  poster: MediaObject | null;
  seed: string;
  accent: string;
  /** Host for the address bar. */
  address: string;
};

type Phase = "idle" | "checking" | "loading" | "ready" | "fallback";
type Reason = "disabled" | "blocked" | "timeout" | "error";
type LiveDevice = "desktop" | "mobile";

/** Spec §6.3: no `load` within 6 s → fallback card. */
const LOAD_TIMEOUT_MS = 6000;
const CHECK_TIMEOUT_MS = 5000;

/** The page is laid out at a real device width, then scaled down into the frame. */
const VIRTUAL: Record<LiveDevice, { width: number; ratio: number }> = {
  desktop: { width: 1280, ratio: 16 / 10 },
  mobile: { width: 390, ratio: 9 / 19.5 },
};

const FALLBACK_TEXT: Record<Reason, (host: string) => { title: string; body: string }> = {
  disabled: () => ({
    title: "Best seen full size",
    body: "This site isn't shown inside another page. Open it in its own tab.",
  }),
  blocked: (host) => ({
    title: "This site stays in its own tab",
    body: `${host} doesn't allow other pages to frame it. Open it directly instead.`,
  }),
  timeout: (host) => ({
    title: "No answer yet",
    body: `${host} took longer than 6 seconds to load here. Try it in its own tab.`,
  }),
  error: () => ({
    title: "The live preview couldn't load",
    body: "Something blocked the frame. The site itself is one click away.",
  }),
};

/** GET /api/frame-check/{slug}: false = the site refuses framing; null = unknown. */
async function frameable(slug: string): Promise<{ frameable: boolean | null; reason?: string }> {
  try {
    const response = await fetch(`/api/frame-check/${encodeURIComponent(slug)}`, {
      signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return { frameable: null };
    const body = (await response.json()) as {
      data?: { frameable?: boolean | null; reason?: string };
    };
    return { frameable: body.data?.frameable ?? null, reason: body.data?.reason };
  } catch {
    return { frameable: null };
  }
}

/**
 * Live tab of the Preview Deck (spec §6.3, §6.4). Locked until the boss is defeated (projects
 * without a boss: always open). Once open, nothing loads until "Load live preview": then the
 * site's framing headers are checked (/api/frame-check — a refused frame still fires `load`,
 * so the event alone can't tell), the iframe goes in sandboxed (scripts + same-origin + forms +
 * popups, no top navigation, no referrer), and if it hasn't loaded after 6 s, errors, or the
 * project has allow_iframe_preview = false, a fallback card offers the screenshot and
 * "Open site ↗" instead.
 *
 * Every state draws inside the same device screen (fixed aspect ratio), so locking, loading
 * and failing never move the page. The lock face and the open face share one grid cell like
 * <LockedLink>, so without JS the open face (with its working link) is what shows.
 */
export function LivePreview({
  projectId,
  bossEnabled,
  slug,
  title,
  liveUrl,
  allowIframe,
  poster,
  seed,
  accent,
  address,
}: Props) {
  const { locked } = useBossLock(projectId, bossEnabled);
  const still = useStill();
  const initial: { phase: Phase; reason: Reason | null } = allowIframe
    ? { phase: "idle", reason: null }
    : { phase: "fallback", reason: "disabled" };
  const [state, setState] = useState(initial);
  const [device, setDevice] = useState<LiveDevice>("desktop");
  const [attempt, setAttempt] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const screen = useRef<HTMLDivElement>(null);
  const loadButton = useRef<HTMLButtonElement>(null);

  // Activity hides this stage when the visitor leaves: unload the site (it would keep running
  // in a hidden frame) and start from the idle screen next time.
  useLayoutEffect(
    () => () =>
      setState(
        allowIframe ? { phase: "idle", reason: null } : { phase: "fallback", reason: "disabled" },
      ),
    [allowIframe],
  );

  const fail = useCallback((reason: Reason) => setState({ phase: "fallback", reason }), []);

  const load = async () => {
    if (!allowIframe) return fail("disabled");
    setDevice(window.matchMedia("(max-width: 767.98px)").matches ? "mobile" : "desktop");
    setState({ phase: "checking", reason: null });
    const check = await frameable(slug);
    if (check.frameable === false)
      return fail(check.reason === "disabled" ? "disabled" : "blocked");
    setAttempt((n) => n + 1);
    setState({ phase: "loading", reason: null });
  };

  // The 6 s budget for the frame's `load`.
  useEffect(() => {
    if (state.phase !== "loading") return;
    const timer = setTimeout(() => fail("timeout"), LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [state.phase, attempt, fail]);

  // Scale the virtual viewport (1280 px desktop / 390 px phone) to the frame's width.
  useLayoutEffect(() => {
    const box = screen.current;
    if (!box) return;
    const apply = () =>
      box.style.setProperty("--live-scale", String(box.clientWidth / VIRTUAL[device].width));
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(box);
    return () => observer.disconnect();
  }, [device]);

  const toArena = () => {
    const stage = root.current?.closest<HTMLElement>("[data-stage]");
    const arena = stage?.querySelector<HTMLElement>("[data-arena]") ?? stage;
    if (!arena) return;
    if (arena.closest("[data-stage-scroller]")) {
      arena.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "start" });
    } else {
      scrollToTarget(arena, { offset: -72 });
    }
    focusElement(arena);
  };

  const framed = state.phase === "loading" || state.phase === "ready";
  const fallback =
    state.phase === "fallback" && state.reason ? FALLBACK_TEXT[state.reason](address) : null;
  const ratio = VIRTUAL[device].ratio;

  const openSite = (className?: string) => (
    <LockedLink
      href={liveUrl}
      icon={ArrowUpRight}
      projectId={projectId}
      bossEnabled={bossEnabled}
      className={className}
    >
      Open site
    </LockedLink>
  );

  const posterArt = (
    <Media
      media={poster}
      alt=""
      seed={`${seed}-live`}
      accent={accent}
      ratio={ratio}
      sizes="(min-width: 1024px) 56rem, 92vw"
      className="absolute inset-0"
      imgClassName="object-top"
    />
  );

  return (
    <div ref={root} className="flex flex-col gap-5" data-live data-phase={state.phase}>
      <div className="flex min-h-11 flex-wrap items-center justify-between gap-3">
        <p className="hk-pixel text-ink-2 flex items-center gap-2 text-xs">
          <span
            aria-hidden="true"
            className={cn("hk-live-led", state.phase === "ready" && "is-on")}
          />
          {locked
            ? "Live preview · locked"
            : state.phase === "ready"
              ? `Live · ${address}`
              : "Live preview"}
        </p>
        {framed && !locked ? (
          <div className="flex flex-wrap items-center gap-2">
            <div role="group" aria-label="Preview size" className="hk-segment">
              {(["desktop", "mobile"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={device === option}
                  className="hk-segment-btn hk-pixel"
                  onClick={() => setDevice(option)}
                >
                  {option === "desktop" ? "Desktop" : "Mobile"}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="hk-btn size-11 p-0"
              aria-label="Reload live preview"
              title="Reload"
              onClick={() => {
                setAttempt((n) => n + 1);
                setState({ phase: "loading", reason: null });
              }}
            >
              <RotateCw aria-hidden="true" className="size-4" strokeWidth={2.5} />
            </button>
          </div>
        ) : null}
      </div>

      <div
        className={cn("mx-auto w-full", device === "mobile" ? "max-w-[19rem]" : "max-w-[56rem]")}
      >
        <DeviceFrame device={device} address={address} className="shadow-[6px_6px_0_var(--accent)]">
          <div ref={screen} className="hk-live-screen" style={{ aspectRatio: String(ratio) }}>
            {/* Open face: idle → checking → loading → ready, or the fallback card. */}
            <div
              data-unlocked-ui={bossEnabled || undefined}
              aria-hidden={locked || undefined}
              className="absolute inset-0"
            >
              {framed ? (
                <iframe
                  key={attempt}
                  src={liveUrl}
                  title={`${title}: live preview of ${address}`}
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                  referrerPolicy="no-referrer"
                  loading="lazy"
                  className={cn("hk-live-frame", state.phase === "ready" && "is-ready")}
                  style={{ width: `${VIRTUAL[device].width}px` }}
                  onLoad={() =>
                    setState((current) =>
                      current.phase === "loading" ? { phase: "ready", reason: null } : current,
                    )
                  }
                  onError={() => fail("error")}
                />
              ) : (
                posterArt
              )}

              {state.phase === "idle" ? (
                <div className="hk-live-overlay">
                  <button
                    ref={loadButton}
                    type="button"
                    className="hk-btn hk-btn-hot text-base"
                    onClick={() => void load()}
                    data-js-only
                  >
                    <MonitorSmartphone aria-hidden="true" className="size-4" />
                    Load live preview
                  </button>
                  <p className="hk-pixel max-w-[30ch] text-center text-[0.6875rem] leading-relaxed">
                    Loads {address} in a sandboxed frame
                  </p>
                  <noscript>{openSite()}</noscript>
                </div>
              ) : null}

              {state.phase === "checking" || state.phase === "loading" ? (
                <div className="hk-live-overlay is-loading" role="status">
                  <span className="hk-live-spinner" aria-hidden="true" />
                  <p className="hk-pixel text-xs">Connecting to {address}…</p>
                </div>
              ) : null}

              {fallback ? (
                <div className="hk-live-overlay is-fallback">
                  <div className="hk-live-card" role="status">
                    <p className="hk-pixel text-hot text-[0.6875rem]">Live preview</p>
                    <p className="hk-display mt-2 text-2xl leading-none md:text-3xl">
                      {fallback.title}
                    </p>
                    <p className="text-ink-2 mt-3 text-sm">{fallback.body}</p>
                    <div className="mt-5 flex flex-wrap items-center gap-3">
                      {openSite("hk-btn-hot")}
                      {state.reason === "timeout" || state.reason === "error" ? (
                        <button type="button" className="hk-btn" onClick={() => void load()}>
                          <RotateCw aria-hidden="true" className="size-4" />
                          Try again
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Lock face (boss projects until the boss falls). */}
            {bossEnabled ? (
              <div data-lock-ui aria-hidden={!locked || undefined} className="absolute inset-0">
                {posterArt}
                <div className="hk-live-overlay is-locked">
                  <span className="hk-live-lock" aria-hidden="true">
                    <Lock className="size-7" strokeWidth={2.5} />
                  </span>
                  <p className="hk-display max-w-[18ch] text-center text-2xl leading-none md:text-3xl">
                    Defeat the boss to unlock the live preview
                  </p>
                  <button type="button" className="hk-btn hk-btn-hot" onClick={toArena}>
                    <Swords aria-hidden="true" className="size-4" />
                    To the Arena
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </DeviceFrame>
      </div>

      {!locked && state.phase === "ready" ? (
        <p className="text-ink-2 flex flex-wrap items-center justify-between gap-3 text-sm">
          <span>Running in a sandbox: the site can&apos;t take over this page.</span>
          {openSite()}
        </p>
      ) : null}
    </div>
  );
}
