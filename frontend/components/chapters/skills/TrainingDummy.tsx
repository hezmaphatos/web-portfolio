"use client";

import { useEffect, useRef, useState } from "react";

import { useMotionGate } from "@/components/chapters/shared/motion";
import { completeStageHint } from "@/components/game/useStageHint";
import {
  LOADOUT_SIZE,
  TRAINING_DUMMY_HP,
  autoFireStep,
  battleElapsed,
  cooldownProgress,
  createBattle,
  fire,
  formatClearTime,
  nextReadyAt,
  readySlots,
  resetBattle,
  type BattleState,
  type GameSkill,
  type Hit,
} from "@/lib/battle";
import { gsap, MEDIA, useGSAP } from "@/lib/gsap";
import { cn } from "@/lib/utils";

import { DummySprite } from "./DummySprite";

type Props = {
  /** The loadout on screen (slot order). The parent remounts this panel when it changes. */
  loadout: readonly GameSkill[];
  /** Auto-fire lives in the parent so it survives a loadout change (remount). */
  auto: boolean;
  onAutoChange: (auto: boolean) => void;
  className?: string;
};

/** Pause on 0 HP before the dummy stands up again (spec §4.1 "reset otomatis"). */
const KO_RESET_MS = 1500;
/** Horizontal start offsets of the floating damage numbers, per slot (px from the centre). */
const FLOAT_X = [-46, 34, -14, 52];

type Engine = { fire: (slot: number) => void; toggleAuto: () => void };

/** Keys typed into a field, or meant for a dialog/menu, never reach the dummy. */
function ignoresKeys(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.closest("input, textarea, select, dialog, [role='dialog'], [role='menu']") !== null
  );
}

/**
 * The Training Dummy (spec §4.1 skills: HP 100, resets by itself, unlocks nothing), a practice
 * round of the §6.4 fight. Every number comes from lib/battle: createBattle (all slots start
 * charging) → fire / autoFireStep → resetBattle; this component only draws them.
 * - Starts when the panel is half in view; leaving the view cancels the round (fresh HP next time).
 * - Fire a ready slot by clicking it or with keys 1–4; A toggles Auto-fire. The keys only act
 *   while the panel is half in view or holds focus, and never while typing in a field.
 * - Auto-fire shoots at the exact ready times of the engine (not at frame times), so with the
 *   default loadout the dummy falls at exactly the "Dummy clear time" shown above (3.5 s).
 * - Each hit: floating "-70" + attack name, a shake and a blink (transform/opacity only), the HP
 *   bar tweens, and the live region says "Eloquent Slam hits for 70. Dummy HP 30 of 100.".
 *   Lite / reduced motion: HP updates instantly, no floating numbers or shakes.
 * - 0 HP: "KO!" with the clear time, then a fresh round 1.5 s later.
 */
export function TrainingDummy({ loadout, auto, onAutoChange, className }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const engine = useRef<Engine | null>(null);
  const { lite } = useMotionGate();

  const [hp, setHp] = useState(TRAINING_DUMMY_HP);
  const [readyMask, setReadyMask] = useState(0); // bit i = slot i can fire
  const [live, setLive] = useState(false); // a round is running
  const [koTime, setKoTime] = useState<number | null>(null);
  const [log, setLog] = useState("");

  // Latest props/prefs for the engine's callbacks (it is created once per mount).
  const latest = useRef({ auto, onAutoChange, lite });
  const autoSince = useRef(0);
  useEffect(() => {
    if (auto && !latest.current.auto) autoSince.current = performance.now();
    latest.current = { auto, onAutoChange, lite };
  });

  useGSAP(
    (_context, contextSafe) => {
      const el = root.current;
      if (!el || !contextSafe) return;
      const q = <T extends Element>(selector: string) => el.querySelector<T>(selector);
      const sprite = q<HTMLElement>("[data-dummy-sprite]");
      const fx = q<HTMLElement>("[data-dummy-fx]");
      const hpFill = q<HTMLElement>("[data-hp-fill]");
      const stamp = q<HTMLElement>("[data-dummy-stamp]");
      const bars = Array.from(el.querySelectorAll<HTMLElement>("[data-cd-bar]"));
      const buttons = Array.from(el.querySelectorAll<HTMLElement>("[data-fire]"));

      let battle: BattleState | null = null;
      let mask = 0;
      const progress = bars.map(() => -1);
      let koTimer: ReturnType<typeof setTimeout> | undefined;
      let running = false;
      let halfInView = false;

      const still = () => latest.current.lite || window.matchMedia(MEDIA.reduce).matches;

      const drawBars = (state: BattleState | null, now: number) => {
        bars.forEach((bar, i) => {
          const p = state ? Math.round(cooldownProgress(state, i, now) * 1000) / 1000 : 1;
          if (p === progress[i]) return;
          progress[i] = p;
          bar.style.transform = `scaleX(${p})`;
        });
        let next = 0;
        if (state) for (const i of readySlots(state, now)) next |= 1 << i;
        if (next !== mask) {
          mask = next;
          setReadyMask(next);
        }
      };

      // ── Effects (made in callbacks → contextSafe, reverted on unmount) ──
      const hitFx = contextSafe((hits: readonly Hit[], state: BattleState) => {
        const ratio = state.maxHp > 0 ? state.hp / state.maxHp : 0;
        if (still()) {
          gsap.set(hpFill, { scaleX: ratio });
          return;
        }
        gsap.to(hpFill, { scaleX: ratio, duration: 0.35, ease: "power2.out", overwrite: true });
        gsap.fromTo(
          sprite,
          { x: -8 },
          { x: 0, duration: 0.5, ease: "elastic.out(1.2, 0.3)", overwrite: "auto" },
        );
        gsap.fromTo(sprite, { opacity: 0.35 }, { opacity: 1, duration: 0.24, ease: "steps(3)" });
        hits.forEach((hit, i) => {
          if (!fx) return;
          const node = document.createElement("span");
          node.className = "hk-dmg";
          const amount = document.createElement("span");
          amount.className = "hk-dmg-amount";
          amount.textContent = `-${hit.damage}`;
          const name = document.createElement("span");
          name.className = "hk-dmg-name";
          name.textContent = hit.attackName;
          node.append(amount, name);
          fx.appendChild(node);
          const delay = i * 0.08;
          gsap.fromTo(
            node,
            { x: FLOAT_X[hit.slot % FLOAT_X.length], y: 0, scale: 1.45, opacity: 1 },
            { y: -58, scale: 1, duration: 0.9, delay, ease: "power2.out" },
          );
          gsap.to(node, {
            opacity: 0,
            duration: 0.3,
            delay: delay + 0.62,
            onComplete: () => node.remove(),
          });
        });
      });

      const koFx = contextSafe(() => {
        if (still()) return;
        gsap.fromTo(
          stamp,
          { scale: 1.9, rotation: -20 },
          { scale: 1, rotation: -8, duration: 0.35, ease: "back.out(2.6)" },
        );
      });

      const standUpFx = contextSafe(() => {
        if (still()) {
          gsap.set(hpFill, { scaleX: 1 });
          return;
        }
        gsap.to(hpFill, { scaleX: 1, duration: 0.5, ease: "power2.inOut", overwrite: true });
      });

      const nudgeFx = contextSafe((slot: number) => {
        const button = buttons[slot];
        if (!button || still()) return;
        gsap.fromTo(button, { x: -4 }, { x: 0, duration: 0.35, ease: "elastic.out(1.4, 0.3)" });
      });

      // ── Engine ──────────────────────────────────────────────────────────
      const start = (now: number) => {
        clearTimeout(koTimer);
        battle = createBattle(loadout, TRAINING_DUMMY_HP, now);
        setLive(true);
        setHp(battle.hp);
        setKoTime(null);
        gsap.set(hpFill, { scaleX: 1 });
        drawBars(battle, now);
      };

      const stop = () => {
        clearTimeout(koTimer);
        battle = null;
        setLive(false);
        setHp(TRAINING_DUMMY_HP);
        setKoTime(null);
        gsap.set(hpFill, { scaleX: 1 });
        drawBars(null, 0);
      };

      const land = (state: BattleState, hits: readonly Hit[], now: number) => {
        battle = state;
        setHp(state.hp);
        const said = hits.map((hit) => `${hit.attackName} hits for ${hit.damage}.`).join(" ");
        let text = `${said} Dummy HP ${state.hp} of ${state.maxHp}.`;
        hitFx(hits, state);
        completeStageHint("skills");
        if (state.defeated) {
          const time = battleElapsed(state, now);
          text += ` KO in ${formatClearTime(time)}!`;
          setKoTime(time);
          koFx();
          clearTimeout(koTimer);
          koTimer = setTimeout(() => {
            if (!battle) return;
            const at = performance.now();
            battle = resetBattle(battle, at);
            setHp(battle.hp);
            setKoTime(null);
            setLog(`The dummy is back up. HP ${battle.hp} of ${battle.maxHp}.`);
            standUpFx();
            drawBars(battle, at);
          }, KO_RESET_MS);
        }
        setLog(text);
      };

      const tick = () => {
        if (!battle) return;
        const now = performance.now();
        if (latest.current.auto && !battle.defeated) {
          // Fire at the engine's exact ready times (≥ the moment Auto-fire was switched on).
          let state = battle;
          const hits: Hit[] = [];
          for (;;) {
            const next = nextReadyAt(state);
            if (next === null) break;
            const at = Math.max(next, autoSince.current);
            if (at > now) break;
            const step = autoFireStep(state, at);
            if (step.hits.length === 0) break;
            state = step.state;
            hits.push(...step.hits);
          }
          if (hits.length > 0) land(state, hits, now);
        }
        drawBars(battle, now);
      };

      const fireSlot = (slot: number) => {
        if (!battle) {
          // Focus arrived before the panel was half in view: start the round now.
          start(performance.now());
          return;
        }
        const now = performance.now();
        const result = fire(battle, slot, now);
        if (!result.hit) {
          nudgeFx(slot);
          return;
        }
        land(result.state, [result.hit], now);
        drawBars(result.state, now);
      };

      const toggleAuto = () => {
        const { auto: on, onAutoChange: set } = latest.current;
        if (!on) autoSince.current = performance.now();
        set(!on);
      };

      engine.current = { fire: fireSlot, toggleAuto };

      const run = (on: boolean) => {
        if (on === running) return;
        running = on;
        if (on) {
          start(performance.now());
          gsap.ticker.add(tick);
        } else {
          gsap.ticker.remove(tick);
          stop(); // leaving mid-round cancels it, no penalty
        }
      };

      const observer = new IntersectionObserver(
        ([entry]) => {
          halfInView = entry.intersectionRatio >= 0.5;
          if (halfInView && document.visibilityState === "visible") run(true);
          else if (!entry.isIntersecting) run(false);
        },
        { threshold: [0, 0.5] },
      );
      observer.observe(el);

      const onVisibility = () => {
        if (document.visibilityState !== "visible") run(false);
        else if (halfInView) run(true);
      };
      document.addEventListener("visibilitychange", onVisibility);

      const onKey = (event: KeyboardEvent) => {
        if (event.defaultPrevented || event.repeat) return;
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        if (ignoresKeys(event.target)) return;
        if (!halfInView && !el.contains(document.activeElement)) return;
        const slot = /^[1-9]$/.test(event.key) ? Number(event.key) - 1 : -1;
        if (slot >= 0 && slot < LOADOUT_SIZE) {
          fireSlot(slot);
        } else if (event.key === "a" || event.key === "A") {
          toggleAuto();
        }
      };
      window.addEventListener("keydown", onKey);

      return () => {
        observer.disconnect();
        document.removeEventListener("visibilitychange", onVisibility);
        window.removeEventListener("keydown", onKey);
        gsap.ticker.remove(tick);
        clearTimeout(koTimer);
        engine.current = null;
      };
    },
    // revertOnUpdate: a new loadout tears the old engine down (observers, ticker, keys) first.
    { scope: root, dependencies: [loadout], revertOnUpdate: true },
  );

  const slots = Array.from({ length: LOADOUT_SIZE }, (_, i) => loadout[i] ?? null);

  return (
    <div
      ref={root}
      data-training-dummy
      data-ko={koTime !== null || undefined}
      role="group"
      aria-labelledby="dummy-title"
      className={cn("hk-dummy", className)}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 id="dummy-title" className="hk-display hk-condensed text-3xl uppercase">
          Training dummy
        </h3>
        <p className="hk-pixel text-ink-2 text-[0.6rem]">
          HP {TRAINING_DUMMY_HP} · Unlocks nothing
        </p>
      </div>

      <div className="hk-dummy-body mt-3">
        <div>
          <div className="hk-dummy-stage">
            <div data-dummy-sprite className="hk-dummy-sprite">
              <DummySprite className="h-full w-auto" />
            </div>
            <div data-dummy-fx aria-hidden="true" className="hk-dummy-fx" />
            <p data-dummy-stamp aria-hidden="true" className="hk-dummy-stamp">
              <span className="hk-display block text-4xl leading-none">KO!</span>
              <span className="hk-mono block text-xs font-bold">
                {koTime !== null ? formatClearTime(koTime) : "—"}
              </span>
            </p>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <span aria-hidden="true" className="hk-pixel text-[0.65rem]">
              HP
            </span>
            <div
              role="progressbar"
              aria-label="Training dummy HP"
              aria-valuemin={0}
              aria-valuemax={TRAINING_DUMMY_HP}
              aria-valuenow={hp}
              aria-valuetext={`${hp} of ${TRAINING_DUMMY_HP} HP`}
              className="hk-hp"
            >
              <span data-hp-fill className="hk-hp-fill" />
            </div>
            <span aria-hidden="true" className="hk-mono w-[4.75rem] text-right text-sm font-bold">
              {hp}/{TRAINING_DUMMY_HP}
            </span>
          </div>
        </div>

        <div>
          <ol className="mt-4 grid grid-cols-2 gap-2 md:mt-0 xl:mt-4">
            {slots.map((skill, i) => {
              const ready = (readyMask & (1 << i)) !== 0;
              return (
                <li key={i}>
                  <button
                    type="button"
                    data-fire={i}
                    data-ready={(skill && ready) || undefined}
                    aria-keyshortcuts={String(i + 1)}
                    aria-disabled={!skill || !ready || undefined}
                    className="hk-fire"
                    onClick={() => engine.current?.fire(i)}
                  >
                    <span className="line-clamp-2 text-[0.8125rem] leading-tight font-bold wrap-break-word hyphens-auto sm:text-sm">
                      {skill ? skill.attack_name : "Empty slot"}
                    </span>
                    <span className="mt-auto flex items-center gap-1.5 pt-1">
                      <span aria-hidden="true" className="hk-fire-key hk-pixel">
                        {i + 1}
                      </span>
                      <span className="hk-mono text-[0.6875rem] opacity-80">
                        {skill ? `${skill.damage} DMG` : "—"}
                      </span>
                      <span className="sr-only">
                        {skill && live ? (ready ? ", ready" : ", charging") : ""}
                      </span>
                    </span>
                    <span aria-hidden="true" className="hk-cd">
                      <span data-cd-bar className="hk-cd-bar" />
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              aria-pressed={auto}
              aria-keyshortcuts="A"
              className="hk-auto"
              onClick={() => engine.current?.toggleAuto()}
            >
              Auto-fire
              <kbd className="hk-pixel">A</kbd>
              <span aria-hidden="true" className="hk-auto-state hk-pixel">
                {auto ? "On" : "Off"}
              </span>
            </button>
            <p className="hk-pixel text-ink-2 hk-only-fine text-[0.6rem]">Keys 1–4 fire</p>
          </div>

          <p role="status" aria-live="polite" className="hk-dummy-log">
            {log || "Ready slots glow. Hit one to attack."}
          </p>
        </div>
      </div>
    </div>
  );
}
