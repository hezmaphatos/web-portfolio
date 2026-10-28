"use client";

import { Lock, LockOpen, Pencil, Swords } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { useMotionGate } from "@/components/chapters/shared/motion";
import { loadoutContext, shownLoadout } from "@/components/chapters/skills/loadout";
import { seconds } from "@/components/chapters/skills/format";
import { useMediaQuery } from "@/components/chapters/skills/treeFocus";
import { useGameConfig } from "@/components/game/GameConfig";
import { completeStageHint, useStageHint, visibleRatio } from "@/components/game/useStageHint";
import {
  LOADOUT_SIZE,
  autoFireUntil,
  battleElapsed,
  clearTime,
  cooldownProgress,
  createBattle,
  fire,
  formatClearTime,
  phaseShift,
  readySlots,
  toGameSkills,
  visibleTechCount,
  type BattleState,
  type BossPhase,
  type GameSkill,
  type Hit,
} from "@/lib/battle";
import { gsap, MEDIA, useGSAP } from "@/lib/gsap";
import { BOSS_HINT, BOSS_HINT_KEY, BOSS_TUTORIAL_KEY, HINT_VISIBLE_RATIO } from "@/lib/hints";
import { sfx } from "@/lib/sound";
import { useGameStore, useHudStore } from "@/lib/store";
import type { BossTier, ProjectSummary, Skill } from "@/lib/types";
import { cn } from "@/lib/utils";

import { TierIcon } from "../BossBadge";
import { TechChips } from "../TechChips";
import { useBossLock } from "../useBossLock";
import { ArenaLoadout } from "./ArenaLoadout";
import { BossSprite } from "./BossSprite";
import { CoachMark } from "./CoachMark";
import { claimDefeat, scheduleReveal } from "./rewards";
import { useUnlockReveal } from "./useUnlockReveal";

type Props = {
  project: ProjectSummary;
  /** Every visible skill (Home payload); the game skills among them build the loadout. */
  skills: Skill[];
};

/**
 * - ready: before FIGHT! (or the boss is beaten in the save: DEFEATED + Rematch);
 * - intro: boss_intro on screen, the slots about to charge;
 * - fight: slots charging / firing;
 * - ko: the killing blow — hit-stop, pixel dissolve, banner (motion only, ≈1.4 s);
 * - victory: BOSS DEFEATED + Rematch.
 */
type View = "ready" | "intro" | "fight" | "ko" | "victory";

type Engine = {
  start: () => void;
  retreat: () => void;
  fire: (slot: number) => void;
  toggleAuto: () => void;
  skip: () => void;
  /** Back to "ready" without a word (the save was reset under a finished fight). */
  reset: () => void;
};

/** boss_intro stays alone on screen this long before the slots start charging (§6.4 step 2). */
const INTRO_MS = 900;
/** Hit-stop on the killing blow (§6.4 step 5). */
const HIT_STOP_S = 0.15;
/** The unlock sequence starts this long after the killing blow (after dissolve + banner). */
const REVEAL_AT_MS = 950;
/** ko → victory: the end of the dissolve, banner and unlock flips. */
const KO_MS = 1500;
/** How long a speech bubble (intro, taunt) stays up. */
const BUBBLE_MS = 2300;
/** Horizontal start offsets of the floating damage numbers, per slot (px from the centre). */
const FLOAT_X = [-58, 44, -20, 66];

/** Cooldown ring: 12 pixel cells clockwise around the slot key, as [row, column] of a 4×4 grid. */
const RING = [
  [1, 1],
  [1, 2],
  [1, 3],
  [1, 4],
  [2, 4],
  [3, 4],
  [4, 4],
  [4, 3],
  [4, 2],
  [4, 1],
  [3, 1],
  [2, 1],
] as const;

/** Final-tier taunts at 66 % and 33 % HP (§6.4 step 4). */
const TAUNTS: Record<2 | 3, string> = {
  2: "Is that all you've got? Phase two!",
  3: "Last stand! I'm not going down quietly!",
};

const TIER_LABEL: Record<BossTier, string> = {
  minion: "Minion",
  regular: "Boss",
  final: "Final boss",
};

/** "a, b and c". */
function listing(items: readonly string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** Keys typed into a field, or meant for a dialog/menu that is not around the Arena, never fire. */
function ignoresKeys(target: EventTarget | null, arena: HTMLElement): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || target.closest("input, textarea, select")) return true;
  // The Stage itself may sit in a dialog (the project modal): that one doesn't count.
  const layer = target.closest("dialog, [role='dialog'], [role='menu'], [role='listbox']");
  return layer !== null && !layer.contains(arena);
}

/**
 * The Battle Arena of a boss project (spec §6.4), between the overview and the Preview Deck.
 * Compact (≤ 360 px tall on desktop), not pinned, a fixed box in every state (no layout shift).
 *
 * Every number comes from lib/battle (createBattle → fire / autoFireUntil → phaseShift →
 * battleElapsed); this component only draws them and turns them into effects:
 * 1. FIGHT! → boss_intro → every slot starts charging (pixel cooldown rings).
 * 2. Ready slots fire by click/tap or keys 1–4; A toggles Auto-fire (default off), which fires at
 *    the engine's exact ready times, so the default loadout clears in exactly the estimate shown.
 *    Keys only act while the Arena is half in view or holds focus, never in fields/other dialogs,
 *    with modifiers or on key repeat.
 * 3. Each hit: floating "-70" + attack name, sprite shake/flash, HP tween, and the live region
 *    says "Eloquent Slam hits for 70. Boss HP 30 of 100.". Final tier: new sprite + taunt at 66 %
 *    and 33 %.
 * 4. 0 HP: the win goes into the save cookie at once (+ the defeat counter, badges), then 150 ms
 *    hit-stop, pixel dissolve, BOSS DEFEATED + boss_defeat_text, and the unlock sequence (chips,
 *    link locks, Live tab — every lock UI reads useBossLock) ≈ 1 s after the blow.
 * 5. DEFEATED + Rematch afterwards (just for fun; nothing re-locks). Retreat, scrolling the Arena
 *    out of view or leaving the page mid-fight cancels it without penalty.
 * Lite / reduced motion: no effects, HP updates instantly, everything is said in the live region,
 * plus Skip battle (counts as a defeat). Without JS the Arena is hidden ([data-arena], noscript
 * rule in the site layout) and every lock is open.
 */
export function BattleArena({ project, skills }: Props) {
  const boss = project.boss;
  // Plain ids (no useId colons): the Equip popover uses them in CSS selectors.
  const uid = `arena-${project.id}`;
  const root = useRef<HTMLElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const lootRef = useRef<HTMLUListElement>(null);
  const stageRef = useRef<HTMLElement | null>(null);
  const editButton = useRef<HTMLButtonElement>(null);
  const engine = useRef<Engine | null>(null);

  const { lite } = useMotionGate();
  const reduce = useMediaQuery(MEDIA.reduce);
  const mobile = useMediaQuery(MEDIA.mobile);
  const still = lite || reduce;
  const { techVisiblePercent } = useGameConfig();
  const lock = useBossLock(project.id, boss.enabled);
  const saved = useGameStore((state) => state.loadout);

  const ctx = useMemo(() => loadoutContext(toGameSkills(skills)), [skills]);
  const loadout = useMemo(
    () => shownLoadout(ctx, saved, lock.hydrated),
    [ctx, saved, lock.hydrated],
  );

  const [view, setView] = useState<View>("ready");
  const [hp, setHp] = useState(boss.hp);
  const [phase, setPhase] = useState<BossPhase>(1);
  const [readyMask, setReadyMask] = useState(0); // bit i = slot i can fire
  const [auto, setAuto] = useState(false);
  const [editing, setEditing] = useState(false);
  const [log, setLog] = useState({ text: "", serial: 0 });
  const [bubble, setBubble] = useState<string | null>(null);
  const [clearMs, setClearMs] = useState<number | null>(null);
  const [tutorial, setTutorial] = useState<number | null>(null);

  const cleared = view === "victory" || (view === "ready" && lock.defeated);
  const fighting = view === "intro" || view === "fight";
  const busy = fighting || view === "ko";
  const estimate = clearTime(loadout, boss.hp);

  // ── Loot: what the defeat unlocks (spec §6.4 "Terkunci sampai boss kalah") ──────────────
  const lockedTech =
    project.skills.length - visibleTechCount(project.skills.length, techVisiblePercent);
  const lootLinks = [
    project.live_url ? "Open site" : null,
    project.repo_url ? "Repo" : null,
    project.live_url ? "Live preview" : null,
  ].filter((item): item is string => item !== null);
  const unlockedText = (() => {
    const parts = [
      lockedTech > 0 ? `${lockedTech} more tech` : null,
      ...lootLinks.map((item) => (item === "Live preview" ? "the Live preview" : item)),
    ].filter((item): item is string => item !== null);
    return parts.length > 0 ? `Unlocked: ${listing(parts)}.` : "Bragging rights earned.";
  })();
  useUnlockReveal(lootRef, lock, project.id, "links");

  // ── Boss hint (spec §5.3): the Stage's hint, once; Help (?) shows it again ────────────────
  useLayoutEffect(() => {
    stageRef.current = root.current?.closest<HTMLElement>("[data-stage]") ?? root.current;
  }, []);
  useStageHint(BOSS_HINT_KEY, BOSS_HINT, stageRef);

  // Latest render values for the engine's callbacks (it is created once per mount).
  const latest = useRef({
    loadout,
    auto,
    still,
    editing,
    defeated: lock.defeated,
    locked: lock.locked,
    unlockedText,
  });
  const autoSince = useRef(0);
  useEffect(() => {
    latest.current = {
      loadout,
      auto,
      still,
      editing,
      defeated: lock.defeated,
      locked: lock.locked,
      unlockedText,
    };
  });

  const say = (text: string) =>
    // A trailing zero-width space makes a repeated sentence a new one for screen readers.
    setLog((prev) => ({ text: prev.serial % 2 ? text : `${text}​`, serial: prev.serial + 1 }));

  /** Tutorial progress: each action completes its coach mark (and any before it). */
  const advance = (action: "loadout" | "fight" | "hit" | "defeat") =>
    setTutorial((step) => {
      if (step === null) return null;
      if (action === "defeat") return null; // ③ done: tutorial over
      if (action === "hit") return Math.max(step, 2);
      return Math.max(step, 1); // ① picked a loadout or went straight to FIGHT!
    });

  // ── Engine ─────────────────────────────────────────────────────────────────────────────
  useGSAP(
    (_context, contextSafe) => {
      const el = panel.current;
      if (!el || !contextSafe) return;
      const q = <T extends Element>(selector: string) => el.querySelector<T>(selector);
      const hpFill = q<HTMLElement>("[data-hp-fill]");
      const fx = q<HTMLElement>("[data-arena-fx]");
      const banner = q<HTMLElement>("[data-arena-banner]");
      const bubbleEl = q<HTMLElement>("[data-arena-bubble]");
      // The sprite re-renders per phase: query it when needed.
      const sprite = () => q<HTMLElement>("[data-boss-sprite]");

      let battle: BattleState | null = null;
      let current: View = "ready";
      let mask = 0;
      const lit = [-1, -1, -1, -1];
      let rings: HTMLElement[][] = [];
      let introTimer: ReturnType<typeof setTimeout> | undefined;
      let koTimer: ReturnType<typeof setTimeout> | undefined;
      let bubbleTimer: ReturnType<typeof setTimeout> | undefined;
      let ticking = false;
      let halfInView = false;

      const quiet = () => latest.current.still || window.matchMedia(MEDIA.reduce).matches;

      const go = (next: View) => {
        current = next;
        setView(next);
      };

      // ── Drawing ──────────────────────────────────────────────────────────────────────────
      const ringCells = () => {
        if (!rings[0]?.[0]?.isConnected) {
          rings = Array.from(el.querySelectorAll<HTMLElement>("[data-ring]")).map((ring) =>
            Array.from(ring.querySelectorAll<HTMLElement>("i")),
          );
          lit.fill(-1);
        }
        return rings;
      };

      /** Pixel rings (12 steps) + the ready mask; only touches the DOM when something changed. */
      const draw = (state: BattleState | null, now: number) => {
        ringCells().forEach((cells, i) => {
          const n = state ? Math.floor(cooldownProgress(state, i, now) * cells.length + 1e-6) : -1;
          if (n === lit[i]) return;
          lit[i] = n;
          cells.forEach((cell, j) => cell.classList.toggle("is-on", j < n));
        });
        let next = 0;
        if (state) for (const i of readySlots(state, now)) next |= 1 << i;
        if (next !== mask) {
          mask = next;
          setReadyMask(next);
        }
      };

      const showBubble = contextSafe((text: string | null) => {
        clearTimeout(bubbleTimer);
        setBubble(text);
        if (!text) return;
        bubbleTimer = setTimeout(() => setBubble(null), BUBBLE_MS);
        if (quiet() || !bubbleEl) return;
        gsap.fromTo(
          bubbleEl,
          { scale: 0.55, opacity: 0 },
          { scale: 1, opacity: 1, duration: 0.28, ease: "back.out(3)", clearProps: "all" },
        );
      });

      /** Clears every leftover of a previous fight (dissolved pixels, numbers, HP). */
      const resetFx = contextSafe((full: boolean) => {
        const s = sprite();
        gsap.killTweensOf([hpFill, s, banner].filter(Boolean));
        if (s) {
          gsap.set(s, { clearProps: "transform,opacity" });
          const art = s.querySelector("[data-boss-art]");
          const px = s.querySelectorAll("[data-px]");
          gsap.killTweensOf([art, ...px].filter(Boolean));
          if (px.length) gsap.set(px, { clearProps: "transform,opacity" });
          if (art) gsap.set(art, { clearProps: "clipPath,transform,opacity" });
        }
        if (banner) gsap.set(banner, { clearProps: "transform,opacity" });
        fx?.replaceChildren();
        if (hpFill) gsap.set(hpFill, { scaleX: full ? 1 : 0 });
      });

      // ── Effects (callbacks → contextSafe: reverted on unmount) ────────────────────────────
      const hitFx = contextSafe((hits: readonly Hit[], state: BattleState, shifted: boolean) => {
        const ratio = state.maxHp > 0 ? state.hp / state.maxHp : 0;
        if (quiet()) {
          gsap.set(hpFill, { scaleX: ratio });
          return;
        }
        gsap.to(hpFill, { scaleX: ratio, duration: 0.35, ease: "power2.out", overwrite: true });
        const s = sprite();
        if (s) {
          gsap.fromTo(
            s,
            { x: shifted ? -16 : -8, rotation: shifted ? -4 : 0 },
            { x: 0, rotation: 0, duration: 0.55, ease: "elastic.out(1.2, 0.3)", overwrite: "auto" },
          );
          gsap.fromTo(s, { opacity: 0.3 }, { opacity: 1, duration: 0.24, ease: "steps(3)" });
        }
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
            { y: -62, scale: 1, duration: 0.9, delay, ease: "power2.out" },
          );
          gsap.to(node, {
            opacity: 0,
            duration: 0.3,
            delay: delay + 0.62,
            onComplete: () => node.remove(),
          });
        });
      });

      /** §6.4 step 5: 150 ms hit-stop, pixel dissolve, BOSS DEFEATED. */
      const defeatFx = contextSafe(() => {
        const s = sprite();
        if (!s) return;
        // Hit-stop: freeze the killing blow's number and HP drain for 150 ms (this Arena only).
        const frozen = gsap.getTweensOf([hpFill, ...(fx ? Array.from(fx.children) : [])]);
        frozen.forEach((tween) => tween.pause());
        gsap.delayedCall(HIT_STOP_S, () => frozen.forEach((tween) => tween.resume()));

        const tl = gsap.timeline();
        tl.set(s, { x: -7, scale: 1.07, rotation: -2 }, 0).to(
          s,
          { x: 0, scale: 1, rotation: 0, duration: 0.14, ease: "power2.out" },
          HIT_STOP_S,
        );
        const px = s.querySelectorAll("[data-px]");
        const art = s.querySelector("[data-boss-art]");
        if (px.length) {
          tl.to(
            px,
            {
              opacity: 0,
              x: () => gsap.utils.random(-1.5, 1.5),
              y: () => gsap.utils.random(-2.5, 1),
              duration: 0.14,
              ease: "steps(2)",
              stagger: { amount: 0.55, from: "random" },
            },
            HIT_STOP_S + 0.04,
          );
        } else if (art) {
          tl.fromTo(
            art,
            { clipPath: "inset(0% 0% 0% 0%)" },
            { clipPath: "inset(100% 0% 0% 0%)", duration: 0.6, ease: "steps(10)" },
            HIT_STOP_S + 0.04,
          );
        }
        if (banner) {
          tl.fromTo(
            banner,
            { scale: 1.8, rotation: -14, opacity: 0 },
            {
              scale: 1,
              rotation: 0,
              opacity: 1,
              duration: 0.42,
              ease: "back.out(2.2)",
              clearProps: "transform,opacity",
            },
            0.5,
          );
        }
      });

      const nudgeFx = contextSafe((slot: number) => {
        const button = el.querySelector(`[data-fire="${slot}"]`);
        if (!button || quiet()) return;
        gsap.fromTo(button, { x: -4 }, { x: 0, duration: 0.35, ease: "elastic.out(1.4, 0.3)" });
      });

      // ── Fight ────────────────────────────────────────────────────────────────────────────
      const tick = () => {
        if (!battle || battle.defeated) return;
        const now = performance.now();
        if (latest.current.auto) {
          // Fire at the engine's exact ready times (≥ the moment Auto-fire was switched on).
          const step = autoFireUntil(battle, now, autoSince.current);
          if (step.hits.length > 0) land(step.state, step.hits, now);
        }
        if (battle && !battle.defeated) draw(battle, now);
      };

      const stopTicker = () => {
        if (!ticking) return;
        ticking = false;
        gsap.ticker.remove(tick);
      };

      const clearTimers = () => {
        clearTimeout(introTimer);
        clearTimeout(koTimer);
      };

      const ko = (state: BattleState, now: number, hitText: string) => {
        stopTicker();
        const time = battleElapsed(state, now);
        const firstWin = latest.current.locked; // still locked → this blow unlocks everything
        setClearMs(time);
        // The win is saved at once; the lock UIs flip open when the banner is up.
        scheduleReveal(project.id, performance.now() + (quiet() ? 0 : REVEAL_AT_MS));
        claimDefeat({ id: project.id, slug: project.slug, tier: boss.tier });
        sfx.bossDefeat();
        advance("defeat");
        say(
          `${hitText} ${boss.name} defeated in ${formatClearTime(time)}!` +
            (boss.defeat_text ? ` ${boss.defeat_text}` : "") +
            (firstWin
              ? ` ${latest.current.unlockedText}`
              : " Rematch won. Everything stays unlocked."),
        );
        showBubble(null);
        if (quiet()) {
          go("victory");
          return;
        }
        go("ko");
        defeatFx();
        koTimer = setTimeout(() => go("victory"), KO_MS);
      };

      function land(state: BattleState, hits: readonly Hit[], now: number) {
        const before = battle;
        battle = state;
        setHp(state.hp);
        const shift = before ? phaseShift(before, state) : null;
        let text = `${hits.map((hit) => `${hit.attackName} hits for ${hit.damage}.`).join(" ")} Boss HP ${state.hp} of ${state.maxHp}.`;
        hits.forEach((hit, i) => sfx.hit(hit.damage, i * 0.08)); // pitch by damage (phase 7)
        hitFx(hits, state, shift !== null);
        advance("hit");
        if (state.defeated) {
          ko(state, now, text);
          return;
        }
        if (shift !== null && shift !== 1) {
          setPhase(shift);
          showBubble(TAUNTS[shift]);
          text += ` ${boss.name}: "${TAUNTS[shift]}"`;
        }
        say(text);
      }

      const begin = () => {
        const now = performance.now();
        battle = createBattle(latest.current.loadout, boss.hp, now, boss.tier);
        autoSince.current = now;
        go("fight");
        setHp(battle.hp);
        if (battle.defeated) {
          ko(battle, now, ""); // a boss with 0 HP falls at once
          return;
        }
        draw(battle, now);
        if (!ticking) {
          ticking = true;
          gsap.ticker.add(tick);
        }
      };

      const start = () => {
        if (
          latest.current.editing ||
          current === "intro" ||
          current === "fight" ||
          current === "ko"
        )
          return;
        clearTimers();
        resetFx(true);
        setPhase(1);
        setHp(boss.hp);
        setClearMs(null);
        completeStageHint(BOSS_HINT_KEY); // the hint asks for exactly this
        advance("fight");
        const intro = boss.intro?.trim() || null;
        go("intro");
        showBubble(intro);
        say(`${intro ? `${intro} ` : ""}Fight! Your skills are charging.`);
        if (quiet()) begin();
        else introTimer = setTimeout(begin, intro ? INTRO_MS : 300);
      };

      /** Ends a running fight: the boss is back to full HP, nothing is lost (§6.4 step 7). */
      const cancel = (message: string | null) => {
        if (current !== "intro" && current !== "fight") return;
        clearTimers();
        stopTicker();
        battle = null;
        resetFx(true);
        setPhase(1);
        setHp(boss.hp);
        showBubble(null);
        go("ready");
        draw(null, 0);
        if (message) say(message);
      };

      const fireSlot = (slot: number) => {
        if (latest.current.editing) return;
        if (current === "ready" && !latest.current.defeated) {
          start(); // a slot (or key 1–4) before FIGHT! starts the fight
          return;
        }
        if (current !== "fight" || !battle) return;
        const now = performance.now();
        const result = fire(battle, slot, now);
        if (!result.hit) {
          nudgeFx(slot);
          return;
        }
        land(result.state, [result.hit], now);
        if (battle && !battle.defeated) draw(battle, now);
      };

      const toggleAuto = () => {
        const on = !latest.current.auto;
        if (on) autoSince.current = performance.now();
        setAuto(on);
        say(on ? "Auto-fire on: ready skills fire by themselves." : "Auto-fire off.");
      };

      /** Lite / reduced motion: Skip battle unlocks at once and counts as a defeat (§5, §6.4). */
      const skip = () => {
        if (current === "ko" || current === "victory" || latest.current.defeated) return;
        clearTimers();
        stopTicker();
        battle = null;
        resetFx(false);
        setHp(0);
        setClearMs(null);
        showBubble(null);
        scheduleReveal(project.id, performance.now());
        claimDefeat({ id: project.id, slug: project.slug, tier: boss.tier });
        sfx.bossDefeat();
        advance("defeat");
        go("victory");
        draw(null, 0);
        say(
          `Battle skipped: ${boss.name} counts as defeated.` +
            (boss.defeat_text ? ` ${boss.defeat_text}` : "") +
            ` ${latest.current.unlockedText}`,
        );
      };

      const reset = () => {
        if (current !== "victory") return;
        resetFx(true);
        setPhase(1);
        setHp(boss.hp);
        go("ready");
      };

      engine.current = {
        start,
        retreat: () => cancel("You retreated. The boss is back to full HP: no penalty."),
        fire: fireSlot,
        toggleAuto,
        skip,
        reset,
      };

      // Leaving mid-fight cancels it (§6.4 step 7): scrolled fully out of view or tab hidden.
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (!entry) return;
          const viewport = entry.rootBounds?.height ?? window.innerHeight;
          halfInView =
            visibleRatio(
              entry.intersectionRect.height,
              entry.boundingClientRect.height,
              viewport,
            ) >= 0.5;
          if (!entry.isIntersecting)
            cancel("Fight cancelled: you left the arena. The boss is back to full HP.");
        },
        { threshold: [0, 0.25, 0.5, 0.75, 1] },
      );
      observer.observe(el);

      const onVisibility = () => {
        if (document.visibilityState !== "visible")
          cancel("Fight cancelled while the tab was hidden. The boss is back to full HP.");
      };
      document.addEventListener("visibilitychange", onVisibility);

      // Capture phase + preventDefault: a Training Dummy elsewhere on the page (behind the
      // project modal) checks defaultPrevented, so one key press never fires twice.
      const onKey = (event: KeyboardEvent) => {
        if (event.defaultPrevented || event.repeat) return;
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        if (latest.current.editing || ignoresKeys(event.target, el)) return;
        if (!halfInView && !el.contains(document.activeElement)) return;
        const slot = /^[1-9]$/.test(event.key) ? Number(event.key) - 1 : -1;
        if (slot >= 0 && slot < LOADOUT_SIZE) {
          event.preventDefault();
          fireSlot(slot);
        } else if (event.key === "a" || event.key === "A") {
          event.preventDefault();
          toggleAuto();
        }
      };
      window.addEventListener("keydown", onKey, true);

      return () => {
        observer.disconnect();
        document.removeEventListener("visibilitychange", onVisibility);
        window.removeEventListener("keydown", onKey, true);
        stopTicker();
        clearTimers();
        clearTimeout(bubbleTimer);
        engine.current = null;
      };
    },
    { scope: panel, dependencies: [] },
  );

  // The HP bar between fights: full, or empty when the save says this boss is beaten.
  useEffect(() => {
    if (view !== "ready") return;
    const fill = panel.current?.querySelector("[data-hp-fill]");
    if (fill) gsap.set(fill, { scaleX: lock.defeated ? 0 : 1 });
  }, [view, lock.defeated]);

  // Reset save (badges drawer / NEW GAME) under a finished fight: back to a locked boss.
  useEffect(() => {
    if (view === "victory" && lock.hydrated && !lock.defeated) engine.current?.reset();
  }, [view, lock.hydrated, lock.defeated]);

  // ── Boss tutorial (spec §5.3): first Arena visit only, 3 coach marks ─────────────────────
  useEffect(() => {
    const el = panel.current;
    if (!el) return;
    let visible = false;
    const tryStart = () => {
      const game = useGameStore.getState();
      if (
        !visible ||
        !game.hydrated || // "seen" lives in the cookie: never guess before it is read
        useHudStore.getState().boot !== "done" ||
        game.hints.includes(BOSS_TUTORIAL_KEY)
      )
        return;
      game.markHintSeen(BOSS_TUTORIAL_KEY); // once, from now on
      setTutorial(0);
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        const viewport = entry.rootBounds?.height ?? window.innerHeight;
        visible =
          visibleRatio(entry.intersectionRect.height, entry.boundingClientRect.height, viewport) >=
          HINT_VISIBLE_RATIO;
        tryStart();
      },
      { threshold: Array.from({ length: 21 }, (_, i) => i / 20) },
    );
    observer.observe(el);
    const unsubscribe = [useGameStore.subscribe(tryStart), useHudStore.subscribe(tryStart)];
    return () => {
      observer.disconnect();
      unsubscribe.forEach((off) => off());
    };
  }, []);

  const openEditor = () => {
    if (busy || !lock.hydrated) return;
    setEditing(true);
    advance("loadout");
  };
  const closeEditor = () => {
    setEditing(false);
    requestAnimationFrame(() => editButton.current?.focus({ preventScroll: true }));
  };

  const coachTarget =
    tutorial === null ? undefined : (["loadout", "slots", "boss"] as const)[tutorial];
  const slots: (GameSkill | null)[] = Array.from(
    { length: LOADOUT_SIZE },
    (_, i) => loadout[i] ?? null,
  );
  const shownHp = view === "ready" && lock.defeated ? 0 : hp;
  // FIGHT! → Retreat while fighting → Rematch once beaten; one button, one box.
  const primary = view === "ready" && !cleared ? "Fight!" : fighting ? "Retreat" : "Rematch";
  const onPrimary = () => {
    if (fighting) engine.current?.retreat();
    else engine.current?.start();
  };

  return (
    <section
      ref={root}
      aria-labelledby={`${uid}-title`}
      className="hk-chapter hk-arena-sec"
      data-arena
    >
      <div className="hk-wrap">
        <div
          ref={panel}
          className="hk-arena"
          data-view={view}
          data-cleared={cleared || undefined}
          data-phase={phase}
          data-tier={boss.tier}
          data-coach={editing ? undefined : coachTarget}
        >
          <header className="hk-arena-head">
            <div className="min-w-0 flex-1">
              <p className="hk-pixel text-lime text-[0.6rem] leading-none whitespace-nowrap">
                <span aria-hidden="true">▸ </span>Boss battle
              </p>
              <h2
                id={`${uid}-title`}
                className="hk-arena-name hk-display hk-condensed mt-1 uppercase"
              >
                <span className="sr-only">Boss battle: </span>
                {boss.name}
              </h2>
            </div>
            <p className="hk-pixel flex shrink-0 flex-col items-end gap-1 text-right text-[0.6rem] leading-none">
              <span className="bg-paper text-ink inline-flex items-center gap-1.5 px-1.5 py-1">
                <TierIcon tier={boss.tier} className="text-xs" />
                <span className="hk-arena-tier">{TIER_LABEL[boss.tier]} · </span>HP {boss.hp}
              </span>
              <span className="opacity-80">
                Est. clear {formatClearTime(estimate)}
                <span className="sr-only"> with your loadout and Auto-fire</span>
              </span>
            </p>
          </header>

          <div className="hk-arena-body">
            <div className="hk-arena-left" inert={editing || undefined}>
              <div className="hk-arena-stage">
                <div data-boss-sprite className="hk-arena-sprite">
                  <BossSprite
                    boss={boss}
                    seed={project.slug}
                    accent={project.accent_color}
                    phase={phase}
                  />
                </div>
                <div data-arena-fx aria-hidden="true" className="hk-arena-fx" />
                <p
                  data-arena-bubble
                  data-show={bubble ? "" : undefined}
                  aria-hidden="true"
                  className="hk-arena-bubble"
                >
                  {bubble}
                </p>
                <div data-arena-banner aria-hidden="true" className="hk-arena-banner">
                  <p className="hk-arena-banner-title hk-display hk-condensed uppercase">
                    {view === "ready" ? "Defeated" : "Boss defeated"}
                  </p>
                  {boss.defeat_text ? (
                    <p className="hk-arena-banner-text">{boss.defeat_text}</p>
                  ) : null}
                  {clearMs !== null && view !== "ready" ? (
                    <p className="hk-mono mt-1 text-[0.6875rem] font-bold">
                      Cleared in {formatClearTime(clearMs)}
                    </p>
                  ) : null}
                </div>
                <CoachMark step={editing ? null : tutorial} onSkip={() => setTutorial(null)} />
              </div>

              <div className="hk-arena-hp">
                <span aria-hidden="true" className="hk-pixel text-[0.6rem]">
                  HP
                </span>
                <div
                  role="progressbar"
                  aria-label={`${boss.name} HP`}
                  aria-valuemin={0}
                  aria-valuemax={boss.hp}
                  aria-valuenow={shownHp}
                  aria-valuetext={`${shownHp} of ${boss.hp} HP`}
                  className="hk-hp"
                >
                  <span data-hp-fill className="hk-hp-fill" />
                </div>
                <span
                  aria-hidden="true"
                  className="hk-mono w-[4.75rem] text-right text-sm font-bold"
                >
                  {shownHp}/{boss.hp}
                </span>
              </div>
            </div>

            <div className="hk-arena-right" inert={editing || undefined}>
              <ol className="hk-arena-slots" aria-label="Loadout: skills 1 to 4">
                {slots.map((skill, i) => {
                  const ready = view === "fight" && (readyMask & (1 << i)) !== 0;
                  const canStart = view === "ready" && !cleared;
                  const usable = Boolean(skill) && (ready || canStart);
                  return (
                    <li key={i}>
                      <button
                        type="button"
                        data-fire={i}
                        data-ready={(skill && ready) || undefined}
                        data-empty={!skill || undefined}
                        aria-keyshortcuts={String(i + 1)}
                        aria-disabled={!usable || undefined}
                        className="hk-arena-slot"
                        onClick={() => engine.current?.fire(i)}
                      >
                        <span aria-hidden="true" className="hk-ring" data-ring={i}>
                          {RING.map(([row, col], j) => (
                            <i key={j} style={{ gridArea: `${row} / ${col}` }} />
                          ))}
                          <span className="hk-ring-key hk-pixel">{i + 1}</span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-2 text-[0.8125rem] leading-tight font-bold wrap-break-word hyphens-auto">
                            {skill ? skill.attack_name : "Empty slot"}
                          </span>
                          <span className="hk-mono mt-0.5 block text-[0.6875rem] whitespace-nowrap opacity-80">
                            {skill ? (
                              <>
                                {skill.damage}
                                <span className="hk-slot-unit"> DMG</span> ·{" "}
                                {seconds(skill.cooldown_ms)}
                              </>
                            ) : (
                              "—"
                            )}
                          </span>
                          <span className="sr-only">
                            {skill
                              ? fighting
                                ? ready
                                  ? ", ready"
                                  : ", charging"
                                : canStart
                                  ? ", starts the fight"
                                  : ""
                              : ""}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>

              <div className="hk-arena-controls">
                <button
                  type="button"
                  className={cn("hk-btn hk-arena-primary", primary === "Fight!" && "hk-btn-hot")}
                  aria-disabled={view === "ko" || undefined}
                  onClick={onPrimary}
                >
                  <Swords aria-hidden="true" className="size-4" />
                  {primary}
                </button>
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
                <button
                  ref={editButton}
                  type="button"
                  className="hk-equip-link text-paper"
                  data-edit-loadout
                  aria-expanded={editing}
                  aria-controls={editing ? `${uid}-loadout` : undefined}
                  aria-disabled={busy || !lock.hydrated || undefined}
                  title={busy ? "The loadout can't change during a fight" : undefined}
                  onClick={openEditor}
                >
                  <Pencil aria-hidden="true" className="size-3.5" strokeWidth={2.5} />
                  Edit loadout
                </button>
                {!cleared && view !== "ko" ? (
                  <button
                    type="button"
                    className="hk-equip-link hk-skip-battle text-paper"
                    data-force={loadout.length === 0 || undefined}
                    onClick={() => engine.current?.skip()}
                  >
                    Skip battle
                  </button>
                ) : null}
              </div>

              <div
                className="hk-arena-loot"
                role="group"
                aria-label="Loot: unlocked by defeating the boss"
              >
                <p aria-hidden="true" className="hk-pixel text-lime text-[0.55rem] leading-none">
                  Loot{" "}
                  {lock.locked ? (
                    <Lock className="inline size-2.5" />
                  ) : (
                    <LockOpen className="inline size-2.5" />
                  )}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <TechChips
                    skills={project.skills}
                    projectId={project.id}
                    bossEnabled={boss.enabled}
                    className="gap-1.5"
                    chipClassName="hk-loot-chip"
                  />
                  {lootLinks.length > 0 ? (
                    <ul ref={lootRef} className="flex flex-wrap gap-1.5" aria-label="Links">
                      {lootLinks.map((item) => (
                        <li key={item} className="grid" data-loot-link>
                          <span
                            data-unlocked-ui
                            aria-hidden={lock.locked || undefined}
                            className="hk-chip hk-loot-chip bg-lime [grid-area:1/1]"
                          >
                            <LockOpen aria-hidden="true" className="size-3" />
                            {item}
                          </span>
                          <span
                            data-lock-ui
                            aria-hidden={!lock.locked || undefined}
                            className="hk-chip hk-loot-chip opacity-85 [grid-area:1/1]"
                          >
                            <Lock aria-hidden="true" className="size-3" />
                            {item}
                            <span className="sr-only"> (locked)</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : project.skills.length === 0 ? (
                    <p className="text-sm opacity-85">Bragging rights.</p>
                  ) : null}
                </div>
              </div>

              <p className="hk-arena-log">
                <span role="status" aria-live="polite">
                  {log.text}
                </span>
                {log.text ? null : (
                  <span>
                    {cleared
                      ? "Boss beaten: its full tech stack and links are open. Rematch any time — nothing locks again."
                      : "Press FIGHT!, then fire ready skills with a tap or keys 1–4."}
                  </span>
                )}
              </p>
            </div>

            {editing ? (
              <ArenaLoadout
                id={`${uid}-loadout`}
                ctx={ctx}
                loadout={loadout}
                mobile={mobile}
                lite={still}
                onClose={closeEditor}
              />
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
