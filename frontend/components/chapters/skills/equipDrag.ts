"use client";

import { Draggable, gsap } from "@/lib/gsap";

type Point = { x: number; y: number };

/** gsap.matchMedia's contextSafe, typed (tweens made in callbacks join the context → reverted). */
export type Safe = <T extends (...args: never[]) => unknown>(fn: T) => T;

type Options = {
  /** The Armory: holds the [data-inventory-card]s and the [data-slot]s. */
  root: HTMLElement;
  /** Reduced motion: no ghost flights (the ghost still follows the pointer while dragging). */
  reduce: boolean;
  safe: Safe;
  /**
   * Drop handler: equip `skillId` (dragged from slot `fromSlot`, or from the inventory when null)
   * into slot `toSlot`. Returns the slot it actually landed in, or null when nothing changed.
   */
  onDrop: (skillId: number, fromSlot: number | null, toSlot: number) => number | null;
};

/** Pointer position (viewport) of a Draggable event. */
function pointOf(event: Event | null | undefined): Point | null {
  if (!event) return null;
  if ("clientX" in event && typeof event.clientX === "number") {
    return { x: event.clientX, y: (event as MouseEvent).clientY };
  }
  const touch = (event as TouchEvent).changedTouches?.[0];
  return touch ? { x: touch.clientX, y: touch.clientY } : null;
}

/** A visual copy of the dragged card that follows the pointer (fixed, inert, aria-hidden). */
function makeGhost(source: HTMLElement, rect: DOMRect, reduce: boolean): HTMLElement {
  const ghost = source.cloneNode(true) as HTMLElement;
  for (const el of [ghost, ...ghost.querySelectorAll<HTMLElement>("*")]) {
    for (const attr of ["id", "data-slot", "data-inventory-card", "data-skill-id", "aria-controls"])
      el.removeAttribute(attr);
  }
  ghost.setAttribute("aria-hidden", "true");
  ghost.inert = true;
  ghost.classList.add("hk-drag-ghost");
  Object.assign(ghost.style, {
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
  });
  document.body.appendChild(ghost);
  if (!reduce) gsap.to(ghost, { scale: 1.05, rotation: -3, duration: 0.15, ease: "power2.out" });
  return ghost;
}

/**
 * Drag-to-equip (spec §4.1 skills "Pasang dengan drag kartu ke slot (GSAP Draggable)"):
 * - an inventory card dragged onto a slot equips it there;
 * - a slot's skill dragged onto another slot swaps the two;
 * - dropped anywhere else, the ghost snaps back and nothing changes.
 * Draggable runs on an invisible proxy per trigger (the card/slot itself never moves); a cloned
 * ghost follows the pointer. A press without movement stays a click (cards open the Equip menu;
 * Draggable suppresses the click after a real drag). Returns the teardown.
 */
export function setupEquipDrag({ root, reduce, safe, onDrop }: Options): () => void {
  const slots = Array.from(root.querySelectorAll<HTMLElement>("[data-slot]"));
  const cards = Array.from(root.querySelectorAll<HTMLElement>("[data-inventory-card]"));
  const proxies: HTMLElement[] = [];
  const ghosts = new Set<HTMLElement>();

  const slotAt = (p: Point): number | null => {
    for (const slot of slots) {
      const r = slot.getBoundingClientRect();
      if (p.x >= r.left - 8 && p.x <= r.right + 8 && p.y >= r.top - 8 && p.y <= r.bottom + 8) {
        return Number(slot.dataset.slot);
      }
    }
    return null;
  };

  const markTarget = (index: number | null) => {
    for (const slot of slots) {
      const on = index !== null && Number(slot.dataset.slot) === index;
      if (on !== slot.hasAttribute("data-drop-target")) {
        if (on) slot.setAttribute("data-drop-target", "");
        else slot.removeAttribute("data-drop-target");
      }
    }
  };

  const triggers = [
    ...cards.map((el) => ({ el, fromSlot: false })),
    ...slots.map((el) => ({ el, fromSlot: true })),
  ];

  const drags = triggers.map(({ el, fromSlot }) => {
    const proxy = document.createElement("div");
    proxy.className = "hk-drag-proxy";
    document.body.appendChild(proxy);
    proxies.push(proxy);

    let start: Point = { x: 0, y: 0 };
    let rect: DOMRect | null = null;
    let skillId: number | null = null;
    let ghost: HTMLElement | null = null;
    let over: number | null = null;

    const [drag] = Draggable.create(proxy, {
      trigger: el,
      type: "x,y",
      // Cards are <button>s (click = Equip menu): let them drag too. In slots, the Unequip button
      // stays a plain button.
      dragClickables: !fromSlot,
      minimumMovement: 6,
      autoScroll: 1, // near the top/bottom edge the page scrolls (inventory row far from the slots)
      cursor: "grab",
      activeCursor: "grabbing",
      onPress: () => {
        start = pointOf(drag.pointerEvent) ?? start;
        rect = el.getBoundingClientRect();
        skillId = el.dataset.skillId ? Number(el.dataset.skillId) : null; // empty slot: null
      },
      onDragStart: () => {
        if (skillId === null || !rect) return;
        ghost = makeGhost(el, rect, reduce);
        ghosts.add(ghost);
        el.setAttribute("data-drag-source", "");
        root.setAttribute("data-dragging", "");
      },
      onDrag: () => {
        const p = pointOf(drag.pointerEvent);
        if (!ghost || !p) return;
        gsap.set(ghost, { x: p.x - start.x, y: p.y - start.y });
        over = slotAt(p);
        markTarget(over);
      },
      onRelease: safe(() => {
        // Hit-test again at the release point: the page may have auto-scrolled under a still pointer.
        const p = pointOf(drag.pointerEvent);
        const target = ghost && p ? slotAt(p) : over;
        gsap.set(proxy, { x: 0, y: 0 });
        drag.update();
        const flying = ghost;
        const from = rect;
        ghost = null;
        over = null;
        markTarget(null);
        el.removeAttribute("data-drag-source");
        root.removeAttribute("data-dragging");
        if (!flying || !from || skillId === null) return;

        const landed =
          target !== null
            ? onDrop(skillId, fromSlot ? Number(el.dataset.slot) : null, target)
            : null;
        const done = () => {
          flying.remove();
          ghosts.delete(flying);
        };
        if (reduce) return done();

        if (landed !== null) {
          // Into the slot it landed in (a slot past the filled ones means the first empty one).
          const to = slots[landed]?.getBoundingClientRect();
          if (!to) return done();
          gsap.to(flying, {
            x: to.left + to.width / 2 - (from.left + from.width / 2),
            y: to.top + to.height / 2 - (from.top + from.height / 2),
            scale: 0.55,
            rotation: 0,
            opacity: 0,
            duration: 0.28,
            ease: "power2.in",
            onComplete: done,
          });
          return;
        }
        // Back to where the source is now (the page may have scrolled meanwhile).
        const home = el.getBoundingClientRect();
        gsap.to(flying, {
          x: home.left - from.left,
          y: home.top - from.top,
          scale: 1,
          rotation: 0,
          duration: 0.45,
          ease: "back.out(1.6)",
          onComplete: done,
        });
      }),
    });
    return drag;
  });

  return () => {
    for (const drag of drags) drag.kill();
    for (const proxy of proxies) proxy.remove();
    for (const ghost of ghosts) ghost.remove();
    markTarget(null);
    root.removeAttribute("data-dragging");
    for (const { el } of triggers) {
      el.removeAttribute("data-drag-source");
      gsap.set(el, { clearProps: "cursor,touchAction,userSelect" });
    }
  };
}
