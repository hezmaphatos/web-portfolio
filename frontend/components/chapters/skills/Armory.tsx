"use client";

import { RotateCcw, X } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";

import { useMotionGate } from "@/components/chapters/shared/motion";
import {
  LOADOUT_SIZE,
  TRAINING_DUMMY_HP,
  clearTime,
  formatClearTime,
  type GameSkill,
} from "@/lib/battle";
import { gsap, MEDIA, useGSAP } from "@/lib/gsap";
import { useGameStore } from "@/lib/store";
import type { SkillCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

import { EquipPopover, EquipSheet } from "./EquipMenu";
import { setupEquipDrag, type Safe } from "./equipDrag";
import { seconds } from "./format";
import {
  equipSkill,
  loadoutContext,
  resetLoadout,
  sameIds,
  shownLoadout,
  unequipSlot,
  type LoadoutChange,
} from "./loadout";
import { TrainingDummy } from "./TrainingDummy";
import { useMediaQuery } from "./treeFocus";

/** A game skill plus its branch (for the inventory card's colour mark). */
export type InventorySkill = GameSkill & { category: SkillCategory };

type Props = { skills: InventorySkill[] };

/** Category mark colour, matching the tree's branch diamonds. */
const MARK: Record<SkillCategory, string> = {
  backend: "bg-hot",
  frontend: "bg-volt",
  mobile: "bg-lime",
  database: "bg-ink",
  design: "bg-hot",
  ml: "bg-volt",
  game: "bg-lime",
  soft: "bg-paper",
};

/** gsap.matchMedia hands out an untyped contextSafe; this keeps the wrapped function's type. */
const typed =
  (contextSafe: ((fn: never) => unknown) | undefined): Safe =>
  (fn) =>
    contextSafe ? (contextSafe(fn as never) as typeof fn) : fn;

type Chooser = { skillId: number; align: "left" | "right" };

/**
 * The game half of Chapter 4 (spec §4.1 skills, §6.4): LOADOUT (4 big slots), INVENTORY (every
 * game skill as a card) and the TRAINING DUMMY.
 * - Equip by dragging a card onto a slot, or a slot's skill onto another slot to swap (mouse,
 *   GSAP Draggable, not in Lite) — or click/tap a card → Equip → slot 1–4 (a popover on
 *   desktop, a bottom sheet on phones; fully keyboard-operable: the button alternative).
 * - The loadout lives in the save cookie (useGameStore.loadout). The server and the first client
 *   render show the default loadout; after hydration the saved one, in identical slot boxes.
 * - Every change is announced in a visible live region ("Laravel equipped in slot 2.").
 */
export function Armory({ skills }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const { ready, lite } = useMotionGate();
  const mobile = useMediaQuery(MEDIA.mobile);

  const game = useMemo(
    () =>
      skills.map((skill): GameSkill => ({
        id: skill.id,
        name: skill.name,
        attack_name: skill.attack_name,
        damage: skill.damage,
        cooldown_ms: skill.cooldown_ms,
        level: skill.level,
        sort_order: skill.sort_order,
      })),
    [skills],
  );
  const ctx = useMemo(() => loadoutContext(game), [game]);
  const saved = useGameStore((state) => state.loadout);
  const hydrated = useGameStore((state) => state.hydrated);
  const loadout = useMemo(() => shownLoadout(ctx, saved, hydrated), [ctx, saved, hydrated]);
  const ids = loadout.map((skill) => skill.id);
  const isDefault = sameIds(
    ids,
    ctx.defaults.map((skill) => skill.id),
  );
  const slotOf = (skillId: number) => ids.indexOf(skillId);

  const [auto, setAuto] = useState(false);
  const [chooser, setChooser] = useState<Chooser | null>(null);
  const [status, setStatus] = useState({ text: "", serial: 0 });

  const { contextSafe } = useGSAP({ scope: root });

  // ── After a change: announce it, pop the slot it landed in ─────────────
  const announce = useCallback((text: string) => {
    // A trailing zero-width space makes a repeated sentence a new one for screen readers.
    setStatus((prev) => ({ text: prev.serial % 2 ? text : `${text}​`, serial: prev.serial + 1 }));
  }, []);

  const popSlot = useCallback(
    (index: number | null) =>
      contextSafe(() => {
        const slot = root.current?.querySelector(`[data-slot="${index}"]`);
        if (index === null || !slot || lite || window.matchMedia(MEDIA.reduce).matches) return;
        gsap.fromTo(
          slot,
          { scale: 1.07 },
          { scale: 1, duration: 0.45, delay: 0.12, ease: "back.out(3)", clearProps: "scale" },
        );
      })(),
    [contextSafe, lite],
  );

  const applied = useCallback(
    (change: LoadoutChange | null) => {
      if (!change) return null;
      announce(change.message);
      popSlot(change.landed);
      return change.landed;
    },
    [announce, popSlot],
  );

  const focusCard = useCallback((skillId: number) => {
    root.current
      ?.querySelector<HTMLElement>(`[data-inventory-card][data-skill-id="${skillId}"]`)
      ?.focus({ preventScroll: true });
  }, []);

  // ── Equip menu ──────────────────────────────────────────────────────
  const openChooser = (skillId: number, card: HTMLElement) => {
    if (chooser?.skillId === skillId) {
      setChooser(null);
      return;
    }
    const rect = card.getBoundingClientRect();
    const align = rect.left + rect.width / 2 > window.innerWidth / 2 ? "right" : "left";
    setChooser({ skillId, align });
  };

  const closeChooser = useCallback(
    (refocus: boolean) => {
      const skillId = chooser?.skillId;
      setChooser(null);
      if (refocus && skillId !== undefined) focusCard(skillId);
    },
    [chooser, focusCard],
  );

  const choose = (slot: number) => {
    if (!chooser) return;
    applied(equipSkill(ctx, slot, chooser.skillId));
    closeChooser(true);
  };

  const unequipChosen = () => {
    if (!chooser) return;
    const slot = slotOf(chooser.skillId);
    applied(unequipSlot(ctx, slot));
    closeChooser(true);
  };

  const unequip = (slot: number) => {
    const change = unequipSlot(ctx, slot);
    if (!change) return;
    applied(change);
    // The slot's button disappears when the slot empties: keep focus nearby.
    requestAnimationFrame(() => {
      const el = root.current;
      const next =
        el?.querySelector<HTMLElement>(`[data-slot="${slot}"] [data-unequip]`) ??
        el?.querySelector<HTMLElement>(`[data-slot="${slot - 1}"] [data-unequip]`) ??
        el?.querySelector<HTMLElement>("[data-inventory-card]");
      if (next && !next.contains(document.activeElement)) next.focus({ preventScroll: true });
    });
  };

  // ── Drag to equip (mouse only, not in Lite) ──────────────────────────
  useGSAP(
    () => {
      const el = root.current;
      if (!ready || lite || !el) return;
      const mm = gsap.matchMedia();
      mm.add(MEDIA, (context, safe) => {
        const { finePointer, reduce } = context.conditions ?? {};
        if (!finePointer) return; // touch: tap a card → bottom sheet / popover
        return setupEquipDrag({
          root: el,
          reduce: Boolean(reduce),
          safe: typed(safe),
          onDrop: (skillId, fromSlot, toSlot) => {
            setChooser(null);
            const from = fromSlot ?? -1;
            if (from === toSlot) return null;
            return applied(equipSkill(ctx, toSlot, skillId));
          },
        });
      });
      return () => mm.revert();
    },
    { scope: root, dependencies: [ready, lite, ctx, applied], revertOnUpdate: true },
  );

  const chosen = chooser ? (ctx.byId.get(chooser.skillId) ?? null) : null;
  const volley = loadout.reduce((sum, skill) => sum + skill.damage, 0);
  const clear = clearTime(loadout, TRAINING_DUMMY_HP);
  const slots = Array.from({ length: LOADOUT_SIZE }, (_, i) => loadout[i] ?? null);

  return (
    <div
      ref={root}
      data-loadout
      className="hk-armory hk-panel bg-ink text-paper relative mt-4 p-4 shadow-[6px_6px_0_var(--hot)] sm:p-6 md:mt-8 lg:p-8"
    >
      <p
        aria-hidden="true"
        className="hk-sticker hk-pixel absolute -top-4 right-4 rotate-3 text-[0.65rem]"
      >
        {isDefault ? "Default" : "Custom"}
      </p>

      {/* ── Loadout ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
        <div className="max-w-xl">
          <h3 className="hk-display hk-condensed text-4xl tracking-[-0.005em] uppercase md:text-5xl">
            Loadout
          </h3>
          <p className="mt-2 text-sm leading-relaxed opacity-90">
            Four equipped skills fight every boss. Each slot charges for its cooldown, then hits for
            its damage. Until you pick your own, the four hardest hitters are equipped.
          </p>
        </div>
        <dl className="hk-mono grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
          <div>
            <dt className="hk-pixel text-[0.6rem] opacity-80">Damage per volley</dt>
            <dd className="text-lime text-2xl font-bold">{volley}</dd>
          </div>
          <div>
            <dt className="hk-pixel text-[0.6rem] opacity-80">
              Dummy clear time<span className="sr-only"> ({TRAINING_DUMMY_HP} HP)</span>
            </dt>
            <dd className="text-lime text-2xl font-bold">{formatClearTime(clear)}</dd>
          </div>
        </dl>
      </div>

      <ol className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {slots.map((skill, i) => (
          <li
            key={i}
            data-slot={i}
            data-skill-id={skill?.id}
            className={cn("hk-slot", skill ? "hk-slot-filled" : "hk-slot-empty")}
          >
            <div className="flex items-start justify-between gap-2">
              <span aria-hidden="true" className="hk-slot-key hk-pixel">
                {i + 1}
              </span>
              {skill ? (
                <button
                  type="button"
                  data-unequip
                  data-needs-js
                  className="hk-unequip"
                  aria-label={`Unequip ${skill.name} from slot ${i + 1}`}
                  aria-disabled={loadout.length <= 1 || undefined}
                  title={loadout.length <= 1 ? "Keep at least one skill equipped" : "Unequip"}
                  onClick={() => unequip(i)}
                >
                  <X aria-hidden="true" className="size-3.5" strokeWidth={3} />
                </button>
              ) : null}
            </div>
            {skill ? (
              <p className="mt-auto min-w-0">
                <span className="sr-only">Slot {i + 1}: </span>
                <span className="line-clamp-2 block text-[0.9375rem] leading-tight font-bold wrap-break-word hyphens-auto sm:text-lg">
                  {skill.attack_name}
                </span>
                <span className="hk-mono text-ink-2 mt-1 block truncate text-[0.6875rem] sm:text-xs">
                  {skill.name}
                </span>
                <span className="hk-mono block text-[0.6875rem] font-bold whitespace-nowrap sm:text-xs">
                  {skill.damage} DMG · {seconds(skill.cooldown_ms)}
                </span>
              </p>
            ) : (
              <p className="mt-auto text-sm">
                <span className="sr-only">Slot {i + 1}: </span>
                <span className="block font-semibold">Empty slot</span>
                <span className="hk-pixel mt-1 block text-[0.55rem] opacity-80">
                  Drop a skill here
                </span>
              </p>
            )}
          </li>
        ))}
      </ol>

      <div className="mt-3 flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p role="status" aria-live="polite" className="hk-pixel text-lime text-[0.65rem]">
          {status.text ? (
            <>
              <span aria-hidden="true">✓ </span>
              {status.text}
            </>
          ) : null}
        </p>
        <button
          type="button"
          data-needs-js
          className={cn("hk-equip-link text-paper", isDefault && "invisible")}
          onClick={() => applied(resetLoadout(ctx))}
        >
          <RotateCcw aria-hidden="true" className="size-3.5" strokeWidth={2.5} />
          Default loadout
        </button>
      </div>

      <div className="border-paper/30 mt-6 grid gap-10 border-t-2 pt-7 xl:grid-cols-12 xl:gap-8">
        {/* ── Inventory ───────────────────────────────────────────────── */}
        <div className="xl:col-span-7">
          <h3 className="hk-pixel text-sm">
            <span aria-hidden="true" className="text-lime">
              ▸{" "}
            </span>
            Inventory <span className="opacity-70">· {game.length} skills</span>
          </h3>
          <p data-needs-js className="mt-2 text-sm opacity-90">
            <span className="hk-only-fine">
              Drag a card onto a slot, or click it and pick a slot.
            </span>
            <span className="hk-only-coarse">Tap a card to equip it.</span>
          </p>

          {/* Dense on purpose: on a laptop the last row and the slots fit in one screen (drag). */}
          <ul className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-4">
            {skills.map((skill) => {
              const slot = slotOf(skill.id);
              const open = chooser?.skillId === skill.id;
              const cardId = `inventory-${skill.id}`;
              return (
                <li key={skill.id} className="relative">
                  <button
                    type="button"
                    id={cardId}
                    data-inventory-card
                    data-skill-id={skill.id}
                    data-equipped={slot !== -1 || undefined}
                    aria-haspopup="dialog"
                    aria-expanded={open}
                    aria-controls={open && !mobile ? `equip-${skill.id}` : undefined}
                    className="hk-item"
                    onClick={(event) => openChooser(skill.id, event.currentTarget)}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className={cn(
                          "border-paper block size-2.5 shrink-0 rotate-45 border-2",
                          MARK[skill.category],
                        )}
                      />
                      <span className="hk-pixel min-w-0 flex-1 truncate text-[0.6rem] opacity-80">
                        {skill.name}
                      </span>
                      <span
                        aria-hidden="true"
                        className={cn("hk-item-slot hk-pixel", slot === -1 && "invisible")}
                      >
                        {slot === -1 ? "0" : slot + 1}
                      </span>
                    </span>
                    <span className="mt-1.5 block min-h-[2.5em] text-[0.9375rem] leading-tight font-bold wrap-break-word hyphens-auto sm:text-base">
                      {skill.attack_name}
                    </span>
                    <span className="hk-mono mt-1 block text-[0.6875rem] whitespace-nowrap opacity-90 sm:text-xs">
                      {skill.damage} DMG · {seconds(skill.cooldown_ms)}
                    </span>
                    <span className="sr-only">
                      {slot === -1 ? ". Not equipped." : `. Equipped in slot ${slot + 1}.`} Equip
                    </span>
                  </button>
                  {open && !mobile && chosen ? (
                    <EquipPopover
                      id={`equip-${skill.id}`}
                      titleId={`equip-title-${skill.id}`}
                      anchorId={cardId}
                      align={chooser?.align ?? "left"}
                      skill={chosen}
                      loadout={loadout}
                      onChoose={choose}
                      onUnequip={unequipChosen}
                      onDismiss={closeChooser}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>

        {/* ── Training Dummy ─────────────────────────────────────────── */}
        <TrainingDummy
          key={ids.join(",")}
          loadout={loadout}
          auto={auto}
          onAutoChange={setAuto}
          className="xl:col-span-5"
        />
      </div>

      <EquipSheet
        skill={mobile ? chosen : null}
        lite={lite}
        titleId="equip-sheet-title"
        loadout={loadout}
        onChoose={choose}
        onUnequip={unequipChosen}
        onDismiss={() => closeChooser(true)}
      />
    </div>
  );
}
