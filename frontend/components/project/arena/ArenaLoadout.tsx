"use client";

import { RotateCcw, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

import { EquipPopover, EquipSheet } from "@/components/chapters/skills/EquipMenu";
import { seconds } from "@/components/chapters/skills/format";
import {
  equipSkill,
  resetLoadout,
  sameIds,
  unequipSlot,
  type LoadoutChange,
  type LoadoutContext,
} from "@/components/chapters/skills/loadout";
import { LOADOUT_SIZE, type GameSkill } from "@/lib/battle";
import { cn } from "@/lib/utils";

type Props = {
  id: string;
  ctx: LoadoutContext;
  /** The loadout on screen (save or default), slot order. */
  loadout: readonly GameSkill[];
  mobile: boolean;
  lite: boolean;
  /** Close; focus goes back to the Arena's "Edit loadout" button. */
  onClose: () => void;
};

type Chooser = { skillId: number; align: "left" | "right" };

/**
 * The Arena's "Edit loadout" (spec §6.4 step 1: "membuka pemilih loadout di tempat"): the Skill
 * Tree's loadout editor, opened in place over the Arena body, never during a fight. Same rules and
 * the same code as the Armory: loadout.ts (equip / swap / unequip / default, Tinkerer badge, the
 * announcement) and the Equip menu (EquipMenu.tsx: a popover on desktop, a bottom sheet on phones).
 * Pick a skill → choose slot 1–4. The panel keeps the Arena's box: no layout shift.
 */
export function ArenaLoadout({ id, ctx, loadout, mobile, lite, onClose }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [chooser, setChooser] = useState<Chooser | null>(null);
  const [status, setStatus] = useState({ text: "", serial: 0 });

  const ids = loadout.map((skill) => skill.id);
  const isDefault = sameIds(
    ids,
    ctx.defaults.map((skill) => skill.id),
  );
  const slotOf = (skillId: number) => ids.indexOf(skillId);
  const chosen = chooser ? (ctx.byId.get(chooser.skillId) ?? null) : null;

  // Focus lands on the first skill: picking one is what the panel is for.
  useEffect(() => {
    root.current?.querySelector<HTMLElement>("[data-arena-item]")?.focus({ preventScroll: true });
  }, []);

  const applied = useCallback((change: LoadoutChange | null) => {
    if (!change) return;
    // A trailing zero-width space makes a repeated sentence a new one for screen readers.
    setStatus((prev) => ({
      text: prev.serial % 2 ? change.message : `${change.message}​`,
      serial: prev.serial + 1,
    }));
  }, []);

  const focusItem = useCallback((skillId: number) => {
    root.current
      ?.querySelector<HTMLElement>(`[data-arena-item][data-skill-id="${skillId}"]`)
      ?.focus({ preventScroll: true });
  }, []);

  const closeChooser = useCallback(
    (refocus: boolean) => {
      const skillId = chooser?.skillId;
      setChooser(null);
      if (refocus && skillId !== undefined) focusItem(skillId);
    },
    [chooser, focusItem],
  );

  const openChooser = (skillId: number, card: HTMLElement) => {
    if (chooser?.skillId === skillId) {
      setChooser(null);
      return;
    }
    const panel = root.current?.getBoundingClientRect();
    const rect = card.getBoundingClientRect();
    const middle = panel ? panel.left + panel.width / 2 : window.innerWidth / 2;
    setChooser({ skillId, align: rect.left + rect.width / 2 > middle ? "right" : "left" });
  };

  const choose = (slot: number) => {
    if (!chooser) return;
    applied(equipSkill(ctx, slot, chooser.skillId));
    closeChooser(true);
  };

  const unequipChosen = () => {
    if (!chooser) return;
    applied(unequipSlot(ctx, slotOf(chooser.skillId)));
    closeChooser(true);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // The popover handles its own Esc (and stops it); an Esc that gets here closes the editor.
    if (event.key !== "Escape" || chooser) return;
    event.stopPropagation();
    onClose();
  };

  const slots = Array.from({ length: LOADOUT_SIZE }, (_, i) => loadout[i] ?? null);

  return (
    <div
      ref={root}
      id={id}
      role="group"
      aria-labelledby={titleId}
      className="hk-arena-edit"
      data-arena-editor
      onKeyDown={onKeyDown}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={titleId} className="hk-pixel text-lime text-xs">
          <span aria-hidden="true">▸ </span>Edit loadout
        </h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={cn("hk-equip-link text-paper", isDefault && "invisible")}
            onClick={() => applied(resetLoadout(ctx))}
          >
            <RotateCcw aria-hidden="true" className="size-3.5" strokeWidth={2.5} />
            Default
          </button>
          <button type="button" className="hk-equip-link bg-lime text-ink" onClick={onClose}>
            Done
          </button>
        </div>
      </div>

      <ol className="hk-arena-edit-slots" aria-label="Equipped skills">
        {slots.map((skill, i) => (
          <li key={i} className={cn("hk-arena-edit-slot", !skill && "is-empty")}>
            <span aria-hidden="true" className="hk-fire-key hk-pixel">
              {i + 1}
            </span>
            <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-bold">
              <span className="sr-only">Slot {i + 1}: </span>
              {skill ? skill.attack_name : "Empty"}
            </span>
            {skill ? (
              <button
                type="button"
                className="hk-arena-unequip"
                aria-label={`Unequip ${skill.name} from slot ${i + 1}`}
                aria-disabled={loadout.length <= 1 || undefined}
                title={loadout.length <= 1 ? "Keep at least one skill equipped" : "Unequip"}
                onClick={() => applied(unequipSlot(ctx, i))}
              >
                <X aria-hidden="true" className="size-3" strokeWidth={3} />
              </button>
            ) : null}
          </li>
        ))}
      </ol>

      {/* The desktop Equip popover hangs from here, over the skill list (in place, never clipped). */}
      <div className="relative">
        {chooser && !mobile && chosen ? (
          <EquipPopover
            id={`${id}-equip`}
            titleId={`${id}-equip-title`}
            anchorId={`${id}-item-${chooser.skillId}`}
            align={chooser.align}
            skill={chosen}
            loadout={loadout}
            onChoose={choose}
            onUnequip={unequipChosen}
            onDismiss={closeChooser}
          />
        ) : null}
      </div>

      <ul className="hk-arena-edit-list" aria-label="Skills">
        {ctx.skills.map((skill) => {
          const slot = slotOf(skill.id);
          const open = chooser?.skillId === skill.id;
          return (
            <li key={skill.id}>
              <button
                type="button"
                id={`${id}-item-${skill.id}`}
                data-arena-item
                data-skill-id={skill.id}
                data-equipped={slot !== -1 || undefined}
                aria-haspopup="dialog"
                aria-expanded={open}
                aria-controls={open && !mobile ? `${id}-equip` : undefined}
                className="hk-arena-item"
                onClick={(event) => openChooser(skill.id, event.currentTarget)}
              >
                <span className="flex items-center gap-1.5">
                  <span className="min-w-0 flex-1 truncate text-[0.8125rem] leading-tight font-bold">
                    {skill.attack_name}
                  </span>
                  <span
                    aria-hidden="true"
                    className={cn("hk-item-slot hk-pixel", slot === -1 && "invisible")}
                  >
                    {slot === -1 ? "0" : slot + 1}
                  </span>
                </span>
                <span className="hk-mono mt-0.5 block truncate text-[0.625rem] opacity-85">
                  {skill.name} · {skill.damage} DMG · {seconds(skill.cooldown_ms)}
                </span>
                <span className="sr-only">
                  {slot === -1 ? ". Not equipped." : `. Equipped in slot ${slot + 1}.`} Equip
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <p role="status" aria-live="polite" className="hk-pixel text-lime min-h-4 text-[0.6rem]">
        {status.text}
      </p>

      <EquipSheet
        skill={mobile ? chosen : null}
        lite={lite}
        titleId={`${id}-sheet-title`}
        loadout={loadout}
        onChoose={choose}
        onUnequip={unequipChosen}
        onDismiss={() => closeChooser(true)}
      />
    </div>
  );
}
