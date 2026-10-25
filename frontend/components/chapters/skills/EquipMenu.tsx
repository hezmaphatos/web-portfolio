"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type FocusEvent, type KeyboardEvent } from "react";

import { lockScroll } from "@/components/providers/SmoothScroll";
import { LOADOUT_SIZE, type GameSkill } from "@/lib/battle";
import { gsap, MEDIA } from "@/lib/gsap";
import { cn } from "@/lib/utils";

import { seconds } from "./format";

type OptionState = "here" | "swap" | "replace" | "empty" | "blocked";

type Option = { slot: number; occupant: GameSkill | null; state: OptionState };

/**
 * What choosing each slot would do (store.equip semantics: the loadout is a compact list, so an
 * empty slot always means "the first empty one"; an equipped skill can swap but not leave a gap).
 */
function equipOptions(loadout: readonly GameSkill[], skillId: number): Option[] {
  const from = loadout.findIndex((skill) => skill.id === skillId);
  return Array.from({ length: LOADOUT_SIZE }, (_, slot) => {
    const occupant = loadout[slot] ?? null;
    if (occupant) {
      const state = occupant.id === skillId ? "here" : from !== -1 ? "swap" : "replace";
      return { slot, occupant, state };
    }
    return { slot, occupant, state: slot === loadout.length && from === -1 ? "empty" : "blocked" };
  });
}

const ACTION: Record<OptionState, string> = {
  here: "Equipped here",
  swap: "Swap",
  replace: "Replace",
  empty: "Equip",
  blocked: "Fill in order",
};

type MenuProps = {
  skill: GameSkill;
  loadout: readonly GameSkill[];
  titleId: string;
  onChoose: (slot: number) => void;
  onUnequip: () => void;
  onClose: () => void;
};

/** The Equip menu's content, shared by the desktop popover and the phone bottom sheet. */
function EquipOptions({ skill, loadout, titleId, onChoose, onUnequip, onClose }: MenuProps) {
  const options = equipOptions(loadout, skill.id);
  const equipped = loadout.some((s) => s.id === skill.id);
  const lastOne = equipped && loadout.length <= 1;

  return (
    <>
      <p className="hk-pixel text-ink-2 text-[0.6rem]">Equip to slot 1–{LOADOUT_SIZE}</p>
      <p id={titleId} className="mt-1 pr-10 text-lg leading-tight font-bold">
        {skill.attack_name}
        <span className="sr-only"> ({skill.name}): choose a slot</span>
      </p>
      <p className="hk-mono text-ink-2 mt-0.5 text-xs">
        {skill.name} · {skill.damage} DMG · {seconds(skill.cooldown_ms)}
      </p>

      <ul className="mt-3 grid grid-cols-2 gap-2">
        {options.map((option) => {
          const disabled = option.state === "here" || option.state === "blocked";
          return (
            <li key={option.slot}>
              <button
                type="button"
                data-equip-slot={option.slot}
                aria-disabled={disabled || undefined}
                className="hk-equip-opt"
                onClick={() => {
                  if (!disabled) onChoose(option.slot);
                }}
              >
                <span aria-hidden="true" className="hk-slot-key hk-pixel">
                  {option.slot + 1}
                </span>
                <span className="min-w-0">
                  <span className="sr-only">Slot {option.slot + 1}: </span>
                  <span className="line-clamp-2 text-sm leading-tight font-bold wrap-break-word hyphens-auto">
                    {option.occupant ? option.occupant.attack_name : "Empty slot"}
                  </span>
                  <span className="hk-pixel mt-1 block text-[0.55rem] leading-none">
                    <span className="sr-only"> — </span>
                    {ACTION[option.state]}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 flex items-center justify-between gap-2">
        {equipped ? (
          <button
            type="button"
            className="hk-equip-link"
            aria-disabled={lastOne || undefined}
            title={lastOne ? "Keep at least one skill equipped" : undefined}
            onClick={() => {
              if (!lastOne) onUnequip();
            }}
          >
            Unequip
          </button>
        ) : (
          <span />
        )}
        <button type="button" className="hk-equip-link" onClick={onClose}>
          Cancel
        </button>
      </div>
    </>
  );
}

/** First option that can be chosen (else the first one), for initial focus. */
function firstOption(el: HTMLElement | null): HTMLElement | null {
  return (
    el?.querySelector<HTMLElement>("[data-equip-slot]:not([aria-disabled])") ??
    el?.querySelector<HTMLElement>("[data-equip-slot]") ??
    null
  );
}

type PopoverProps = Omit<MenuProps, "onClose"> & {
  id: string;
  /** Opens to the left edge of the card, or to its right edge near the viewport's right side. */
  align: "left" | "right";
  /** The card that opened it (clicks on it toggle the menu instead of closing it twice). */
  anchorId: string;
  /** Close; `refocus` = give focus back to the card (Esc, Cancel, a choice). */
  onDismiss: (refocus: boolean) => void;
};

/**
 * Desktop/tablet Equip menu: a small non-modal dialog under the card. Focus moves to the first
 * slot; Esc or Cancel closes it (focus back on the card); clicking or tabbing away closes it too.
 */
export function EquipPopover({ id, align, anchorId, onDismiss, ...menu }: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const dismiss = useRef(onDismiss);
  useEffect(() => {
    dismiss.current = onDismiss;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    firstOption(el)?.focus({ preventScroll: true });
    const onDown = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (el.contains(target) || target?.closest(`#${anchorId}`)) return;
      dismiss.current(false);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [anchorId]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape") return;
    event.stopPropagation();
    onDismiss(true);
  };

  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget as Node | null;
    if (next && !event.currentTarget.contains(next)) onDismiss(false);
  };

  return (
    <div
      ref={ref}
      id={id}
      role="dialog"
      aria-labelledby={menu.titleId}
      className={cn("hk-equip-pop", align === "right" ? "right-0" : "left-0")}
      onKeyDown={onKeyDown}
      onBlur={onBlur}
    >
      <EquipOptions {...menu} onClose={() => onDismiss(true)} />
      <button
        type="button"
        className="hk-equip-x"
        aria-label="Close"
        onClick={() => onDismiss(true)}
      >
        <X aria-hidden="true" className="size-4" strokeWidth={3} />
      </button>
    </div>
  );
}

type SheetProps = Omit<MenuProps, "skill" | "onClose"> & {
  /** The skill being equipped; null = closed. */
  skill: GameSkill | null;
  lite: boolean;
  onDismiss: () => void;
};

/**
 * Phone Equip menu (spec §4.1: "tap kartu → bottom sheet 'Equip to slot 1–4'"): a native modal
 * <dialog> (focus trap, Esc, inert page for free) that slides up from the bottom; tapping the
 * backdrop closes it. The page doesn't scroll behind it.
 */
export function EquipSheet({ skill, lite, onDismiss, ...menu }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const open = skill !== null;
  const still = useRef(lite);
  useEffect(() => {
    still.current = lite;
  });

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || !open) return;
    if (!dialog.open) dialog.showModal();
    firstOption(dialog)?.focus({ preventScroll: true });
    const panel = dialog.firstElementChild;
    if (panel && !still.current && !window.matchMedia(MEDIA.reduce).matches) {
      gsap.fromTo(
        panel,
        { yPercent: 100 },
        { yPercent: 0, duration: 0.32, ease: "power3.out", clearProps: "transform" },
      );
    }
    const release = lockScroll();
    return () => {
      release();
      if (dialog.open) dialog.close();
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="hk-sheet"
      aria-labelledby={menu.titleId}
      onCancel={(event) => {
        event.preventDefault(); // Esc: close through state, so focus returns to the card
        onDismiss();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onDismiss(); // the backdrop
      }}
    >
      <div className="hk-sheet-panel">
        <span aria-hidden="true" className="hk-sheet-grip" />
        {skill ? <EquipOptions {...menu} skill={skill} onClose={onDismiss} /> : null}
      </div>
    </dialog>
  );
}
